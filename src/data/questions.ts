import { parseQuestions, type Question } from '../engine/questions';
import raw from './questions.json';

/** Every question of the game, validated at module load (throws on invalid data). */
export const ALL_QUESTIONS: readonly Question[] = parseQuestions(raw);
