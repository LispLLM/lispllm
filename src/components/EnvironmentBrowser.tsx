import { useEffect, useMemo, useRef, useState } from 'react';
import type { Value } from '../lisp/types';
import { Closure, LispRecord, isBuiltin, isTensor } from '../lisp/types';
import { printValue } from '../lisp/printer';
import { getImage, setReplDraft, useAppState } from '../store/app-store';
import { setBottomTab } from '../store/workspace-store';
import { recordLearningEvent } from '../store/learning-store';

function kindOf(value: Value): string {
  if (isTensor(value)) return `tensor [${value.shape.join(' ')}]`;
  if (isBuiltin(value)) return 'builtin';
  if (value instanceof Closure) return 'closure';
  if (value instanceof LispRecord) return value.tag;
  if (typeof value === 'number') return 'number';
  return 'value';
}

function EnvironmentFilter({
  count,
  onCommit,
}: {
  count: number;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="border-b border-edge p-2">
      <label className="block text-[11px] uppercase tracking-wider text-dim" htmlFor="env-filter">
        environment · {count} bindings
      </label>
      <input
        id="env-filter"
        className="mt-2 w-full rounded border border-edge bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-amber"
        placeholder="filter symbols"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onCommit(next), 80);
        }}
      />
    </div>
  );
}

export default function EnvironmentBrowser() {
  const imageVersion = useAppState((current) => current.imageVersion);
  const [filter, setFilter] = useState('');
  const img = getImage();
  const bindings = useMemo(() => {
    void imageVersion;
    const out: Array<{ name: string; kind: string; preview: string }> = [];
    for (const [name, value] of img.env.entries()) {
      out.push({
        name,
        kind: kindOf(value),
        preview: isTensor(value) || isBuiltin(value) ? '' : printValue(value).slice(0, 36),
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [img, imageVersion]);
  const shown = bindings.filter((binding) =>
    `${binding.name} ${binding.kind}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="s7-env">
      <EnvironmentFilter count={bindings.length} onCommit={setFilter} />
      <div className="min-h-0 flex-1 overflow-y-auto py-1 text-xs" role="list">
        {shown.map((binding) => (
          <button
            key={binding.name}
            role="listitem"
            className="flex min-h-7 w-full min-w-0 items-center gap-2 overflow-hidden px-3 text-left hover:bg-paper/5"
            onClick={() => {
              setReplDraft(binding.name);
              setBottomTab('repl');
              recordLearningEvent('environment:binding-selected');
            }}
            title="Insert this symbol into the REPL"
          >
            <span className="shrink-0 text-paper">{binding.name}</span>
            <span className="shrink-0 text-trace">{binding.kind}</span>
            {binding.preview && <span className="truncate text-dim">{binding.preview}</span>}
          </button>
        ))}
      </div>
      <div className="border-t border-edge px-3 py-1 text-[11px] text-dim">
        click a binding to insert it into the REPL
      </div>
    </section>
  );
}
