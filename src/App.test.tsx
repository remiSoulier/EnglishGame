import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { cellName, generateBoard, parseCell } from './engine';
import { APP_NAME } from './state/appInfo';

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
