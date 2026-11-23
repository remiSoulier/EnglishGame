import { mulberry32 } from './rng';
import type { Rng } from './types';

/**
 * Readable board codes, e.g. `K7F2-9QX`.
 *
 * A code is 7 characters drawn from an unambiguous alphabet (no 0/O, 1/I/L), displayed as
 * `XXXX-XXX`. The same code and turn number always derive the same seed, hence the same board.
 */

/** Unambiguous code alphabet: no 0, O, 1, I or L. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Number of significant characters in a code (the dash is not counted). */
export const CODE_LENGTH = 7;

/** Number of characters before the dash in the display form. */
const DASH_POSITION = 4;

/** Result of `parseCode`. */
export type ParseCodeResult = { ok: true; code: string } | { ok: false; error: string };

function format(chars: string): string {
  return `${chars.slice(0, DASH_POSITION)}-${chars.slice(DASH_POSITION)}`;
}

/** Generates a new random code in canonical `XXXX-XXX` form. */
export function newCode(random: () => number = Math.random): string {
  let chars = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length));
    chars += CODE_ALPHABET[index];
  }
  return format(chars);
}

/**
 * Validates user input and returns the canonical code, or an English error message.
 * Input is case-insensitive; spaces and dashes are ignored. Ambiguous characters are rejected.
 */
export function parseCode(input: string): ParseCodeResult {
  // Reject non-ASCII letters/digits before uppercasing: Unicode case mapping would otherwise
  // turn e.g. `ß` into `SS`, `ſ` into `S` or `ﬀ` into `FF`.
  if (/[^A-Za-z0-9\s-]/.test(input)) {
    return { ok: false, error: 'Code contains invalid characters' };
  }
  const chars = input.toUpperCase().replace(/[\s-]/g, '');
  if (chars.length !== CODE_LENGTH) {
    return { ok: false, error: `Code must have ${CODE_LENGTH} characters` };
  }
  for (const ch of chars) {
    if (!CODE_ALPHABET.includes(ch)) {
      return { ok: false, error: 'Code contains invalid characters' };
    }
  }
  return { ok: true, code: format(chars) };
}

/** Returns the canonical `XXXX-XXX` form of `input`, or `null` if it is not a valid code. */
export function normalizeCode(input: string): string | null {
  const result = parseCode(input);
  return result.ok ? result.code : null;
}

/** True if `input` normalises to a valid code. */
export function isValidCode(input: string): boolean {
  return normalizeCode(input) !== null;
}

/** 32-bit FNV-1a hash of a string (UTF-16 code units), as an unsigned integer. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Final avalanche (murmur3 fmix32) so close inputs give well-spread seeds.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function canonicalOrThrow(code: string): string {
  const canonical = normalizeCode(code);
  if (canonical === null) {
    throw new Error(`Invalid board code: ${code}`);
  }
  return canonical;
}

/**
 * Deterministic unsigned 32-bit seed of a code. The code is normalised first, so `k7f2 9qx`
 * and `K7F2-9QX` give the same seed.
 * @throws if the code is invalid.
 */
export function codeToSeed(code: string): number {
  return fnv1a(canonicalOrThrow(code));
}

/**
 * Unsigned 32-bit seed for a given code and turn: different for each turn, reproducible everywhere.
 * @throws if the code is invalid or `turn` is not a non-negative integer.
 */
export function turnSeed(code: string, turn: number): number {
  if (!Number.isInteger(turn) || turn < 0) {
    throw new Error(`Invalid turn: ${turn}`);
  }
  return fnv1a(`${canonicalOrThrow(code)}#${turn}`);
}

/** Seeded PRNG for a given code and turn (`mulberry32(turnSeed(code, turn))`). */
export function rngFor(code: string, turn: number): Rng {
  return mulberry32(turnSeed(code, turn));
}
