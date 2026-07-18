/**
 * Environments: a simple chain of frames. The global frame is "the image".
 * Also home of the core (list/scalar) builtins per §7.
 */
import type { Builtin, EnvLike, Value } from './types';
import { LispError, Pair, isTensor, list, listToArray, valueEquals } from './types';
import { applyValue } from './eval';
import { printValue } from './printer';

export class Env implements EnvLike {
  private frame = new Map<string, Value>();

  constructor(private parent: Env | null = null) {}

  lookup(name: string): Value {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let e: Env | null = this;
    while (e) {
      if (e.frame.has(name)) return e.frame.get(name);
      e = e.parent;
    }
    throw new LispError(`unbound symbol: ${name}`);
  }

  has(name: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let e: Env | null = this;
    while (e) {
      if (e.frame.has(name)) return true;
      e = e.parent;
    }
    return false;
  }

  define(name: string, v: Value): void {
    this.frame.set(name, v);
  }

  set(name: string, v: Value): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let e: Env | null = this;
    while (e) {
      if (e.frame.has(name)) {
        e.frame.set(name, v);
        return;
      }
      e = e.parent;
    }
    throw new LispError(`set!: unbound symbol: ${name}`);
  }

  child(): Env {
    return new Env(this);
  }

  /** Enumerate own (global) bindings — used by the environment browser (§7). */
  entries(): IterableIterator<[string, Value]> {
    return this.frame.entries();
  }
}

// ---------------------------------------------------------------------------
// Core builtins (§7): list and scalar primitives
// ---------------------------------------------------------------------------

export interface CoreHooks {
  /** REPL/console output sink for (display …) */
  display: (text: string) => void;
  /** (seed! n) reseeds the image PRNG */
  seed: (n: number) => void;
}

function num(v: Value, who: string): number {
  if (typeof v !== 'number') throw new LispError(`${who}: expected a number, got ${printValue(v)}`);
  return v;
}

function b(name: string, doc: string, fn: (args: Value[]) => Value): Builtin {
  return { kind: 'builtin', name, doc, fn };
}

export function installCoreBuiltins(env: EnvLike, hooks: CoreHooks): void {
  const defs: Builtin[] = [
    b('cons', '(cons a d) → pair', (a) => new Pair(a[0], a[1])),
    b('car', '(car p) → first of pair', (a) => {
      if (!(a[0] instanceof Pair)) throw new LispError('car: expected a pair');
      return a[0].car;
    }),
    b('cdr', '(cdr p) → rest of pair', (a) => {
      if (!(a[0] instanceof Pair)) throw new LispError('cdr: expected a pair');
      return a[0].cdr;
    }),
    b('list', '(list …) → list of args', (a) => list(...a)),
    b('nth', '(nth i lst) → i-th element (0-based)', (a) => {
      const i = num(a[0], 'nth');
      const arr = listToArray(a[1], 'nth');
      if (i < 0 || i >= arr.length) throw new LispError(`nth: index ${i} out of range`);
      return arr[i];
    }),
    b('length', '(length lst) → count', (a) => listToArray(a[0], 'length').length),
    b('map', '(map f lst) → list', (a) => {
      const f = a[0];
      return list(...listToArray(a[1], 'map').map((x) => applyValue(f, [x])));
    }),
    b('fold', '(fold f init lst) → f over list, left', (a) => {
      const f = a[0];
      let acc = a[1];
      for (const x of listToArray(a[2], 'fold')) acc = applyValue(f, [acc, x]);
      return acc;
    }),
    b('member', '(member x lst) → sublist from x, or #f', (a) => {
      let cur = a[1];
      while (cur instanceof Pair) {
        if (valueEquals(a[0], cur.car)) return cur;
        cur = cur.cdr;
      }
      return false;
    }),
    b('reverse', '(reverse lst)', (a) => list(...listToArray(a[0], 'reverse').reverse())),
    b('iota', '(iota n) → (0 1 … n-1)', (a) => {
      const n = num(a[0], 'iota');
      return list(...Array.from({ length: n }, (_, i) => i));
    }),
    b('snoc', '(snoc lst x) → lst with x appended', (a) =>
      list(...listToArray(a[0], 'snoc'), a[1]),
    ),
    b('last-n', '(last-n n lst) → at most the last n elements', (a) => {
      const n = num(a[0], 'last-n');
      const arr = listToArray(a[1], 'last-n');
      return list(...arr.slice(Math.max(0, arr.length - n)));
    }),
    b('+', '(+ …) → sum', (a) => a.reduce<number>((s, x) => s + num(x, '+'), 0)),
    b('-', '(- a b …) → difference; (- a) negates', (a) => {
      if (a.length === 0) throw new LispError('-: needs at least one arg');
      if (a.length === 1) return -num(a[0], '-');
      return a.slice(1).reduce<number>((s, x) => s - num(x, '-'), num(a[0], '-'));
    }),
    b('*', '(* …) → product', (a) => a.reduce<number>((s, x) => s * num(x, '*'), 1)),
    b('/', '(/ a b …) → quotient', (a) => {
      if (a.length === 0) throw new LispError('/: needs at least one arg');
      if (a.length === 1) return 1 / num(a[0], '/');
      return a.slice(1).reduce<number>((s, x) => s / num(x, '/'), num(a[0], '/'));
    }),
    b('=', '(= a b …) → #t if all equal', (a) =>
      a.every((x, i) => i === 0 || num(x, '=') === num(a[0], '=')),
    ),
    b('<', '(< a b …) → strictly increasing', (a) =>
      a.every((x, i) => i === 0 || num(a[i - 1], '<') < num(x, '<')),
    ),
    b('>', '(> a b …) → strictly decreasing', (a) =>
      a.every((x, i) => i === 0 || num(a[i - 1], '>') > num(x, '>')),
    ),
    b('min', '(min …)', (a) => Math.min(...a.map((x) => num(x, 'min')))),
    b('max', '(max …)', (a) => Math.max(...a.map((x) => num(x, 'max')))),
    b('abs', '(abs x)', (a) => Math.abs(num(a[0], 'abs'))),
    b('sqrt', '(sqrt x)', (a) => Math.sqrt(num(a[0], 'sqrt'))),
    b('exp', '(exp x)', (a) => Math.exp(num(a[0], 'exp'))),
    b('log', '(log x)', (a) => Math.log(num(a[0], 'log'))),
    b('not', '(not x) → #t iff x is #f', (a) => a[0] === false),
    b('null?', "(null? x) → #t iff x is '()", (a) => a[0] === null),
    b('eq?', '(eq? a b) → identity / structural for pairs', (a) => valueEquals(a[0], a[1])),
    b('shape', '(shape t) → tensor shape as a list', (a) => {
      const v = a[0];
      if (isTensor(v)) return list(...v.shape);
      if (v === null || v instanceof Pair) return list(listToArray(v, 'shape').length);
      throw new LispError('shape: expected a tensor or list');
    }),
    b('display', '(display x) → prints x', (a) => {
      hooks.display(typeof a[0] === 'string' ? a[0] : printValue(a[0]));
      return undefined;
    }),
    b('help', '(help) → list the primitives', (a) => {
      void a;
      const lines: string[] = [];
      for (const d of defs) lines.push(`${d.name.padEnd(10)} ${d.doc ?? ''}`);
      hooks.display(lines.join('\n'));
      return undefined;
    }),
    b('seed!', '(seed! n) → reseed the image PRNG', (a) => {
      hooks.seed(num(a[0], 'seed!'));
      return undefined;
    }),
  ];
  for (const d of defs) env.define(d.name, d);
}
