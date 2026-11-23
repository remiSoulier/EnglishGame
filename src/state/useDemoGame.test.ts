import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateBoard, type Board } from '../engine';
import { useDemoGame } from './useDemoGame';

const CODES = ['K7QP-2MX', 'ABCD-234', 'ZZZZ-999'];
let nextCode = CODES[0];

vi.mock('../engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine')>();
  return { ...actual, newCode: vi.fn(() => nextCode) };
});

function enemiesKey(board: Board): string {
  return JSON.stringify(board.enemies);
}

function wallsKey(board: Board): string {
  return JSON.stringify(board.walls);
}

describe('useDemoGame', () => {
  beforeEach(() => {
    nextCode = CODES[0];
  });

  it('starts on turn 1 of generateBoard(code, 1, medium) with 4 players, P1 active', () => {
    const { result } = renderHook(() => useDemoGame());
    expect(result.current.screen).toBe('board');
    expect(result.current.playerCount).toBe(4);
    expect(result.current.activePlayer).toBe(1);
    expect(result.current.board).toEqual(generateBoard(CODES[0], 1, 'medium'));
  });

  it('nextPlayer advances and stops at the last player', () => {
    const { result } = renderHook(() => useDemoGame());
    for (let i = 0; i < 5; i++) act(() => result.current.nextPlayer());
    expect(result.current.activePlayer).toBe(4);
  });

  it.each(CODES)(
    'endTurn shows exactly generateBoard(code, turn + 1, difficulty, goal) (%s)',
    (code) => {
      nextCode = code;
      const { result } = renderHook(() => useDemoGame());
      const first = result.current.board;
      for (let i = 0; i < 3; i++) act(() => result.current.nextPlayer());

      act(() => result.current.endTurn());
      expect(result.current.screen).toBe('newBoard');
      expect(result.current.activePlayer).toBe(1);
      expect(result.current.board).toEqual(generateBoard(code, 2, 'medium', first.goal));

      act(() => result.current.startTurn());
      expect(result.current.screen).toBe('board');
      expect(result.current.activePlayer).toBe(1);
      expect(result.current.board.turn).toBe(2);
    },
  );

  it('keeps code, difficulty and goal over several turns while walls and enemies move', () => {
    const { result } = renderHook(() => useDemoGame());
    const boards: Board[] = [result.current.board];
    for (let turn = 2; turn <= 6; turn++) {
      act(() => result.current.endTurn());
      act(() => result.current.startTurn());
      const board = result.current.board;
      expect(board.turn).toBe(turn);
      expect(board.code).toBe(CODES[0]);
      expect(board.difficulty).toBe('medium');
      expect(board.goal).toEqual(boards[0].goal);
      expect(board).toEqual(generateBoard(CODES[0], turn, 'medium', boards[0].goal));
      boards.push(board);
    }
    for (let i = 1; i < boards.length; i++) {
      const prev = boards[i - 1];
      const cur = boards[i];
      expect(enemiesKey(cur), `enemies of turn ${cur.turn} moved`).not.toBe(enemiesKey(prev));
      expect(wallsKey(cur), `walls of turn ${cur.turn} moved`).not.toBe(wallsKey(prev));
    }
  });

  it('endTurn is ignored while the new board screen is shown (no double redraw)', () => {
    const { result } = renderHook(() => useDemoGame());
    act(() => result.current.endTurn());
    const shown = result.current.board;
    act(() => result.current.endTurn());
    expect(result.current.board).toBe(shown);
    expect(result.current.board.turn).toBe(2);
  });

  it('same code + same turn gives the same board (determinism across games)', () => {
    const a = renderHook(() => useDemoGame()).result;
    const b = renderHook(() => useDemoGame()).result;
    expect(a.current.board).toEqual(b.current.board);
    act(() => a.current.endTurn());
    act(() => b.current.endTurn());
    expect(a.current.board).toEqual(b.current.board);
  });
});
