import { PLAYER_CHARACTERS, type PlayerCharacter } from '../state/players';

/** One basic programming concept of the Lexicon (decision D25). */
export interface LexiconConcept {
  /** Stable id, used to save which concepts are learned (never change it once shipped). */
  id: string;
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
  /** Mini program shown in the light box (one instruction per line). */
  program: string;
  /** What the program does, shown in the white pill. */
  result: string;
}

const [kitkat, batman, mushi, gus] = PLAYER_CHARACTERS;

/**
 * TODO(D25): only the first row of the validated table reached us (Algorithm: word, subtitle,
 * colour, character; its explanation was cut after "An algorithm"). Every text marked
 * PENDING below is a placeholder to replace with the mockup's content.
 */
const PENDING = 'Text coming soon.';

/** The 5 basic concepts, in card order (top to bottom). */
export const LEXICON_CONCEPTS: readonly LexiconConcept[] = [
  {
    id: 'algorithm',
    word: 'Algorithm',
    subtitle: 'Steps to reach a goal',
    color: 'var(--color-lexicon-yellow)',
    character: kitkat,
    explanation: PENDING,
    program: PENDING,
    result: PENDING,
  },
  {
    id: 'loop',
    word: 'Loop',
    subtitle: PENDING,
    color: 'var(--color-lexicon-mint)',
    character: batman,
    explanation: PENDING,
    program: PENDING,
    result: PENDING,
  },
  {
    id: 'concept-3',
    word: 'Concept 3',
    subtitle: PENDING,
    color: 'var(--color-lexicon-lavender)',
    character: mushi,
    explanation: PENDING,
    program: PENDING,
    result: PENDING,
  },
  {
    id: 'concept-4',
    word: 'Concept 4',
    subtitle: PENDING,
    color: 'var(--color-lexicon-lime)',
    character: gus,
    explanation: PENDING,
    program: PENDING,
    result: PENDING,
  },
  {
    id: 'concept-5',
    word: 'Concept 5',
    subtitle: PENDING,
    color: 'var(--color-lexicon-blue)',
    character: kitkat,
    explanation: PENDING,
    program: PENDING,
    result: PENDING,
  },
];

/** The card open when the Lexicon opens. */
export const DEFAULT_OPEN_CONCEPT = 'loop';

/** Level shown in the stats row. */
export const LEXICON_LEVEL = 'Beginner';
