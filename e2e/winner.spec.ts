import { expect, test, type Locator, type Page } from '@playwright/test';
import { APP_NAME, startGame } from './helpers';

const codeLine = (page: Page) => page.getByText(/^Code \S+ · (Easy|Medium|Hard)$/);
const players = (page: Page) => page.getByRole('list', { name: 'Players' }).getByRole('listitem');
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

async function openMenuItem(page: Page, name: 'New board' | 'We have a winner') {
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

/** Board state shown on screen (heading, code line, active player, grid label). */
async function boardSnapshot(page: Page) {
  const current = page.locator('[aria-current="true"]');
  return {
    heading: await h1(page).textContent(),
    code: await codeLine(page).textContent(),
    active: await current.textContent(),
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

test('winner → Play again → new game; winner → Home → reload stays Home', async ({ page }) => {
  await startGame(page, { players: 3, difficulty: 'Hard' });
  const firstCode = await codeLine(page).textContent();
  expect(firstCode).toMatch(/· Hard$/);

  // A turn: P1 → P2 → P3 → End turn → Start turn 2.
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(h1(page)).toHaveText('Turn 2');

  await openMenuItem(page, 'We have a winner');
  await expect(h1(page)).toHaveText('We have a winner');
  await expect(h1(page)).toBeFocused();
  await expect(page.getByText('Who reached the goal?')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Player \d$/ })).toHaveText([
    'Player 1',
    'Player 2',
    'Player 3',
  ]);
  await checkButtons(page.getByRole('button', { name: /^Player \d$/ }), 56);
  await checkButtons(page.getByRole('button'));
  await noHorizontalScroll(page);
  await checkContrast(page);

  await page.getByRole('button', { name: 'Player 2' }).click();
  await expect(h1(page)).toHaveText('Player 2 wins!');
  await expect(h1(page)).toBeFocused();
  await checkButtons(page.getByRole('button'));
  await noHorizontalScroll(page);
  await checkContrast(page);

  // Reload on the win screen shows it again.
  await page.reload();
  await expect(h1(page)).toHaveText('Player 2 wins!');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(h1(page)).toHaveText('Turn 1');
  const newCode = await codeLine(page).textContent();
  expect(newCode).toMatch(/· Hard$/);
  expect(newCode).not.toBe(firstCode);
  await expect(players(page)).toHaveCount(3);
  await expect(players(page).nth(0)).toHaveAttribute('aria-current', 'true');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('bgc.game.v1') ?? 'null'),
  );
  expect(saved.state.game).toMatchObject({
    turn: 1,
    playerCount: 3,
    difficulty: 'hard',
    activePlayer: 1,
    askedQuestionIds: [],
    winner: null,
  });

  // Again: winner → Home → reload → Home.
  await openMenuItem(page, 'We have a winner');
  await page.getByRole('button', { name: 'Player 3' }).click();
  await expect(h1(page)).toHaveText('Player 3 wins!');
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(h1(page)).toHaveText(APP_NAME);
  await page.reload();
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(players(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
});

test('winner step Back returns to the same board', async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Medium' });
  await page.getByRole('button', { name: 'Next player' }).click();
  const before = await boardSnapshot(page);
  await openMenuItem(page, 'We have a winner');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(h1(page)).toHaveText('Turn 1');
  expect(await boardSnapshot(page)).toEqual(before);
  await expect(players(page).nth(1)).toHaveAttribute('aria-current', 'true');
});

test('New board: Cancel and Escape keep the game, confirm starts a new board', async ({ page }) => {
  await startGame(page, { players: 2, difficulty: 'Easy' });
  await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  const before = await boardSnapshot(page);
  expect(before.heading).toBe('Turn 2');

  // Cancel.
  await openMenuItem(page, 'New board');
  const dialog = page.getByRole('dialog', { name: 'Start a new board?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('The current game will end. Players keep their pawns.');
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
  const code = await codeLine(page).textContent();
  expect(code).toMatch(/· Easy$/);
  expect(code).not.toBe(before.code);
  await expect(players(page)).toHaveCount(2);
  await expect(players(page).nth(0)).toHaveAttribute('aria-current', 'true');
});
