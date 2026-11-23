import { describe, expect, it } from 'vitest';
import { generateBoard, type Difficulty } from '../engine';
import questions from '../data/questions.json';
import { gameReducer, initialState, type GameAction } from './gameReducer';
import type { Game, GameState, PlayerCount, Screen } from './types';

const CODE = 'ABCD-EFG';
const OTHER_CODE = 'HJKM-NPQ';

/** Recursively freezes an object so any mutation by the reducer throws (strict mode). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function makeGame(overrides: Partial<Game> = {}): Game {
  const difficulty = overrides.difficulty ?? 'medium';
  const turn = overrides.turn ?? 1;
  const code = overrides.code ?? CODE;
  const goal = generateBoard(code, 1, difficulty).goal;
  return {
    code,
    difficulty,
    playerCount: 4,
    turn,
    activePlayer: 1,
    board: generateBoard(code, turn, difficulty, goal),
    askedQuestionIds: [],
    pendingQuestion: null,
    winner: null,
    ...overrides,
  };
}

function state(screen: Screen, game: Game | null = makeGame()): GameState {
  return deepFreeze({ screen, game });
}

/** Runs the reducer on a deep-frozen state. */
const reduce = (s: GameState, action: GameAction) => gameReducer(deepFreeze(s), action);

const ALL_SCREENS: Screen[] = [
  'home',
  'newGame',
  'board',
  'questionPopup',
  'question',
  'result',
  'newBoard',
  'winner',
];

const q1 = questions[0];
const wrongLetter = (['A', 'B', 'C', 'D'] as const).find((l) => l !== q1.answer)!;

describe('initialState', () => {
  it('is the home screen without a game', () => {
    expect(initialState).toEqual({ screen: 'home', game: null });
  });
});

describe('START_GAME', () => {
  it.each<[PlayerCount, Difficulty]>([
    [2, 'easy'],
    [3, 'medium'],
    [4, 'hard'],
  ])('builds a %i-player %s game at turn 1 from generateBoard(code, 1, difficulty)', (n, d) => {
    const next = reduce(initialState, {
      type: 'START_GAME',
      playerCount: n,
      difficulty: d,
      code: CODE,
    });
    expect(next).toEqual({
      screen: 'board',
      game: {
        code: CODE,
        difficulty: d,
        playerCount: n,
        turn: 1,
        activePlayer: 1,
        board: generateBoard(CODE, 1, d),
        askedQuestionIds: [],
        pendingQuestion: null,
        winner: null,
      },
    });
  });

  it('normalises the code to its canonical form', () => {
    const next = reduce(initialState, {
      type: 'START_GAME',
      playerCount: 2,
      difficulty: 'easy',
      code: 'abcdefg',
    });
    expect(next.game!.code).toBe(CODE);
    expect(next.game!.board.code).toBe(CODE);
  });

  it.each(ALL_SCREENS)('works from screen %s, replacing any game in progress', (screen) => {
    const prev = state(screen, makeGame({ turn: 3, activePlayer: 2, askedQuestionIds: [1] }));
    const next = reduce(prev, {
      type: 'START_GAME',
      playerCount: 3,
      difficulty: 'easy',
      code: OTHER_CODE,
    });
    expect(next.screen).toBe('board');
    expect(next.game).toMatchObject({ code: OTHER_CODE, turn: 1, activePlayer: 1 });
    expect(next.game!.askedQuestionIds).toEqual([]);
  });

  it.each([
    ['invalid code', { playerCount: 4, difficulty: 'medium', code: 'nope' }],
    ['empty code', { playerCount: 4, difficulty: 'medium', code: '' }],
    ['player count 1', { playerCount: 1, difficulty: 'medium', code: CODE }],
    ['player count 5', { playerCount: 5, difficulty: 'medium', code: CODE }],
    ['unknown difficulty', { playerCount: 4, difficulty: 'insane', code: CODE }],
    ['prototype difficulty', { playerCount: 4, difficulty: 'toString', code: CODE }],
  ])('returns the same state for %s', (_, payload) => {
    const prev = state('home', null);
    expect(reduce(prev, { type: 'START_GAME', ...payload } as GameAction)).toBe(prev);
  });
});

