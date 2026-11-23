import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cellName, generateBoard, newCode } from '../../engine';
import { NewBoardScreen } from './NewBoardScreen';

const CODE = newCode(() => 0.5);

describe('NewBoardScreen', () => {
  it('shows the new board, the goal reminder and starts the next turn', async () => {
    const first = generateBoard(CODE, 1, 'medium');
    const board = generateBoard(CODE, 2, 'medium', first.goal);
    const onStartTurn = vi.fn();
    render(<NewBoardScreen board={board} playerCount={4} onStartTurn={onStartTurn} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Copy the new walls and enemies onto your board.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Board, turn 2\./ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
    expect(screen.getByText(`The goal stays on ${cellName(first.goal)}`)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Start turn 2' }));
    expect(onStartTurn).toHaveBeenCalledTimes(1);
  });
});
