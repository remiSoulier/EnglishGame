import { describe, expect, it } from 'vitest';
import { generateBoard } from '../engine';
import questions from '../data/questions.json';
import { gameReducer } from './gameReducer';
import { canGoBack, NAVIGATION } from './navigation';
import type { Game, GameState, Screen } from './types';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    code: 'ABCD-EFG',
    difficulty: 'medium',
    playerCount: 2,
    turn: 1,
    board: generateBoard('ABCD-EFG', 1, 'medium'),
    askedQuestionIds: [],
    pendingQuestion: null,
    winner: null,
    ...overrides,
  };
}

const pending = { questionId: questions[0].id, cards: 2 as const };

describe('QUIT_TO_HOME / CONTINUE_GAME', () => {
  it.each<[Screen, Partial<Game>]>([
    ['board', {}],
    ['newBoard', { turn: 1 }],
    ['questionPopup', { pendingQuestion: pending }],
    ['question', { pendingQuestion: pending }],
    ['result', { pendingQuestion: { ...pending, answer: 'A', correct: false } }],
    ['winner', {}],
  ])('quits %s to home keeping the game, then continues on it', (screen, overrides) => {
    const game = makeGame(overrides);
    const home = gameReducer({ screen, game }, { type: 'QUIT_TO_HOME' });
    expect(home).toEqual({ screen: 'home', game: { ...game, lastScreen: screen } });
    expect(gameReducer(home, { type: 'CONTINUE_GAME' })).toEqual({ screen, game });
  });

  it('continues on the board when lastScreen needs a question the game does not have', () => {
    const game = makeGame();
    const next = gameReducer(
      { screen: 'home', game: { ...game, lastScreen: 'question' } },
      { type: 'CONTINUE_GAME' },
    );
    expect(next).toEqual({ screen: 'board', game });
  });

  it.each<GameState>([
    { screen: 'home', game: null },
    { screen: 'newGame', game: makeGame() },
    { screen: 'board', game: makeGame() },
  ])('CONTINUE_GAME is a no-op on $screen', (s) => {
    expect(gameReducer(s, { type: 'CONTINUE_GAME' })).toBe(s);
  });

  it.each<GameState>([
    { screen: 'home', game: makeGame() },
    { screen: 'newGame', game: makeGame() },
    { screen: 'board', game: null },
  ])('QUIT_TO_HOME is a no-op on $screen', (s) => {
    expect(gameReducer(s, { type: 'QUIT_TO_HOME' })).toBe(s);
  });

  it('New game then Back keeps the saved game; Start game replaces it', () => {
    const saved: GameState = { screen: 'home', game: { ...makeGame(), lastScreen: 'board' } };
    const newGame = gameReducer(saved, { type: 'GO_NEW_GAME' });
    expect(newGame).toEqual({ ...saved, screen: 'newGame' });
    expect(gameReducer(newGame, { type: 'BACK' })).toEqual(saved);
    const started = gameReducer(newGame, {
      type: 'START_GAME',
      playerCount: 3,
      difficulty: 'easy',
      code: 'HJKM-NPQ',
    });
    expect(started.screen).toBe('board');
    expect(started.game).toMatchObject({ code: 'HJKM-NPQ', playerCount: 3, turn: 1 });
    expect(started.game?.lastScreen).toBeUndefined();
  });
});

describe('canGoBack', () => {
  it('matches the screens where BACK changes the state', () => {
    const states: GameState[] = [
      { screen: 'home', game: null },
      { screen: 'newGame', game: null },
      { screen: 'board', game: makeGame() },
      { screen: 'questionPopup', game: makeGame({ pendingQuestion: pending }) },
      { screen: 'question', game: makeGame({ pendingQuestion: pending }) },
      { screen: 'newBoard', game: makeGame() },
      { screen: 'winner', game: makeGame() },
      { screen: 'winner', game: makeGame({ winner: 1 }) },
    ];
    for (const s of states) {
      expect(canGoBack(s), s.screen).toBe(gameReducer(s, { type: 'BACK' }) !== s);
    }
  });

  it('every Back exit of the map is a BACK action', () => {
    for (const exits of Object.values(NAVIGATION)) {
      for (const exit of exits.filter((e) => e.via === 'Back')) expect(exit.action).toBe('BACK');
    }
  });
});
