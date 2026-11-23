import type { GameState, Screen } from './types';

/** One way out of a screen: the control the players use, the action and where it leads. */
export interface NavigationExit {
  /** Visible control (button / menu item label), or the system back button. */
  via: string;
  /** Reducer action dispatched (local UI state for the confirmations). */
  action: string;
  to: Screen;
}

/**
 * Navigation map (backlog #12, decision D8: the reducer owns `screen`, no router). For each
 * screen, every exit and the screen it leads to. "Back" entries are also reached with the
 * browser / Android back button (see `canGoBack`); everywhere else the system back button does
 * nothing in the app (it never traps the user: on a screen without a back, it leaves the app as
 * usual).
 *
 * Keep it in sync with `gameReducer` and `App.tsx` (a test can walk it).
 */
export const NAVIGATION: Readonly<Record<Screen, readonly NavigationExit[]>> = {
  home: [
    // Only while a game is saved: "Continue game · Turn N · code".
    { via: 'Continue game', action: 'CONTINUE_GAME', to: 'board' },
    { via: 'Continue game', action: 'CONTINUE_GAME', to: 'newBoard' },
    { via: 'Continue game', action: 'CONTINUE_GAME', to: 'questionPopup' },
    { via: 'Continue game', action: 'CONTINUE_GAME', to: 'question' },
    { via: 'Continue game', action: 'CONTINUE_GAME', to: 'result' },
    { via: 'Continue game', action: 'CONTINUE_GAME', to: 'winner' },
    { via: 'New game', action: 'GO_NEW_GAME', to: 'newGame' },
    // "How to play" and "Lexicon" are disabled (coming soon).
  ],
  newGame: [
    // Replaces a saved game without confirmation (the screen warns about it).
    { via: 'Start game', action: 'START_GAME', to: 'board' },
    { via: 'Back', action: 'BACK', to: 'home' },
  ],
  board: [
    { via: 'Question', action: 'OPEN_QUESTION', to: 'questionPopup' },
    { via: 'Next player', action: 'NEXT_PLAYER', to: 'board' },
    { via: 'End turn', action: 'END_TURN', to: 'newBoard' },
    // Menu. New board and Quit to home ask for a confirmation first (Cancel stays on the board).
    { via: 'Menu › New board › New board', action: 'NEW_BOARD', to: 'board' },
    { via: 'Menu › We have a winner', action: 'OPEN_WINNER', to: 'winner' },
    { via: 'Menu › Quit to home › Quit', action: 'QUIT_TO_HOME', to: 'home' },
  ],
  questionPopup: [
    { via: 'Show the question', action: 'SHOW_QUESTION', to: 'question' },
    { via: 'Cancel', action: 'CANCEL_QUESTION', to: 'board' },
    { via: 'Back', action: 'BACK', to: 'board' },
  ],
  // One try: no back once the question is shown.
  question: [{ via: 'An answer (A–D)', action: 'ANSWER_QUESTION', to: 'result' }],
  result: [{ via: 'Continue', action: 'CONTINUE', to: 'board' }],
  newBoard: [{ via: 'Start turn N+1', action: 'START_TURN', to: 'board' }],
  winner: [
    // Step 1 (no winner yet).
    { via: 'Player X', action: 'DECLARE_WINNER', to: 'winner' },
    { via: 'Back', action: 'BACK', to: 'board' },
    // Step 2 ("Player X wins!").
    { via: 'Play again', action: 'PLAY_AGAIN', to: 'board' },
    { via: 'Home', action: 'GO_HOME', to: 'home' },
  ],
};

/**
 * True when `BACK` leads somewhere from this state: 'newGame', 'questionPopup' and the winner
 * screen before a winner is declared. Mirrors the `BACK` rules of `gameReducer`.
 */
export function canGoBack({ screen, game }: GameState): boolean {
  if (screen === 'newGame') return true;
  if (screen === 'questionPopup') return game !== null;
  if (screen === 'winner') return game !== null && game.winner === null;
  return false;
}
