import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('s3-picker')).toBeVisible({ timeout: 20_000 });
  // pause the hero so background streaming doesn't interfere
  await page.getByTestId('hero-toggle').click();
}

async function replRun(page: Page, source: string): Promise<void> {
  const input = page.getByTestId('repl-input');
  if (!(await input.isVisible())) {
    await page.getByTestId('btn-repl').click();
  }
  await input.fill(source);
  await input.press('Enter');
}

test('4. §3: pick layer/head, hover a cell → exactly two token chips highlight', async ({
  page,
}) => {
  await ready(page);
  await page.getByTestId('s3-pick-1-2').click();
  const canvas = page.locator('#sec-3 canvas').first();
  await expect(canvas).toBeVisible({ timeout: 5_000 });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas box');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7, { steps: 3 });
  await expect(page.locator('[data-hl]')).toHaveCount(2);
});

test('5. drag temperature knob → literal changes in §5 and §6 AND regenerated output differs', async ({
  page,
}) => {
  await ready(page);
  await replRun(page, "(generate '(20 15) 20)");
  const history = page.getByTestId('repl-history');
  await expect(history).toContainText('(20 15');
  const before = await history.innerText();

  await page.getByTestId('s5-knob').fill('2.5');
  await expect(page.getByTestId('s5-code')).toContainText('2.5');
  await expect(page.getByTestId('s6-code')).toContainText('2.5');

  // rebuild replays history under the new temperature: same seed, different output
  await expect.poll(async () => history.innerText(), { timeout: 5_000 }).not.toBe(before);
});

test('6. toggle an ablation → REPL echoes (set! ablated …) → §4 diff updates', async ({ page }) => {
  await ready(page);
  // toggle first (on mobile the open REPL sheet would cover the grid)
  await page.getByTestId('s4-abl-0-1').click();
  await page.getByTestId('btn-repl').click();
  await expect(page.getByTestId('repl-history')).toContainText("(set! ablated '((0 . 1)))");
  await expect(page.getByTestId('s4-ppl')).toContainText('Δ', { timeout: 10_000 });
  await expect(page.getByTestId('s4-diff')).toContainText('before (all heads):');
});

test('7. REPL (define temperature 2.0) → the §5 knob moves to 2.0 (one-image proof)', async ({
  page,
}) => {
  await ready(page);
  await replRun(page, '(define temperature 2.0)');
  await expect(page.getByTestId('s5-temp-value')).toHaveText('2.00');
  await expect(page.getByTestId('s5-knob')).toHaveValue('2');
});

test('8. citation chip [1] opens references scrolled to entry 1; Esc closes and returns focus', async ({
  page,
}) => {
  await ready(page);
  const chip = page.getByTestId('cite-1').first();
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  const panel = page.getByTestId('refs-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('ref-entry-1')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(chip).toBeFocused();
});
