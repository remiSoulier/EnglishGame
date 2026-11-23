import { describe, expect, it } from 'vitest';
import { checkAnswer, choiceKeys, getQuestion, pickQuestion } from '../engine/questions';
import { mulberry32 } from '../engine/rng';
import { ALL_QUESTIONS } from './questions';
import rawQuestions from './questions.json';

describe('ALL_QUESTIONS loader', () => {
  it('loads the 30 questions from questions.json', () => {
    expect(ALL_QUESTIONS).toHaveLength(30);
    expect(ALL_QUESTIONS).toEqual(rawQuestions);
    expect(new Set(ALL_QUESTIONS.map((q) => q.id)).size).toBe(30);
  });

  it('every question has a correct answer among its choices', () => {
    for (const q of ALL_QUESTIONS) {
      expect(choiceKeys(q)).toContain(q.answer);
      expect(checkAnswer(q, q.answer)).toBe(true);
      expect(getQuestion(q.id, ALL_QUESTIONS)).toBe(q);
    }
  });

  it('covers every category and difficulty', () => {
    expect(new Set(ALL_QUESTIONS.map((q) => q.category))).toEqual(
      new Set(['History', 'Concepts', 'Board']),
    );
    expect(new Set(ALL_QUESTIONS.map((q) => q.difficulty))).toEqual(
      new Set(['easy', 'medium', 'hard']),
    );
  });

  it('a full game over the real questions asks each one once before repeating', () => {
    for (let s = 0; s < 50; s++) {
      const rng = mulberry32(s);
      let asked: number[] = [];
      const ids: number[] = [];
      for (let i = 0; i < 31; i++) {
        const res = pickQuestion(asked, rng, ALL_QUESTIONS);
        asked = res.asked;
        ids.push(res.question.id);
      }
      expect(new Set(ids.slice(0, 30)).size).toBe(30);
      expect(ids[30]).not.toBe(ids[29]);
    }
  });
});
