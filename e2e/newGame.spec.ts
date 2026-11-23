import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, DIFFICULTY_RADIO, openNewGame, startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };
const CODE_RE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{3}$/;

const home = (page: Page) => page.getByRole('heading', { level: 1, name: APP_NAME });
const newGameHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'New game' });
const players = (page: Page) => page.getByRole('list', { name: 'Players' }).getByRole('listitem');
const grid = (page: Page) => page.getByRole('img', { name: /^Board, turn 1\./ });
const codeBox = (page: Page) => page.getByRole('textbox', { name: 'Board code' });
const alert = (page: Page) => page.getByRole('alert');

async function codeOf(page: Page): Promise<string> {
  const text = await page.getByText(/^Code \S+ · (Easy|Medium|Hard)$/).textContent();
  return /^Code (\S+) ·/.exec(text ?? '')![1];
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
    await expect(page.getByText('Build your algorithm, reach the goal!')).toBeVisible();
    await expect(page.locator('main svg[aria-hidden="true"]')).toBeVisible();
    const menu = page.getByRole('navigation', { name: 'Main menu' }).getByRole('button');
    await expect(menu).toHaveText(['New game', /^How to play/, /^Lexicon/]);
    await expect(players(page)).toHaveCount(0);
  });

  test('How to play and Lexicon are disabled and do nothing', async ({ page }) => {
    for (const name of [/^How to play/, /^Lexicon/]) {
      const button = page.getByRole('button', { name });
      await expect(button).toBeDisabled();
      await expect(button).toContainText('(coming soon)');
      await button.click({ force: true });
      await expect(home(page)).toBeVisible();
    }
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

  test('defaults: 2 players, Medium, random board', async ({ page }) => {
    await expect(page.getByRole('radio', { name: '2', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: DIFFICULTY_RADIO.Medium })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Random board' })).toBeChecked();
    await expect(codeBox(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
    await expect(players(page)).toHaveCount(2);
    await expect(page.getByText(/^Code \S+ · Medium$/)).toBeVisible();
    expect(await codeOf(page)).toMatch(CODE_RE);
    expect(await enemyCount(page)).toBe(4);
  });

  test('entering "k7f2 9qx" starts K7F2-9QX', async ({ page }) => {
    await startGame(page, { goto: false, players: 3, difficulty: 'Easy', code: 'k7f2 9qx' });
    expect(await codeOf(page)).toBe('K7F2-9QX');
    await expect(page.getByText('Code K7F2-9QX · Easy')).toBeVisible();
  });

  for (const [input, message] of [
    ['ABC', 'Code must have 7 characters'],
    ['K7F2-0QX', 'Code contains invalid characters'],
    ['', 'Code must have 7 characters'],
  ] as const) {
    test(`invalid code ${JSON.stringify(input)} shows "${message}", keeps focus, no start`, async ({
      page,
    }) => {
      await page.getByRole('radio', { name: 'Enter a board code' }).check();
      await codeBox(page).fill(input);
      await page.getByRole('button', { name: 'Start game' }).click();
      await expect(alert(page)).toHaveText(message);
      await expect(codeBox(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(codeBox(page)).toBeFocused();
      await expect(newGameHeading(page)).toBeVisible();
      await expect(players(page)).toHaveCount(0);
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem('bgc.game.v1') ?? 'null')),
      ).toMatchObject({ state: { game: null } });
    });
  }

  test('the code is validated on blur', async ({ page }) => {
    await page.getByRole('radio', { name: 'Enter a board code' }).check();
    await codeBox(page).fill('K7F2-0QX');
    await codeBox(page).blur();
    await expect(alert(page)).toHaveText('Code contains invalid characters');
  });

  test('390x844 with the error shown: no horizontal scroll, 44 px targets, contrast', async ({
    page,
  }) => {
    await expectNoHorizontalScroll(page);
    await expectTargets(page);
    await page.getByRole('radio', { name: 'Enter a board code' }).check();
    await codeBox(page).fill('K7F2-0QX');
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alert(page)).toHaveText('Code contains invalid characters');
    await expectNoHorizontalScroll(page);
    await expectTargets(page);
    const input = (await codeBox(page).boundingBox())!;
    expect(input.height).toBeGreaterThanOrEqual(44);
    expect(input.x + input.width).toBeLessThanOrEqual(VIEWPORT.width);
    await expectContrast(page, 'button, h1, legend, label, [role="alert"]');
  });

  test('keyboard: Tab reaches the radios, arrows change them, Enter submits', async ({ page }) => {
    // Focus starts on the screen's h1 (#12); Shift+Tab reaches Back, which sits before it.
    await expect(newGameHeading(page)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Back' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: '2', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: '4', exact: true })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: DIFFICULTY_RADIO.Medium })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: DIFFICULTY_RADIO.Easy })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Random board' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Enter a board code' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(codeBox(page)).toBeFocused();
    await page.keyboard.type('k7f2-9qx');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
    await expect(players(page)).toHaveCount(4);
    await expect(page.getByText('Code K7F2-9QX · Easy')).toBeVisible();
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
    test(`${count} players + ${difficulty}: ${count} chips, code line, ${enemies} enemies`, async ({
      page,
    }) => {
      await startGame(page, { players: count, difficulty });
      await expect(players(page)).toHaveCount(count);
      await expect(page.getByText(new RegExp(`^Code \\S+ · ${difficulty}$`))).toBeVisible();
      expect(await codeOf(page)).toMatch(CODE_RE);
      expect(await enemyCount(page)).toBe(enemies);
    });
  }

  test('the same code typed in two separate runs gives the same turn-1 board', async ({
    browser,
  }) => {
    const labels: string[] = [];
    for (const code of ['K7F2-9QX', 'k7f2 9qx']) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      await startGame(page, { players: 4, difficulty: 'Medium', code });
      expect(await codeOf(page)).toBe('K7F2-9QX');
      labels.push((await grid(page).getAttribute('aria-label'))!);
      await context.close();
    }
    expect(labels[0]).toMatch(/^Board, turn 1\./);
    expect(labels[1]).toBe(labels[0]);
  });

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
    await expect(players(page)).toHaveCount(3);
    await expect(page.getByText('Code K7F2-9QX · Hard')).toBeVisible();
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
    await expect(players(page)).toHaveCount(0);
  });
});
