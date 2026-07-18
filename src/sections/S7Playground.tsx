/** §7 — "The playground." Env browser + trace inspector + example chips. */
import { useMemo, useState } from 'react';
import type { Ast, Value } from '../lisp/types';
import { isTensor, isBuiltin, LispRecord, Closure } from '../lisp/types';
import { printValue } from '../lisp/printer';
import Cite from '../components/Cite';
import TensorView from '../components/TensorView';
import { nodeSource } from '../model/queries';
import { getImage, replSubmit, setReplOpen, useAppState } from '../store/app-store';

const EXAMPLES: Array<{ label: string; code: string }> = [
  {
    label: 'gelu → relu',
    code: '(define (gelu x) (lists->tensor (map (lambda (r) (map (lambda (v) (max v 0)) r)) (tensor->lists x))))',
  },
  { label: 'ablate layer 2', code: "(set! ablated '((2 . 0) (2 . 1) (2 . 2) (2 . 3)))" },
  { label: 'T = 3', code: '(set! temperature 3.0)' },
  { label: 'shape of tok-emb', code: '(shape tok-emb)' },
  { label: 'generate', code: "(generate '(20 15 25) 40)" },
];

function kindOf(v: Value): string {
  if (isTensor(v)) return `tensor [${v.shape.join(' ')}]`;
  if (isBuiltin(v)) return 'builtin';
  if (v instanceof Closure) return 'closure';
  if (v instanceof LispRecord) return v.tag;
  if (typeof v === 'number') return 'number';
  return 'value';
}

export default function S7Playground() {
  const { imageVersion, trace } = useAppState();
  const img = getImage();
  const [selectedNode, setSelectedNode] = useState<Ast | null>(null);
  const [filter, setFilter] = useState('');

  const bindings = useMemo(() => {
    void imageVersion;
    const out: Array<{ name: string; kind: string; preview: string }> = [];
    for (const [name, v] of img.env.entries()) {
      out.push({
        name,
        kind: kindOf(v),
        preview: isTensor(v) || isBuiltin(v) ? '' : printValue(v).slice(0, 24),
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [img, imageVersion]);

  const shown = bindings.filter((b) => b.name.includes(filter));

  const tracedValue = useMemo(() => {
    if (!selectedNode || !trace) return null;
    const e = trace.entries.get(selectedNode.id);
    return e ?? null;
  }, [selectedNode, trace]);

  const insert = (text: string) => {
    setReplOpen(true);
    replSubmit(text);
  };

  const renderTree = (node: Ast, depth: number): React.ReactNode => {
    const src = nodeSource(img.program, node);
    const label = src.length > 44 ? src.slice(0, 41) + '…' : src;
    const traced = trace?.entries.has(node.id);
    return (
      <div key={node.id} style={{ paddingLeft: depth * 12 }}>
        <button
          className={`truncate text-left text-xs ${
            selectedNode?.id === node.id
              ? 'text-amber'
              : traced
                ? 'text-paper hover:text-amber'
                : 'text-dim hover:text-paper'
          }`}
          onClick={() => setSelectedNode(node)}
        >
          {label.replace(/\n\s*/g, ' ')}
        </button>
        {node.kind === 'list' &&
          depth < 4 &&
          node.items.filter((c) => c.kind === 'list').map((c) => renderTree(c, depth + 1))}
      </div>
    );
  };

  return (
    <section id="sec-7" className="mx-auto max-w-measure px-4 py-16 font-mono">
      <h2 className="mb-4 text-xl text-paper">;; §7 the playground</h2>
      <p className="mb-4 text-sm leading-6 text-dim">
        Everything above was a guided tour of one environment; here is the environment itself. Every
        bound symbol, every intermediate tensor. Click a name to evaluate it in the REPL; select a
        node of the model to see its traced value. The model has read nothing but 1.1 MB of
        Shakespeare
        <Cite n={13} /> — whatever it knows lives in the bindings below.
      </p>

      <div className="mb-4 flex flex-wrap gap-2" data-testid="s7-examples">
        {EXAMPLES.map((e) => (
          <button
            key={e.label}
            className="rounded border border-edge px-2 py-1 text-xs text-dim hover:border-amber hover:text-amber"
            onClick={() => insert(e.code)}
            title={e.code}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className="min-w-0 overflow-hidden rounded border border-edge bg-panel p-3"
          data-testid="s7-env"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-dim">environment ({bindings.length} bindings)</span>
            <input
              className="w-28 rounded border border-edge bg-ink px-2 py-0.5 text-xs text-paper outline-none focus:border-amber"
              placeholder="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="filter bindings"
            />
          </div>
          <div className="max-h-80 overflow-y-auto text-xs">
            {shown.map((b) => (
              <button
                key={b.name}
                className="flex min-h-6 w-full min-w-0 items-center gap-2 overflow-hidden rounded px-1 text-left hover:bg-paper/5"
                onClick={() => insert(b.name)}
              >
                <span className="text-paper">{b.name}</span>
                <span className="text-dim">{b.kind}</span>
                {b.preview && <span className="truncate text-dim">{b.preview}</span>}
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-w-0 overflow-hidden rounded border border-edge bg-panel p-3"
          data-testid="s7-inspector"
        >
          <div className="mb-2 text-xs text-dim">trace inspector — model.lisp as a tree</div>
          <div className="max-h-40 overflow-y-auto">
            {img.program.forms.map((f) => renderTree(f, 0))}
          </div>
          <div className="mt-3 border-t border-edge pt-2">
            {tracedValue && isTensor(tracedValue.value) ? (
              <TensorView
                tensor={tracedValue.value}
                maxWidth={300}
                ariaLabel="traced value of the selected node"
              />
            ) : tracedValue ? (
              <pre className="text-xs text-paper">{printValue(tracedValue.value)}</pre>
            ) : (
              <span className="text-xs text-dim">
                {selectedNode
                  ? ';; no traced value — this node was not evaluated in the last forward pass'
                  : ';; select a node above'}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-dim">
        try: <span className="text-amber">(help)</span>
      </p>
    </section>
  );
}
