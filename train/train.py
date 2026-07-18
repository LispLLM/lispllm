"""
train.py — nanoGPT-style character-level GPT on Tiny Shakespeare.

Quick config (spec §9): n_layer 3, d_model 96, n_head 4 (d_head 24), ctx 96,
MLP 4x, pre-norm, GELU (tanh), learned positional embeddings, no biases on
linears (LayerNorm keeps gain+bias), weight tying. ~350k params.

AdamW lr 3e-4, 100-step warmup, cosine decay, batch 64 x ctx, dropout 0,
seed 1337, eval every 250 steps. Stop at val loss <= 1.95 or 60-minute budget.
"""

import argparse
import math
import os
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = os.path.dirname(__file__)

# fixed 96-char vocabulary: \n + printable ASCII 32..126
CHARSET = "\n" + "".join(chr(c) for c in range(32, 127))
VOCAB = len(CHARSET)  # 96
STOI = {ch: i for i, ch in enumerate(CHARSET)}
Q = STOI["?"]


def encode(text: str) -> list[int]:
    return [STOI.get(ch, Q) for ch in text]


class Block(nn.Module):
    def __init__(self, d: int, nh: int, ctx: int):
        super().__init__()
        self.nh = nh
        self.ln1 = nn.LayerNorm(d)
        self.attn = nn.Linear(d, 3 * d, bias=False)
        self.proj = nn.Linear(d, d, bias=False)
        self.ln2 = nn.LayerNorm(d)
        self.up = nn.Linear(d, 4 * d, bias=False)
        self.down = nn.Linear(4 * d, d, bias=False)
        mask = torch.tril(torch.ones(ctx, ctx)).view(1, 1, ctx, ctx)
        self.register_buffer("mask", mask)

    def forward(self, x):
        B, T, C = x.shape
        h = self.ln1(x)
        q, k, v = self.attn(h).split(C, dim=2)
        q = q.view(B, T, self.nh, C // self.nh).transpose(1, 2)
        k = k.view(B, T, self.nh, C // self.nh).transpose(1, 2)
        v = v.view(B, T, self.nh, C // self.nh).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) / math.sqrt(k.size(-1))
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, -1e9)
        att = F.softmax(att, dim=-1)
        y = (att @ v).transpose(1, 2).contiguous().view(B, T, C)
        x = x + self.proj(y)
        x = x + self.down(F.gelu(self.up(self.ln2(x)), approximate="tanh"))
        return x


class GPT(nn.Module):
    def __init__(self, n_layer: int, d: int, nh: int, ctx: int):
        super().__init__()
        self.ctx = ctx
        self.tok_emb = nn.Embedding(VOCAB, d)
        self.pos_emb = nn.Embedding(ctx, d)
        self.blocks = nn.ModuleList(Block(d, nh, ctx) for _ in range(n_layer))
        self.ln_f = nn.LayerNorm(d)
        # weight tying: logits = h @ tok_emb.T (no separate output head)
        self.apply(self._init)

    def _init(self, m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None):
        B, T = idx.shape
        pos = torch.arange(T, device=idx.device)
        x = self.tok_emb(idx) + self.pos_emb(pos)
        for blk in self.blocks:
            x = blk(x)
        x = self.ln_f(x)
        logits = x @ self.tok_emb.weight.T
        loss = None
        if targets is not None:
            loss = F.cross_entropy(logits.view(-1, VOCAB), targets.view(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, n, temperature=0.8):
        for _ in range(n):
            logits, _ = self(idx[:, -self.ctx :])
            probs = F.softmax(logits[:, -1, :] / temperature, dim=-1)
            idx = torch.cat([idx, torch.multinomial(probs, 1)], dim=1)
        return idx


def get_batch(data, batch, ctx, device):
    ix = torch.randint(len(data) - ctx - 1, (batch,))
    x = torch.stack([data[i : i + ctx] for i in ix])
    y = torch.stack([data[i + 1 : i + ctx + 1] for i in ix])
    return x.to(device), y.to(device)


@torch.no_grad()
def eval_loss(model, data, batch, ctx, device, iters=40):
    model.eval()
    total = 0.0
    for _ in range(iters):
        x, y = get_batch(data, batch, ctx, device)
        _, loss = model(x, y)
        total += loss.item()
    model.train()
    return total / iters


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--full", action="store_true", help="4 layers / d 128 / ctx 128")
    args = p.parse_args()

    n_layer, d, nh, ctx = (4, 128, 4, 128) if args.full else (3, 96, 4, 96)
    batch, lr, warmup, max_steps = 64, 3e-4, 100, 20000
    target_val, budget_s = 1.95, 60 * 60

    torch.manual_seed(1337)
    device = "mps" if torch.backends.mps.is_available() else "cpu"

    with open(os.path.join(HERE, "data", "input.txt")) as f:
        text = f.read()
    data = torch.tensor(encode(text), dtype=torch.long)
    n_train = int(0.9 * len(data))
    train_data, val_data = data[:n_train], data[n_train:]

    model = GPT(n_layer, d, nh, ctx).to(device)
    nparams = sum(t.numel() for t in model.parameters())
    print(f"device {device} | params {nparams:,} | vocab {VOCAB} | ctx {ctx}")

    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    def lr_at(step):
        if step < warmup:
            return lr * (step + 1) / warmup
        t = (step - warmup) / max(1, max_steps - warmup)
        return 0.1 * lr + 0.9 * lr * 0.5 * (1 + math.cos(math.pi * t))

    log_path = os.path.join(HERE, "train.log")
    log = open(log_path, "w")
    start = time.time()
    best_val = float("inf")

    for step in range(max_steps):
        for g in opt.param_groups:
            g["lr"] = lr_at(step)
        x, y = get_batch(train_data, batch, ctx, device)
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()

        if step % 250 == 0 or step == max_steps - 1:
            vl = eval_loss(model, val_data, batch, ctx, device)
            el = time.time() - start
            line = f"step {step:5d} | train {loss.item():.4f} | val {vl:.4f} | {el:6.0f}s"
            print(line)
            log.write(line + "\n")
            log.flush()
            if vl < best_val:
                best_val = vl
                torch.save(model.state_dict(), os.path.join(HERE, "ckpt.pt"))
            if vl <= target_val:
                print(f"target val {target_val} reached")
                break
            if el > budget_s:
                print("60-minute budget reached")
                break

    # sample 300 chars at T=0.8 from the best checkpoint
    model.load_state_dict(torch.load(os.path.join(HERE, "ckpt.pt")))
    model.eval()
    prompt = torch.tensor([encode("ROMEO: ")], dtype=torch.long, device=device)
    out = model.generate(prompt, 300, temperature=0.8)[0].tolist()
    sample = "".join(CHARSET[i] for i in out)
    print("--- sample (T=0.8) ---")
    print(sample)
    log.write(f"best val {best_val:.4f}\n--- sample (T=0.8) ---\n{sample}\n")
    log.close()
    print(f"best val {best_val:.4f} | log: {log_path}")


if __name__ == "__main__":
    main()