describe('NEXT_PLAYER', () => {
  it('moves to the next player on the board screen', () => {
    const prev = state('board', makeGame({ activePlayer: 2 }));
    const next = reduce(prev, { type: 'NEXT_PLAYER' });
    expect(next.screen).toBe('board');
    expect(next.game!.activePlayer).toBe(3);
    expect(next.game!.board).toBe(prev.game!.board);
  });

  it('from the result screen goes back to the board and clears the pending question', () => {
    const prev = state(
      'result',
      makeGame({ pendingQuestion: { questionId: 1, cards: 2, answer: 'B', correct: true } }),
    );
    const next = reduce(prev, { type: 'NEXT_PLAYER' });
    expect(next.screen).toBe('board');
    expect(next.game!.activePlayer).toBe(2);
    expect(next.game!.pendingQuestion).toBeNull();
  });

  it.each([2, 3, 4] as const)('is a no-op for the last player of a %i-player game', (n) => {
    const prev = state('board', makeGame({ playerCount: n, activePlayer: n }));
    expect(reduce(prev, { type: 'NEXT_PLAYER' })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'board' && s !== 'result'))(
    'is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'NEXT_PLAYER' })).toBe(prev);
    },
  );

  it('is a no-op without a game', () => {
    const prev = state('board', null);
    expect(reduce(prev, { type: 'NEXT_PLAYER' })).toBe(prev);
  });
});

describe('END_TURN', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    'moves to the next turn board (%s) with the same goal, player 1, newBoard screen',
    (difficulty) => {
      const game = makeGame({ difficulty, turn: 2, activePlayer: 4, askedQuestionIds: [3] });
      const prev = state('board', game);
      const next = reduce(prev, { type: 'END_TURN' });
      expect(next.screen).toBe('newBoard');
      expect(next.game!.turn).toBe(3);
      expect(next.game!.activePlayer).toBe(1);
      expect(next.game!.board).toEqual(generateBoard(CODE, 3, difficulty, game.board.goal));
      expect(next.game!.board.goal).toEqual(game.board.goal);
      expect(next.game!.code).toBe(CODE);
      expect(next.game!.difficulty).toBe(difficulty);
      expect(next.game!.askedQuestionIds).toEqual([3]);
      expect(next.game!.pendingQuestion).toBeNull();
    },
  );

  it('keeps the turn-1 goal over many turns', () => {
    let s: GameState = reduce(initialState, {
      type: 'START_GAME',
      playerCount: 2,
      difficulty: 'hard',
      code: CODE,
    });
    const goal = s.game!.board.goal;
    for (let turn = 2; turn <= 6; turn++) {
      s = reduce(s, { type: 'NEXT_PLAYER' });
      s = reduce(s, { type: 'END_TURN' });
      s = reduce(s, { type: 'START_TURN' });
      expect(s.game!.turn).toBe(turn);
      expect(s.game!.board.goal).toEqual(goal);
      expect(s.game!.board).toEqual(generateBoard(CODE, turn, 'hard'));
    }
  });

  it.each([1, 2, 3])('is a no-op when player %i (not the last) is active', (p) => {
    const prev = state('board', makeGame({ activePlayer: p }));
    expect(reduce(prev, { type: 'END_TURN' })).toBe(prev);
  });

  it('is a no-op once a winner is declared', () => {
    const prev = state('board', makeGame({ activePlayer: 4, winner: 2 }));
    expect(reduce(prev, { type: 'END_TURN' })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'board'))('is a no-op on screen %s', (screen) => {
    const prev = state(screen, makeGame({ activePlayer: 4 }));
    expect(reduce(prev, { type: 'END_TURN' })).toBe(prev);
  });

  it('is a no-op without a game', () => {
    const prev = state('board', null);
    expect(reduce(prev, { type: 'END_TURN' })).toBe(prev);
  });
});

