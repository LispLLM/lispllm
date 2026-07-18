/**
 * Printer.
 *
 * Two modes:
 *  1. Source-splicing print of a Program: reproduces the canonical text exactly
 *     (comments, layout, everything), splicing in any edited node lexemes.
 *     read∘print is therefore a fixpoint on model.lisp by construction, and the
 *     node→span mapping stays stable under knob edits.
 *  2. Fresh printing of runtime values / synthetic ASTs (REPL output):
 *     floats at 4 significant figures, long lists elided with `…`.
 */
import type { Ast, Program, Value } from './types';
import { Closure, LispRecord, Pair, Sym, isBuiltin, isTensor } from './types';

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** Print a number: integers plainly, floats to 4 significant figures. */
export function printNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  if (!Number.isFinite(n)) return n > 0 ? '+inf' : n < 0 ? '-inf' : 'nan';
  return String(Number(n.toPrecision(4)));
}

// ---------------------------------------------------------------------------
// Source-splicing program printer
// ---------------------------------------------------------------------------

export type EditMap = ReadonlyMap<number, string>; // nodeId -> replacement lexeme

interface Splice {
  start: number;
  end: number;
  text: string;
}

function collectSplices(node: Ast, edits: EditMap, out: Splice[]): void {
  const rep = edits.get(node.id);
  if (rep !== undefined) {
    out.push({ start: node.span.start, end: node.span.end, text: rep });
    return; // an edited node replaces its whole subtree text
  }
  if (node.kind === 'list') {
    for (const c of node.items) collectSplices(c, edits, out);
    if (node.tail) collectSplices(node.tail, edits, out);
  }
}

/** Print the whole program with edits spliced in. With no edits, returns source verbatim. */
export function printProgram(program: Program, edits: EditMap = new Map()): string {
  const splices: Splice[] = [];
  for (const f of program.forms) collectSplices(f, edits, splices);
  if (splices.length === 0) return program.source;
  splices.sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const s of splices) {
    out += program.source.slice(pos, s.start) + s.text;
    pos = s.end;
  }
  out += program.source.slice(pos);
  return out;
}

/** Print one node's source text (with edits applied inside it). */
export function printNode(node: Ast, source: string, edits: EditMap = new Map()): string {
  const splices: Splice[] = [];
  collectSplices(node, edits, splices);
  if (splices.length === 0) return source.slice(node.span.start, node.span.end);
  splices.sort((a, b) => a.start - b.start);
  let out = '';
  let pos = node.span.start;
  for (const s of splices) {
    out += source.slice(pos, s.start) + s.text;
    pos = s.end;
  }
  out += source.slice(pos, node.span.end);
  return out;
}

// ---------------------------------------------------------------------------
// Fresh AST printer (synthetic forms, e.g. REPL echoes)
// ---------------------------------------------------------------------------

export function printAst(node: Ast): string {
  switch (node.kind) {
    case 'num':
      return node.text ?? printNumber(node.value);
    case 'str':
      return JSON.stringify(node.value);
    case 'sym':
      return node.name;
    case 'bool':
      return node.value ? '#t' : '#f';
    case 'list': {
      if (
        node.items.length === 2 &&
        node.items[0].kind === 'sym' &&
        node.items[0].name === 'quote' &&
        node.items[0].span.end - node.items[0].span.start === 1
      ) {
        return `'${printAst(node.items[1])}`;
      }
      const parts = node.items.map(printAst);
      if (node.tail) parts.push('.', printAst(node.tail));
      return `(${parts.join(' ')})`;
    }
  }
}

// ---------------------------------------------------------------------------
// Value printer (REPL results)
// ---------------------------------------------------------------------------

const ELIDE_AFTER = 12;

export function printValue(v: Value, depth = 0): string {
  if (v === undefined) return '';
  if (v === null) return '()';
  if (typeof v === 'number') return printNumber(v);
  if (typeof v === 'boolean') return v ? '#t' : '#f';
  if (typeof v === 'string') return JSON.stringify(v);
  if (v instanceof Sym) return v.name;
  if (v instanceof Pair) return printPair(v, depth);
  if (v instanceof Closure) return `#<procedure ${v.name}>`;
  if (isBuiltin(v)) return `#<builtin ${v.name}>`;
  if (isTensor(v)) return `#<tensor [${v.shape.join(' ')}]>`;
  if (v instanceof LispRecord) return `#<${v.tag}>`;
  return String(v);
}

function printPair(p: Pair, depth: number): string {
  if (depth > 8) return '(…)';
  const parts: string[] = [];
  let cur: Value = p;
  let n = 0;
  while (cur instanceof Pair) {
    if (n >= ELIDE_AFTER) {
      parts.push('…');
      return `(${parts.join(' ')})`;
    }
    parts.push(printValue(cur.car, depth + 1));
    cur = cur.cdr;
    n++;
  }
  if (cur !== null) {
    parts.push('.', printValue(cur, depth + 1));
  }
  return `(${parts.join(' ')})`;
}
