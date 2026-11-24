import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Difficulty } from '../../engine';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { BoardScreen, type BoardScreenProps } from './BoardScreen';

function setup(overrides: Partial<BoardScreenProps> = {}) {
  const props: BoardScreenProps = {
    board: FIXTURE_BOARD,
    playerCount: 4,
    onQuestion: vi.fn(),
    onEndTurn: vi.fn(),
    onNewBoard: vi.fn(),
    onWinner: vi.fn(),
    ...overrides,
  };
  const utils = render(<BoardScreen {...props} />);
  return { props, user: userEvent.setup(), ...utils };
}

describe('BoardScreen (spec screen 3)', () => {
  it('shows "Turn N" as the only h1', () => {
    setup({ board: { ...FIXTURE_BOARD, turn: 7 } });
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/^Turn 7$/);
  });

  it.each([
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ] as const)('shows the code and difficulty %s', (difficulty: Difficulty, label) => {
    setup({ board: { ...FIXTURE_BOARD, code: 'K7Q2', difficulty } });
    expect(screen.getByText(`Code K7Q2 · ${label}`)).toBeInTheDocument();
  });

  it.each([2, 3, 4] as const)('has no player bar with %i players (D11)', (playerCount) => {
    setup({ playerCount });
    expect(screen.queryByRole('list', { name: 'Players' })).not.toBeInTheDocument();
    expect(screen.queryByText(/now playing/i)).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('shows the labelled grid and the legend', () => {
    setup({ board: { ...FIXTURE_BOARD, turn: 2 } });
    expect(screen.getByRole('img', { name: /^Board, turn 2\./ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it.each([2, 3, 4] as const)(
    'with %i players always shows Question and End turn, never Next player (D11)',
    (playerCount) => {
      setup({ playerCount });
      expect(screen.getByRole('button', { name: 'Question' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'End turn' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /next player/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/next player/i)).not.toBeInTheDocument();
    },
  );

  it.each([1, 2, 9])('shows End turn on turn %i too', (turn) => {
    setup({ board: { ...FIXTURE_BOARD, turn } });
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
  });

  it('Question fires onQuestion only', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(props.onQuestion).toHaveBeenCalledTimes(1);
    for (const fn of [props.onEndTurn, props.onNewBoard, props.onWinner]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('End turn fires onEndTurn only, every time it is tapped', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(props.onEndTurn).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(props.onEndTurn).toHaveBeenCalledTimes(2);
    for (const fn of [props.onQuestion, props.onNewBoard, props.onWinner]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['New board', 'onNewBoard', 'onWinner'],
    ['We have a winner', 'onWinner', 'onNewBoard'],
  ] as const)('menu item "%s" fires %s and closes the menu', async (label, fired, notFired) => {
    const { props, user } = setup();
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await user.click(trigger);
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(2);
    await user.click(screen.getByRole('menuitem', { name: label }));
    expect(props[fired]).toHaveBeenCalledTimes(1);
    expect(props[notFired]).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('menu closes on Escape with focus back on the trigger', async () => {
    const { user } = setup();
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('menu closes on an outside click', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(props.onNewBoard).not.toHaveBeenCalled();
    expect(props.onWinner).not.toHaveBeenCalled();
  });

  it('every action is a real <button>', async () => {
    const { user, container } = setup();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const controls = [...screen.getAllByRole('button'), ...screen.getAllByRole('menuitem')];
    expect(controls.length).toBeGreaterThanOrEqual(5);
    controls.forEach((el) => expect(el.tagName).toBe('BUTTON'));
    expect(container.querySelectorAll('[onclick], a:not([href])')).toHaveLength(0);
    expect(container.querySelectorAll('div[role="button"], span[role="button"]')).toHaveLength(0);
  });
});
