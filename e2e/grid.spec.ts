import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

test('shows the board grid without horizontal scroll at 390 px', async ({ page }) => {
  await startGame(page);
  const grid = page.getByRole('img', { name: /^Board, turn \d+\./ });
  await expect(grid).toBeVisible();

  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.width).toBeGreaterThan(300);

  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test('shows the legend with all four symbols', async ({ page }) => {
  await startGame(page);
  const legend = page.getByRole('list', { name: 'Legend' });
  await expect(legend).toBeVisible();
  const items = legend.getByRole('listitem');
  await expect(items).toHaveCount(4);
  for (const [i, label] of ['Wall', 'Enemy', 'Goal', 'Start'].entries()) {
    await expect(items.nth(i)).toContainText(label);
  }
});
