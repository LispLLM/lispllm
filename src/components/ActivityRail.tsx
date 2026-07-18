import {
  setLeftOpen,
  setLeftView,
  setMobilePane,
  setRightTab,
  useWorkspaceState,
} from '../store/workspace-store';
import { shallowEqual } from '../store/selector';

const items = [
  { id: 'learn', label: 'Learn', glyph: '◫' },
  { id: 'files', label: 'Files', glyph: '≡' },
  { id: 'lesson', label: 'Lesson output', glyph: '▷' },
  { id: 'trace', label: 'Trace', glyph: '⌘' },
  { id: 'environment', label: 'Environment', glyph: 'λ' },
  { id: 'references', label: 'References', glyph: '§' },
] as const;

export default function ActivityRail() {
  const { leftView, rightTab, mobilePane } = useWorkspaceState(
    (current) => ({
      leftView: current.leftView,
      rightTab: current.rightTab,
      mobilePane: current.mobilePane,
    }),
    shallowEqual,
  );
  return (
    <nav
      className="z-30 flex w-12 shrink-0 flex-col border-r border-edge bg-[#141311] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:h-11 max-md:w-auto max-md:flex-row max-md:border-r-0 max-md:border-t"
      aria-label="workbench views"
      data-testid="activity-rail"
    >
      {items.map((item) => {
        const active =
          item.id === 'learn' || item.id === 'files'
            ? mobilePane === 'learn' && leftView === item.id
            : mobilePane === 'output' && rightTab === item.id;
        return (
          <button
            key={item.id}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center text-lg hover:bg-paper/5 hover:text-paper max-md:h-10 max-md:flex-1 ${
              active ? 'bg-paper/5 text-paper' : 'text-dim'
            }`}
            data-testid={`activity-${item.id}`}
            aria-label={item.label}
            title={item.label}
            onClick={() => {
              if (item.id === 'learn' || item.id === 'files') {
                setLeftView(item.id);
                setLeftOpen(true);
                setMobilePane('learn');
              } else {
                setRightTab(item.id);
                setMobilePane('output');
              }
            }}
          >
            {active && (
              <span className="absolute inset-y-0 left-0 w-0.5 bg-amber max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-0.5 max-md:w-auto" />
            )}
            <span aria-hidden="true">{item.glyph}</span>
          </button>
        );
      })}
      <button
        className={`mt-auto flex h-12 w-12 items-center justify-center text-lg hover:bg-paper/5 hover:text-paper max-md:mt-0 max-md:h-10 max-md:flex-1 ${
          mobilePane === 'editor' ? 'text-paper' : 'text-dim'
        }`}
        aria-label="Editor"
        data-testid="activity-editor"
        title="Editor"
        onClick={() => setMobilePane('editor')}
      >
        <span aria-hidden="true">{'<>'}</span>
      </button>
    </nav>
  );
}
