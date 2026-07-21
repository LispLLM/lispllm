import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
}

async function openLearnLesson(page: Page, lesson: number): Promise<void> {
  const collapse = page.getByRole('button', { name: 'collapse repl' });
  if ((await collapse.count()) > 0 && (await collapse.isVisible())) await collapse.click();
  await page.getByTestId('activity-learn').click();
  await page.getByTestId(`lesson-nav-${lesson}`).click();
}

async function completedTasks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const value = localStorage.getItem('lispllm.learning.v1');
    return value ? ((JSON.parse(value) as { completed?: string[] }).completed ?? []) : [];
  });
}

test('19. Next action drives an observable checklist that persists', async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId('next-action')).toContainText('Watch ten characters appear');
  await page.getByTestId('next-action-button').click();
  await expect(page.getByTestId('hero-output')).toBeVisible();
  await expect.poll(() => completedTasks(page), { timeout: 10_000 }).toContain('0.watch');

  await openLearnLesson(page, 0);
  await expect(page.getByTestId('learning-task-0.watch')).toHaveAttribute('data-state', 'complete');
  await expect(page.getByTestId('next-action')).toContainText('Pause and inspect probabilities');

  await page.reload();
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
  await openLearnLesson(page, 0);
  await expect(page.getByTestId('learning-task-0.watch')).toHaveAttribute('data-state', 'complete');

  const source = await page.evaluate(async () => (await fetch('/model.lisp')).text());
  expect(source).toContain('how to read this file');
  expect(source).toContain('generate: the complete autoregressive loop');

  await page.evaluate(() => {
    localStorage.setItem(
      'lispllm.learning.v1',
      JSON.stringify({ v: 1, completed: ['0.watch', '0.pause', '0.step', '0.repl'] }),
    );
  });
  await page.reload();
  await expect(page.getByTestId('next-action')).toContainText('Lesson complete');
  await expect(page.getByTestId('next-action-button')).toHaveText('Next lesson');
  await page.getByTestId('next-action-button').click();
  await expect(page.getByTestId('next-action')).toContainText('Change the prompt');
});

