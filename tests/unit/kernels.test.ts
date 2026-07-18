import { describe, expect, it } from 'vitest';
import * as K from '../../src/tensor/kernels';
import { listsToTensor, tensor, tensorToLists, zeros } from '../../src/tensor/tensor';
import { Rng } from '../../src/tensor/rng';

const m = (rows: number[][]) => listsToTensor(rows);
const v = (xs: number[]) => listsToTensor(xs);

describe('kernels', () => {
  it('matmul', () => {
    const r = K.matmul(
      m([
        [1, 2],
        [3, 4],
      ]),
      m([
        [5, 6],
        [7, 8],
      ]),
    );
    expect(tensorToLists(r)).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('matmul dimension check', () => {
    expect(() => K.matmul(zeros(2, 3), zeros(2, 3))).toThrow(/inner dims/);
  });

  it('transpose', () => {
    expect(tensorToLists(K.transpose(m([[1, 2, 3]])))).toEqual([[1], [2], [3]]);
  });

  it('add / scale', () => {
    expect(tensorToLists(K.add(v([1, 2]), v([3, 4])))).toEqual([4, 6]);
    expect(tensorToLists(K.scale(v([1, -2]), 2)))!.toEqual([2, -4]);
  });

  it('softmax rows sum to 1 and is stable on large logits', () => {
    const r = K.softmax(m([[1000, 1000, 999]]));
    const row = (tensorToLists(r) as number[][])[0];
    expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(row.every((x) => Number.isFinite(x))).toBe(true);
    // extreme negatives from causal-mask must not produce NaN
    const r2 = K.softmax(m([[3, -1e9, -1e9]]));
    const row2 = (tensorToLists(r2) as number[][])[0];
    expect(row2[0]).toBeCloseTo(1, 6);
  });

  it('causal-mask sets strictly-upper triangle to -1e9', () => {
    const r = K.causalMask(
      m([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]),
    );
    expect(tensorToLists(r)).toEqual([
      [1, -1e9, -1e9],
      [4, 5, -1e9],
      [7, 8, 9],
    ]);
  });

  it('layernorm normalizes to zero mean / unit variance then affine', () => {
    const p = { g: v([1, 1, 1, 1]), b: v([0, 0, 0, 0]) };
    const r = tensorToLists(K.layernorm(m([[1, 2, 3, 4]]), p)) as number[][];
    const mean = r[0].reduce((a, b) => a + b, 0) / 4;
    expect(mean).toBeCloseTo(0, 5);
    const p2 = { g: v([2, 2, 2, 2]), b: v([1, 1, 1, 1]) };
    const r2 = tensorToLists(K.layernorm(m([[1, 2, 3, 4]]), p2)) as number[][];
    expect(r2[0][0]).toBeCloseTo(r[0][0] * 2 + 1, 5);
  });

  it('gelu matches known values', () => {
    const r = tensorToLists(K.gelu(v([0, 1, -1]))) as number[];
    expect(r[0]).toBeCloseTo(0, 6);
    expect(r[1]).toBeCloseTo(0.841192, 4);
    expect(r[2]).toBeCloseTo(-0.158808, 4);
  });

  it('concat, rows, last-row, zeros', () => {
    expect(
      tensorToLists(
        K.concat([
          m([[1], [2]]),
          m([
            [3, 4],
            [5, 6],
          ]),
        ]),
      ),
    ).toEqual([
      [1, 3, 4],
      [2, 5, 6],
    ]);
    expect(
      tensorToLists(
        K.rows(
          m([
            [1, 2],
            [3, 4],
            [5, 6],
          ]),
          [2, 0],
        ),
      ),
    ).toEqual([
      [5, 6],
      [1, 2],
    ]);
    expect(
      tensorToLists(
        K.lastRow(
          m([
            [1, 2],
            [3, 4],
          ]),
        ),
      ),
    ).toEqual([3, 4]);
    expect(tensorToLists(zeros(2, 2))).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('argmax and top-k', () => {
    expect(K.argmax(v([1, 9, 3]))).toBe(1);
    expect(tensorToLists(K.topK(2, v([1, 9, 3])))).toEqual([-1e9, 9, 3]);
  });

  it('sample is deterministic given the seeded PRNG', () => {
    const logits = v([0.1, 2.5, -1, 0.7]);
    const a = K.sample(logits, new Rng(1337));
    const b = K.sample(logits, new Rng(1337));
    expect(a).toBe(b);
    // heavily peaked logits always pick the peak
    expect(K.sample(v([100, 0, 0]), new Rng(42))).toBe(0);
  });

  it('kernels are pure (inputs untouched)', () => {
    const a = m([
      [1, 2],
      [3, 4],
    ]);
    const before = Array.from(a.data);
    K.causalMask(a);
    K.softmax(a);
    K.scale(a, 3);
    expect(Array.from(a.data)).toEqual(before);
  });

  it('tensor shape validation', () => {
    expect(() => tensor([2, 2], new Float32Array(3))).toThrow(/wants 4/);
  });
});
