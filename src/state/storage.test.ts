import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateBoard } from '../engine';
import { gameReducer, initialState } from './gameReducer';
import { STORAGE_KEY, STORAGE_VERSION, loadState, saveState } from './storage';
import type { GameScreen, GameState, Screen } from './types';

const CODE = 'ABCD-EFG';

function started(): GameState {
  return gameReducer(initialState, {
    type: 'START_GAME',
    playerCount: 3,
    difficulty: 'hard',
    code: CODE,
  });
}

const writeRaw = (value: string) => localStorage.setItem(STORAGE_KEY, value);
const write = (value: unknown) => writeRaw(JSON.stringify(value));
const wrap = (state: unknown) => ({ version: STORAGE_VERSION, state });

/** A saved game, as a plain JSON object that tests can break. */
function savedGame(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(started().game)) as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('constants', () => {
  it('uses the bgc.game.v2 key and version 2 (D11)', () => {
    expect(STORAGE_KEY).toBe('bgc.game.v2');
    expect(STORAGE_VERSION).toBe(2);
  });
});

describe('v1 saves (with an active player) are ignored (D11)', () => {
  /** A v1 save as the previous version wrote it: version 1, game with `activePlayer`. */
  const v1Save = (screen: Screen = 'board') => ({
    version: 1,
    state: { screen, game: { ...savedGame(), activePlayer: 2 } },
  });

  it.each<Screen>(['home', 'board', 'result', 'newBoard'])(
    'a v1 save under bgc.game.v1 (screen %s) → null',
    (screen) => {
      localStorage.setItem('bgc.game.v1', JSON.stringify(v1Save(screen)));
      expect(loadState()).toBeNull();
    },
  );

  it('a v1 save written under the v2 key → null (version check)', () => {
    write(v1Save());
    expect(loadState()).toBeNull();
  });

  it('saving writes only bgc.game.v2, never bgc.game.v1', () => {
    localStorage.setItem('bgc.game.v1', JSON.stringify(v1Save()));
    saveState(started());
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('bgc.game.v1')!)).toEqual(v1Save());
  });

  it('a saved v2 game has no activePlayer', () => {
    saveState(started());
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { state: GameState };
    expect(raw.state.game).not.toHaveProperty('activePlayer');
  });
});

