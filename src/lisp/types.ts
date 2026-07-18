/**
 * Core types for the Lisp interpreter.
 * AST nodes carry stable ids and source spans (INV-2 depends on this:
 * knob edits are AST edits addressed by node id / path).
 */

export type NodeId = number;

export interface Span {
  /** absolute char offset, inclusive */
  start: number;
  /** absolute char offset, exclusive */
  end: number;
  line: number; // 1-based
  col: number; // 1-based
}

/** A comment attached ahead of a node (own line) — preserved by the printer. */
export interface AstBase {
  id: NodeId;
  span: Span;
}

export interface NumNode extends AstBase {
  kind: 'num';
  value: number;
  /** original lexeme, so printing is exact; replaced on knob edit */
  text: string;
}

export interface StrNode extends AstBase {
  kind: 'str';
  value: string;
}

export interface SymNode extends AstBase {
  kind: 'sym';
  name: string;
}

export interface BoolNode extends AstBase {
  kind: 'bool';
  value: boolean;
}

export interface ListNode extends AstBase {
  kind: 'list';
  items: Ast[];
  /** dotted tail, e.g. (2 . 1) => items=[2], tail=1 */
  tail?: Ast;
}

export type Ast = NumNode | StrNode | SymNode | BoolNode | ListNode;

/** A parsed program: top-level forms plus the exact source text (printer splices into it). */
export interface Program {
  source: string;
  forms: Ast[];
}

// ---------------------------------------------------------------------------
// Runtime values
// ---------------------------------------------------------------------------

/** Cons cell. Proper lists end in null (the empty list). */
export class Pair {
  constructor(
    public car: Value,
    public cdr: Value,
  ) {}
}

export class Sym {
  private constructor(public readonly name: string) {}
  private static table = new Map<string, Sym>();
  static of(name: string): Sym {
    let s = Sym.table.get(name);
    if (!s) {
      s = new Sym(name);
      Sym.table.set(name, s);
    }
    return s;
  }
}

export interface Tensor {
  shape: readonly number[];
  data: Float32Array;
}

export function isTensor(v: unknown): v is Tensor {
  return (
    typeof v === 'object' &&
    v !== null &&
    'shape' in v &&
    'data' in v &&
    (v as Tensor).data instanceof Float32Array
  );
}

/** Opaque named record (layer / head / layernorm params). Fields hold Values. */
export class LispRecord {
  constructor(
    public readonly tag: string,
    public readonly fields: Map<string, Value>,
  ) {}
  get(name: string): Value {
    const v = this.fields.get(name);
    if (v === undefined) throw new LispError(`record ${this.tag} has no field ${name}`);
    return v;
  }
}

export class Closure {
  constructor(
    public readonly params: string[],
    public readonly body: Ast[],
    public readonly env: EnvLike,
    public readonly name: string = 'lambda',
  ) {}
}

export interface Builtin {
  kind: 'builtin';
  name: string;
  fn: (args: Value[]) => Value;
  /** doc line for (help) */
  doc?: string;
}

export type Value =
  | number
  | string
  | boolean
  | null // the empty list '()
  | Sym
  | Pair
  | Closure
  | Builtin
  | Tensor
  | LispRecord
  | undefined; // unspecified (result of define/set!)

export function isBuiltin(v: Value): v is Builtin {
  return typeof v === 'object' && v !== null && 'kind' in v && v.kind === 'builtin';
}

export interface EnvLike {
  lookup(name: string): Value;
  define(name: string, v: Value): void;
  set(name: string, v: Value): void;
  has(name: string): boolean;
}

export class LispError extends Error {
  constructor(
    message: string,
    public span?: Span,
  ) {
    super(span ? `${message} (line ${span.line}, col ${span.col})` : message);
  }
}

// ---------------------------------------------------------------------------
// List helpers (runtime lists)
// ---------------------------------------------------------------------------

export function list(...vals: Value[]): Value {
  let acc: Value = null;
  for (let i = vals.length - 1; i >= 0; i--) acc = new Pair(vals[i], acc);
  return acc;
}

export function listToArray(v: Value, what = 'list'): Value[] {
  const out: Value[] = [];
  let cur = v;
  while (cur instanceof Pair) {
    out.push(cur.car);
    cur = cur.cdr;
  }
  if (cur !== null) throw new LispError(`${what}: improper list`);
  return out;
}

/** Structural equality: numbers, symbols, pairs (recursively), strings, booleans. */
export function valueEquals(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (a instanceof Pair && b instanceof Pair)
    return valueEquals(a.car, b.car) && valueEquals(a.cdr, b.cdr);
  return false;
}
