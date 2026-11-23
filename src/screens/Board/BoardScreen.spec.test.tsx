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
    activePlayer: 1,
    onQuestion: vi.fn(),
    onNextPlayer: vi.fn(),
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

  it('shows the player bar with the active player', () => {
    setup({ playerCount: 3, activePlayer: 2 });
    const bar = screen.getByRole('list', { name: 'Players' });
    const items = within(bar).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveTextContent('now playing');
  });

  it('shows the labelled grid and the legend', () => {
    setup({ board: { ...FIXTURE_BOARD, turn: 2 } });
    expect(screen.getByRole('img', { name: /^Board, turn 2\./ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it.each([
    [2, 1, 'Next player'],
    [2, 2, 'End turn'],
    [3, 2, 'Next player'],
    [3, 3, 'End turn'],
    [4, 3, 'Next player'],
    [4, 4, 'End turn'],
  ] as const)('with %i players and P%i active shows "%s"', (playerCount, activePlayer, label) => {
    setup({ playerCount, activePlayer });
    const other = label === 'End turn' ? 'Next player' : 'End turn';
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: other })).not.toBeInTheDocument();
  });

  it('Question fires onQuestion only', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(props.onQuestion).toHaveBeenCalledTimes(1);
    for (const fn of [props.onNextPlayer, props.onEndTurn, props.onNewBoard, props.onWinner]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('Next player fires onNextPlayer only', async () => {
    const { props, user } = setup({ activePlayer: 2 });
    await user.click(screen.getByRole('button', { name: 'Next player' }));
    expect(props.onNextPlayer).toHaveBeenCalledTimes(1);
    expect(props.onEndTurn).not.toHaveBeenCalled();
  });

  it('End turn fires onEndTurn only', async () => {
    const { props, user } = setup({ activePlayer: 4 });
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(props.onEndTurn).toHaveBeenCalledTimes(1);
    expect(props.onNextPlayer).not.toHaveBeenCalled();
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
