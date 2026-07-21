/** References panel (§10): right slide-over, the only home for external links. */
import { useEffect, useRef } from 'react';
import { REFERENCES } from '../content/references';
import { setRefsOpen, useAppState } from '../store/app-store';
import { shallowEqual } from '../store/selector';

export default function RefsPanel() {
  const { refsOpen, openRef } = useAppState(
    (current) => ({ refsOpen: current.refsOpen, openRef: current.openRef }),
    shallowEqual,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!refsOpen) return;
    openerRef.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRefsOpen(false);
        if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    if (openRef != null) {
      panelRef.current?.querySelector(`#ref-entry-${openRef}`)?.scrollIntoView({ block: 'start' });
    } else {
      panelRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [refsOpen, openRef]);

  if (!refsOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => setRefsOpen(false)}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        data-testid="refs-panel"
        tabIndex={-1}
        role="dialog"
        aria-label="references"
        className="fixed right-0 top-0 z-50 h-full w-full overflow-y-auto border-l border-edge bg-panel p-6 font-mono sm:w-[380px]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-paper">;; references</h2>
          <button
            className="text-dim hover:text-amber"
            aria-label="close references"
            title="Close references"
            onClick={() => {
              setRefsOpen(false);
              if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
            }}
          >
            esc ×
          </button>
        </div>
        <ol className="space-y-5 text-sm">
          {REFERENCES.map((r) => (
            <li
              key={r.n}
              id={`ref-entry-${r.n}`}
              data-testid={`ref-entry-${r.n}`}
              className={`rounded border p-3 ${openRef === r.n ? 'border-amber' : 'border-edge'}`}
            >
              <div className="text-paper">
                <span className="text-amber">[{r.n}]</span> {r.title}
              </div>
              <div className="text-dim">
                {r.authors}, {r.year}
              </div>
              <p className="mt-1 text-dim">{r.why}</p>
              {r.url && (
                <a
                  className="mt-1 inline-block text-amber underline"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)}
                </a>
              )}
              {r.citedBy.length > 0 && (
                <div className="mt-1 text-xs text-dim">
                  cited in {r.citedBy.map((s) => `§${s}`).join(', ')}
                </div>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </>
  );
}
