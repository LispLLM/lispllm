import type { LearningTarget } from '../content/learning';
import { setReplDraft, setReplOpen } from '../store/app-store';
import {
  setActiveLesson,
  setBottomOpen,
  setBottomTab,
  setEditorFile,
  setLeftOpen,
  setMobilePane,
  setRightTab,
} from '../store/workspace-store';

function revealTestId(testId?: string): void {
  if (!testId) return;
  window.setTimeout(() => {
    const candidates = document.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);
    const target = [...candidates].find((element) => element.offsetParent !== null);
    target?.scrollIntoView({ block: 'center', inline: 'nearest' });
    const focusTarget =
      target?.matches('button, input, textarea, [tabindex]') === true
        ? target
        : target?.querySelector<HTMLElement>('button, input, textarea, [tabindex]');
    focusTarget?.focus({ preventScroll: true });
  }, 80);
}

export function openReplWithDraft(command?: string): void {
  if (command !== undefined) setReplDraft(command);
  setBottomTab('repl');
  setBottomOpen(true);
  setReplOpen(true);
  window.setTimeout(() => {
    const inputs = document.querySelectorAll<HTMLTextAreaElement>('[data-testid="repl-input"]');
    [...inputs].find((input) => input.offsetParent !== null)?.focus();
  }, 80);
}

export function navigateToLearningTarget(target: LearningTarget): void {
  switch (target.pane) {
    case 'editor':
      setEditorFile('model');
      setMobilePane('editor');
      break;
    case 'repl':
      openReplWithDraft(target.draft);
      return;
    case 'trace':
    case 'environment':
    case 'model':
      setRightTab(target.pane);
      setMobilePane('output');
      break;
    case 'lesson':
      setRightTab('lesson');
      setMobilePane('output');
      break;
    case 'playground':
      setActiveLesson(7);
      setMobilePane('output');
      revealTestId(target.testId);
      return;
  }
  setLeftOpen(true);
  revealTestId(target.testId);
}
