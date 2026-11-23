import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { ALL_QUESTIONS } from './data/questions';
import { cellName, choiceKeys, generateBoard, parseCell, type Question } from './engine';
import { APP_NAME } from './state/appInfo';
import { STORAGE_KEY } from './state/storage';

const players = () =>
  within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');

const gridLabel = () =>
  screen.getByRole('img', { name: /^Board, turn \d+\./ }).getAttribute('aria-label');

function readCode(): string {
  const text = screen.getByText(/^Code \S+ · Medium$/).textContent ?? '';
  return /^Code (\S+) ·/.exec(text)![1];
}

type User = ReturnType<typeof userEvent.setup>;

const DIFFICULTY_RADIO = {
  Easy: 'Easy — 2 enemies',
  Medium: 'Medium — 4 enemies',
  Hard: 'Hard — 6 enemies',
} as const;

/** Home → New game → players + difficulty (+ code) → Start game. */
async function startGame(
  user: User,
  {
    players: count = 4,
    difficulty = 'Medium',
    code,
  }: { players?: 2 | 3 | 4; difficulty?: keyof typeof DIFFICULTY_RADIO; code?: string } = {},
) {
  await user.click(screen.getByRole('button', { name: 'New game' }));
  await user.click(screen.getByRole('radio', { name: String(count) }));
  await user.click(screen.getByRole('radio', { name: DIFFICULTY_RADIO[difficulty] }));
  if (code !== undefined) {
    await user.click(screen.getByRole('radio', { name: 'Enter a board code' }));
    await user.type(screen.getByRole('textbox', { name: 'Board code' }), code);
  }
  await user.click(screen.getByRole('button', { name: 'Start game' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
}

/** Renders the app and starts a 4-player Medium game through the UI. */
async function renderGame() {
  const user = userEvent.setup();
  const utils = render(<App />);
  await startGame(user);
  return { ...utils, user };
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('a fresh visit lands on the home screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Players' })).not.toBeInTheDocument();
  });

  it('Home → New game → Back → Home', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New game' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
  });

  it.each([
    [2, 'Easy', 2],
    [3, 'Medium', 4],
    [4, 'Hard', 6],
  ] as const)(
    '%i players + %s starts a game with %i enemies',
    async (count, difficulty, enemies) => {
      const user = userEvent.setup();
      render(<App />);
      await startGame(user, { players: count, difficulty });
      expect(players()).toHaveLength(count);
      expect(screen.getByText(new RegExp(`^Code \\S+ · ${difficulty}$`))).toBeInTheDocument();
      const list = /Enem(?:y|ies) on ([^.]+)\./.exec(gridLabel() ?? '')![1].split(', ');
      expect(list).toHaveLength(enemies);
    },
  );

  it('an entered code starts that board (same board as the engine for turn 1)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user, { code: 'k7f2 9qx' });
    expect(readCode()).toBe('K7F2-9QX');
    const label = gridLabel();
    const board = generateBoard('K7F2-9QX', 1, 'medium');
    expect(label).toContain(`Goal on ${cellName(board.goal)}.`);
  });

  it('the same code on two separate games gives the same turn-1 board', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await startGame(user, { code: 'K7F2-9QX' });
    const label = gridLabel();
    first.unmount();
    localStorage.clear();

    render(<App />);
    await startGame(user, { code: 'k7f29qx' });
    expect(gridLabel()).toBe(label);
  });

  it('renders the board screen with a "Turn N" heading', async () => {
    await renderGame();
    expect(screen.getByRole('heading', { level: 1, name: /^Turn \d+$/ })).toBeInTheDocument();
  });

  it('cycles players, ends the turn on the new board screen, then starts turn 2', async () => {
    const { user } = await renderGame();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn 1');
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Next player' }));
    }
    expect(players()[3]).toHaveAttribute('aria-current', 'true');
    await user.click(screen.getByRole('button', { name: 'End turn' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Walls and enemies have moved$/,
    );
    expect(screen.queryByRole('list', { name: 'Players' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Board, turn 2\./ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start turn 2' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 2$/);
    expect(players()[0]).toHaveAttribute('aria-current', 'true');
    expect(players()[3]).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Next player' })).toBeInTheDocument();
  });

  it('keeps the code and goal over several turns, redraws enemies, matches the engine', async () => {
    const { user } = await renderGame();
    const code = readCode();
    const first = generateBoard(code, 1, 'medium');
    const goalOf = (label: string | null) => /Goal on ([A-I][1-9])\./.exec(label ?? '')![1];
    const enemiesOf = (label: string | null) => /Enem(?:y|ies) on ([^.]+)\./.exec(label ?? '')?.[1];

    let previous = gridLabel();
    const goal = goalOf(previous);
    expect(parseCell(goal)).toEqual(first.goal);

    for (let turn = 2; turn <= 4; turn++) {
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: 'Next player' }));
      }
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      expect(screen.getByText(`The goal stays on ${goal}`)).toBeInTheDocument();
      const label = gridLabel();
      expect(goalOf(label)).toBe(goal);
      expect(enemiesOf(label)).not.toBe(enemiesOf(previous));
      const expected = generateBoard(code, turn, 'medium', first.goal);
      expect(enemiesOf(label)).toBe(expected.enemies.map(cellName).join(', '));

      await user.click(screen.getByRole('button', { name: `Start turn ${turn}` }));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`Turn ${turn}`);
      expect(readCode()).toBe(code);
      expect(gridLabel()).toBe(label);
      previous = label;
    }
  });

  it('restores code, turn, active player and board after a reload', async () => {
    const { user, unmount } = await renderGame();
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Next player' }));
    }
    const code = readCode();
    const label = gridLabel();
    expect(players()[2]).toHaveAttribute('aria-current', 'true');
    unmount();

    render(<App />);
    expect(readCode()).toBe(code);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(players()[2]).toHaveAttribute('aria-current', 'true');
    expect(players()[0]).not.toHaveAttribute('aria-current');
    expect(gridLabel()).toBe(label);
  });

  it('restores a later turn and the new board screen after a reload', async () => {
    const { user, unmount } = await renderGame();
    const code = readCode();
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Next player' }));
    }
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    const label = gridLabel();
    unmount();

    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Walls and enemies have moved$/,
    );
    expect(gridLabel()).toBe(label);
    await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
    expect(readCode()).toBe(code);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 2$/);
    expect(gridLabel()).toBe(label);
    expect(players()[0]).toHaveAttribute('aria-current', 'true');
  });

  it('goes back to the home screen when the saved game is cleared, then a new game has a new code', async () => {
    const { unmount } = await renderGame();
    const code = readCode();
    unmount();
    localStorage.clear();
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
    await startGame(user);
    expect(readCode()).not.toBe(code);
  });

  it('the menu "We have a winner" shows the winner screen', async () => {
    const { user } = await renderGame();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'We have a winner' }));
    expect(screen.getByRole('heading', { level: 1, name: 'We have a winner' })).toBeInTheDocument();
  });

  it('the menu "New board" starts turn 1 with a new code', async () => {
    const { user } = await renderGame();
    const code = readCode();
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'New board' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(readCode()).not.toBe(code);
    expect(players()).toHaveLength(4);
    expect(players()[0]).toHaveAttribute('aria-current', 'true');
  });
});

