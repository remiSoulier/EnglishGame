import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };

interface RawQuestion {
  id: number;
  question: string;
  choices: Record<string, string>;
  answer: string;
  explanation: string;
}

const QUESTIONS: RawQuestion[] = JSON.parse(
  readFileSync(new URL('../src/data/questions.json', import.meta.url), 'utf8'),
);

const cardsLabel = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

const gridLabel = (page: Page) =>
  page.getByRole('img', { name: /^Board, turn \d+\./ }).getAttribute('aria-label');

/** Back on the same turn's board: same grid, Question and End turn, no turn order (D11). */
async function expectSameBoard(page: Page, label: string | null) {
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  expect(await gridLabel(page)).toBe(label);
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
  await expect(page.getByRole('button', { name: /next player/i })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Players' })).toHaveCount(0);
}

/** Board → Question → popup "Question for X cards" (no player, D11); returns X. */
async function openPopup(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'Question' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const title = (await dialog.getByRole('heading').textContent())!.replace(/\s+/g, ' ').trim();
  const match = /^Question for ([123]) cards?$/.exec(title);
  expect(match, `popup title "${title}"`).not.toBeNull();
  const cards = Number(match![1]);
  expect(title.endsWith(`for ${cardsLabel(cards)}`)).toBe(true);
  return cards;
}

/** On the question screen: the matching question from questions.json. */
async function currentQuestion(page: Page): Promise<RawQuestion> {
  const text = (await page.getByRole('heading', { level: 1 }).textContent())!;
  const matches = QUESTIONS.filter((q) => q.question === text);
  expect(matches, `question "${text}"`).toHaveLength(1);
  return matches[0];
}

async function expectTargets(page: Page) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);
  const buttons = page.locator('button:visible');
  const n = await buttons.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const box = (await buttons.nth(i).boundingBox())!;
    const name = await buttons.nth(i).textContent();
    expect(box.height, `height of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box.width, `width of "${name}"`).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORT.width);
  }
}

const CONTRAST_SCRIPT = `((selector) => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
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
  expect(ratios.length, `elements matching ${selector}`).toBeGreaterThan(0);
  for (const { text, ratio } of ratios) {
    expect(ratio, `contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
  }
}

/** Result screen text: headings, labels, paragraphs and buttons. */
const RESULT_TEXT = 'main h1, main h2, main p, main li span, main button';

test.beforeEach(async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Medium' });
});

test('correct answer: popup → question → Correct! + Draw X cards → Continue → board', async ({
  page,
}) => {
  const label = await gridLabel(page);
  const cards = await openPopup(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(
    `Answer correctly to draw ${cardsLabel(cards)}. One try only.`,
  );
  await expect(dialog).not.toContainText('ends your turn');
  await expectTargets(page);
  await expectContrast(page, '[role="dialog"] h2, [role="dialog"] p, [role="dialog"] button');

  await page.getByRole('button', { name: 'Show the question' }).click();
  const q = await currentQuestion(page);
  await expect(page.getByText(`For ${cardsLabel(cards)}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/Player \d/)).toHaveCount(0);
  const choices = page.getByRole('list', { name: 'Choices' }).getByRole('button');
  await expect(choices).toHaveCount(Object.keys(q.choices).length);
  await expectTargets(page);
  await expectContrast(page, 'main button, main h1');

  await page.getByRole('button', { name: `${q.answer}: ${q.choices[q.answer]}` }).click();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/Correct!$/);
  await expect(heading).toBeFocused();
  await expect(page.getByText(`Draw ${cardsLabel(cards)}`, { exact: true })).toBeVisible();
  await expect(page.getByText(q.explanation)).toBeVisible();
  await expect(page.getByText(/Player \d/)).toHaveCount(0);
  await expectTargets(page);
  await expectContrast(page, RESULT_TEXT);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expectSameBoard(page, label);
});

test('wrong answer: Wrong answer, right one shown, no cards, Continue → same board', async ({
  page,
}) => {
  const label = await gridLabel(page);
  await openPopup(page);
  await page.getByRole('button', { name: 'Show the question' }).click();
  const q = await currentQuestion(page);
  const wrong = Object.keys(q.choices).find((k) => k !== q.answer)!;
  const wrongButton = page.getByRole('button', { name: `${wrong}: ${q.choices[wrong]}` });
  await wrongButton.click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Wrong answer$/);
  await expect(page.getByText('No cards this time.')).toBeVisible();
  await expect(page.getByText(/^Draw \d/)).toHaveCount(0);
  const items = page.getByRole('list', { name: 'Choices' }).getByRole('listitem');
  const right = items.filter({ hasText: 'Correct answer' });
  await expect(right).toHaveCount(1);
  await expect(right).toContainText(q.choices[q.answer]);
  const pick = items.filter({ hasText: 'Your answer' });
  await expect(pick).toHaveCount(1);
  await expect(pick).toContainText(q.choices[wrong]);
  await expect(page.getByText(q.explanation)).toBeVisible();
  await expectTargets(page);
  await expectContrast(page, RESULT_TEXT);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expectSameBoard(page, label);
});

test('End turn after a question and Continue draws turn 2 (D11)', async ({ page }) => {
  await openPopup(page);
  await page.getByRole('button', { name: 'Show the question' }).click();
  await page.getByRole('list', { name: 'Choices' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  // Questions go on in turn 2, without repeats.
  await openPopup(page);
});

test('cancel: Cancel and Escape go back to the board, same turn, focus on Question', async ({
  page,
}) => {
  const label = await gridLabel(page);
  for (const how of ['button', 'Escape'] as const) {
    await openPopup(page);
    await expect(page.getByRole('button', { name: 'Show the question' })).toBeFocused();
    if (how === 'button') await page.getByRole('button', { name: 'Cancel' }).click();
    else await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectSameBoard(page, label);
    await expect(page.getByRole('button', { name: 'Question' })).toBeFocused();
  }
  const saved = await page.evaluate(() => localStorage.getItem('bgc.game.v2'));
  expect(JSON.parse(saved!).state.game.askedQuestionIds).toEqual([]);
});

test('reload on the question and result screens keeps the same question and answer', async ({
  page,
}) => {
  await openPopup(page);
  await page.getByRole('button', { name: 'Show the question' }).click();
  const q = await currentQuestion(page);
  await page.reload();
  expect((await currentQuestion(page)).id).toBe(q.id);
  await page.getByRole('button', { name: `${q.answer}: ${q.choices[q.answer]}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Correct!$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Correct!$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(q.question);
});
