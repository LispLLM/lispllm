import { memo, useEffect, useRef, useState } from 'react';
import { LESSONS } from '../content/lessons';
import { useAppState } from '../store/app-store';
import {
  fitPanelWidths,
  resetPanelSize,
  setPanelSize,
  useWorkspaceState,
} from '../store/workspace-store';
import { shallowEqual } from '../store/selector';
import ActivityRail from './ActivityRail';
import BottomPanel from './BottomPanel';
import Header from './Header';
import KernelSourceView from './KernelSourceView';
import LearnSidebar from './LearnSidebar';
import NextActionBar from './NextActionBar';
import Repl from './Repl';
import ResizableHandle from './ResizableHandle';
import RightPanel from './RightPanel';
import SourceEditor from './SourceEditor';
import StatusBar from './StatusBar';

const StableHeader = memo(Header);
const StableActivityRail = memo(ActivityRail);
const StableLearnSidebar = memo(LearnSidebar);
const StableNextActionBar = memo(NextActionBar);
const StableSourceEditor = memo(SourceEditor);
const StableKernelSourceView = memo(KernelSourceView);
const StableRightPanel = memo(RightPanel);
const StableBottomPanel = memo(BottomPanel);
const StableStatusBar = memo(StatusBar);
const StableRepl = memo(Repl);

export default function Workbench() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 767px)').matches,
  );
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const { replOpen, appliedSource } = useAppState(
    (current) => ({ replOpen: current.replOpen, appliedSource: current.appliedSource }),
    shallowEqual,
  );
  const {
    activeLesson,
    editorFile,
    leftOpen,
    rightOpen,
    bottomOpen,
    mobilePane,
    leftWidth,
    rightWidth,
    bottomHeight,
  } = useWorkspaceState(
    (current) => ({
      activeLesson: current.activeLesson,
      editorFile: current.editorFile,
      leftOpen: current.leftOpen,
      rightOpen: current.rightOpen,
      bottomOpen: current.bottomOpen,
      mobilePane: current.mobilePane,
      leftWidth: current.leftWidth,
      rightWidth: current.rightWidth,
      bottomHeight: current.bottomHeight,
    }),
    shallowEqual,
  );
  const mountedMobilePanes = useRef(new Set([mobilePane]));
  if (isMobile) mountedMobilePanes.current.add(mobilePane);
  const mountEditor = !isMobile || mountedMobilePanes.current.has('editor');
  const mountOutput = !isMobile || mountedMobilePanes.current.has('output');
  const lesson = LESSONS[activeLesson] ?? LESSONS[0];
  const fittedWidths = fitPanelWidths(viewportWidth, leftOpen, rightOpen, leftWidth, rightWidth);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(media.matches);
      setViewportWidth(window.innerWidth);
    };
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div id="top" className="flex h-dvh min-h-0 flex-col overflow-hidden bg-ink pb-11 md:pb-0">
      <StableHeader />
      <StableNextActionBar />
      <main className="flex min-h-0 flex-1">
        <StableActivityRail />
        {leftOpen && (
          <>
            <div
              className={`${mobilePane === 'learn' ? 'flex' : 'hidden'} min-h-0 shrink-0 flex-col max-md:!w-full md:flex`}
              style={{ width: fittedWidths.left }}
            >
              <StableLearnSidebar />
            </div>
            <ResizableHandle
              className="hidden md:block"
              label="resize learn sidebar"
              orientation="vertical"
              value={fittedWidths.left}
              min={240}
              max={fittedWidths.leftMax}
              onChange={(value) => setPanelSize('leftWidth', value)}
              onReset={() => resetPanelSize('leftWidth')}
            />
          </>
        )}

        <div
          className={`${mobilePane === 'learn' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col md:flex`}
        >
          <div className="flex min-h-0 min-w-0 flex-1">
            {mountEditor && (
              <section
                className={`${mobilePane === 'editor' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col md:flex`}
                aria-label="source editor"
              >
                {editorFile === 'model' ? (
                  <StableSourceEditor forms={lesson.forms} />
                ) : (
                  <StableKernelSourceView />
                )}
              </section>
            )}

            {rightOpen && mountOutput && (
              <>
                <ResizableHandle
                  className="hidden md:block"
                  label="resize output panel"
                  orientation="vertical"
                  value={fittedWidths.right}
                  min={300}
                  max={fittedWidths.rightMax}
                  direction={-1}
                  onChange={(value) => setPanelSize('rightWidth', value)}
                  onReset={() => resetPanelSize('rightWidth')}
                />
                <div
                  className={`${mobilePane === 'output' ? 'flex' : 'hidden'} min-h-0 shrink-0 flex-col max-md:!w-full md:flex`}
                  style={{ width: fittedWidths.right }}
                >
                  <StableRightPanel />
                </div>
              </>
            )}
          </div>

          {bottomOpen && (
            <div className="hidden min-h-0 flex-col md:flex">
              <ResizableHandle
                label="resize bottom panel"
                orientation="horizontal"
                value={bottomHeight}
                min={120}
                max={520}
                direction={-1}
                onChange={(value) => setPanelSize('bottomHeight', value)}
                onReset={() => resetPanelSize('bottomHeight')}
              />
              <div style={{ height: bottomHeight }}>
                <StableBottomPanel />
              </div>
            </div>
          )}
        </div>
      </main>
      <StableStatusBar />
      {isMobile && replOpen && (
        <div className="md:hidden">
          <StableRepl />
        </div>
      )}
      <pre id="print-model-source" className="hidden whitespace-pre-wrap font-mono text-xs">
        {appliedSource}
      </pre>
    </div>
  );
}
