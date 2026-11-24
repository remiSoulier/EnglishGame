import { useId, useState } from 'react';
import { cellName, START_CELLS, type Board, type Cell } from '../../engine';
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

/** Collapsible written list of the board positions (goal, enemies, walls, starts). */
export function PositionsList({ board, playerCount, defaultOpen = false }: PositionsListProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const enemies = [...board.enemies].sort(byRowThenColumn).map(cellName);
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
                  {board.walls.map((wall, index) => (
                    <li key={index} className={styles.wall}>
                      <span className={styles.wallLabel}>Wall {index + 1}:</span>{' '}
                      {wall.sides.join(', ')}
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
        <p className={styles.hint}>E = east side, S = south side of the cell.</p>
      </div>
    </section>
  );
}
