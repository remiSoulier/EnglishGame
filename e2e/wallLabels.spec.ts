import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };
const IDS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
/** Expected start of each positions-list wall line (decision D12). */
const PREFIXES = [
  'W1 (88 mm): ',
  'W2 (88 mm): ',
  'W3 (132 mm): ',
  'W4 (176 mm): ',
  'W5 (44 + 44 mm): ',
  'W6 (88 + 44 mm): ',
  'W7 (88 + 88 mm): ',
  'W8 (132 + 88 mm): ',
];

function grid(page: Page) {
  return page.getByRole('img', { name: /^Board, turn 1\./ });
}

async function checkLabels(page: Page) {
  const svg = grid(page);
  await expect(svg).toBeVisible();
  const labels = svg.locator('[data-testid="wall-labels"] [data-wall-label]');
  await expect(labels).toHaveCount(8);
  const ids = await labels.evaluateAll((els) => els.map((e) => e.getAttribute('data-wall-label')));
  expect([...ids].sort()).toEqual(IDS);

  const svgBox = (await svg.boundingBox())!;
  for (const id of IDS) {
    const badge = svg.locator(`[data-wall-label="${id}"]`);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(id);
    const box = (await badge.boundingBox())!;
    expect(box.width, id).toBeGreaterThan(8);
    expect(box.x, id).toBeGreaterThanOrEqual(svgBox.x - 1);
    expect(box.x + box.width, id).toBeLessThanOrEqual(svgBox.x + svgBox.width + 1);
    expect(box.x + box.width, id).toBeLessThanOrEqual(VIEWPORT.width);
  }

  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);

  await page.getByRole('button', { name: 'Show positions' }).click();
  const id = await page
    .getByRole('button', { name: 'Hide positions' })
    .getAttribute('aria-controls');
  const lines = await page
    .locator(`[id="${id}"] dd li`)
    .evaluateAll((els) => els.map((e) => e.textContent!.trim()));
  expect(lines).toHaveLength(8);
  lines.forEach((line, i) => {
    expect(line.startsWith(PREFIXES[i]), `${line} starts with ${PREFIXES[i]}`).toBe(true);
    expect(line.slice(PREFIXES[i].length)).toMatch(/^[A-I][1-9]-[ES](, [A-I][1-9]-[ES])+$/);
  });
  const after = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(after).toBeLessThanOrEqual(VIEWPORT.width);
}

test('typed code: 8 badges W1 … W8, no horizontal scroll, sized wall lines', async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Hard', code: 'K7F29QX' });
  await checkLabels(page);
});

test('random board: same checks', async ({ page }) => {
  await startGame(page, { players: 2, difficulty: 'Easy' });
  await checkLabels(page);
});
