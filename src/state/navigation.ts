import type { GameState, Screen } from './types';

/**
 * The Lexicon (decision D25): not a reducer screen but local UI state of App.tsx, drawn over
 * Home or the board (left inert behind it). Opening or closing it never dispatches.
 */
export const LEXICON = 'lexicon';

/**
 * How to play (decision D28): the 6-step tutorial, local UI state of App.tsx too, drawn over
 * Home only.
 */
export const HOW_TO_PLAY = 'howToPlay';

/** Where an exit leads: a reducer screen, or the Lexicon / How to play drawn over it. */
export type NavigationTarget = Screen | typeof LEXICON | typeof HOW_TO_PLAY;

/** One way out of a screen: the control the players use, the action and where it leads. */
export interface NavigationExit {
  /** Visible control (button / menu item label), or the system back button. */
  via: string;
  /**
   * Reducer action dispatched, or `UI:…` for local UI state of App.tsx (the Lexicon; the
   * confirmations are written as the action their confirm button dispatches).
   */
  action: string;
  to: NavigationTarget;
}

/** Local UI action opening the Lexicon over the current screen (no reducer action). */
export const OPEN_LEXICON = 'UI:OPEN_LEXICON';

/** Local UI action opening How to play at step 1 (no reducer action). */
export const OPEN_HOW_TO_PLAY = 'UI:OPEN_HOW_TO_PLAY';

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
    { via: 'New game', action: 'GO_NEW_GAME', to: 'newGame' },
    { via: 'Lexicon', action: OPEN_LEXICON, to: LEXICON },
    { via: 'How to play', action: OPEN_HOW_TO_PLAY, to: HOW_TO_PLAY },
  ],
  newGame: [
    // Replaces a saved game without confirmation (the screen warns about it).
    { via: 'Start game', action: 'START_GAME', to: 'board' },
    { via: 'Back', action: 'BACK', to: 'home' },
  ],
  board: [
    { via: 'Question', action: 'OPEN_QUESTION', to: 'questionPopup' },
    // Always shown (decision D11: no turn order).
    { via: 'End turn', action: 'END_TURN', to: 'newBoard' },
    // Menu. Every item but Lexicon asks for a confirmation first (Cancel stays on the board).
    { via: 'Menu › New board › New board', action: 'NEW_BOARD', to: 'board' },
    { via: 'Menu › Lexicon', action: OPEN_LEXICON, to: LEXICON },
    // Decision D13: the game is deleted, Home offers no "Continue game".
    { via: 'Menu › End game › End game', action: 'END_GAME', to: 'home' },
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
};

/**
 * Exits of the Lexicon (decision D25). "Back" (‹ or the system back button) goes from "See all"
 * to the Lexicon entry, and from the entry back to the screen it was opened over, exactly as it
 * was: Home, or the board with the same board and turn (nothing is dispatched or saved).
 */
export const LEXICON_EXITS: readonly { from: 'main' | 'all'; via: string; to: string }[] = [
  { from: 'main', via: 'See all', to: 'all' },
  { from: 'all', via: 'Back', to: 'main' },
  { from: 'main', via: 'Back', to: 'the screen it was opened over (home or board)' },
];

/** Screens the Lexicon can be opened over (the exits of NAVIGATION that lead to it). */
export const LEXICON_OPENERS: readonly Screen[] = (Object.keys(NAVIGATION) as Screen[]).filter(
  (screen) => NAVIGATION[screen].some((exit) => exit.to === LEXICON),
);

/**
 * Exits of How to play (decision D28). ‹, Skip and the system back button close it, back to
 * Home exactly as it was; Back / Next (and the ← / → keys) move between the 6 steps; "Start a
 * game" on step 6 closes it and dispatches GO_NEW_GAME.
 */
export const HOW_TO_PLAY_EXITS: readonly NavigationExit[] = [
  { via: 'Back (‹)', action: 'UI:CLOSE_HOW_TO_PLAY', to: 'home' },
  { via: 'Skip', action: 'UI:CLOSE_HOW_TO_PLAY', to: 'home' },
  { via: 'System back', action: 'UI:CLOSE_HOW_TO_PLAY', to: 'home' },
  { via: 'Start a game (step 6)', action: 'GO_NEW_GAME', to: 'newGame' },
];

/** Screens How to play can be opened over (the exits of NAVIGATION that lead to it). */
export const HOW_TO_PLAY_OPENERS: readonly Screen[] = (Object.keys(NAVIGATION) as Screen[]).filter(
  (screen) => NAVIGATION[screen].some((exit) => exit.to === HOW_TO_PLAY),
);

/**
 * True when `BACK` leads somewhere from this state: 'newGame' and 'questionPopup'. Mirrors the
 * `BACK` rules of `gameReducer`.
 */
export function canGoBack({ screen, game }: GameState): boolean {
  if (screen === 'newGame') return true;
  if (screen === 'questionPopup') return game !== null;
  return false;
}
