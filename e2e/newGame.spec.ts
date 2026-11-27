import { expect, test, type Page } from '@playwright/test';
import {
  APP_NAME,
  chooseCharacters,
  DIFFICULTY_LINE,
  DIFFICULTY_RADIO,
  openNewGame,
  savedCode,
  startGame,
} from './helpers';

const VIEWPORT = { width: 390, height: 844 };
const CODE_RE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{3}$/;

const home = (page: Page) => page.getByRole('heading', { level: 1, name: APP_NAME });
const newGameHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'New game' });
/** Start cells of the positions list: one per player (D11: no player bar any more). */
const startCells = (page: Page) =>
  page.locator('dt', { hasText: /^Start:$/ }).locator('xpath=following-sibling::dd[1]');

async function expectStarts(page: Page, count: number) {
  // "P1 A1, P2 I9, …": exactly `count` players.
  const cells = Array.from({ length: count }, (_, i) => `P${i + 1} [A-I][1-9]`).join(', ');
  await expect(startCells(page)).toHaveText(new RegExp(`^${cells}$`));
  await expect(page.getByRole('list', { name: 'Players' })).toHaveCount(0);
}
const grid = (page: Page) => page.getByRole('img', { name: /^Board, turn 1\./ });

/** The game code is not shown any more (D22): read it from the save, and check it is hidden. */
async function codeOf(page: Page): Promise<string> {
  await expect(page.getByText(/Code/)).toHaveCount(0);
  return savedCode(page);
}

async function enemyCount(page: Page): Promise<number> {
  const label = (await grid(page).getAttribute('aria-label')) ?? '';
  const list = /Enem(?:y|ies) on ([^.]+)\./.exec(label)?.[1];
  return list ? list.split(', ').length : 0;
}

async function expectNoHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);
}

/** Every button and every radio label (segment) is at least 44x44 px and inside the viewport. */
async function expectTargets(page: Page) {
  const targets = page.locator('button, label:has(input[type="radio"])');
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const target = targets.nth(i);
    const name = (await target.textContent())?.trim();
    const box = await target.boundingBox();
    expect(box, `"${name}" has a box`).not.toBeNull();
    expect(box!.width, `width of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `height of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box!.x, `left of "${name}"`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `right of "${name}"`).toBeLessThanOrEqual(VIEWPORT.width);
  }
}

const CONTRAST_SCRIPT = String.raw`((selector) => {
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
  return [...document.querySelectorAll(selector)]
    .filter((el) => el.textContent.trim() !== '')
    .map((el) => {
      const l1 = lum(parse(getComputedStyle(el).color));
      const l2 = lum(bgOf(el));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return { text: el.textContent.trim(), ratio };
    });
})`;

