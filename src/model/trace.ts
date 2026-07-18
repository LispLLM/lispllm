/**
 * forward/trace (§5 architecture): records, for every AST node evaluated
 * during one forward pass on the focus string, its latest value reference
 * plus a context tag {layerId?, headId?}. Context tags are derived
 * dynamically: when a function application receives a layer or head record
 * as an argument, its id is pushed for that dynamic extent.
 */
import type { Tracer } from '../lisp/eval';
import { setTracer } from '../lisp/eval';
import type { Ast, Value } from '../lisp/types';
import { LispRecord, Pair } from '../lisp/types';

export interface TraceEntry {
  value: Value;
  layerId?: number;
  headId?: number;
}

export interface Trace {
  /** node id → latest recorded value + context */
  entries: Map<number, TraceEntry>;
  /** node id + layer/head context → value (same node evaluates once per head) */
  byContext: Map<string, TraceEntry>;
  focus: string;
}

export function contextKey(nodeId: number, layerId?: number, headId?: number): string {
  return `${nodeId}:${layerId ?? ''}:${headId ?? ''}`;
}

class RecordingTracer implements Tracer {
  entries = new Map<number, TraceEntry>();
  byContext = new Map<string, TraceEntry>();
  private layerStack: number[] = [];
  private headStack: number[] = [];
  private frames: Array<{ layers: number; heads: number }> = [];

  onValue(node: Ast, value: Value): void {
    const layerId = this.layerStack.length
      ? this.layerStack[this.layerStack.length - 1]
      : undefined;
    const headId = this.headStack.length ? this.headStack[this.headStack.length - 1] : undefined;
    const entry = { value, layerId, headId };
    this.entries.set(node.id, entry);
    this.byContext.set(contextKey(node.id, layerId, headId), entry);
  }

  onApplyEnter(_fn: Value, args: Value[]): void {
    let layers = 0;
    let heads = 0;
    for (const a of args) {
      if (a instanceof LispRecord) {
        if (a.tag === 'layer' && typeof a.get('id') === 'number') {
          this.layerStack.push(a.get('id') as number);
          layers++;
        } else if (a.tag === 'head') {
          const id = a.get('id');
          if (id instanceof Pair && typeof id.car === 'number' && typeof id.cdr === 'number') {
            this.layerStack.push(id.car);
            this.headStack.push(id.cdr);
            layers++;
            heads++;
          }
        }
      }
    }
    this.frames.push({ layers, heads });
  }

  onApplyExit(): void {
    const f = this.frames.pop();
    if (!f) return;
    this.layerStack.length -= f.layers;
    this.headStack.length -= f.heads;
  }
}

/** Run fn with tracing enabled; returns the recorded trace. */
export function withTrace<T>(focus: string, fn: () => T): { result: T; trace: Trace } {
  const t = new RecordingTracer();
  setTracer(t);
  try {
    const result = fn();
    return { result, trace: { entries: t.entries, byContext: t.byContext, focus } };
  } finally {
    setTracer(null);
  }
}
