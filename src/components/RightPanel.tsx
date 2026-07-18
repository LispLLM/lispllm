import { LESSONS } from '../content/lessons';
import { setRightOpen, setRightTab, useWorkspaceState } from '../store/workspace-store';
import EnvironmentBrowser from './EnvironmentBrowser';
import LessonLabs from './LessonLabs';
import ModelInfo from './ModelInfo';
import ReferencesView from './ReferencesView';
import TraceInspector from './TraceInspector';

const tabs = [
  ['lesson', 'Lesson'],
  ['trace', 'Trace'],
  ['environment', 'Environment'],
  ['references', 'References'],
  ['model', 'Model'],
] as const;

export default function RightPanel() {
  const { activeLesson, rightTab } = useWorkspaceState();
  const lesson = LESSONS[activeLesson] ?? LESSONS[0];
  return (
    <aside className="flex h-full min-h-0 flex-col bg-panel" data-testid="right-panel">
      <div className="flex min-h-9 items-center border-b border-edge bg-[#141311]">
        <div
          className="flex min-w-0 flex-1 overflow-x-auto"
          role="tablist"
          aria-label="output views"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={rightTab === id}
              className={`h-9 shrink-0 border-r border-edge px-3 text-[11px] ${
                rightTab === id
                  ? 'border-t-2 border-t-amber bg-panel text-paper'
                  : 'text-dim hover:text-paper'
              }`}
              onClick={() => setRightTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="h-9 shrink-0 px-3 text-dim hover:text-paper"
          aria-label="close output panel"
          onClick={() => setRightOpen(false)}
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1" role="tabpanel">
        {rightTab === 'lesson' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-edge px-3 py-1 text-[11px] text-dim">
              §{lesson.id} · {lesson.title}
            </div>
            <div className="min-h-0 flex-1">
              <LessonLabs activeLesson={activeLesson} />
            </div>
          </div>
        )}
        {rightTab === 'trace' && <TraceInspector />}
        {rightTab === 'environment' && <EnvironmentBrowser />}
        {rightTab === 'references' && <ReferencesView />}
        {rightTab === 'model' && <ModelInfo />}
      </div>
    </aside>
  );
}
