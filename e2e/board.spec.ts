import { expect, test, type Locator, type Page } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };

function players(page: Page): Locator {
  return page.getByRole('list', { name: 'Players' }).getByRole('listitem');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows turn, code, difficulty, players, grid, legend and actions', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  await expect(page.getByText(/^Code \S+ · (Easy|Medium|Hard)$/)).toBeVisible();
  await expect(players(page)).toHaveCount(4);
  await expect(players(page).nth(0)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('img', { name: /^Board, turn 1\./ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next player' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
});

test('Next player x3 then End turn starts turn 2 with P1 active', async ({ page }) => {
  const next = page.getByRole('button', { name: 'Next player' });
  for (let i = 0; i < 3; i++) {
    await expect(players(page).nth(i)).toHaveAttribute('aria-current', 'true');
    await next.click();
  }
  await expect(players(page).nth(3)).toHaveAttribute('aria-current', 'true');
  await expect(next).toHaveCount(0);

  const endTurn = page.getByRole('button', { name: 'End turn' });
  await expect(endTurn).toBeVisible();
  await endTurn.click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
  ).toBeVisible();
  await expect(players(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Start turn 2' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Board, turn 2\./ })).toBeVisible();
  await expect(players(page).nth(0)).toHaveAttribute('aria-current', 'true');
  await expect(players(page).nth(3)).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Next player' })).toBeVisible();
});

test('menu opens, closes on Escape (focus on trigger) and on outside click', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Menu' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['New board', 'We have a winner']);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(menu).toBeVisible();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(menu).toHaveCount(0);

  await trigger.click();
  await page.getByRole('menuitem', { name: 'We have a winner' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'We have a winner' })).toBeVisible();
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

  for (const name of ['Question', 'Next player', 'Menu']) {
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
  return [...document.querySelectorAll('button, [aria-label="Players"] li')].map((el) => {
    const l1 = lum(parse(getComputedStyle(el).color));
    const l2 = lum(bgOf(el));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { text: el.textContent.trim(), ratio };
  });
})()`;

test('button and player chip text contrast is at least 4.5:1', async ({ page }) => {
  for (const open of [false, true]) {
    if (open) await page.getByRole('button', { name: 'Menu' }).click();
    const ratios = await page.evaluate<{ text: string; ratio: number }[]>(CONTRAST_SCRIPT);
    expect(ratios.length).toBeGreaterThan(0);
    for (const { text, ratio } of ratios) {
      expect(ratio, `contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