test('20. Try this stages and explains a command without auto-running it', async ({ page }) => {
  await boot(page);
  await openLearnLesson(page, 1);
  await expect(page.getByTestId('try-this-1')).toContainText('Expected:');
  await page.getByTestId('try-this-stage-1').click();

  const input = page.locator('[data-testid="repl-input"]:visible');
  const history = page.locator('[data-testid="repl-history"]:visible');
  await expect(input).toHaveValue("(probs '(20 8 5))");
  await expect(input).toBeFocused();
  await expect(history).not.toContainText("(probs '(20 8 5))");

  await input.press('Enter');
  await expect(history).toContainText("(probs '(20 8 5))", { timeout: 10_000 });
  await openLearnLesson(page, 1);
  await expect(page.getByTestId('learning-task-1.repl')).toHaveAttribute('data-state', 'complete');

  await page.reload();
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
  await openLearnLesson(page, 1);
  await expect(page.getByTestId('learning-task-1.repl')).toHaveAttribute('data-state', 'complete');

  await openLearnLesson(page, 7);
  await page.getByTestId('activity-lesson').click();
  await page.getByTestId('s7-examples').getByRole('button').first().click();
  const exampleInput = page.locator('[data-testid="repl-input"]:visible');
  const exampleHistory = page.locator('[data-testid="repl-history"]:visible');
  await expect(exampleInput).toHaveValue(/^\(define \(gelu x\)/);
  await expect(exampleHistory).not.toContainText('(define (gelu x)');
  await exampleInput.press('Enter');
  await expect(exampleHistory).toContainText('(define (gelu x)', { timeout: 10_000 });
  await openLearnLesson(page, 7);
  await expect(page.getByTestId('learning-task-7.example')).toHaveAttribute(
    'data-state',
    'complete',
  );
});

test('21. panel info opens by click, stays in the viewport, and restores focus', async ({
  page,
}) => {
  await boot(page);
  const learnInfo = page.getByTestId('panel-info-learn');
  await learnInfo.hover();
  await expect(page.getByTestId('panel-info-learn-content')).toBeVisible();
  const initialViewport = page.viewportSize()!;
  await page.mouse.move(initialViewport.width - 1, initialViewport.height - 1);
  await expect(page.getByTestId('panel-info-learn-content')).not.toBeVisible();
  await learnInfo.click();
  const learnContent = page.getByTestId('panel-info-learn-content');
  await expect(learnContent).toContainText('checklist records real interactions');
  const box = await learnContent.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  await page.keyboard.press('Escape');
  await expect(learnContent).not.toBeVisible();
  await expect(learnInfo).toBeFocused();

  await page.getByTestId('activity-lesson').click();
  const lessonInfo = page.getByTestId('panel-info-lesson');
  await lessonInfo.click();
  await expect(page.getByTestId('panel-info-lesson-content')).toContainText(
    'live experiment for the selected lesson',
  );
});

test('22. preset and custom accents persist, stay share-local, and reset safely', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page);
  await page.getByTestId('btn-accent').click();
  await page.getByTestId('accent-cyan').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      ),
    )
    .toBe('#55c7d9');
  await expect(page.getByTestId('status-bar')).toHaveCSS('background-color', 'rgb(85, 199, 217)');
  await expect(page.getByTestId('status-bar')).toHaveCSS('color', 'rgb(15, 14, 12)');
  await expect(page.getByTestId('activity-learn').locator('.bg-amber')).toHaveCSS(
    'background-color',
    'rgb(85, 199, 217)',
  );
  await expect(page.getByTestId('next-action').locator('.text-amber').first()).toHaveCSS(
    'color',
    'rgb(85, 199, 217)',
  );

  await page.reload();
  await expect(page.getByTestId('btn-accent')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    ),
  ).toBe('#55c7d9');
  await page.getByTestId('btn-accent').click();
  await expect(page.getByTestId('accent-cyan')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('accent-custom').fill('#000000');
  await expect(page.getByTestId('accent-custom')).toHaveValue('#000000');
  const adjusted = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  );
  expect(adjusted).not.toBe('#000000');

  await page.reload();
  await expect(page.getByTestId('btn-accent')).toBeVisible({ timeout: 20_000 });
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    ),
  ).toBe(adjusted);
  await page.getByTestId('btn-share').click();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  const payload = Buffer.from(new URL(sharedUrl).hash.slice(3), 'base64url').toString('utf8');
  expect(payload).not.toContain('#000000');
  expect(payload).not.toContain('theme');

  await page.getByTestId('btn-accent').click();
  await page.getByRole('button', { name: 'Reset to Amber' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      ),
    )
    .toBe('#e6a23c');

  await page.evaluate(() => {
    localStorage.setItem('lispllm.theme.v1', JSON.stringify({ v: 1, accent: '#55c7d9' }));
  });
  await page.reload();
  await expect(page.getByTestId('btn-accent')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    ),
  ).toBe('#55c7d9');

  await page.evaluate(() => {
    localStorage.setItem(
      'lispllm.theme.v1',
      JSON.stringify({ v: 2, accent: 'not-a-color', mode: 'sepia' }),
    );
  });
  await page.reload();
  await expect(page.getByTestId('btn-accent')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    ),
  ).toBe('#e6a23c');
});

