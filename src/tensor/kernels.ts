/**
 * Native tensor kernels (§8). Pure — every op allocates its output.
 * Formulas here are normative and must match train/verify.py exactly.
 */
import type { Tensor } from '../lisp/types';
import { LispError } from '../lisp/types';
import { tensor } from './tensor';
import type { Rng } from './rng';

function assert2d(t: Tensor, who: string): [number, number] {
  if (t.shape.length !== 2)
    throw new LispError(`${who}: expected a matrix, got [${t.shape.join(' ')}]`);
  return [t.shape[0], t.shape[1]];
}

/** [m,k] × [k,n] → [m,n]. k-innermost loops, local accumulators, preallocated output. */
export function matmul(a: Tensor, bt: Tensor): Tensor {
  const [m, k] = assert2d(a, 'matmul');
  const [k2, n] = assert2d(bt, 'matmul');
  if (k !== k2) throw new LispError(`matmul: inner dims differ (${k} vs ${k2})`);
  const out = new Float32Array(m * n);
  const A = a.data;
  const B = bt.data;
  for (let i = 0; i < m; i++) {
    const arow = i * k;
    const orow = i * n;
    for (let kk = 0; kk < k; kk++) {
      const av = A[arow + kk];
      if (av === 0) continue;
      const brow = kk * n;
      for (let j = 0; j < n; j++) {
        out[orow + j] += av * B[brow + j];
      }
    }
  }
  return tensor([m, n], out);
}

export function transpose(t: Tensor): Tensor {
  const [r, c] = assert2d(t, 'transpose');
  const out = new Float32Array(r * c);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j * r + i] = t.data[i * c + j];
  return tensor([c, r], out);
}

export function add(a: Tensor, b: Tensor): Tensor {
  if (a.shape.length !== b.shape.length || a.shape.some((d, i) => d !== b.shape[i]))
    throw new LispError(`add: shapes differ ([${a.shape.join(' ')}] vs [${b.shape.join(' ')}])`);
  const out = new Float32Array(a.data.length);
  for (let i = 0; i < out.length; i++) out[i] = a.data[i] + b.data[i];
  return tensor(a.shape, out);
}

export function scale(t: Tensor, s: number): Tensor {
  const out = new Float32Array(t.data.length);
  for (let i = 0; i < out.length; i++) out[i] = t.data[i] * s;
  return tensor(t.shape, out);
}

/** Row-wise, max-subtracted softmax. Works on [r,c] (per row) or [n] (whole vector). */
export function softmax(t: Tensor): Tensor {
  const rows = t.shape.length === 2 ? t.shape[0] : 1;
  const cols = t.shape.length === 2 ? t.shape[1] : t.shape[0];
  const out = new Float32Array(t.data.length);
  for (let i = 0; i < rows; i++) {
    const off = i * cols;
    let mx = -Infinity;
    for (let j = 0; j < cols; j++) if (t.data[off + j] > mx) mx = t.data[off + j];
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      const e = Math.exp(t.data[off + j] - mx);
      out[off + j] = e;
      sum += e;
    }
    for (let j = 0; j < cols; j++) out[off + j] /= sum;
  }
  return tensor(t.shape, out);
}

export interface LnParams {
  g: Tensor; // gain [d]
  b: Tensor; // bias [d]
}

/** LayerNorm over the last dim, eps 1e-5, gain+bias. */
export function layernorm(t: Tensor, p: LnParams): Tensor {
  const rows = t.shape.length === 2 ? t.shape[0] : 1;
  const d = t.shape.length === 2 ? t.shape[1] : t.shape[0];
  if (p.g.data.length !== d || p.b.data.length !== d)
    throw new LispError(`layernorm: params dim ${p.g.data.length} != ${d}`);
  const out = new Float32Array(t.data.length);
  const EPS = 1e-5;
  for (let i = 0; i < rows; i++) {
    const off = i * d;
    let mean = 0;
    for (let j = 0; j < d; j++) mean += t.data[off + j];
    mean /= d;
    let variance = 0;
    for (let j = 0; j < d; j++) {
      const dv = t.data[off + j] - mean;
      variance += dv * dv;
    }
    variance /= d;
    const inv = 1 / Math.sqrt(variance + EPS);
    for (let j = 0; j < d; j++) {
      out[off + j] = (t.data[off + j] - mean) * inv * p.g.data[j] + p.b.data[j];
    }
  }
  return tensor(t.shape, out);
}

