import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };

async function checkEnds(page: Page) {
  const svg = page.getByRole('img', { name: /^Board, turn 1\..* 8 walls\.$/ });
  await expect(svg).toBeVisible();
  const group = svg.locator('[data-testid="wall-ends"]');
  await expect(group).toHaveAttribute('aria-hidden', 'true');
  const marks = group.locator('circle');
  await expect(marks).toHaveCount(16);

  const svgBox = (await svg.boundingBox())!;
  for (let i = 0; i < 16; i++) {
    const box = (await marks.nth(i).boundingBox())!;
    expect(box.width, `mark ${i}`).toBeGreaterThan(2);
    expect(box.x, `mark ${i}`).toBeGreaterThanOrEqual(svgBox.x - 1);
    expect(box.x + box.width, `mark ${i}`).toBeLessThanOrEqual(svgBox.x + svgBox.width + 1);
  }

  // Ringed in the wall colour, 2 units wide.
  await expect(marks.first()).toHaveCSS('stroke-width', '2px');
  await expect(marks.first()).not.toHaveCSS('stroke', 'none');

  const legendMarks = page.getByRole('list', { name: 'Legend' }).locator('li').first();
  await expect(legendMarks.locator('svg circle')).toHaveCount(2);

  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);
}

test('typed code: 16 wall end marks, no horizontal scroll', async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Hard', code: 'K7F29QX' });
  await checkEnds(page);
});

test('random board: 16 wall end marks, no horizontal scroll', async ({ page }) => {
  await startGame(page, { players: 2, difficulty: 'Easy' });
  await checkEnds(page);
});

test('56D8-KRP Medium: no wall badge covers any end mark', async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Medium', code: '56D8KRP' });
  const svg = page.getByRole('img', { name: /^Board, turn 1\./ });
  await expect(svg).toBeVisible();
  const marks = svg.locator('[data-testid="wall-ends"] circle');
  const badges = svg.locator('[data-testid="wall-labels"] [data-wall-label] rect');
  await expect(marks).toHaveCount(16);
  await expect(badges).toHaveCount(8);

  const rivetBoxes = await Promise.all(
    (await marks.all()).map(async (m) => (await m.boundingBox())!),
  );
  const badgeBoxes = await Promise.all(
    (await badges.all()).map(async (b) => (await b.boundingBox())!),
  );
  const covered: string[] = [];
  rivetBoxes.forEach((r, i) => {
    badgeBoxes.forEach((b, j) => {
      const w = Math.min(r.x + r.width, b.x + b.width) - Math.max(r.x, b.x);
      const h = Math.min(r.y + r.height, b.y + b.height) - Math.max(r.y, b.y);
      if (w > 0 && h > 0) covered.push(`badge ${j} covers rivet ${i}`);
    });
  });
  expect(covered).toEqual([]);

  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);
});
