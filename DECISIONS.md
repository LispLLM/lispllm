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

```
step     0 | train 4.5891 | val 4.5837 |      4s
step   250 | train 2.5660 | val 2.5619 |     15s
step   500 | train 2.3490 | val 2.3225 |     26s
step   750 | train 2.1262 | val 2.1675 |     37s
step  1000 | train 1.9978 | val 2.0576 |     47s
step  1250 | train 1.8720 | val 1.9683 |     58s
step  1500 | train 1.8111 | val 1.9133 |     69s
```

Target val ≤ 1.95 reached at step 1500 (69 s). 300-char sample at T=0.8 (PyTorch):

```
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

```
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
