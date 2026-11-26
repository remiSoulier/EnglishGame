import { useId, useState } from 'react';
import {
  cellName,
  START_CELLS,
  WALL_PIECES,
  wallPiece,
  type Board,
  type Cell,
  type Wall,
} from '../../engine';
import styles from './PositionsList.module.css';

export interface PositionsListProps {
  board: Board;
  playerCount: 2 | 3 | 4;
  /** Open on first render (default: collapsed). */
  defaultOpen?: boolean;
}

function byRowThenColumn(a: Cell, b: Cell): number {
  return a.y - b.y || a.x - b.x;
}

function pieceRank(wall: Wall): number {
  const rank = WALL_PIECES.findIndex((p) => p.id === wall.id);
  return rank === -1 ? WALL_PIECES.length : rank;
}

/** Name of a wall line, e.g. `W6` (no size in mm: the board shows the pieces). */
function wallName(wall: Wall): string {
  return wallPiece(wall.id)?.id ?? 'Wall';
}

/** Cells a wall runs along, without the side letter: `C2-E, C3-E, C3-S` → `C2, C3`. */
function wallCells(wall: Wall): string[] {
  return [...new Set(wall.sides.map((side) => side.split('-')[0]))];
}

/** Collapsible written list of the board positions (goal, enemies, walls, starts). */
export function PositionsList({ board, playerCount, defaultOpen = false }: PositionsListProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const enemies = [...board.enemies].sort(byRowThenColumn).map(cellName);
  const walls = [...board.walls].sort((a, b) => pieceRank(a) - pieceRank(b));
  const starts = START_CELLS.slice(0, playerCount).map(
    (cell, index) => `P${index + 1} ${cellName(cell)}`,
  );

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.chevron} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {open ? 'Hide positions' : 'Show positions'}
      </button>

      <div id={panelId} className={styles.content} hidden={!open}>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt className={styles.term}>Goal:</dt>
            <dd className={styles.value}>{cellName(board.goal)}</dd>
          </div>
          {enemies.length > 0 && (
            <div className={styles.row}>
              <dt className={styles.term}>{enemies.length === 1 ? 'Enemy:' : 'Enemies:'}</dt>
              <dd className={styles.value}>{enemies.join(', ')}</dd>
            </div>
          )}
          {board.walls.length > 0 && (
            <div className={styles.row}>
              <dt className={styles.term}>Walls:</dt>
              <dd className={styles.value}>
                <ul className={styles.walls}>
                  {walls.map((wall, index) => (
                    <li key={index} className={styles.wall}>
                      <span className={styles.wallLabel}>{wallName(wall)}:</span>{' '}
                      {wallCells(wall).join(', ')}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div className={styles.row}>
            <dt className={styles.term}>Start:</dt>
            <dd className={styles.value}>{starts.join(', ')}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
