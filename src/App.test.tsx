import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { ALL_QUESTIONS } from './data/questions';
import { cellName, choiceKeys, generateBoard, parseCell, type Question } from './engine';
import { APP_NAME } from './state/appInfo';
import { gameReducer, initialState, type GameAction } from './state/gameReducer';
import { STORAGE_KEY, saveState } from './state/storage';
import type { GameState } from './state/types';

const players = () =>
  within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');

const gridLabel = () =>
  screen.getByRole('img', { name: /^Board, turn \d+\./ }).getAttribute('aria-label');

function readCode(): string {
  const text = screen.getByText(/^Code \S+ · Medium$/).textContent ?? '';
  return /^Code (\S+) ·/.exec(text)![1];
}

/** Everything visible that identifies the game on the board screen. */
function snapshot() {
  const text = screen.getByText(/^Code \S+ · (Easy|Medium|Hard)$/).textContent ?? '';
  const [, code, difficulty] = /^Code (\S+) · (\w+)$/.exec(text)!;
  const items = players();
  return {
    heading: screen.getByRole('heading', { level: 1 }).textContent,
    code,
    difficulty,
    players: items.length,
    active: items.findIndex((li) => li.getAttribute('aria-current') === 'true'),
    grid: gridLabel(),
  };
}

/** The saved game (or null). */
function savedGame(): Record<string, unknown> | null {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
    state: { game: Record<string, unknown> | null };
  } | null;
  return saved?.state.game ?? null;
}

type User = ReturnType<typeof userEvent.setup>;