describe('START_TURN', () => {
  it('goes from newBoard to board, game unchanged', () => {
    const prev = state('newBoard', makeGame({ turn: 2 }));
    const next = reduce(prev, { type: 'START_TURN' });
    expect(next).toEqual({ screen: 'board', game: prev.game });
    expect(next.game).toBe(prev.game);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'newBoard'))('is a no-op on screen %s', (screen) => {
    const prev = state(screen);
    expect(reduce(prev, { type: 'START_TURN' })).toBe(prev);
  });

  it('is a no-op without a game', () => {
    const prev = state('newBoard', null);
    expect(reduce(prev, { type: 'START_TURN' })).toBe(prev);
  });
});

describe('NEW_BOARD', () => {
  it('starts a new game with the new code, same players and difficulty, turn 1', () => {
    const prev = state(
      'board',
      makeGame({
        playerCount: 3,
        difficulty: 'hard',
        turn: 4,
        activePlayer: 2,
        askedQuestionIds: [1, 2],
      }),
    );
    const next = reduce(prev, { type: 'NEW_BOARD', code: OTHER_CODE });
    expect(next).toEqual({
      screen: 'board',
      game: {
        code: OTHER_CODE,
        difficulty: 'hard',
        playerCount: 3,
        turn: 1,
        activePlayer: 1,
        board: generateBoard(OTHER_CODE, 1, 'hard'),
        askedQuestionIds: [],
        pendingQuestion: null,
        winner: null,
      },
    });
  });

  it('is a no-op with an invalid code', () => {
    const prev = state('board');
    expect(reduce(prev, { type: 'NEW_BOARD', code: '???' })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'board'))('is a no-op on screen %s', (screen) => {
    const prev = state(screen);
    expect(reduce(prev, { type: 'NEW_BOARD', code: OTHER_CODE })).toBe(prev);
  });

  it('is a no-op without a game', () => {
    const prev = state('board', null);
    expect(reduce(prev, { type: 'NEW_BOARD', code: OTHER_CODE })).toBe(prev);
  });
});

describe('question flow', () => {
  it('OPEN_QUESTION sets the pending question and shows the popup', () => {
    const prev = state('board', makeGame({ activePlayer: 2 }));
    const next = reduce(prev, { type: 'OPEN_QUESTION', questionId: q1.id, cards: 3 });
    expect(next.screen).toBe('questionPopup');
    expect(next.game!.pendingQuestion).toEqual({ questionId: q1.id, cards: 3 });
    expect(next.game!.activePlayer).toBe(2);
    expect(next.game!.askedQuestionIds).toEqual([]);
  });

  it.each([
    ['unknown id', { questionId: 99999, cards: 1 }],
    ['id 0', { questionId: 0, cards: 1 }],
    ['0 cards', { questionId: 1, cards: 0 }],
    ['4 cards', { questionId: 1, cards: 4 }],
  ])('OPEN_QUESTION is a no-op with %s', (_, payload) => {
    const prev = state('board');
    expect(reduce(prev, { type: 'OPEN_QUESTION', ...payload } as GameAction)).toBe(prev);
  });

  it('OPEN_QUESTION is a no-op when a question is already pending', () => {
    const prev = state('board', makeGame({ pendingQuestion: { questionId: 1, cards: 1 } }));
    expect(reduce(prev, { type: 'OPEN_QUESTION', questionId: 2, cards: 1 })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'board'))(
    'OPEN_QUESTION is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'OPEN_QUESTION', questionId: 1, cards: 1 })).toBe(prev);
    },
  );

  it('OPEN_QUESTION is a no-op without a game', () => {
    const prev = state('board', null);
    expect(reduce(prev, { type: 'OPEN_QUESTION', questionId: 1, cards: 1 })).toBe(prev);
  });

  it('CANCEL_QUESTION goes back to the board without marking the question as asked', () => {
    const prev = state('questionPopup', makeGame({ pendingQuestion: { questionId: 5, cards: 2 } }));
    const next = reduce(prev, { type: 'CANCEL_QUESTION' });
    expect(next.screen).toBe('board');
    expect(next.game!.pendingQuestion).toBeNull();
    expect(next.game!.askedQuestionIds).toEqual([]);
    expect(next.game!.activePlayer).toBe(1);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'questionPopup'))(
    'CANCEL_QUESTION is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'CANCEL_QUESTION' })).toBe(prev);
    },
  );

  it('SHOW_QUESTION goes from the popup to the question screen', () => {
    const prev = state('questionPopup', makeGame({ pendingQuestion: { questionId: 5, cards: 2 } }));
    const next = reduce(prev, { type: 'SHOW_QUESTION' });
    expect(next.screen).toBe('question');
    expect(next.game).toBe(prev.game);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'questionPopup'))(
    'SHOW_QUESTION is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'SHOW_QUESTION' })).toBe(prev);
    },
  );

  it('ANSWER_QUESTION with the right answer records it as correct and marks the id asked', () => {
    const prev = state(
      'question',
      makeGame({ askedQuestionIds: [7], pendingQuestion: { questionId: q1.id, cards: 2 } }),
    );
    const next = reduce(prev, { type: 'ANSWER_QUESTION', answer: q1.answer as 'A' });
    expect(next.screen).toBe('result');
    expect(next.game!.pendingQuestion).toEqual({
      questionId: q1.id,
      cards: 2,
      answer: q1.answer,
      correct: true,
    });
    expect(next.game!.askedQuestionIds).toEqual([7, q1.id]);
  });

  it('ANSWER_QUESTION with a wrong answer records it as incorrect', () => {
    const prev = state('question', makeGame({ pendingQuestion: { questionId: q1.id, cards: 1 } }));
    const next = reduce(prev, { type: 'ANSWER_QUESTION', answer: wrongLetter });
    expect(next.game!.pendingQuestion).toMatchObject({ answer: wrongLetter, correct: false });
    expect(next.game!.askedQuestionIds).toEqual([q1.id]);
  });

  it('ANSWER_QUESTION computes correctness from questions.json for every question', () => {
    for (const q of questions) {
      const prev = state('question', makeGame({ pendingQuestion: { questionId: q.id, cards: 1 } }));
      for (const letter of ['A', 'B', 'C', 'D'] as const) {
        const next = reduce(prev, { type: 'ANSWER_QUESTION', answer: letter });
        expect(next.game!.pendingQuestion!.correct, `q${q.id} ${letter}`).toBe(letter === q.answer);
      }
    }
  });

  it('ANSWER_QUESTION adds an already asked id only once', () => {
    const asked = [q1.id, 9];
    const prev = state(
      'question',
      makeGame({ askedQuestionIds: asked, pendingQuestion: { questionId: q1.id, cards: 1 } }),
    );
    const next = reduce(prev, { type: 'ANSWER_QUESTION', answer: wrongLetter });
    expect(next.game!.askedQuestionIds).toEqual([q1.id, 9]);
  });

  it('ANSWER_QUESTION is a no-op with an invalid letter', () => {
    const prev = state('question', makeGame({ pendingQuestion: { questionId: q1.id, cards: 1 } }));
    expect(reduce(prev, { type: 'ANSWER_QUESTION', answer: 'E' } as unknown as GameAction)).toBe(
      prev,
    );
  });

  it('ANSWER_QUESTION is a no-op without a pending question', () => {
    const prev = state('question', makeGame());
    expect(reduce(prev, { type: 'ANSWER_QUESTION', answer: 'A' })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'question'))(
    'ANSWER_QUESTION is a no-op on screen %s',
    (screen) => {
      const prev = state(screen, makeGame({ pendingQuestion: { questionId: q1.id, cards: 1 } }));
      expect(reduce(prev, { type: 'ANSWER_QUESTION', answer: 'A' })).toBe(prev);
    },
  );

  it('CONTINUE moves to the next player and back to the board', () => {
    const prev = state(
      'result',
      makeGame({
        activePlayer: 2,
        pendingQuestion: { questionId: 1, cards: 1, answer: 'B', correct: true },
      }),
    );
    const next = reduce(prev, { type: 'CONTINUE' });
    expect(next.screen).toBe('board');
    expect(next.game!.activePlayer).toBe(3);
    expect(next.game!.pendingQuestion).toBeNull();
  });

  it('CONTINUE after the last player keeps the last player active (End turn)', () => {
    const prev = state(
      'result',
      makeGame({
        playerCount: 3,
        activePlayer: 3,
        pendingQuestion: { questionId: 1, cards: 1, answer: 'A', correct: false },
      }),
    );
    const next = reduce(prev, { type: 'CONTINUE' });
    expect(next.screen).toBe('board');
    expect(next.game!.activePlayer).toBe(3);
    expect(next.game!.turn).toBe(1);
    expect(next.game!.pendingQuestion).toBeNull();
    // The last player can then end the turn.
    expect(reduce(next, { type: 'END_TURN' }).screen).toBe('newBoard');
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'result'))(
    'CONTINUE is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'CONTINUE' })).toBe(prev);
    },
  );

  it.each(['CANCEL_QUESTION', 'SHOW_QUESTION', 'CONTINUE', 'OPEN_WINNER'] as const)(
    '%s is a no-op without a game',
    (type) => {
      const prev = state('home', null);
      expect(reduce(prev, { type })).toBe(prev);
    },
  );

  it('full flow: open → show → answer → continue', () => {
    let s = state('board');
    s = reduce(s, { type: 'OPEN_QUESTION', questionId: q1.id, cards: 2 });
    s = reduce(s, { type: 'SHOW_QUESTION' });
    s = reduce(s, { type: 'ANSWER_QUESTION', answer: q1.answer as 'A' });
    expect(s.screen).toBe('result');
    s = reduce(s, { type: 'CONTINUE' });
    expect(s.screen).toBe('board');
    expect(s.game!.activePlayer).toBe(2);
    expect(s.game!.askedQuestionIds).toEqual([q1.id]);
    expect(s.game!.pendingQuestion).toBeNull();
  });
});

