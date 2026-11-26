import { defaultCharacters, isValidCharacters } from './players';
import { ALL_QUESTIONS } from '../data/questions';
import { checkAnswer, ENEMY_COUNT, generateBoard, getQuestion, type Difficulty } from '../engine';
import type {
  AnswerLetter,
  Game,
  GameScreen,
  GameState,
  PlayerCount,
  QuestionCards,
} from './types';

/**
 * Game actions. Every action that does not make sense in the current state (wrong screen, no game,
 * invalid payload) is a no-op: the reducer returns the very same state object.
 *
 * The reducer is pure and deterministic: random values (board codes, question, number of cards)
 * are picked by the caller and passed in the payload.
 */
export type GameAction =
  /** Any screen → 'board': new game, turn 1. Invalid code / settings → no-op. */
  | {
      type: 'START_GAME';
      playerCount: PlayerCount;
      difficulty: Difficulty;
      code: string;
      /** Character of each player (D19); ignored unless one per player, all different. */
      characters?: number[];
    }
  /**
   * 'board' → next turn's board (same goal), 'newBoard'. The app does not track whose
   * turn it is (decision D11): End turn can be tapped at any time.
   */
  | { type: 'END_TURN' }
  /** 'newBoard' → 'board'. */
  | { type: 'START_TURN' }
  /**
   * 'board' (menu "New board") → new game with this code, same players, characters and
   * difficulty, turn 1.
   */
  | { type: 'NEW_BOARD'; code: string }
  /**
   * 'board', no pending question, known id, 1–3 cards → pending question set, 'questionPopup'.
   * The id must not have been asked yet, unless `resetAsked` is set: that starts a new cycle (only
   * allowed once every question has been asked) and clears `askedQuestionIds`.
   */
  | { type: 'OPEN_QUESTION'; questionId: number; cards: QuestionCards; resetAsked?: boolean }
  /** 'questionPopup' → 'board', pending question cleared (the question is NOT marked as asked). */
  | { type: 'CANCEL_QUESTION' }
  /** 'questionPopup' → 'question'. */
  | { type: 'SHOW_QUESTION' }
  /** 'question' → 'result': records the answer and whether it is correct, marks the id asked. */
  | { type: 'ANSWER_QUESTION'; answer: AnswerLetter }
  /** 'result' → 'board', pending question cleared. */
  | { type: 'CONTINUE' }
  /**
   * 'board' (menu "End game", after confirmation) → 'home', game dropped: no "Continue game"
   * (decision D13). Elsewhere a no-op. To leave a game that goes on, use `QUIT_TO_HOME`.
   */
  | { type: 'END_GAME' }
  /**
   * Any game screen → 'home', game KEPT (saved) with `lastScreen` set to the screen it was on.
   * On 'home' / 'newGame' or without a game, a no-op.
   */
  | { type: 'QUIT_TO_HOME' }
  /**
   * 'home' with a game → back to `game.lastScreen` ('board' when absent, or when it is a question
   * screen without a pending question); `lastScreen` is cleared. Elsewhere a no-op.
   */
  | { type: 'CONTINUE_GAME' }
  /**
   * 'home' → 'newGame'. A game in progress is kept until START_GAME replaces it (Back returns to
   * 'home' with the game still there).
   */
  | { type: 'GO_NEW_GAME' }
  /**
   * Back: 'newGame' → 'home'; 'questionPopup' → 'board' (like CANCEL_QUESTION). Elsewhere a no-op.
   */
  | { type: 'BACK' };

export const initialState: GameState = { screen: 'home', game: null };

const PLAYER_COUNTS: readonly number[] = [2, 3, 4];
const CARD_COUNTS: readonly number[] = [1, 2, 3];
const LETTERS: readonly string[] = ['A', 'B', 'C', 'D'];

/** True once every question of the game has been asked in the current cycle. */
function allAsked(asked: readonly number[]): boolean {
  const askedSet = new Set(asked);
  return ALL_QUESTIONS.every((q) => askedSet.has(q.id));
}

/** Builds a fresh game at turn 1, or `null` if the settings or the code are invalid. */
function newGame(
  playerCount: PlayerCount,
  difficulty: Difficulty,
  code: string,
  characters?: number[],
): Game | null {
  if (!PLAYER_COUNTS.includes(playerCount)) return null;
  if (!Object.prototype.hasOwnProperty.call(ENEMY_COUNT, difficulty)) return null;
  let board;
  try {
    board = generateBoard(code, 1, difficulty);
  } catch {
    return null;
  }
  return {
    code: board.code,
    difficulty,
    playerCount,
    turn: 1,
    board,
    askedQuestionIds: [],
    pendingQuestion: null,
    characters: isValidCharacters(characters, playerCount)
      ? [...characters!]
      : defaultCharacters(playerCount),
  };
}

