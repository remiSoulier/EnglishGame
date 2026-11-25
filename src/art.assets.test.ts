/**
 * Task #29 — Figma art: the optimised WebP files in public/art/ (precached, offline PWA), their
 * originals in docs/design/art-src/, and the `webp` precache pattern.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENEMY_CHARACTERS, GOAL_CHARACTER, PLAYER_CHARACTERS } from './state/players';

const ROOT = process.cwd();
const ART = resolve(ROOT, 'public/art');
const SRC = resolve(ROOT, 'docs/design/art-src');

const BACKGROUNDS = ['bg-batman', 'bg-blue-forest', 'bg-blue-lake', 'bg-blue-sky', 'bg-vert'];
const CHARACTERS = [
  'char-batman',
  'char-croco',
  'char-croque-mort',
  'char-dragon',
  'char-gus',
  'char-kitkat',
  'char-spider',
  'char-toad',
];
const ALL = [...BACKGROUNDS, 'board-texture', ...CHARACTERS];

interface WebpInfo {
  /** First chunk: 'VP8 ' (lossy), 'VP8L' (lossless) or 'VP8X' (extended). */
  chunk: string;
  alpha: boolean;
  width: number;
  height: number;
}

const u24 = (b: Buffer, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

/** Reads a WebP container header (RIFF … WEBP) and its canvas size and alpha flag. */
function webp(file: string): WebpInfo {
  const b = readFileSync(file);
  expect(b.subarray(0, 4).toString('ascii'), `${file}: RIFF`).toBe('RIFF');
  expect(b.subarray(8, 12).toString('ascii'), `${file}: WEBP`).toBe('WEBP');
  expect(b.readUInt32LE(4), `${file}: RIFF size`).toBe(b.length - 8);
  const chunk = b.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X') {
    const flags = b[20];
    return {
      chunk,
      alpha: (flags & 0x10) !== 0,
      width: u24(b, 24) + 1,
      height: u24(b, 27) + 1,
    };
  }
  if (chunk === 'VP8L') {
    // 14-bit width − 1 and height − 1 after the 0x2f signature; alpha_is_used bit after them.
    expect(b[20], `${file}: VP8L signature`).toBe(0x2f);
    const bits = b.readUInt32LE(21);
    return {
      chunk,
      alpha: ((bits >> 28) & 1) === 1,
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  expect(chunk, `${file}: chunk`).toBe('VP8 ');
  // Key frame start code 9d 01 2a, then 14-bit width and height.
  expect([...b.subarray(23, 26)], `${file}: VP8 start code`).toEqual([0x9d, 0x01, 0x2a]);
  return {
    chunk,
    alpha: false,
    width: b.readUInt16LE(26) & 0x3fff,
    height: b.readUInt16LE(28) & 0x3fff,
  };
}

describe('public/art (optimised Figma art)', () => {
  it('holds exactly the 14 expected WebP files', () => {
    const files = readdirSync(ART).filter((f) => !f.startsWith('.'));
    expect(files.sort()).toEqual(ALL.map((n) => `${n}.webp`).sort());
  });

  it.each(ALL)('%s.webp is a valid WebP with a sensible size', (name) => {
    const info = webp(resolve(ART, `${name}.webp`));
    expect(info.width).toBeGreaterThanOrEqual(64);
    expect(info.height).toBeGreaterThanOrEqual(64);
    expect(info.width).toBeLessThanOrEqual(2048);
    expect(info.height).toBeLessThanOrEqual(2048);
  });

  it.each(CHARACTERS)('%s.webp keeps its transparency (alpha)', (name) => {
    const info = webp(resolve(ART, `${name}.webp`));
    expect(['VP8X', 'VP8L']).toContain(info.chunk);
    expect(info.alpha).toBe(true);
  });

  it('board texture is square, 644 × 644 (the Grid maps its drawn lines onto the cells)', () => {
    const info = webp(resolve(ART, 'board-texture.webp'));
    expect({ width: info.width, height: info.height }).toEqual({ width: 644, height: 644 });
  });

  it('total size of the art is under 1 MB', () => {
    const total = ALL.reduce((sum, n) => sum + statSync(resolve(ART, `${n}.webp`)).size, 0);
    expect(total).toBeLessThan(1024 * 1024);
  });

  it.each(ALL)('%s has its original PNG in docs/design/art-src/', (name) => {
    expect(existsSync(resolve(SRC, `${name}.png`))).toBe(true);
  });

  it('every character (players, goal, enemies) points to an existing art file (D15)', () => {
    expect(PLAYER_CHARACTERS.map((c) => c.src)).toEqual([
      '/art/char-kitkat.webp',
      '/art/char-batman.webp',
      '/art/char-toad.webp',
      '/art/char-gus.webp',
    ]);
    expect(GOAL_CHARACTER.src).toBe('/art/char-dragon.webp');
    expect(ENEMY_CHARACTERS.map((c) => c.src)).toEqual([
      '/art/char-croco.webp',
      '/art/char-croque-mort.webp',
      '/art/char-spider.webp',
    ]);
    for (const { src } of [...PLAYER_CHARACTERS, GOAL_CHARACTER, ...ENEMY_CHARACTERS]) {
      expect(existsSync(resolve(ROOT, 'public', src.slice(1))), src).toBe(true);
    }
  });
});

describe('build setup for the art', () => {
  it('precaches webp files (workbox globPatterns)', () => {
    const config = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');
    const match = config.match(/globPatterns:\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/\*\*\/\*\.\{[^}]*\bwebp\b[^}]*\}/);
  });

  it('has an `npm run art` script running the optimiser', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.art).toBe('node scripts/optimize-art.mjs');
    expect(existsSync(resolve(ROOT, 'scripts/optimize-art.mjs'))).toBe(true);
  });
});
