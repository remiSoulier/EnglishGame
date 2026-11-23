import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS } from '../data/questions';
import {
  checkAnswer,
  choiceKeys,
  drawCardCount,
  getQuestion,
  parseQuestions,
  pickQuestion,
  type Question,
} from './questions';
import { mulberry32 } from './rng';

const q = (id: number): Question => ({
  id,
  category: 'Concepts',
  difficulty: 'easy',
  question: `Q${id}`,
  choices: { A: 'a', B: 'b' },
  answer: 'B',
  explanation: 'e',
});

describe('questions', () => {
  it('loads and validates the JSON questions', () => {
    expect(ALL_QUESTIONS.length).toBe(30);
    expect(choiceKeys(ALL_QUESTIONS[0])).toEqual(['A', 'B', 'C', 'D']);
  });

  it('parseQuestions rejects invalid data', () => {
    expect(() => parseQuestions([])).toThrow();
    expect(() => parseQuestions([{ ...q(1), answer: 'C' }])).toThrow();
    expect(() => parseQuestions([{ ...q(1), choices: { A: 'a', C: 'c' } }])).toThrow();
    expect(() => parseQuestions([q(1), q(1)])).toThrow();
    expect(parseQuestions([q(1), q(2)])).toEqual([q(1), q(2)]);
  });

  it('pickQuestion never repeats within a cycle, then restarts without immediate repeat', () => {
    const rng = mulberry32(42);
    let asked: number[] = [];
    const seen: number[] = [];
    for (let i = 0; i < ALL_QUESTIONS.length; i++) {
      const r = pickQuestion(asked, rng, ALL_QUESTIONS);
      seen.push(r.question.id);
      asked = r.asked;
    }
    expect(new Set(seen).size).toBe(ALL_QUESTIONS.length);
    const next = pickQuestion(asked, rng, ALL_QUESTIONS);
    expect(next.asked).toEqual([next.question.id]);
    expect(next.question.id).not.toBe(asked[asked.length - 1]);
  });

  it('pickQuestion handles a single question and throws on an empty list', () => {
    expect(pickQuestion([1], mulberry32(1), [q(1)]).asked).toEqual([1]);
    expect(() => pickQuestion([], mulberry32(1), [])).toThrow();
  });

  it('drawCardCount, checkAnswer, getQuestion', () => {
    const rng = mulberry32(7);
    const counts = new Set(Array.from({ length: 100 }, () => drawCardCount(rng)));
    expect([...counts].sort()).toEqual([1, 2, 3]);
    expect(checkAnswer(q(1), 'B')).toBe(true);
    expect(checkAnswer(q(1), 'A')).toBe(false);
    expect(getQuestion(2, [q(1), q(2)])).toEqual(q(2));
    expect(getQuestion(3, [q(1)])).toBeUndefined();
  });
});
