/**
 * Lisp bindings for the native tensor kernels.
 * (Small addition to the §16 layout — logged in DECISIONS.md.)
 */
import type { Builtin, EnvLike, Value } from '../lisp/types';
import { LispError, LispRecord, Pair, isTensor, list, listToArray } from '../lisp/types';
import type { Tensor } from '../lisp/types';
import * as K from './kernels';
import { listsToTensor, tensorToLists, zeros } from './tensor';
import type { Rng } from './rng';

function t(v: Value, who: string): Tensor {
  if (!isTensor(v)) throw new LispError(`${who}: expected a tensor`);
  return v;
}

function n(v: Value, who: string): number {
  if (typeof v !== 'number') throw new LispError(`${who}: expected a number`);
  return v;
}

function lnParams(v: Value, who: string): K.LnParams {
  if (!(v instanceof LispRecord) || v.tag !== 'ln')
    throw new LispError(`${who}: expected layernorm params`);
  return { g: t(v.get('g'), who), b: t(v.get('b'), who) };
}

function intList(v: Value, who: string): number[] {
  return listToArray(v, who).map((x) => {
    if (typeof x !== 'number') throw new LispError(`${who}: expected a list of indices`);
    return x;
  });
}

function numsToList(xs: number[] | number[][]): Value {
  if (xs.length > 0 && Array.isArray(xs[0])) {
    return list(...(xs as number[][]).map((row) => list(...row)));
  }
  return list(...(xs as number[]));
}

function listToNums(v: Value, who: string): number[] | number[][] {
  const arr = listToArray(v, who);
  if (arr.length === 0) throw new LispError(`${who}: empty list`);
  if (arr[0] instanceof Pair) {
    return arr.map((row) => intListLoose(row, who));
  }
  return arr.map((x) => n(x, who));
}

function intListLoose(v: Value, who: string): number[] {
  return listToArray(v, who).map((x) => n(x, who));
}

function b(name: string, doc: string, fn: (args: Value[]) => Value): Builtin {
  return { kind: 'builtin', name, doc, fn };
}

export function installTensorBuiltins(env: EnvLike, rng: Rng): void {
  const defs: Builtin[] = [
    b('matmul', '(matmul a b) → matrix product', (a) =>
      K.matmul(t(a[0], 'matmul'), t(a[1], 'matmul')),
    ),
    b('transpose', '(transpose m)', (a) => K.transpose(t(a[0], 'transpose'))),
    b('add', '(add a b) → elementwise sum', (a) => K.add(t(a[0], 'add'), t(a[1], 'add'))),
    b('scale', '(scale m s) → m × scalar', (a) => K.scale(t(a[0], 'scale'), n(a[1], 'scale'))),
    b('softmax', '(softmax m) → row-wise softmax', (a) => K.softmax(t(a[0], 'softmax'))),
    b('layernorm', '(layernorm m params) → normalized over last dim', (a) =>
      K.layernorm(t(a[0], 'layernorm'), lnParams(a[1], 'layernorm')),
    ),
    b('gelu', '(gelu m) → tanh-approximation GELU', (a) => K.gelu(t(a[0], 'gelu'))),
    b('causal-mask', '(causal-mask scores) → future set to -1e9', (a) =>
      K.causalMask(t(a[0], 'causal-mask')),
    ),
    b('concat', '(concat (list …)) → column-wise concat', (a) =>
      K.concat(listToArray(a[0], 'concat').map((x) => t(x, 'concat'))),
    ),
    b('rows', '(rows m idxs) → gather rows', (a) => K.rows(t(a[0], 'rows'), intList(a[1], 'rows'))),
    b('last-row', '(last-row m) → final row as a vector', (a) => K.lastRow(t(a[0], 'last-row'))),
    b('zeros', '(zeros r c) → zero matrix', (a) => zeros(n(a[0], 'zeros'), n(a[1], 'zeros'))),
    b('n-rows', '(n-rows m)', (a) => K.nRowsOf(t(a[0], 'n-rows'))),
    b('n-cols', '(n-cols m)', (a) => K.nColsOf(t(a[0], 'n-cols'))),
    b('argmax', '(argmax v) → index of max', (a) => K.argmax(t(a[0], 'argmax'))),
    b('sample', '(sample logits) → token index drawn from softmax', (a) =>
      K.sample(t(a[0], 'sample'), rng),
    ),
    b('top-k', '(top-k k logits) → all but the k best set to -1e9', (a) =>
      K.topK(n(a[0], 'top-k'), t(a[1], 'top-k')),
    ),
    b('tensor->lists', '(tensor->lists t) → nested lists', (a) =>
      numsToList(tensorToLists(t(a[0], 'tensor->lists'))),
    ),
    b('lists->tensor', '(lists->tensor lst) → tensor', (a) =>
      listsToTensor(listToNums(a[0], 'lists->tensor')),
    ),
    b('ln-g', '(ln-g params) → layernorm gain vector', (a) => lnParams(a[0], 'ln-g').g),
    b('ln-b', '(ln-b params) → layernorm bias vector', (a) => lnParams(a[0], 'ln-b').b),
  ];
  for (const d of defs) env.define(d.name, d);
}
