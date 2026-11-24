import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, startGame } from './helpers';

/**
 * Demo script: New game → Question (right, then wrong answer) → End turn → We have a winner.
 * Played on one phone (390 × 844), with a second device checking the board is the same.
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

async function playToTurn2(page: Page) {
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(h1(page)).toHaveText('Walls and enemies have moved');
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(h1(page)).toHaveText('Turn 2');
}

test('demo journey: new game → right and wrong answers → end turn → winner', async ({
  page,
  browser,
  baseURL,
}) => {
  let goal = '';
  let turn1Label = '';
  let turn2Label = '';
  let firstQuestion = '';

  await test.step('Home → New game: 3 players, Medium, board code K7F2-9QX', async () => {
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    await noHorizontalScroll(page);
    await startGame(page, { ...GAME, goto: false });
    await expect(h1(page)).toHaveText('Turn 1');
    await expect(page.getByText(`Code ${CODE} · Medium`, { exact: true })).toBeVisible();
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
    await expect(page.getByText(`Code ${CODE} · Medium`, { exact: true })).toBeVisible();
    turn2Label = await gridLabel(page);
    expect(goalOf(turn2Label)).toBe(goal);
    expect(enemiesOf(turn2Label)).not.toBe(enemiesOf(turn1Label));
    await noHorizontalScroll(page);
  });

  await test.step('A second device with the same code shows the same turn-2 board', async () => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const other = await context.newPage();
    await startGame(other, GAME);
    await playToTurn2(other);
    expect(await gridLabel(other)).toBe(turn2Label);
    await context.close();
  });

  await test.step('Menu → We have a winner → Player 2 wins → Home', async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'We have a winner' }).click();
    await expect(h1(page)).toHaveText('We have a winner');
    await expect(page.getByRole('button', { name: /^Player \d$/ })).toHaveText([
      'Player 1',
      'Player 2',
      'Player 3',
    ]);
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Player 2' }).click();
    await expect(h1(page)).toHaveText('Player 2 wins!');
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(h1(page)).toHaveText(APP_NAME);
    await expect(page.getByRole('button', { name: /Continue game/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
    await noHorizontalScroll(page);
  });
});
