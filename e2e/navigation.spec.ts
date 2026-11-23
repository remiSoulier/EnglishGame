import { expect, test, type Locator, type Page } from '@playwright/test';
import { APP_NAME, openNewGame, startGame } from './helpers';

/** Backlog #12 / decision D10: quit to home, continue game, system back, focus. */

const VIEWPORT = { width: 390, height: 844 };
const STORAGE_KEY = 'bgc.game.v1';

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const home = (page: Page) => page.getByRole('heading', { level: 1, name: APP_NAME });
const continueButton = (page: Page) => page.getByRole('button', { name: /^Continue game/ });
const codeLine = (page: Page) => page.getByText(/^Code \S+ · (Easy|Medium|Hard)$/);
const players = (page: Page) => page.getByRole('list', { name: 'Players' }).getByRole('listitem');
const grid = (page: Page) => page.getByRole('img', { name: /^Board, turn \d+\./ });

async function openMenuItem(page: Page, name: 'New board' | 'We have a winner' | 'Quit to home') {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
}

async function codeOf(page: Page): Promise<string> {
  return /^Code (\S+) ·/.exec((await codeLine(page).textContent()) ?? '')![1];
}

/** What identifies the game on the board screen. */
async function boardSnapshot(page: Page) {
  return {
    heading: await h1(page).textContent(),
    code: await codeLine(page).textContent(),
    grid: await grid(page).getAttribute('aria-label'),
    active: await players(page).evaluateAll((items) =>
      items.findIndex((li) => li.getAttribute('aria-current') === 'true'),
    ),
  };
}

async function savedState(page: Page): Promise<{ screen: string; game: unknown } | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return raw === null
    ? null
    : (JSON.parse(raw) as { state: { screen: string; game: unknown } }).state;
}

/** Collects uncaught page errors and console errors. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Turn 2, player 2 active, on a 3-player Medium game. */
async function midGame(page: Page) {
  await startGame(page, { players: 3, difficulty: 'Medium' });
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await page.getByRole('button', { name: 'Next player' }).click();
  await expect(players(page).nth(1)).toHaveAttribute('aria-current', 'true');
  return boardSnapshot(page);
}

async function quitToHome(page: Page) {
  await openMenuItem(page, 'Quit to home');
  await page
    .getByRole('dialog', { name: 'Quit this game?' })
    .getByRole('button', { name: 'Quit' })
    .click();
  await expect(home(page)).toBeVisible();
}

const expectH1Focused = (page: Page) => expect(h1(page)).toBeFocused();

/** Every button: native <button>, at least 44x44 px, inside the viewport. */
async function expectTargets(buttons: Locator) {
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const name = (await button.textContent())?.trim();
    expect(await button.evaluate((el) => el.tagName), `tag of "${name}"`).toBe('BUTTON');
    const box = await button.boundingBox();
    expect(box, `"${name}" has a box`).not.toBeNull();
    expect(box!.width, `width of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `height of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box!.x, `left of "${name}"`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `right of "${name}"`).toBeLessThanOrEqual(VIEWPORT.width);
  }
}

async function expectNoHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);
}

/** WCAG contrast of each element's text against its first opaque background. */
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
    .filter((el) => el.textContent.trim() !== '' && !el.closest('[inert]') && !el.disabled)
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

