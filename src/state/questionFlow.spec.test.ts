import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS } from '../data/questions';
import { gameReducer, type GameAction } from './gameReducer';
import { openQuestionAction } from './questionFlow';
import type { GameState } from './types';

const reduce = (s: GameState, a: GameAction) => gameReducer(s, a);

/** Small deterministic PRNG (mulberry32) so the distribution checks are reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const board = (playerCount: 2 | 3 | 4 = 2, difficulty: 'easy' | 'medium' | 'hard' = 'easy') =>
  reduce(
    { screen: 'home', game: null },
    { type: 'START_GAME', playerCount, difficulty, code: 'ABCD-EFG' },
  );

describe('openQuestionAction (spec #13: X random between 1 and 3)', () => {
  it('X is always 1, 2 or 3 and roughly uniform over many draws', () => {
    const rng = seeded(42);
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const { cards } = openQuestionAction([], rng);
      expect([1, 2, 3]).toContain(cards);
      counts[cards]++;
    }
    for (const x of [1, 2, 3]) {
      // Expected 1000 each; allow a wide margin.
      expect(counts[x]).toBeGreaterThan(N / 3 - 150);
      expect(counts[x]).toBeLessThan(N / 3 + 150);
    }
  });

  it('maps the rng edges to 1 and 3 (no 0, no 4)', () => {
    expect(openQuestionAction([], () => 0).cards).toBe(1);
    expect(openQuestionAction([], () => 0.999999).cards).toBe(3);
  });

  it('X does not depend on the game difficulty', () => {
    const draws = (difficulty: 'easy' | 'medium' | 'hard') => {
      const rng = seeded(7);
      const s = board(2, difficulty);
      return Array.from(
        { length: 60 },
        () => openQuestionAction(s.game!.askedQuestionIds, rng).cards,
      );
    };
    const easy = draws('easy');
    expect(new Set(easy)).toEqual(new Set([1, 2, 3]));
    expect(draws('medium')).toEqual(easy);
    expect(draws('hard')).toEqual(easy);
  });

  it('picks a question not yet asked, without resetAsked while some remain', () => {
    const asked = ALL_QUESTIONS.slice(0, ALL_QUESTIONS.length - 1).map((q) => q.id);
    const last = ALL_QUESTIONS[ALL_QUESTIONS.length - 1].id;
    for (const r of [0, 0.5, 0.99]) {
      const action = openQuestionAction(asked, () => r);
      expect(action.questionId).toBe(last);
      expect(action.resetAsked).toBeUndefined();
    }
  });

  it('once all are asked, carries resetAsked and does not repeat the last one asked', () => {
    const asked = ALL_QUESTIONS.map((q) => q.id);
    for (const r of [0, 0.3, 0.6, 0.999]) {
      const action = openQuestionAction(asked, () => r);
      expect(action.resetAsked).toBe(true);
      expect(action.questionId).not.toBe(asked[asked.length - 1]);
    }
  });
});

describe('question flow through the reducer (spec #13/#14)', () => {
  it('Cancel goes back to the board, keeps the player, does not mark the question asked', () => {
    let s = board(3);
    s = reduce(s, { type: 'NEXT_PLAYER' });
    const action = openQuestionAction(s.game!.askedQuestionIds, () => 0.4);
    s = reduce(s, action);
    expect(s.screen).toBe('questionPopup');
    expect(s.game!.pendingQuestion).toEqual({ questionId: action.questionId, cards: action.cards });
    s = reduce(s, { type: 'CANCEL_QUESTION' });
    expect(s.screen).toBe('board');
    expect(s.game!.activePlayer).toBe(2);
    expect(s.game!.pendingQuestion).toBeNull();
    expect(s.game!.askedQuestionIds).toEqual([]);
    // The same question can be opened again.
    expect(reduce(s, action).screen).toBe('questionPopup');
  });

  it('BACK on the popup behaves like Cancel', () => {
    let s = reduce(
      board(),
      openQuestionAction([], () => 0),
    );
    s = reduce(s, { type: 'BACK' });
    expect(s.screen).toBe('board');
    expect(s.game!.askedQuestionIds).toEqual([]);
    expect(s.game!.activePlayer).toBe(1);
  });

  it('a correct answer records correct=true and marks the question asked', () => {
    const q = ALL_QUESTIONS[0];
    let s = reduce(board(), { type: 'OPEN_QUESTION', questionId: q.id, cards: 2 });
    s = reduce(s, { type: 'SHOW_QUESTION' });
    expect(s.screen).toBe('question');
    s = reduce(s, { type: 'ANSWER_QUESTION', answer: q.answer });
    expect(s.screen).toBe('result');
    expect(s.game!.pendingQuestion).toEqual({
      questionId: q.id,
      cards: 2,
      answer: q.answer,
      correct: true,
    });
    expect(s.game!.askedQuestionIds).toEqual([q.id]);
  });

  it('a wrong answer records correct=false; a second answer is ignored', () => {
    const q = ALL_QUESTIONS[0];
    const wrong = q.answer === 'A' ? 'B' : 'A';
    let s = reduce(board(), { type: 'OPEN_QUESTION', questionId: q.id, cards: 1 });
    s = reduce(s, { type: 'SHOW_QUESTION' });
    s = reduce(s, { type: 'ANSWER_QUESTION', answer: wrong });
    expect(s.game!.pendingQuestion!.correct).toBe(false);
    expect(reduce(s, { type: 'ANSWER_QUESTION', answer: q.answer })).toBe(s);
  });

  it('CONTINUE moves to the next player; after the last one the player stays (D8)', () => {
    let s = board(2);
    const ask = () => {
      s = reduce(
        s,
        openQuestionAction(s.game!.askedQuestionIds, () => 0.5),
      );
      s = reduce(s, { type: 'SHOW_QUESTION' });
      s = reduce(s, { type: 'ANSWER_QUESTION', answer: 'A' });
      s = reduce(s, { type: 'CONTINUE' });
    };
    ask();
    expect(s.screen).toBe('board');
    expect(s.game!.activePlayer).toBe(2);
    expect(s.game!.pendingQuestion).toBeNull();
    ask();
    expect(s.game!.activePlayer).toBe(2);
    const ended = reduce(s, { type: 'END_TURN' });
    expect(ended.screen).toBe('newBoard');
    expect(ended.game!.activePlayer).toBe(1);
  });

  it('refuses an already-asked id, an unknown id and an out-of-range card count', () => {
    const q = ALL_QUESTIONS[0];
    let s = reduce(board(), { type: 'OPEN_QUESTION', questionId: q.id, cards: 3 });
    s = reduce(s, { type: 'SHOW_QUESTION' });
    s = reduce(s, { type: 'ANSWER_QUESTION', answer: q.answer });
    s = reduce(s, { type: 'CONTINUE' });
    expect(reduce(s, { type: 'OPEN_QUESTION', questionId: q.id, cards: 1 })).toBe(s);
    expect(reduce(s, { type: 'OPEN_QUESTION', questionId: 99999, cards: 1 })).toBe(s);
    const bad = { type: 'OPEN_QUESTION', questionId: ALL_QUESTIONS[1].id, cards: 4 };
    expect(reduce(s, bad as unknown as GameAction)).toBe(s);
    const zero = { type: 'OPEN_QUESTION', questionId: ALL_QUESTIONS[1].id, cards: 0 };
    expect(reduce(s, zero as unknown as GameAction)).toBe(s);
  });

  it('plays every question once (seeded), then the cycle restarts with resetAsked', () => {
    const rng = seeded(2024);
    let s = board(4);
    const total = ALL_QUESTIONS.length;
    const ids: number[] = [];
    for (let i = 0; i < total + 1; i++) {
      const action = openQuestionAction(s.game!.askedQuestionIds, rng);
      expect(action.resetAsked === true).toBe(i === total);
      s = reduce(s, action);
      expect(s.screen).toBe('questionPopup');
      s = reduce(s, { type: 'SHOW_QUESTION' });
      s = reduce(s, { type: 'ANSWER_QUESTION', answer: 'A' });
      s = reduce(s, { type: 'CONTINUE' });
      ids.push(action.questionId);
      if (s.game!.activePlayer === 4) {
        s = reduce(s, { type: 'END_TURN' });
        s = reduce(s, { type: 'START_TURN' });
      }
    }
    expect(new Set(ids.slice(0, total)).size).toBe(total);
    expect(ids[total]).not.toBe(ids[total - 1]);
    expect(s.game!.askedQuestionIds).toEqual([ids[total]]);
  });
});
