import { describe, expect, it } from 'vitest';
import * as engine from './index';

const sources = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('engine purity', () => {
  it('finds the engine source files', () => {
    expect(Object.keys(sources).sort()).toEqual(
      [
        './boardCode.ts',
        './cell.ts',
        './connectivity.ts',
        './index.ts',
        './rng.ts',
        './side.ts',
        './types.ts',
        './walls.ts',
      ].sort(),
    );
  });

  it.each(Object.entries(sources))('%s has only relative imports (no React/DOM)', (_, src) => {
    const specifiers = [...src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    );
    for (const spec of specifiers) {
      expect(spec.startsWith('./')).toBe(true);
    }
    expect(src).not.toMatch(/\breact\b/i);
    expect(src).not.toMatch(/\b(document|window|localStorage)\./);
  });
});

describe('engine entry point', () => {
  it('re-exports the public API', () => {
    for (const name of [
      'BOARD_SIZE',
      'COLUMNS',
      'ENEMY_COUNT',
      'WALL_COUNT',
      'START_CELLS',
      'neighbors',
      'isBlocked',
      'normalizeSide',
      'sideKey',
      'parseSide',
      'sideBetween',
      'isBorderSide',
      'cellsOfSide',
      'sideEndpoints',
      'cellName',
      'parseCell',
      'isInside',
      'allCells',
      'isStartCell',
      'step',
      'mulberry32',
      'randInt',
      'pick',
      'shuffle',
    ]) {
      expect(engine).toHaveProperty(name);
    }
  });
});
