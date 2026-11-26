import { expect, test, type Locator, type Page } from '@playwright/test';
import { APP_NAME, gameLine, startGame } from './helpers';

/** Start cells of the positions list: one per player (D11: no player bar any more). */
const startCells = (page: Page) =>
  page.locator('dt', { hasText: /^Start:$/ }).locator('xpath=following-sibling::dd[1]');
/** "P1 A1, P2 I9, …": exactly `count` players. */
const startsRe = (count: number) =>
  new RegExp(`^${Array.from({ length: count }, (_, i) => `P${i + 1} [A-I][1-9]`).join(', ')}$`);
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

async function openMenuItem(page: Page, name: 'New board' | 'End game' | 'Quit to home') {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
}

/** Asserts every visible button is a native <button> of at least `min` px high and 44 px wide. */
async function checkButtons(buttons: Locator, min = 44) {
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const name = (await button.textContent())?.trim();
    expect(await button.evaluate((el) => el.tagName), `tag of "${name}"`).toBe('BUTTON');
    const box = await button.boundingBox();
    expect(box, `"${name}" has a box`).not.toBeNull();
    expect(box!.width, `width of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `height of "${name}"`).toBeGreaterThanOrEqual(min);
  }
}

async function noHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(390);
}

/** Text contrast (WCAG) of every button, h1, h2 and p, against the first opaque background. */
const CONTRAST_SCRIPT = String.raw`(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    while (el) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.5) return c;
      el = el.parentElement;
    }
    return { r: 255, g: 255, b: 255 };
  };
  const root = document.querySelector('[role="dialog"]') ?? document;
  return [...root.querySelectorAll('button, h1, h2, p')].map((el) => {
    const l1 = lum(parse(getComputedStyle(el).color));
    const l2 = lum(bgOf(el));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { text: el.textContent.trim(), ratio };
  });
})()`;

async function checkContrast(page: Page) {
  const ratios = await page.evaluate<{ text: string; ratio: number }[]>(CONTRAST_SCRIPT);
  expect(ratios.length).toBeGreaterThan(0);
  for (const { text, ratio } of ratios) {
    expect(ratio, `contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
  }
}

/** Board state (heading, saved code and difficulty line, start cells, grid label). */
async function boardSnapshot(page: Page) {
  return {
    heading: await h1(page).textContent(),
    code: await gameLine(page),
    starts: await startCells(page).textContent(),
    grid: await page.getByRole('img', { name: /^Board, turn \d+\./ }).getAttribute('aria-label'),
  };
}

test.beforeEach(async ({ page }) => {
  // Start every test from an empty storage (cleared once, before the first load only).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
  });
});

const STORAGE_KEY = 'bgc.game.v2';
const continueButton = (page: Page) => page.getByRole('button', { name: /^Continue game/ });
const savedState = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);

