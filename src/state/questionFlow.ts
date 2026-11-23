import { ALL_QUESTIONS } from '../data/questions';
import { drawCardCount, pickQuestion, type Question, type Rng } from '../engine';
import type { GameAction } from './gameReducer';

type OpenQuestionAction = Extract<GameAction, { type: 'OPEN_QUESTION' }>;

/**
 * Builds the OPEN_QUESTION action for the Board's Question button: picks a question not asked yet
 * in this cycle and the number of cards at stake (1–3). When every question has been asked, the
 * picker starts a new cycle and the action carries `resetAsked` so the reducer restarts too.
 */
export function openQuestionAction(
  askedQuestionIds: readonly number[],
  rng: Rng = Math.random,
  questions: readonly Question[] = ALL_QUESTIONS,
): OpenQuestionAction {
  const { question, asked } = pickQuestion(askedQuestionIds, rng, questions);
  const resetAsked = askedQuestionIds.length > 0 && asked.length === 1;
  const action: OpenQuestionAction = {
    type: 'OPEN_QUESTION',
    questionId: question.id,
    cards: drawCardCount(rng),
  };
  return resetAsked ? { ...action, resetAsked } : action;
}
