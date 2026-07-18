import { LESSONS, LessonDocument } from '../content/lessons';
import {
  setActiveLesson,
  setEditorFile,
  setMobilePane,
  useWorkspaceState,
} from '../store/workspace-store';

function LessonList() {
  const { activeLesson } = useWorkspaceState();
  return (
    <nav className="max-h-48 overflow-y-auto border-b border-edge py-1" aria-label="lessons">
      {LESSONS.map((lesson) => (
        <button
          key={lesson.id}
          data-testid={`lesson-nav-${lesson.id}`}
          aria-current={activeLesson === lesson.id ? 'page' : undefined}
          className={`flex min-h-7 w-full items-center gap-2 px-3 text-left text-xs ${
            activeLesson === lesson.id
              ? 'bg-paper/5 text-paper'
              : 'text-dim hover:bg-paper/5 hover:text-paper'
          }`}
          onClick={() => setActiveLesson(lesson.id)}
        >
          <span className={activeLesson === lesson.id ? 'text-amber' : 'text-dim'}>
            §{lesson.id}
          </span>
          <span className="truncate">{lesson.shortTitle}</span>
        </button>
      ))}
    </nav>
  );
}

function FilesView() {
  return (
    <div className="py-2 text-xs" data-testid="files-view">
      <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-dim">lispllm</div>
      <button
        className="flex min-h-8 w-full items-center gap-2 px-5 text-left text-paper hover:bg-paper/5"
        onClick={() => setEditorFile('model')}
      >
        <span className="text-amber">λ</span> model.lisp
      </button>
      <button
        className="flex min-h-8 w-full items-center gap-2 px-5 text-left text-paper hover:bg-paper/5"
        onClick={() => setEditorFile('kernels')}
      >
        <span className="text-[#8fb0c0]">λ</span> kernels-ref.lisp
        <span className="ml-auto text-[10px] text-dim">read only</span>
      </button>
      <div className="mt-3 px-3 py-1 text-[11px] uppercase tracking-wider text-dim">checkpoint</div>
      <div className="flex min-h-7 items-center gap-2 px-5 text-dim">
        <span>▦</span> manifest.json
      </div>
      <div className="flex min-h-7 items-center gap-2 px-5 text-dim">
        <span>▦</span> model.bin
      </div>
    </div>
  );
}

export default function LearnSidebar() {
  const { activeLesson, leftView } = useWorkspaceState();
  const lesson = LESSONS[activeLesson] ?? LESSONS[0];
  return (
    <aside className="flex h-full min-h-0 flex-col bg-panel" data-testid="left-sidebar">
      <div className="flex min-h-9 items-center border-b border-edge px-3 text-[11px] uppercase tracking-wider text-dim">
        {leftView === 'learn' ? 'Learn' : 'Explorer'}
      </div>
      {leftView === 'learn' ? (
        <>
          <LessonList />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LessonDocument lesson={lesson} />
          </div>
          <div className="grid grid-cols-2 border-t border-edge text-xs">
            <button
              className="border-r border-edge px-3 py-2 text-left text-dim hover:bg-paper/5 hover:text-paper disabled:opacity-30"
              disabled={activeLesson === 0}
              onClick={() => setActiveLesson(activeLesson - 1)}
            >
              ← Previous
            </button>
            <button
              className="px-3 py-2 text-right text-dim hover:bg-paper/5 hover:text-paper disabled:opacity-30"
              disabled={activeLesson === LESSONS.length - 1}
              onClick={() => setActiveLesson(activeLesson + 1)}
            >
              Next →
            </button>
          </div>
        </>
      ) : (
        <FilesView />
      )}
      <button
        className="hidden border-t border-edge px-3 py-2 text-left text-xs text-dim max-md:block"
        onClick={() => setMobilePane('editor')}
      >
        open editor →
      </button>
    </aside>
  );
}
