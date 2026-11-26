/**
 * Task #36 (decision D19) — each player picks a character on the New game screen (all
 * different), the board shows the chosen characters on the start cells, the choice is saved
 * with the game and kept by "New board". Games saved before D19 still load (default characters).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Grid } from '../components/Grid';
import { generateBoard } from '../engine';
import { NewGameScreen } from '../screens/NewGame';
import { gameReducer, initialState } from './gameReducer';
import {
  defaultCharacters,
  isValidCharacters,
  pickCharacter,
  PLAYER_CHARACTERS,
  playerCharacter,
} from './players';
import { loadState, saveState, STORAGE_KEY, STORAGE_VERSION } from './storage';

const CODE = 'ABCD-EFG';

const start = (characters?: number[], playerCount: 2 | 3 | 4 = 3) =>
  gameReducer(initialState, {
    type: 'START_GAME',
    playerCount,
    difficulty: 'medium',
    code: CODE,
    characters,
  });

describe('players helpers', () => {
  it('uses the names of the art', () => {
    expect(PLAYER_CHARACTERS.map((c) => c.name)).toEqual(['Kitkat', 'Batman', 'Mushi', 'Gus']);
  });

  it('playerCharacter follows the chosen characters, else player i → character i', () => {
    expect(playerCharacter(0, [2, 0])).toBe(PLAYER_CHARACTERS[2]);
    expect(playerCharacter(1, [2, 0])).toBe(PLAYER_CHARACTERS[0]);
    expect(playerCharacter(1)).toBe(PLAYER_CHARACTERS[1]);
    expect(playerCharacter(0, [9])).toBe(PLAYER_CHARACTERS[0]);
  });

  it('isValidCharacters: one per player, known, all different', () => {
    expect(isValidCharacters([3, 1], 2)).toBe(true);
    expect(isValidCharacters([1, 1], 2)).toBe(false);
    expect(isValidCharacters([0, 1, 2], 2)).toBe(false);
    expect(isValidCharacters([0, 4], 2)).toBe(false);
    expect(isValidCharacters([0, 1.5], 2)).toBe(false);
    expect(isValidCharacters('01', 2)).toBe(false);
    expect(defaultCharacters(3)).toEqual([0, 1, 2]);
  });

  it('pickCharacter swaps with the player who had the character', () => {
    expect(pickCharacter([0, 1, 2, 3], 0, 2)).toEqual([2, 1, 0, 3]);
    expect(pickCharacter([0, 1, 2, 3], 1, 1)).toEqual([0, 1, 2, 3]);
    expect(pickCharacter([0, 1], 1, 3)).toEqual([0, 3]);
  });
});

describe('game state', () => {
  beforeEach(() => localStorage.clear());

  it('START_GAME keeps valid characters and falls back to the defaults otherwise', () => {
    expect(start([3, 0, 2]).game?.characters).toEqual([3, 0, 2]);
    expect(start([1, 1, 2]).game?.characters).toEqual([0, 1, 2]);
    expect(start([0, 1]).game?.characters).toEqual([0, 1, 2]);
    expect(start().game?.characters).toEqual([0, 1, 2]);
  });

  it('NEW_BOARD keeps the characters', () => {
    const next = gameReducer(start([3, 0, 2]), { type: 'NEW_BOARD', code: 'K7F2-9QX' });
    expect(next.game?.code).toBe('K7F2-9QX');
    expect(next.game?.characters).toEqual([3, 0, 2]);
  });

  it('saves and reloads the characters', () => {
    const state = start([3, 0, 2]);
    saveState(state);
    expect(loadState()?.game?.characters).toEqual([3, 0, 2]);
  });

  it('still loads a game saved before D19 (no characters)', () => {
    const { characters: _drop, ...old } = start().game!;
    void _drop;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, state: { screen: 'board', game: old } }),
    );
    const loaded = loadState();
    expect(loaded?.game).not.toBeNull();
    expect(loaded?.game?.characters).toBeUndefined();
  });

  it('drops a save whose characters are invalid', () => {
    const game = { ...start().game!, characters: [1, 1, 1] };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, state: { screen: 'board', game } }),
    );
    expect(loadState()).toBeNull();
  });
});

describe('board', () => {
  it('draws the chosen character on each start cell', () => {
    const { container } = render(
      <Grid board={generateBoard(CODE, 1, 'medium')} playerCount={2} characters={[3, 2]} />,
    );
    const hrefs = [...container.querySelectorAll('[data-cell] image')]
      .map((img) => img.getAttribute('href'))
      .filter((href) => href?.includes('char-gus') || href?.includes('char-toad'));
    expect(hrefs).toContain('/art/char-gus.webp');
    expect(hrefs).toContain('/art/char-toad.webp');
    expect(container.innerHTML).not.toContain('char-kitkat');
  });
});

describe('New game screen', () => {
  it('shows one character group per player, with the 4 characters', async () => {
    const user = userEvent.setup();
    render(<NewGameScreen onStart={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByRole('group', { name: /^Player \d$/ })).toHaveLength(2);
    await user.click(screen.getByRole('radio', { name: '4' }));
    const groups = screen.getAllByRole('group', { name: /^Player \d$/ });
    expect(groups).toHaveLength(4);
    for (const group of groups) expect(within(group).getAllByRole('radio')).toHaveLength(4);
  });

  it('picking a taken character swaps it, and Start sends the choice', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<NewGameScreen onStart={onStart} onBack={vi.fn()} />);
    const p1 = screen.getByRole('group', { name: 'Player 1' });
    const p2 = screen.getByRole('group', { name: 'Player 2' });
    await user.click(within(p1).getByRole('radio', { name: 'Batman' }));
    expect(within(p1).getByRole('radio', { name: 'Batman' })).toBeChecked();
    expect(within(p2).getByRole('radio', { name: 'Kitkat' })).toBeChecked();
    await user.click(within(p2).getByRole('radio', { name: 'Gus' }));
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart.mock.calls[0][0].characters).toEqual([1, 3]);
  });
});