describe('App question flow (spec #13 / #14)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const activeIndex = () => players().findIndex((li) => li.getAttribute('aria-current') === 'true');

  const savedAsked = (): number[] =>
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state.game.askedQuestionIds;

  /** Board → Question → popup; returns the dialog and X read from its title. */
  async function openPopup(user: User, player: number) {
    await user.click(screen.getByRole('button', { name: 'Question' }));
    const dialog = screen.getByRole('dialog', {
      name: new RegExp(`^Player ${player} — Question for [123] cards?$`),
    });
    const title = dialog.getAttribute('aria-labelledby')!;
    const text = document.getElementById(title)!.textContent ?? '';
    const cards = Number(/Question for (\d) card/.exec(text)![1]);
    expect(text).toMatch(cards === 1 ? /for 1 card$/ : new RegExp(`for ${cards} cards$`));
    return { dialog, cards };
  }

  /** On the question screen: the matching question from the data, by its text. */
  function currentQuestion(): Question {
    const text = screen.getByRole('heading', { level: 1 }).textContent;
    const matches = ALL_QUESTIONS.filter((q) => q.question === text);
    expect(matches).toHaveLength(1);
    return matches[0];
  }

  const choice = (q: Question, key: string) =>
    screen.getByRole('button', { name: `${key}: ${q.choices[key as 'A']}` });

  async function askAndAnswer(user: User, player: number, right: boolean) {
    const { cards } = await openPopup(user, player);
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    const q = currentQuestion();
    const key = right ? q.answer : choiceKeys(q).find((k) => k !== q.answer)!;
    await user.click(choice(q, key));
    return { q, key, cards };
  }

  it('the popup names the active player and X in 1–3; the board is inert behind it', async () => {
    const { user } = await renderGame();
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    const { dialog } = await openPopup(user, 2);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Show the question' })).toHaveFocus();
    const board = screen.getByRole('heading', { level: 1, hidden: true }).closest('[inert]');
    expect(board).not.toBeNull();
    expect(board).toHaveAttribute('aria-hidden', 'true');
    // Only the dialog's buttons are exposed.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Show the question',
      'Cancel',
    ]);
  });

  it.each(['button', 'Escape'] as const)(
    'Cancel (%s) → board, same player, question not marked asked, focus back on Question',
    async (how) => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      await openPopup(user, 2);
      if (how === 'button') await user.click(screen.getByRole('button', { name: 'Cancel' }));
      else await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
      expect(activeIndex()).toBe(1);
      expect(savedAsked()).toEqual([]);
      expect(screen.getByRole('button', { name: 'Question' })).toHaveFocus();
      expect(document.querySelector('[inert]')).toBeNull();
    },
  );

  it('Show the question → the question screen with 2–4 choice buttons and the popup X', async () => {
    const { user } = await renderGame();
    const { cards } = await openPopup(user, 1);
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    const q = currentQuestion();
    const buttons = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons.length).toBeLessThanOrEqual(4);
    expect(buttons).toHaveLength(choiceKeys(q).length);
    expect(
      screen.getByText(`Player 1 — for ${cards} ${cards === 1 ? 'card' : 'cards'}`),
    ).toBeInTheDocument();
  });

  it('correct answer: "Correct!", "Draw X cards" with the popup X, explanation; Continue → P2', async () => {
    const { user } = await renderGame();
    const { q, cards } = await askAndAnswer(user, 1, true);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Correct!$/);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByText(`Draw ${cards} ${cards === 1 ? 'card' : 'cards'}`)).toBeInTheDocument();
    expect(screen.getByText(q.explanation)).toBeInTheDocument();
    expect(savedAsked()).toEqual([q.id]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(activeIndex()).toBe(1);
  });

  it('wrong answer: "Wrong answer", right choice shown with text, pick marked, no cards', async () => {
    const { user } = await renderGame();
    const { q, key } = await askAndAnswer(user, 1, false);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Wrong answer$/);
    expect(screen.getByText('No cards this time.')).toBeInTheDocument();
    expect(screen.queryByText(/^Draw \d/)).not.toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
    const right = items.find((li) => li.textContent?.includes('Correct answer'))!;
    expect(right).toHaveTextContent(q.choices[q.answer]!);
    const pick = items.find((li) => li.textContent?.includes('Your answer'))!;
    expect(pick).toHaveTextContent(q.choices[key as 'A']!);
    expect(pick).not.toBe(right);
    expect(screen.getByText(q.explanation)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(activeIndex()).toBe(1);
  });

  it("last player's Continue keeps them active; End turn is available (D8)", async () => {
    const { user } = await renderGame();
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Next player' }));
    }
    await askAndAnswer(user, 4, true);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(activeIndex()).toBe(3);
    expect(screen.queryByRole('button', { name: 'Next player' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Walls and enemies have moved$/,
    );
  });

  it('30 questions in a game are all different; the 31st works (new cycle)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user, { players: 2 });
    const texts: string[] = [];
    const total = ALL_QUESTIONS.length;
    expect(total).toBe(30);
    for (let i = 0; i < total + 1; i++) {
      const player = activeIndex() + 1;
      const { q } = await askAndAnswer(user, player, i % 2 === 0);
      texts.push(q.question);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      if (player === 2) {
        await user.click(screen.getByRole('button', { name: 'End turn' }));
        await user.click(screen.getByRole('button', { name: /^Start turn \d+$/ }));
      }
    }
    expect(new Set(texts.slice(0, total)).size).toBe(total);
    expect(texts[total]).not.toBe(texts[total - 1]);
    expect(savedAsked()).toHaveLength(1);
  }, 60_000);

  it('a reload keeps the popup (same player and X)', async () => {
    const { user, unmount } = await renderGame();
    const { cards } = await openPopup(user, 1);
    unmount();
    render(<App />);
    expect(
      screen.getByRole('dialog', {
        name: `Player 1 — Question for ${cards} ${cards === 1 ? 'card' : 'cards'}`,
      }),
    ).toBeInTheDocument();
  });

  it('a reload on the question screen keeps the same question', async () => {
    const { user, unmount } = await renderGame();
    await openPopup(user, 1);
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    const q = currentQuestion();
    unmount();
    render(<App />);
    expect(currentQuestion().id).toBe(q.id);
    for (const b of within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button')) {
      expect(b).toBeEnabled();
    }
  });

  it('a reload on the result screen keeps the same question and answer', async () => {
    const { user, unmount } = await renderGame();
    const { q, key, cards } = await askAndAnswer(user, 1, false);
    unmount();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Wrong answer$/);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(q.question);
    const items = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
    const pick = items.find((li) => li.textContent?.includes('Your answer'))!;
    expect(pick).toHaveTextContent(q.choices[key as 'A']!);
    expect(screen.queryByText(new RegExp(`^Draw ${cards}`))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(activeIndex()).toBe(1);
  });
});
