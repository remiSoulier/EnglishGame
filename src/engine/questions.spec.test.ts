import { describe, expect, it } from 'vitest';
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

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

/** Builds a valid raw question (as JSON data), with overridable fields. */
const raw = (id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  category: 'History',
  difficulty: 'medium',
  question: `Question ${id}?`,
  choices: { A: 'one', B: 'two', C: 'three', D: 'four' },
  answer: 'C',
  explanation: `Because ${id}.`,
  ...overrides,
});

/** A list of `n` valid questions with ids 1..n. */
const makeQuestions = (n: number): Question[] =>
  parseQuestions(Array.from({ length: n }, (_, i) => raw(i + 1)));

const THIRTY = makeQuestions(30);
const ALL_IDS = THIRTY.map((q) => q.id).sort((a, b) => a - b);

describe('pickQuestion — full game simulation (spec #17)', () => {
  it.each(SEEDS)(
    'seed %i: two full cycles without repeats, no immediate repeat at restart',
    (s) => {
      const rng = mulberry32(s);
      let asked: number[] = [];
      const cycle1: number[] = [];
      for (let i = 0; i < 30; i++) {
        const res = pickQuestion(asked, rng, THIRTY);
        expect(res.asked).toEqual([...asked, res.question.id]);
        asked = res.asked;
        cycle1.push(res.question.id);
      }
      expect(new Set(cycle1).size).toBe(30);
      expect([...cycle1].sort((a, b) => a - b)).toEqual(ALL_IDS);

      // 31st pick: restart, never the 30th id.
      const restart = pickQuestion(asked, rng, THIRTY);
      expect(restart.question.id).not.toBe(cycle1[29]);
      expect(restart.asked).toEqual([restart.question.id]);
      asked = restart.asked;
      const cycle2 = [restart.question.id];

      for (let i = 0; i < 29; i++) {
        const res = pickQuestion(asked, rng, THIRTY);
        asked = res.asked;
        cycle2.push(res.question.id);
      }
      expect(new Set(cycle2).size).toBe(30);
      expect([...cycle2].sort((a, b) => a - b)).toEqual(ALL_IDS);
      expect(asked).toEqual(cycle2);
    },
  );
});

describe('pickQuestion — properties', () => {
  it('first pick is roughly uniform over many seeds', () => {
    const counts = new Map<number, number>();
    const N = 30_000;
    for (let s = 0; s < N; s++) {
      const { question } = pickQuestion([], mulberry32(s), THIRTY);
      counts.set(question.id, (counts.get(question.id) ?? 0) + 1);
    }
    expect(counts.size).toBe(30);
    const expected = N / 30;
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(expected * 0.8);
      expect(c).toBeLessThan(expected * 1.2);
    }
  });

  it('only picks among the not-asked questions, uniformly', () => {
    const asked = ALL_IDS.filter((id) => id > 3); // only 1, 2, 3 remain
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    const rng = mulberry32(5);
    for (let i = 0; i < 9000; i++) {
      const { question } = pickQuestion(asked, rng, THIRTY);
      expect([1, 2, 3]).toContain(question.id);
      counts[question.id]++;
    }
    for (const c of Object.values(counts)) {
      expect(c).toBeGreaterThan(2700);
      expect(c).toBeLessThan(3300);
    }
  });

  it('is deterministic per seed', () => {
    for (const s of SEEDS.slice(0, 20)) {
      const run = (): number[] => {
        const rng = mulberry32(s);
        let asked: number[] = [];
        const ids: number[] = [];
        for (let i = 0; i < 45; i++) {
          const res = pickQuestion(asked, rng, THIRTY);
          asked = res.asked;
          ids.push(res.question.id);
        }
        return ids;
      };
      expect(run()).toEqual(run());
    }
  });

  it('does not mutate the asked array nor the question list', () => {
    const asked = Object.freeze([1, 2, 3]) as readonly number[];
    const list = Object.freeze([...THIRTY]) as readonly Question[];
    const snapshot = JSON.stringify(list);
    const res = pickQuestion(asked, mulberry32(1), list);
    expect(asked).toEqual([1, 2, 3]);
    expect(res.asked).not.toBe(asked);
    expect(JSON.stringify(list)).toBe(snapshot);

    const full = Object.freeze([...ALL_IDS]) as readonly number[];
    const res2 = pickQuestion(full, mulberry32(1), list);
    expect(full).toEqual(ALL_IDS);
    expect(res2.asked).toEqual([res2.question.id]);
  });

  it('ignores unknown ids in asked', () => {
    const list = makeQuestions(3);
    const rng = mulberry32(9);
    // unknown ids do not count: 3 questions still all available
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      seen.add(pickQuestion([99, -1, 1000], rng, list).question.id);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    // asked = [1, 2, 99]: only 3 remains, no restart
    const res = pickQuestion([1, 2, 99], rng, list);
    expect(res.question.id).toBe(3);
    expect(res.asked).toEqual([1, 2, 99, 3]);
  });

  it('single-question list: always that question, restarting each time', () => {
    const one = makeQuestions(1);
    const rng = mulberry32(3);
    let asked: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = pickQuestion(asked, rng, one);
      expect(res.question.id).toBe(1);
      expect(res.asked).toEqual([1]);
      asked = res.asked;
    }
  });

  it('two-question list: strictly alternates across cycles', () => {
    const two = makeQuestions(2);
    for (const s of SEEDS.slice(0, 50)) {
      const rng = mulberry32(s);
      let asked: number[] = [];
      const ids: number[] = [];
      for (let i = 0; i < 20; i++) {
        const res = pickQuestion(asked, rng, two);
        asked = res.asked;
        ids.push(res.question.id);
      }
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });

  it('throws on an empty question list', () => {
    expect(() => pickQuestion([], mulberry32(1), [])).toThrow();
    expect(() => pickQuestion([1], mulberry32(1), [])).toThrow();
  });
});

