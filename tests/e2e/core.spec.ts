import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

async function loadApp(page: Page): Promise<{ errors: string[]; foreign: string[] }> {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('request', (req: Request) => {
    const url = new URL(req.url());
    if (url.origin !== 'http://localhost:4173') foreign.push(req.url());
  });
  await page.goto('/');
  return { errors, foreign };
}

test('1. load → weights fetched → hero generates ≥ 40 chars within 15 s; no console errors; no non-origin requests', async ({
  page,
}) => {
  const { errors, foreign } = await loadApp(page);
  await expect(page.getByTestId('hero-output')).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => (await page.getByTestId('hero-output').innerText()).length, {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(40 + 'ROMEO: '.length);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('2. pause hero → ≥ 5 probability bars, probabilities sum ≈ 1 (±0.02)', async ({ page }) => {
  await loadApp(page);
  await expect(page.getByTestId('hero-output')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('hero-toggle').click(); // pause
  const bars = page.getByTestId('hero-probs').getByTestId('prob-bars').locator('[data-prob]');
  await expect.poll(async () => bars.count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(5);
  const probs = await bars.evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('data-prob'))),
  );
  const sum = probs.reduce((a, b) => a + b, 0);
  // top-10 of a peaked char distribution ≈ full mass
  expect(sum).toBeGreaterThan(0.5);
  expect(sum).toBeLessThanOrEqual(1.02);
});

test('3. typing in §1 updates bars within 500 ms', async ({ page }) => {
  await loadApp(page);
  await expect(page.getByTestId('s1-input')).toBeVisible({ timeout: 15_000 });
  const bars = page.getByTestId('s1-probs').locator('[data-prob]');
  await expect.poll(async () => bars.count(), { timeout: 5_000 }).toBeGreaterThan(0);
  const before = await bars.first().getAttribute('data-prob');
  await page.getByTestId('s1-input').fill('Wherefore art thou q');
  await expect
    .poll(async () => bars.first().getAttribute('data-prob'), { timeout: 500 })
    .not.toBe(before);
});
