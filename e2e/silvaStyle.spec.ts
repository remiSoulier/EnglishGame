import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, openNewGame, startGame, waitForCardFlip } from './helpers';

/**
 * Decision D14 (SILVA style) at 390 × 844, on every screen: text contrast ≥ 4.5:1, board marks
 * ≥ 3:1, no horizontal scroll, every button ≥ 44 × 44 px (icon buttons "‹" / "☰" included).
 */

const VIEWPORT = { width: 390, height: 844 };
const STORAGE_KEY = 'bgc.game.v2';

interface RawQuestion {
  id: number;
  question: string;
  choices: Record<string, string>;
  answer: string;
}

const QUESTIONS: RawQuestion[] = JSON.parse(
  readFileSync(new URL('../src/data/questions.json', import.meta.url), 'utf8'),
);
const GRID_MAX_CHARS = 12;
const isGridQuestion = (q: RawQuestion) => {
  const values = Object.values(q.choices);
  return values.length % 2 === 0 && values.every((v) => v.length <= GRID_MAX_CHARS);
};
const GRID_QUESTION = QUESTIONS.find(isGridQuestion)!;
const LIST_QUESTION = QUESTIONS.find((q) => !isGridQuestion(q))!;

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

/**
 * Shared browser-side helpers: colour parsing, WCAG luminance, alpha compositing of the
 * backgrounds from the page down to the element, and visibility (sr-only text is skipped).
 */
const LIB = String.raw`
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  /** Opaque background behind el (its own background excluded when own is false). */
  const bgOf = (el, own = true) => {
    const layers = [];
    for (let e = own ? el : el.parentElement; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a === 1) break;
    }
    return layers.reverse().reduce((acc, c) => over(c, acc), { r: 255, g: 255, b: 255, a: 1 });
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (el.closest('[inert]') || el.closest('.sr-only')) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
`;

/** Every visible element with its own text (HTML and SVG), not disabled, with its ratio. */
const TEXT_SCRIPT = String.raw`(() => {
  ${LIB}
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join('')
      .trim();
    if (own === '' || !visible(el)) continue;
    if (el.closest('button:disabled, [aria-disabled="true"]')) continue;
    const isSvg = el instanceof SVGElement;
    const bg = isSvg ? bgOf(el.ownerSVGElement ?? el) : bgOf(el);
    const raw = parse(isSvg ? getComputedStyle(el).fill : getComputedStyle(el).color);
    if (!raw) {
      out.push({ text: own, ratio: 0 });
      continue;
    }
    out.push({ text: own, ratio: ratio(over(raw, bg), bg) });
  }
  return out;
})()`;

/** Board marks (grid + legend icons): colour of each mark against what it is drawn on. */
const MARKS_SCRIPT = String.raw`(() => {
  ${LIB}
  const MARKS = [
    ['border', 'stroke'],
    ['wall', 'stroke'],
    ['wallEnd', 'stroke'],
    ['wallBadge', 'stroke'],
    ['enemyBody', 'fill'],
    ['goal', 'fill'],
    ['start', 'stroke'],
  ];
  const out = [];
  for (const [name, prop] of MARKS) {
    for (const el of document.querySelectorAll('svg [class*="_' + name + '_"]')) {
      if (!visible(el.ownerSVGElement)) continue;
      const bg = bgOf(el.ownerSVGElement);
      const c = parse(getComputedStyle(el)[prop]);
      out.push({ mark: name, ratio: c ? ratio(over(c, bg), bg) : 0 });
    }
  }
  // The "!" on an enemy is drawn on the enemy fill.
  for (const el of document.querySelectorAll('svg [class*="_enemyMark_"], svg [class*="_enemyDot_"]')) {
    const body = el.parentElement.querySelector('[class*="_enemyBody_"]');
    const fill = parse(getComputedStyle(body).fill);
    const prop = el.matches('[class*="_enemyDot_"]') ? 'fill' : 'stroke';
    const c = parse(getComputedStyle(el)[prop]);
    out.push({ mark: 'enemy mark', ratio: c && fill ? ratio(c, fill) : 0 });
  }
  return out;
})()`;

