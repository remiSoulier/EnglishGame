import type { Board, Difficulty } from '../engine';

/** Screen currently shown. Navigation is driven by the game reducer (decision D8), no router. */
export type Screen =
  'home' | 'newGame' | 'board' | 'questionPopup' | 'question' | 'result' | 'newBoard';

/** Screens that belong to a game in progress (every screen but 'home' and 'newGame'). */
export type GameScreen = Exclude<Screen, 'home' | 'newGame'>;

/** A multiple-choice answer letter. */
export type AnswerLetter = 'A' | 'B' | 'C' | 'D';

/** Number of players at the table: drives the start cells shown (decision D13). */
export type PlayerCount = 2 | 3 | 4;

/** Number of cards at stake for a question. */
export type QuestionCards = 1 | 2 | 3;

/** The question currently being asked (popup → question → result). */
export interface PendingQuestion {
  questionId: number;
  cards: QuestionCards;
  /** Set once answered. */
  answer?: AnswerLetter;
  /** Set once answered: whether `answer` is the right one. */
  correct?: boolean;
}

/** A game in progress. */
export interface Game {
  code: string;
  difficulty: Difficulty;
  playerCount: PlayerCount;
  turn: number;
  /** Current board (`board.turn === turn`). */
  board: Board;
  /** Ids of the questions already asked in this game. */
  askedQuestionIds: number[];
  pendingQuestion: null | PendingQuestion;
  /**
   * Character of each player (decision D19): `characters[i]` is the index, in
   * `PLAYER_CHARACTERS`, of player i+1's character; one per player, all different. Absent in
   * games saved before D19: then player i plays character i.
   */
  characters?: number[];
  /**
   * Screen the game was on when the players quit to home (`QUIT_TO_HOME`), so that "Continue
   * game" (`CONTINUE_GAME`) returns to it. Absent while the game is being played.
   */
  lastScreen?: GameScreen;
}

/** Whole app state: the current screen and the game in progress (if any). */
export interface GameState {
  screen: Screen;
  game: null | Game;
}
