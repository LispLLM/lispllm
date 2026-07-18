/**
 * Evaluator with proper tail calls via a trampolined loop.
 * Tail positions (if / begin / let* / cond tails, function bodies) reassign
 * (expr, env) and continue the loop instead of recursing.
 */
import type { Ast, Builtin, EnvLike, ListNode, Value } from './types';
import { Closure, LispError, Pair, Sym } from './types';
import { Env } from './env';

/** Optional tracer, installed for forward/trace (M4). */
export interface Tracer {
  /** called after every AST node evaluation with its value */
  onValue(node: Ast, value: Value): void;
  /** called when a function application begins/ends (for dynamic-extent context tags) */
  onApplyEnter(fn: Value, args: Value[]): void;
  onApplyExit(): void;
}

let tracer: Tracer | null = null;
export function setTracer(t: Tracer | null): void {
  tracer = t;
}

function isTruthy(v: Value): boolean {
  return v !== false;
}

/** Convert a quoted AST node into a runtime value. */
export function astToValue(node: Ast): Value {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'str':
      return node.value;
    case 'bool':
      return node.value;
    case 'sym':
      return Sym.of(node.name);
    case 'list': {
      let acc: Value = node.tail ? astToValue(node.tail) : null;
      for (let i = node.items.length - 1; i >= 0; i--)
        acc = new Pair(astToValue(node.items[i]), acc);
      return acc;
    }
  }
}

function expectSym(node: Ast, what: string): string {
  if (node.kind !== 'sym') throw new LispError(`${what}: expected a symbol`, node.span);
  return node.name;
}

function isBuiltinValue(v: Value): v is Builtin {
  return typeof v === 'object' && v !== null && 'kind' in v && v.kind === 'builtin';
}

/** Apply a callable value to already-evaluated args (used by map/fold and the UI). */
export function applyValue(fn: Value, args: Value[]): Value {
  if (isBuiltinValue(fn)) {
    if (tracer) {
      tracer.onApplyEnter(fn, args);
      try {
        return fn.fn(args);
      } finally {
        tracer.onApplyExit();
      }
    }
    return fn.fn(args);
  }
  if (fn instanceof Closure) {
    if (args.length !== fn.params.length)
      throw new LispError(`${fn.name}: expected ${fn.params.length} args, got ${args.length}`);
    const env = (fn.env as Env).child();
    for (let i = 0; i < args.length; i++) env.define(fn.params[i], args[i]);
    if (tracer) {
      tracer.onApplyEnter(fn, args);
      try {
        return evalBody(fn.body, env);
      } finally {
        tracer.onApplyExit();
      }
    }
    return evalBody(fn.body, env);
  }
  throw new LispError(`not a procedure: ${String(fn)}`);
}

function evalBody(body: Ast[], env: Env): Value {
  for (let i = 0; i < body.length - 1; i++) evaluate(body[i], env);
  return evaluate(body[body.length - 1], env);
}

