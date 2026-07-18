import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readProgram } from '../../src/lisp/reader';
import { printNode, printNumber, printProgram, printValue } from '../../src/lisp/printer';
import { list } from '../../src/lisp/types';
import type { ListNode, NumNode } from '../../src/lisp/types';

const modelSrc = readFileSync('public/model.lisp', 'utf8');

describe('printer', () => {
  it('read∘print is a fixpoint on model.lisp', () => {
    const p1 = readProgram(modelSrc);
    const printed = printProgram(p1);
    expect(printed).toBe(modelSrc);
    const p2 = readProgram(printed);
    expect(printProgram(p2)).toBe(printed);
  });

  it('AST edits splice stably into the canonical text', () => {
    const p = readProgram(modelSrc);
    // find the temperature literal 0.8
    const tempForm = p.forms.find(
      (f) =>
        f.kind === 'list' &&
        f.items[1]?.kind === 'sym' &&
        (f.items[1] as { name: string }).name === 'temperature',
    ) as ListNode;
    const lit = tempForm.items[2] as NumNode;
    expect(lit.value).toBe(0.8);
    const edited = printProgram(p, new Map([[lit.id, '1.5']]));
    expect(edited).toContain('(define temperature 1.5)');
    expect(edited).not.toContain('(define temperature 0.8)');
    // everything else unchanged
    expect(edited.length).toBe(modelSrc.length);
    // and re-reading the edited text still parses
    expect(readProgram(edited).forms.length).toBe(p.forms.length);
  });

  it('printNode extracts a form with edits applied', () => {
    const p = readProgram('(define x 1)\n(define y 2)');
    const y = p.forms[1] as ListNode;
    expect(printNode(y, p.source)).toBe('(define y 2)');
    const lit = y.items[2] as NumNode;
    expect(printNode(y, p.source, new Map([[lit.id, '99']]))).toBe('(define y 99)');
  });

  it('floats print to 4 significant figures', () => {
    expect(printNumber(3.14159265)).toBe('3.142');
    expect(printNumber(0.000123456)).toBe('0.0001235');
    expect(printNumber(42)).toBe('42');
    expect(printNumber(-1.23456e-7)).toBe('-1.235e-7');
  });

  it('long lists elide with …', () => {
    const v = list(...Array.from({ length: 30 }, (_, i) => i));
    expect(printValue(v)).toContain('…');
  });
});
