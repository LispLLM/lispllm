import { describe, expect, it } from 'vitest';
import { readOne, readProgram } from '../../src/lisp/reader';
import { printAst } from '../../src/lisp/printer';
import type { ListNode, NumNode, StrNode, SymNode } from '../../src/lisp/types';

describe('reader', () => {
  it('reads a symbol', () => {
    const n = readOne('foo') as SymNode;
    expect(n.kind).toBe('sym');
    expect(n.name).toBe('foo');
  });

  it('reads integers and floats', () => {
    expect((readOne('42') as NumNode).value).toBe(42);
    expect((readOne('3.14') as NumNode).value).toBeCloseTo(3.14);
    expect((readOne('1e-5') as NumNode).value).toBeCloseTo(1e-5);
  });

  it('reads negative numbers', () => {
    expect((readOne('-7') as NumNode).value).toBe(-7);
    expect((readOne('-0.5') as NumNode).value).toBe(-0.5);
  });

  it('distinguishes - the symbol from negative numbers', () => {
    expect((readOne('-') as SymNode).name).toBe('-');
    const l = readOne('(- a)') as ListNode;
    expect((l.items[0] as SymNode).name).toBe('-');
  });

  it('reads nested lists', () => {
    const n = readOne('(a (b (c d)) e)') as ListNode;
    expect(n.items).toHaveLength(3);
    const inner = n.items[1] as ListNode;
    expect((inner.items[1] as ListNode).items).toHaveLength(2);
  });

  it('reads quote sugar', () => {
    const n = readOne("'x") as ListNode;
    expect((n.items[0] as SymNode).name).toBe('quote');
    expect((n.items[1] as SymNode).name).toBe('x');
  });

  it('reads quoted lists with dotted pairs', () => {
    const n = readOne("'((2 . 1))") as ListNode;
    const quoted = n.items[1] as ListNode;
    const pair = quoted.items[0] as ListNode;
    expect((pair.items[0] as NumNode).value).toBe(2);
    expect((pair.tail as NumNode).value).toBe(1);
  });

  it('reads strings with escapes', () => {
    expect((readOne('"hi\\nthere"') as StrNode).value).toBe('hi\nthere');
    expect((readOne('"a \\"b\\""') as StrNode).value).toBe('a "b"');
  });

  it('skips comments', () => {
    const p = readProgram('; leading\n(a b) ; trailing\n;; done');
    expect(p.forms).toHaveLength(1);
  });

  it('reads booleans', () => {
    expect(readOne('#t').kind).toBe('bool');
    expect(readOne('#f').kind).toBe('bool');
  });

  it('records source spans', () => {
    const p = readProgram('  (foo bar)');
    const f = p.forms[0] as ListNode;
    expect(f.span.start).toBe(2);
    expect(f.span.end).toBe(11);
    expect(p.source.slice(f.items[1].span.start, f.items[1].span.end)).toBe('bar');
  });

  it('assigns unique node ids', () => {
    const p = readProgram('(a a a)');
    const f = p.forms[0] as ListNode;
    const ids = new Set([f.id, ...f.items.map((i) => i.id)]);
    expect(ids.size).toBe(4);
  });

  it('errors on unclosed lists', () => {
    expect(() => readProgram('(a (b)')).toThrow(/unclosed/);
  });

  it('errors on stray close paren', () => {
    expect(() => readProgram(')')).toThrow(/unexpected/);
  });

  it('round-trips synthetic printing', () => {
    expect(printAst(readOne('(a (b . c) "s" 1.5 #t)'))).toBe('(a (b . c) "s" 1.5 #t)');
  });
});
