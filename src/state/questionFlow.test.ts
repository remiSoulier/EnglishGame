import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS } from '../data/questions';
import { gameReducer, type GameAction } from './gameReducer';
import { openQuestionAction } from './questionFlow';
import type { GameState } from './types';

const reduce = (s: GameState, a: GameAction) => gameReducer(s, a);

const startedGame = (): GameState =>
  reduce(
    { screen: 'home', game: null },
    { type: 'START_GAME', playerCount: 2, difficulty: 'easy', code: 'ABCD-EFG' },
  );

describe('openQuestionAction', () => {
  it('never repeats a question within a cycle over a long game, and restarts after all', () => {
    let s = startedGame();
    expect(s.screen).toBe('board');
    const total = ALL_QUESTIONS.length;
    const seen: number[] = [];
    for (let i = 0; i < total * 3; i++) {
      const action = openQuestionAction(s.game!.askedQuestionIds);
      expect(action.cards).toBeGreaterThanOrEqual(1);
      expect(action.cards).toBeLessThanOrEqual(3);
      expect(action.resetAsked === true).toBe(i > 0 && i % total === 0);
      s = reduce(s, action);
      expect(s.screen).toBe('questionPopup');
      s = reduce(s, { type: 'SHOW_QUESTION' });
      s = reduce(s, { type: 'ANSWER_QUESTION', answer: 'A' });
      s = reduce(s, { type: 'CONTINUE' });
      seen.push(action.questionId);
    }
    for (let c = 0; c < 3; c++) {
      expect(new Set(seen.slice(c * total, (c + 1) * total)).size).toBe(total);
    }
  });

  it('the reducer refuses an already-asked id unless it is a reset of a finished cycle', () => {
    const start = startedGame();
    const id = ALL_QUESTIONS[0].id;
    const asked = { ...start, game: { ...start.game!, askedQuestionIds: [id] } };
    expect(reduce(asked, { type: 'OPEN_QUESTION', questionId: id, cards: 1 })).toBe(asked);
    expect(
      reduce(asked, { type: 'OPEN_QUESTION', questionId: id, cards: 1, resetAsked: true }),
    ).toBe(asked);
    const all = {
      ...start,
      game: { ...start.game!, askedQuestionIds: ALL_QUESTIONS.map((q) => q.id) },
    };
    const next = reduce(all, { type: 'OPEN_QUESTION', questionId: id, cards: 1, resetAsked: true });
    expect(next.screen).toBe('questionPopup');
    expect(next.game!.askedQuestionIds).toEqual([]);
  });
});
