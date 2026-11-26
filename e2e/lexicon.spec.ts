import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, STORAGE_KEY, startGame } from './helpers';

/** Decision D25: the Lexicon over Home and the board, back to where we were, ticks saved apart. */

const LEXICON_KEY = 'silva.lexicon.v1';
const lexicon = (page: Page) => page.getByRole('heading', { level: 1, name: 'Lexicon' });
/** Computed transform of an element (string: the e2e tsconfig has no DOM lib). */
const OPEN_CARD_TRANSFORM =
  'getComputedStyle(document.querySelector(\'li:has(button[aria-expanded="true"])\')).transform';
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

test('Home → Lexicon → ‹ back to Home; How to play stays coming soon', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^How to play/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Lexicon', exact: true }).click();
  await expect(lexicon(page)).toBeVisible();
  await expect(page.getByText('Basic concepts')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: APP_NAME })).toBeVisible();
});

test('board menu → Lexicon, tick, system back: same board, same save', async ({ page }) => {
  await startGame(page);
  const saved = await stored(page, STORAGE_KEY);
  const grid = await page.getByRole('img', { name: /^Board, turn 1\./ }).getAttribute('aria-label');

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Lexicon' }).click();
  await expect(lexicon(page)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Algorithm learned' }).click();
  await expect(page.getByText('1 / 10')).toBeVisible();

  await page.getByRole('button', { name: 'See all' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'All concepts' })).toBeVisible();
  await page.goBack();
  await expect(lexicon(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Board, turn 1\./ })).toHaveAttribute(
    'aria-label',
    grid!,
  );
  expect(await stored(page, STORAGE_KEY)).toBe(saved);

  // The tick survives a reload, the game too.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  expect(JSON.parse((await stored(page, LEXICON_KEY))!)).toEqual({
    version: 1,
    learned: ['algorithm'],
  });
});

test('the open card is tilted, and not with reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lexicon', exact: true }).click();
  const openCard = page.locator('li:has(button[aria-expanded="true"])');
  await expect(openCard).toHaveCount(1);
  expect(await page.evaluate(OPEN_CARD_TRANSFORM)).toMatch(/^matrix/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(OPEN_CARD_TRANSFORM)).toBe('none');
});

test('no horizontal scroll on a phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lexicon', exact: true }).click();
  await expect(lexicon(page)).toBeVisible();
  const overflow = await page
    .locator('main[aria-labelledby="lexicon-title"]')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
