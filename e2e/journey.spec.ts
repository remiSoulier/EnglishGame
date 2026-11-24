import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, startGame } from './helpers';

/**
 * Demo script: New game → Question (right, then wrong answer) → End turn → We have a winner.
 * Played on one phone (390 × 844), with a second device checking the board is the same.
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
const players = (page: Page) => page.getByRole('list', { name: 'Players' }).getByRole('listitem');
const grid = (page: Page) => page.getByRole('img', { name: /^Board, turn \d+\./ });
const gridLabel = async (page: Page) => (await grid(page).getAttribute('aria-label'))!;
const goalOf = (label: string) => /Goal on ([A-I][1-9])\./.exec(label)![1];
const enemiesOf = (label: string) => /Enem(?:y|ies) on ([^.]+)\./.exec(label)?.[1] ?? '';
const cardsLabel = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

async function noHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth, 'no horizontal scroll at 390 px').toBeLessThanOrEqual(390);
}

async function expectActivePlayer(page: Page, player: number) {
  await expect(players(page).nth(player - 1)).toHaveAttribute('aria-current', 'true');
}

/** Board → Question → popup "Player N — Question for X card(s)" → Show the question. */
async function askQuestion(page: Page, player: number) {
  await page.getByRole('button', { name: 'Question' }).click();
  const title = page.getByRole('dialog').getByRole('heading');
  await expect(title).toHaveText(new RegExp(`^Player ${player} — Question for [123] cards?$`));
  const cards = Number(/for (\d)/.exec((await title.textContent())!)![1]);
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Show the question' }).click();
  const text = (await h1(page).textContent())!;
  const matches = QUESTIONS.filter((q) => q.question === text);
  expect(matches, `question "${text}" in questions.json`).toHaveLength(1);
  await noHorizontalScroll(page);
  return { cards, question: matches[0] };
}

async function playToTurn2(page: Page) {
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next player' }).click();
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
  let p1Question = '';

  await test.step('Home → New game: 3 players, Medium, board code K7F2-9QX', async () => {
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    await noHorizontalScroll(page);
    await startGame(page, { ...GAME, goto: false });
    await expect(h1(page)).toHaveText('Turn 1');
    await expect(page.getByText(`Code ${CODE} · Medium`, { exact: true })).toBeVisible();
    await expect(players(page)).toHaveCount(3);
    await expectActivePlayer(page, 1);
    turn1Label = await gridLabel(page);
    expect(enemiesOf(turn1Label).split(', ')).toHaveLength(4);
    goal = goalOf(turn1Label);
    await noHorizontalScroll(page);
  });

  await test.step('Player 1 answers correctly and draws X cards', async () => {
    const { cards, question } = await askQuestion(page, 1);
    p1Question = question.question;
    const right = question.answer;
    await page.getByRole('button', { name: `${right}: ${question.choices[right]}` }).click();
    await expect(h1(page)).toHaveText(/Correct!$/);
    await expect(page.getByText(`Draw ${cardsLabel(cards)}`, { exact: true })).toBeVisible();
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    await expectActivePlayer(page, 2);
  });

  await test.step('Player 2 answers wrong: no cards, the right answer is shown', async () => {
    const { question } = await askQuestion(page, 2);
    expect(question.question, 'P2 gets another question').not.toBe(p1Question);
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
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    await expectActivePlayer(page, 3);
  });

  await test.step('Player 3 passes → End turn → new board → Start turn 2', async () => {
    await expect(page.getByRole('button', { name: 'Next player' })).toHaveCount(0);
    await page.getByRole('button', { name: 'End turn' }).click();
    await expect(h1(page)).toHaveText('Walls and enemies have moved');
    await expect(page.getByText(`The goal stays on ${goal}`)).toBeVisible();
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Start turn 2' }).click();
    await expect(h1(page)).toHaveText('Turn 2');
    await expectActivePlayer(page, 1);
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
