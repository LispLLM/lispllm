import { describe, expect, it } from 'vitest';
import { Env, installCoreBuiltins } from '../../src/lisp/env';
import { evaluate } from '../../src/lisp/eval';
import { readProgram } from '../../src/lisp/reader';
import { printValue } from '../../src/lisp/printer';
import type { Value } from '../../src/lisp/types';

function makeEnv(): Env {
  const env = new Env();
  installCoreBuiltins(env, { display: () => {}, seed: () => {} });
  return env;
}

function run(src: string, env = makeEnv()): Value {
  let v: Value;
  for (const f of readProgram(src).forms) v = evaluate(f, env);
  return v;
}

describe('eval', () => {
  it('arithmetic', () => {
    expect(run('(+ 1 2 3)')).toBe(6);
    expect(run('(/ 1.0 4)')).toBe(0.25);
    expect(run('(- 5)')).toBe(-5);
    expect(run('(max 1 9 3)')).toBe(9);
  });

  it('closures capture their environment', () => {
    expect(run('(define (adder n) (lambda (x) (+ x n))) ((adder 10) 5)')).toBe(15);
  });

  it('shadowing', () => {
    expect(run('(define x 1) (define (f x) (+ x 1)) (list (f 10) x)')).toSatisfy(
      (v: Value) => printValue(v) === '(11 1)',
    );
  });

  it('let does not see its own bindings; let* does', () => {
    expect(run('(define a 1) (let ((a 10) (b a)) b)')).toBe(1);
    expect(run('(let* ((a 10) (b a)) b)')).toBe(10);
  });

  it('cond with else', () => {
    expect(run('(cond ((= 1 2) 0) ((= 1 1) 42) (else 99))')).toBe(42);
    expect(run('(cond ((= 1 2) 0) (else 99))')).toBe(99);
  });

  it('set! mutates enclosing binding', () => {
    expect(run('(define n 0) (define (bump) (set! n (+ n 1))) (bump) (bump) n')).toBe(2);
  });

  it('set! on unbound symbol errors', () => {
    expect(() => run('(set! nope 1)')).toThrow(/unbound/);
  });

  it('recursion', () => {
    expect(run('(define (fact n) (if (= n 0) 1 (* n (fact (- n 1))))) (fact 10)')).toBe(3628800);
  });

  it('and/or short-circuit and return values', () => {
    expect(run('(and 1 2 3)')).toBe(3);
    expect(run('(and #f (undefined-symbol))')).toBe(false);
    expect(run('(or #f 7)')).toBe(7);
    expect(run('(or #f #f)')).toBe(false);
  });

  it('quote and list ops', () => {
    expect(printValue(run("(cdr '(1 2 3))"))).toBe('(2 3)');
    expect(run("(length '(a b c))")).toBe(3);
    expect(printValue(run("(map (lambda (x) (* x x)) '(1 2 3))"))).toBe('(1 4 9)');
    expect(run("(fold + 0 '(1 2 3 4))")).toBe(10);
    expect(printValue(run('(iota 4)'))).toBe('(0 1 2 3)');
    expect(printValue(run("(snoc '(1 2) 3)"))).toBe('(1 2 3)');
    expect(printValue(run("(last-n 2 '(1 2 3 4))"))).toBe('(3 4)');
    expect(printValue(run("(reverse '(1 2 3))"))).toBe('(3 2 1)');
    expect(run("(nth 1 '(a b c))")).toSatisfy((v: Value) => printValue(v) === 'b');
  });

  it('member with dotted pairs (the ablated pattern)', () => {
    expect(printValue(run("(member '(2 . 1) '((0 . 0) (2 . 1)))"))).toBe('((2 . 1))');
    expect(run("(member '(9 . 9) '((2 . 1)))")).toBe(false);
  });

  it('begin sequences and returns last', () => {
    expect(run('(begin 1 2 3)')).toBe(3);
  });

  it('proper tail calls: counting loop to 50,000', () => {
    expect(run('(define (loop i) (if (= i 50000) i (loop (+ i 1)))) (loop 0)')).toBe(50000);
  });

  it('tail calls through cond and let*', () => {
    expect(
      run(
        '(define (loop i acc) (cond ((= i 20000) acc) (else (let* ((n (+ acc 1))) (loop (+ i 1) n))))) (loop 0 0)',
      ),
    ).toBe(20000);
  });

  it('runtime errors carry source position', () => {
    expect(() => run('(car 5)')).toThrow(/car/);
    expect(() => run('\n\n(undefined-thing)')).toThrow(/unbound symbol/);
  });
});
