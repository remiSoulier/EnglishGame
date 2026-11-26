import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEXICON_CONCEPTS } from '../data/lexicon';
import { LEXICON_STORAGE_KEY, loadLearned, saveLearned } from './lexiconProgress';
import { STORAGE_KEY } from './storage';

describe('Lexicon progress (D25)', () => {
  beforeEach(() => localStorage.clear());

  it('uses its own key, never the saved game key', () => {
    expect(LEXICON_STORAGE_KEY).not.toBe(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, 'GAME');
    saveLearned(['loop']);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('GAME');
    expect(Object.keys(localStorage).sort()).toEqual([LEXICON_STORAGE_KEY, STORAGE_KEY].sort());
  });

  it('round-trips, in Lexicon order, once each', () => {
    saveLearned(['loop', 'algorithm', 'loop']);
    expect(loadLearned()).toEqual(['algorithm', 'loop']);
  });

  it('is empty without a save', () => {
    expect(loadLearned()).toEqual([]);
  });

  it.each([
    ['invalid JSON', '{'],
    ['null', 'null'],
    ['an array', '["loop"]'],
    ['another version', JSON.stringify({ version: 2, learned: ['loop'] })],
    ['learned not an array', JSON.stringify({ version: 1, learned: 'loop' })],
  ])('ignores %s', (_label, raw) => {
    localStorage.setItem(LEXICON_STORAGE_KEY, raw);
    expect(loadLearned()).toEqual([]);
  });

  it('drops unknown and non-string ids', () => {
    localStorage.setItem(
      LEXICON_STORAGE_KEY,
      JSON.stringify({ version: 1, learned: ['nope', 3, null, 'loop'] }),
    );
    expect(loadLearned()).toEqual(['loop']);
  });

  it('survives a storage that throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(loadLearned()).toEqual([]);
    expect(() => saveLearned(['loop'])).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });

  it('has 5 concepts with unique ids, Loop among them', () => {
    const ids = LEXICON_CONCEPTS.map((c) => c.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toContain('loop');
  });
});