/**
 * Screen to resume a saved game on: `lastScreen`, unless it is missing or needs a pending
 * question (or an answer) the game does not have, in which case 'board'.
 */
export function resumeScreen(lastScreen: GameScreen | undefined, game: Game): GameScreen {
  if (!lastScreen) return 'board';
  const pending = game.pendingQuestion;
  if ((lastScreen === 'questionPopup' || lastScreen === 'question') && !pending) return 'board';
  if (lastScreen === 'result' && !pending?.answer) return 'board';
  return lastScreen;
}

function startGame(
  state: GameState,
  playerCount: PlayerCount,
  difficulty: Difficulty,
  code: string,
  characters?: number[],
): GameState {
  const game = newGame(playerCount, difficulty, code, characters);
  return game ? { screen: 'board', game } : state;
}

/** Pure game reducer (see `GameAction` for each action's rules). */
export function gameReducer(state: GameState, action: GameAction): GameState {
  const { screen, game } = state;

  switch (action.type) {
    case 'START_GAME':
      return startGame(
        state,
        action.playerCount,
        action.difficulty,
        action.code,
        action.characters,
      );

    case 'QUIT_TO_HOME':
      if (!game || screen === 'home' || screen === 'newGame') return state;
      return { screen: 'home', game: { ...game, lastScreen: screen } };

    case 'CONTINUE_GAME': {
      if (!game || screen !== 'home') return state;
      const { lastScreen, ...rest } = game;
      return { screen: resumeScreen(lastScreen, rest), game: rest };
    }

    case 'GO_NEW_GAME':
      return screen === 'home' ? { ...state, screen: 'newGame' } : state;

    case 'BACK':
      if (screen === 'newGame') return { ...state, screen: 'home' };
      if (screen === 'questionPopup' && game) {
        return { screen: 'board', game: { ...game, pendingQuestion: null } };
      }
      return state;
  }

  // Every remaining action needs a game in progress.
  if (!game) return state;

  switch (action.type) {
    case 'END_TURN': {
      if (screen !== 'board') return state;
      const turn = game.turn + 1;
      return {
        screen: 'newBoard',
        game: {
          ...game,
          turn,
          board: generateBoard(game.code, turn, game.difficulty, game.board.goal),
          pendingQuestion: null,
        },
      };
    }

    case 'START_TURN':
      return screen === 'newBoard' ? { ...state, screen: 'board' } : state;

    case 'END_GAME':
      return screen === 'board' ? { screen: 'home', game: null } : state;

    case 'NEW_BOARD':
      return screen === 'board'
        ? startGame(state, game.playerCount, game.difficulty, action.code, game.characters)
        : state;

    case 'OPEN_QUESTION': {
      const reset = action.resetAsked === true;
      if (
        screen !== 'board' ||
        game.pendingQuestion !== null ||
        !getQuestion(action.questionId, ALL_QUESTIONS) ||
        !CARD_COUNTS.includes(action.cards) ||
        (reset
          ? !allAsked(game.askedQuestionIds)
          : game.askedQuestionIds.includes(action.questionId))
      ) {
        return state;
      }
      return {
        screen: 'questionPopup',
        game: {
          ...game,
          askedQuestionIds: reset ? [] : game.askedQuestionIds,
          pendingQuestion: { questionId: action.questionId, cards: action.cards },
        },
      };
    }

    case 'CANCEL_QUESTION':
      return screen === 'questionPopup'
        ? { screen: 'board', game: { ...game, pendingQuestion: null } }
        : state;

    case 'SHOW_QUESTION':
      return screen === 'questionPopup' ? { ...state, screen: 'question' } : state;

    case 'ANSWER_QUESTION': {
      const pending = game.pendingQuestion;
      if (screen !== 'question' || !pending || !LETTERS.includes(action.answer)) return state;
      const question = getQuestion(pending.questionId, ALL_QUESTIONS);
      if (!question) return state;
      const asked = game.askedQuestionIds;
      return {
        screen: 'result',
        game: {
          ...game,
          pendingQuestion: {
            ...pending,
            answer: action.answer,
            correct: checkAnswer(question, action.answer),
          },
          askedQuestionIds: asked.includes(pending.questionId)
            ? asked
            : [...asked, pending.questionId],
        },
      };
    }

    case 'CONTINUE':
      return screen === 'result'
        ? { screen: 'board', game: { ...game, pendingQuestion: null } }
        : state;

    default: {
      // Exhaustiveness check; at runtime an unknown action is a no-op.
      const unknownAction: never = action;
      void unknownAction;
      return state;
    }
  }
}
