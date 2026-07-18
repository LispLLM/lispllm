/**
 * Tensor type + constructors. Row-major Float32Array. Pure functions only.
 */
import type { Tensor } from '../lisp/types';
import { LispError } from '../lisp/types';

export function tensor(shape: readonly number[], data: Float32Array): Tensor {
  const n = shape.reduce((a, b) => a * b, 1);
  if (data.length !== n)
    throw new LispError(
      `tensor: shape [${shape.join(' ')}] wants ${n} elements, got ${data.length}`,
    );
  return { shape, data };
}

export function zeros(r: number, c?: number): Tensor {
  return c === undefined
    ? tensor([r], new Float32Array(r))
    : tensor([r, c], new Float32Array(r * c));
}

export function isMatrix(t: Tensor): boolean {
  return t.shape.length === 2;
}

export function nRows(t: Tensor): number {
  return t.shape.length === 2 ? t.shape[0] : 1;
}

export function nCols(t: Tensor): number {
  return t.shape.length === 2 ? t.shape[1] : t.shape[0];
}

/** tensor -> nested JS arrays (for the Lisp reference kernels + UI) */
export function tensorToLists(t: Tensor): number[] | number[][] {
  if (t.shape.length === 1) return Array.from(t.data);
  const [r, c] = t.shape;
  const out: number[][] = [];
  for (let i = 0; i < r; i++) out.push(Array.from(t.data.subarray(i * c, (i + 1) * c)));
  return out;
}

export function listsToTensor(rows: number[] | number[][]): Tensor {
  if (rows.length === 0) throw new LispError('lists->tensor: empty');
  if (typeof rows[0] === 'number') {
    return tensor([rows.length], Float32Array.from(rows as number[]));
  }
  const m = rows as number[][];
  const r = m.length;
  const c = m[0].length;
  const data = new Float32Array(r * c);
  for (let i = 0; i < r; i++) {
    if (m[i].length !== c) throw new LispError('lists->tensor: ragged rows');
    data.set(m[i], i * c);
  }
  return tensor([r, c], data);
}
