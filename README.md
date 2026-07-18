# lispllm — a language model in one page of Lisp

A complete character-level GPT, written in ~55 lines of Lisp, running live in your browser on
a Lisp interpreter written in TypeScript. Every figure on the page is computed by the code
beside it — pause it, poke it, break it. The weights (351k parameters, 0.34 MB int8) were
trained on Tiny Shakespeare and ship with the page; nothing talks to a server.

## Quickstart

```sh
pnpm i && pnpm dev
```

- `pnpm test` — unit tests (interpreter, kernels vs pure-Lisp references, golden parity)
- `pnpm e2e` — Playwright end-to-end tests (chromium + iPhone SE viewport)
- `pnpm repl` — the Lisp REPL in your terminal
- `pnpm cli:generate "ROMEO: " 300` — generate text from the command line

## Train your own (tonight — it's included)

```sh
python3 -m venv train/venv && train/venv/bin/pip install torch numpy
train/venv/bin/python train/get_data.py     # Tiny Shakespeare, 1.1 MB
train/venv/bin/python train/train.py        # ~1–2 min on Apple Silicon (MPS), <60 min CPU
train/venv/bin/python train/export.py       # int8 weights → public/checkpoints/
train/venv/bin/python train/verify.py       # NumPy forward → golden.json parity fixture
```

`train.py --full` trains a bigger variant. The exporter slices fused QKV into per-head
matrices so the Lisp stays readable.

## Architecture

```
        train/ (offline, PyTorch)                browser (online, no server)
  ┌──────────────────────────────┐   ┌───────────────────────────────────────────┐
  │ train.py ─▶ ckpt.pt          │   │  model.lisp ──▶ reader ─▶ AST ─▶ eval     │
  │ export.py ─▶ model.bin (int8)│──▶│      ▲                     │      │       │
  │             manifest.json    │   │      │ printer (splices    │   tensor     │
  │ verify.py ─▶ golden.json     │   │      │ knob edits)         │   kernels    │
  └──────────────────────────────┘   │      │                     ▼      ▼       │
                                     │   CodePanel ◀── trace ── one Lisp image   │
                                     │   TensorView ◀───┘        (env + weights) │
                                     │   REPL ◀────────────────────────┘         │
                                     └───────────────────────────────────────────┘
```

One invariant rules the page: **there is only one image**. Every viz, knob, and REPL entry is
a projection of a single Lisp environment. UI controls echo as `;; ui:` REPL lines or visible
AST edits — if you see it, it ran.

Native tensor kernels (`matmul`, `softmax`, …) keep it fast, but each has a pure-Lisp
reference in `public/kernels-ref.lisp`, equivalence-tested — press `?` next to any primitive
on the page.

## Drafted Show HN first comment

> Author here. The whole model — attention, MLP, the sampling loop — is one page of Lisp you
> can read in the page footer, running on a small Lisp interpreter I wrote in TypeScript. The
> weights (351k params, trained on Tiny Shakespeare with the included nanoGPT-style train.py)
> load as 0.34 MB of int8. Nothing leaves your browser.
>
> Nothing here is original: the ideas are McCarthy's (eval in a page, 1960) and the pedagogy
> stands on Karpathy's nanoGPT and Zero to Hero, Jay Alammar's Illustrated Transformer,
> Brendan Bycroft's LLM Visualization, and the Transformer Explainer project. What I wanted to
> add was honesty of mechanism: every figure is computed by the code shown beside it, and the
> REPL edits the same environment the figures read from. Redefine gelu and the model limps,
> live. Happy to answer anything.

## Credits

- John McCarthy — Lisp, and the idea that a page can hold a system
- Andrej Karpathy — nanoGPT, char-rnn (Tiny Shakespeare), Zero to Hero
- Jay Alammar — The Illustrated Transformer
- Brendan Bycroft — LLM Visualization
- Polo Club — Transformer Explainer

MIT licensed. See DECISIONS.md for the build log.
