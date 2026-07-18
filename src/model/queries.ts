/**
 * Read-only projections over the trace + current program: structural node
 * lookup and the derived figures for sections 2–5. No math is re-implemented
 * here beyond norms/entropy of already-traced tensors (INV-1: the tensors
 * themselves come from evaluating model.lisp).
 */
import type { Ast, Program, Tensor } from '../lisp/types';
import { isTensor } from '../lisp/types';
import type { Trace, TraceEntry } from './trace';
import { contextKey } from './trace';

export function walk(nodes: Ast[], fn: (n: Ast) => void): void {
  for (const n of nodes) {
    fn(n);
    if (n.kind === 'list') walk(n.tail ? [...n.items, n.tail] : n.items, fn);
  }
}

export function nodeSource(program: Program, node: Ast): string {
  return program.source.slice(node.span.start, node.span.end);
}

/** Find all nodes in the current program whose source starts with `prefix`. */
export function nodesByPrefix(program: Program, prefix: string): Ast[] {
  const out: Ast[] = [];
  walk(program.forms, (n) => {
    if (n.kind === 'list' && nodeSource(program, n).startsWith(prefix)) out.push(n);
  });
  return out;
}

function tracedTensor(
  trace: Trace,
  program: Program,
  prefix: string,
  layerId: number | undefined,
  headId: number | undefined,
  pred: (e: TraceEntry) => boolean = () => true,
): { node: Ast; tensor: Tensor } | null {
  for (const node of nodesByPrefix(program, prefix)) {
    const e = trace.byContext.get(contextKey(node.id, layerId, headId));
    if (e && isTensor(e.value) && pred(e)) return { node, tensor: e.value };
  }
  return null;
}

/** §3: the traced attention weights (T×T) for a given layer/head. */
export function attentionWeights(
  trace: Trace,
  program: Program,
  layer: number,
  head: number,
): { node: Ast; tensor: Tensor } | null {
  return tracedTensor(trace, program, '(softmax (causal-mask', layer, head);
}

/** §3: the traced value matrix v = (matmul x (wv h)) for a layer/head. */
export function attentionValues(
  trace: Trace,
  program: Program,
  layer: number,
  head: number,
): Tensor | null {
  const hit = tracedTensor(trace, program, '(matmul x (wv', layer, head);
  return hit?.tensor ?? null;
}

/** §3: the traced causal-mask node (for the masked-triangle overlay). */
export function causalMaskNode(program: Program): Ast | null {
  return nodesByPrefix(program, '(causal-mask')[0] ?? null;
}

/** L2 norm of the last row of a T×d tensor. */
function lastRowNorm(t: Tensor): number {
  const [rows, cols] = t.shape.length === 2 ? t.shape : [1, t.shape[0]];
  let s = 0;
  for (let j = 0; j < cols; j++) {
    const x = t.data[(rows - 1) * cols + j];
    s += x * x;
  }
  return Math.sqrt(s);
}

/** §4: per-layer ||attention(x)|| and ||mlp(x)|| at the last position. */
export function residualContributions(
  trace: Trace,
  program: Program,
  nLayers: number,
): Array<{ attn: number; mlp: number }> {
  const out: Array<{ attn: number; mlp: number }> = [];
  for (let l = 0; l < nLayers; l++) {
    const attn = tracedTensor(trace, program, '(attention x layer)', l, undefined);
    const mlp = tracedTensor(trace, program, '(mlp x layer)', l, undefined);
    out.push({
      attn: attn ? lastRowNorm(attn.tensor) : 0,
      mlp: mlp ? lastRowNorm(mlp.tensor) : 0,
    });
  }
  return out;
}

/** Shannon entropy (bits) of a probability vector. */
export function entropyBits(p: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    const x = p[i];
    if (x > 0) h -= x * Math.log2(x);
  }
  return h;
}

/** Cosine similarity of two rows of a [n×d] tensor. */
export function cosineRows(t: Tensor, a: number, b: number): number {
  const d = t.shape[1];
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let j = 0; j < d; j++) {
    const x = t.data[a * d + j];
    const y = t.data[b * d + j];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Top-k nearest rows to row `i` by cosine similarity (excluding itself). */
export function nearestRows(t: Tensor, i: number, k: number): Array<{ row: number; sim: number }> {
  const n = t.shape[0];
  const sims: Array<{ row: number; sim: number }> = [];
  for (let j = 0; j < n; j++) {
    if (j !== i) sims.push({ row: j, sim: cosineRows(t, i, j) });
  }
  sims.sort((a, b) => b.sim - a.sim);
  return sims.slice(0, k);
}
