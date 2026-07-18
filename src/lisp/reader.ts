/**
 * Reader: s-expressions -> AST with stable node ids and source spans.
 * Supports symbols, integers/floats, strings, 'x quote sugar, ; comments,
 * dotted pairs, #t/#f.
 */
import type { Ast, ListNode, Program, Span } from './types';
import { LispError } from './types';

let nextId = 1;
export function freshNodeId(): number {
  return nextId++;
}

class Reader {
  pos = 0;
  line = 1;
  col = 1;

  constructor(public src: string) {}

  peek(): string {
    return this.src[this.pos] ?? '';
  }

  advance(): string {
    const c = this.src[this.pos++];
    if (c === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return c;
  }

  spanFrom(start: number, line: number, col: number): Span {
    return { start, end: this.pos, line, col };
  }

  skipWhitespaceAndComments(): void {
    for (;;) {
      const c = this.peek();
      if (c === ';') {
        while (this.pos < this.src.length && this.peek() !== '\n') this.advance();
      } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        this.advance();
      } else {
        return;
      }
    }
  }

  atEnd(): boolean {
    this.skipWhitespaceAndComments();
    return this.pos >= this.src.length;
  }

  readForm(): Ast {
    this.skipWhitespaceAndComments();
    const { pos: start, line, col } = this;
    const c = this.peek();
    if (c === '') throw new LispError('unexpected end of input', this.spanFrom(start, line, col));
    if (c === '(') return this.readList();
    if (c === ')') throw new LispError("unexpected ')'", { start, end: start + 1, line, col });
    if (c === "'") {
      this.advance();
      const quoted = this.readForm();
      const span = this.spanFrom(start, line, col);
      const quoteSym: Ast = {
        kind: 'sym',
        name: 'quote',
        id: freshNodeId(),
        span: { start, end: start + 1, line, col },
      };
      return { kind: 'list', items: [quoteSym, quoted], id: freshNodeId(), span };
    }
    if (c === '"') return this.readString();
    return this.readAtom();
  }

  readList(): ListNode {
    const { pos: start, line, col } = this;
    this.advance(); // (
    const items: Ast[] = [];
    let tail: Ast | undefined;
    for (;;) {
      this.skipWhitespaceAndComments();
      const c = this.peek();
      if (c === '') throw new LispError('unclosed list', { start, end: this.pos, line, col });
      if (c === ')') {
        this.advance();
        break;
      }
      // dotted pair: "." followed by delimiter
      if (c === '.' && this.isDelimiter(this.src[this.pos + 1] ?? '')) {
        if (items.length === 0)
          throw new LispError('misplaced dot', this.spanFrom(this.pos, this.line, this.col));
        this.advance();
        tail = this.readForm();
        this.skipWhitespaceAndComments();
        if (this.peek() !== ')')
          throw new LispError(
            "expected ')' after dotted tail",
            this.spanFrom(this.pos, this.line, this.col),
          );
        this.advance();
        break;
      }
      items.push(this.readForm());
    }
    return { kind: 'list', items, tail, id: freshNodeId(), span: this.spanFrom(start, line, col) };
  }

  isDelimiter(c: string): boolean {
    return (
      c === '' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '(' || c === ')'
    );
  }

  readString(): Ast {
    const { pos: start, line, col } = this;
    this.advance(); // "
    let out = '';
    for (;;) {
      const c = this.advance();
      if (c === undefined || c === '')
        throw new LispError('unterminated string', { start, end: this.pos, line, col });
      if (c === '"') break;
      if (c === '\\') {
        const e = this.advance();
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === '\\') out += '\\';
        else if (e === '"') out += '"';
        else throw new LispError(`bad escape \\${e}`, this.spanFrom(start, line, col));
      } else {
        out += c;
      }
    }
    return { kind: 'str', value: out, id: freshNodeId(), span: this.spanFrom(start, line, col) };
  }

  readAtom(): Ast {
    const { pos: start, line, col } = this;
    while (this.pos < this.src.length && !this.isDelimiter(this.peek()) && this.peek() !== ';')
      this.advance();
    const text = this.src.slice(start, this.pos);
    const span = this.spanFrom(start, line, col);
    if (text === '#t') return { kind: 'bool', value: true, id: freshNodeId(), span };
    if (text === '#f') return { kind: 'bool', value: false, id: freshNodeId(), span };
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
      return { kind: 'num', value: Number(text), text, id: freshNodeId(), span };
    }
    return { kind: 'sym', name: text, id: freshNodeId(), span };
  }
}

/** Read a whole program (all top-level forms). */
export function readProgram(source: string): Program {
  const r = new Reader(source);
  const forms: Ast[] = [];
  while (!r.atEnd()) forms.push(r.readForm());
  return { source, forms };
}

/** Read a single form (REPL convenience). Throws if extra non-comment input follows. */
export function readOne(source: string): Ast {
  const r = new Reader(source);
  const form = r.readForm();
  if (!r.atEnd()) throw new LispError('unexpected trailing input');
  return form;
}
