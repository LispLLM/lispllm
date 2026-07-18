/**
 * Checkpoint loader: manifest.json + model.bin (int8) → dequantized Float32
 * tensors bound into a Lisp environment as records, before model.lisp is
 * evaluated. Weights are bound by reference — a rebuild never copies them.
 */
import type { Builtin, EnvLike, Value } from '../lisp/types';
import { LispError, LispRecord, Pair, isTensor, list } from '../lisp/types';
import type { Tensor } from '../lisp/types';
import { tensor } from '../tensor/tensor';

export interface ManifestTensor {
  name: string;
  shape: number[];
  offset: number;
  scale: number;
}

export interface Manifest {
  charset: string;
  ctx: number;
  dims: { n_layer: number; d_model: number; n_head: number; d_head: number };
  tensors: ManifestTensor[];
  params: number;
}

export interface Checkpoint {
  manifest: Manifest;
  /** dequantized tensors by manifest name */
  weights: Map<string, Tensor>;
}

export function dequantize(manifest: Manifest, bin: ArrayBuffer): Checkpoint {
  const bytes = new Int8Array(bin);
  const weights = new Map<string, Tensor>();
  for (const t of manifest.tensors) {
    const n = t.shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(n);
    const s = t.scale;
    for (let i = 0; i < n; i++) data[i] = bytes[t.offset + i] * s;
    weights.set(t.name, tensor(t.shape, data));
  }
  return { manifest, weights };
}

// ---------------------------------------------------------------------------
// Tokenizer (charset lives once, in the manifest)
// ---------------------------------------------------------------------------

export function makeTokenizer(charset: string): {
  encode: (s: string) => number[];
  decode: (ts: number[]) => string;
} {
  const stoi = new Map<string, number>();
  for (let i = 0; i < charset.length; i++) stoi.set(charset[i], i);
  const q = stoi.get('?')!;
  return {
    encode: (s) => Array.from(s, (ch) => stoi.get(ch) ?? q),
    decode: (ts) => ts.map((t) => charset[t] ?? '?').join(''),
  };
}

// ---------------------------------------------------------------------------
// Binding into the image
// ---------------------------------------------------------------------------

function rec(tag: string, fields: Record<string, Value>): LispRecord {
  return new LispRecord(tag, new Map(Object.entries(fields)));
}

function fieldGetter(name: string, field: string, expectTag?: string): Builtin {
  return {
    kind: 'builtin',
    name,
    doc: `(${name} r) → ${field} of the record`,
    fn: (args: Value[]) => {
      const r = args[0];
      if (!(r instanceof LispRecord) || (expectTag && r.tag !== expectTag))
        throw new LispError(`${name}: expected a ${expectTag ?? 'record'}`);
      return r.get(field);
    },
  };
}

/** Bind tok-emb, pos-emb, layers, ln-f, ctx + record accessors into env. */
export function bindCheckpoint(env: EnvLike, ckpt: Checkpoint): void {
  const { manifest, weights } = ckpt;
  const w = (name: string): Tensor => {
    const t = weights.get(name);
    if (!t) throw new LispError(`checkpoint missing tensor ${name}`);
    return t;
  };

  env.define('tok-emb', w('tok-emb'));
  env.define('pos-emb', w('pos-emb'));
  env.define('ctx', manifest.ctx);
  env.define('ln-f', rec('ln', { g: w('ln-f.g'), b: w('ln-f.b') }));

  const layers: Value[] = [];
  for (let i = 0; i < manifest.dims.n_layer; i++) {
    const heads: Value[] = [];
    for (let j = 0; j < manifest.dims.n_head; j++) {
      heads.push(
        rec('head', {
          id: new Pair(i, j), // (layer . head) — matches '((2 . 1)) ablation syntax
          wq: w(`layer${i}.head${j}.wq`),
          wk: w(`layer${i}.head${j}.wk`),
          wv: w(`layer${i}.head${j}.wv`),
        }),
      );
    }
    layers.push(
      rec('layer', {
        id: i,
        heads: list(...heads),
        wo: w(`layer${i}.wo`),
        'w-up': w(`layer${i}.w-up`),
        'w-down': w(`layer${i}.w-down`),
        ln1: rec('ln', { g: w(`layer${i}.ln1.g`), b: w(`layer${i}.ln1.b`) }),
        ln2: rec('ln', { g: w(`layer${i}.ln2.g`), b: w(`layer${i}.ln2.b`) }),
      }),
    );
  }
  env.define('layers', list(...layers));

  for (const g of [
    fieldGetter('heads', 'heads', 'layer'),
    fieldGetter('wo', 'wo', 'layer'),
    fieldGetter('w-up', 'w-up', 'layer'),
    fieldGetter('w-down', 'w-down', 'layer'),
    fieldGetter('ln1', 'ln1', 'layer'),
    fieldGetter('ln2', 'ln2', 'layer'),
    fieldGetter('wq', 'wq', 'head'),
    fieldGetter('wk', 'wk', 'head'),
    fieldGetter('wv', 'wv', 'head'),
    fieldGetter('id', 'id'),
  ])
    env.define(g.name, g);
}

/** Compute per-tensor param share for the §6 gutter (never hardcoded). */
export function paramCount(manifest: Manifest): number {
  return manifest.tensors.reduce((s, t) => s + t.shape.reduce((a, b) => a * b, 1), 0);
}

export function tensorByName(ckpt: Checkpoint, name: string): Tensor {
  const t = ckpt.weights.get(name);
  if (!t || !isTensor(t)) throw new LispError(`no tensor ${name}`);
  return t;
}
