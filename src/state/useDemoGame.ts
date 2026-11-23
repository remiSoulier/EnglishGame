import { useState } from 'react';
import { generateBoard, newCode, type Board, type Difficulty } from '../engine';

export type DemoScreen = 'board' | 'newBoard';

export interface DemoGame {
  screen: DemoScreen;
  board: Board;
  playerCount: 4;
  activePlayer: number;
  nextPlayer: () => void;
  endTurn: () => void;
  startTurn: () => void;
}

const DIFFICULTY: Difficulty = 'medium';
const PLAYER_COUNT = 4;

interface DemoState {
  screen: DemoScreen;
  board: Board;
  activePlayer: number;
}

function initialState(): DemoState {
  return { screen: 'board', board: generateBoard(newCode(), 1, DIFFICULTY), activePlayer: 1 };
}

/**
 * Temporary demo game (task #8): a real code, Next player, End turn → redrawn board.
 * To be replaced by the game reducer + context (#10) and navigation (#12).
 */
export function useDemoGame(): DemoGame {
  const [state, setState] = useState(initialState);

  return {
    ...state,
    playerCount: PLAYER_COUNT,
    nextPlayer: () =>
      setState((s) => ({ ...s, activePlayer: Math.min(s.activePlayer + 1, PLAYER_COUNT) })),
    endTurn: () =>
      setState((s) =>
        s.screen === 'board'
          ? {
              screen: 'newBoard',
              board: generateBoard(
                s.board.code,
                s.board.turn + 1,
                s.board.difficulty,
                s.board.goal,
              ),
              activePlayer: 1,
            }
          : s,
      ),
    startTurn: () => setState((s) => ({ ...s, screen: 'board', activePlayer: 1 })),
  };
}