test.describe('quit to home and continue', () => {
  test('Cancel and Escape keep the game; Quit → Home with Continue; reload; Continue', async ({
    page,
  }) => {
    const before = await midGame(page);
    const code = await codeOf(page);

    await openMenuItem(page, 'Quit to home');
    const dialog = page.getByRole('dialog', { name: 'Quit this game?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await boardSnapshot(page)).toEqual(before);

    await openMenuItem(page, 'Quit to home');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await boardSnapshot(page)).toEqual(before);

    await quitToHome(page);
    await expectH1Focused(page);
    await expect(continueButton(page)).toContainText(`Turn 2 · ${code}`);

    await page.reload();
    await expect(home(page)).toBeVisible();
    await expect(continueButton(page)).toContainText(`Turn 2 · ${code}`);

    await continueButton(page).click();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectH1Focused(page);
    expect(await boardSnapshot(page)).toEqual(before);
  });

  test('New game warns, Back keeps the saved game, Start game replaces it', async ({ page }) => {
    const before = await midGame(page);
    const code = await codeOf(page);
    await quitToHome(page);
    const saved = await savedState(page);

    await openNewGame(page);
    await expect(page.getByText('This will replace your current game.')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(home(page)).toBeVisible();
    expect(await savedState(page)).toEqual(saved);
    await continueButton(page).click();
    expect(await boardSnapshot(page)).toEqual(before);

    await quitToHome(page);
    await startGame(page, { players: 2, difficulty: 'Easy', code: 'HJKM-NPQ', goto: false });
    await expect(codeLine(page)).toHaveText('Code HJKM-NPQ · Easy');
    expect(code).not.toBe('HJKM-NPQ');
    await expect(players(page)).toHaveCount(2);
    await quitToHome(page);
    await expect(continueButton(page)).toContainText('Turn 1 · HJKM-NPQ');
  });

  test('winner → Home clears the game (no Continue, even after a reload)', async ({ page }) => {
    await startGame(page, { players: 2 });
    await openMenuItem(page, 'We have a winner');
    await page.getByRole('button', { name: 'Player 2' }).click();
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(home(page)).toBeVisible();
    await expect(continueButton(page)).toHaveCount(0);
    await page.reload();
    await expect(home(page)).toBeVisible();
    await expect(continueButton(page)).toHaveCount(0);
  });

  test('Continue from a question in progress returns to the same question', async ({ page }) => {
    await startGame(page, { players: 2 });
    await page.getByRole('button', { name: 'Question' }).click();
    await page.getByRole('button', { name: 'Show the question' }).click();
    const question = await h1(page).textContent();
    // The question screen has no Quit: reload, then quit is only on the board. Seed home instead.
    await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      saved.state.game.lastScreen = saved.state.screen;
      saved.state.screen = 'home';
      localStorage.setItem(key, JSON.stringify(saved));
    }, STORAGE_KEY);
    await page.reload();
    await expect(home(page)).toBeVisible();
    await continueButton(page).click();
    await expect(h1(page)).toHaveText(question!);
    await expectH1Focused(page);
  });
});