/** GELU, tanh approximation: 0.5·x·(1+tanh(√(2/π)·(x+0.044715·x³))) */
export function gelu(t: Tensor): Tensor {
  const out = new Float32Array(t.data.length);
  const C = Math.sqrt(2 / Math.PI);
  for (let i = 0; i < out.length; i++) {
    const x = t.data[i];
    out[i] = 0.5 * x * (1 + Math.tanh(C * (x + 0.044715 * x * x * x)));
  }
  return tensor(t.shape, out);
}

/** Set entries j > i to −1e9 (square [T,T] scores). */
export function causalMask(t: Tensor): Tensor {
  const [r, c] = assert2d(t, 'causal-mask');
  const out = Float32Array.from(t.data);
  for (let i = 0; i < r; i++) for (let j = i + 1; j < c; j++) out[i * c + j] = -1e9;
  return tensor(t.shape, out);
}

/** Column-wise concat of matrices with equal row counts. */
export function concat(ts: Tensor[]): Tensor {
  if (ts.length === 0) throw new LispError('concat: empty');
  const r = ts[0].shape[0];
  let totalC = 0;
  for (const t of ts) {
    assert2d(t, 'concat');
    if (t.shape[0] !== r) throw new LispError('concat: row counts differ');
    totalC += t.shape[1];
  }
  const out = new Float32Array(r * totalC);
  let colOff = 0;
  for (const t of ts) {
    const c = t.shape[1];
    for (let i = 0; i < r; i++) {
      out.set(t.data.subarray(i * c, (i + 1) * c), i * totalC + colOff);
    }
    colOff += c;
  }
  return tensor([r, totalC], out);
}

/** Gather rows of [V,d] by index array → [n,d]. */
export function rows(t: Tensor, idx: number[]): Tensor {
  const [v, d] = assert2d(t, 'rows');
  const out = new Float32Array(idx.length * d);
  for (let i = 0; i < idx.length; i++) {
    const r = idx[i];
    if (r < 0 || r >= v) throw new LispError(`rows: index ${r} out of range [0, ${v})`);
    out.set(t.data.subarray(r * d, (r + 1) * d), i * d);
  }
  return tensor([idx.length, d], out);
}

/** Last row of a matrix as a vector [c]. */
export function lastRow(t: Tensor): Tensor {
  const [r, c] = assert2d(t, 'last-row');
  return tensor([c], Float32Array.from(t.data.subarray((r - 1) * c, r * c)));
}

export function argmax(t: Tensor): number {
  let best = 0;
  for (let i = 1; i < t.data.length; i++) if (t.data[i] > t.data[best]) best = i;
  return best;
}

export function nRowsOf(t: Tensor): number {
  return t.shape.length === 2 ? t.shape[0] : 1;
}

export function nColsOf(t: Tensor): number {
  return t.shape.length === 2 ? t.shape[1] : t.shape[0];
}

/** softmax + categorical draw from the image PRNG. Input: logits vector. */
export function sample(logits: Tensor, rng: Rng): number {
  if (logits.shape.length !== 1) throw new LispError('sample: expected a vector of logits');
  const p = softmax(logits);
  let u = rng.next();
  for (let i = 0; i < p.data.length; i++) {
    u -= p.data[i];
    if (u <= 0) return i;
  }
  return p.data.length - 1;
}

/** Keep the k largest logits, set the rest to −1e9. (Used by the §5 top-k toggle.) */
export function topK(k: number, logits: Tensor): Tensor {
  if (logits.shape.length !== 1) throw new LispError('top-k: expected a vector of logits');
  const idx = Array.from(logits.data.keys()).sort((a, b) => logits.data[b] - logits.data[a]);
  const out = new Float32Array(logits.data.length).fill(-1e9);
  for (let i = 0; i < Math.min(k, idx.length); i++) out[idx[i]] = logits.data[idx[i]];
  return tensor(logits.shape, out);
}
