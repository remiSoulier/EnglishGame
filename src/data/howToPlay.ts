import {
  ENEMY_CHARACTERS,
  GOAL_CHARACTER,
  PLAYER_CHARACTERS,
  type PlayerCharacter,
} from '../state/players';

/** Which illustration a step shows (drawn in src/screens/HowToPlay/Illustrations.tsx). */
export type HowToPlayIllustration =
  'setup' | 'cards' | 'question' | 'obstacles' | 'endTurn' | 'win';

/** One step of the How to play tutorial (decision D28). */
export interface HowToPlayStep {
  title: string;
  /** Rule text, shown under the title. */
  text: string;
  /** Badge colour: a --color-chart-* token. */
  color: string;
  /** True when the badge is dark (white text). */
  dark: boolean;
  character: PlayerCharacter;
  illustration: HowToPlayIllustration;
}

const [kitkat, batman, mushi, gus] = PLAYER_CHARACTERS;
const [croco] = ENEMY_CHARACTERS;

/** Instruction cards of step 2, in hand order (left, middle, right). */
export const TUTORIAL_CARDS: readonly { src: string; alt: string; tilt: number }[] = [
  { src: '/art/card-forward.webp', alt: 'Card: Move forward(1)', tilt: -7 },
  { src: '/art/card-turn.webp', alt: 'Card: Turn left(90)', tilt: 0 },
  { src: '/art/card-repeat.webp', alt: 'Card: Repeat(2)', tilt: 7 },
];

/** The 6 steps, texts as validated on the mockup. */
export const HOW_TO_PLAY_STEPS: readonly HowToPlayStep[] = [
  {
    title: 'Set up the board',
    text: 'On the phone, choose the players, their characters and the level. Each pawn starts on its corner. Put the walls and enemies on the real board, like on the phone.',
    color: 'var(--color-chart-yellow)',
    dark: false,
    character: kitkat,
    illustration: 'setup',
  },
  {
    title: 'Program your pawn',
    text: 'On your turn, play your cards in order: Move forward, Turn left or right, Repeat. Your pawn follows the program, one card after the other.',
    color: 'var(--color-chart-lime)',
    dark: false,
    character: mushi,
    illustration: 'cards',
  },
  {
    title: 'Out of cards? Answer!',
    text: 'Tap Question. The card flips over and you get one try. A right answer gives you new cards.',
    color: 'var(--color-chart-mint)',
    dark: false,
    character: gus,
    illustration: 'question',
  },
  {
    title: 'Watch out',
    text: "Your pawn can't cross a wall. Enemies block their squares: find a path around them.",
    color: 'var(--color-chart-lilac)',
    dark: false,
    character: croco,
    illustration: 'obstacles',
  },
  {
    title: 'End of the turn',
    text: 'Tap End turn. Walls and enemies move: copy the new board. The dragon never moves.',
    color: 'var(--color-chart-yellow)',
    dark: false,
    character: batman,
    illustration: 'endTurn',
  },
  {
    title: 'Reach the dragon',
    text: 'The first pawn to reach the dragon wins. Tell the table, then end the game from the menu.',
    color: 'var(--color-chart-navy)',
    dark: true,
    character: GOAL_CHARACTER,
    illustration: 'win',
  },
];
