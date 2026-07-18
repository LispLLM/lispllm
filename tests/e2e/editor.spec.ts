import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
}

async function bundledSource(page: Page): Promise<string> {
  return page.evaluate(async () => (await fetch('/model.lisp')).text());
}

async function openEditor(page: Page): Promise<void> {
  await page.getByTestId('activity-editor').click();
  await expect(page.getByTestId('source-editor')).toBeVisible();
}

async function replaceEditorSource(page: Page, source: string): Promise<void> {
  await page.getByRole('textbox', { name: 'model.lisp source editor' }).fill(source);
}

async function copiedEditorSource(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'copy', exact: true }).click();
  return page.evaluate(() => navigator.clipboard.readText());
}

async function openLesson(page: Page, lesson: number): Promise<void> {
  await page.getByTestId('activity-learn').click();
  await page.getByTestId(`lesson-nav-${lesson}`).click();
  await page.getByTestId('activity-lesson').click();
}

test('12. editor Run and Cmd/Ctrl+Enter atomically update the live model', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop editor keyboard flow');
  await boot(page);
  const source = await bundledSource(page);
  await openEditor(page);

  await replaceEditorSource(
    page,
    source.replace('(define temperature 0.8)', '(define temperature 1.2)'),
  );
  await expect(page.getByTestId('editor-dirty')).toBeVisible();
  await expect(page.getByTestId('btn-run-source')).toBeEnabled();
  await page.getByTestId('btn-run-source').click();
  await expect(page.getByTestId('editor-dirty')).not.toBeVisible();

  await openLesson(page, 5);
  await expect(page.getByTestId('s5-temp-value')).toHaveText('1.20');

  await openEditor(page);
  await replaceEditorSource(
    page,
    source.replace('(define temperature 0.8)', '(define temperature 1.4)'),
  );
  await page.getByRole('textbox', { name: 'model.lisp source editor' }).press('Meta+Enter');
  await expect(page.getByTestId('editor-dirty')).not.toBeVisible();
  await openLesson(page, 5);
  await expect(page.getByTestId('s5-temp-value')).toHaveText('1.40');
});

test('13. syntax and contract failures preserve the last good model', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop diagnostics flow');
  await boot(page);
  const source = await bundledSource(page);
  await openEditor(page);

  await replaceEditorSource(page, `${source}\n(`);
  await expect(page.getByTestId('editor-diagnostics')).toContainText('1 problem');
  await expect(page.getByTestId('btn-run-source')).toBeDisabled();

  const invalidContract = source.replace('(define (gpt tokens)', '(define (gpt-broken tokens)');
  await replaceEditorSource(page, invalidContract);
  await expect(page.getByTestId('btn-run-source')).toBeEnabled();
  await page.getByTestId('btn-run-source').click();
  await expect(page.getByTestId('toast')).toContainText('last good model is still running');
  await expect(page.getByTestId('editor-diagnostics')).toContainText('1 problem');

  await openLesson(page, 5);
  await expect(page.getByTestId('s5-temp-value')).toHaveText('0.80');
  await openEditor(page);
  await page.getByRole('button', { name: 'revert' }).click();
  await expect(page.getByTestId('editor-diagnostics')).not.toBeVisible();
  await expect(page.getByTestId('editor-dirty')).not.toBeVisible();
});

test('14. local autosave restores an applied base plus its unvalidated draft', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop persistence flow');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page);
  const source = await bundledSource(page);
  const applied = source.replace('(define temperature 0.8)', '(define temperature 1.1)');
  const draft = source.replace('(define temperature 0.8)', '(define temperature 1.7)');
  await openEditor(page);
  await replaceEditorSource(page, applied);
  await page.getByTestId('btn-run-source').click();
  await replaceEditorSource(page, draft);
  await expect(page.getByTestId('editor-dirty')).toBeVisible();
  await page.waitForTimeout(450);

  await page.reload();
  await expect(page.getByTestId('activity-editor')).toBeVisible({ timeout: 20_000 });
  await openEditor(page);
  expect(await copiedEditorSource(page)).toContain('(define temperature 1.7)');
  await expect(page.getByTestId('editor-dirty')).toBeVisible();
  await openLesson(page, 5);
  await expect(page.getByTestId('s5-temp-value')).toHaveText('1.10');
  await expect(page.getByTestId('s5-knob')).toBeDisabled();
});

test('15. custom source shares restore exact source and workspace context', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop exact-share flow');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page);
  const source = await bundledSource(page);
  await openEditor(page);
  await replaceEditorSource(
    page,
    source.replace('(define temperature 0.8)', '(define temperature 1.3)'),
  );
  await page.getByTestId('btn-run-source').click();
  await openLesson(page, 5);
  await page.getByTestId('btn-share').click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain('#s=');
  expect(url.length).toBeLessThanOrEqual(2048);

  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(fresh.getByTestId('s5-temp-value')).toHaveText('1.30', { timeout: 20_000 });
  await openEditor(fresh);
  expect(await copiedEditorSource(fresh)).toContain('(define temperature 1.3)');
  await fresh.close();
});

test('16. trace selection links to source and separators resize by keyboard', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop inspectors and resize handles');
  await boot(page);
  await openLesson(page, 0);
  await expect(page.getByTestId('hero-output')).toBeVisible();
  await page.getByTestId('activity-trace').click();
  await expect(page.getByTestId('s7-inspector')).toContainText(/trace · [1-9]\d* recorded nodes/, {
    timeout: 10_000,
  });
  await page.getByRole('treeitem').first().locator(':scope > button').click();
  await openEditor(page);
  await expect(page.locator('.cm-trace-node').first()).toBeVisible();

  const leftHandle = page.getByRole('separator', { name: 'resize learn sidebar' });
  await leftHandle.press('End');
  await expect(leftHandle).toHaveAttribute('aria-valuenow', '520');
  const bottomHandle = page.getByRole('separator', { name: 'resize bottom panel' });
  await bottomHandle.press('Home');
  await expect(bottomHandle).toHaveAttribute('aria-valuenow', '120');
});

test('17. mobile activity navigation exposes learn, output, and editor without overflow', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile project only');
  await boot(page);
  await expect(page.getByTestId('left-sidebar')).toBeVisible();
  await openEditor(page);
  const runBox = await page.getByTestId('btn-run-source').boundingBox();
  expect((runBox?.x ?? 0) + (runBox?.width ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByTestId('activity-lesson').click();
  await expect(page.getByTestId('hero-output')).toBeVisible();
  await page.getByTestId('activity-learn').click();
  await expect(page.getByTestId('left-sidebar')).toBeVisible();
});
