import { ENEMY_COUNT, isValidCode } from '../engine';
import { resumeScreen } from './gameReducer';
import type { Game, GameState, Screen } from './types';

/** localStorage key of the saved game. */
export const STORAGE_KEY = 'bgc.game.v2';

/**
 * Version of the saved shape; bump it when `GameState` changes incompatibly. v2 (decision D11):
 * no active player any more; v1 saves (key `bgc.game.v1`) are ignored.
 */
export const STORAGE_VERSION = 2;

interface Saved {
  version: number;
  state: GameState;
}

const SCREENS: readonly Screen[] = [
  'home',
  'newGame',
  'board',
  'questionPopup',
  'question',
  'result',
  'newBoard',
  'winner',
];

/** Screens that need a pending question. */
const QUESTION_SCREENS: readonly Screen[] = ['questionPopup', 'question', 'result'];

/** Screens that do not need a game in progress (with a saved game, Home offers "Continue game"). */
const NO_GAME_SCREENS: readonly Screen[] = ['home', 'newGame'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isInt = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const isCell = (v: unknown): boolean => isObject(v) && isInt(v.x, 0, 8) && isInt(v.y, 0, 8);

function isValidBoard(v: unknown, code: string, turn: number, difficulty: string): boolean {
  return (
    isObject(v) &&
    v.code === code &&
    v.turn === turn &&
    v.difficulty === difficulty &&
    Array.isArray(v.walls) &&
    v.walls.every((w) => isObject(w) && Array.isArray(w.sides)) &&
    Array.isArray(v.enemies) &&
    v.enemies.every(isCell) &&
    isCell(v.goal)
  );
}

function isValidPending(v: unknown): boolean {
  if (v === null) return true;
  return (
    isObject(v) &&
    isInt(v.questionId, 0) &&
    isInt(v.cards, 1, 3) &&
    (v.answer === undefined || ['A', 'B', 'C', 'D'].includes(v.answer as string)) &&
    (v.correct === undefined || typeof v.correct === 'boolean')
  );
}

function isValidGame(v: unknown): boolean {
  if (!isObject(v)) return false;
  const { code, difficulty, playerCount, turn } = v;
  return (
    typeof code === 'string' &&
    isValidCode(code) &&
    typeof difficulty === 'string' &&
    Object.prototype.hasOwnProperty.call(ENEMY_COUNT, difficulty) &&
    isInt(playerCount, 2, 4) &&
    isInt(turn, 1) &&
    isValidBoard(v.board, code, turn, difficulty) &&
    Array.isArray(v.askedQuestionIds) &&
    v.askedQuestionIds.every((id) => isInt(id, 0)) &&
    isValidPending(v.pendingQuestion) &&
    (v.winner === null || isInt(v.winner, 1, playerCount)) &&
    (v.lastScreen === undefined ||
      (SCREENS.includes(v.lastScreen as Screen) &&
        !NO_GAME_SCREENS.includes(v.lastScreen as Screen)))
  );
}

/**
 * Makes the screen consistent with the game (e.g. no question screen without a question).
 * 'home' / 'newGame' with a game stay as they are (the game was quit to home and is kept), with a
 * `lastScreen` that `CONTINUE_GAME` can resume; on a game screen `lastScreen` is dropped.
 */
function normalize(state: GameState): GameState {
  const { screen, game } = state;
  if (game === null) return NO_GAME_SCREENS.includes(screen) ? state : { screen: 'home', game };
  if (NO_GAME_SCREENS.includes(screen)) {
    if (game.lastScreen === undefined) return state;
    const lastScreen = resumeScreen(game.lastScreen, game);
    return lastScreen === game.lastScreen ? state : { screen, game: { ...game, lastScreen } };
  }
  const playing: Game = { ...game };
  delete playing.lastScreen;
  const fixed = game.lastScreen === undefined ? state : { screen, game: playing };
  if (QUESTION_SCREENS.includes(screen) && game.pendingQuestion === null) {
    return { screen: 'board', game: fixed.game };
  }
  return fixed;
}

/**
 * Loads the saved state, or `null` when there is none, it is corrupted / of another version, or
 * localStorage is unavailable. A saved state without a game starts on 'home' / 'newGame'; one with
 * a game is restored on its screen, 'home' / 'newGame' included (the game is then resumed with
 * "Continue game").
 */
export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const saved: unknown = JSON.parse(raw);
    if (!isObject(saved) || saved.version !== STORAGE_VERSION || !isObject(saved.state)) {
      return null;
    }
    const { screen, game } = saved.state;
    if (!SCREENS.includes(screen as Screen)) return null;
    if (game !== null && !isValidGame(game)) return null;
    return normalize(saved.state as unknown as GameState);
  } catch {
    return null;
  }
}

/**
 * Saves the whole state (errors such as a full or disabled storage are ignored).
 *
 * Finished games (#15): the state is saved as is, so a reload on "Player X wins!" shows the win
 * screen again (the game has `winner` set and `END_TURN` is refused, so it cannot go on). Leaving
 * that screen clears it: Home (`GO_HOME`) saves `{ screen: 'home', game: null }`, i.e. no game at
 * all, and Play again saves a fresh game (turn 1, new code, no asked questions). We keep writing
 * the key rather than removing it when `game` is null, so that 'newGame' survives a reload too;
 * a saved state without a game never restores one.
 */
export function saveState(state: GameState): void {
  try {
    const saved: Saved = { version: STORAGE_VERSION, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage unavailable: the game simply won't survive a reload.
  }
}
