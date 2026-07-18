import { LESSONS } from '../content/lessons';
import { getImage, useAppState } from '../store/app-store';
import { useWorkspaceState } from '../store/workspace-store';

export default function StatusBar() {
  const { seed, sourceDirty, trace } = useAppState();
  const { activeLesson } = useWorkspaceState();
  const manifest = getImage().checkpoint.manifest;
  return (
    <footer
      className="flex h-6 shrink-0 items-center gap-4 bg-amber px-2 text-[11px] text-ink max-md:hidden"
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
