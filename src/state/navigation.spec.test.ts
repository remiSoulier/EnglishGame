import { describe, expect, it } from 'vitest';
import questions from '../data/questions.json';
import { generateBoard } from '../engine';
import { gameReducer, type GameAction } from './gameReducer';
import {
  canGoBack,
  HOW_TO_PLAY,
  HOW_TO_PLAY_EXITS,
  HOW_TO_PLAY_OPENERS,
  OPEN_HOW_TO_PLAY,
  LEXICON,
  LEXICON_EXITS,
  LEXICON_OPENERS,
  NAVIGATION,
  OPEN_LEXICON,
  type NavigationExit,
} from './navigation';
import type { Game, GameState, Screen } from './types';

/** Spec #12 / decision D10: the navigation map matches the reducer, with no dead end. */

const SCREENS: Screen[] = [
  'home',
  'newGame',
  'board',
  'questionPopup',
  'question',
  'result',
  'newBoard',
];

const q1 = questions[0];

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    code: 'ABCD-EFG',
    difficulty: 'medium',
    playerCount: 3,
    turn: 1,
    board: generateBoard('ABCD-EFG', 1, 'medium'),
    askedQuestionIds: [],
    pendingQuestion: null,
    ...overrides,
  };
}

const pending = { questionId: q1.id, cards: 2 as const };
const answered = { ...pending, answer: 'A' as const, correct: q1.answer === 'A' };

/** A state on `screen` from which `exit` is available, and the action (with its payload). */
function fixture(screen: Screen, exit: NavigationExit): [GameState, GameAction] {
  const action = { type: exit.action } as GameAction;
  switch (exit.action) {
    case 'CONTINUE_GAME': {
      const needs: Partial<Game> =
        exit.to === 'result'
          ? { pendingQuestion: answered }
          : exit.to === 'questionPopup' || exit.to === 'question'
            ? { pendingQuestion: pending }
            : {};
      return [
        { screen, game: { ...makeGame(needs), lastScreen: exit.to as Game['lastScreen'] } },
        action,
      ];
    }
    case 'GO_NEW_GAME':
      return [{ screen, game: null }, action];
    case 'START_GAME':
      return [
        { screen, game: null },
        { type: 'START_GAME', playerCount: 2, difficulty: 'easy', code: 'HJKM-NPQ' },
      ];
    case 'BACK':
      if (screen === 'newGame') return [{ screen, game: null }, action];
      if (screen === 'questionPopup') {
        return [{ screen, game: makeGame({ pendingQuestion: pending }) }, action];
      }
      return [{ screen, game: makeGame() }, action];
    case 'OPEN_QUESTION':
      return [
        { screen, game: makeGame() },
        { type: 'OPEN_QUESTION', questionId: q1.id, cards: 1 },
      ];
    case 'END_TURN':
      // Any board state (D11: no turn order; D13: no winner).
      return [{ screen, game: makeGame() }, action];
    case 'NEW_BOARD':
      return [
        { screen, game: makeGame() },
        { type: 'NEW_BOARD', code: 'HJKM-NPQ' },
      ];
    case 'SHOW_QUESTION':
    case 'CANCEL_QUESTION':
      return [{ screen, game: makeGame({ pendingQuestion: pending }) }, action];
    case 'ANSWER_QUESTION':
      return [
        { screen, game: makeGame({ pendingQuestion: pending }) },
        { type: 'ANSWER_QUESTION', answer: 'B' },
      ];
    case 'CONTINUE':
      return [{ screen, game: makeGame({ pendingQuestion: answered }) }, action];
    default:
      return [{ screen, game: makeGame() }, action];
  }
}

