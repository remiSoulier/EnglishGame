import type { QuestionCategory, QuestionDifficulty } from '../engine';

/** "1 card", "2 cards", "3 cards". */
export function cardsLabel(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}

const DIFFICULTY_LABEL: Readonly<Record<QuestionDifficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** Small tag under a question: "History · Easy". */
export function questionTag(category: QuestionCategory, difficulty: QuestionDifficulty): string {
  return `${category} · ${DIFFICULTY_LABEL[difficulty]}`;
}
