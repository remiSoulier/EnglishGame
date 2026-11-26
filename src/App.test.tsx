import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ALL_QUESTIONS } from './data/questions';
import { cellName, choiceKeys, generateBoard, parseCell, type Question } from './engine';
import { APP_NAME } from './state/appInfo';
import { gameReducer, initialState, type GameAction } from './state/gameReducer';
import { STORAGE_KEY, saveState } from './state/storage';
import type { GameState } from './state/types';

/**
 * Decision D22: the board code is neither shown nor typed any more; every new game draws a random
 * code. Tests that need a known board set `nextCode.value`, which the next `newCode()` returns.
 */
const nextCode = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('./engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine')>();
  return {
    ...actual,
    newCode: (...args: Parameters<typeof actual.newCode>) => {
      const code = nextCode.value;
      nextCode.value = undefined;
      return code ?? actual.newCode(...args);
    },
  };
});

/** Start cells of the positions list: one per player (D11: the only per-player info shown). */
const startCells = () =>
  (screen.getByText('Start:').nextElementSibling?.textContent ?? '').split(', ');

/** D11: the board never shows a player bar nor a Next player button. */
function expectNoTurnOrder() {
  expect(screen.queryByRole('list', { name: 'Players' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /next player/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/now playing/i)).not.toBeInTheDocument();
}

const gridLabel = () =>
  screen.getByRole('img', { name: /^Board, turn \d+\./ }).getAttribute('aria-label');

/** Code of the current game: no longer on screen (D22), read from the save. */
function readCode(): string {
  expect(screen.queryByText(/Code/)).not.toBeInTheDocument();
  return savedGame()!.code as string;
}

/** Everything visible that identifies the game on the board screen. */
function snapshot() {
  return {
    heading: screen.getByRole('heading', { level: 1 }).textContent,
    code: readCode(),
    difficulty: screen.getByText(/^(Easy|Medium|Hard)$/).textContent,
    starts: startCells(),
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

async function openMenuItem(user: User, name: 'New board' | 'End game' | 'Quit to home') {
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
  nextCode.value = code;
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
      expect(startCells()).toHaveLength(count);
      expectNoTurnOrder();
      expect(screen.getByText(difficulty, { exact: true })).toBeInTheDocument();
      expect(screen.queryByText(/Code/)).not.toBeInTheDocument();
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

  it.each([2, 3, 4] as const)(
    '%i players: Question and End turn at turn start, no Next player, no player bar (D11)',
    async (count) => {
      const user = userEvent.setup();
      render(<App />);
      await startGame(user, { players: count });
      expect(screen.getByRole('button', { name: 'Question' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'End turn' })).toBeEnabled();
      expectNoTurnOrder();
    },
  );

  it('End turn right at turn start → new board screen → Start turn 2, and again (D11)', async () => {
    const { user } = await renderGame();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn 1');
    await user.click(screen.getByRole('button', { name: 'End turn' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Walls and enemies have moved$/,
    );
    expectNoTurnOrder();
    expect(screen.getByRole('img', { name: /^Board, turn 2\./ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start turn 2' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 2$/);
    expect(screen.getByRole('button', { name: 'Question' })).toBeInTheDocument();
    expectNoTurnOrder();
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    await user.click(screen.getByRole('button', { name: 'Start turn 3' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 3$/);
    expect(savedGame()).toMatchObject({ turn: 3 });
    expect(savedGame()).not.toHaveProperty('activePlayer');
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

  it('restores code, turn and board after a reload', async () => {
    const { unmount } = await renderGame();
    const code = readCode();
    const label = gridLabel();
    unmount();

    render(<App />);
    expect(readCode()).toBe(code);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(gridLabel()).toBe(label);
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
    expectNoTurnOrder();
  });

  it('restores a later turn and the new board screen after a reload', async () => {
    const { user, unmount } = await renderGame();
    const code = readCode();
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
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
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

  it.each(['board', 'result', 'home'] as const)(
    'ignores a v1 save on %s (with an active player): Home, no Continue game (D11)',
    async (savedScreen) => {
      const game = gameReducer(initialState, {
        type: 'START_GAME',
        playerCount: 3,
        difficulty: 'medium',
        code: 'K7F2-9QX',
      }).game!;
      const v1Game = {
        ...game,
        activePlayer: 2,
        ...(savedScreen === 'home' ? { lastScreen: 'board' } : {}),
        ...(savedScreen === 'result'
          ? { pendingQuestion: { questionId: 1, cards: 2, answer: 'A', correct: false } }
          : {}),
      };
      localStorage.setItem(
        'bgc.game.v1',
        JSON.stringify({ version: 1, state: { screen: savedScreen, game: v1Game } }),
      );
      const user = userEvent.setup();
      render(<App />);
      expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Continue game/ })).toBeNull();
      // New game has no replace notice: there is no game to replace.
      await user.click(screen.getByRole('button', { name: 'New game' }));
      expect(screen.queryByText('This will replace your current game.')).toBeNull();
    },
  );

  it('the menu "End game" asks first (no winner screen any more, D13)', async () => {
    const { user } = await renderGame();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'End game' }));
    expect(screen.getByRole('dialog', { name: 'End this game?' })).toBeInTheDocument();
    // The board stays behind the dialog (inert, so out of the accessibility tree).
    expect(document.querySelector('h1')).toHaveTextContent(/^Turn 1$/);
    expect(screen.queryByText(/we have a winner|wins!|play again/i)).toBeNull();
  });

  it('the menu "New board" asks first, then starts turn 1 with a new code', async () => {
    const { user } = await renderGame();
    const code = readCode();
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
    await openMenuItem(user, 'New board');
    expect(screen.getByRole('dialog', { name: 'Start a new board?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New board' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(readCode()).not.toBe(code);
    expect(startCells()).toHaveLength(4);
    expectNoTurnOrder();
  });

  describe('New board confirmation (#12, D8)', () => {
    /** Plays to turn 2 on a 3-player Hard game; returns the snapshot. */
    async function midGame() {
      const user = userEvent.setup();
      render(<App />);
      await startGame(user, { players: 3, difficulty: 'Hard' });
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
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

    it('Cancel keeps the exact same game (code, turn, board, players)', async () => {
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
      expect(after.starts).toHaveLength(3);
      const game = savedGame();
      expect(game).toMatchObject({
        code: after.code,
        turn: 1,
        playerCount: 3,
        difficulty: 'hard',
        pendingQuestion: null,
      });
      expect(game).not.toHaveProperty('activePlayer');
      expect(game).not.toHaveProperty('winner');
      expect(gridLabel()).toContain(
        `Goal on ${cellName(generateBoard(after.code, 1, 'hard').goal)}.`,
      );
    });
  });

  describe('End game (#26, D13)', () => {
    /** Plays to turn 2 on a 3-player Hard game, with one question answered; returns the snapshot. */
    async function midGame() {
      const user = userEvent.setup();
      const utils = render(<App />);
      await startGame(user, { players: 3, difficulty: 'Hard' });
      await user.click(screen.getByRole('button', { name: 'Question' }));
      await user.click(screen.getByRole('button', { name: 'Show the question' }));
      await user.click(screen.getByRole('button', { name: /^A: / }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      return { user, ...utils, snapshot: snapshot() };
    }

    const continueGame = () => screen.queryByRole('button', { name: /^Continue game/ });

    it('the board menu lists exactly New board, Lexicon, End game, Quit to home', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
      expect(items.map((m) => m.textContent)).toEqual([
        'New board',
        'Lexicon',
        'End game',
        'Quit to home',
      ]);
      expect(screen.queryByText(/winner/i)).toBeNull();
    });

    it('shows "End this game?" with its text, End game then Cancel, Cancel focused, board inert', async () => {
      const { user } = await midGame();
      await openMenuItem(user, 'End game');
      const dialog = screen.getByRole('dialog', { name: 'End this game?' });
      expect(
        within(dialog).getByText('The game will be deleted. You will go back to the home screen.'),
      ).toBeInTheDocument();
      expect(
        within(dialog)
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['End game', 'Cancel']);
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      const board = document.querySelector('[inert]');
      expect(board).not.toBeNull();
      expect(board).toContainElement(document.querySelector('h1'));
      expect(board).not.toContainElement(dialog);
    });

    it('confirm → Home, focus on its h1, no Continue game, the save holds no game', async () => {
      const { user } = await midGame();
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      const h1 = screen.getByRole('heading', { level: 1, name: APP_NAME });
      expect(h1).toHaveFocus();
      expect(continueGame()).toBeNull();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
        version: 2,
        state: { screen: 'home', game: null },
      });
      expect(savedGame()).toBeNull();
    });

    it('an ended game stays ended after a reload (remount): Home, no Continue game', async () => {
      const { user, unmount } = await midGame();
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      unmount();
      render(<App />);
      expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
      expect(continueGame()).toBeNull();
      expect(screen.queryByRole('button', { name: /resume|continue/i })).toBeNull();
      // New game has no replace notice: there is no game left to replace.
      await user.click(screen.getByRole('button', { name: 'New game' }));
      expect(screen.queryByText('This will replace your current game.')).toBeNull();
    });

    it('after End game, a new game starts at turn 1 with nothing asked', async () => {
      const { user, snapshot: before } = await midGame();
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      await startGame(user, { players: 2, difficulty: 'Easy' });
      expect(readCodeAny()).not.toBe(before.code);
      expect(startCells()).toHaveLength(2);
      expect(savedGame()).toMatchObject({ turn: 1, playerCount: 2, askedQuestionIds: [] });
    });

    it.each(['Cancel', 'Escape', 'backdrop'] as const)(
      '%s keeps the exact same game (code, turn, board, players, save)',
      async (how) => {
        const { user, snapshot: before } = await midGame();
        const saved = localStorage.getItem(STORAGE_KEY);
        await openMenuItem(user, 'End game');
        if (how === 'Cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }));
        else if (how === 'Escape') await user.keyboard('{Escape}');
        else await user.click(screen.getByTestId('modal-backdrop'));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(snapshot()).toEqual(before);
        expect(before.heading).toBe('Turn 2');
        expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
        expect(document.querySelector('[inert]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
      },
    );

    it('Cancel then a reload still restores the game', async () => {
      const { user, snapshot: before, unmount } = await midGame();
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      unmount();
      render(<App />);
      expect(snapshot()).toEqual(before);
    });

    it('a game quit to home can be continued, then ended from its board', async () => {
      const { user } = await midGame();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      await user.click(continueGame()!);
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
      expect(continueGame()).toBeNull();
    });

    it('a legacy save on the removed winner screen reopens on its board', () => {
      const game = gameReducer(initialState, {
        type: 'START_GAME',
        playerCount: 3,
        difficulty: 'medium',
        code: 'K7F2-9QX',
      }).game!;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 2, state: { screen: 'winner', game: { ...game, winner: 2 } } }),
      );
      render(<App />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
      expect(readCodeAny()).toBe('K7F2-9QX');
      expect(screen.queryByText(/wins!|play again/i)).toBeNull();
    });
  });
});

describe('App question flow (spec #13 / #14)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const savedAsked = (): number[] =>
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state.game.askedQuestionIds;

  /** Board → Question → popup; returns the dialog and X read from its title (no player, D11). */
  async function openPopup(user: User) {
    await user.click(screen.getByRole('button', { name: 'Question' }));
    const dialog = screen.getByRole('dialog', { name: /^Question for [123] cards?$/ });
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

  async function askAndAnswer(user: User, right: boolean) {
    const { cards } = await openPopup(user);
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    const q = currentQuestion();
    const key = right ? q.answer : choiceKeys(q).find((k) => k !== q.answer)!;
    await user.click(choice(q, key));
    return { q, key, cards };
  }

  it('the popup is titled "Question for X cards", X in 1–3; the board is inert behind it', async () => {
    const { user } = await renderGame();
    const { dialog } = await openPopup(user);
    expect(within(dialog).queryByText(/Player/)).toBeNull();
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
    'Cancel (%s) → board, same turn, question not marked asked, focus back on Question',
    async (how) => {
      const { user } = await renderGame();
      const grid = gridLabel();
      await openPopup(user);
      if (how === 'button') await user.click(screen.getByRole('button', { name: 'Cancel' }));
      else await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
      expect(gridLabel()).toBe(grid);
      expect(savedAsked()).toEqual([]);
      expect(screen.getByRole('button', { name: 'Question' })).toHaveFocus();
      expect(document.querySelector('[inert]')).toBeNull();
    },
  );

  it('Show the question → the question screen with 2–4 choice buttons and the popup X', async () => {
    const { user } = await renderGame();
    const { cards } = await openPopup(user);
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    const q = currentQuestion();
    const buttons = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons.length).toBeLessThanOrEqual(4);
    expect(buttons).toHaveLength(choiceKeys(q).length);
    expect(screen.getByText(`For ${cards} ${cards === 1 ? 'card' : 'cards'}`)).toBeInTheDocument();
    expect(screen.queryByText(/Player \d/)).toBeNull();
  });

  it('correct answer: "Correct!", "Draw X cards" with the popup X, explanation; Continue → board', async () => {
    const { user } = await renderGame();
    const grid = gridLabel();
    const { q, cards } = await askAndAnswer(user, true);
    expect(screen.queryByText(/Player/)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Correct!$/);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByText(`Draw ${cards} ${cards === 1 ? 'card' : 'cards'}`)).toBeInTheDocument();
    expect(screen.getByText(q.explanation)).toBeInTheDocument();
    expect(savedAsked()).toEqual([q.id]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(gridLabel()).toBe(grid);
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
    expectNoTurnOrder();
  });

  it('wrong answer: "Wrong answer", right choice shown with text, pick marked, no cards', async () => {
    const { user } = await renderGame();
    const { q, key } = await askAndAnswer(user, false);
    expect(screen.queryByText(/Player/)).toBeNull();
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
  });

  it('after questions and Continue, End turn draws the next board (same goal) (D11)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user, { players: 3, code: 'K7F2-9QX' });
    const grid = gridLabel();
    await askAndAnswer(user, true);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await askAndAnswer(user, false);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    // Still the same turn and board after two questions.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(gridLabel()).toBe(grid);
    expect(savedAsked()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Walls and enemies have moved$/,
    );
    const first = generateBoard('K7F2-9QX', 1, 'medium');
    const second = generateBoard('K7F2-9QX', 2, 'medium', first.goal);
    expect(screen.getByText(`The goal stays on ${cellName(first.goal)}`)).toBeInTheDocument();
    expect(gridLabel()).toContain(`Goal on ${cellName(first.goal)}.`);
    expect(gridLabel()).toContain(`on ${second.enemies.map(cellName).join(', ')}.`);
    await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 2$/);
    expect(savedAsked()).toHaveLength(2);
  });

  it('30 questions in a game are all different; the 31st works (new cycle)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user, { players: 2 });
    const texts: string[] = [];
    const total = ALL_QUESTIONS.length;
    expect(total).toBe(30);
    for (let i = 0; i < total + 1; i++) {
      const { q } = await askAndAnswer(user, i % 2 === 0);
      texts.push(q.question);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      if (i % 2 === 1) {
        await user.click(screen.getByRole('button', { name: 'End turn' }));
        await user.click(screen.getByRole('button', { name: /^Start turn \d+$/ }));
      }
    }
    expect(new Set(texts.slice(0, total)).size).toBe(total);
    expect(texts[total]).not.toBe(texts[total - 1]);
    expect(savedAsked()).toHaveLength(1);
  }, 60_000);

  it('a reload keeps the popup (same X)', async () => {
    const { user, unmount } = await renderGame();
    const { cards } = await openPopup(user);
    unmount();
    render(<App />);
    expect(
      screen.getByRole('dialog', {
        name: `Question for ${cards} ${cards === 1 ? 'card' : 'cards'}`,
      }),
    ).toBeInTheDocument();
  });

  it('a reload on the question screen keeps the same question', async () => {
    const { user, unmount } = await renderGame();
    await openPopup(user);
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
    const { q, key, cards } = await askAndAnswer(user, false);
    unmount();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Wrong answer$/);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(q.question);
    const items = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
    const pick = items.find((li) => li.textContent?.includes('Your answer'))!;
    expect(pick).toHaveTextContent(q.choices[key as 'A']!);
    expect(screen.queryByText(new RegExp(`^Draw ${cards}`))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
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
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      return { user, ...rest, before: snapshot() };
    }

    it('the board menu lists New board, Lexicon, End game, Quit to home', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
        'New board',
        'Lexicon',
        'End game',
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

    it('Quit → Home with "Continue game · Turn N · difficulty" (no code, D22); the game is saved', async () => {
      const { user, before } = await onTurn2();
      const game = savedGame();
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(h1()).toHaveFocus();
      expect(continueButton()).toHaveTextContent(`Turn 2 · ${before.difficulty}`);
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
      expect(continueButton()).toHaveTextContent(`Turn 2 · ${before.difficulty}`);
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
      expect(startCells()).toHaveLength(2);
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

    it('End game → Home clears the game: no Continue, even after a reload', async () => {
      const { user, unmount } = await renderGame();
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      expect(continueButton()).toBeNull();
      expect(savedGame()).toBeNull();
      unmount();
      render(<App />);
      expect(continueButton()).toBeNull();
    });
  });

  describe('Continue game returns to the exact screen (saved home state)', () => {
    const cases: [string, GameAction[], RegExp][] = [
      ['board', [], /^Turn 1$/],
      ['board', [{ type: 'END_TURN' }, { type: 'START_TURN' }], /^Turn 2$/],
      ['newBoard', [{ type: 'END_TURN' }], /^Walls and enemies have moved$/],
      ['questionPopup', toPopup, /^Turn 1$/],
      ['question', toQuestion, new RegExp(`^${escape(q.question)}$`)],
      ['result', toResult, /Correct!$/],
    ];

    it.each(cases)('%s (%#)', async (screenName, actions, heading) => {
      const playing = play(...actions);
      expect(playing.screen).toBe(screenName);
      saveState(gameReducer(playing, { type: 'QUIT_TO_HOME' }));
      const user = userEvent.setup();
      render(<App />);
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(continueButton()).toHaveTextContent(`Turn ${playing.game!.turn} · Medium`);
      await user.click(continueButton()!);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state).toEqual(playing);
      if (screenName === 'questionPopup') {
        expect(screen.getByRole('dialog', { name: /^Question for 2 cards$/ }));
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

    it('board: Question / End turn / menu items', async () => {
      const { user } = await renderGame();
      await user.click(screen.getByRole('button', { name: 'Question' }));
      expect(screen.getByRole('dialog', { name: /Question for/ })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expectNoTurnOrder();
      await user.click(screen.getByRole('button', { name: 'End turn' }));
      expect(h1()).toHaveTextContent('Walls and enemies have moved');
      await user.click(screen.getByRole('button', { name: 'Start turn 2' }));
      expect(h1()).toHaveTextContent('Turn 2');
      await openMenuItem(user, 'New board');
      await user.click(screen.getByRole('button', { name: 'New board' }));
      expect(h1()).toHaveTextContent('Turn 1');
      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      await user.click(continueButton()!);
      expect(h1()).toHaveTextContent('Turn 1');
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(continueButton()).toBeNull();
    });

    it('questionPopup → question → result → board → End game → home', async () => {
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
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      expect(h1()).toHaveTextContent(APP_NAME);
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

      await openMenuItem(user, 'End game');
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(h1()).toHaveTextContent('Turn 2');

      await openMenuItem(user, 'Quit to home');
      await user.click(screen.getByRole('button', { name: 'Quit' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(h1()).toHaveFocus();
      await user.click(continueButton()!);
      expect(h1()).toHaveTextContent('Turn 2');
      expect(h1()).toHaveFocus();

      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
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
      saveState(
        gameReducer(play({ type: 'END_TURN' }, { type: 'START_TURN' }), { type: 'QUIT_TO_HOME' }),
      );
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

    it.each(['Quit to home', 'New board', 'End game'] as const)(
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

    it('with the End game dialog open → closes it; the game is kept, End game still works', async () => {
      const { user } = await renderGame();
      await openMenuItem(user, 'End game');
      await systemBack();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(h1()).toHaveTextContent('Turn 1');
      expect(savedGame()).not.toBeNull();
      await openMenuItem(user, 'End game');
      await user.click(screen.getByRole('button', { name: 'End game' }));
      expect(h1()).toHaveTextContent(APP_NAME);
      expect(continueButton()).toBeNull();
    });
  });
});

/** Code of the board screen, whatever the difficulty. */
function readCodeAny(): string {
  return readCode();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
