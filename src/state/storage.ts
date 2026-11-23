import { ENEMY_COUNT, isValidCode } from '../engine';
import type { GameState, Screen } from './types';

/** localStorage key of the saved game. */
export const STORAGE_KEY = 'bgc.game.v1';

/** Version of the saved shape; bump it when `GameState` changes incompatibly. */
export const STORAGE_VERSION = 1;

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

/** Screens that only make sense without a game in progress. */
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
    isInt(v.activePlayer, 1, playerCount) &&
    isValidBoard(v.board, code, turn, difficulty) &&
    Array.isArray(v.askedQuestionIds) &&
    v.askedQuestionIds.every((id) => isInt(id, 0)) &&
    isValidPending(v.pendingQuestion) &&
    (v.winner === null || isInt(v.winner, 1, playerCount))
  );
}

/** Makes the screen consistent with the game (e.g. no question screen without a question). */
function normalize(state: GameState): GameState {
  const { screen, game } = state;
  if (game === null) return NO_GAME_SCREENS.includes(screen) ? state : { screen: 'home', game };
  if (NO_GAME_SCREENS.includes(screen)) return { screen: 'board', game };
  if (QUESTION_SCREENS.includes(screen) && game.pendingQuestion === null) {
    return { screen: 'board', game };
  }
  return state;
}

/**
 * Loads the saved state, or `null` when there is none, it is corrupted / of another version, or
 * localStorage is unavailable. A saved state without a game starts on 'home' / 'newGame'.
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

/** Saves the whole state (errors such as a full or disabled storage are ignored). */
export function saveState(state: GameState): void {
  try {
    const saved: Saved = { version: STORAGE_VERSION, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage unavailable: the game simply won't survive a reload.
  }
}
