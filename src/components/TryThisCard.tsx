import type { TryIt } from '../content/learning';
import { openReplWithDraft } from './learning-actions';

export default function TryThisCard({ lessonId, example }: { lessonId: number; example: TryIt }) {
  return (
    <section
      className="rounded border border-amber/35 bg-amber/5 p-3"
      data-testid={`try-this-${lessonId}`}
      aria-label="Try this in the REPL"
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest text-amber">Try this</div>
      <p className="mt-1 text-xs leading-5 text-dim">{example.explanation}</p>
      <code className="mt-2 block overflow-x-auto rounded bg-ink px-2 py-2 text-xs text-paper">
        {example.command}
      </code>
      <p className="mt-2 text-[11px] leading-4 text-dim">
        <span className="text-paper">Expected:</span> {example.expected}
      </p>
      <button
        className="mt-3 rounded bg-amber px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-amber/90"
        data-testid={`try-this-stage-${lessonId}`}
        onClick={() => openReplWithDraft(example.command)}
      >
        Put in REPL →
      </button>
    </section>
  );
}
