/**
 * The fixed set of eight physical wall pieces (decision D12). Cells are 44 mm wide, so one side
 * of a cell is 44 mm of wall.
 *
 * Canonical piece (rotation 0), on the grid-corner lattice with y growing downwards (row 1 at the
 * top):
 * - straight piece of `n` sides: `n` unit steps East (left → right) from its anchor point.
 * - L piece with `arms: [a, b]`: `a` unit steps East from its anchor point, then a clockwise
 *   (right-hand) 90° turn and `b` unit steps South. W6 (2 + 1) is therefore `‾‾|` (the 2-side arm
 *   along the top, the 1-side arm going down on the right) and W8 (3 + 2) is the same with arms of
 *   3 and 2.
 *
 * Orientations: a straight piece is horizontal (steps East) or vertical (steps South); an L piece
 * is one of the 4 rotations of its canonical path (first arm East, South, West or North, the turn
 * always clockwise). Mirrored pieces (first arm then a counter-clockwise turn) are never placed:
 * see `matchesPiece` in `walls.ts` for the exact rule.
 */

/** Name of a physical wall piece. */
export type WallId = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W7' | 'W8';

/** Width of one cell (hence length of one wall side) in millimetres. */
export const CELL_SIZE_MM = 44;

/** One physical wall piece. */
export interface WallPiece {
  id: WallId;
  shape: 'straight' | 'L';
  /** `[n]` for a straight piece; `[first arm, second arm]` (in sides) for an L piece. */
  arms: readonly [number] | readonly [number, number];
  /** Total number of cell sides covered. */
  length: number;
  /** Physical size for the UI, e.g. `"88 mm"` or `"88 + 44 mm"`. */
  sizeMm: string;
}

function piece(id: WallId, arms: [number] | [number, number]): WallPiece {
  return Object.freeze({
    id,
    shape: arms.length === 1 ? 'straight' : 'L',
    arms: Object.freeze(arms),
    length: arms.reduce((sum, n) => sum + n, 0),
    sizeMm: `${arms.map((n) => n * CELL_SIZE_MM).join(' + ')} mm`,
  });
}

/** The eight wall pieces, in id order W1 … W8. */
export const WALL_PIECES: readonly WallPiece[] = Object.freeze([
  piece('W1', [2]),
  piece('W2', [2]),
  piece('W3', [3]),
  piece('W4', [4]),
  piece('W5', [1, 1]),
  piece('W6', [2, 1]),
  piece('W7', [2, 2]),
  piece('W8', [3, 2]),
]);

/** The piece with the given id, or `undefined` for an unknown id. */
export function wallPiece(id: WallId): WallPiece | undefined {
  return WALL_PIECES.find((p) => p.id === id);
}
