/**
 * The image (INV-1): a single global Lisp environment holding the model,
 * weights, and all definitions. Everything on the page is a projection of it.
 *
 * Rebuild pipeline (§5): fresh env → bind weights (by reference) → apply
 * knobEdits to the canonical AST → evaluate it → replay replHistory in order.
 */
import { Env, installCoreBuiltins } from '../lisp/env';
import { applyValue, evaluate } from '../lisp/eval';
import { printProgram, printValue } from '../lisp/printer';
import { readProgram } from '../lisp/reader';
import type { Ast, Program, Value } from '../lisp/types';
import { LispError, isTensor, list, listToArray } from '../lisp/types';
import type { Tensor } from '../lisp/types';
import { installTensorBuiltins } from '../tensor/bindings';
import { Rng } from '../tensor/rng';
import { argmax, lastRow, sample as sampleK, softmax as softmaxK } from '../tensor/kernels';
import type { Checkpoint } from './load';
import { bindCheckpoint, makeTokenizer } from './load';
import type { Trace } from './trace';
import { withTrace } from './trace';

/** A knob edit: replace the canonical node whose span starts at `at` with `text`. */
export interface KnobEdit {
  at: number;
  text: string;
}

export interface ReplLine {
  kind: 'input' | 'value' | 'output' | 'error' | 'ui' | 'inspect';
  text: string;
}

export class Image {
  env!: Env;
  program!: Program; // the edited program actually evaluated (code is truth)
  rng!: Rng;
  /** separate PRNG for UI-paced generation streams, so hero output never
   *  perturbs the image PRNG (INV-6: REPL results depend only on
   *  checkpoint/seed/knobEdits/replHistory) — logged in DECISIONS.md */
  uiRng!: Rng;
  version = 0;
  readonly tokenizer: { encode: (s: string) => number[]; decode: (ts: number[]) => string };
  private canonical: Program;
  private outputSink: (text: string) => void = () => {};

  constructor(
    public readonly checkpoint: Checkpoint,
    public readonly modelSource: string,
    public seed: number,
  ) {
    this.canonical = readProgram(modelSource);
    this.tokenizer = makeTokenizer(checkpoint.manifest.charset);
    this.rebuild([], []);
  }

  /** Deterministic rebuild. Returns REPL transcript from replaying history. */
  rebuild(knobEdits: KnobEdit[], replHistory: string[]): ReplLine[] {
    // resolve span-addressed edits against canonical node ids
    const byId = new Map<number, string>();
    for (const e of knobEdits) {
      const node = findNodeAt(this.canonical.forms, e.at);
      if (node) byId.set(node.id, e.text);
    }
    const editedSrc = printProgram(this.canonical, byId);
    this.program = readProgram(editedSrc);

    this.rng = new Rng(this.seed);
    this.uiRng = new Rng((this.seed ^ 0x9e3779b9) >>> 0);
    const env = new Env();
    installCoreBuiltins(env, {
      display: (t) => this.outputSink(t),
      seed: (n) => this.rng.reseed(n),
    });
    installTensorBuiltins(env, this.rng);
    bindCheckpoint(env, this.checkpoint);
    this.env = env;
    for (const f of this.program.forms) evaluate(f, env);

    const transcript: ReplLine[] = [];
    for (const entry of replHistory) {
      transcript.push(...this.evalRepl(entry));
    }
    this.version++;
    return transcript;
  }

  /** Evaluate one REPL entry; returns transcript lines (input echo + results). */
  evalRepl(source: string): ReplLine[] {
    const lines: ReplLine[] = [{ kind: 'input', text: source }];
    const prevSink = this.outputSink;
    this.outputSink = (t) => lines.push({ kind: 'output', text: t });
    try {
      for (const form of readProgram(source).forms) {
        const v = evaluate(form, this.env);
        const s = printValue(v);
        if (s) lines.push({ kind: 'value', text: s });
      }
    } catch (err) {
      lines.push({
        kind: 'error',
        text: err instanceof LispError ? err.message : String(err),
      });
    } finally {
      this.outputSink = prevSink;
    }
    return lines;
  }

  /** Pure projection: evaluate an expression without touching history. */
  evalExpr(source: string): Value {
    let v: Value;
    for (const form of readProgram(source).forms) v = evaluate(form, this.env);
    return v;
  }

  lookup(name: string): Value {
    return this.env.lookup(name);
  }

  call(name: string, ...args: Value[]): Value {
    return applyValue(this.env.lookup(name), args);
  }

  /** Untraced forward: logits vector for the last position of `text`. */
  logits(text: string): Tensor {
    const ctx = this.checkpoint.manifest.ctx;
    const tokens = this.tokenizer.encode(text).slice(-ctx);
    if (tokens.length === 0) throw new LispError('logits: empty input');
    const out = this.call('gpt', list(...tokens));
    if (!isTensor(out)) throw new LispError('gpt did not return a tensor');
    return lastRow(out);
  }

  /** Next-token probability distribution (uses the image's temperature). */
  probs(text: string): Float32Array {
    const temp = this.lookup('temperature');
    const t = typeof temp === 'number' ? temp : 1;
    const l = this.logits(text);
    const scaled = { shape: l.shape, data: l.data.map((x) => x / t) };
    return softmaxK(scaled).data;
  }

  greedyNext(text: string): number {
    return argmax(this.logits(text));
  }

