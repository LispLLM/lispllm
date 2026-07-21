/**
 * Header (§10): sticky slim bar. Logotype with blinking block cursor, live
 * status chip computed from the manifest, REPL / References / GitHub buttons.
 */
import {
  getImage,
  getState,
  setRefsOpen,
  setReplOpen,
  setToast,
  useAppState,
} from '../store/app-store';
import { encodeShare } from '../store/share';
import { shallowEqual } from '../store/selector';
import {
  setActiveLesson,
  setBottomOpen,
  setBottomTab,
  setLeftOpen,
  setMobilePane,
  setRightTab,
  useWorkspaceState,
} from '../store/workspace-store';
import AccentPicker from './AccentPicker';

function fmtParams(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : `${Math.round(n / 1e3)}k`;
}

export default function Header() {
  const { status, replOpen, refsOpen, sourceDirty } = useAppState(
    (current) => ({
      status: current.status,
      replOpen: current.replOpen,
      refsOpen: current.refsOpen,
      sourceDirty: current.sourceDirty,
    }),
    shallowEqual,
  );
  const { bottomOpen, leftOpen, activeLesson, rightTab } = useWorkspaceState(
    (current) => ({
      bottomOpen: current.bottomOpen,
      leftOpen: current.leftOpen,
      activeLesson: current.activeLesson,
      rightTab: current.rightTab,
    }),
    shallowEqual,
  );
  const manifest = status === 'ready' ? getImage().checkpoint.manifest : null;
  return (
    <header className="z-[60] flex h-9 shrink-0 items-center border-b border-edge bg-chrome px-2 text-xs">
      <button
        className="mr-1 hidden h-7 w-7 items-center justify-center text-dim hover:bg-paper/5 hover:text-paper md:flex"
        aria-label="toggle sidebar"
        onClick={() => setLeftOpen(!leftOpen)}
      >
        ◫
      </button>
      <a
        href="#sec-0"
        className="flex items-center gap-2 whitespace-nowrap text-paper"
        onClick={(event) => {
          event.preventDefault();
          setActiveLesson(0);
          setMobilePane('learn');
        }}
      >
        <img src="/logo-48.png" alt="" width={18} height={18} className="rounded-sm" />
        <span>
          (lispllm)
          <span className="cursor-blink text-amber">▍</span>
        </span>
      </a>
      {manifest && (
        <span
          data-testid="status-chip"
          className="ml-3 hidden truncate text-[11px] text-dim lg:block"
        >
          (params {fmtParams(manifest.params)}) (layers {manifest.dims.n_layer}) (ctx {manifest.ctx}
          )
        </span>
      )}
      {sourceDirty && <span className="ml-3 text-amber">● draft</span>}
      <span className="flex-1" />
      <AccentPicker />
      <button
        data-testid="btn-repl"
        className={`rounded px-2 py-1 hover:bg-paper/5 ${replOpen || bottomOpen ? 'text-amber' : 'text-paper'}`}
        onClick={() => {
          setBottomTab('repl');
          setBottomOpen(!bottomOpen);
          if (window.matchMedia('(max-width: 767px)').matches) setReplOpen(!replOpen);
        }}
        title="toggle repl (` or Cmd+K)"
      >
        repl
      </button>
      <button
        data-testid="btn-refs"
        className={`rounded px-2 py-1 hover:bg-paper/5 ${refsOpen ? 'text-amber' : 'text-paper'}`}
        onClick={() => {
          setRefsOpen(!refsOpen);
          setRightTab('references');
        }}
      >
        references
      </button>
      <button
        data-testid="btn-share"
        className="rounded px-2 py-1 text-paper hover:bg-paper/5"
        onClick={async () => {
          const s = getState();
          const img = getImage();
          const customBase = img.canonicalSource !== s.bundledSource;
          const { hash, dropped, overflow, serialized } = encodeShare({
            seed: s.seed,
            knobEdits: s.knobEdits,
            replHistory: s.replHistory,
            source: customBase ? s.appliedSource : undefined,
            bundledSource: s.bundledSource,
            lesson: activeLesson,
            rightTab,
          });
          if (overflow) {
            await navigator.clipboard.writeText(serialized);
            setToast('exact state is too large for a URL — state JSON copied instead');
            return;
          }
          const url = `${location.origin}${location.pathname}${hash}`;
          await navigator.clipboard.writeText(url);
          setToast(
            dropped > 0
              ? `share link copied — dropped ${dropped} oldest history entr${dropped > 1 ? 'ies' : 'y'} to fit 2 KB`
              : 'share link copied',
          );
        }}
        title="copy a link to this exact state"
      >
        share
      </button>
      <a
        className="hidden rounded px-2 py-1 text-paper hover:bg-paper/5 sm:block"
        href="https://github.com/lispllm/lispllm"
        target="_blank"
        rel="noreferrer"
      >
        github
      </a>
    </header>
  );
}
