import { pick, randInt } from './rng';
import type { Rng } from './types';

/** Key of a multiple-choice answer. A question has 2–4 choices, always starting at `A`. */
export type ChoiceKey = 'A' | 'B' | 'C' | 'D';

/** Theme of a question. */
export type QuestionCategory = 'History' | 'Concepts' | 'Board';

/** Difficulty of a question. */
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/** A multiple-choice question. `choices` holds 2–4 consecutive keys from `A`. */
export interface Question {
  id: number;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  question: string;
  choices: Partial<Record<ChoiceKey, string>>;
  answer: ChoiceKey;
  explanation: string;
}

/** All possible choice keys, in display order. */
export const CHOICE_KEYS: readonly ChoiceKey[] = ['A', 'B', 'C', 'D'];

/** All question categories. */
export const QUESTION_CATEGORIES: readonly QuestionCategory[] = ['History', 'Concepts', 'Board'];

/** All question difficulties. */
export const QUESTION_DIFFICULTIES: readonly QuestionDifficulty[] = ['easy', 'medium', 'hard'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseQuestion(raw: unknown, index: number): Question {
  const fail = (reason: string): never => {
    throw new Error(`Invalid question at index ${index}: ${reason}`);
  };
  if (!isRecord(raw)) return fail('not an object');
  const { id, category, difficulty, question, choices, answer, explanation } = raw;
  if (typeof id !== 'number' || !Number.isInteger(id)) return fail('id must be an integer');
  if (!QUESTION_CATEGORIES.includes(category as QuestionCategory)) return fail('bad category');
  if (!QUESTION_DIFFICULTIES.includes(difficulty as QuestionDifficulty)) {
    return fail('bad difficulty');
  }
  if (!isNonEmptyString(question)) return fail('question must be a non-empty string');
  if (!isNonEmptyString(explanation)) return fail('explanation must be a non-empty string');
  if (!isRecord(choices)) return fail('choices must be an object');
  const keys = Object.keys(choices);
  if (keys.length < 2 || keys.length > 4) return fail('must have 2 to 4 choices');
  const parsedChoices: Partial<Record<ChoiceKey, string>> = {};
  CHOICE_KEYS.slice(0, keys.length).forEach((key) => {
    const text = choices[key];
    if (!isNonEmptyString(text)) fail(`choices must be A, B, ... in order (missing ${key})`);
    parsedChoices[key] = text as string;
  });
  if (typeof answer !== 'string' || !(answer in parsedChoices)) {
    return fail('answer must be one of the choice keys');
  }
  return {
    id,
    category: category as QuestionCategory,
    difficulty: difficulty as QuestionDifficulty,
    question,
    choices: parsedChoices,
    answer: answer as ChoiceKey,
    explanation,
  };
}

/**
 * Validates raw (e.g. JSON) data and returns it as a typed, non-empty question list.
 * @throws if the data is not a non-empty array of valid questions with unique ids.
 */
export function parseQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Questions must be a non-empty array');
  }
  const questions = raw.map(parseQuestion);
  const ids = new Set(questions.map((q) => q.id));
  if (ids.size !== questions.length) throw new Error('Question ids must be unique');
  return questions;
}

/**
 * Picks a question uniformly among those whose id is not in `asked`, and returns the new asked
 * list (input not modified). Once every question has been asked, a new cycle starts: the pool is
 * reset to all questions, minus the very last asked one (to avoid an immediate repeat) when there
 * is more than one question, and the returned asked list restarts with just the picked id.
 * @throws if `questions` is empty.
 */
export function pickQuestion(
  asked: readonly number[],
  rng: Rng,
  questions: readonly Question[],
): { question: Question; asked: number[] } {
  if (questions.length === 0) throw new Error('Cannot pick from an empty question list');
  const askedSet = new Set(asked);
  const remaining = questions.filter((q) => !askedSet.has(q.id));
  if (remaining.length > 0) {
    const question = pick(rng, remaining);
    return { question, asked: [...asked, question.id] };
  }
  const last = asked[asked.length - 1];
  const pool = questions.length > 1 ? questions.filter((q) => q.id !== last) : questions;
  const question = pick(rng, pool);
  return { question, asked: [question.id] };
}

/** Number of X cards to draw (1–3, uniform), independent of the question difficulty. */
export function drawCardCount(rng: Rng): 1 | 2 | 3 {
  return randInt(rng, 1, 3) as 1 | 2 | 3;
}

/** True if `answer` is the correct choice for `question`. */
export function checkAnswer(question: Question, answer: ChoiceKey): boolean {
  return question.answer === answer;
}

/** Finds a question by id, or `undefined` if none matches. */
export function getQuestion(id: number, questions: readonly Question[]): Question | undefined {
  return questions.find((q) => q.id === id);
}

/** The choice keys present in `question`, in order A → D. */
export function choiceKeys(question: Question): ChoiceKey[] {
  return CHOICE_KEYS.filter((key) => question.choices[key] !== undefined);
}