describe('winner flow', () => {
  it('OPEN_WINNER goes from the board to the winner screen', () => {
    const prev = state('board');
    const next = reduce(prev, { type: 'OPEN_WINNER' });
    expect(next.screen).toBe('winner');
    expect(next.game).toBe(prev.game);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'board'))(
    'OPEN_WINNER is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'OPEN_WINNER' })).toBe(prev);
    },
  );

  it.each([1, 2, 3, 4])('DECLARE_WINNER sets player %i as the winner and stays', (p) => {
    const prev = state('winner');
    const next = reduce(prev, { type: 'DECLARE_WINNER', player: p });
    expect(next.screen).toBe('winner');
    expect(next.game!.winner).toBe(p);
  });

  it.each([0, 5, -1, 1.5, NaN])('DECLARE_WINNER is a no-op for player %s', (p) => {
    const prev = state('winner');
    expect(reduce(prev, { type: 'DECLARE_WINNER', player: p })).toBe(prev);
  });

  it('DECLARE_WINNER is a no-op for player 3 in a 2-player game', () => {
    const prev = state('winner', makeGame({ playerCount: 2 }));
    expect(reduce(prev, { type: 'DECLARE_WINNER', player: 3 })).toBe(prev);
  });

  it('DECLARE_WINNER is a no-op once a winner is declared', () => {
    const prev = state('winner', makeGame({ winner: 1 }));
    expect(reduce(prev, { type: 'DECLARE_WINNER', player: 2 })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'winner'))(
    'DECLARE_WINNER is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'DECLARE_WINNER', player: 1 })).toBe(prev);
    },
  );

  it('DECLARE_WINNER is a no-op without a game', () => {
    const prev = state('winner', null);
    expect(reduce(prev, { type: 'DECLARE_WINNER', player: 1 })).toBe(prev);
  });

  it('PLAY_AGAIN starts a new game with the same players and difficulty', () => {
    const prev = state(
      'winner',
      makeGame({ playerCount: 2, difficulty: 'easy', turn: 5, winner: 2, askedQuestionIds: [1] }),
    );
    const next = reduce(prev, { type: 'PLAY_AGAIN', code: OTHER_CODE });
    expect(next).toEqual({
      screen: 'board',
      game: {
        code: OTHER_CODE,
        difficulty: 'easy',
        playerCount: 2,
        turn: 1,
        activePlayer: 1,
        board: generateBoard(OTHER_CODE, 1, 'easy'),
        askedQuestionIds: [],
        pendingQuestion: null,
        winner: null,
      },
    });
  });

  it('PLAY_AGAIN is a no-op before a winner is declared', () => {
    const prev = state('winner');
    expect(reduce(prev, { type: 'PLAY_AGAIN', code: OTHER_CODE })).toBe(prev);
  });

  it('PLAY_AGAIN is a no-op with an invalid code', () => {
    const prev = state('winner', makeGame({ winner: 1 }));
    expect(reduce(prev, { type: 'PLAY_AGAIN', code: 'bad' })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'winner'))(
    'PLAY_AGAIN is a no-op on screen %s',
    (screen) => {
      const prev = state(screen, makeGame({ winner: 1 }));
      expect(reduce(prev, { type: 'PLAY_AGAIN', code: OTHER_CODE })).toBe(prev);
    },
  );

  it('PLAY_AGAIN is a no-op without a game', () => {
    const prev = state('winner', null);
    expect(reduce(prev, { type: 'PLAY_AGAIN', code: OTHER_CODE })).toBe(prev);
  });
});

