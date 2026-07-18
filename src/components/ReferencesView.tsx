import { useEffect, useRef } from 'react';
import { REFERENCES } from '../content/references';
import { setRefsOpen, useAppState } from '../store/app-store';
import { setActiveLesson, setMobilePane, setRightTab } from '../store/workspace-store';

export default function ReferencesView() {
  const openRef = useAppState((current) => current.openRef);
  const rootRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    if (openRef != null) {
      requestAnimationFrame(() =>
        rootRef.current?.querySelector(`#ref-entry-${openRef}`)?.scrollIntoView({ block: 'start' }),
      );
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setRefsOpen(false);
      setRightTab('lesson');
      if (window.matchMedia('(max-width: 767px)').matches) setMobilePane('learn');
      requestAnimationFrame(() => {
        if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openRef]);

  return (
    <section
      ref={rootRef}
      data-testid="refs-panel"
      className="h-full overflow-y-auto p-3"
      aria-label="references"
    >
      <ol className="space-y-3 text-xs">
        {REFERENCES.map((reference) => (
          <li
            key={reference.n}
            id={`ref-entry-${reference.n}`}
            data-testid={`ref-entry-${reference.n}`}
            className={`rounded border p-3 ${
              openRef === reference.n ? 'border-amber bg-amber/5' : 'border-edge bg-ink/40'
            }`}
          >
            <div className="text-paper">
              <span className="text-amber">[{reference.n}]</span> {reference.title}
            </div>
            <div className="mt-0.5 text-dim">
              {reference.authors}, {reference.year}
            </div>
            <p className="mt-2 leading-5 text-dim">{reference.why}</p>
            {reference.url && (
              <a
                className="mt-2 inline-block break-all text-amber underline"
                href={reference.url}
                target="_blank"
                rel="noreferrer"
              >
                {reference.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 56)}
              </a>
            )}
            {reference.citedBy.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 text-dim">
                cited in
                {reference.citedBy.map((lesson) => (
                  <button
                    key={lesson}
                    className="text-amber hover:underline"
                    onClick={() => setActiveLesson(lesson)}
                  >
                    §{lesson}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
