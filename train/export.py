"""
export.py — slice the PyTorch checkpoint into the browser checkpoint format.

- Fused QKV [3d, d] is sliced into per-head layer{i}.head{j}.{wq,wk,wv} [d, d_head].
- PyTorch Linear weights are [out, in]; the browser wants row-major [in, out]
  (x @ W). The transpose happens HERE, not in JS (the classic bug).
- Per-tensor symmetric int8 quantization with an f32 scale.
- Writes model.bin (concatenated int8 payloads) + manifest.json
  ({ charset, ctx, dims, tensors: name/shape/offset/scale, param count }).
"""

import json
import os

import numpy as np
import torch

HERE = os.path.dirname(__file__)
OUT_DIR = os.path.join(HERE, "..", "public", "checkpoints", "shakespeare-quick")

CHARSET = "\n" + "".join(chr(c) for c in range(32, 127))


def main() -> None:
    sd = torch.load(os.path.join(HERE, "ckpt.pt"), map_location="cpu")
    d = sd["tok_emb.weight"].shape[1]
    ctx = sd["pos_emb.weight"].shape[0]
    n_layer = 1 + max(int(k.split(".")[1]) for k in sd if k.startswith("blocks."))
    n_head = 4
    d_head = d // n_head

    tensors: list[tuple[str, np.ndarray]] = []

    def emit(name: str, w: torch.Tensor) -> None:
        tensors.append((name, w.detach().numpy().astype(np.float32)))

    emit("tok-emb", sd["tok_emb.weight"])  # [V, d] — used as-is (rows) and transposed (tied head)
    emit("pos-emb", sd["pos_emb.weight"])  # [ctx, d]

    for i in range(n_layer):
        p = f"blocks.{i}."
        qkv = sd[p + "attn.weight"]  # [3d, d] fused, [out, in]
        wq_all, wk_all, wv_all = qkv.split(d, dim=0)  # each [d, d]
        for j in range(n_head):
            sl = slice(j * d_head, (j + 1) * d_head)
            # [out, in] -> transpose to [in, out] = [d, d_head]
            emit(f"layer{i}.head{j}.wq", wq_all[sl, :].T)
            emit(f"layer{i}.head{j}.wk", wk_all[sl, :].T)
            emit(f"layer{i}.head{j}.wv", wv_all[sl, :].T)
        emit(f"layer{i}.wo", sd[p + "proj.weight"].T)  # [d, d]
        emit(f"layer{i}.w-up", sd[p + "up.weight"].T)  # [d, 4d]
        emit(f"layer{i}.w-down", sd[p + "down.weight"].T)  # [4d, d]
        emit(f"layer{i}.ln1.g", sd[p + "ln1.weight"])
        emit(f"layer{i}.ln1.b", sd[p + "ln1.bias"])
        emit(f"layer{i}.ln2.g", sd[p + "ln2.weight"])
        emit(f"layer{i}.ln2.b", sd[p + "ln2.bias"])

    emit("ln-f.g", sd["ln_f.weight"])
    emit("ln-f.b", sd["ln_f.bias"])

    os.makedirs(OUT_DIR, exist_ok=True)
    payload = bytearray()
    table = []
    for name, w in tensors:
        scale = float(np.abs(w).max()) / 127.0 if np.abs(w).max() > 0 else 1.0
        q = np.clip(np.round(w / scale), -127, 127).astype(np.int8)
        table.append(
            {
                "name": name,
                "shape": list(w.shape),
                "offset": len(payload),
                "scale": scale,
            }
        )
        payload.extend(q.tobytes())

    with open(os.path.join(OUT_DIR, "model.bin"), "wb") as f:
        f.write(bytes(payload))

    manifest = {
        "charset": CHARSET,
        "ctx": ctx,
        "dims": {"n_layer": n_layer, "d_model": d, "n_head": n_head, "d_head": d_head},
        "tensors": table,
        "params": int(sum(w.size for _, w in tensors)),
    }
    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f)

    print(f"wrote {len(payload)} bytes of int8 weights, {len(table)} tensors")
    print(f"params {manifest['params']:,}")


if __name__ == "__main__":
    main()