describe('saveState / loadState round trip', () => {
  it('returns null when nothing is saved', () => {
    expect(loadState()).toBeNull();
  });

  it('saves { version, state } under the key', () => {
    const s = started();
    saveState(s);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ version: 2, state: s });
  });

  it('restores a game in progress', () => {
    const s = started();
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it('restores a later turn with questions, answers and a winner', () => {
    let s = started();
    s = gameReducer(s, { type: 'OPEN_QUESTION', questionId: 1, cards: 2 });
    s = gameReducer(s, { type: 'SHOW_QUESTION' });
    s = gameReducer(s, { type: 'ANSWER_QUESTION', answer: 'C' });
    saveState(s);
    expect(loadState()).toEqual(s);

    s = gameReducer(s, { type: 'CONTINUE' });
    s = gameReducer(s, { type: 'END_TURN' });
    saveState(s);
    expect(loadState()).toEqual(s);
    expect(loadState()!.screen).toBe('newBoard');

    s = gameReducer(s, { type: 'START_TURN' });
    s = gameReducer(s, { type: 'OPEN_WINNER' });
    s = gameReducer(s, { type: 'DECLARE_WINNER', player: 3 });
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it.each<GameState>([
    { screen: 'home', game: null },
    { screen: 'newGame', game: null },
  ])('restores $screen without a game', (s) => {
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it('the restored board equals the engine board for the same code and turn', () => {
    let s = started();
    s = gameReducer(s, { type: 'END_TURN' });
    saveState(s);
    expect(loadState()!.game!.board).toEqual(generateBoard(CODE, 2, 'hard'));
  });
});

describe('loadState rejects bad data', () => {
  it.each(['{', 'not json', '', 'undefined', 'null', '42', '"text"', '[]'])(
    'corrupted JSON %j → null',
    (raw) => {
      writeRaw(raw);
      expect(loadState()).toBeNull();
    },
  );

  it.each([0, 1, 3, '2', null, undefined])('wrong version %j → null', (version) => {
    write({ version, state: started() });
    expect(loadState()).toBeNull();
  });

  it('missing state → null', () => {
    write({ version: 2 });
    expect(loadState()).toBeNull();
  });

  it.each([null, 'board', [], 3])('state %j → null', (state) => {
    write({ version: 2, state });
    expect(loadState()).toBeNull();
  });

  it.each(['menu', '', undefined, 3])('unknown screen %j → null', (screen) => {
    write(wrap({ screen, game: null }));
    expect(loadState()).toBeNull();
  });

  it('game not an object → null', () => {
    write(wrap({ screen: 'board', game: 'game' }));
    expect(loadState()).toBeNull();
    write(wrap({ screen: 'board', game: [] }));
    expect(loadState()).toBeNull();
  });

  it('missing game key → null', () => {
    write(wrap({ screen: 'board' }));
    expect(loadState()).toBeNull();
  });

  const breakages: [string, (g: Record<string, unknown>) => void][] = [
    ['invalid code', (g) => (g.code = 'nope')],
    ['numeric code', (g) => (g.code = 1234567)],
    ['unknown difficulty', (g) => (g.difficulty = 'insane')],
    ['prototype difficulty', (g) => (g.difficulty = 'constructor')],
    ['playerCount 1', (g) => (g.playerCount = 1)],
    ['playerCount 5', (g) => (g.playerCount = 5)],
    ['playerCount string', (g) => (g.playerCount = '3')],
    ['turn 0', (g) => (g.turn = 0)],
    ['turn 1.5', (g) => (g.turn = 1.5)],
    ['board missing', (g) => delete g.board],
    ['board of another code', (g) => (g.board = generateBoard('HJKM-NPQ', 1, 'hard'))],
    ['board of another turn', (g) => (g.board = generateBoard(CODE, 2, 'hard'))],
    ['board of another difficulty', (g) => (g.board = generateBoard(CODE, 1, 'easy'))],
    ['walls not an array', (g) => ((g.board as Record<string, unknown>).walls = {})],
    ['wall without sides', (g) => ((g.board as Record<string, unknown>).walls = [{}])],
    ['enemies not an array', (g) => ((g.board as Record<string, unknown>).enemies = null)],
    [
      'enemy off the board',
      (g) => ((g.board as Record<string, unknown>).enemies = [{ x: 9, y: 0 }]),
    ],
    ['goal missing', (g) => delete (g.board as Record<string, unknown>).goal],
    ['goal off the board', (g) => ((g.board as Record<string, unknown>).goal = { x: -1, y: 0 })],
    ['askedQuestionIds not an array', (g) => (g.askedQuestionIds = '1,2')],
    ['askedQuestionIds with a string', (g) => (g.askedQuestionIds = [1, 'x'])],
    ['askedQuestionIds negative', (g) => (g.askedQuestionIds = [-1])],
    ['pendingQuestion missing', (g) => delete g.pendingQuestion],
    ['pendingQuestion not an object', (g) => (g.pendingQuestion = 5)],
    ['pending cards 4', (g) => (g.pendingQuestion = { questionId: 1, cards: 4 })],
    ['pending id string', (g) => (g.pendingQuestion = { questionId: '1', cards: 1 })],
    ['pending answer E', (g) => (g.pendingQuestion = { questionId: 1, cards: 1, answer: 'E' })],
    [
      'pending correct not boolean',
      (g) => (g.pendingQuestion = { questionId: 1, cards: 1, correct: 'yes' }),
    ],
    ['winner missing', (g) => delete g.winner],
    ['winner 0', (g) => (g.winner = 0)],
    ['winner > playerCount', (g) => (g.winner = 4)],
  ];

  it.each(breakages)('malformed game (%s) → null', (_, breakIt) => {
    const game = savedGame();
    breakIt(game);
    write(wrap({ screen: 'board', game }));
    expect(loadState()).toBeNull();
  });

  it('a valid saved game still loads (control for the malformed cases)', () => {
    write(wrap({ screen: 'board', game: savedGame() }));
    expect(loadState()).toEqual(started());
  });
});

describe('localStorage unavailable', () => {
  it('loadState returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => loadState()).not.toThrow();
    expect(loadState()).toBeNull();
  });

  it('saveState does not throw when setItem throws (quota / disabled)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => saveState(started())).not.toThrow();
  });

  it('loadState returns null when localStorage itself is missing', () => {
    vi.stubGlobal('localStorage', undefined);
    try {
      expect(loadState()).toBeNull();
      expect(() => saveState(started())).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('screen repair on load', () => {
  it.each<Screen>(['board', 'questionPopup', 'question', 'result', 'newBoard', 'winner'])(
    'without a game, %s → home',
    (screen) => {
      write(wrap({ screen, game: null }));
      expect(loadState()).toEqual({ screen: 'home', game: null });
    },
  );

  it.each<Screen>(['home', 'newGame'])(
    'with a game, %s is kept with the game (quit to home, #12 D10)',
    (screen) => {
      write(wrap({ screen, game: { ...savedGame(), lastScreen: 'board' } }));
      expect(loadState()).toEqual({ screen, game: { ...started().game, lastScreen: 'board' } });
    },
  );

  it.each<Screen>(['home', 'newGame'])('with a game without lastScreen, %s is kept', (screen) => {
    write(wrap({ screen, game: savedGame() }));
    expect(loadState()).toEqual({ screen, game: started().game });
  });

  it.each<Screen>(['questionPopup', 'question', 'result'])(
    'question screen %s without a pending question → board',
    (screen) => {
      write(wrap({ screen, game: savedGame() }));
      expect(loadState()).toEqual({ screen: 'board', game: started().game });
    },
  );

  it.each<Screen>(['questionPopup', 'question', 'result'])(
    'question screen %s with a pending question is kept',
    (screen) => {
      const game = { ...savedGame(), pendingQuestion: { questionId: 1, cards: 2 } };
      write(wrap({ screen, game }));
      expect(loadState()!.screen).toBe(screen);
    },
  );

  it.each<Screen>(['board', 'newBoard', 'winner'])('%s with a game is kept', (screen) => {
    write(wrap({ screen, game: savedGame() }));
    expect(loadState()!.screen).toBe(screen);
  });
});

describe('finished game (#15)', () => {
  const won = (): GameState => {
    let s = gameReducer(started(), { type: 'OPEN_WINNER' });
    s = gameReducer(s, { type: 'DECLARE_WINNER', player: 2 });
    return s;
  };

  it('Home saves no game: a reload starts on home', () => {
    saveState(gameReducer(won(), { type: 'GO_HOME' }));
    expect(loadState()).toEqual({ screen: 'home', game: null });
  });

  it('Play again saves a fresh game at turn 1', () => {
    saveState(gameReducer(won(), { type: 'PLAY_AGAIN', code: 'HJKM-NPQ' }));
    const game = loadState()!.game!;
    expect(game).toMatchObject({ code: 'HJKM-NPQ', turn: 1, winner: null, askedQuestionIds: [] });
  });
});

describe('lastScreen (quit to home, #12 D10)', () => {
  it.each<GameScreen>(['board', 'newBoard', 'winner'])(
    'home with lastScreen %s round-trips unchanged',
    (lastScreen) => {
      const s: GameState = { screen: 'home', game: { ...started().game!, lastScreen } };
      saveState(s);
      expect(loadState()).toEqual(s);
    },
  );

  it.each<GameScreen>(['questionPopup', 'question', 'result'])(
    'home with lastScreen %s and the needed pending question round-trips unchanged',
    (lastScreen) => {
      const pendingQuestion = { questionId: 1, cards: 2 as const, answer: 'A' as const };
      const s: GameState = {
        screen: 'home',
        game: { ...started().game!, pendingQuestion, lastScreen },
      };
      saveState(s);
      expect(loadState()).toEqual(s);
    },
  );

  it.each<Screen>(['questionPopup', 'question', 'result'])(
    'home with lastScreen %s but no pending question → lastScreen board',
    (lastScreen) => {
      write(wrap({ screen: 'home', game: { ...savedGame(), lastScreen } }));
      expect(loadState()).toEqual({
        screen: 'home',
        game: { ...started().game, lastScreen: 'board' },
      });
    },
  );

  it('home with lastScreen result and an unanswered question → lastScreen board', () => {
    const pendingQuestion = { questionId: 1, cards: 2 };
    write(
      wrap({ screen: 'home', game: { ...savedGame(), pendingQuestion, lastScreen: 'result' } }),
    );
    expect(loadState()!.game!.lastScreen).toBe('board');
  });

  it.each<Screen>(['board', 'newBoard', 'winner'])(
    'a game screen (%s) drops a stray lastScreen',
    (screen) => {
      write(wrap({ screen, game: { ...savedGame(), lastScreen: 'winner' } }));
      const loaded = loadState()!;
      expect(loaded.screen).toBe(screen);
      expect(loaded.game).toEqual(started().game);
      expect(loaded.game).not.toHaveProperty('lastScreen');
    },
  );

  it.each<unknown>(['home', 'newGame', 'menu', '', 3, null, true, {}])(
    'invalid lastScreen %j → null',
    (lastScreen) => {
      write(wrap({ screen: 'home', game: { ...savedGame(), lastScreen } }));
      expect(loadState()).toBeNull();
    },
  );

  it('QUIT_TO_HOME then save/load then CONTINUE_GAME returns to the same screen and game', () => {
    let s = started();
    s = gameReducer(s, { type: 'END_TURN' });
    s = gameReducer(s, { type: 'START_TURN' });
    s = gameReducer(s, { type: 'OPEN_QUESTION', questionId: 1, cards: 3 });
    s = gameReducer(s, { type: 'SHOW_QUESTION' });
    const playing = s;
    saveState(gameReducer(s, { type: 'QUIT_TO_HOME' }));
    const loaded = loadState()!;
    expect(loaded.screen).toBe('home');
    expect(gameReducer(loaded, { type: 'CONTINUE_GAME' })).toEqual(playing);
  });
});