test('23. light mode themes the workbench and editor, persists, and switches back', async ({
  page,
}) => {
  await boot(page);
  await page.getByTestId('btn-accent').click();
  await page.getByTestId('theme-light').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');
  const light = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (selector: string, property: 'backgroundColor' | 'color') => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element)[property] : null;
    };
    return {
      accentChannels: root.getPropertyValue('--accent-rgb').trim(),
      foregroundChannels: root.getPropertyValue('--accent-foreground-rgb').trim(),
      colorScheme: root.colorScheme,
      body: getComputedStyle(document.body).backgroundColor,
      chrome: read('header', 'backgroundColor'),
      panel: read('[data-testid="accent-picker"]', 'backgroundColor'),
      statusBackground: read('[data-testid="status-bar"]', 'backgroundColor'),
      statusColor: read('[data-testid="status-bar"]', 'color'),
      rail: read('[data-testid="activity-learn"] .bg-amber', 'backgroundColor'),
      meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      stored: JSON.parse(localStorage.getItem('lispllm.theme.v1') ?? '{}') as unknown,
    };
  });
  const rgb = (channels: string) => `rgb(${channels.split(/\s+/).join(', ')})`;
  expect(light).toMatchObject({
    colorScheme: 'light',
    body: 'rgb(248, 246, 242)',
    chrome: 'rgb(238, 233, 225)',
    panel: 'rgb(255, 253, 248)',
    meta: '#eee9e1',
    stored: { v: 2, mode: 'light', accent: '#e6a23c' },
  });
  expect(light.statusBackground).toBe(rgb(light.accentChannels));
  expect(light.statusColor).toBe(rgb(light.foregroundChannels));
  expect(light.rail).toBe(rgb(light.accentChannels));

  await page.getByTestId('activity-editor').click();
  const editor = page.getByTestId('source-editor');
  await expect(editor).toBeVisible();
  await expect(editor.locator('.cm-editor')).toHaveCSS('background-color', 'rgb(248, 246, 242)');
  await expect(editor.locator('.cm-gutters')).toHaveCSS('background-color', 'rgb(255, 253, 248)');

  await page.reload();
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('btn-accent').click();
  await expect(page.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(15, 14, 12)');
  await page.getByTestId('activity-editor').click();
  await expect(page.getByTestId('source-editor').locator('.cm-editor')).toHaveCSS(
    'background-color',
    'rgb(15, 14, 12)',
  );
});

test('24. visible resize grips drag, persist, and double-click reset', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop layout only');
  await boot(page);
  const handle = page.getByRole('separator', { name: 'resize learn sidebar' });
  await expect(handle).toBeVisible();
  const start = Number(await handle.getAttribute('aria-valuenow'));
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 56, box!.y + box!.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', String(start + 56));

  await page.reload();
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
  const restored = page.getByRole('separator', { name: 'resize learn sidebar' });
  await expect(restored).toHaveAttribute('aria-valuenow', String(start + 56));
  await restored.dblclick();
  await expect(restored).toHaveAttribute('aria-valuenow', '340');

  await page.setViewportSize({ width: 900, height: 720 });
  const editorBox = await page.getByRole('region', { name: 'source editor' }).boundingBox();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.width).toBeGreaterThanOrEqual(290);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('separator', { name: 'resize learn sidebar' })).toHaveAttribute(
    'aria-valuenow',
    '340',
  );
});

test('25. every desktop content-panel header exposes contextual help', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop panel set');
  await boot(page);

  const expectHelp = async (panel: string, text: string) => {
    await page.getByTestId(`panel-info-${panel}`).click();
    await expect(page.getByTestId(`panel-info-${panel}-content`)).toContainText(text);
    await page.keyboard.press('Escape');
  };

  await page.getByTestId('activity-files').click();
  await expectHelp('files', 'complete editable model');
  await page.getByTestId('file-model').click();
  await expectHelp('editor', 'complete running model source');
  await page.getByTestId('activity-files').click();
  await page.getByTestId('file-kernels').click();
  await expectHelp('kernels', 'pure-Lisp definitions');

  await page.getByTestId('activity-lesson').click();
  await expectHelp('lesson', 'live experiment');
  for (const [tab, panel, text] of [
    ['Trace', 'trace', 'evaluated Lisp syntax tree'],
    ['Environment', 'environment', 'every live binding'],
    ['References', 'references', 'papers, historical sources'],
    ['Model', 'model', 'dimensions and counts'],
  ] as const) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expectHelp(panel, text);
  }

  const bottom = page.getByTestId('bottom-panel');
  await bottom.getByRole('button', { name: 'REPL', exact: true }).click();
  await expectHelp('repl', 'one live model environment');
  await bottom.getByRole('button', { name: 'Problems', exact: true }).click();
  await expectHelp('problems', 'model-contract diagnostics');
});

test('25. the final lesson action continues into the Playground', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    localStorage.setItem(
      'lispllm.learning.v1',
      JSON.stringify({ v: 1, completed: ['8.model', '8.repl'] }),
    );
  });
  await page.evaluate(() => history.replaceState(null, '', '#sec-8'));
  await page.reload();
  await expect(page.getByTestId('next-action')).toContainText('Continue in the playground');
  await expect(page.getByTestId('next-action-button')).toHaveText('Open playground');
  await page.getByTestId('next-action-button').click();
  await expect(page.getByTestId('s7-examples')).toBeVisible();
  await expect.poll(() => completedTasks(page)).toContain('8.explore');
});