async function expectContrast(page: Page, selector: string) {
  const ratios = await page.evaluate<{ text: string; ratio: number }[]>(
    `${CONTRAST_SCRIPT}(${JSON.stringify(selector)})`,
  );
  expect(ratios.length).toBeGreaterThan(0);
  for (const { text, ratio } of ratios) {
    expect(ratio, `contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
  }
}

test.describe('home screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a fresh visit lands on Home: logo, name, tagline, menu', async ({ page }) => {
    await expect(home(page)).toBeVisible();
    await expect(page.getByText('Program your way to the goal', { exact: true })).toBeVisible();
    await expect(page.locator('main header img[src="/silva-logo.svg"]')).toBeVisible(); // the logo
    const menu = page.getByRole('navigation', { name: 'Main menu' }).getByRole('button');
    await expect(menu).toHaveText(['New game', 'How to play', 'Lexicon']);
    await expect(startCells(page)).toHaveCount(0);
  });

  test('How to play (D28) and Lexicon (D25) are enabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Lexicon', exact: true })).toBeEnabled();
  });

  test('New game opens the new game screen, Back returns Home', async ({ page }) => {
    await openNewGame(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(home(page)).toBeVisible();
  });

  test('390x844: no horizontal scroll, 44 px targets, native buttons, contrast', async ({
    page,
  }) => {
    await expectNoHorizontalScroll(page);
    await expectTargets(page);
    const tags = await page
      .locator('[role="button"], button')
      .evaluateAll((els) => els.map((el) => el.tagName));
    expect(new Set(tags)).toEqual(new Set(['BUTTON']));
    await expectContrast(page, 'button:not(:disabled), h1, p');
  });
});

test.describe('new game screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openNewGame(page);
  });

  test('defaults: 2 players, Medium, always a random board (no board code, D22)', async ({
    page,
  }) => {
    await expect(page.getByRole('radio', { name: '2', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: DIFFICULTY_RADIO.Medium })).toBeChecked();
    await expect(page.getByRole('radio', { name: /board/i })).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    // D30: no character chosen at first; Start game waits for every player's.
    await expect(page.getByRole('button', { name: 'Start game' })).toBeDisabled();
    await chooseCharacters(page, 2);

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
    await expectStarts(page, 2);
    await expect(page.getByText('Medium', { exact: true })).toBeVisible();
    expect(await codeOf(page)).toMatch(CODE_RE);
    expect(await enemyCount(page)).toBe(4);
  });

  test('390x844: no horizontal scroll, 44 px targets, contrast', async ({ page }) => {
    await expectNoHorizontalScroll(page);
    await expectTargets(page);
    await expectContrast(page, 'button, h1, legend, label');
  });

  test('keyboard: Tab reaches the radios, arrows change them, Enter on Start game submits', async ({
    page,
  }) => {
    // Focus starts on the screen's h1 (#12); Shift+Tab reaches Back, which sits before it.
    await expect(newGameHeading(page)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Back' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: '2', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: '4', exact: true })).toBeChecked();
    // One tab stop per player's character (D19). Nothing is chosen at first (D30): Tab lands on
    // the first free character (taken ones are greyed out, D29) and Space picks it. With 4
    // players every other character is then taken: the arrows skip them and P4 keeps Gus.
    for (const [i, name] of ['Kitkat', 'Batman', 'Mushi', 'Gus'].entries()) {
      await page.keyboard.press('Tab');
      const group = page.getByRole('group', { name: `Player ${i + 1}` });
      await expect(group.getByRole('radio', { name })).toBeFocused();
      await page.keyboard.press('Space');
      await expect(group.getByRole('radio', { name })).toBeChecked();
    }
    const p4 = page.getByRole('group', { name: 'Player 4' });
    for (const name of ['Kitkat', 'Batman', 'Mushi']) {
      await expect(p4.getByRole('radio', { name })).toBeDisabled();
    }
    await page.keyboard.press('ArrowLeft');
    await expect(p4.getByRole('radio', { name: 'Gus' })).toBeChecked();
    await expect(
      page.getByRole('group', { name: 'Player 3' }).getByRole('radio', { name: 'Mushi' }),
    ).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: DIFFICULTY_RADIO.Medium })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: DIFFICULTY_RADIO.Easy })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Start game' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
    await expectStarts(page, 4);
    await expect(page.getByText('Easy', { exact: true })).toBeVisible();
  });
});

test.describe('started game', () => {
  for (const [count, difficulty, enemies] of [
    [2, 'Easy', 2],
    [3, 'Medium', 4],
    [4, 'Hard', 6],
    [3, 'Easy', 2],
    [2, 'Hard', 6],
  ] as const) {
    test(`${count} players + ${difficulty}: ${count} start cells, difficulty line, ${enemies} enemies`, async ({
      page,
    }) => {
      await startGame(page, { players: count, difficulty });
      await expectStarts(page, count);
      await expect(page.getByText(DIFFICULTY_LINE)).toHaveText(difficulty);
      expect(await codeOf(page)).toMatch(CODE_RE);
      expect(await enemyCount(page)).toBe(enemies);
    });
  }

  test('two random boards get different codes', async ({ page }) => {
    await startGame(page);
    const first = await codeOf(page);
    await page.evaluate(() => localStorage.clear());
    await startGame(page);
    expect(await codeOf(page)).not.toBe(first);
  });

  test('a started game resumes after a reload (not Home)', async ({ page }) => {
    await startGame(page, { players: 3, difficulty: 'Hard', code: 'K7F2-9QX' });
    const label = await grid(page).getAttribute('aria-label');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
    await expectStarts(page, 3);
    await expect(page.getByText(DIFFICULTY_LINE)).toHaveText('Hard');
    expect(await codeOf(page)).toBe('K7F2-9QX');
    await expect(grid(page)).toHaveAttribute('aria-label', label!);
  });

  test('reloading on the new game screen goes back to a usable new game / home screen', async ({
    page,
  }) => {
    await page.goto('/');
    await openNewGame(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      new RegExp(`^(${APP_NAME}|New game)$`),
    );
    await expect(startCells(page)).toHaveCount(0);
  });
});