async function openMenuItem(user: User, name: 'New board' | 'We have a winner' | 'Quit to home') {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('menuitem', { name }));
}

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

  it('the menu "New board" asks first, then starts turn 1 with a new code', async () => {
    const { user } = await renderGame();
    const code = readCode();
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    await openMenuItem(user, 'New board');
    expect(screen.getByRole('dialog', { name: 'Start a new board?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New board' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(readCode()).not.toBe(code);
    expect(players()).toHaveLength(4);
    expect(players()[0]).toHaveAttribute('aria-current', 'true');
  });

  describe('New board confirmation (#12, D8)', () => {
    /** Plays to turn 2, P2 active, on a 3-player Hard game; returns the snapshot. */
    async function midGame() {
      const user = userEvent.setup();
      render(<App />);
      await startGame(user, { players: 3, difficulty: 'Hard' });
      for (let i = 0; i < 2; i++) {
        await user.click(screen.getByRole('button', { name: 'Next player' }));
      }
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      return { user, snapshot: snapshot() };
    }

    it('shows the dialog with the board behind it inert', async () => {
      const { user } = await midGame();
      await openMenuItem(user, 'New board');
      const dialog = screen.getByRole('dialog', { name: 'Start a new board?' });
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      const board = document.querySelector('[inert]');
      expect(board).not.toBeNull();
      expect(board).toContainElement(document.querySelector('h1'));
      expect(board).not.toContainElement(dialog);
    });

    it('Cancel keeps the exact same game (code, turn, board, active player)', async () => {
      const { user, snapshot: before } = await midGame();
      const saved = localStorage.getItem(STORAGE_KEY);
      await openMenuItem(user, 'New board');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(snapshot()).toEqual(before);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
      expect(document.querySelector('[inert]')).toBeNull();
    });

    it('Escape keeps the exact same game', async () => {
      const { user, snapshot: before } = await midGame();
      await openMenuItem(user, 'New board');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(snapshot()).toEqual(before);
    });

    it('a tap on the backdrop keeps the exact same game', async () => {
      const { user, snapshot: before } = await midGame();
      await openMenuItem(user, 'New board');
      await user.click(screen.getByTestId('modal-backdrop'));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(snapshot()).toEqual(before);
    });

    it('confirm starts turn 1 with a new code and the same players and difficulty', async () => {
      const { user, snapshot: before } = await midGame();
      await openMenuItem(user, 'New board');
      await user.click(screen.getByRole('button', { name: 'New board' }));
      const after = snapshot();
      expect(after.heading).toBe('Turn 1');
      expect(after.code).not.toBe(before.code);
      expect(after.difficulty).toBe('Hard');
      expect(after.players).toBe(3);
      expect(after.active).toBe(0);
      const game = savedGame();
      expect(game).toMatchObject({
        code: after.code,
        turn: 1,
        playerCount: 3,
        difficulty: 'hard',
        activePlayer: 1,
        winner: null,
        pendingQuestion: null,
      });
      expect(gridLabel()).toContain(
        `Goal on ${cellName(generateBoard(after.code, 1, 'hard').goal)}.`,
      );
    });
  });

  describe('We have a winner (#15)', () => {
    it.each([2, 3, 4] as const)('lists exactly %i players', async (count) => {
      const user = userEvent.setup();
      render(<App />);
      await startGame(user, { players: count, difficulty: 'Easy' });
      await openMenuItem(user, 'We have a winner');
      expect(screen.getAllByRole('button', { name: /^Player \d$/ })).toHaveLength(count);
    });

    it('Back returns to the same board (same turn, code, grid, active player)', async () => {
      const { user } = await renderGame();
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: 'Next player' }));
      }
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      const before = snapshot();
      await openMenuItem(user, 'We have a winner');
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(snapshot()).toEqual(before);
      expect(before.heading).toBe('Turn 2');
      expect(before.active).toBe(1);
    });

    it.each([1, 2, 3, 4])('declaring Player %i shows "Player %i wins!"', async (n) => {
      const { user } = await renderGame();
      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: `Player ${n}` }));
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(new RegExp(`^Player ${n} wins!$`));
      expect(h1).toHaveFocus();
      expect(savedGame()).toMatchObject({ winner: n });
    });

    it('reload on the win screen shows the win screen again', async () => {
      const { user, unmount } = await renderGame();
      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: 'Player 3' }));
      unmount();
      render(<App />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Player 3 wins!$/);
      expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
    });

    it('Home goes to the Home screen and clears the saved game (reload → Home)', async () => {
      const { user, unmount } = await renderGame();
      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: 'Player 2' }));
      await user.click(screen.getByRole('button', { name: 'Home' }));
      expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toMatchObject({
        state: { screen: 'home', game: null },
      });
      unmount();
      render(<App />);
      expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Players' })).toBeNull();
      expect(screen.queryByRole('button', { name: /resume|continue/i })).toBeNull();
    });

    it('Play again starts turn 1: new code, same players & difficulty, P1, no asked questions', async () => {
      const user = userEvent.setup();
      const first = render(<App />);
      await startGame(user, { players: 3, difficulty: 'Hard' });
      const code = snapshot().code;
      // Ask (and answer) one question so askedQuestionIds is not empty before the win.
      await user.click(screen.getByRole('button', { name: 'Question' }));
      await user.click(screen.getByRole('button', { name: 'Show the question' }));
      await user.click(screen.getByRole('button', { name: /^A: / }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(savedGame()?.askedQuestionIds).toHaveLength(1);

      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: 'Player 2' }));
      await user.click(screen.getByRole('button', { name: 'Play again' }));

      const after = snapshot();
      expect(after.heading).toBe('Turn 1');
      expect(after.code).not.toBe(code);
      expect(after.players).toBe(3);
      expect(after.difficulty).toBe('Hard');
      expect(after.active).toBe(0);
      expect(savedGame()).toMatchObject({
        code: after.code,
        turn: 1,
        playerCount: 3,
        difficulty: 'hard',
        activePlayer: 1,
        askedQuestionIds: [],
        pendingQuestion: null,
        winner: null,
      });

      // The fresh game is what survives a reload.
      first.unmount();
      render(<App />);
      expect(snapshot()).toEqual(after);
    });
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