describe('NAVIGATION map (#12)', () => {
  it('lists every screen, and only screens (or the Lexicon drawn over one, D25)', () => {
    expect(Object.keys(NAVIGATION).sort()).toEqual([...SCREENS].sort());
    for (const exits of Object.values(NAVIGATION)) {
      for (const exit of exits) expect([...SCREENS, LEXICON, HOW_TO_PLAY]).toContain(exit.to);
    }
  });

  it.each(SCREENS)('%s has at least one exit (no dead end)', (screen) => {
    expect(NAVIGATION[screen].length).toBeGreaterThan(0);
  });

  it.each(SCREENS)('%s can always lead somewhere else than itself', (screen) => {
    expect(NAVIGATION[screen].some((e) => e.to !== screen)).toBe(true);
  });

  it('only Question (one try) has neither Back nor Cancel nor Quit; it leads to Result only', () => {
    const backLike = (e: NavigationExit) =>
      ['BACK', 'CANCEL_QUESTION', 'QUIT_TO_HOME', 'END_GAME'].includes(e.action);
    expect(NAVIGATION.question.some(backLike)).toBe(false);
    expect(NAVIGATION.question.map((e) => e.to)).toEqual(['result']);
    // In-app Back exists exactly where canGoBack can be true.
    const withBack = SCREENS.filter((s) => NAVIGATION[s].some((e) => e.action === 'BACK'));
    expect(withBack.sort()).toEqual(['newGame', 'questionPopup']);
  });

  it('every screen is reachable from home, and home is reachable from every screen', () => {
    const reach = (from: Screen, edges: (s: Screen) => Screen[]) => {
      const seen = new Set<Screen>([from]);
      const todo = [from];
      while (todo.length) {
        for (const next of edges(todo.pop()!)) {
          if (!seen.has(next)) {
            seen.add(next);
            todo.push(next);
          }
        }
      }
      return seen;
    };
    const out = (s: Screen) =>
      NAVIGATION[s]
        .map((e) => e.to)
        .filter((to): to is Screen => to !== LEXICON && to !== HOW_TO_PLAY);
    expect([...reach('home', out)].sort()).toEqual([...SCREENS].sort());
    const into = (s: Screen) => SCREENS.filter((from) => out(from).includes(s));
    expect([...reach('home', into)].sort()).toEqual([...SCREENS].sort());
  });

  it('board menu offers Quit to home (confirmed) → home', () => {
    expect(NAVIGATION.board).toContainEqual({
      via: 'Menu › Quit to home › Quit',
      action: 'QUIT_TO_HOME',
      to: 'home',
    });
  });

  it('board menu offers New board, Lexicon (no confirmation, D25), End game, Quit to home', () => {
    const menu = NAVIGATION.board.filter((e) => e.via.startsWith('Menu › '));
    expect(menu).toEqual([
      { via: 'Menu › New board › New board', action: 'NEW_BOARD', to: 'board' },
      { via: 'Menu › Lexicon', action: OPEN_LEXICON, to: LEXICON },
      { via: 'Menu › End game › End game', action: 'END_GAME', to: 'home' },
      { via: 'Menu › Quit to home › Quit', action: 'QUIT_TO_HOME', to: 'home' },
    ]);
  });

  it('has no winner screen, winner action nor "We have a winner" (D13)', () => {
    expect(Object.keys(NAVIGATION)).not.toContain('winner');
    const all = Object.values(NAVIGATION).flat();
    for (const e of all) {
      expect(e.to).not.toBe('winner');
      expect(['OPEN_WINNER', 'DECLARE_WINNER', 'PLAY_AGAIN', 'GO_HOME']).not.toContain(e.action);
      expect(e.via).not.toMatch(/winner|play again/i);
    }
  });

  it('End game is the only exit that drops the game (D13)', () => {
    const [state, action] = fixture('board', {
      via: 'Menu › End game › End game',
      action: 'END_GAME',
      to: 'home',
    });
    expect(gameReducer(state, action)).toEqual({ screen: 'home', game: null });
  });

  it('board offers Question and End turn, and no Next player (D11)', () => {
    const board = NAVIGATION.board;
    expect(board).toContainEqual({ via: 'Question', action: 'OPEN_QUESTION', to: 'questionPopup' });
    expect(board).toContainEqual({ via: 'End turn', action: 'END_TURN', to: 'newBoard' });
    const all = Object.values(NAVIGATION).flat();
    expect(all.some((e) => e.action === 'NEXT_PLAYER' || e.via === 'Next player')).toBe(false);
  });

  it('result offers only Continue → board (D11)', () => {
    expect(NAVIGATION.result).toEqual([{ via: 'Continue', action: 'CONTINUE', to: 'board' }]);
  });

  it('home offers Continue game to every game screen', () => {
    const continues = NAVIGATION.home.filter((e) => e.action === 'CONTINUE_GAME').map((e) => e.to);
    expect(continues.sort()).toEqual(
      ['board', 'newBoard', 'questionPopup', 'question', 'result'].sort(),
    );
  });

  it('the Lexicon opens from Home and the board only, as local UI state (D25)', () => {
    expect([...LEXICON_OPENERS].sort()).toEqual(['board', 'home']);
    const toLexicon = Object.values(NAVIGATION)
      .flat()
      .filter((e) => e.to === LEXICON);
    expect(toLexicon.map((e) => e.via)).toEqual(['Lexicon', 'Menu › Lexicon']);
    for (const e of toLexicon) expect(e.action).toBe(OPEN_LEXICON);
    // Back always leads out: See all → entry → the screen it was opened over.
    expect(LEXICON_EXITS.filter((e) => e.via === 'Back').map((e) => [e.from, e.to])).toEqual([
      ['all', 'main'],
      ['main', 'the screen it was opened over (home or board)'],
    ]);
  });

  it('How to play opens from Home only, as local UI state, and leads Home or to New game (D28)', () => {
    expect(HOW_TO_PLAY_OPENERS).toEqual(['home']);
    expect(NAVIGATION.home).toContainEqual({
      via: 'How to play',
      action: OPEN_HOW_TO_PLAY,
      to: HOW_TO_PLAY,
    });
    expect([...new Set(HOW_TO_PLAY_EXITS.map((e) => e.to))].sort()).toEqual(['home', 'newGame']);
    const home: GameState = { screen: 'home', game: null };
    expect(gameReducer(home, { type: OPEN_HOW_TO_PLAY } as unknown as GameAction)).toBe(home);
    // "Start a game" is the existing New game action.
    expect(gameReducer(home, { type: 'GO_NEW_GAME' }).screen).toBe('newGame');
  });

  it('opening the Lexicon is not a reducer action (the game is untouched, D25)', () => {
    for (const screen of LEXICON_OPENERS) {
      const state: GameState = { screen, game: makeGame() };
      expect(gameReducer(state, { type: OPEN_LEXICON } as unknown as GameAction)).toBe(state);
    }
  });

  // Reducer exits only (the Lexicon is local UI state, checked above).
  const allExits = SCREENS.flatMap((screen) =>
    NAVIGATION[screen]
      .filter((exit) => exit.to !== LEXICON && exit.to !== HOW_TO_PLAY)
      .map((exit) => [screen, exit.via, exit.to, exit] as const),
  );

  it.each(allExits)('%s › %s leads to %s in the reducer', (screen, _via, to, exit) => {
    const [state, action] = fixture(screen, exit);
    const next = gameReducer(state, action);
    expect(next).not.toBe(state);
    expect(next.screen).toBe(to);
  });
});

describe('canGoBack (#12 D10)', () => {
  const cases: [GameState, boolean][] = [
    [{ screen: 'home', game: null }, false],
    [{ screen: 'home', game: { ...makeGame(), lastScreen: 'board' } }, false],
    [{ screen: 'newGame', game: null }, true],
    [{ screen: 'newGame', game: { ...makeGame(), lastScreen: 'board' } }, true],
    [{ screen: 'board', game: makeGame() }, false],
    [{ screen: 'questionPopup', game: makeGame({ pendingQuestion: pending }) }, true],
    [{ screen: 'questionPopup', game: null }, false],
    [{ screen: 'question', game: makeGame({ pendingQuestion: pending }) }, false],
    [{ screen: 'result', game: makeGame({ pendingQuestion: answered }) }, false],
    [{ screen: 'newBoard', game: makeGame() }, false],
    [{ screen: 'newBoard', game: null }, false],
    [{ screen: 'board', game: null }, false],
  ];

  it.each(cases)('%o → %s, and agrees with the reducer BACK', (state, expected) => {
    expect(canGoBack(state)).toBe(expected);
    expect(gameReducer(state, { type: 'BACK' }) !== state).toBe(expected);
  });
});
