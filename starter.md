# BUILD PROMPT — lispllm.com
You are a senior engineer building a finished product, not a prototype. Build it to completion.

## 0. Mission

Build **lispllm.com**: a single-page, fully client-side web app demonstrating that a GPT-style
language model is one page of Lisp — and that page is alive. A small character-level GPT
(trained offline, weights shipped as a static asset) runs in the browser via a Lisp interpreter
written in TypeScript. The page is a scrollable narrative where every figure is computed live by
the code displayed beside it, with a persistent REPL docked at the bottom and a references
panel that slides in from the right. There is no backend, no router, no second page.

Audience: Hacker News. They will check whether the displayed code is really what's running.
It must be.

## 1. Agent operating rules

1. Work through the milestones in §17 strictly in order. Do not start milestone N+1 until
   milestone N's exit criteria pass. Run the commands; paste real outputs into `DECISIONS.md`.
2. Maintain `DECISIONS.md`: after each milestone, log what was built, deviations from this
   spec (with one-line rationale), and measured performance numbers.
3. When this spec conflicts with itself or reality, resolve in this order:
   Invariants (§2) > acceptance criteria (§15) > section specs (§11) > aesthetics. Log it.
4. Do not substitute the tech stack, add runtime dependencies, or introduce a backend.
5. If you cannot train the model in your environment (no Python/PyTorch), STOP at M3 and
   report. **Never ship random or untrained weights** — the app would look plausible and be
   a lie. This is the one permitted reason to halt.
6. Do not ask the user questions. Choose the simplest option consistent with the invariants,
   and log the choice.

## 2. Invariants (non-negotiable, test-enforced)

- **INV-1 One image.** A single global Lisp environment ("the image") holds the model, weights,
  and all definitions. Every panel, chart, and number on the page is a projection of the image
  or its trace. UI code must never re-implement model math independently.
- **INV-2 Code is truth.** Any control that affects semantics (temperature slider, top-k toggle,
  head ablation, redefinitions) must manifest as a visible AST edit in a code panel or an
  echoed, visible REPL evaluation — before it takes effect. No hidden state touches the
  forward pass.