describe('GO_HOME', () => {
  it.each(ALL_SCREENS)('drops the game and goes home from screen %s', (screen) => {
    const next = reduce(state(screen), { type: 'GO_HOME' });
    expect(next).toEqual({ screen: 'home', game: null });
  });

  it('goes home from newGame without a game', () => {
    expect(reduce(state('newGame', null), { type: 'GO_HOME' })).toEqual(initialState);
  });

  it('is a no-op when already home without a game', () => {
    const prev = state('home', null);
    expect(reduce(prev, { type: 'GO_HOME' })).toBe(prev);
  });
});

describe('GO_NEW_GAME', () => {
  it('goes from home to newGame', () => {
    expect(reduce(state('home', null), { type: 'GO_NEW_GAME' })).toEqual({
      screen: 'newGame',
      game: null,
    });
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'home'))('is a no-op on screen %s', (screen) => {
    const prev = state(screen);
    expect(reduce(prev, { type: 'GO_NEW_GAME' })).toBe(prev);
  });
});

describe('BACK', () => {
  it('newGame → home', () => {
    expect(reduce(state('newGame', null), { type: 'BACK' })).toEqual(initialState);
  });

  it('questionPopup → board, like CANCEL_QUESTION', () => {
    const prev = state('questionPopup', makeGame({ pendingQuestion: { questionId: 2, cards: 1 } }));
    const next = reduce(prev, { type: 'BACK' });
    expect(next).toEqual(reduce(prev, { type: 'CANCEL_QUESTION' }));
    expect(next.screen).toBe('board');
    expect(next.game!.pendingQuestion).toBeNull();
    expect(next.game!.askedQuestionIds).toEqual([]);
  });

  it('winner (none declared) → board', () => {
    const prev = state('winner');
    const next = reduce(prev, { type: 'BACK' });
    expect(next.screen).toBe('board');
    expect(next.game).toBe(prev.game);
  });

  it('winner (declared) is a no-op', () => {
    const prev = state('winner', makeGame({ winner: 3 }));
    expect(reduce(prev, { type: 'BACK' })).toBe(prev);
  });

  it.each(['home', 'board', 'question', 'result', 'newBoard'] as const)(
    'is a no-op on screen %s',
    (screen) => {
      const prev = state(screen);
      expect(reduce(prev, { type: 'BACK' })).toBe(prev);
    },
  );

  it.each(['questionPopup', 'winner'] as const)('is a no-op on %s without a game', (screen) => {
    const prev = state(screen, null);
    expect(reduce(prev, { type: 'BACK' })).toBe(prev);
  });
});

