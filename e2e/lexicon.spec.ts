import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, STORAGE_KEY, startGame } from './helpers';

/** Decision D25: the Lexicon over Home and the board, back to where we were, ticks saved apart. */

const LEXICON_KEY = 'silva.lexicon.v1';
const lexicon = (page: Page) => page.getByRole('heading', { level: 1, name: 'Lexicon' });
/** Computed transform of an element (string: the e2e tsconfig has no DOM lib). */
const OPEN_CARD_TRANSFORM =
  'getComputedStyle(document.querySelector(\'li:has(button[aria-expanded="true"])\')).transform';
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

test('Home → Lexicon → ‹ back to Home', async ({ page }) => {
  await page.goto('/');
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

/** Decision D32: scrolling the Lexicon brings the cards one by one to the front, in detail. */
const STEP = 200;
const front = (page: Page) => page.locator('button[aria-expanded="true"]');
/** Browser-side: the Lexicon scroller and how far it has scrolled into the deck track. */
/** Browser-side: the deck's own scroller (only the deck scrolls, D33). */
const SCROLLER =
  'document.querySelector(\'main[aria-labelledby="lexicon-title"] [class*="deckScroller"]\')';
const DECK_SCROLLED = `${SCROLLER}.scrollTop`;
/** Scrolls the Lexicon to card `index` of the deck (0-based). */
const scrollToCard = (page: Page, index: number) =>
  page.evaluate(`${SCROLLER}.scrollTo({ top: ${index * STEP} })`);
/** Gap between the bottom of the front card and the top of the next card (px, < 0 = overlap). */
const FRONT_GAP = `(() => {
  const cards = Array.from(${SCROLLER}.querySelectorAll('li'));
  const li = cards.find((c) => c.querySelector('button[aria-expanded="true"]'));
  const next = cards[cards.indexOf(li) + 1];
  return next ? next.offsetTop - (li.offsetTop + li.offsetHeight) : null;
})()`;

test('scrolling the deck brings the cards one by one to the front, in their detailed view', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lexicon', exact: true }).click();
  await expect(front(page)).toHaveText(/^Algorithm/);

  // A real wheel scroll moves the deck on; the header, the stats and the section title stay put.
  const fixed = [
    page.getByRole('heading', { level: 1, name: 'Lexicon' }),
    page.getByText('Learned', { exact: true }),
    page.getByRole('button', { name: 'See all' }),
  ];
  const before = await Promise.all(fixed.map((l) => l.boundingBox()));
  await page.mouse.move(180, 600);
  await page.mouse.wheel(0, 700);
  await expect(front(page)).not.toHaveText(/^Algorithm/);
  expect(await page.evaluate(DECK_SCROLLED)).toBeGreaterThan(0);
  expect(await Promise.all(fixed.map((l) => l.boundingBox()))).toEqual(before);
  expect(
    await page.evaluate(
      'document.querySelector(\'main[aria-labelledby="lexicon-title"]\').scrollTop',
    ),
  ).toBe(0);

  await scrollToCard(page, 3);
  await expect(front(page)).toHaveText(/^Loop/);
  await expect(page.getByText('Repeat 3 times: Move forward 1', { exact: true })).toBeVisible();
  // The next cards stack under the front card without hiding its detail (18 px overlap).
  await expect.poll(() => page.evaluate(FRONT_GAP)).toBe(-18);

  await scrollToCard(page, 9);
  await expect(front(page)).toHaveText(/^Nested loop/);
  await expect(page.getByRole('heading', { level: 2, name: 'Going further' })).toBeVisible();

  // Tapping a card brings it to the front and scrolls to its place.
  await scrollToCard(page, 1);
  await expect(front(page)).toHaveText(/^Instruction/);
  await page.locator('button[aria-expanded]', { hasText: 'Bug' }).click();
  await expect(front(page)).toHaveText(/^Bug/);
  await expect.poll(() => page.evaluate(DECK_SCROLLED)).toBeCloseTo(4 * STEP, -1);
  await expect(page.getByRole('heading', { level: 2, name: 'Basic concepts' })).toBeVisible();
});
