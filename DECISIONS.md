# DECISIONS.md

Build log for lispllm.com, per starter.md §1.2. One entry per milestone: what was built,
deviations (with rationale), measured numbers.

## Pre-M0 decisions

- **Node 22.22.2 / pnpm 11.4.0** in place of spec's "Node 20, pnpm" — Node 22 is current LTS
  in this environment; no API differences affect the build. Logged per §1.3.
- **Python 3.14.3** available (no 3.11). Will attempt PyTorch on 3.14 at M3; fall back to a
  brew-installed 3.11 if wheels are unavailable.
- **Logo usage:** user requested lispllm.png as favicon, OG image, and a small header logo
  mark. §13 bans decorative imagery in the narrative; the header mark is page chrome, not a
  figure, so it is permitted and kept small.

## M0 — Scaffold

Built: Vite 6 + React 18 + TS strict + Tailwind; ESLint 9 (flat config, `no-explicit-any`
enforced in src/lisp + src/tensor) + Prettier; Vitest; Playwright (chromium + iPhone SE);
CI workflow with bundle-size gate script; favicon/OG/logo assets generated from lispllm.png
via sips (32/180/512/48 px); MIT LICENSE; index.html with OG meta.

Exit gate output:

- `pnpm lint` — clean.
- `pnpm test` — 1 passed (smoke).
- `pnpm build` — dist/assets/index.js 144.05 kB │ gzip: 46.32 kB.
- `pnpm bundle-size` — total JS 45.2 KB gz — PASS (limit 350 KB).

Deviations: none beyond pre-M0 notes.

## M1 — Lisp core

Built: `src/lisp/{types,reader,printer,eval,env}.ts`. Reader with stable node ids + spans,
quote sugar, dotted pairs, strings, comments, #t/#f. Evaluator: all §7 special forms with
proper tail calls via a trampolined loop (if/begin/let*/cond tails and closure bodies).
All §7 core builtins live in env.ts (`installCoreBuiltins`). Terminal REPL: `pnpm repl`
(multi-line via paren balance). `public/model.lisp` committed verbatim from spec §6.

Key design decision: **the printer is source-splicing.** A parsed Program keeps its exact
source text; printing splices edited node lexemes into it by span. This makes read∘print a
fixpoint on model.lisp _by construction_, keeps comments/layout intact, and gives stable
node→span mapping under knob edits (INV-2). Synthetic ASTs and REPL values use a fresh
printer (4-sig-fig floats, `…` elision after 12 elements).

Choices logged per §1.6: `nth` is `(nth i lst)`; `eq?` is structural (needed for
`(member (id h) ablated)` over dotted pairs); truthiness is Scheme-style (only `#f` false);
`member` returns the sublist or `#f`.

Exit gate: 36 unit tests green (15 reader, 15 eval incl. 50k tail-call loop, 5 printer incl.
model.lisp fixpoint + AST-edit splice stability). Lint clean. REPL smoke test:
`(display "hello from lisp") (+ 1 2)` → `hello from lisp` / `3`.

## M2 — Tensors

Built: `src/tensor/{tensor,kernels,rng,bindings}.ts` + `public/kernels-ref.lisp`.
All §8 kernels with normative formulas (softmax max-subtracted row-wise; layernorm eps 1e-5;
gelu tanh approximation; causal-mask −1e9; matmul k-innermost with preallocated output).
mulberry32 PRNG (`Rng`) lives in the image; `sample` = softmax + categorical draw from it.

Deviations (logged per §1.3/§1.6):

- Added `src/tensor/bindings.ts` (Lisp bindings for kernels) beyond the three-file §16
  layout — keeps kernels pure-TS and testable in isolation.
- `sample-ref` takes the uniform draw `u` explicitly (pure function); equivalence test feeds
  the same `u` the native kernel draws from the seeded PRNG.