test.describe('system back', () => {
  test('on New game → Home, saved game kept', async ({ page }) => {
    const errors = trackErrors(page);
    await midGame(page);
    await quitToHome(page);
    const saved = await savedState(page);
    await openNewGame(page);
    await page.goBack();
    await expect(home(page)).toBeVisible();
    await expectH1Focused(page);
    expect(await savedState(page)).toEqual(saved);
    await expect(continueButton(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('on New game without a saved game → Home', async ({ page }) => {
    await page.goto('/');
    await openNewGame(page);
    await page.goBack();
    await expect(home(page)).toBeVisible();
  });

  test('on the question popup → board, question not asked, focus on Question', async ({ page }) => {
    const before = await midGame(page);
    await page.getByRole('button', { name: 'Question' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await boardSnapshot(page)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Question' })).toBeFocused();
    const state = (await savedState(page)) as {
      screen: string;
      game: { pendingQuestion: unknown; askedQuestionIds: number[] };
    };
    expect(state.screen).toBe('board');
    expect(state.game.pendingQuestion).toBeNull();
    expect(state.game.askedQuestionIds).toEqual([]);
  });

  test('on winner step 1 → board', async ({ page }) => {
    const before = await midGame(page);
    await openMenuItem(page, 'We have a winner');
    await expect(h1(page)).toHaveText('We have a winner');
    await page.goBack();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectH1Focused(page);
    expect(await boardSnapshot(page)).toEqual(before);
  });

  for (const item of ['Quit to home', 'New board'] as const) {
    test(`with the ${item} dialog open → the dialog closes, game unchanged`, async ({ page }) => {
      const before = await midGame(page);
      const saved = await savedState(page);
      await openMenuItem(page, item);
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await boardSnapshot(page)).toEqual(before);
      expect(await savedState(page)).toEqual(saved);
      // The board still works and the dialog can be reopened.
      await openMenuItem(page, item);
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }

  test('on the board with no dialog: leaves normally, no error, game restored', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const before = await midGame(page);
    await page.goBack();
    // Either it left the app (about:blank) or the app is still there: in both cases no error.
    if (page.url().startsWith('about:')) {
      await page.goForward();
    } else {
      await page.reload();
    }
    await expect(h1(page)).toHaveText('Turn 2');
    expect(await boardSnapshot(page)).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('Home ↔ New game 5× with the in-app Back: no stale New game entry left', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(home(page)).toBeVisible();
    const start = await page.evaluate<number>('history.length');
    for (let i = 0; i < 5; i++) {
      await openNewGame(page);
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(home(page)).toBeVisible();
    }
    expect(await page.evaluate<number>('history.length')).toBeLessThanOrEqual(start + 1);
    await page.goBack();
    // Out of the app, or (if anything) on Home: never a stale New game screen.
    if (!page.url().startsWith('about:')) {
      await expect(newGameHeadingCount(page)).toHaveCount(0);
    }
  });

  test('Home ↔ New game 5× fast (no waiting): no stale New game entry left', async ({ page }) => {
    await page.goto('/');
    await expect(home(page)).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'New game' }).click();
      await page.getByRole('button', { name: 'Back' }).click();
    }
    await expect(home(page)).toBeVisible();
    // Let pending history.back() calls land.
    await page.waitForTimeout(1200);
    await expect(home(page)).toBeVisible();
    await page.goBack();
    if (!page.url().startsWith('about:')) {
      await expect(newGameHeadingCount(page)).toHaveCount(0);
    }
  });

  test('Start game from New game removes the back entry: back then leaves the board normally', async ({
    page,
  }) => {
    await page.goto('/');
    await openNewGame(page);
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    await page.waitForTimeout(300);
    await page.goBack();
    if (!page.url().startsWith('about:')) {
      // Still in the app: it must not jump back to New game or Home.
      await expect(h1(page)).toHaveText('Turn 1');
    }
  });
});

const newGameHeadingCount = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'New game' });

test.describe('focus on navigation', () => {
  test('each screen change focuses the new h1', async ({ page }) => {
    await page.goto('/');
    await openNewGame(page);
    await expectH1Focused(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(home(page)).toBeFocused();
    await openNewGame(page);
    await page.getByRole('radio', { name: '2', exact: true }).check();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    await expectH1Focused(page);

    await page.getByRole('button', { name: 'Question' }).click();
    await expect(page.getByRole('button', { name: 'Show the question' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Question' })).toBeFocused();

    await page.getByRole('button', { name: 'Question' }).click();
    await page.getByRole('button', { name: 'Show the question' }).click();
    await expectH1Focused(page);
    await page.getByRole('list', { name: 'Choices' }).getByRole('button').first().click();
    await expect(h1(page)).toHaveText(/(Correct!|Wrong answer)$/);
    await expectH1Focused(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    await expectH1Focused(page);

    await page.getByRole('button', { name: 'End turn' }).click();
    await expect(h1(page)).toHaveText('Walls and enemies have moved');
    await expectH1Focused(page);
    await page.getByRole('button', { name: 'Start turn 2' }).click();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectH1Focused(page);

    await openMenuItem(page, 'We have a winner');
    await expectH1Focused(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectH1Focused(page);

    await quitToHome(page);
    await expectH1Focused(page);
    await continueButton(page).click();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectH1Focused(page);
  });
});

test.describe('accessibility at 390 px', () => {
  test('Home with Continue game: targets ≥ 44 px, no horizontal scroll, contrast', async ({
    page,
  }) => {
    await midGame(page);
    await quitToHome(page);
    await expect(continueButton(page)).toBeVisible();
    await expectTargets(page.locator('button'));
    await expectNoHorizontalScroll(page);
    await expectContrast(page, 'button, button span, h1, p');
  });

  test('Quit dialog: targets ≥ 44 px, no horizontal scroll, contrast', async ({ page }) => {
    await midGame(page);
    await openMenuItem(page, 'Quit to home');
    const dialog = page.getByRole('dialog', { name: 'Quit this game?' });
    await expect(dialog).toBeVisible();
    await expectTargets(dialog.getByRole('button'));
    await expectNoHorizontalScroll(page);
    await expectContrast(page, '[role="dialog"] button, [role="dialog"] h2, [role="dialog"] p');
  });

  test('New game with the replace notice: no horizontal scroll, contrast', async ({ page }) => {
    await midGame(page);
    await quitToHome(page);
    await openNewGame(page);
    await expectNoHorizontalScroll(page);
    await expectTargets(page.locator('button'));
    await expectContrast(page, 'p, h1, button');
  });
});