describe('QUIT_TO_HOME (#12 D10)', () => {
  const pendingFor: Partial<Record<Screen, Partial<Game>>> = {
    questionPopup: { pendingQuestion: { questionId: q1.id, cards: 2 } },
    question: { pendingQuestion: { questionId: q1.id, cards: 2 } },
    result: { pendingQuestion: { questionId: q1.id, cards: 2, answer: 'A', correct: false } },
  };
  const GAME_SCREENS = ALL_SCREENS.filter((s) => s !== 'home' && s !== 'newGame');

  it.each(GAME_SCREENS)('%s → home, game kept with lastScreen', (screen) => {
    const game = makeGame({
      turn: 3,
      activePlayer: 2,
      askedQuestionIds: [4],
      ...pendingFor[screen],
    });
    const next = reduce(state(screen, game), { type: 'QUIT_TO_HOME' });
    expect(next).toEqual({ screen: 'home', game: { ...game, lastScreen: screen } });
  });

  it('keeps a declared winner (winner step 2)', () => {
    const game = makeGame({ winner: 2 });
    const next = reduce(state('winner', game), { type: 'QUIT_TO_HOME' });
    expect(next).toEqual({ screen: 'home', game: { ...game, lastScreen: 'winner' } });
  });

  it.each(['home', 'newGame'] as const)('is a no-op on %s with a game', (screen) => {
    const prev = state(screen, makeGame({ lastScreen: 'board' }));
    expect(reduce(prev, { type: 'QUIT_TO_HOME' })).toBe(prev);
  });

  it.each(ALL_SCREENS)('is a no-op on %s without a game', (screen) => {
    const prev = state(screen, null);
    expect(reduce(prev, { type: 'QUIT_TO_HOME' })).toBe(prev);
  });
});

