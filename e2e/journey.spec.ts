import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, gameLine, startGame } from './helpers';

/**
 * Demo script: New game → Question (right, then wrong answer) → End turn → End game (D13).
 * Played on one phone (390 × 844). The board code is internal (decision D22): a known code is
 * loaded through the save so the script always plays the same board.
 * The app does not track turn order (decision D11): no player bar, no Next player.
 */

const CODE = 'K7F2-9QX';
const GAME = { players: 3, difficulty: 'Medium', code: CODE } as const;

interface RawQuestion {
  question: string;
  choices: Record<string, string>;
  answer: string;
}

const QUESTIONS: RawQuestion[] = JSON.parse(
  readFileSync(new URL('../src/data/questions.json', import.meta.url), 'utf8'),
);

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const grid = (page: Page) => page.getByRole('img', { name: /^Board, turn \d+\./ });
const gridLabel = async (page: Page) => (await grid(page).getAttribute('aria-label'))!;
const goalOf = (label: string) => /Goal on ([A-I][1-9])\./.exec(label)![1];
const enemiesOf = (label: string) => /Enem(?:y|ies) on ([^.]+)\./.exec(label)?.[1] ?? '';
const cardsLabel = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

async function noHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth, 'no horizontal scroll at 390 px').toBeLessThanOrEqual(390);
}

/** The board shows Question and End turn, never a player bar nor Next player (D11). */
async function expectBoardActions(page: Page) {
  await expect(page.getByRole('button', { name: 'Question' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible();
  await expect(page.getByRole('button', { name: /next player/i })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Players' })).toHaveCount(0);
}

/** Board → Question → popup "Question for X card(s)" → Show the question. */
async function askQuestion(page: Page) {
  await page.getByRole('button', { name: 'Question' }).click();
  const title = page.getByRole('dialog').getByRole('heading');
  await expect(title).toHaveText(/^Question for [123] cards?$/);
  const cards = Number(/for (\d)/.exec((await title.textContent())!)![1]);
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Show the question' }).click();
  await expect(page.getByText(`For ${cardsLabel(cards)}`, { exact: true })).toBeVisible();
  const text = (await h1(page).textContent())!;
  const matches = QUESTIONS.filter((q) => q.question === text);
  expect(matches, `question "${text}" in questions.json`).toHaveLength(1);
  await noHorizontalScroll(page);
  return { cards, question: matches[0] };
}

test('demo journey: new game → right and wrong answers → end turn → end game', async ({ page }) => {
  let goal = '';
  let turn1Label = '';
  let turn2Label = '';
  let firstQuestion = '';

  await test.step('Home → New game: 3 players, Medium (board of code K7F2-9QX)', async () => {
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    await noHorizontalScroll(page);
    await startGame(page, { ...GAME, goto: false });
    await expect(h1(page)).toHaveText('Turn 1');
    expect(await gameLine(page)).toBe(`${CODE} · Medium`);
    await expectBoardActions(page);
    await expect(page.getByText('Start:', { exact: true })).toBeAttached();
    turn1Label = await gridLabel(page);
    expect(enemiesOf(turn1Label).split(', ')).toHaveLength(4);
    goal = goalOf(turn1Label);
    await noHorizontalScroll(page);
  });

  await test.step('A right answer draws X cards; Continue → same turn board', async () => {
    const { cards, question } = await askQuestion(page);
    firstQuestion = question.question;
    const right = question.answer;
    await page.getByRole('button', { name: `${right}: ${question.choices[right]}` }).click();
    await expect(h1(page)).toHaveText(/Correct!$/);
    await expect(page.getByText(`Draw ${cardsLabel(cards)}`, { exact: true })).toBeVisible();
    await expect(page.getByText(/Player \d/)).toHaveCount(0);
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    expect(await gridLabel(page)).toBe(turn1Label);
    await expectBoardActions(page);
  });

  await test.step('A wrong answer: no cards, the right answer is shown', async () => {
    const { question } = await askQuestion(page);
    expect(question.question, 'no repeated question').not.toBe(firstQuestion);
    const wrong = Object.keys(question.choices).find((k) => k !== question.answer)!;
    await page.getByRole('button', { name: `${wrong}: ${question.choices[wrong]}` }).click();
    await expect(h1(page)).toHaveText(/Wrong answer$/);
    const right = page
      .getByRole('list', { name: 'Choices' })
      .getByRole('listitem')
      .filter({ hasText: 'Correct answer' });
    await expect(right).toHaveCount(1);
    await expect(right).toContainText(question.choices[question.answer]);
    await expect(page.getByText('No cards this time.')).toBeVisible();
    await expect(page.getByText(/Player \d/)).toHaveCount(0);
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    expect(await gridLabel(page)).toBe(turn1Label);
    await expectBoardActions(page);
  });

  await test.step('End turn → new board (goal kept) → Start turn 2', async () => {
    await page.getByRole('button', { name: 'End turn' }).click();
    await expect(h1(page)).toHaveText('Walls and enemies have moved');
    await expect(page.getByText(`The goal stays on ${goal}`)).toBeVisible();
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Start turn 2' }).click();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectBoardActions(page);
    expect(await gameLine(page)).toBe(`${CODE} · Medium`);
    turn2Label = await gridLabel(page);
    expect(goalOf(turn2Label)).toBe(goal);
    expect(enemiesOf(turn2Label)).not.toBe(enemiesOf(turn1Label));
    await noHorizontalScroll(page);
  });

  await test.step('Menu → End game → confirm → Home without Continue game', async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'End game' }).click();
    const dialog = page.getByRole('dialog', { name: 'End this game?' });
    await expect(dialog).toBeVisible();
    await noHorizontalScroll(page);
    await dialog.getByRole('button', { name: 'End game' }).click();
    await expect(h1(page)).toHaveText(APP_NAME);
    await expect(page.getByRole('button', { name: /Continue game/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
    await noHorizontalScroll(page);
  });
});
