import { useEffect } from 'react';
import {
  getImage,
  getState,
  restoreSourceState,
  restoreState,
  setSourceText,
  useAppState,
} from './app-store';
import { sourceFingerprint } from './share';

const KEY = 'lispllm.source.v1';

interface LocalSourceState {
  v: 1;
  base: string;
  seed: number;
  customBase: boolean;
  appliedSource: string;
  sourceText: string;
  knobEdits: ReturnType<typeof getState>['knobEdits'];
  replHistory: string[];
}

export function restoreLocalSourceState(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '') as LocalSourceState;
    const state = getState();
    if (saved.v !== 1 || saved.base !== sourceFingerprint(state.bundledSource)) return false;
    const restored = saved.customBase
      ? restoreSourceState(saved.seed, saved.appliedSource, saved.replHistory)
      : (restoreState(saved.seed, saved.knobEdits, saved.replHistory), true);
    if (restored && saved.sourceText !== saved.appliedSource) setSourceText(saved.sourceText);
    return restored;
  } catch {
    return false;
  }
}

export default function PersistenceBridge() {
  const { status, seed, knobEdits, replHistory, sourceText, appliedSource, bundledSource } =
    useAppState();
  useEffect(() => {
    if (status !== 'ready' || !bundledSource) return;
    const timer = setTimeout(() => {
      const value: LocalSourceState = {
        v: 1,
        base: sourceFingerprint(bundledSource),
        seed,
        customBase: getImage().canonicalSource !== bundledSource,
        appliedSource,
        sourceText,
        knobEdits,
        replHistory,
      };
      localStorage.setItem(KEY, JSON.stringify(value));
    }, 300);
    return () => clearTimeout(timer);
  }, [status, seed, knobEdits, replHistory, sourceText, appliedSource, bundledSource]);
  return null;
}
