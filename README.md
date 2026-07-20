# lispllm — a language model in one page of Lisp

lispllm is a complete character-level GPT written in ~55 executable lines of Lisp and running
live in your browser on a Lisp interpreter written in TypeScript. The 102-line commented source
also explains how to read the Lisp, attention, residual stream, sampling, and generation loop.
Its IDE-style workbench keeps the editable model, guided lessons, live output, inspectors, and
REPL visible without a long page of disconnected demos. The 351k Tiny Shakespeare parameters
ship as 0.34 MB of int8 weights; nothing talks to a server.

## Quickstart

```sh
pnpm i && pnpm dev
```

- `pnpm test` — unit tests (interpreter, kernels vs pure-Lisp references, golden parity)
- `pnpm e2e` — Playwright end-to-end tests (chromium + iPhone SE viewport)
- `pnpm repl` — the Lisp REPL in your terminal
- `pnpm cli:generate "ROMEO: " 300` — generate text from the command line

## Workbench

- **Next** always identifies the first unfinished action for the active lesson. **Learn** expands
  that path into a per-lesson checklist completed by real interactions, not by opening or scrolling
  past a control. Progress is remembered on this device and has its own explicit reset.
- Every lesson includes a short **New to Lisp?** primer and an explained **Try this** card. **Put in
  REPL** only stages and focuses the command; press Enter after reading it to execute. Playground
  examples use the same deliberate flow, including mutations.
- **Lesson output** opens the selected lesson's live experiment. The small info control in each
  content-panel header explains that panel and its primary interaction; hover, focus, or click it.
- **Editor** opens `model.lisp`. Edits are drafts until **Run** or Cmd/Ctrl+Enter succeeds.
  Parse, evaluation, replay, and the UI model contract are checked on an isolated candidate;
  a failure leaves the last good model running.
- **Trace**, **Environment**, **References**, and **Model** are persistent inspector tabs.
  Selecting an AST node in Trace highlights its exact source span in the editor.
- The bottom panel holds the REPL and source problems. Cmd/Ctrl+K focuses the REPL;
  Cmd/Ctrl+J toggles the panel.
- Desktop separators are visible resize grips: drag them, use arrow keys while focused, or
  double-click to restore the default size. Saved widths are fitted to the viewport so the editor
  remains usable; mobile continues to use exclusive panes.
- The palette beside **REPL** offers six presets and a custom accent. It applies immediately,
  derives contrast-safe display/foreground colors, and is remembered only on this device.
- Pane sizes, learning progress, accent choice, the applied source, and the latest draft autosave
  locally in separate records. **Share** creates a compact exact-model-state URL, including custom
  source when it fits the 2 KB URL budget; learning and theme preferences are intentionally omitted.

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

```text
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
