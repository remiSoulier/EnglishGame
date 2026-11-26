import type { Difficulty } from '../../engine';

/** Display label of each difficulty (Board header, Home "Continue game"). */
export const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
