import { LEARNING_GUIDES, PLAYGROUND_EXAMPLES, normalizeReplCommand } from '../content/learning';
import { useExternalStoreSelector } from './selector';
import type { EqualityFn } from './selector';

interface LearningState {
  completed: readonly string[];
}

const STORAGE_KEY = 'lispllm.learning.v1';
const validTaskIds = new Set(
  LEARNING_GUIDES.flatMap((guide) => guide.tasks.map((task) => task.id)),
);
const tasksByEvent = new Map<string, string[]>();
for (const guide of LEARNING_GUIDES) {
  for (const task of guide.tasks) {
    const ids = tasksByEvent.get(task.event) ?? [];
    ids.push(task.id);
    tasksByEvent.set(task.event, ids);
  }
}
const playgroundCommands = new Set(
  PLAYGROUND_EXAMPLES.map((example) => normalizeReplCommand(example.code)),
);

function load(): LearningState {
  if (typeof localStorage === 'undefined') return { completed: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as {
      v?: number;
      completed?: unknown;
    };
    if (saved.v !== 1 || !Array.isArray(saved.completed)) return { completed: [] };
    return {
      completed: saved.completed.filter(
        (value): value is string => typeof value === 'string' && validTaskIds.has(value),
      ),
    };
  } catch {
    return { completed: [] };
  }
}

let state = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, completed: state.completed }));
}

function emit(completed: readonly string[]): void {
  state = { completed };
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLearningState(): LearningState {
  return state;
}

export function useLearningState<Selection = LearningState>(
  selector: (current: LearningState) => Selection = (current) => current as unknown as Selection,
  isEqual: EqualityFn<Selection> = Object.is,
): Selection {
  return useExternalStoreSelector(subscribe, getLearningState, selector, isEqual);
}

export function completeLearningTask(taskId: string): void {
  if (!validTaskIds.has(taskId) || state.completed.includes(taskId)) return;
  emit([...state.completed, taskId]);
}

export function recordLearningEvent(event: string): void {
  for (const taskId of tasksByEvent.get(event) ?? []) completeLearningTask(taskId);
}

export function recordReplCommand(command: string): void {
  const normalized = normalizeReplCommand(command);
  recordLearningEvent(`repl:${normalized}`);
  if (playgroundCommands.has(normalized)) recordLearningEvent('playground:example-run');
}

export function resetLearningProgress(): void {
  if (state.completed.length === 0) return;
  emit([]);
}
