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
  /** Any screen → 'board': new game, turn 1, player 1. Invalid code / settings → no-op. */
  | { type: 'START_GAME'; playerCount: PlayerCount; difficulty: Difficulty; code: string }
  /** 'board' or 'result', not the last player → next player, 'board', pending question cleared. */
  | { type: 'NEXT_PLAYER' }
  /** 'board', last player active, no winner → next turn's board (same goal), player 1, 'newBoard'. */
  | { type: 'END_TURN' }
  /** 'newBoard' → 'board'. */
  | { type: 'START_TURN' }
  /** 'board' (menu "New board") → new game with this code, same players and difficulty, turn 1. */
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
  /**
   * 'result' → 'board', pending question cleared. Moves to the next player, except after the last
   * player: the active player then stays the last one, who taps End turn.
   */
  | { type: 'CONTINUE' }
  /** 'board' → 'winner' (choose the winner). */
  | { type: 'OPEN_WINNER' }
  /** 'winner', no winner yet, valid player → winner set; stays on 'winner' ("Player X wins!"). */
  | { type: 'DECLARE_WINNER'; player: number }
  /** 'winner' once declared → new game with this code, same players and difficulty. */
  | { type: 'PLAY_AGAIN'; code: string }
  /**
   * Any screen → 'home', game dropped. Used by the winner screen's Home button once the game is
   * over; to leave a game that goes on, use `QUIT_TO_HOME`.
   */
  | { type: 'GO_HOME' }
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
   * Back: 'newGame' → 'home'; 'questionPopup' → 'board' (like CANCEL_QUESTION);
   * 'winner' before a winner is declared → 'board'. Elsewhere a no-op.
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
function newGame(playerCount: PlayerCount, difficulty: Difficulty, code: string): Game | null {
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
    activePlayer: 1,
    board,
    askedQuestionIds: [],
    pendingQuestion: null,
    winner: null,
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
): GameState {
  const game = newGame(playerCount, difficulty, code);
  return game ? { screen: 'board', game } : state;
}

/** Pure game reducer (see `GameAction` for each action's rules). */
export function gameReducer(state: GameState, action: GameAction): GameState {
  const { screen, game } = state;

  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action.playerCount, action.difficulty, action.code);

    case 'GO_HOME':
      return screen === 'home' && game === null ? state : { screen: 'home', game: null };

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
      if (screen === 'winner' && game && game.winner === null) return { ...state, screen: 'board' };
      return state;
  }

  // Every remaining action needs a game in progress.
  if (!game) return state;

  switch (action.type) {
    case 'NEXT_PLAYER':
      if ((screen !== 'board' && screen !== 'result') || game.activePlayer >= game.playerCount) {
        return state;
      }
      return {
        screen: 'board',
        game: { ...game, activePlayer: game.activePlayer + 1, pendingQuestion: null },
      };

    case 'END_TURN': {
      if (screen !== 'board' || game.activePlayer !== game.playerCount || game.winner !== null) {
        return state;
      }
      const turn = game.turn + 1;
      return {
        screen: 'newBoard',
        game: {
          ...game,
          turn,
          activePlayer: 1,
          board: generateBoard(game.code, turn, game.difficulty, game.board.goal),
          pendingQuestion: null,
        },
      };
    }

    case 'START_TURN':
      return screen === 'newBoard' ? { ...state, screen: 'board' } : state;

    case 'NEW_BOARD':
      return screen === 'board'
        ? startGame(state, game.playerCount, game.difficulty, action.code)
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
      if (screen !== 'result') return state;
      return {
        screen: 'board',
        game: {
          ...game,
          pendingQuestion: null,
          activePlayer:
            game.activePlayer < game.playerCount ? game.activePlayer + 1 : game.activePlayer,
        },
      };

    case 'OPEN_WINNER':
      return screen === 'board' ? { ...state, screen: 'winner' } : state;

    case 'DECLARE_WINNER':
      if (
        screen !== 'winner' ||
        game.winner !== null ||
        !Number.isInteger(action.player) ||
        action.player < 1 ||
        action.player > game.playerCount
      ) {
        return state;
      }
      return { ...state, game: { ...game, winner: action.player } };

    case 'PLAY_AGAIN':
      return screen === 'winner' && game.winner !== null
        ? startGame(state, game.playerCount, game.difficulty, action.code)
        : state;

    default: {
      // Exhaustiveness check; at runtime an unknown action is a no-op.
      const unknownAction: never = action;
      void unknownAction;
      return state;
    }
  }
}