  /** Sample the next token via the image's own (next-token) definition. */
  sampleNext(tokens: number[]): number {
    const v = this.call('next-token', list(...tokens));
    if (typeof v !== 'number') throw new LispError('next-token did not return an index');
    return v;
  }

  /** Hero/UI stream sampling: same math (gpt + temperature + native sample
   *  kernel), but drawing from the UI PRNG stream. */
  sampleNextUi(tokens: number[]): number {
    const ctx = this.checkpoint.manifest.ctx;
    const win = tokens.slice(-ctx);
    const out = this.call('gpt', list(...win));
    if (!isTensor(out)) throw new LispError('gpt did not return a tensor');
    const temp = this.lookup('temperature');
    const t = typeof temp === 'number' ? temp : 1;
    const l = lastRow(out);
    return sampleK({ shape: l.shape, data: l.data.map((x) => x / t) }, this.uiRng);
  }

  /** Traced forward on the focus string (sections 2–5 and 7 read from this). */
  traceForward(focus: string): Trace {
    const ctx = this.checkpoint.manifest.ctx;
    const tokens = this.tokenizer.encode(focus).slice(-ctx);
    const gpt = this.env.lookup('gpt');
    const { trace } = withTrace(focus, () => applyValue(gpt, [list(...tokens)]));
    return trace;
  }

  /** Find a node in the *current program* (for knob binding / trace lookups). */
  findDefineLiteral(name: string): Ast | null {
    for (const f of this.program.forms) {
      if (
        f.kind === 'list' &&
        f.items[0]?.kind === 'sym' &&
        f.items[0].name === 'define' &&
        f.items[1]?.kind === 'sym' &&
        f.items[1].name === name
      ) {
        return f.items[2] ?? null;
      }
    }
    return null;
  }

  /** Map a node of the current program back to canonical coordinates for KnobEdits. */
  canonicalSpanFor(name: string): number | null {
    for (const f of this.canonical.forms) {
      if (
        f.kind === 'list' &&
        f.items[0]?.kind === 'sym' &&
        f.items[0].name === 'define' &&
        f.items[1]?.kind === 'sym' &&
        f.items[1].name === name
      ) {
        return f.items[2]?.span.start ?? null;
      }
    }
    return null;
  }

  /** All top-level values decoded as a token list (helper for generate). */
  decodeList(v: Value): string {
    return this.tokenizer.decode(listToArray(v).map((x) => x as number));
  }

  /** Read-only access to the canonical (unedited) program for span addressing. */
  get canonicalForms(): Ast[] {
    return this.canonical.forms;
  }

  get canonicalSource(): string {
    return this.canonical.source;
  }

  /** Fail before an edited source becomes the live image if core UI contracts are missing. */
  assertModelContract(focus = 'To be'): void {
    const required = [
      'gpt',
      'next-token',
      'temperature',
      'ablated',
      'embed',
      'head',
      'attention',
      'block',
      'generate',
    ];
    for (const name of required) {
      try {
        this.lookup(name);
      } catch {
        throw new LispError(`model contract: missing ${name}`);
      }
    }
    if (typeof this.lookup('temperature') !== 'number') {
      throw new LispError('model contract: temperature must be a number');
    }
    // Exercise the path every live visualization depends on before swapping images.
    this.probs(focus || 'To be');
  }

  /** Smallest AST node containing a source offset in the active program. */
  nodeAtOffset(offset: number): Ast | null {
    return findContainingNode(this.program.forms, offset);
  }

  /** Find an AST node by its active-program id (trace/editor linking). */
  nodeById(id: number): Ast | null {
    return findNodeById(this.program.forms, id);
  }

  /** Mean negative log-likelihood per character of `text` (one forward pass). */
  nll(text: string): number {
    const ctx = this.checkpoint.manifest.ctx;
    const tokens = this.tokenizer.encode(text).slice(-ctx);
    if (tokens.length < 2) return NaN;
    const out = this.call('gpt', list(...tokens));
    if (!isTensor(out)) throw new LispError('gpt did not return a tensor');
    const V = out.shape[1];
    let total = 0;
    for (let i = 0; i < tokens.length - 1; i++) {
      const row = out.data.subarray(i * V, (i + 1) * V);
      let max = -Infinity;
      for (let j = 0; j < V; j++) if (row[j] > max) max = row[j];
      let sum = 0;
      for (let j = 0; j < V; j++) sum += Math.exp(row[j] - max);
      total -= row[tokens[i + 1]] - max - Math.log(sum);
    }
    return total / (tokens.length - 1);
  }
}

function findNodeAt(forms: Ast[], at: number): Ast | null {
  for (const f of forms) {
    if (f.span.start === at) return f;
    if (f.span.start <= at && at < f.span.end && f.kind === 'list') {
      const inner = findNodeAt(f.items.concat(f.tail ? [f.tail] : []), at);
      if (inner) return inner;
    }
  }
  return null;
}

function findContainingNode(forms: Ast[], offset: number): Ast | null {
  for (const f of forms) {
    if (f.span.start <= offset && offset < f.span.end) {
      if (f.kind === 'list') {
        const inner = findContainingNode(f.items.concat(f.tail ? [f.tail] : []), offset);
        if (inner) return inner;
      }
      return f;
    }
  }
  return null;
}

function findNodeById(forms: Ast[], id: number): Ast | null {
  for (const f of forms) {
    if (f.id === id) return f;
    if (f.kind === 'list') {
      const inner = findNodeById(f.items.concat(f.tail ? [f.tail] : []), id);
      if (inner) return inner;
    }
  }
  return null;
}
