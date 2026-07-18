import { useSyncExternalStore } from 'react';

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

function load(): WorkspaceState {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<WorkspaceState>;
    return {
      ...defaults,
      ...value,
      activeLesson: Math.min(8, Math.max(0, Number(value.activeLesson ?? 0))),
      selectedNodeId: null,
    };
  } catch {
    return defaults;
  }
}

let state = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  const value: Partial<WorkspaceState> = { ...state };
  delete value.selectedNodeId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function emit(next: Partial<WorkspaceState>): void {
  state = { ...state, ...next };
  persist();
  for (const listener of listeners) listener();
}

export function getWorkspaceState(): WorkspaceState {
  return state;
}

export function useWorkspaceState(): WorkspaceState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getWorkspaceState,
    getWorkspaceState,
  );
}

export function setActiveLesson(lesson: number, updateHash = true): void {
  const activeLesson = Math.min(8, Math.max(0, lesson));
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
}

export function setEditorFile(editorFile: EditorFile): void {
  emit({ editorFile, mobilePane: 'editor' });
}

export function setPanelSize(
  panel: 'leftWidth' | 'rightWidth' | 'bottomHeight',
  value: number,
): void {
  const ranges = {
    leftWidth: [240, 520],
    rightWidth: [300, 720],
    bottomHeight: [120, 520],
  } as const;
  const [min, max] = ranges[panel];
  emit({ [panel]: Math.round(Math.min(max, Math.max(min, value))) });
}

export function setSelectedNodeId(selectedNodeId: number | null): void {
  emit({ selectedNodeId });
}
