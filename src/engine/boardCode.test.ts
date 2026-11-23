import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  codeToSeed,
  isValidCode,
  newCode,
  normalizeCode,
  parseCode,
  rngFor,
  turnSeed,
} from './boardCode';
import { mulberry32 } from './rng';

describe('boardCode', () => {
  it('generates canonical codes from the alphabet', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const code = newCode(rng);
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{3}$/);
      expect(isValidCode(code)).toBe(true);
      for (const ch of code.replace('-', '')) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(newCode(() => 0)).toBe('AAAA-AAA');
    expect(newCode(() => 0.9999999)).toBe('9999-999');
  });

  it('normalises case, spaces and dashes', () => {
    expect(normalizeCode('k7f2 9qx')).toBe('K7F2-9QX');
    expect(normalizeCode('  K7F2-9QX ')).toBe('K7F2-9QX');
    expect(normalizeCode('k-7-f-2-9-q-x')).toBe('K7F2-9QX');
  });

  it('rejects invalid input', () => {
    expect(normalizeCode('K7F2-9Q')).toBeNull();
    expect(normalizeCode('K7F2-9QO')).toBeNull();
    expect(normalizeCode('K7F2-9Q1')).toBeNull();
    expect(parseCode('ABC')).toEqual({ ok: false, error: 'Code must have 7 characters' });
    expect(parseCode('ABCD-EF0')).toEqual({ ok: false, error: 'Code contains invalid characters' });
    expect(parseCode('k7f29qx')).toEqual({ ok: true, code: 'K7F2-9QX' });
  });

  it('derives stable, input-insensitive seeds', () => {
    expect(codeToSeed('k7f2 9qx')).toBe(codeToSeed('K7F2-9QX'));
    const s1 = turnSeed('K7F2-9QX', 1);
    const s2 = turnSeed('K7F2-9QX', 2);
    expect(s1).not.toBe(s2);
    expect(Number.isInteger(s1) && s1 >= 0 && s1 < 2 ** 32).toBe(true);
    expect(turnSeed('K7F2-9QX', 1)).toBe(s1);
    const a = rngFor('K7F2-9QX', 1);
    const b = rngFor('k7f2-9qx', 1);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    expect(() => codeToSeed('nope')).toThrow();
    expect(() => turnSeed('K7F2-9QX', -1)).toThrow();
  });
});
