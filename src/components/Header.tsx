/**
 * Header (§10): sticky slim bar. Logotype with blinking block cursor, live
 * status chip computed from the manifest, REPL / References / GitHub buttons.
 */
import { getImage, setRefsOpen, setReplOpen, useAppState } from '../store/app-store';

function fmtParams(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : `${Math.round(n / 1e3)}k`;
}

export default function Header() {
  const { status, replOpen, refsOpen } = useAppState();
  const manifest = status === 'ready' ? getImage().checkpoint.manifest : null;
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2 text-sm">
        <a href="#top" className="flex items-center gap-2 whitespace-nowrap text-paper">
          <img src="/logo-48.png" alt="" width={20} height={20} className="rounded-sm" />
          <span>
            (lispllm)
            <span className="cursor-blink text-amber">▍</span>
          </span>
        </a>
        {manifest && (
          <span data-testid="status-chip" className="hidden truncate text-xs text-dim sm:block">
            (params {fmtParams(manifest.params)}) (layers {manifest.dims.n_layer}) (ctx{' '}
            {manifest.ctx})
          </span>
        )}
        <span className="flex-1" />
        <button
          data-testid="btn-repl"
          className={`rounded border border-edge px-2 py-0.5 hover:border-amber ${replOpen ? 'text-amber' : 'text-paper'}`}
          onClick={() => setReplOpen(!replOpen)}
          title="toggle repl (` or Cmd+K)"
        >
          repl
        </button>
        <button
          data-testid="btn-refs"
          className={`rounded border border-edge px-2 py-0.5 hover:border-amber ${refsOpen ? 'text-amber' : 'text-paper'}`}
          onClick={() => setRefsOpen(!refsOpen)}
        >
          references
        </button>
        <a
          className="rounded border border-edge px-2 py-0.5 text-paper hover:border-amber"
          href="https://github.com/lispllm/lispllm"
          target="_blank"
          rel="noreferrer"
        >
          github
        </a>
      </div>
    </header>
  );
}
