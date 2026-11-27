import {
  ENEMY_CHARACTERS,
  GOAL_CHARACTER,
  PLAYER_CHARACTERS,
  type PlayerCharacter,
} from '../state/players';

/** Section of the Lexicon a concept belongs to. */
export type LexiconSection = 'basic' | 'further';

/** One programming concept of the Lexicon (decision D25). */
export interface LexiconConcept {
  /** Stable id, used to save which concepts are learned (never change it once shipped). */
  id: string;
  section: LexiconSection;
  /** The word, e.g. "Algorithm". */
  word: string;
  /** Short subtitle under the word, e.g. "Steps to reach a goal". */
  subtitle: string;
  /** Card colour: a --color-lexicon-* token of src/styles/tokens.css. */
  color: string;
  /** Character shown on the card. */
  character: PlayerCharacter;
  /** Explanation shown when the card is open. */
  explanation: string;
  /** Mini program shown in the light box (one instruction per line, indented blocks). */
  program: string;
  /** What the program does, shown in the white pill. */
  result: string;
}

const [kitkat, batman, mushi, gus] = PLAYER_CHARACTERS;
const [croco, kevin, vecna] = ENEMY_CHARACTERS;
const dragon = GOAL_CHARACTER;

const YELLOW = 'var(--color-lexicon-yellow)';
const MINT = 'var(--color-lexicon-mint)';
const LAVENDER = 'var(--color-lexicon-lavender)';
const LIME = 'var(--color-lexicon-lime)';
const BLUE = 'var(--color-lexicon-blue)';

/**
 * The concepts, in card order. Texts written for the user's request "simple texts: loops (the
 * game's Repeat), basic algorithms, other ideas, then a part to go further with if / else,
 * functions". The programs use the game's own cards (Move forward N, Turn left / right, Repeat,
 * IF there is a wall).
 */
export const LEXICON_CONCEPTS: readonly LexiconConcept[] = [
  {
    id: 'algorithm',
    section: 'basic',
    word: 'Algorithm',
    subtitle: 'Steps to reach a goal',
    color: YELLOW,
    character: kitkat,
    explanation:
      'An algorithm is a list of steps, in the right order, that leads to a goal. On the board, the cards you play are an algorithm that takes your character to the dragon.',
    program: 'Move forward 2\nTurn right\nMove forward 1',
    result: 'Kitkat reaches the goal',
  },
  {
    id: 'instruction',
    section: 'basic',
    word: 'Instruction',
    subtitle: 'One simple order',
    color: MINT,
    character: batman,
    explanation:
      'An instruction is one simple order that the computer follows exactly. In SILVA, each card you play is one instruction.',
    program: 'Move forward 1',
    result: 'Batman moves 1 square',
  },
  {
    id: 'sequence',
    section: 'basic',
    word: 'Sequence',
    subtitle: 'The order matters',
    color: LAVENDER,
    character: mushi,
    explanation:
      'A sequence is a set of instructions done one after the other, from top to bottom. If you change the order, you change the result.',
    program: 'Turn right\nMove forward 2',
    result: 'Mushi turns first, then moves',
  },
  {
    id: 'loop',
    section: 'basic',
    word: 'Loop',
    subtitle: 'Repeat instructions',
    color: LIME,
    character: gus,
    explanation:
      'A loop repeats instructions several times, so you do not have to write them again and again. In SILVA, the Repeat card is a loop: it repeats the next cards.',
    program: 'Repeat 3 times:\n  Move forward 1',
    result: 'Gus moves 3 squares',
  },
  {
    id: 'bug',
    section: 'basic',
    word: 'Bug',
    subtitle: 'A mistake in the program',
    color: BLUE,
    character: croco,
    explanation:
      'A bug is a mistake that makes the program do something you did not want. Debugging means finding the bad step and fixing it.',
    program: 'Move forward 3\n(a wall is in the way!)',
    result: 'Croco hits the wall',
  },
  {
    id: 'condition',
    section: 'further',
    word: 'Condition',
    subtitle: 'Only IF it is true',
    color: YELLOW,
    character: kevin,
    explanation:
      'A condition checks something before acting. The instructions inside IF only run when the condition is true.',
    program: 'IF there is a wall:\n  Turn right',
    result: 'Kevin turns only at a wall',
  },
  {
    id: 'if-else',
    section: 'further',
    word: 'If / Else',
    subtitle: 'Choose between two paths',
    color: MINT,
    character: vecna,
    explanation:
      'With IF / ELSE, the program chooses: if the condition is true, it does the first part; else (otherwise), it does the second part.',
    program: 'IF there is a wall:\n  Turn left\nELSE:\n  Move forward 1',
    result: 'Vecna always does one of the two',
  },
  {
    id: 'function',
    section: 'further',
    word: 'Function',
    subtitle: 'Give a name to some steps',
    color: LAVENDER,
    character: dragon,
    explanation:
      'A function groups instructions under a name. You write it once, then you use its name every time you need those steps.',
    program:
      'Function zigzag:\n  Move forward 1\n  Turn right\n  Move forward 1\n  Turn left\nzigzag\nzigzag',
    result: 'The dragon zigzags twice',
  },
  {
    id: 'variable',
    section: 'further',
    word: 'Variable',
    subtitle: 'A box with a name',
    color: LIME,
    character: batman,
    explanation:
      'A variable has a name and stores a value, like a labelled box. The value can change while the program runs.',
    program: 'steps = 2\nMove forward steps\nsteps = steps + 1\nMove forward steps',
    result: 'Batman moves 2, then 3 squares',
  },
  {
    id: 'nested-loop',
    section: 'further',
    word: 'Nested loop',
    subtitle: 'A loop inside a loop',
    color: BLUE,
    character: mushi,
    explanation:
      'You can put a loop inside another loop. Each time the outside loop repeats, the inside loop runs from start to end.',
    program: 'Repeat 2 times:\n  Repeat 3 times:\n    Move forward 1',
    result: 'Mushi moves 6 squares',
  },
];

/** Concepts of a section, in card order. */
export const conceptsOf = (section: LexiconSection): readonly LexiconConcept[] =>
  LEXICON_CONCEPTS.filter((c) => c.section === section);

/** Titles of the sections. */
export const SECTION_TITLE: Readonly<Record<LexiconSection, string>> = {
  basic: 'Basic concepts',
  further: 'Going further',
};

/** Level shown in the stats row. */
export const LEXICON_LEVEL = 'Beginner';