describe('CONTINUE_GAME (#12 D10)', () => {
  it.each<[Screen, Partial<Game>]>([
    ['board', { activePlayer: 3 }],
    ['newBoard', { turn: 2 }],
    ['questionPopup', { pendingQuestion: { questionId: q1.id, cards: 1 } }],
    ['question', { pendingQuestion: { questionId: q1.id, cards: 3 } }],
    ['result', { pendingQuestion: { questionId: q1.id, cards: 2, answer: 'B', correct: true } }],
    ['winner', {}],
    ['winner', { winner: 4 }],
  ])('home with lastScreen %s → back on it, lastScreen cleared', (lastScreen, overrides) => {
    const game = makeGame(overrides);
    const quit = reduce(state(lastScreen, game), { type: 'QUIT_TO_HOME' });
    const next = reduce(quit, { type: 'CONTINUE_GAME' });
    expect(next).toEqual({ screen: lastScreen, game });
    expect(next.game).not.toHaveProperty('lastScreen');
  });

  it('home with a game but no lastScreen → board', () => {
    const game = makeGame();
    expect(reduce(state('home', game), { type: 'CONTINUE_GAME' })).toEqual({
      screen: 'board',
      game,
    });
  });

  it.each(['questionPopup', 'question', 'result'] as const)(
    'lastScreen %s without a pending question → board',
    (lastScreen) => {
      const game = makeGame();
      const next = reduce(state('home', { ...game, lastScreen }), { type: 'CONTINUE_GAME' });
      expect(next).toEqual({ screen: 'board', game });
    },
  );

  it('lastScreen result with an unanswered question → board', () => {
    const game = makeGame({ pendingQuestion: { questionId: q1.id, cards: 1 } });
    const next = reduce(state('home', { ...game, lastScreen: 'result' }), {
      type: 'CONTINUE_GAME',
    });
    expect(next).toEqual({ screen: 'board', game });
  });

  it('is a no-op on home without a game', () => {
    const prev = state('home', null);
    expect(reduce(prev, { type: 'CONTINUE_GAME' })).toBe(prev);
  });

  it.each(ALL_SCREENS.filter((s) => s !== 'home'))('is a no-op on %s', (screen) => {
    const prev = state(screen, makeGame({ lastScreen: 'board' }));
    expect(reduce(prev, { type: 'CONTINUE_GAME' })).toBe(prev);
  });
});

