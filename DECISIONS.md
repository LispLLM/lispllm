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
