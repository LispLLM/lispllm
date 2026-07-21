import { useAppState } from '../store/app-store';
import { setBottomOpen, setBottomTab, useWorkspaceState } from '../store/workspace-store';
import ProblemsPanel from './ProblemsPanel';
import Repl from './Repl';
import PanelInfoButton from './PanelInfoButton';

export default function BottomPanel() {
  const sourceDiagnostics = useAppState((current) => current.sourceDiagnostics);
  const bottomTab = useWorkspaceState((current) => current.bottomTab);
  return (
    <section className="flex h-full min-h-0 flex-col bg-panel" data-testid="bottom-panel">
      <div className="flex min-h-8 items-center border-b border-edge bg-chrome text-[11px] uppercase tracking-wider">
        <button
          className={`h-8 border-r border-edge px-3 ${bottomTab === 'repl' ? 'text-paper' : 'text-dim'}`}
          onClick={() => setBottomTab('repl')}
        >
          REPL
        </button>
        <button
          className={`h-8 border-r border-edge px-3 ${bottomTab === 'problems' ? 'text-paper' : 'text-dim'}`}
          onClick={() => setBottomTab('problems')}
        >
          Problems{' '}
          {sourceDiagnostics.length > 0 && (
            <span className="text-error">{sourceDiagnostics.length}</span>
          )}
        </button>
        <PanelInfoButton panel={bottomTab} />
        <span className="ml-auto px-3 text-dim">Cmd/Ctrl+J</span>
        <button
          className="h-8 px-3 text-dim hover:text-paper"
          aria-label="close bottom panel"
          onClick={() => setBottomOpen(false)}
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {bottomTab === 'repl' ? <Repl embedded /> : <ProblemsPanel />}
      </div>
    </section>
  );
}
