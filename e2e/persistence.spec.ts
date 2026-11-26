import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, gameLine, startGame } from './helpers';

const grid = (page: Page, turn: number) =>
  page.getByRole('img', { name: new RegExp(`^Board, turn ${turn}\\.`) });
const KEY = 'bgc.game.v2';
const continueButton = (page: Page) => page.getByRole('button', { name: /^Continue game/ });

test.beforeEach(async ({ page }) => {
  // Start every test from an empty storage (cleared once, before the first load only).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
  });
  await startGame(page, { players: 4, difficulty: 'Medium' });
});

test('turn 2 survives a reload: same code, turn and grid', async ({ page }) => {
  const code = await gameLine(page);
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  const label = await grid(page, 2).getAttribute('aria-label');

  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  expect(await gameLine(page)).toBe(code);
  await expect(grid(page, 2)).toHaveAttribute('aria-label', label!);
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Players' })).toHaveCount(0);
});

test('the new board screen survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'End turn' }).click();
  const label = await grid(page, 2).getAttribute('aria-label');

  await page.reload();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
  ).toBeVisible();
  await expect(grid(page, 2)).toHaveAttribute('aria-label', label!);
  await expect(page.getByRole('button', { name: 'Start turn 2' })).toBeVisible();
});

test('the game is saved in localStorage under bgc.game.v2 (version 2, no activePlayer)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);
  expect(saved).toMatchObject({
    version: 2,
    state: { screen: 'board', game: { turn: 2, playerCount: 4 } },
  });
  expect(saved.state.game).not.toHaveProperty('activePlayer');
  expect(await page.evaluate(() => localStorage.getItem('bgc.game.v1'))).toBeNull();
});

test('a v1 save (with an active player) is ignored: Home, no Continue game', async ({ page }) => {
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    const v1 = {
      version: 1,
      state: { ...saved.state, game: { ...saved.state.game, activePlayer: 2 } },
    };
    localStorage.removeItem(key);
    localStorage.setItem('bgc.game.v1', JSON.stringify(v1));
  }, KEY);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: APP_NAME })).toBeVisible();
  await expect(continueButton(page)).toHaveCount(0);
  await startGame(page, { goto: false });
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
});

test('corrupted storage falls back to the home screen', async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, '{corrupted'), KEY);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: APP_NAME })).toBeVisible();
  await expect(continueButton(page)).toHaveCount(0);
  await startGame(page, { goto: false });
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
});

test('a saved game resumes after a reload', async ({ page }) => {
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question' })).toBeVisible();
});
