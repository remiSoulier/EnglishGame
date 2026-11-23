import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { gameReducer, initialState, type GameAction } from './gameReducer';
import { loadState, saveState } from './storage';
import type { GameState } from './types';

export interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export interface GameProviderProps {
  children: ReactNode;
  /** State to start from when nothing is saved. Defaults to `initialState` (home screen). */
  fallbackState?: () => GameState;
}

/** Holds the game state (restored from localStorage, saved on every change). */
export function GameProvider({ children, fallbackState }: GameProviderProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => loadState() ?? fallbackState?.() ?? initialState,
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  return <GameContext value={{ state, dispatch }}>{children}</GameContext>;
}

/** Game state and dispatch. Throws when used outside a `GameProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) throw new Error('useGame must be used inside a GameProvider');
  return value;
}
