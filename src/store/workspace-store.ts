import { useExternalStoreSelector } from './selector';
import type { EqualityFn } from './selector';
import { recordLearningEvent } from './learning-store';

export type LeftView = 'learn' | 'files';
export type RightTab = 'lesson' | 'trace' | 'environment' | 'references' | 'model';
export type BottomTab = 'repl' | 'problems';
export type MobilePane = 'learn' | 'editor' | 'output';
export type EditorFile = 'model' | 'kernels';

export interface WorkspaceState {
  activeLesson: number;
  leftView: LeftView;
  rightTab: RightTab;
  bottomTab: BottomTab;
  bottomOpen: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  mobilePane: MobilePane;
  editorFile: EditorFile;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  selectedNodeId: number | null;
}

const STORAGE_KEY = 'lispllm.workspace.v1';
const PANEL_RANGES = {
  leftWidth: [240, 520],
  rightWidth: [300, 720],
  bottomHeight: [120, 520],
} as const;
const defaults: WorkspaceState = {
  activeLesson: 0,
  leftView: 'learn',
  rightTab: 'lesson',
  bottomTab: 'repl',
  bottomOpen: true,
  leftOpen: true,
  rightOpen: true,
  mobilePane: 'learn',
  editorFile: 'model',
  leftWidth: 340,
  rightWidth: 420,
  bottomHeight: 240,
  selectedNodeId: null,
};

function finiteInRange(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number))) : fallback;
}

export function fitPanelWidths(
  viewportWidth: number,
  leftOpen: boolean,
  rightOpen: boolean,
  requestedLeft: number,
  requestedRight: number,
): { left: number; right: number; leftMax: number; rightMax: number; editorFloor: number } {
  const leftMin = PANEL_RANGES.leftWidth[0];
  const rightMin = PANEL_RANGES.rightWidth[0];
  const leftRequested = finiteInRange(requestedLeft, defaults.leftWidth, ...PANEL_RANGES.leftWidth);
  const rightRequested = finiteInRange(
    requestedRight,
    defaults.rightWidth,
    ...PANEL_RANGES.rightWidth,
  );
  const fixedWidth = 48 + Number(leftOpen) * 8 + Number(rightOpen) * 8;
  const minimumSides = (leftOpen ? leftMin : 0) + (rightOpen ? rightMin : 0);
  const editorFloor = Math.max(
    120,
    Math.min(320, Math.max(0, viewportWidth - fixedWidth - minimumSides)),
  );
  const sideBudget = Math.max(minimumSides, viewportWidth - fixedWidth - editorFloor);

  let left = leftOpen ? leftRequested : 0;
  let right = rightOpen ? rightRequested : 0;
  const overflow = Math.max(0, left + right - sideBudget);
  if (overflow > 0) {
    const leftCapacity = leftOpen ? left - leftMin : 0;
    const rightCapacity = rightOpen ? right - rightMin : 0;
    const totalCapacity = leftCapacity + rightCapacity;
    if (totalCapacity > 0) {
      const leftReduction = Math.min(leftCapacity, (overflow * leftCapacity) / totalCapacity);
      left -= leftReduction;
      right -= Math.min(rightCapacity, overflow - leftReduction);
    }
  }

  const fittedLeft = Math.round(left);
  const fittedRight = Math.round(right);
  const leftMax = leftOpen
    ? Math.min(
        PANEL_RANGES.leftWidth[1],
        Math.max(fittedLeft, Math.floor(sideBudget - (rightOpen ? fittedRight : 0))),
      )
    : PANEL_RANGES.leftWidth[1];
  const rightMax = rightOpen
    ? Math.min(
        PANEL_RANGES.rightWidth[1],
        Math.max(fittedRight, Math.floor(sideBudget - (leftOpen ? fittedLeft : 0))),
      )
    : PANEL_RANGES.rightWidth[1];

  return {
    left: fittedLeft,
    right: fittedRight,
    leftMax,
    rightMax,
    editorFloor,
  };
}