export function evaluate(expr: Ast, env: EnvLike): Value {
  let node: Ast = expr;
  let e = env as Env;
  // stack of nodes whose values must be reported to the tracer once the
  // trampoline bottoms out (tail-position nodes share the final value).
  // Only populated while tracing, so untraced deep recursion stays O(1).
  const pending: Ast[] = [];
  const pushPending = (n: Ast): void => {
    if (tracer) pending.push(n);
  };

  const finish = (v: Value): Value => {
    if (tracer) {
      tracer.onValue(node, v);
      for (let i = pending.length - 1; i >= 0; i--) tracer.onValue(pending[i], v);
    }
    return v;
  };

  for (;;) {
    switch (node.kind) {
      case 'num':
        return finish(node.value);
      case 'str':
        return finish(node.value);
      case 'bool':
        return finish(node.value);
      case 'sym':
        return finish(e.lookup(node.name));
      case 'list': {
        const L = node as ListNode;
        if (L.items.length === 0) throw new LispError('cannot evaluate ()', node.span);
        if (L.tail) throw new LispError('cannot evaluate dotted list', node.span);
        const head = L.items[0];
        if (head.kind === 'sym') {
          switch (head.name) {
            case 'quote': {
              if (L.items.length !== 2) throw new LispError('quote: one operand', node.span);
              return finish(astToValue(L.items[1]));
            }
            case 'if': {
              if (L.items.length < 3 || L.items.length > 4)
                throw new LispError('if: (if test then else?)', node.span);
              const t = evaluate(L.items[1], e);
              if (isTruthy(t)) {
                pushPending(node);
                node = L.items[2];
              } else if (L.items.length === 4) {
                pushPending(node);
                node = L.items[3];
              } else {
                return finish(undefined);
              }
              continue; // tail
            }
            case 'define': {
              const target = L.items[1];
              if (target.kind === 'sym') {
                if (L.items.length !== 3)
                  throw new LispError('define: (define name expr)', node.span);
                e.define(target.name, evaluate(L.items[2], e));
              } else if (target.kind === 'list') {
                // (define (f a b) body…)
                const name = expectSym(target.items[0], 'define');
                const params = target.items.slice(1).map((p) => expectSym(p, 'define'));
                e.define(name, new Closure(params, L.items.slice(2), e, name));
              } else {
                throw new LispError('define: bad target', target.span);
              }
              return finish(undefined);
            }
            case 'set!': {
              if (L.items.length !== 3) throw new LispError('set!: (set! name expr)', node.span);
              e.set(expectSym(L.items[1], 'set!'), evaluate(L.items[2], e));
              return finish(undefined);
            }
            case 'lambda': {
              const params = L.items[1];
              if (params.kind !== 'list') throw new LispError('lambda: bad params', node.span);
              const names = params.items.map((p) => expectSym(p, 'lambda'));
              return finish(new Closure(names, L.items.slice(2), e));
            }
            case 'begin': {
              if (L.items.length === 1) return finish(undefined);
              for (let i = 1; i < L.items.length - 1; i++) evaluate(L.items[i], e);
              pushPending(node);
              node = L.items[L.items.length - 1];
              continue; // tail
            }
            case 'let':
            case 'let*': {
              const bindings = L.items[1];
              if (bindings.kind !== 'list')
                throw new LispError(`${head.name}: bad bindings`, node.span);
              const inner = e.child();
              const evalEnv = head.name === 'let' ? e : inner;
              for (const b of bindings.items) {
                if (b.kind !== 'list' || b.items.length !== 2)
                  throw new LispError(`${head.name}: bad binding`, b.span);
                inner.define(expectSym(b.items[0], head.name), evaluate(b.items[1], evalEnv));
              }
              // body: all but last, then tail
              for (let i = 2; i < L.items.length - 1; i++) evaluate(L.items[i], inner);
              pushPending(node);
              node = L.items[L.items.length - 1];
              e = inner;
              continue; // tail
            }
            case 'cond': {
              let matched = false;
              for (let i = 1; i < L.items.length && !matched; i++) {
                const clause = L.items[i];
                if (clause.kind !== 'list' || clause.items.length < 1)
                  throw new LispError('cond: bad clause', clause.span);
                const test = clause.items[0];
                const isElse = test.kind === 'sym' && test.name === 'else';
                const t = isElse ? true : evaluate(test, e);
                if (isTruthy(t)) {
                  if (clause.items.length === 1) return finish(t);
                  for (let j = 1; j < clause.items.length - 1; j++) evaluate(clause.items[j], e);
                  pushPending(node);
                  node = clause.items[clause.items.length - 1];
                  matched = true;
                }
              }
              if (!matched) return finish(undefined);
              continue; // tail
            }
            case 'and': {
              let v: Value = true;
              for (let i = 1; i < L.items.length - 1; i++) {
                v = evaluate(L.items[i], e);
                if (!isTruthy(v)) return finish(v);
              }
              if (L.items.length > 1) {
                pushPending(node);
                node = L.items[L.items.length - 1];
                continue; // tail
              }
              return finish(v);
            }
            case 'or': {
              for (let i = 1; i < L.items.length - 1; i++) {
                const v = evaluate(L.items[i], e);
                if (isTruthy(v)) return finish(v);
              }
              if (L.items.length > 1) {
                pushPending(node);
                node = L.items[L.items.length - 1];
                continue; // tail
              }
              return finish(false);
            }
          }
        }
        // application
        const fnVal = evaluate(head, e);
        const args: Value[] = new Array(L.items.length - 1);
        for (let i = 1; i < L.items.length; i++) args[i - 1] = evaluate(L.items[i], e);
        if (fnVal instanceof Closure) {
          if (args.length !== fnVal.params.length)
            throw new LispError(
              `${fnVal.name}: expected ${fnVal.params.length} args, got ${args.length}`,
              node.span,
            );
          const inner = (fnVal.env as Env).child();
          for (let i = 0; i < args.length; i++) inner.define(fnVal.params[i], args[i]);
          if (tracer) {
            // traced calls are not tail-call-optimized across the apply hook;
            // tracing is only ever used on a single bounded forward pass.
            tracer.onApplyEnter(fnVal, args);
            try {
              for (let i = 0; i < fnVal.body.length - 1; i++) evaluate(fnVal.body[i], inner);
              const v = evaluate(fnVal.body[fnVal.body.length - 1], inner);
              return finish(v);
            } finally {
              tracer.onApplyExit();
            }
          }
          for (let i = 0; i < fnVal.body.length - 1; i++) evaluate(fnVal.body[i], inner);
          pushPending(node);
          node = fnVal.body[fnVal.body.length - 1];
          e = inner;
          continue; // proper tail call
        }
        if (isBuiltinValue(fnVal)) {
          try {
            if (tracer) {
              tracer.onApplyEnter(fnVal, args);
              try {
                return finish(fnVal.fn(args));
              } finally {
                tracer.onApplyExit();
              }
            }
            return finish(fnVal.fn(args));
          } catch (err) {
            if (err instanceof LispError && !err.span) err.span = node.span;
            throw err;
          }
        }
        throw new LispError(
          `not a procedure: ${head.kind === 'sym' ? head.name : '<expr>'}`,
          node.span,
        );
      }
    }
  }
}

/** Evaluate a sequence of top-level forms; returns the last value. */
export function evalProgram(forms: Ast[], env: EnvLike): Value {
  let v: Value;
  for (const f of forms) v = evaluate(f, env);
  return v;
}
