"""
verify.py — dequantize model.bin, run a float32 NumPy forward that matches the
browser kernels (§8) EXACTLY, and write golden.json: greedy (argmax)
continuation of "ROMEO: " for 16 steps with top-5 logits per step.
"""

import json
import os

import numpy as np

HERE = os.path.dirname(__file__)
CKPT = os.path.join(HERE, "..", "public", "checkpoints", "shakespeare-quick")


def load():
    with open(os.path.join(CKPT, "manifest.json")) as f:
        manifest = json.load(f)
    blob = np.fromfile(os.path.join(CKPT, "model.bin"), dtype=np.int8)
    tensors = {}
    for t in manifest["tensors"]:
        n = int(np.prod(t["shape"]))
        q = blob[t["offset"] : t["offset"] + n].astype(np.float32)
        tensors[t["name"]] = (q * np.float32(t["scale"])).reshape(t["shape"]).astype(np.float32)
    return manifest, tensors


def layernorm(x, g, b, eps=1e-5):
    x = x.astype(np.float32)
    mu = x.mean(axis=-1, keepdims=True)
    var = ((x - mu) ** 2).mean(axis=-1, keepdims=True)
    return ((x - mu) / np.sqrt(var + eps) * g + b).astype(np.float32)


def gelu(x):
    # tanh approximation — must match src/tensor/kernels.ts
    c = np.float32(np.sqrt(2.0 / np.pi))
    return (0.5 * x * (1.0 + np.tanh(c * (x + 0.044715 * x**3)))).astype(np.float32)


def softmax(x):
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return (e / e.sum(axis=-1, keepdims=True)).astype(np.float32)


def forward(manifest, W, tokens):
    d = manifest["dims"]["d_model"]
    nl = manifest["dims"]["n_layer"]
    nh = manifest["dims"]["n_head"]
    T = len(tokens)
    x = (W["tok-emb"][tokens] + W["pos-emb"][:T]).astype(np.float32)
    for i in range(nl):
        xn = layernorm(x, W[f"layer{i}.ln1.g"], W[f"layer{i}.ln1.b"])
        heads = []
        for j in range(nh):
            q = (xn @ W[f"layer{i}.head{j}.wq"]).astype(np.float32)
            k = (xn @ W[f"layer{i}.head{j}.wk"]).astype(np.float32)
            v = (xn @ W[f"layer{i}.head{j}.wv"]).astype(np.float32)
            scores = (q @ k.T).astype(np.float32) * np.float32(1.0 / np.sqrt(k.shape[1]))
            mask = np.triu(np.ones((T, T), dtype=bool), k=1)
            scores = scores.copy()
            scores[mask] = np.float32(-1e9)
            att = softmax(scores)
            heads.append((att @ v).astype(np.float32))
        x = (x + np.concatenate(heads, axis=1) @ W[f"layer{i}.wo"]).astype(np.float32)
        hn = layernorm(x, W[f"layer{i}.ln2.g"], W[f"layer{i}.ln2.b"])
        x = (x + gelu(hn @ W[f"layer{i}.w-up"]) @ W[f"layer{i}.w-down"]).astype(np.float32)
    x = layernorm(x, W["ln-f.g"], W["ln-f.b"])
    return (x @ W["tok-emb"].T).astype(np.float32)


def main() -> None:
    manifest, W = load()
    charset = manifest["charset"]
    stoi = {c: i for i, c in enumerate(charset)}
    ctx = manifest["ctx"]

    tokens = [stoi[c] for c in "ROMEO: "]
    steps = []
    for _ in range(16):
        logits = forward(manifest, W, tokens[-ctx:])[-1]
        top5 = np.argsort(-logits)[:5]
        best = int(np.argmax(logits))
        steps.append(
            {
                "argmax": best,
                "top5": [{"token": int(i), "logit": float(logits[i])} for i in top5],
            }
        )
        tokens.append(best)

    text = "".join(charset[t] for t in tokens)
    golden = {"prompt": "ROMEO: ", "steps": steps, "text": text}
    with open(os.path.join(CKPT, "golden.json"), "w") as f:
        json.dump(golden, f, indent=1)
    print(f"greedy continuation: {text!r}")
    print(f"wrote golden.json with {len(steps)} steps")


if __name__ == "__main__":
    main()