- **INV-3 Honest kernels.** Every native tensor primitive has a pure-Lisp reference
  implementation viewable in-app (a "?" affordance on the primitive's name opens it) and a
  passing equivalence test against the native kernel.
- **INV-4 Self-contained.** Zero network requests at runtime except same-origin static assets.
  No CDN fonts, no analytics, no embeds. The app works offline after first load.
- **INV-5 Single page.** One HTML document. No client-side routing. The URL hash is used only
  for scroll position (`#sec-3`), opening a reference (`#ref-5`), and share-state (`#s=...`).
- **INV-6 Determinism.** Given (checkpoint, seed, knob edits, REPL history), all outputs are
  reproducible. A seeded PRNG (mulberry32) lives in the image. Golden tests pin the forward pass.
- **INV-7 No stale caches.** Any memoization must be invalidated by the image rebuild described
  in §5. E2E tests 5 and 7 in §15 exist to catch violations.

## 3. Product shape and hard constraints

- Desktop and mobile web. Single column narrative on mobile; REPL becomes a bottom sheet.
- Total shipped weights ≤ 1.5 MB. App JS bundle ≤ 350 KB gzipped (excluding weights).
- Sustained generation ≥ 10 chars/sec on a 2020-class laptop (target 20), with the honest
  full-context recompute per token (no KV cache in v1 — it's discussed in §11.8 instead).
- No login, no cookies, no localStorage requirement (share links carry state).

## 4. Tech stack (locked)

- Vite + React 18 + TypeScript (`strict: true`; no `any` in `src/lisp/` or `src/tensor/`).
- Tailwind CSS. No component libraries, no chart libraries (all viz is hand-rolled SVG/canvas),
  no CodeMirror (code panels are rendered from the AST — see §12.1).
- State: one small hand-rolled store module using `useSyncExternalStore`. No Redux/zustand.
- Tests: Vitest (unit) + Playwright (e2e, chromium + iPhone SE viewport). ESLint + Prettier.
- Training: Python 3.11 + PyTorch (offline only, in `train/`). Node 20, pnpm.
- Fonts: system monospace stack (`ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace`).
- License: MIT.

## 5. System architecture

**The image.** At boot: fetch `manifest.json` + `model.bin` → dequantize int8→Float32Array →
bind weight records into a fresh environment → read and evaluate `model.lisp` (the canonical
source, §6) top to bottom. The same text of `model.lisp` that is evaluated is the text rendered
in code panels — single source of truth, stored as one asset file.

**Rebuild pipeline.** App state = { checkpoint, seed, knobEdits: [(astPath, newLiteral)],
replHistory: [string], focusString, scrollSection }. Any change to knobEdits or replHistory
rebuilds the image deterministically: fresh env → bind weights → apply knobEdits to the
canonical AST → evaluate it → replay replHistory in order. Rebuild must complete in < 50 ms
(weights are bound by reference, never copied). Running generation streams are not mutated
mid-stream; they show a "definitions changed — regenerate" chip.

**Two forward modes.** `forward` (fast, untraced — used by hero generation and live typing)
and `forward/trace` (records, for every AST node evaluated during one forward pass on the
focus string, its latest value reference plus a context tag {layerId?, headId?}). Kernels are
pure (no in-place mutation), so trace snapshots are references, not copies. The tracer derives
context tags dynamically: when a function application receives a layer or head record as an
argument, push its id for that dynamic extent. Only the focus string is ever traced; retrace is
throttled to 150 ms. All of sections 2–5 and 7 read exclusively from the latest trace.

**Focus string.** One app-wide string (default: last 64 chars of hero output; editable in a
small input at the top of section 3). Sections 2–5 all visualize the same trace of it.

## 6. Canonical model source (normative)

This file ships as `public/model.lisp`, is evaluated into the image, and is rendered in the
page. You may fix genuine errors and adjust helper names, but preserve its shape, brevity
(≤ 70 lines), and comments. Log any change.

```lisp
;;; lispllm — a complete GPT. this file is the whole model.
;;; everything on this page is a live view into these definitions.

;; -------- attention: three questions per token --------
(define (head h x)
  (let* ((q (matmul x (wq h)))            ; what am i looking for?
         (k (matmul x (wk h)))            ; what do i contain?
         (v (matmul x (wv h)))            ; what will i pass along if noticed?
         (scores  (scale (matmul q (transpose k))
                         (/ 1.0 (sqrt (n-cols k)))))
         (weights (softmax (causal-mask scores))))
    (matmul weights v)))

(define ablated '())                      ; try: (set! ablated '((2 . 1)))

(define (attention x layer)
  (let ((xn (layernorm x (ln1 layer))))
    (matmul (concat (map (lambda (h)
                           (if (member (id h) ablated)
                               (zeros (n-rows xn) (n-cols (wv h)))
                               (head h xn)))
                         (heads layer)))
            (wo layer))))

(define (mlp x layer)
  (matmul (gelu (matmul (layernorm x (ln2 layer)) (w-up layer)))
          (w-down layer)))

(define (block x layer)                   ; read from the stream, think, add back
  (let* ((x (add x (attention x layer)))
         (x (add x (mlp x layer))))
    x))

;; -------- the model is a fold --------
(define (embed tokens)
  (add (rows tok-emb tokens)
       (rows pos-emb (iota (length tokens)))))

(define (gpt tokens)
  (matmul (layernorm (fold block (embed tokens) layers) ln-f)
          (transpose tok-emb)))           ; the output layer is the embedding, reused

;; -------- the loop that talks --------
(define temperature 0.8)

(define (next-token tokens)
  (sample (scale (last-row (gpt (last-n ctx tokens)))
                 (/ 1.0 temperature))))

(define (generate tokens n)
  (if (= n 0)
      tokens
      (generate (snoc tokens (next-token tokens)) (- n 1))))

;; that's all of it. scroll on — or open the repl and start poking.
```

`tok-emb`, `pos-emb`, `layers` (list of layer records with id-carrying head records), `ln-f`,
and `ctx` are bound by the checkpoint loader before this file is evaluated.

## 7. Lisp interpreter spec (`src/lisp/`)

- **Reader:** s-expressions; symbols; integer/float literals; strings; `'x` quote sugar; `;`
  comments; dotted pairs for `'((2 . 1))`. Every AST node gets a stable id and source span.
- **Printer:** pretty-printer producing the exact canonical formatting (idempotent: read∘print
  is a fixpoint on `model.lisp`). Floats print to 4 significant figures; long lists elide with `…`.
- **Special forms:** `define` (incl. `(define (f a b) …)` sugar), `lambda`, `let`, `let*`, `if`,
  `cond`, `quote`, `begin`, `set!`, `and`, `or`.
- **Proper tail calls** for `if`/`begin`/`let*`/`cond` tails via trampoline — `generate` is
  tail-recursive and must run for thousands of steps. Unit test: counting loop to 50,000.
- **Builtins (list/scalar):** `cons car cdr list nth length map fold member reverse iota snoc
  last-n + - * / = < > min max abs sqrt exp log not null? eq? shape display help seed!`.
- **Errors:** readable messages with source spans; a runtime error or NaN in the model surfaces
  a non-blocking toast with a one-click `(reset!)` (restores initial image, clears history).
- **Click-to-eval:** any AST node in a code panel can be evaluated against the latest trace
  environment; result prints to the REPL prefixed `;; inspect:`.

## 8. Tensors and kernels (`src/tensor/`)

- Tensor = { shape: [r, c] | [n], data: Float32Array }, row-major. Pure functions only.
- **Native kernels:** `matmul, transpose, add, scale, softmax` (row-wise, max-subtracted),
  `layernorm` (last dim, eps 1e-5, gain+bias record), `gelu` (tanh approximation:
  0.5·x·(1+tanh(√(2/π)·(x+0.044715·x³)))), `causal-mask` (set j>i to −1e9), `concat`
  (column-wise), `rows` (gather rows by index list), `last-row`, `zeros`, `n-rows`, `n-cols`,
  `argmax`, `sample` (softmax + categorical draw from the image PRNG).
- Exact formulas above are normative — the Python reference in §9 must match them so goldens pass.
- Optimize matmul honestly (k-innermost loops, local accumulators, preallocated outputs). No
  algorithmic shortcuts (no KV cache, no low-rank tricks) in v1.
- **Reference implementations (INV-3):** for each kernel, a pure-Lisp definition operating via
  `tensor->lists` / `lists->tensor` on small shapes, shipped as a visible asset and tested for
  equivalence (3 random shapes per op, |Δ| < 1e-5).

## 9. Checkpoint and training pipeline (`train/`)

- **Tokenizer:** fixed 96-char vocabulary = `\n` + printable ASCII 32–126. The charset string
  lives once, in `manifest.json`; Python and TS both read it. Unsupported input chars → `?`.
- **Architecture (quick config, required):** n_layer 3, d_model 96, n_head 4 (d_head 24),
  ctx 96, MLP 4×, pre-norm, GELU, learned positional embeddings, **no biases on linears**
  (LayerNorm keeps gain+bias), weight tying (no separate output head). ≈ 350k params.
  An optional `--full` config (4/128/4/128) may be trained if a GPU is available; the app is
  manifest-driven and must work with either.
- **`train.py`:** nanoGPT-style, ≤ 250 lines. Data: Tiny Shakespeare, downloaded by
  `get_data.py` from the canonical karpathy/char-rnn raw URL. AdamW, lr 3e-4, 100-step warmup,
  cosine decay, batch 64×ctx, dropout 0, seed 1337, eval every 250 steps. Stop at val loss
  ≤ 1.95 or a 60-minute CPU budget, whichever first. Commit the training log and a 300-char
  sample at T=0.8 to `DECISIONS.md` (it should read as mostly-formed words in play format).
- **`export.py`:** slices fused QKV into per-head `layer{i}.head{j}.{wq,wk,wv}` [d, d_head],
  transposes PyTorch `[out,in]` Linear weights to row-major `[in,out]` (classic bug — do it
  here, not in JS), quantizes per-tensor symmetric int8 with an f32 scale, writes `model.bin`
  plus `manifest.json` ({ charset, ctx, dims, tensor table: name/shape/offset/scale, param count }).
- **`verify.py`:** dequantizes, runs a float32 NumPy forward matching §8's formulas exactly,
  and writes `golden.json`: greedy (argmax) continuation of `"ROMEO: "` for 16 steps with
  top-5 logits per step.
- **Golden parity (keystone test):** the TS/Lisp forward on the same checkpoint must reproduce
  all 16 argmaxes and match stored logits within |Δ| ≤ 1e-3.
- Commit the trained artifacts to the repo so the site builds without retraining.

## 10. Page chrome (global, always present)

- **Header (sticky, slim):** logotype `(lispllm)` with a blinking block cursor; a live status
  chip computed from the manifest, e.g. `(params 351k) (layers 3) (ctx 96)`; three buttons:
  REPL (toggles drawer, shortcut backtick or Cmd+K), References (toggles right panel), GitHub.
- **REPL drawer (bottom, docked, persistent):** collapsed = one input line; expanded = 40vh
  history + input (85vh full sheet on mobile). Multi-line via Shift+Enter, history via ↑/↓,
  live paren-balance indicator, `(help)` lists primitives, `(reset!)` restores the image.
  Everything is in scope: users can `(set! temperature 2.0)` or even redefine `gelu` — the
  whole page reacts (INV-1). All knob/toggle-initiated evaluations are echoed here with a
  `;; ui:` prefix (INV-2).
- **References panel (right slide-over, 380px desktop / full-width sheet mobile):** the ONLY
  home for external links and citations, so the main flow never context-switches. Opened by
  inline citation chips `[n]` in prose, by `#ref-n`, or the header button. Each entry: title,
  authors, year, one ≤ 25-word "why it matters here" blurb, link (target=_blank), and which
  sections cite it. Includes a per-section "go deeper" note (≤ 80 words). Esc closes; focus
  returns to the chip that opened it.
- **Hash handling:** `#s=` (base64url state, §12.4) takes precedence, then `#ref-n`, then `#sec-n`.

## 11. The narrative sections (in order; each = prose + live code panel + linked viz)

**§0 Hero — "A language model in one page of Lisp."** Subtitle: "It's running in your browser
right now. Every figure below is computed by the code beside it. Pause it. Poke it. Break it."
Weights load with a byte-count progress line ("loading 0.4 MB of weights — that's the whole
mind"). Then `(generate prompt 400)` streams character by character beside its own source.
Controls: play/pause/step and a speed slider (2–30 chars/s; cosmetic pacing only, so no code
echo needed). **Pause reveals the live top-10 next-char probability bars** with the caption
"It's picking the next character. That's all it ever does."

**§1 — "It only ever does one thing."** A text input; on each keystroke (debounced 50 ms) run
an untraced forward and render the top-10 ProbBars for the next character. Copy beat:
everything ChatGPT does is this, at scale, in a loop. Cites [12].

**§2 — "Letters become vectors."** The 96-char table; clicking a char highlights its row in the
`tok-emb` heatmap and shows its 5 nearest neighbors by cosine similarity (expect uppercase/
lowercase pairs to be neighbors — call this out). Code focus: `embed`. Lookup is just `rows`.

**§3 — "Attention is three questions."** The centerpiece. Layer/head picker grid; the traced
`weights` matrix for the selection rendered as a heatmap between two token strips.
Bidirectional linking: hover cell (i,j) → highlight query token i and key token j AND the
`(softmax (causal-mask scores))` node; hover the `causal-mask` node → overlay the masked
triangle; hover `weights` → outline the whole matrix. For a selected position, show a bar of
its top contributing source tokens (weights × v). Code focus: `head`. Cites [1], [7], [10].

**§4 — "The residual stream."** The traced ||attention(x)|| and ||mlp(x)|| contribution norms
per layer as small bars along a stream diagram. The ablation lab: an L×H toggle grid; each
toggle echoes `(set! ablated '(…))` to the REPL (INV-2), rebuilds, then shows before/after
continuations of the focus string plus its perplexity delta. Code focus: `block`, `attention`,
the `ablated` define. Cites [8], [9].

**§5 — "Temperature is one number in the code."** The temperature knob directly edits the
`0.8` literal in the canonical AST (the changed node flashes; printer re-renders). Bidirectional:
`(set! temperature …)` in the REPL moves the knob. A top-k toggle visibly wraps/unwraps
`(top-k 40 …)` around the logits expression. Show three short parallel samples at T = 0.2 /
0.8 / 1.5 and the live entropy of the current distribution. Cites [11].

**§6 — "The whole model, one page."** `model.lisp` in full, beautifully typeset, with a gutter
annotating each define's parameter share (computed from the manifest — never hardcoded), a
live line-count badge computed from the AST, copy-as-text, a print stylesheet, and a permalink.
This is the screenshot. Cites [2], [3], [5], [6].

**§7 — "The playground."** Full-height REPL alongside: an environment browser (every bound
symbol, kind, shape/value preview; click inserts into the REPL) and a trace inspector (AST tree
of `model.lisp`; select any node → TensorView of its traced value). A strip of example chips
that paste-and-run: redefine gelu as relu and regenerate; ablate all of layer 2; sample at T=3;
nearest neighbors of "e"; `(shape tok-emb)`. Cites [13].

**§8 — "What ChatGPT has that this doesn't."** Honest prose: BPE tokenization, KV caching
(admit §0 recomputes the full context every token, and why that's O(T²)), RLHF/instruction
tuning, mixture-of-experts, and above all scale — with a log-scale bar comparing this model's
param count (from the manifest) to GPT-2 and a frontier-model order of magnitude (labeled as
static constants). End with: the repo, `train.py` ("train your own tonight — it's included"),
and Karpathy's Zero to Hero. Cites [3], [4], [11].

**Footer:** `(made-with (lots-of '(parens)))` — and that is the last paren joke; budget is one
per section, maximum.

## 12. Shared components

1. **CodePanel** — renders top-level forms selected *by name* from the canonical AST via the
   printer (never flat text), with stable node→span mapping. Subtle 3-color paren-depth
   tinting; role-based token color (defined names / primitives / numbers / comments). Hover any
   node → highlight + a status line showing its traced shape/value preview; click → inspect
   (§7 echo). Knob-bound literals render with a drag affordance. Primitive names carry the
   "?" reference-kernel affordance (INV-3).
2. **TensorView** — canvas heatmap; diverging blue-white-amber colormap for signed data,
   sequential for [0,1] data (auto by range; colorblind-safe; min/max legend). Hover crosshair
   + tooltip (4 sig figs). Click selects a cell → detail chip with an "insert into REPL" button.
   Keyboard: roving tabindex + arrow keys.
3. **ProbBars** — top-10 next-char bars with glyph labels (visible ␣ and ⏎), percentages,
   150 ms animation, honors `prefers-reduced-motion`.
4. **Share codec** — `#s=` base64url JSON of app state (§5). Cap 2 KB; if exceeded, drop oldest
   history entries and toast a notice. On load: rebuild image per §5, restore scroll/panel.

## 13. Design system

Dark editor theme (near-black warm gray background, off-white text, ONE amber accent used for
cursor, links, active highlights). Prose in the monospace stack too — the page should feel like
"a REPL that learned typography," not a marketing site. Generous line-height, max readable
measure (~70ch), no decorative imagery of any kind: every figure is computed. Motion is subtle
(150–250 ms ease) and fully disabled under `prefers-reduced-motion`. Contrast AA everywhere.

## 14. Copy rules and references data

- Prose per section ≤ 120 words, precise and warm, second person sparingly. Banned words:
  magic(al), revolutionary, insane, unleash, superpower, delve. No exclamation points.
- Every quantitative claim about the running model must be computed live (param counts, line
  counts, vocab size — from manifest/AST, never hardcoded).
- Each section ends with a one-line REPL invitation, e.g. `try: (set! temperature 2.0)`.
- `src/content/references.ts` entries (verify links resolve; fix if moved):
  [1] Vaswani et al., "Attention Is All You Need," 2017 — arxiv.org/abs/1706.03762
  [2] McCarthy, "Recursive Functions of Symbolic Expressions…," 1960 — www-formal.stanford.edu/jmc/recursive.html
  [3] Karpathy, nanoGPT — github.com/karpathy/nanoGPT
  [4] Karpathy, "Let's build GPT: from scratch" — youtube.com/watch?v=kCc8FmEb1nY
  [5] Graham, "The Roots of Lisp," 2002 — paulgraham.com/rootsoflisp.html
  [6] Friedman & Mendhekar, *The Little Learner*, 2023 — MIT Press
  [7] Alammar, "The Illustrated Transformer" — jalammar.github.io/illustrated-transformer
  [8] Bycroft, "LLM Visualization" — bbycroft.net/llm
  [9] Elhage et al., "A Mathematical Framework for Transformer Circuits," 2021 — transformer-circuits.pub
  [10] Olsson et al., "In-context Learning and Induction Heads," 2022 — transformer-circuits.pub
  [11] Holtzman et al., "The Curious Case of Neural Text Degeneration," 2020 — arxiv.org/abs/1904.09751
  [12] Radford et al., "Language Models are Unsupervised Multitask Learners" (GPT-2), 2019
  [13] Tiny Shakespeare corpus, from karpathy/char-rnn
  [14] Hendrycks & Gimpel, "Gaussian Error Linear Units," 2016 — arxiv.org/abs/1606.08415

## 15. Quality gates

**Unit (Vitest):** reader (≥ 12 cases: nesting, quote, dotted pairs, strings, negatives,
comments); eval (closures, shadowing, let* ordering, cond, set!, recursion); tail-call depth
50k; print∘read idempotence on model.lisp; every kernel vs its Lisp reference; softmax
stability on large logits; causal-mask correctness; **golden parity per §9**; share-codec
round-trip; AST-edit → printer stability; live param count == manifest count.

**E2E (Playwright, chromium + iPhone SE):**
1. Load → weights fetched → hero generates ≥ 40 chars within 15 s; zero console errors;
   zero non-origin requests (INV-4).
2. Pause hero → ≥ 5 probability bars visible, probabilities sum ≈ 1 (±0.02).
3. Typing in §1 updates bars within 500 ms.
4. §3: pick layer/head, hover a cell → exactly two token chips highlight.
5. Drag temperature knob → the literal in the §5/§6 code text changes AND regenerated output
   differs from before (seeded).
6. Toggle an ablation → REPL shows the echoed `(set! ablated …)` → §4 diff updates.
7. REPL `(define temperature 2.0)` → the §5 knob visually moves to 2.0 (one-image proof).
8. Citation chip `[1]` opens the references panel scrolled to entry 1; Esc closes and returns focus.
9. Share link round-trip restores temperature edit + history length in a fresh context.
10. `(reset!)` restores defaults.
11. Mobile: no horizontal body scroll; REPL opens as a sheet; hero readable.

**Perf/a11y (record numbers in DECISIONS.md; CI asserts bundle size only):** untraced forward
≤ 60 ms median at full context; ≥ 10 chars/s sustained over 200 chars; traced forward ≤ 500 ms;
image rebuild ≤ 50 ms; bundle ≤ 350 KB gz; Lighthouse perf ≥ 90 and a11y ≥ 95 on a local
static serve; full keyboard path to REPL, panel, knobs, and TensorView cells.

## 16. Repository layout and deliverables

```
lispllm/
  README.md  LICENSE  DECISIONS.md
  package.json  vite.config.ts  tailwind.config.js  tsconfig.json
  public/
    model.lisp
    checkpoints/shakespeare-quick/{model.bin, manifest.json, golden.json}
  src/
    lisp/{types.ts, reader.ts, printer.ts, eval.ts, env.ts}
    tensor/{tensor.ts, kernels.ts, rng.ts}  + public/kernels-ref.lisp
    model/{load.ts, image.ts, trace.ts}
    store/{app-store.ts, share.ts}
    components/{CodePanel.tsx, TensorView.tsx, ProbBars.tsx, Repl.tsx, RefsPanel.tsx, Header.tsx}
    sections/{S0Hero.tsx … S8Scale.tsx}
    content/{copy.ts, references.ts}
    App.tsx  main.tsx  styles.css
  train/{get_data.py, train.py, export.py, verify.py, requirements.txt}
  tests/{unit/…, e2e/…}
  .github/workflows/ci.yml   (install, lint, unit, build, e2e, bundle-size gate)
```

README must include: what/why in three sentences, quickstart (`pnpm i && pnpm dev`),
train-your-own instructions, an architecture diagram (ASCII), a drafted Show HN first comment
(crediting McCarthy, Karpathy, Alammar, Bycroft, and Transformer Explainer), and credits.
Deploy: static output via `pnpm build`, plus a Netlify/Vercel config and correct
`<title>`/OG meta ("lispllm — a language model in one page of Lisp").

## 17. Milestones and exit gates

- **M0 Scaffold.** Vite+TS+Tailwind+CI green; deploy preview works. Exit: `pnpm lint && pnpm
  test && pnpm build` clean.
- **M1 Lisp core.** Reader/eval/printer, tail calls, REPL-in-terminal via `pnpm tsx`. Exit:
  all §15 interpreter tests pass.
- **M2 Tensors.** Kernels + Lisp references + equivalence tests. Exit: kernel suite green.
- **M3 The model talks.** Train quick checkpoint (val ≤ 1.95), export, verify, goldens; a Node
  CLI script generates 300 chars via the interpreter. Exit: golden parity green; sample
  committed to DECISIONS.md. ← Halt here per §1.5 if training is impossible.
- **M4 Living page core.** Image + rebuild pipeline + trace; CodePanel/TensorView/ProbBars;
  §0 and §1 live in the browser. Exit: e2e 1–3 green.
- **M5 Full narrative.** §2–§6, bidirectional linking, knob→AST, ablations, REPL drawer,
  references panel. Exit: e2e 4–8 green.
- **M6 Finish.** §7, §8, share links, copy pass, mobile, perf/a11y budgets, README, deploy.
  Exit: entire §15 green; Definition of Done below checked.

## 18. Non-goals (v2 parking lot — do not build)

In-browser training, BPE tokenizer demo, KV-cache toggle, Lisp-source-corpus checkpoint and
paren-depth-neuron probe, Web Worker/WebGPU offload, REPL autocomplete, multiple checkpoints
UI, i18n, analytics.

## 19. Definition of Done

All §15 gates green in CI (bundle gate) and locally (perf numbers logged) · all seven
invariants demonstrably hold (e2e evidence) · trained weights committed with training log ·
works offline after first load · one HTML document, no routes · references only ever open in
the side panel · README + DECISIONS.md complete · deployed static build ready to point
lispllm.com at.