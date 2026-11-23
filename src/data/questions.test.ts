import { describe, expect, it } from 'vitest';
import questions from './questions.json';

const CATEGORIES = ['History', 'Concepts', 'Board'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

const data: unknown = questions;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('questions.json', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it('has unique numeric ids', () => {
    const ids = (data as Record<string, unknown>[]).map((q) => q.id);
    for (const id of ids) {
      expect(typeof id).toBe('number');
      expect(Number.isFinite(id)).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each((data as unknown[]).map((q, i) => [i, q] as const))('question #%i', (_i, q) => {
    it('is an object with all required keys', () => {
      expect(isRecord(q)).toBe(true);
      for (const key of [
        'id',
        'category',
        'difficulty',
        'question',
        'choices',
        'answer',
        'explanation',
      ]) {
        expect(q).toHaveProperty(key);
      }
    });

    it('has a valid category and difficulty', () => {
      const r = q as Record<string, unknown>;
      expect(CATEGORIES).toContain(r.category);
      expect(DIFFICULTIES).toContain(r.difficulty);
    });

    it('has non-empty question and explanation strings', () => {
      const r = q as Record<string, unknown>;
      expect(typeof r.question).toBe('string');
      expect((r.question as string).trim().length).toBeGreaterThan(0);
      expect(typeof r.explanation).toBe('string');
      expect((r.explanation as string).trim().length).toBeGreaterThan(0);
    });

    it('has 2-4 ordered choices starting at A with string values', () => {
      const r = q as Record<string, unknown>;
      expect(isRecord(r.choices)).toBe(true);
      const choices = r.choices as Record<string, unknown>;
      const keys = Object.keys(choices);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys.length).toBeLessThanOrEqual(4);
      expect(keys).toEqual(CHOICE_KEYS.slice(0, keys.length));
      for (const key of keys) {
        expect(typeof choices[key]).toBe('string');
        expect((choices[key] as string).trim().length).toBeGreaterThan(0);
      }
    });

    it('has an answer that is a key of choices', () => {
      const r = q as Record<string, unknown>;
      expect(typeof r.answer).toBe('string');
      expect(Object.keys(r.choices as object)).toContain(r.answer);
    });
  });
});