- Added `ln-g`/`ln-b` accessor builtins so the Lisp layernorm reference can reach the params.
- `top-k` kernel included now (needed by §5's toggle) with a Lisp reference.

Exit gate: 64 unit tests green — 13 native kernel tests + 15 equivalence tests (3 random
shapes per op, |Δ| < 1e-5; layernorm/gelu at 1e-4 for float32 vs Lisp double-precision math).

## M3 — The model talks

Built: `train/{get_data,train,export,verify}.py` + `src/model/load.ts` +
`scripts/generate.ts` + golden parity test. Trained on Apple MPS (Python 3.14 /
torch 2.13 — deviation from spec's "Python 3.11", wheels exist and all numerics match).

Training (quick config, 351,552 params, seed 1337):

```text
step     0 | train 4.5891 | val 4.5837 |      4s
step   250 | train 2.5660 | val 2.5619 |     15s
step   500 | train 2.3490 | val 2.3225 |     26s
step   750 | train 2.1262 | val 2.1675 |     37s
step  1000 | train 1.9978 | val 2.0576 |     47s
step  1250 | train 1.8720 | val 1.9683 |     58s
step  1500 | train 1.8111 | val 1.9133 |     69s
```

Target val ≤ 1.95 reached at step 1500 (69 s). 300-char sample at T=0.8 (PyTorch):

```text
ROMEO: were's is discelitime and but cus thurkes
Thou distings to chalting liken lies Sir,
Is for is not fir them the good mamean's the seend,
To flad Gap me murrne, far I wham throught is thou
Turse hand lies but good I guls
Thround hat they but reest shore thanch to pearton,
Enether nament broth me slent
```

Export: 61 tensors, 351,552 int8 bytes (0.34 MB ≤ 1.5 MB budget). Per-head QKV slicing and
[out,in]→[in,out] transpose done in export.py. verify.py greedy continuation of "ROMEO: ":
`"ROMEO: I will the stall"`.

**Golden parity: PASS** — the Lisp `gpt` on the shipped checkpoint reproduces all 16 argmaxes
and top-5 logits within |Δ| ≤ 1e-3. Live param count == manifest count.

Interpreter generation (`pnpm cli:generate "ROMEO: " 300`, seed 1337): 300 chars in 12.2 s =
**24.7 chars/s** in Node (target ≥ 10, stretch 20). Sample (mostly-formed words, play format):

```text
To band this sen bing brird.
I dist there and the of think earfuly.

PRIOLIETH:

Nir, lo the same to fir the good his to his witen.

For Ment, trowmran rigness han son givenin moset mange.
```

Artifacts committed: `public/checkpoints/shakespeare-quick/{model.bin, manifest.json,
golden.json}`, `train/train.log`. (`ckpt.pt` is gitignored; the site builds without retraining.)

## M4 — Living page core

Built: `src/model/{image,trace}.ts`, `src/store/app-store.ts`,
`src/components/{CodePanel,TensorView,ProbBars,Repl,Header,Cite}.tsx`,
`src/sections/{S0Hero,S1NextChar}.tsx`, boot pipeline in App.tsx, e2e tests 1–3.

Architecture decisions (logged per §1.2/1.6):

- **Knob edits are span-addressed against the canonical source** (`{at, text}`), resolved to
  node ids at rebuild. Rebuild = print canonical+edits → re-read → fresh env → bind weights
  (by reference) → evaluate → replay history. The re-read program is the single truth for
  display, evaluation, AND trace keys — the rendered code is literally what runs (INV-2).
- **Separate UI PRNG stream** (`uiRng`, seed ⊕ golden-ratio constant) for hero/paced
  generation, so UI streams never perturb the image PRNG: REPL outputs stay a pure function
  of (checkpoint, seed, knobEdits, replHistory) per INV-6. The sampling itself uses the
  native `sample` kernel and the image's `gpt`/`temperature` — no re-implemented math (INV-1).
- REPL submissions evaluate incrementally (deterministically identical to replay); knob edits
  trigger a full rebuild with history replay.
- iPhone SE project emulates the _viewport_ on chromium (spec §4 says "iPhone SE viewport";
  webkit binary not required).

Measured (Node, Apple Silicon; spec budgets in parens):

- untraced forward at full ctx 96: **49.8 ms median** (≤ 60 ms)
- traced forward, 64-char focus: **31.6 ms median** (≤ 500 ms)
- image rebuild with 2 history entries: **0.2 ms median** (≤ 50 ms)
- sustained generation: **26.5 chars/s** over 200 chars (≥ 10)
- bundle: 61.1 KB gz (≤ 350 KB)

Exit gate: e2e 1–3 green on chromium + iphone-se (6/6); all 67 unit tests green.

## M5 — Full narrative (§2–§6, references, hash routing)

Built: `src/model/queries.ts`, `src/content/references.ts`,
`src/components/{RefsPanel,KernelRef}.tsx`, `src/sections/{S2Embeddings,S3Attention,
S4Residual,S5Temperature,S6WholeModel}.tsx`, hash handling (`#ref-n` > `#sec-n`),
e2e tests 4–8.

Decisions:

- **Trace entries are context-keyed.** One AST node (e.g. the `(softmax (causal-mask
scores))` in `head`) evaluates 12 times per forward pass — once per layer×head — so a
  node-id map only kept the last. `Trace.byContext` keys entries by `nodeId:layerId:headId`;
  §3/§4 queries read through it. Structural queries find nodes by source prefix in the
  _current_ program, so they survive knob edits.
- §3 bidirectional linking: heatmap hover sets exactly two `data-hl` token chips (query +
  key) and highlights the softmax node; hovering `causal-mask` in the code overlays the
  masked triangle; per-position source-contribution bars use traced weights × ‖v‖ (both
  tensors read from the trace, no re-computation).
- §4 ablation echoes `(set! ablated '(…))` through the normal REPL path (INV-2); before/after
  continuations are greedy (deterministic); perplexity delta from a single `gpt` forward.
- §5 knob and the draggable `0.8` literal both route through the same span-addressed KnobEdit;
  `(set! temperature …)` in the REPL moves the knob because the knob renders `(lookup
'temperature)`. Top-k toggle wraps/unwraps `(top-k 40 …)` around the sample argument as a
  KnobEdit — visible in §5 and §6 (one image). The three fixed-T comparison samples use a
  local fixed-seed PRNG with the native kernels (projection; image PRNG untouched, INV-6).
- §6 param shares are computed from the manifest tensor table by name pattern; line/define
  counts from the current program AST — nothing hardcoded.
- e2e 6 clicks the ablation toggle before opening the REPL: on the iPhone SE viewport the
  REPL sheet covers the grid.

Exit gate: e2e 1–8 green on chromium + iphone-se; bundle 71 KB gz.

## M6 — Playground, scale, share codec, polish

Built: §7 playground (example chips, environment browser over the live image env, trace
inspector rendering model.lisp as a tree with per-node traced tensors); §8 honest scale
section (BPE / KV cache / RLHF / MoE prose, log-scale parameter bar computed from the
manifest); share codec (`src/store/share.ts`, base64url JSON `#s=` fragment carrying seed,
knob edits, REPL history — oldest history entries dropped until the hash fits 2048 chars);
header share button (clipboard + toast); `#s=` restore on boot; print stylesheet for §6;
vercel.json with immutable cache headers; README with train-your-own instructions and a
Show HN draft; e2e 9–11.

Decisions / fixes:

- **Mobile overflow**: grid/flex items needed `min-w-0` (CodePanel wrapper, REPL textarea,
  §7 panels) and control rows needed `flex-wrap` (§0 controls, §5 knob row). Root cause:
  CSS grid/flex `min-width: auto` lets pre/textarea intrinsic width propagate past the
  viewport even under `overflow-x-auto`.
- **Header** raised to `z-[60]` so the mobile REPL sheet (z-50) cannot intercept header
  clicks; header row wraps on narrow screens.
- **Perf**: boot originally ran ~200 forward passes eagerly (§4 greedy continuation, §5
  three temperature samples) → Lighthouse desktop perf 51–62, TBT ~10 s. Added
  `useNearViewport` (IntersectionObserver, 400px margin) to defer §4/§5 generation until
  scrolled near. §4 keeps a synchronous baseline capture in `toggle` so ablating before
  the deferred compute has run still records the un-ablated baseline.
- **A11y**: added `<main>` landmark, aria-label on §1 textarea, replaced low-contrast
  comment/note colors with text-dim, min-h-6 tap targets in the env browser.

Measured (local static build, Lighthouse 13, headless Chrome, desktop preset):
performance 100, accessibility 100, TBT 20 ms, TTI 0.8 s. Bundle 72.1 KB gz (limit 350).
Unit tests 71 passed; e2e 21 passed + 1 skipped (test 11 is mobile-only) on chromium +
iphone-se. Copy audit: no banned words, no exclamation points.

Exit gate (§19 Definition of Done): all budgets PASS; one image; code-is-truth echoes;
kernel refs honest; offline after load; deterministic under seed 1337.

## M7 — Single-page IDE workbench redesign

User-directed redesign: replaced the long scrolling narrative with a fixed-height teaching
IDE. The activity rail switches Learn, Files, Lesson output, Trace, Environment, References,
and Editor views. Desktop keeps the lesson navigator, editable source, contextual output,
and REPL/problems panel visible together; iPhone SE uses the same destinations as exclusive
panes with a fixed bottom activity rail. Every pane owns its scroll container.

Built:

- `Workbench`, `ActivityRail`, `LearnSidebar`, `SourceEditor`, `RightPanel`, `BottomPanel`,
  `StatusBar`, keyboard/pointer `ResizableHandle`, persistent environment/trace/reference/model
  inspectors, source problems, and a read-only pure-Lisp kernel source view.
- A §0–§8 lesson registry that presents one guided document and one contextual live lab at a
  time. The original section controls and their one-image behavior remain intact.
- A CodeMirror 6 Lisp editor with line numbers, accessible high-contrast highlighting,
  history/search, bracket matching, diagnostics, lesson-span decoration, AST/trace linking,
  and explicit Run via button or Cmd/Ctrl+Enter.

State and correctness decisions:

- **Model and workspace state are separate.** `app-store` owns the image/source lifecycle;
  `workspace-store` owns active lesson, tabs, pane visibility/sizes, editor file, and selected
  AST node. Workspace layout persists independently in localStorage.
- **Source application is atomic.** Typing updates only `sourceText`. Run parses and evaluates
  a candidate Image, replays REPL history, and checks the UI model contract before swapping the
  global live Image. Syntax, runtime, or contract failure reports a source-span diagnostic and
  leaves the last good model active. Source-derived controls are disabled while a draft differs.
- **Local source recovery** stores the exact applied source plus latest draft, seed, knob edits,
  and REPL history against a fingerprint of the bundled model. A model update invalidates stale
  local source safely.
- **Share codec v2** remains backward-compatible with v1 and uses a prefix/suffix custom-source
  patch plus bundled-source fingerprint. Oldest REPL entries may be dropped to meet the 2 KB URL
  cap, but custom source is never dropped. If exact source alone cannot fit, Share explicitly
  copies full exact-state JSON (including the original undropped history) instead.
- Mobile defers first initialization of never-opened editor/output panes, then keeps each mounted
  after first use so local interaction state survives navigation. Manifest, weights, and source
  are preloaded and consumed concurrently. This removed mobile startup blocking time without a
  worker, route, backend, or external request.

Validation added: e2e 12–17 cover button and keyboard Run, syntax/contract diagnostics,
last-good recovery, applied-source plus dirty-draft reload, compact custom-source sharing,
trace-to-editor spans, keyboard resizing, mobile pane navigation, toolbar visibility, and
horizontal overflow. Existing e2e 1–11 were migrated to explicit Learn → lesson → Output
navigation rather than weakened.

Final measured gates (local production build, Apple Silicon):

- unit: **74 passed**; e2e: **27 passed, 7 intentional project skips** across desktop Chromium
  and iPhone SE Chromium viewport.
- JS bundle: **~195 KB gz** excluding weights (≤ 350 KB).
- untraced forward at ctx 96: **47.7 ms**; traced forward: **32.4 ms**; rebuild with two history
  entries: **0.2 ms**; sustained generation: **26.6 chars/s**.
- Lighthouse 13 desktop static preset: **performance 100, accessibility 100**, TBT 0 ms,
  LCP 0.8 s. Mobile accessibility: **100**; mobile functional/overflow behavior is asserted in
  Playwright.

Exit gate: fixed workbench is responsive and keyboard-operable; source edits remain code-is-truth
and last-good safe; exact local/share restoration is fingerprinted; original model invariants and
all budgets remain green.

## M8 — Interaction performance and transient confirmations

A production Playwright profile reproduced the reported editor lag: inserting 20 characters while
the §0 generator was active took **193.3 ms** and overlapped a **124 ms** main-thread long task. The
dominant cause was background model inference, compounded by broad external-store subscriptions,
eager lesson mounting, controlled CodeMirror synchronization, and repeated recursive view renders.

Changes:

- Added selector-aware app/workspace subscriptions with stable selected snapshots and shallow
  equality. Store emissions now skip no-op updates; workspace persistence is debounced and AST
  selection no longer writes layout state to localStorage.
- CodeMirror owns its document while typing. React synchronizes only external replacements (Run,
  Revert, bundled source, local/share restore), source parsing waits for 180 ms of inactivity, and
  cursor-to-AST lookup is coalesced with `requestAnimationFrame`.
- Lesson labs mount on first visit and retain local interaction state afterward. Stable workbench
  panes, recursive code panels, the REPL transcript, and trace-tree rows are memoized. Inactive code
  panels stop observing image/trace changes.
- Prompt, attention-focus, and environment-filter fields keep immediate local drafts and commit
  expensive parent updates after a short quiet period.
- §0 generation runs at 8 chars/s by default, stops when its lesson is inactive, and yields for
  400 ms after keyboard, pointer, or input activity. Opening Trace requests an on-demand trace even
  if generation has not yet produced one.
- Successful Share and exact-state JSON copy confirmations dismiss automatically after 3.5 seconds;
  error/action toasts remain manually dismissible.

Regression coverage now asserts that editor typing produces no browser long task while generation
is active and that the Share confirmation dismisses itself. The cross-lesson synchronization test
navigates to the lazily mounted §6 lab before asserting its live temperature literal.

Final measured gates (local production build, Apple Silicon):

- identical 20-character editor benchmark: **43.0 ms** (**77.8% faster**) with **zero long tasks**
  during the 400 ms interaction window.
- unit: **74 passed**; e2e: **28 passed, 8 intentional device-specific skips** across desktop
  Chromium and iPhone SE Chromium viewport.
- JS bundle: **196.7 KB gz** excluding weights (≤ 350 KB).
- untraced forward at ctx 96: **47.8 ms**; traced forward: **31.7 ms**; rebuild with two history
  entries: **0.2 ms**; sustained generation: **26.7 chars/s**.
- Lighthouse 13 desktop static preset: **performance 100, accessibility 100**, TBT 0 ms,
  LCP 0.77 s.

## M9 — Guided learning, panel help, resizing, and accent personalization

User-directed onboarding and workspace pass: make the next useful action obvious without a modal
tour; explain every content panel; teach enough Lisp to make examples approachable; expose the
existing resize behavior; and let the user choose a persistent feature color.

Built:

- An always-visible **Next** bar and a §0–§8 checklist with 28 observable tasks. Completion comes
  from generation, controls, successful source application/copy, submitted REPL commands, and
  inspector selections—not from time, scrolling, or merely opening a lesson. `learning-store`
  persists stable task IDs in `lispllm.learning.v1`; model `(reset!)`, source restore, and shares do
  not alter it. Diagnostics and dirty source deterministically override lesson guidance.
- Explained **Try this** cards and §7 examples that stage text, open/focus the desktop or mobile
  REPL, and wait for Enter. Model-mutating examples no longer execute from a single lesson click.
  Every lesson also exposes the same compact calls/`define`/quoted-data/`let*`/comments primer.
- A dependency-free `PanelInfoButton` for Learn/Files, both editor files, all five output tabs,
  REPL/Problems, and the standalone mobile REPL. Hover/focus opens, click pins, pointer exit closes
  an unpinned tip, and Escape restores trigger focus; portal positioning clamps to the viewport.
- Visible 8 px desktop resize grips with pointer and keyboard input, drag cleanup, selection
  suppression, pixel-valued ARIA, and double-click reset. Widths still persist, flush on page hide,
  and are fitted against the current viewport while preserving a usable editor and absolute safety
  bounds. Mobile remains an exclusive-pane layout with no meaningless separators.
- A header accent picker with Amber, Cyan, Mint, Violet, Rose, and Lime presets plus a native custom
  picker and Reset. `theme-store` persists only the raw value in `lispllm.theme.v1`, derives a
  contrast-safe displayed accent and solid-fill foreground, and applies CSS variables before React
  renders. Tailwind's existing `amber` token now aliases those variables, so navigation, controls,
  CodeMirror, canvas selections, and the attention mask update without broad subscriptions. Error
  red, inspect blue, semantic heatmaps, print, model state, and share state remain fixed.
- `model.lisp` now has a beginner reading map and concise explanations of q/k/v, causal masking,
  the residual stream, tied embeddings, temperature, and recursive generation. All executable text
  remains the exact first 1,979 characters, so canonical spans and old knob offsets did not move;
  the source grew from 55 executable lines to 102 total commented lines.

Compatibility decisions:

- The known pre-comment bundle fingerprint is `12ph0ts`; the commented bundle is `zx9kim`. Local
  persistence restores only seed/history/knob state across that exact non-custom upgrade. It never
  reapplies an old dirty or custom source, and the guard names both old and new fingerprints so a
  future unrelated model cannot accidentally use this exception.
- Compact shares now emit v3 and include the bundled fingerprint even without a custom-source patch.
  v1/v2 decoding remains available; incompatible old custom patches are rejected. Exact-state JSON
  also records v3. Learning and accent preferences are intentionally device-local and absent from
  every share payload.

Regression coverage added for learning metadata/idempotence/priority, contrast and malformed theme
inputs, exact source migration, share v2/v3 behavior, panel fitting, staged desktop/mobile commands,
§7 mutation staging, checklist persistence/completion, every panel-help context, preset/custom
accent persistence/reset/share exclusion, pointer/keyboard resize persistence/clamping/reset, and
the final §8 → Playground action.

Final measured gates (local production build, Apple Silicon):

- unit: **89 passed**; e2e: **40 passed, 10 intentional device-specific skips** across desktop
  Chromium and the iPhone SE Chromium viewport.
- JS bundle: **206.0 KB gz** excluding weights (≤ 350 KB).
- untraced forward at ctx 96: **52.2 ms**; traced forward: **33.2 ms**; rebuild with two history
  entries: **0.2 ms**; sustained generation: **24.4 chars/s**. All original model budgets pass.
- identical 20-character editor benchmark: **46.2 ms**, with **zero long tasks** while §0 generation
  remained active.
- Lighthouse 13 desktop static preset: **performance 100, accessibility 100**, TBT 0 ms, LCP 0.8 s.
  The additional simulated-mobile audit measured performance 84/accessibility 100; iPhone SE
  functional, focus, viewport-overflow, and offline-after-load behavior are asserted separately.
- Loaded-app offline navigation/editor check passed with zero non-origin requests.

Scope remained local and dependency-free: no router, backend, account/progress sync, layout/color
library, model weights change, or executable Lisp semantics change.

## M10 — Persistent light appearance

User-directed appearance follow-up: add an explicit light mode without reducing the feature-color
picker to code-editor decoration or weakening the dark workbench.

Built:

- **Appearance** now offers explicit Dark and Light radio options above the six feature-color
  presets. Dark remains the default. The same `lispllm.theme.v1` record now writes schema v2 with
  `{ mode, accent }`; schema-v1 accent records migrate to Dark, and malformed modes fail closed to
  Dark. Appearance remains device-local and absent from share/model state.
- The fixed workbench palette moved behind semantic CSS variables for canvas, content, muted text,
  panel, divider, chrome, trace, error, and syntax roles. Light mode uses warm off-white surfaces,
  dark readable type, 3:1 dividers, and mode-specific code colors; the browser `color-scheme` and
  theme-color metadata update with the selection. Print remains intentionally black on white.
- Feature colors are re-derived per mode against canvas, panel, and header chrome. Preset swatches
  preview the applied color, custom input preserves the raw choice, and solid feature fills receive
  a guaranteed contrasting mode surface. Accent-tinted text states use contrast-safe foregrounds
  or sufficiently light tints.
- CodeMirror reconfigures its light/dark base theme through a compartment while syntax, selection,
  trace, diagnostics, gutters, tooltips, and search controls consume semantic variables. Canvas
  tensor heatmaps redraw with light-specific neutral, negative, and positive ramps; selected cells
  still use the persisted feature color.

Regression coverage now checks both-mode accent derivation for every preset and black/white custom
extremes, local mode persistence and v1 fallback, semantic workbench/chrome colors, browser metadata,
feature-color propagation, CodeMirror surfaces, and live switching back to Dark on desktop and the
iPhone SE viewport.

Final measured gates (local production build, Apple Silicon):

- lint, formatting, strict TypeScript, and production build passed; unit: **89 passed**; e2e:
  **42 passed, 10 intentional device-specific skips** across desktop Chromium and the iPhone SE
  Chromium viewport.
- JS bundle: **206.5 KB gz** excluding weights (≤ 350 KB).
- untraced forward at ctx 96: **49.9 ms**; traced forward: **32.0 ms**; rebuild with two history
  entries: **0.2 ms**; sustained generation: **25.2 chars/s**. Theme work remains outside model
  execution, and every original performance budget passes.
