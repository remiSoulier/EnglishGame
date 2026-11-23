import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cellName, generateBoard, type Board } from '../../engine';
import { NewBoardScreen, type NewBoardScreenProps } from './NewBoardScreen';

const CODE = 'K7QP-2MX';
const FIRST = generateBoard(CODE, 1, 'medium');

function boardFor(turn: number): Board {
  return generateBoard(CODE, turn, 'medium', FIRST.goal);
}

function setup(overrides: Partial<NewBoardScreenProps> = {}) {
  const props: NewBoardScreenProps = {
    board: boardFor(2),
    playerCount: 4,
    onStartTurn: vi.fn(),
    ...overrides,
  };
  const utils = render(<NewBoardScreen {...props} />);
  return { props, user: userEvent.setup(), ...utils };
}

describe('NewBoardScreen (spec screen 7)', () => {
  it('has "Walls and enemies have moved" as the only h1', () => {
    setup();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/^Walls and enemies have moved$/);
  });

  it('tells the players to copy the new board', () => {
    setup();
    expect(screen.getByText('Copy the new walls and enemies onto your board.')).toBeVisible();
  });

  it.each([2, 3, 7])('shows the grid of turn %i with its accessible summary', (turn) => {
    const board = boardFor(turn);
    setup({ board });
    const grid = screen.getByRole('img', { name: new RegExp(`^Board, turn ${turn}\\.`) });
    const label = grid.getAttribute('aria-label') ?? '';
    expect(label).toContain(`Goal on ${cellName(FIRST.goal)}.`);
    for (const enemy of board.enemies) expect(label).toContain(cellName(enemy));
  });

  it('shows the legend', () => {
    setup();
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it.each([
    { x: 4, y: 4 },
    { x: 1, y: 6 },
    { x: 7, y: 2 },
  ])('reminds that the goal stays on its cell (%o)', (goal) => {
    setup({ board: generateBoard(CODE, 3, 'medium', goal) });
    expect(screen.getByText(`The goal stays on ${cellName(goal)}`)).toBeVisible();
  });

  it.each([2, 5, 12])(
    'labels the button "Start turn %i" and calls onStartTurn once',
    async (turn) => {
      const { props, user } = setup({ board: boardFor(turn) });
      const button = screen.getByRole('button', { name: `Start turn ${turn}` });
      expect(button.tagName).toBe('BUTTON');
      await user.click(button);
      expect(props.onStartTurn).toHaveBeenCalledTimes(1);
    },
  );

  it('can be activated with the keyboard', async () => {
    const { props, user } = setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Start turn 2' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(props.onStartTurn).toHaveBeenCalledTimes(1);
  });
});
