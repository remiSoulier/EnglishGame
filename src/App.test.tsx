import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { cellName, generateBoard, parseCell } from './engine';

const players = () =>
  within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');

const gridLabel = () =>
  screen.getByRole('img', { name: /^Board, turn \d+\./ }).getAttribute('aria-label');

function readCode(): string {
  const text = screen.getByText(/^Code \S+ · Medium$/).textContent ?? '';
  return /^Code (\S+) ·/.exec(text)![1];
}

describe('App (board screen demo)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the board screen with a "Turn N" heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /^Turn \d+$/ })).toBeInTheDocument();
  });

  it('cycles players, ends the turn on the new board screen, then starts turn 2', async () => {
    const user = userEvent.setup();
    render(<App />);
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
    const user = userEvent.setup();
    render(<App />);
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
    const user = userEvent.setup();
    const first = render(<App />);
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Next player' }));
    }
    const code = readCode();
    const label = gridLabel();
    expect(players()[2]).toHaveAttribute('aria-current', 'true');
    first.unmount();

    render(<App />);
    expect(readCode()).toBe(code);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(players()[2]).toHaveAttribute('aria-current', 'true');
    expect(players()[0]).not.toHaveAttribute('aria-current');
    expect(gridLabel()).toBe(label);
  });

  it('restores a later turn and the new board screen after a reload', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const code = readCode();
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Next player' }));
    }
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    const label = gridLabel();
    first.unmount();

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

  it('starts a fresh game when nothing is saved', () => {
    const first = render(<App />);
    const code = readCode();
    first.unmount();
    localStorage.clear();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Turn 1$/);
    expect(readCode()).not.toBe(code);
  });

  it('the menu "We have a winner" shows the winner screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'We have a winner' }));
    expect(screen.getByRole('heading', { level: 1, name: 'We have a winner' })).toBeInTheDocument();
  });

  it('the menu "New board" starts turn 1 with a new code', async () => {
    const user = userEvent.setup();
    render(<App />);
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