async function expectTextContrast(page: Page, label: string) {
  const ratios = await page.evaluate<{ text: string; ratio: number }[]>(TEXT_SCRIPT);
  expect(ratios.length, `${label}: text found`).toBeGreaterThan(0);
  for (const { text, ratio } of ratios) {
    expect(ratio, `${label}: contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
  }
}

async function expectMarkContrast(page: Page, label: string, expected: string[]) {
  const ratios = await page.evaluate<{ mark: string; ratio: number }[]>(MARKS_SCRIPT);
  const seen = new Set(ratios.map((r) => r.mark));
  for (const mark of expected) expect(seen, `${label}: ${mark} drawn`).toContain(mark);
  for (const { mark, ratio } of ratios) {
    expect(ratio, `${label}: contrast of ${mark}`).toBeGreaterThanOrEqual(3);
  }
}

async function expectLayout(page: Page, label: string) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth, `${label}: no horizontal scroll`).toBeLessThanOrEqual(VIEWPORT.width);
  const buttons = page.locator('button:visible');
  const n = await buttons.count();
  expect(n, `${label}: buttons`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const button = buttons.nth(i);
    if (await button.evaluate((el) => el.closest('[inert]') !== null)) continue;
    const name = (await button.getAttribute('aria-label')) ?? (await button.innerText()).trim();
    const box = (await button.boundingBox())!;
    expect(box.width, `${label}: width of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${label}: height of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box.x, `${label}: left of "${name}"`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${label}: right of "${name}"`).toBeLessThanOrEqual(VIEWPORT.width);
  }
}

async function checkScreen(page: Page, label: string, marks: string[] = []) {
  await expectLayout(page, label);
  await expectTextContrast(page, label);
  if (marks.length > 0) await expectMarkContrast(page, label, marks);
}

const BOARD_MARKS = ['border', 'wall', 'wallEnd', 'wallBadge', 'enemyBody', 'goal', 'start'];

/** Rewrites the saved game (screen + pending question) and reloads. */
async function setPending(
  page: Page,
  screen: 'question' | 'result',
  pending: { questionId: number; cards: number; answer?: string; correct?: boolean },
) {
  await page.evaluate(
    ([key, screen, pending]) => {
      const saved = JSON.parse(localStorage.getItem(key as string)!);
      saved.state.screen = screen;
      saved.state.game.pendingQuestion = pending;
      localStorage.setItem(key as string, JSON.stringify(saved));
    },
    [STORAGE_KEY, screen, pending] as const,
  );
  await page.reload();
}

test.use({ viewport: VIEWPORT });

test('Home (dark background) and Home with Continue game', async ({ page }) => {
  await page.goto('/');
  await expect(h1(page)).toHaveText(APP_NAME);
  await checkScreen(page, 'Home');

  await startGame(page, { goto: false });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Quit to home' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByRole('button', { name: /^Continue game/ })).toBeVisible();
  await checkScreen(page, 'Home with Continue game');
});

test('New game, with its "‹" Back icon button', async ({ page }) => {
  await page.goto('/');
  await openNewGame(page);
  const back = page.getByRole('button', { name: 'Back' });
  await expect(back).toHaveText('‹Back');
  await expect(back.locator('.sr-only')).toHaveText('Back');
  await checkScreen(page, 'New game');
  await page.getByRole('radio', { name: 'Enter a board code' }).check();
  await page.getByRole('textbox', { name: 'Board code' }).fill('ZZZZ');
  await page.getByRole('button', { name: 'Start game' }).click();
  await checkScreen(page, 'New game with error');
});

test('Board: labels, legend, badges and marks; menu open; dialogs', async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Hard' });
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu.locator('.sr-only')).toHaveText('Menu');
  await checkScreen(page, 'Board', BOARD_MARKS);

  await menu.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await checkScreen(page, 'Board, menu open', BOARD_MARKS);

  for (const [item, dialogName] of [
    ['End game', /End/],
    ['Quit to home', 'Quit this game?'],
    ['New board', /board/i],
  ] as const) {
    if (!(await page.getByRole('menu').isVisible())) await menu.click();
    await page.getByRole('menuitem', { name: item }).click();
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    await checkScreen(page, `${item} dialog`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
  }
});

test('Question popup, question (grid and list) and result (correct and wrong)', async ({
  page,
}) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Question' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /^Question for [123] cards?$/ })).toBeVisible();
  await checkScreen(page, 'Question popup');
  await dialog.getByRole('button', { name: 'Show the question' }).click();
  await expect(page.getByRole('list', { name: 'Choices' })).toBeVisible();

  // Short choices: 2×2 grid (A|B on the first row).
  await setPending(page, 'question', { questionId: GRID_QUESTION.id, cards: 2 });
  await expect(h1(page)).toHaveText(GRID_QUESTION.question);
  await expect(page.getByText('For 2 cards')).toBeVisible();
  await waitForCardFlip(page);
  const gridChoices = page.getByRole('list', { name: 'Choices' }).getByRole('button');
  const [a, b] = [
    (await gridChoices.nth(0).boundingBox())!,
    (await gridChoices.nth(1).boundingBox())!,
  ];
  expect(Math.abs(a.y - b.y), 'A and B on the same row').toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x + a.width - 1);
  await checkScreen(page, 'Question (grid)');

  // Correct result.
  await page.getByRole('button', { name: new RegExp(`^${GRID_QUESTION.answer}: `) }).click();
  await expect(h1(page)).toHaveText(/Correct!$/);
  await expect(page.getByText('Draw 2 cards')).toBeVisible();
  await expect(page.getByText('from the instruction card deck')).toBeVisible();
  await expect(page.getByText('Why?', { exact: true })).toBeVisible();
  await checkScreen(page, 'Result (correct)');

  // Long choices: one column.
  await setPending(page, 'question', { questionId: LIST_QUESTION.id, cards: 1 });
  await expect(h1(page)).toHaveText(LIST_QUESTION.question);
  await waitForCardFlip(page);
  const listChoices = page.getByRole('list', { name: 'Choices' }).getByRole('button');
  const [la, lb] = [
    (await listChoices.nth(0).boundingBox())!,
    (await listChoices.nth(1).boundingBox())!,
  ];
  expect(lb.y, 'B below A').toBeGreaterThanOrEqual(la.y + la.height);
  await checkScreen(page, 'Question (list)');

  // Wrong result.
  const wrong = Object.keys(LIST_QUESTION.choices).find((k) => k !== LIST_QUESTION.answer)!;
  await page.getByRole('button', { name: new RegExp(`^${wrong}: `) }).click();
  await expect(h1(page)).toHaveText(/Wrong answer$/);
  await expect(page.getByText('No cards this time.')).toBeVisible();
  await expect(page.getByText('Why?', { exact: true })).toBeVisible();
  await checkScreen(page, 'Result (wrong)');
});

test('New board after a turn: "End of turn 1" eyebrow, marks and contrast', async ({ page }) => {
  await startGame(page, { difficulty: 'Hard' });
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(h1(page)).toHaveText('Walls and enemies have moved');
  const eyebrow = page.getByText('End of turn 1', { exact: true });
  await expect(eyebrow).toBeVisible();
  // Shown in capitals (CSS), the text itself is unchanged.
  expect(await eyebrow.innerText()).toBe('END OF TURN 1');
  await checkScreen(page, 'New board', BOARD_MARKS);
});
