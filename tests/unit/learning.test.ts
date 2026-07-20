import { beforeEach, describe, expect, it } from 'vitest';
import { LEARNING_GUIDES, resolveNextActionKind } from '../../src/content/learning';
import {
  getLearningState,
  recordLearningEvent,
  recordReplCommand,
  resetLearningProgress,
} from '../../src/store/learning-store';

describe('learning guidance', () => {
  beforeEach(() => resetLearningProgress());

  it('defines two to four unique observable tasks for every lesson', () => {
    expect(LEARNING_GUIDES.map((guide) => guide.lessonId)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const tasks = LEARNING_GUIDES.flatMap((guide) => guide.tasks);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);
    expect(new Set(tasks.map((task) => task.event)).size).toBe(tasks.length);
    for (const guide of LEARNING_GUIDES) {
      expect(guide.tasks.length).toBeGreaterThanOrEqual(2);
      expect(guide.tasks.length).toBeLessThanOrEqual(4);
      expect(guide.tryIt.command).toMatch(/^\(.+\)$/s);
      expect(guide.tryIt.explanation.length).toBeGreaterThan(20);
      expect(guide.tryIt.expected.length).toBeGreaterThan(20);
    }
  });

  it('records completion events idempotently and resets explicitly', () => {
    recordLearningEvent('hero:paused');
    recordLearningEvent('hero:paused');
    expect(getLearningState().completed).toEqual(['0.pause']);
    resetLearningProgress();
    expect(getLearningState().completed).toEqual([]);
  });

  it('matches normalized lesson and playground REPL commands', () => {
    recordReplCommand('  (shape   tok-emb)  ');
    expect(getLearningState().completed).toContain('2.repl');
    recordReplCommand('(set! temperature 3.0)');
    expect(getLearningState().completed).toContain('7.example');
  });

  it('prioritizes applying, diagnostics, and drafts ahead of lesson work', () => {
    const resolve = (overrides: Partial<Parameters<typeof resolveNextActionKind>[0]> = {}) =>
      resolveNextActionKind({
        sourceApplying: false,
        diagnostics: 0,
        sourceDirty: false,
        hasCurrentTask: true,
        ...overrides,
      });
    expect(resolve({ sourceApplying: true, diagnostics: 2, sourceDirty: true })).toBe('applying');
    expect(resolve({ diagnostics: 2, sourceDirty: true })).toBe('diagnostics');
    expect(resolve({ sourceDirty: true })).toBe('draft');
    expect(resolve()).toBe('task');
    expect(resolve({ hasCurrentTask: false })).toBe('complete');
  });
});
