import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };

/** D11: no player bar, no Next player, ever. */
async function expectNoTurnOrder(page: Page) {
  await expect(page.getByRole('list', { name: 'Players' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /next player/i })).toHaveCount(0);
  await expect(page.getByText(/now playing/i)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Medium' });
});

test('shows turn, code, difficulty, grid, legend, Question and End turn', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  await expect(page.getByText(/^Code \S+ · (Easy|Medium|Hard)$/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Board, turn 1\./ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expectNoTurnOrder(page);
});

test('End turn right away starts turn 2, and can be repeated (D11)', async ({ page }) => {
  for (const turn of [2, 3]) {
    const endTurn = page.getByRole('button', { name: 'End turn' });
    await expect(endTurn).toBeVisible();
    await endTurn.click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
    ).toBeVisible();
    await expectNoTurnOrder(page);
    await page.getByRole('button', { name: `Start turn ${turn}` }).click();

    await expect(page.getByRole('heading', { level: 1, name: `Turn ${turn}` })).toBeVisible();
    await expect(
      page.getByRole('img', { name: new RegExp(`^Board, turn ${turn}\\.`) }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Question' })).toBeVisible();
    await expectNoTurnOrder(page);
  }
});

test.describe('with 2 and 3 players', () => {
  for (const players of [2, 3] as const) {
    test(`${players} players: Question and End turn, no turn order`, async ({ page }) => {
      // beforeEach already started (and saved) a 4-player game: start over from Home.
      await page.evaluate(() => localStorage.clear());
      await startGame(page, { players, difficulty: 'Easy' });
      await expect(page.getByRole('button', { name: 'Question' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
      await expectNoTurnOrder(page);
    });
  }
});

test('menu opens, closes on Escape (focus on trigger) and on outside click', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Menu' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['New board', 'End game', 'Quit to home']);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(menu).toBeVisible();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(menu).toHaveCount(0);

  await trigger.click();
  await page.getByRole('menuitem', { name: 'End game' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'End this game?' })).toBeVisible();
});

test('every button is at least 44x44 px (menu open and closed)', async ({ page }) => {
  const check = async () => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name = (await button.textContent())?.trim();
      const box = await button.boundingBox();
      expect(box, `button "${name}" has a box`).not.toBeNull();
      expect(box!.width, `width of "${name}"`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `height of "${name}"`).toBeGreaterThanOrEqual(44);
    }
  };
  await check();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await check();
});

test('all actions are native <button> elements', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  const tags = await page
    .locator('[role="button"], [role="menuitem"], button')
    .evaluateAll((els) => els.map((el) => el.tagName));
  expect(tags.length).toBeGreaterThanOrEqual(5);
  expect(new Set(tags)).toEqual(new Set(['BUTTON']));
});

test('no horizontal scroll and actions fit in the first viewport', async ({ page }) => {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);

  for (const name of ['Question', 'End turn', 'Menu']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x, `${name} left`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${name} right`).toBeLessThanOrEqual(VIEWPORT.width);
    expect(box!.y, `${name} top`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `${name} bottom`).toBeLessThanOrEqual(VIEWPORT.height);
  }
  expect(await page.evaluate<number>('window.scrollY')).toBe(0);
});

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
  return [...document.querySelectorAll('button')].map((el) => {
    const l1 = lum(parse(getComputedStyle(el).color));
    const l2 = lum(bgOf(el));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { text: el.textContent.trim(), ratio };
  });
})()`;

test('button text contrast is at least 4.5:1', async ({ page }) => {
  for (const open of [false, true]) {
    if (open) await page.getByRole('button', { name: 'Menu' }).click();
    const ratios = await page.evaluate<{ text: string; ratio: number }[]>(CONTRAST_SCRIPT);
    expect(ratios.length).toBeGreaterThan(0);
    for (const { text, ratio } of ratios) {
      expect(ratio, `contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
