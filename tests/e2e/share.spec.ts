import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openLesson(page: Page, lesson: number): Promise<void> {
  await page.getByTestId('activity-learn').click();
  await page.getByTestId(`lesson-nav-${lesson}`).click();
  await page.getByTestId('activity-lesson').click();
}

async function ready(page: Page, lesson = 5): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('activity-learn')).toBeVisible({ timeout: 20_000 });
  await openLesson(page, 0);
  await expect(page.getByTestId('hero-toggle')).toBeVisible();
  await page.getByTestId('hero-toggle').click();
  if (lesson !== 0) await openLesson(page, lesson);
}

async function replRun(page: Page, source: string): Promise<void> {
  let input = page.locator('[data-testid="repl-input"]:visible');
  if ((await input.count()) === 0) {
    await page.getByTestId('btn-repl').click();
    input = page.locator('[data-testid="repl-input"]:visible');
  }
  await input.fill(source);
  await input.press('Enter');
}

test('9. share link round-trip restores temperature edit + history length', async ({
  page,
  context,
}) => {
  await ready(page);
  await page.getByTestId('s5-knob').fill('2.5');
  await expect(page.getByTestId('s5-temp-value')).toHaveText('2.50');
  await replRun(page, '(shape tok-emb)');
  await replRun(page, '(+ 1 2)');

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByTestId('btn-share').click();
  const toast = page.getByTestId('toast');
  await expect(toast).toContainText('share link copied');
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain('#s=');
  await expect(toast).not.toBeVisible({ timeout: 5_000 });

  // fresh context
  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(fresh.getByTestId('s5-temp-value')).toHaveText('2.50', { timeout: 20_000 });
  let freshHistory = fresh.locator('[data-testid="repl-history"]:visible');
  if ((await freshHistory.count()) === 0) {
    await fresh.getByTestId('btn-repl').click();
    freshHistory = fresh.locator('[data-testid="repl-history"]:visible');
  }
  const history = await freshHistory.innerText();
  expect(history).toContain('(shape tok-emb)');
  expect(history).toContain('(+ 1 2)');
  await fresh.close();
});

test('10. (reset!) restores defaults', async ({ page }) => {
  await ready(page);
  await page.getByTestId('s5-knob').fill('2.5');
  await expect(page.getByTestId('s5-temp-value')).toHaveText('2.50');
  await replRun(page, '(reset!)');
  await expect(page.getByTestId('s5-temp-value')).toHaveText('0.80');
  await expect(page.getByTestId('s5-code')).toContainText('0.8');
});

test('11. mobile: no horizontal body scroll; REPL opens as a sheet; hero readable', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile project only');
  await ready(page, 0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByTestId('hero-output')).toBeVisible();
  await page.getByTestId('btn-repl').click();
  const drawer = page.getByTestId('repl-drawer');
  await expect(drawer).toBeVisible();
  const box = await drawer.boundingBox();
  const vh = page.viewportSize()?.height ?? 0;
  expect(box?.height ?? 0).toBeGreaterThan(vh * 0.3);
});
