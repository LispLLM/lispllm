import { useAppState } from '../store/app-store';

export default function ProblemsPanel() {
  const sourceDiagnostics = useAppState((current) => current.sourceDiagnostics);
  return (
    <section className="h-full overflow-y-auto text-xs" data-testid="problems-panel">
      {sourceDiagnostics.length === 0 ? (
        <div className="p-4 text-dim">No source problems detected.</div>
      ) : (
        <ul className="py-1">
          {sourceDiagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.from}.${index}`}
              className="flex gap-3 border-b border-edge px-4 py-2"
            >
              <span className="text-error">×</span>
              <div>
                <div className="text-paper">{diagnostic.message}</div>
                <div className="mt-0.5 text-dim">
                  model.lisp:{diagnostic.line}:{diagnostic.col} · {diagnostic.kind}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