/** 3-player Hard game at turn 2, one question answered; returns the board snapshot. */
async function midGame(page: Page) {
  await startGame(page, { players: 3, difficulty: 'Hard' });
  await page.getByRole('button', { name: 'Question' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Show the question' }).click();
  await page.getByRole('list', { name: 'Choices' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(h1(page)).toHaveText('Turn 2');
  return boardSnapshot(page);
}

test('the board menu lists exactly New board, Lexicon, End game, Quit to home (D13, D25)', async ({
  page,
}) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([
    'New board',
    'Lexicon',
    'End game',
    'Quit to home',
  ]);
  await expect(page.getByText(/we have a winner/i)).toHaveCount(0);
  await checkButtons(page.getByRole('menuitem'));
  await noHorizontalScroll(page);
});

test('End game: the dialog, then Home without Continue game, also after a reload', async ({
  page,
}) => {
  await midGame(page);
  await openMenuItem(page, 'End game');
  const dialog = page.getByRole('dialog', { name: 'End this game?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('End this game?');
  await expect(dialog).toContainText(
    'The game will be deleted. You will go back to the home screen.',
  );
  await expect(dialog.getByRole('button')).toHaveText(['End game', 'Cancel']);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await checkButtons(dialog.getByRole('button'));
  await noHorizontalScroll(page);
  await checkContrast(page);
  // The dialog fits in the 390 × 844 viewport.
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);

  await dialog.getByRole('button', { name: 'End game' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(h1(page)).toBeFocused();
  await expect(continueButton(page)).toHaveCount(0);
  expect(await savedState(page)).toEqual({ version: 2, state: { screen: 'home', game: null } });
  await checkButtons(page.getByRole('button'));
  await noHorizontalScroll(page);

  await page.reload();
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(continueButton(page)).toHaveCount(0);
  await expect(startCells(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByText('This will replace your current game.')).toHaveCount(0);
});

for (const how of ['Cancel', 'Escape', 'backdrop', 'system back'] as const) {
  test(`End game: ${how} keeps the exact same game`, async ({ page }) => {
    const before = await midGame(page);
    const saved = await savedState(page);
    await openMenuItem(page, 'End game');
    const dialog = page.getByRole('dialog', { name: 'End this game?' });
    await expect(dialog).toBeVisible();
    if (how === 'Cancel') await dialog.getByRole('button', { name: 'Cancel' }).click();
    else if (how === 'Escape') await page.keyboard.press('Escape');
    else if (how === 'backdrop') await page.mouse.click(195, 10);
    else await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(h1(page)).toHaveText('Turn 2');
    expect(await boardSnapshot(page)).toEqual(before);
    expect(await savedState(page)).toEqual(saved);

    // Still the same game after a reload, and End game still works.
    await page.reload();
    await expect(h1(page)).toHaveText('Turn 2');
    expect(await boardSnapshot(page)).toEqual(before);
    await openMenuItem(page, 'End game');
    await dialog.getByRole('button', { name: 'End game' }).click();
    await expect(h1(page)).toHaveText(APP_NAME);
    await expect(continueButton(page)).toHaveCount(0);
  });
}

test('a game quit to home, continued, then ended leaves no Continue game', async ({ page }) => {
  await midGame(page);
  await openMenuItem(page, 'Quit to home');
  await page.getByRole('dialog').getByRole('button', { name: 'Quit' }).click();
  await continueButton(page).click();
  await expect(h1(page)).toHaveText('Turn 2');
  await openMenuItem(page, 'End game');
  await page.getByRole('dialog').getByRole('button', { name: 'End game' }).click();
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(continueButton(page)).toHaveCount(0);
  await page.reload();
  await expect(continueButton(page)).toHaveCount(0);
});

test('a legacy save on the removed winner screen reopens on its board', async ({ page }) => {
  await startGame(page, { players: 3, difficulty: 'Easy', code: 'K7F2-9QX' });
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.state.screen = 'winner';
    saved.state.game.winner = 2;
    localStorage.setItem(key, JSON.stringify(saved));
  }, STORAGE_KEY);
  await page.reload();
  await expect(h1(page)).toHaveText('Turn 1');
  expect(await gameLine(page)).toBe('K7F2-9QX · Easy');
  await expect(page.getByText(/wins!|play again/i)).toHaveCount(0);
  await openMenuItem(page, 'End game');
  await page.getByRole('dialog').getByRole('button', { name: 'End game' }).click();
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(continueButton(page)).toHaveCount(0);
});

test('New board: Cancel and Escape keep the game, confirm starts a new board', async ({ page }) => {
  await startGame(page, { players: 2, difficulty: 'Easy' });
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  const before = await boardSnapshot(page);
  expect(before.heading).toBe('Turn 2');

  // Cancel.
  await openMenuItem(page, 'New board');
  const dialog = page.getByRole('dialog', { name: 'Start a new board?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    'The current game ends. A new board starts at turn 1 with the same players.',
  );
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await checkButtons(dialog.getByRole('button'));
  await noHorizontalScroll(page);
  await checkContrast(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await boardSnapshot(page)).toEqual(before);

  // Escape.
  await openMenuItem(page, 'New board');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await boardSnapshot(page)).toEqual(before);

  // Cancelled state survives a reload.
  await page.reload();
  await expect(h1(page)).toHaveText('Turn 2');
  expect(await boardSnapshot(page)).toEqual(before);

  // Confirm.
  await openMenuItem(page, 'New board');
  await dialog.getByRole('button', { name: 'New board' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(h1(page)).toHaveText('Turn 1');
  const code = await gameLine(page);
  expect(code).toMatch(/· Easy$/);
  expect(code).not.toBe(before.code);
  await expect(startCells(page)).toHaveText(startsRe(2));
});
