import { getLearningGuide, resolveNextActionKind } from '../content/learning';
import { useAppState } from '../store/app-store';
import { useLearningState } from '../store/learning-store';
import { shallowEqual } from '../store/selector';
import {
  setActiveLesson,
  setBottomOpen,
  setBottomTab,
  setMobilePane,
  useWorkspaceState,
} from '../store/workspace-store';
import { navigateToLearningTarget } from './learning-actions';

export default function NextActionBar() {
  const { sourceDirty, sourceApplying, diagnostics } = useAppState(
    (current) => ({
      sourceDirty: current.sourceDirty,
      sourceApplying: current.sourceApplying,
      diagnostics: current.sourceDiagnostics.length,
    }),
    shallowEqual,
  );
  const activeLesson = useWorkspaceState((current) => current.activeLesson);
  const completed = useLearningState((current) => current.completed);
  const guide = getLearningGuide(activeLesson);
  const currentTask = guide.tasks.find((task) => !completed.includes(task.id));
  const exactCompleteCount = guide.tasks.filter((task) => completed.includes(task.id)).length;
  const actionKind = resolveNextActionKind({
    sourceApplying,
    diagnostics,
    sourceDirty,
    hasCurrentTask: currentTask !== undefined,
  });

  let label = currentTask?.title ?? 'Lesson complete';
  let detail = currentTask?.description ?? 'Continue when you are ready.';
  let button = currentTask
    ? (currentTask.actionLabel ?? 'Show me')
    : activeLesson < 8
      ? 'Next lesson'
      : 'Open playground';
  let action = () => {
    if (currentTask) {
      navigateToLearningTarget(currentTask.target);
    } else if (activeLesson < 8) {
      setActiveLesson(activeLesson + 1);
      setMobilePane('learn');
    } else {
      setActiveLesson(7);
      setMobilePane('output');
    }
  };

  if (actionKind === 'applying') {
    label = 'Applying model.lisp';
    detail = 'Wait while the candidate model is validated and replayed.';
    button = 'Working…';
    action = () => undefined;
  } else if (actionKind === 'diagnostics') {
    label = `Fix ${diagnostics} source problem${diagnostics === 1 ? '' : 's'}`;
    detail = 'The last good model is still running; fix or revert the draft before continuing.';
    button = 'Open editor';
    action = () => {
      setBottomTab('problems');
      setBottomOpen(true);
      setMobilePane('editor');
    };
  } else if (actionKind === 'draft') {
    label = 'Run the model.lisp draft';
    detail = 'Your edits are not running yet. Apply them with Run or Cmd/Ctrl+Enter.';
    button = 'Open editor';
    action = () => navigateToLearningTarget({ pane: 'editor', testId: 'btn-run-source' });
  }

  return (
    <section
      className="flex min-h-9 shrink-0 items-center gap-2 border-b border-edge bg-panel px-2 text-xs"
      data-testid="next-action"
      aria-live="polite"
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-amber">
        Next
      </span>
      <span className="min-w-0 truncate text-paper">{label}</span>
      <span className="hidden min-w-0 truncate text-dim lg:inline">— {detail}</span>
      <span className="ml-auto hidden shrink-0 text-[10px] text-dim sm:inline">
        {sourceDirty || diagnostics > 0
          ? 'source needs attention'
          : `${exactCompleteCount}/${guide.tasks.length}`}
      </span>
      <button
        className="shrink-0 rounded border border-amber/50 px-2 py-1 text-[11px] text-amber hover:bg-amber/5 disabled:opacity-50"
        data-testid="next-action-button"
        disabled={sourceApplying}
        onClick={action}
      >
        {button}
      </button>
    </section>
  );
}
