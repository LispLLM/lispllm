/**
 * One small hand-rolled store using useSyncExternalStore (§4).
 * App state per §5: { checkpoint, seed, knobEdits, replHistory, focusString,
 * scrollSection } plus UI flags and the live trace.
 */
import { useSyncExternalStore } from 'react';
import type { Image, KnobEdit, ReplLine } from '../model/image';
import type { Trace } from '../model/trace';

export interface AppState {
  status: 'loading' | 'ready' | 'error';
  loadedBytes: number;
  totalBytes: number;
  error: string | null;
  /** bumped whenever the image is rebuilt or mutated */
  imageVersion: number;
  seed: number;
  knobEdits: KnobEdit[];
  replHistory: string[];
  transcript: ReplLine[];
  focusString: string;
  trace: Trace | null;
  replOpen: boolean;
  refsOpen: boolean;
  openRef: number | null;
  toast: string | null;
  /** set while a generation stream is running and definitions changed under it */
  staleGeneration: boolean;
}

let state: AppState = {
  status: 'loading',
  loadedBytes: 0,
  totalBytes: 0,
  error: null,
  imageVersion: 0,
  seed: 1337,
  knobEdits: [],
  replHistory: [],
  transcript: [],
  focusString: '',
  trace: null,
  replOpen: false,
  refsOpen: false,
  openRef: null,
  toast: null,
  staleGeneration: false,
};

let image: Image | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<AppState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function getImage(): Image {
  if (!image) throw new Error('image not ready');
  return image;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function setLoading(loaded: number, total: number): void {
  emit({ loadedBytes: loaded, totalBytes: total });
}

export function setImage(img: Image): void {
  image = img;
  emit({ status: 'ready', imageVersion: img.version });
}

export function setLoadError(message: string): void {
  emit({ status: 'error', error: message });
}

/** Full deterministic rebuild from (seed, knobEdits, replHistory). */
function rebuildNow(knobEdits: KnobEdit[], replHistory: string[], uiEcho?: string[]): void {
  const img = getImage();
  const transcript = img.rebuild(knobEdits, replHistory);
  // re-tag ui-originated entries
  if (uiEcho) {
    let idx = 0;
    for (const line of transcript) {
      if (line.kind === 'input') {
        if (uiEcho.includes(replHistory[idx])) line.kind = 'ui';
        idx++;
      }
    }
  }
  emit({
    knobEdits,
    replHistory,
    transcript,
    imageVersion: img.version,
    staleGeneration: true,
  });
  scheduleRetrace();
}

const uiEchoed: string[] = [];

/** REPL submission (user-typed, or UI-echoed with `;; ui:` prefix per INV-2). */
export function replSubmit(source: string, ui = false): void {
  const img = getImage();
  if (ui) uiEchoed.push(source);
  const lines = img.evalRepl(source);
  if (ui && lines.length > 0) lines[0] = { kind: 'ui', text: source };
  img.version++;
  emit({
    replHistory: [...state.replHistory, source],
    transcript: [...state.transcript, ...lines],
    imageVersion: img.version,
    staleGeneration: true,
  });
  scheduleRetrace();
}

/** Set or replace a knob edit addressed by canonical span start. */
export function applyKnobEdit(edit: KnobEdit): void {
  const rest = state.knobEdits.filter((e) => e.at !== edit.at);
  rebuildNow([...rest, edit], state.replHistory, uiEchoed);
}

export function removeKnobEdit(at: number): void {
  rebuildNow(
    state.knobEdits.filter((e) => e.at !== at),
    state.replHistory,
    uiEchoed,
  );
}

/** (reset!) — restore the initial image, clear knob edits and history. */
export function resetImage(): void {
  uiEchoed.length = 0;
  const img = getImage();
  img.rebuild([], []);
  emit({
    knobEdits: [],
    replHistory: [],
    transcript: [{ kind: 'output', text: ';; image reset to initial state' }],
    imageVersion: img.version,
    staleGeneration: true,
    toast: null,
  });
  scheduleRetrace();
}

/** Restore full state from a share link (§12.4). */
export function restoreState(seed: number, knobEdits: KnobEdit[], replHistory: string[]): void {
  const img = getImage();
  img.seed = seed;
  const transcript = img.rebuild(knobEdits, replHistory);
  emit({ seed, knobEdits, replHistory, transcript, imageVersion: img.version });
  scheduleRetrace();
}

export function setFocusString(s: string): void {
  emit({ focusString: s });
  scheduleRetrace();
}

export function clearStaleGeneration(): void {
  emit({ staleGeneration: false });
}

export function setReplOpen(open: boolean): void {
  emit({ replOpen: open });
}

export function setRefsOpen(open: boolean, ref: number | null = null): void {
  emit({ refsOpen: open, openRef: ref });
}

export function setToast(message: string | null): void {
  emit({ toast: message });
}

export function appendTranscript(lines: ReplLine[]): void {
  emit({ transcript: [...state.transcript, ...lines] });
}

// ---------------------------------------------------------------------------
// Trace scheduling: only the focus string is traced; throttled to 150 ms.
// ---------------------------------------------------------------------------

let retraceTimer: ReturnType<typeof setTimeout> | null = null;
let lastRetrace = 0;

export function scheduleRetrace(): void {
  if (!image || !state.focusString) return;
  const run = () => {
    lastRetrace = Date.now();
    retraceTimer = null;
    try {
      const trace = getImage().traceForward(state.focusString);
      emit({ trace });
    } catch (err) {
      emit({ toast: `trace failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };
  if (retraceTimer) return;
  const wait = Math.max(0, 150 - (Date.now() - lastRetrace));
  retraceTimer = setTimeout(run, wait);
}
