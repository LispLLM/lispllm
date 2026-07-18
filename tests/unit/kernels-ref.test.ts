/**
 * INV-3: every native kernel has a pure-Lisp reference implementation
 * (public/kernels-ref.lisp) and passes equivalence on 3 random shapes per op.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Env, installCoreBuiltins } from '../../src/lisp/env';
import { applyValue, evaluate } from '../../src/lisp/eval';
import { readProgram } from '../../src/lisp/reader';
import { LispRecord, isTensor, list } from '../../src/lisp/types';
import type { Tensor, Value } from '../../src/lisp/types';
import { installTensorBuiltins } from '../../src/tensor/bindings';
import * as K from '../../src/tensor/kernels';
import { tensor, zeros } from '../../src/tensor/tensor';
import { Rng } from '../../src/tensor/rng';

const rng = new Rng(20260717);

function makeEnv(): Env {
  const env = new Env();
  installCoreBuiltins(env, { display: () => {}, seed: () => {} });
  installTensorBuiltins(env, new Rng(1));
  for (const f of readProgram(readFileSync('public/kernels-ref.lisp', 'utf8')).forms)
    evaluate(f, env);
  return env;
}

const env = makeEnv();

function call(name: string, ...args: Value[]): Value {
  const fn = env.lookup(name);
  return applyValue(fn, args);
}

function rand(r: number, c?: number): Tensor {
  const n = c === undefined ? r : r * c;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = (rng.next() - 0.5) * 4;
  return c === undefined ? tensor([r], data) : tensor([r, c], data);
}

function expectClose(a: Value, b: Value, tol = 1e-5): void {
  if (!isTensor(a) || !isTensor(b)) throw new Error('expected tensors');
  expect(a.shape).toEqual(b.shape);
  for (let i = 0; i < a.data.length; i++) {
    expect(Math.abs(a.data[i] - b.data[i])).toBeLessThan(tol);
  }
}

const SHAPES: Array<[number, number, number]> = [
  [2, 3, 4],
  [5, 5, 5],
  [1, 7, 2],
];

describe('kernel ↔ Lisp reference equivalence (INV-3)', () => {
  it('matmul', () => {
    for (const [m, k, n] of SHAPES) {
      const a = rand(m, k);
      const b = rand(k, n);
      expectClose(call('matmul-ref', a, b), K.matmul(a, b));
    }
  });

  it('transpose', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      expectClose(call('transpose-ref', a), K.transpose(a));
    }
  });

  it('add', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      const b = rand(m, n);
      expectClose(call('add-ref', a, b), K.add(a, b));
    }
    const va = rand(6);
    const vb = rand(6);
    expectClose(call('add-ref', va, vb), K.add(va, vb));
  });

  it('scale', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      expectClose(call('scale-ref', a, 1.7), K.scale(a, 1.7));
    }
    const va = rand(5);
    expectClose(call('scale-ref', va, -0.3), K.scale(va, -0.3));
  });

  it('softmax', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      expectClose(call('softmax-ref', a), K.softmax(a));
    }
    const va = rand(9);
    expectClose(call('softmax-ref', va), K.softmax(va));
  });

  it('layernorm', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      const g = rand(n);
      const bb = rand(n);
      const params = new LispRecord(
        'ln',
        new Map<string, Value>([
          ['g', g],
          ['b', bb],
        ]),
      );
      expectClose(call('layernorm-ref', a, params), K.layernorm(a, { g, b: bb }), 1e-4);
    }
  });

  it('gelu', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      expectClose(call('gelu-ref', a), K.gelu(a), 1e-4);
    }
  });

  it('causal-mask', () => {
    for (const s of [2, 4, 6]) {
      const a = rand(s, s);
      expectClose(call('causal-mask-ref', a), K.causalMask(a));
    }
  });

  it('concat', () => {
    for (const [m] of SHAPES) {
      const parts = [rand(m, 2), rand(m, 3), rand(m, 1)];
      expectClose(call('concat-ref', list(...parts)), K.concat(parts));
    }
  });

  it('rows', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(Math.max(m, 3), n);
      const idx = [0, 2, 1];
      expectClose(call('rows-ref', a, list(...idx)), K.rows(a, idx));
    }
  });

  it('last-row', () => {
    for (const [m, , n] of SHAPES) {
      const a = rand(m, n);
      expectClose(call('last-row-ref', a), K.lastRow(a));
    }
  });

  it('zeros', () => {
    for (const [m, , n] of SHAPES) {
      expectClose(call('zeros-ref', m, n), zeros(m, n));
    }
  });

  it('argmax', () => {
    for (const [, , n] of SHAPES) {
      const a = rand(n + 3);
      expect(call('argmax-ref', a)).toBe(K.argmax(a));
    }
  });

  it('top-k', () => {
    for (const k of [1, 3, 5]) {
      const a = rand(8);
      expectClose(call('top-k-ref', k, a), K.topK(k, a));
    }
  });

  it('sample (same uniform draw)', () => {
    for (const seed of [1, 1337, 999]) {
      const logits = rand(10);
      const u = new Rng(seed).next();
      const native = K.sample(logits, new Rng(seed));
      expect(call('sample-ref', logits, u)).toBe(native);
    }
  });
});
