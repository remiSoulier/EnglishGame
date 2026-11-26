import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };
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

/**
 * Decision D21: the walls show only their design on the board (no W1 … W8 badge); the positions
 * list still names each physical piece with its size, to set up the real board.
 */
async function checkLabels(page: Page) {
  const svg = grid(page);
  await expect(svg).toBeVisible();
  await expect(svg.locator('[data-testid="wall-labels"], [data-wall-label]')).toHaveCount(0);
  await expect(svg.locator('[data-testid="walls"] > g')).toHaveCount(8);

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

test('typed code: walls without badges, no horizontal scroll, sized wall lines', async ({
  page,
}) => {
  await startGame(page, { players: 4, difficulty: 'Hard', code: 'K7F29QX' });
  await checkLabels(page);
});

test('random board: same checks', async ({ page }) => {
  await startGame(page, { players: 2, difficulty: 'Easy' });
  await checkLabels(page);
});
