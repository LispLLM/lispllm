# lispllm — a language model in one page of Lisp

lispllm is a complete character-level GPT written in ~55 lines of Lisp and running live in
your browser on a Lisp interpreter written in TypeScript. Its IDE-style workbench keeps the
editable model, guided lessons, live output, inspectors, and REPL visible without a long page
of disconnected demos. The 351k Tiny Shakespeare parameters ship as 0.34 MB of int8 weights;
nothing talks to a server.

## Quickstart

```sh
pnpm i && pnpm dev
```

- `pnpm test` — unit tests (interpreter, kernels vs pure-Lisp references, golden parity)
- `pnpm e2e` — Playwright end-to-end tests (chromium + iPhone SE viewport)
- `pnpm repl` — the Lisp REPL in your terminal
- `pnpm cli:generate "ROMEO: " 300` — generate text from the command line

## Workbench

- **Learn** presents one guided lesson at a time; **Lesson output** opens its live experiment.
- **Editor** opens `model.lisp`. Edits are drafts until **Run** or Cmd/Ctrl+Enter succeeds.
  Parse, evaluation, replay, and the UI model contract are checked on an isolated candidate;
  a failure leaves the last good model running.
- **Trace**, **Environment**, **References**, and **Model** are persistent inspector tabs.
  Selecting an AST node in Trace highlights its exact source span in the editor.
- The bottom panel holds the REPL and source problems. Cmd/Ctrl+K focuses the REPL;
  Cmd/Ctrl+J toggles the panel.
- Pane sizes, the applied source, and the latest draft autosave locally. **Share** creates a
  compact exact-state URL, including custom source when it fits the 2 KB URL budget.

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
        train/ (offline, PyTorch)                  browser (no server)
  ┌──────────────────────────────┐   ┌─────────────────────────────────────────────┐
  │ train.py ─▶ ckpt.pt          │   │ model.lisp draft ── Run ──▶ candidate Image │
  │ export.py ─▶ model.bin (int8)│──▶│       │                         │ validate   │
  │             manifest.json    │   │       ▼                         ▼            │
  │ verify.py ─▶ golden.json     │   │ CodeMirror ◀─ spans/trace ─ live Image      │
  └──────────────────────────────┘   │                                 │            │
                                     │ Learn/Labs · Inspectors · REPL ─┘            │
                                     │       local autosave · compact share         │
                                     └─────────────────────────────────────────────┘
```

One invariant rules the page: **there is only one image**. Every viz, knob, and REPL entry is
a projection of a single Lisp environment. UI controls echo as `;; ui:` REPL lines or visible
AST edits — if you see it, it ran.

Native tensor kernels (`matmul`, `softmax`, …) keep it fast, but each has an
equivalence-tested pure-Lisp reference in `public/kernels-ref.lisp`. Put the editor cursor on
a builtin and open **kernel ?** to inspect its reference implementation.

## Drafted Show HN first comment

> Author here. The whole model — attention, MLP, the sampling loop — is one page of Lisp you
> can edit and run in the workbench, on a small Lisp interpreter I wrote in TypeScript. The
> weights (351k params, trained on Tiny Shakespeare with the included nanoGPT-style train.py)
> load as 0.34 MB of int8. Nothing leaves your browser.
>
> Nothing here is original: the ideas are McCarthy's (eval in a page, 1960) and the pedagogy
> stands on Karpathy's nanoGPT and Zero to Hero, Jay Alammar's Illustrated Transformer,
> Brendan Bycroft's LLM Visualization, and the Transformer Explainer project. What I wanted to
> add was honesty of mechanism: every figure is computed by the source in the editor, and the
> REPL edits the same environment the figures read from. Redefine gelu and the model limps,
> live. Happy to answer anything.

## Credits

- John McCarthy — Lisp, and the idea that a page can hold a system
- Andrej Karpathy — nanoGPT, char-rnn (Tiny Shakespeare), Zero to Hero
- Jay Alammar — The Illustrated Transformer
- Brendan Bycroft — LLM Visualization
- Polo Club — Transformer Explainer

MIT licensed. See DECISIONS.md for the build log.