describe('Navigation (#12, D10)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const h1 = () => screen.getByRole('heading', { level: 1 });
  const continueButton = () => screen.queryByRole('button', { name: /^Continue game/ });

  /** Builds a state through the reducer from a fresh 3-player Medium game (code K7F2-9QX). */
  function play(...actions: GameAction[]): GameState {
    let s = gameReducer(initialState, {
      type: 'START_GAME',
      playerCount: 3,
      difficulty: 'medium',
      code: 'K7F2-9QX',
    });
    for (const a of actions) s = gameReducer(s, a);
    return s;
  }

  const q = ALL_QUESTIONS[0];
  const toPopup: GameAction[] = [{ type: 'OPEN_QUESTION', questionId: q.id, cards: 2 }];
  const toQuestion: GameAction[] = [...toPopup, { type: 'SHOW_QUESTION' }];
  const toResult: GameAction[] = [...toQuestion, { type: 'ANSWER_QUESTION', answer: q.answer }];

  describe('Quit to home', () => {
    async function onTurn2() {
      const { user, ...rest } = await renderGame();
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: 'Next player' }));
      }
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      return { user, ...rest, before: snapshot() };
    }

    it('the board menu lists New board, We have a winner, Quit to home', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
        'New board',
        'We have a winner',
        'Quit to home',
      ]);
    });

    it('asks "Quit this game?" with Cancel focused and the board inert', async () => {
      const { user } = await renderGame();
      await openMenuItem(user, 'Quit to home');
      const dialog = screen.getByRole('dialog', { name: 'Quit this game?' });
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      const board = document.querySelector('[inert]');
      expect(board).not.toBeNull();
      expect(board).not.toContainElement(dialog);
    });

    it.each(['Cancel', 'Escape', 'backdrop'] as const)(
      '%s keeps the exact same game on the board',
      async (how) => {
        const { user, before } = await onTurn2();
        const saved = localStorage.getItem(STORAGE_KEY);
        await openMenuItem(user, 'Quit to home');
        if (how === 'Cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }));
        else if (how === 'Escape') await user.keyboard('{Escape}');
        else await user.click(screen.getByTestId('modal-backdrop'));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(snapshot()).toEqual(before);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
        expect(document.querySelector('[inert]')).toBeNull();
      },
    );

    it('Quit → Home with "Continue game · Turn N · code"; the game is saved', async () => {
      const { user, before } = await onTurn2();
      const game = savedGame();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(h1()).toHaveFocus();
      expect(continueButton()).toHaveTextContent(`Turn 2 · ${before.code}`);
      expect(savedGame()).toEqual({ ...game, lastScreen: 'board' });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.screen).toBe('home');
    });

    it('reload on Home keeps Continue game; Continue returns to the same board', async () => {
      const { user, before, unmount } = await onTurn2();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      unmount();
      render(<App />);
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(continueButton()).toHaveTextContent(`Turn 2 · ${before.code}`);
      await user.click(continueButton()!);
      expect(snapshot()).toEqual(before);
      expect(h1()).toHaveFocus();
      expect(savedGame()).not.toHaveProperty('lastScreen');
    });

    it('New game shows the replace notice; Back keeps the saved game', async () => {
      const { user, before } = await onTurn2();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      const game = savedGame();
      await user.click(screen.getByRole('button', { name: 'New game' }));
      expect(screen.getByText('This will replace your current game.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(savedGame()).toEqual(game);
      await user.click(continueButton()!);
      expect(snapshot()).toEqual(before);
    });

    it('reload on New game keeps the saved game and the notice', async () => {
      const { user, unmount } = await onTurn2();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      const game = savedGame();
      await user.click(screen.getByRole('button', { name: 'New game' }));
      unmount();
      render(<App />);
      expect(h1()).toHaveTextContent('New game');
      expect(screen.getByText('This will replace your current game.')).toBeInTheDocument();
      expect(savedGame()).toEqual(game);
    });

    it('Start game replaces the saved game (turn 1, new settings, no Continue)', async () => {
      const { user, before } = await onTurn2();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      await startGame(user, { players: 2, difficulty: 'Easy', code: 'HJKM-NPQ' });
      expect(readCodeAny()).toBe('HJKM-NPQ');
      expect(readCodeAny()).not.toBe(before.code);
      expect(players()).toHaveLength(2);
      expect(savedGame()).toMatchObject({ code: 'HJKM-NPQ', turn: 1, playerCount: 2 });
      expect(savedGame()).not.toHaveProperty('lastScreen');
    });

    it('without a saved game, New game has no replace notice', async () => {
      const user = userEvent.setup();
      render(<App />);
      expect(continueButton()).toBeNull();
      await user.click(screen.getByRole('button', { name: 'New game' }));
      expect(screen.queryByText('This will replace your current game.')).toBeNull();
    });

    it('winner → Home clears the game: no Continue, even after a reload', async () => {
      const { user, unmount } = await renderGame();
      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: 'Player 1' }));
      await user.click(screen.getByRole('button', { name: 'Home' }));
      expect(continueButton()).toBeNull();
      expect(savedGame()).toBeNull();
      unmount();
      render(<App />);
      expect(continueButton()).toBeNull();
    });
  });

  describe('Continue game returns to the exact screen (saved home state)', () => {
    const cases: [string, GameAction[], RegExp][] = [
      ['board', [{ type: 'NEXT_PLAYER' }], /^Turn 1$/],
      [
        'newBoard',
        [{ type: 'NEXT_PLAYER' }, { type: 'NEXT_PLAYER' }, { type: 'END_TURN' }],
        /^Walls and enemies have moved$/,
      ],
      ['questionPopup', toPopup, /^Turn 1$/],
      ['question', toQuestion, new RegExp(`^${escape(q.question)}$`)],
      ['result', toResult, /Correct!$/],
      ['winner', [{ type: 'OPEN_WINNER' }], /^We have a winner$/],
      [
        'winner',
        [{ type: 'OPEN_WINNER' }, { type: 'DECLARE_WINNER', player: 2 }],
        /^Player 2 wins!$/,
      ],
    ];

    it.each(cases)('%s (%#)', async (screenName, actions, heading) => {
      const playing = play(...actions);
      expect(playing.screen).toBe(screenName);
      saveState(gameReducer(playing, { type: 'QUIT_TO_HOME' }));
      const user = userEvent.setup();
      render(<App />);
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(continueButton()).toHaveTextContent(`Turn ${playing.game!.turn} · K7F2-9QX`);
      await user.click(continueButton()!);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state).toEqual(playing);
      if (screenName === 'questionPopup') {
        expect(screen.getByRole('dialog', { name: /^Player 1 — Question for 2 cards$/ }));
        expect(screen.getByRole('button', { name: 'Show the question' })).toHaveFocus();
      } else {
        expect(h1()).toHaveTextContent(heading);
        expect(h1()).toHaveFocus();
      }
    });
  });

  describe('every exit of NAVIGATION works through the UI', () => {
    it('home: New game → newGame; newGame: Back → home, Start game → board', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: 'New game' }));
      expect(h1()).toHaveTextContent('New game');
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      await startGame(user);
    });

    it('board: Question / Next player / End turn / menu items', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Question' }));
      expect(screen.getByRole('dialog', { name: /Question for/ })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      expect(players()[1]).toHaveAttribute('aria-current', 'true');
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      await user.click(screen.getByRole('button', { name: 'Next player' }));
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      expect(h1()).toHaveTextContent('Walls and enemies have moved');
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      expect(h1()).toHaveTextContent('Turn 2');
      await openMenuItem(user, 'New board');
      await user.click(screen.getByRole('button', { name: 'New board' }));
      expect(h1()).toHaveTextContent('Turn 1');
      await openMenuItem(user, 'We have a winner');
      expect(h1()).toHaveTextContent('We have a winner');
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(h1()).toHaveTextContent('Turn 1');
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      expect(h1()).toHaveTextContent(APP_NAME);
    });

    it('questionPopup → question → result → board; winner steps 1 and 2', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Question' }));
      await user.click(screen.getByRole('button', { name: 'Show the question' }));
      const choices = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button');
      // One try: no Back / Cancel on the question screen.
      expect(screen.queryByRole('button', { name: /^(Back|Cancel|Menu)$/ })).toBeNull();
      await user.click(choices[0]);
      expect(h1()).toHaveTextContent(/(Correct!|Wrong answer)$/);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(h1()).toHaveTextContent('Turn 1');
      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: 'Player 2' }));
      expect(h1()).toHaveTextContent('Player 2 wins!');
      await user.click(screen.getByRole('button', { name: 'Play again' }));
      expect(h1()).toHaveTextContent('Turn 1');
    });
  });

  describe('focus moves to the new screen h1', () => {
    it('on every screen change of a whole game', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: 'New game' }));
      expect(h1()).toHaveTextContent('New game');
      expect(h1()).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(h1()).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(screen.getByRole('radio', { name: '2' }));
      await user.click(screen.getByRole('button', { name: 'Start game' }));
      expect(h1()).toHaveTextContent('Turn 1');
      expect(h1()).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Question' }));
      expect(screen.getByRole('button', { name: 'Show the question' })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Show the question' }));
      expect(h1()).toHaveFocus();
      await user.click(
        within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button')[0],
      );
      expect(h1()).toHaveTextContent(/(Correct!|Wrong answer)$/);
      expect(h1()).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(h1()).toHaveTextContent('Turn 1');
      expect(h1()).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'End turn' }));
      expect(h1()).toHaveTextContent('Walls and enemies have moved');
      expect(h1()).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      expect(h1()).toHaveTextContent('Turn 2');
      expect(h1()).toHaveFocus();

      await openMenuItem(user, 'We have a winner');
      expect(h1()).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(h1()).toHaveTextContent('Turn 2');
      expect(h1()).toHaveFocus();

      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(h1()).toHaveFocus();
      await user.click(continueButton()!);
      expect(h1()).toHaveTextContent('Turn 2');
      expect(h1()).toHaveFocus();

      await openMenuItem(user, 'We have a winner');
      await user.click(screen.getByRole('button', { name: 'Player 1' }));
      expect(h1()).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Home' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(h1()).toHaveFocus();
    });

    it('Cancel of the popup returns focus to Question, not the h1', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Question' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Question' })).toHaveFocus();
    });
  });

  describe('system back (History API)', () => {
    /** Fires the browser back button and lets React settle. */
    async function systemBack() {
      await act(async () => {
        window.history.back();
        await new Promise((r) => setTimeout(r, 30));
      });
    }

    it('on New game → Home, saved game kept', async () => {
      saveState(gameReducer(play({ type: 'NEXT_PLAYER' }), { type: 'QUIT_TO_HOME' }));
      const game = savedGame();
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: 'New game' }));
      await systemBack();
      await waitFor(() => expect(h1()).toHaveTextContent(APP_NAME));
      expect(savedGame()).toEqual(game);
      expect(continueButton()).not.toBeNull();
    });

    it('on the question popup → board, question not asked, focus on Question', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Question' }));
      await systemBack();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(h1()).toHaveTextContent('Turn 1');
      expect(savedGame()).toMatchObject({ pendingQuestion: null, askedQuestionIds: [] });
      expect(screen.getByRole('button', { name: 'Question' })).toHaveFocus();
    });

    it('on winner step 1 → board', async () => {
      const { user } = await renderGame();
      await openMenuItem(user, 'We have a winner');
      await systemBack();
      await waitFor(() => expect(h1()).toHaveTextContent('Turn 1'));
    });

    it.each(['Quit to home', 'New board'] as const)(
      'with the %s dialog open → the dialog closes, game unchanged',
      async (item) => {
        const { user } = await renderGame();
        const before = snapshot();
        const saved = localStorage.getItem(STORAGE_KEY);
        await openMenuItem(user, item);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await systemBack();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(snapshot()).toEqual(before);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
      },
    );
  });
});

/** Code of the board screen, whatever the difficulty. */
function readCodeAny(): string {
  const text = screen.getByText(/^Code \S+ · (Easy|Medium|Hard)$/).textContent ?? '';
  return /^Code (\S+) ·/.exec(text)![1];
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