describe('saved game and New game (#12 D10)', () => {
  const saved = () => state('home', makeGame({ turn: 4, lastScreen: 'newBoard' }));

  it('GO_NEW_GAME keeps the saved game; BACK returns home with it', () => {
    const prev = saved();
    const newGame = reduce(prev, { type: 'GO_NEW_GAME' });
    expect(newGame).toEqual({ screen: 'newGame', game: prev.game });
    expect(newGame.game).toBe(prev.game);
    const back = reduce(newGame, { type: 'BACK' });
    expect(back).toEqual(prev);
    expect(reduce(back, { type: 'CONTINUE_GAME' }).screen).toBe('newBoard');
  });

  it('START_GAME replaces the saved game (turn 1, no lastScreen)', () => {
    const newGame = reduce(saved(), { type: 'GO_NEW_GAME' });
    const next = reduce(newGame, {
      type: 'START_GAME',
      playerCount: 2,
      difficulty: 'easy',
      code: OTHER_CODE,
    });
    expect(next.screen).toBe('board');
    expect(next.game).toMatchObject({ code: OTHER_CODE, turn: 1, playerCount: 2 });
    expect(next.game).not.toHaveProperty('lastScreen');
  });

  it('GO_HOME from home drops a saved game', () => {
    expect(reduce(saved(), { type: 'GO_HOME' })).toEqual(initialState);
  });
});

describe('purity', () => {
  it('returns the same state for an unknown action', () => {
    const prev = state('board');
    expect(reduce(prev, { type: 'NOPE' } as unknown as GameAction)).toBe(prev);
  });

  it('never mutates the (deep-frozen) previous state over a whole game', () => {
    let s: GameState = state('home', null);
    const actions: GameAction[] = [
      { type: 'GO_NEW_GAME' },
      { type: 'START_GAME', playerCount: 2, difficulty: 'medium', code: CODE },
      { type: 'OPEN_QUESTION', questionId: q1.id, cards: 1 },
      { type: 'SHOW_QUESTION' },
      { type: 'ANSWER_QUESTION', answer: wrongLetter },
      { type: 'CONTINUE' },
      { type: 'END_TURN' },
      { type: 'START_TURN' },
      { type: 'NEXT_PLAYER' },
      { type: 'OPEN_QUESTION', questionId: 2, cards: 3 },
      { type: 'BACK' },
      { type: 'NEW_BOARD', code: OTHER_CODE },
      { type: 'OPEN_WINNER' },
      { type: 'DECLARE_WINNER', player: 2 },
      { type: 'PLAY_AGAIN', code: CODE },
      { type: 'GO_HOME' },
    ];
    for (const action of actions) {
      const before = JSON.stringify(s);
      const next = reduce(s, action);
      expect(next, action.type).not.toBe(s);
      expect(JSON.stringify(s)).toBe(before);
      s = next;
    }
    expect(s).toEqual(initialState);
  });

  it('is deterministic: same state and action give equal results', () => {
    const prev = state('board', makeGame({ activePlayer: 4, turn: 3 }));
    expect(reduce(prev, { type: 'END_TURN' })).toEqual(reduce(prev, { type: 'END_TURN' }));
  });
});
