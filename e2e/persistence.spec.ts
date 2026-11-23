import { expect, test, type Page } from '@playwright/test';

const codeLine = (page: Page) => page.getByText(/^Code \S+ · (Easy|Medium|Hard)$/);
const grid = (page: Page, turn: number) =>
  page.getByRole('img', { name: new RegExp(`^Board, turn ${turn}\\.`) });
const players = (page: Page) => page.getByRole('list', { name: 'Players' }).getByRole('listitem');

test.beforeEach(async ({ page }) => {
  // Start every test from an empty storage (cleared once, before the first load only).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
});

test('turn 2 survives a reload: same code, turn, active player and grid', async ({ page }) => {
  const code = await codeLine(page).textContent();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(players(page).nth(1)).toHaveAttribute('aria-current', 'true');
  const label = await grid(page, 2).getAttribute('aria-label');

  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  await expect(codeLine(page)).toHaveText(code!);
  await expect(grid(page, 2)).toHaveAttribute('aria-label', label!);
  await expect(players(page).nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(players(page).nth(0)).not.toHaveAttribute('aria-current', 'true');
});

test('the new board screen survives a reload', async ({ page }) => {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  const label = await grid(page, 2).getAttribute('aria-label');

  await page.reload();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
  ).toBeVisible();
  await expect(grid(page, 2)).toHaveAttribute('aria-label', label!);
  await expect(page.getByRole('button', { name: 'Start turn 2' })).toBeVisible();
});

test('the game is saved in localStorage under bgc.game.v1', async ({ page }) => {
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(players(page).nth(1)).toHaveAttribute('aria-current', 'true');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('bgc.game.v1') ?? 'null'),
  );
  expect(saved).toMatchObject({
    version: 1,
    state: { screen: 'board', game: { activePlayer: 2 } },
  });
});

test('corrupted storage falls back to a fresh game', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('bgc.game.v1', '{corrupted'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  await expect(players(page).nth(0)).toHaveAttribute('aria-current', 'true');
});
