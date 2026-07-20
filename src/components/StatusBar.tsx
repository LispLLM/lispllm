import { LESSONS } from '../content/lessons';
import { getImage, useAppState } from '../store/app-store';
import { shallowEqual } from '../store/selector';
import { useWorkspaceState } from '../store/workspace-store';

export default function StatusBar() {
  const { seed, sourceDirty, trace } = useAppState(
    (current) => ({
      seed: current.seed,
      sourceDirty: current.sourceDirty,
      trace: current.trace,
    }),
    shallowEqual,
  );
  const activeLesson = useWorkspaceState((current) => current.activeLesson);
  const manifest = getImage().checkpoint.manifest;
  return (
    <footer
      className="flex h-6 shrink-0 items-center gap-4 bg-amber px-2 text-[11px] text-accent-foreground max-md:hidden"
      data-testid="status-bar"
    >
      <span>λ lispllm</span>
      <span>
        §{activeLesson} {LESSONS[activeLesson]?.shortTitle}
      </span>
      <span>{sourceDirty ? '● draft not running' : '✓ model running'}</span>
      <span>seed {seed}</span>
      <span>{manifest.params.toLocaleString()} params</span>
      <span>{trace?.entries.size ?? 0} trace nodes</span>
      <span className="ml-auto">offline · browser Lisp</span>
    </footer>
  );
}
