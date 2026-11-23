import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from './GameContext';
import { gameReducer, initialState } from './gameReducer';
import { STORAGE_KEY, saveState } from './storage';
import type { GameState } from './types';

const CODE = 'ABCD-EFG';

const started = (): GameState =>
  gameReducer(initialState, { type: 'START_GAME', playerCount: 2, difficulty: 'easy', code: CODE });

const saved = (): unknown => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

function wrapper(fallbackState?: () => GameState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GameProvider fallbackState={fallbackState}>{children}</GameProvider>;
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGame', () => {
  it('throws outside a GameProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useGame())).toThrow('useGame must be used inside a GameProvider');
  });
});

describe('GameProvider', () => {
  it('starts from initialState when nothing is saved and no fallback is given', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper() });
    expect(result.current.state).toEqual(initialState);
  });

  it('starts from fallbackState when nothing is saved', () => {
    const fallback = vi.fn(started);
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(fallback) });
    expect(result.current.state).toEqual(started());
    expect(fallback).toHaveBeenCalled();
  });

  it('loads the saved state and ignores the fallback', () => {
    let s = started();
    s = gameReducer(s, { type: 'NEXT_PLAYER' });
    saveState(s);
    const fallback = vi.fn(() => initialState);
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(fallback) });
    expect(result.current.state).toEqual(s);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('uses the fallback when the saved state is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupted');
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(started) });
    expect(result.current.state).toEqual(started());
  });

  it('saves the initial state on mount', () => {
    renderHook(() => useGame(), { wrapper: wrapper(started) });
    expect(saved()).toEqual({ version: 1, state: started() });
  });

  it('saves after each dispatch', () => {
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(started) });

    act(() => result.current.dispatch({ type: 'NEXT_PLAYER' }));
    expect(result.current.state.game!.activePlayer).toBe(2);
    expect(saved()).toEqual({ version: 1, state: result.current.state });

    act(() => result.current.dispatch({ type: 'END_TURN' }));
    expect(result.current.state.screen).toBe('newBoard');
    expect(saved()).toEqual({ version: 1, state: result.current.state });

    act(() => result.current.dispatch({ type: 'GO_HOME' }));
    expect(saved()).toEqual({ version: 1, state: initialState });
  });

  it('does not crash when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useGame(), { wrapper: wrapper(started) });
    expect(result.current.state).toEqual(started());
    act(() => result.current.dispatch({ type: 'NEXT_PLAYER' }));
    expect(result.current.state.game!.activePlayer).toBe(2);
  });

  it('a remount restores the state reached before unmounting', () => {
    const first = renderHook(() => useGame(), { wrapper: wrapper(started) });
    act(() => first.result.current.dispatch({ type: 'NEXT_PLAYER' }));
    act(() => first.result.current.dispatch({ type: 'END_TURN' }));
    const reached = first.result.current.state;
    first.unmount();

    const second = renderHook(() => useGame(), { wrapper: wrapper(() => initialState) });
    expect(second.result.current.state).toEqual(reached);
  });

  it('gives consumers the state and a working dispatch', async () => {
    function Consumer() {
      const { state, dispatch } = useGame();
      return (
        <button type="button" onClick={() => dispatch({ type: 'NEXT_PLAYER' })}>
          Player {state.game?.activePlayer}
        </button>
      );
    }
    render(
      <GameProvider fallbackState={started}>
        <Consumer />
      </GameProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Player 1' }));
    expect(screen.getByRole('button', { name: 'Player 2' })).toBeInTheDocument();
  });
});
