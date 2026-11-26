import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOW_TO_PLAY_STEPS, TUTORIAL_CARDS } from './howToPlay';

describe('How to play data (D28)', () => {
  it('has 6 steps with non-empty titles and texts and 6 different illustrations', () => {
    expect(HOW_TO_PLAY_STEPS).toHaveLength(6);
    for (const step of HOW_TO_PLAY_STEPS) {
      expect(step.title.trim()).not.toBe('');
      expect(step.text.trim()).not.toBe('');
      expect(step.color).toMatch(/^var\(--color-chart-[a-z]+\)$/);
    }
    expect(new Set(HOW_TO_PLAY_STEPS.map((s) => s.illustration)).size).toBe(6);
  });

  it('uses existing characters, in the validated order', () => {
    expect(HOW_TO_PLAY_STEPS.map((s) => s.character.name)).toEqual([
      'Kitkat',
      'Mushi',
      'Gus',
      'Croco',
      'Batman',
      'Dragon',
    ]);
    for (const { character } of HOW_TO_PLAY_STEPS) {
      expect(existsSync(resolve(process.cwd(), 'public', character.src.slice(1)))).toBe(true);
    }
  });

  it('only the last step has a dark badge', () => {
    expect(HOW_TO_PLAY_STEPS.map((s) => s.dark)).toEqual([false, false, false, false, false, true]);
  });

  it('step 2 cards exist and have an alt text', () => {
    for (const card of TUTORIAL_CARDS) {
      expect(card.alt).toMatch(/^Card: /);
      expect(existsSync(resolve(process.cwd(), 'public', card.src.slice(1)))).toBe(true);
    }
  });

  it('never mentions a board code (D27)', () => {
    for (const step of HOW_TO_PLAY_STEPS) expect(step.text).not.toMatch(/code/i);
  });
});