function load(): WorkspaceState {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<WorkspaceState>;
    return {
      ...defaults,
      ...value,
      activeLesson: finiteInRange(value.activeLesson, defaults.activeLesson, 0, 8),
      leftWidth: finiteInRange(value.leftWidth, defaults.leftWidth, ...PANEL_RANGES.leftWidth),
      rightWidth: finiteInRange(value.rightWidth, defaults.rightWidth, ...PANEL_RANGES.rightWidth),
      bottomHeight: finiteInRange(
        value.bottomHeight,
        defaults.bottomHeight,
        ...PANEL_RANGES.bottomHeight,
      ),
      selectedNodeId: null,
    };
  } catch {
    return defaults;
  }
}

let state = load();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  const value: Partial<WorkspaceState> = { ...state };
  delete value.selectedNodeId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist();
  }, 120);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (!persistTimer) return;
    clearTimeout(persistTimer);
    persistTimer = null;
    persist();
  });
}

function emit(next: Partial<WorkspaceState>): void {
  const entries = Object.entries(next) as Array<
    [keyof WorkspaceState, WorkspaceState[keyof WorkspaceState]]
  >;
  if (entries.every(([key, value]) => Object.is(state[key], value))) return;
  state = { ...state, ...next };
  if (entries.some(([key]) => key !== 'selectedNodeId')) schedulePersist();
  for (const listener of listeners) listener();
}

export function getWorkspaceState(): WorkspaceState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkspaceState<Selection = WorkspaceState>(
  selector: (current: WorkspaceState) => Selection = (current) => current as unknown as Selection,
  isEqual: EqualityFn<Selection> = Object.is,
): Selection {
  return useExternalStoreSelector(subscribe, getWorkspaceState, selector, isEqual);
}

export function setActiveLesson(lesson: number, updateHash = true): void {
  const activeLesson = Math.min(8, Math.max(0, lesson));
  if (state.activeLesson === 8 && activeLesson === 7) {
    recordLearningEvent('exploration:continued');
  }
  emit({ activeLesson, leftView: 'learn', rightTab: 'lesson' });
  if (updateHash && typeof history !== 'undefined') {
    history.replaceState(null, '', `#sec-${activeLesson}`);
  }
}

export function setLeftView(leftView: LeftView): void {
  emit({ leftView, leftOpen: true });
}

export function setRightTab(rightTab: RightTab): void {
  emit({ rightTab, rightOpen: true, mobilePane: 'output' });
}

export function setBottomTab(bottomTab: BottomTab): void {
  emit({ bottomTab, bottomOpen: true });
}

export function setBottomOpen(bottomOpen: boolean): void {
  emit({ bottomOpen });
}

export function setLeftOpen(leftOpen: boolean): void {
  emit({ leftOpen });
}

export function setRightOpen(rightOpen: boolean): void {
  emit({ rightOpen });
}

export function setMobilePane(mobilePane: MobilePane): void {
  emit({ mobilePane });
  if (mobilePane === 'editor' && state.editorFile === 'model') {
    recordLearningEvent('whole-model:opened');
  }
}

export function setEditorFile(editorFile: EditorFile): void {
  emit({ editorFile, mobilePane: 'editor' });
  if (editorFile === 'model') recordLearningEvent('whole-model:opened');
}

export function setPanelSize(
  panel: 'leftWidth' | 'rightWidth' | 'bottomHeight',
  value: number,
): void {
  const [min, max] = PANEL_RANGES[panel];
  emit({ [panel]: Math.round(Math.min(max, Math.max(min, value))) });
}

export function resetPanelSize(panel: 'leftWidth' | 'rightWidth' | 'bottomHeight'): void {
  emit({ [panel]: defaults[panel] });
}

export function setSelectedNodeId(selectedNodeId: number | null): void {
  emit({ selectedNodeId });
}
