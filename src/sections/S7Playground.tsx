/** §7 — example mutations; environment and trace live in persistent inspector tabs. */
import Cite from '../components/Cite';
import { replSubmit, useAppState } from '../store/app-store';
import { setBottomTab, setRightTab } from '../store/workspace-store';

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

export default function S7Playground({
  labOnly = false,
  active = true,
}: {
  labOnly?: boolean;
  active?: boolean;
}) {
  const sourceDirty = useAppState((current) => current.sourceDirty);
  return (
    <section
      id="sec-7"
      hidden={labOnly && !active}
      className={labOnly ? 'min-w-0 p-3 font-mono' : 'mx-auto max-w-measure px-4 py-16 font-mono'}
    >
      {!labOnly && (
        <>
          <h2 className="mb-4 text-xl text-paper">;; §7 the playground</h2>
          <p className="mb-4 text-sm leading-6 text-dim">
            Everything above is one environment. Use the persistent Environment and Trace tabs to
            inspect every binding and intermediate tensor. These examples evaluate real forms in the
            REPL. The model has read only Tiny Shakespeare <Cite n={13} />.
          </p>
        </>
      )}
      <div className="mb-4 flex flex-wrap gap-2" data-testid="s7-examples">
        {EXAMPLES.map((example) => {
          const mutates = /define|set!/.test(example.code);
          return (
            <button
              key={example.label}
              className="rounded border border-edge px-2 py-1 text-xs text-dim hover:border-amber hover:text-amber disabled:opacity-40"
              disabled={sourceDirty && mutates}
              onClick={() => {
                replSubmit(example.code, mutates);
                setBottomTab('repl');
              }}
              title={example.code}
            >
              {example.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="rounded border border-edge bg-panel p-4 text-left text-xs text-dim hover:border-amber"
          onClick={() => setRightTab('environment')}
        >
          <span className="block text-paper">Environment</span>
          Browse every symbol, tensor shape, closure, and value.
        </button>
        <button
          className="rounded border border-edge bg-panel p-4 text-left text-xs text-dim hover:border-amber"
          onClick={() => setRightTab('trace')}
        >
          <span className="block text-paper">Trace</span>
          Select an evaluated AST node and reveal it in the editor.
        </button>
      </div>
      {!labOnly && (
        <p className="mt-3 text-sm text-dim">
          try: <span className="text-amber">(help)</span>
        </p>
      )}
    </section>
  );
}
