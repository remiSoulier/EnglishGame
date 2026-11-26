/**
 * Decision D24 — end-of-turn shuffle: the new board opens with a quick shuffle (the board riffles
 * like a deck of cards, then walls and enemies are dealt one by one). Decorative only: everything
 * is in the DOM from the first frame, and there is no motion with prefers-reduced-motion.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { generateBoard } from '../../engine';
import { NewBoardScreen } from './NewBoardScreen';

const CSS = readFileSync(
  resolve(process.cwd(), 'src/screens/NewBoard/NewBoardScreen.module.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('End-of-turn shuffle (D24)', () => {
  it('wraps the whole new board, with every wall and enemy already there', () => {
    const first = generateBoard('K7F2-9QX', 1, 'medium');
    const board = generateBoard('K7F2-9QX', 2, 'medium', first.goal);
    render(<NewBoardScreen board={board} playerCount={4} onStartTurn={vi.fn()} />);
    const shuffle = screen.getByTestId('board-shuffle');
    expect(within(shuffle).getByRole('img', { name: /^Board, turn 2\./ })).toBeInTheDocument();
    expect(within(shuffle).getByTestId('walls').children).toHaveLength(board.walls.length);
    expect(within(shuffle).getByTestId('wall-halos').children).toHaveLength(board.walls.length);
    expect(within(shuffle).getByTestId('enemies').children).toHaveLength(board.enemies.length);
  });

  it('animates the board, then deals the walls (and halos), wall ends and enemies', () => {
    expect(CSS).toMatch(/\.shuffle\s*\{[^}]*animation:\s*shuffle\s/);
    for (const group of ['wall-halos', 'walls', 'wall-ends', 'enemies']) {
      expect(CSS).toContain(`.shuffle :global([data-testid='${group}']) > *`);
    }
    expect(CSS).toMatch(/@keyframes shuffle/);
    expect(CSS).toMatch(/@keyframes deal/);
  });

  it('has no motion with prefers-reduced-motion', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1];
    expect(block).toBeDefined();
    expect(block).toMatch(/\.shuffle,/);
    expect(block).toMatch(/animation:\s*none/);
  });
});