describe('drawCardCount', () => {
  it('returns only 1, 2 or 3, each about 1/3 over 30 000 draws', () => {
    const rng = mulberry32(2024);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 30_000; i++) {
      const n = drawCardCount(rng);
      expect([1, 2, 3]).toContain(n);
      counts[n]++;
    }
    for (const c of Object.values(counts)) {
      expect(c).toBeGreaterThan(9500);
      expect(c).toBeLessThan(10_500);
    }
  });

  it('is deterministic per seed', () => {
    const a = mulberry32(77);
    const b = mulberry32(77);
    for (let i = 0; i < 100; i++) expect(drawCardCount(a)).toBe(drawCardCount(b));
  });
});

describe('parseQuestions', () => {
  it.each<[string, unknown]>([
    ['null', null],
    ['an object', { 0: raw(1) }],
    ['a string', 'questions'],
    ['an empty array', []],
  ])('rejects %s', (_, data) => {
    expect(() => parseQuestions(data)).toThrow();
  });

  it.each<[string, Record<string, unknown>]>([
    ['non-integer id', { id: 1.5 }],
    ['string id', { id: '1' }],
    ['bad category', { category: 'Science' }],
    ['lowercase category', { category: 'history' }],
    ['bad difficulty', { difficulty: 'extreme' }],
    ['empty question', { question: '' }],
    ['blank question', { question: '   ' }],
    ['empty explanation', { explanation: '' }],
    ['missing explanation', { explanation: undefined }],
    ['1 choice', { choices: { A: 'a' }, answer: 'A' }],
    ['5 choices', { choices: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, answer: 'A' }],
    ['gap in keys A,C', { choices: { A: 'a', C: 'c' }, answer: 'A' }],
    ['keys not starting at A', { choices: { B: 'b', C: 'c' }, answer: 'B' }],
    ['empty choice text', { choices: { A: 'a', B: '' }, answer: 'A' }],
    ['non-string choice', { choices: { A: 'a', B: 2 }, answer: 'A' }],
    ['choices as array', { choices: ['a', 'b'], answer: 'A' }],
    ['answer not in choices', { choices: { A: 'a', B: 'b' }, answer: 'C' }],
    ['answer not a key', { answer: 'Z' }],
    ['lowercase answer', { answer: 'a' }],
  ])('rejects a question with %s', (_, overrides) => {
    expect(() => parseQuestions([raw(1, overrides)])).toThrow();
    // also when hidden among valid ones
    expect(() => parseQuestions([raw(10), raw(1, overrides), raw(11)])).toThrow();
  });

  it('rejects non-object entries', () => {
    expect(() => parseQuestions([raw(1), null])).toThrow();
    expect(() => parseQuestions([raw(1), 'q'])).toThrow();
    expect(() => parseQuestions([[raw(1)]])).toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() => parseQuestions([raw(1), raw(2), raw(1)])).toThrow(/unique/i);
  });

  it('accepts valid 2, 3 and 4-choice questions', () => {
    const parsed = parseQuestions([
      raw(1, { choices: { A: 'a', B: 'b' }, answer: 'B' }),
      raw(2, { choices: { A: 'a', B: 'b', C: 'c' }, answer: 'C', category: 'Board' }),
      raw(3, { answer: 'D', category: 'Concepts', difficulty: 'hard' }),
      raw(4, { difficulty: 'easy', answer: 'A' }),
    ]);
    expect(parsed.map((q) => q.id)).toEqual([1, 2, 3, 4]);
    expect(parsed.map(choiceKeys)).toEqual([
      ['A', 'B'],
      ['A', 'B', 'C'],
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
    ]);
    expect(parsed[0]).toEqual({
      id: 1,
      category: 'History',
      difficulty: 'medium',
      question: 'Question 1?',
      choices: { A: 'a', B: 'b' },
      answer: 'B',
      explanation: 'Because 1.',
    });
  });
});

describe('checkAnswer / getQuestion / choiceKeys', () => {
  const [q1, q2] = parseQuestions([
    raw(5, { choices: { A: 'a', B: 'b', C: 'c' }, answer: 'B' }),
    raw(8, { answer: 'D' }),
  ]);

  it('checkAnswer is true only for the right key', () => {
    expect(checkAnswer(q1, 'B')).toBe(true);
    expect(checkAnswer(q1, 'A')).toBe(false);
    expect(checkAnswer(q1, 'C')).toBe(false);
    expect(checkAnswer(q1, 'D')).toBe(false);
    expect(checkAnswer(q2, 'D')).toBe(true);
    expect(checkAnswer(q2, 'C')).toBe(false);
  });

  it('getQuestion finds by id or returns undefined', () => {
    expect(getQuestion(5, [q1, q2])).toBe(q1);
    expect(getQuestion(8, [q1, q2])).toBe(q2);
    expect(getQuestion(6, [q1, q2])).toBeUndefined();
    expect(getQuestion(5, [])).toBeUndefined();
  });

  it('choiceKeys lists present keys in order', () => {
    expect(choiceKeys(q1)).toEqual(['A', 'B', 'C']);
    expect(choiceKeys(q2)).toEqual(['A', 'B', 'C', 'D']);
  });
});
