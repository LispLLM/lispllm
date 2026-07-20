/** §7 — example mutations; environment and trace live in persistent inspector tabs. */
import Cite from '../components/Cite';
import { PLAYGROUND_EXAMPLES } from '../content/learning';
import { useAppState } from '../store/app-store';
import { setRightTab } from '../store/workspace-store';
import { openReplWithDraft } from '../components/learning-actions';

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
      <div className="mb-4 grid gap-2 sm:grid-cols-2" data-testid="s7-examples">
        {PLAYGROUND_EXAMPLES.map((example) => {
          const mutates = /define|set!/.test(example.code);
          return (
            <button
              key={example.label}
              className="rounded border border-edge bg-ink/40 p-2 text-left text-xs text-dim hover:border-amber disabled:opacity-40"
              disabled={sourceDirty && mutates}
              onClick={() => openReplWithDraft(example.code)}
              title={example.code}
            >
              <span className="block text-paper">{example.label}</span>
              <span className="mt-1 block text-[11px] leading-4">{example.explanation}</span>
              <span className="mt-1 block text-amber">Put in REPL →</span>
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
