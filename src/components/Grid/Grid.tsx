import {
  BOARD_SIZE,
  cellName,
  COLUMNS,
  sideEndpoints,
  START_CELLS,
  type Board,
} from '../../engine';
import { describeBoard } from './describeBoard';
import { CELL } from './geometry';
import styles from './Grid.module.css';
import { EnemyShape, GoalShape, StartShape, WallEnd, WallLabel, WallShape } from './shapes';
import { wallEnds } from './wallEnds';
import { placeWallLabels, wallTitle } from './wallLabels';

export interface GridProps {
  board: Board;
  /** Number of players: only the first `playerCount` start cells are outlined. Defaults to 4. */
  playerCount?: 2 | 3 | 4;
  className?: string;
}

const SIZE = CELL * BOARD_SIZE;
/** Room for the coordinate labels (top and left). */
const LABEL_MARGIN = 26;
/** Room for half a wall stroke on the right/bottom border. */
const EDGE_MARGIN = 6;
const VIEW = SIZE + LABEL_MARGIN + EDGE_MARGIN;

const lines = Array.from({ length: BOARD_SIZE - 1 }, (_, i) => (i + 1) * CELL);

/** SVG rendering of a 9×9 board: walls, enemies, goal and start cells (never pawns). */
export function Grid({ board, playerCount = 4, className }: GridProps) {
  const summary = describeBoard(board);
  const starts = START_CELLS.slice(0, playerCount);
  const labelPoints = placeWallLabels(board.walls, [...board.enemies, board.goal], starts);

  return (
    <svg
      className={className ? `${styles.svg} ${className}` : styles.svg}
      viewBox={`${-LABEL_MARGIN} ${-LABEL_MARGIN} ${VIEW} ${VIEW}`}
      role="img"
      aria-label={summary}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{summary}</title>

      <g aria-hidden="true">
        {COLUMNS.map((col, x) => (
          <text key={col} className={styles.label} x={x * CELL + CELL / 2} y={-LABEL_MARGIN / 2}>
            {col}
          </text>
        ))}
        {COLUMNS.map((_, y) => (
          <text key={y} className={styles.label} x={-LABEL_MARGIN / 2} y={y * CELL + CELL / 2}>
            {y + 1}
          </text>
        ))}
      </g>

      <rect className={styles.boardBg} x={0} y={0} width={SIZE} height={SIZE} />
      <g data-testid="grid-lines">
        {lines.map((p) => (
          <line key={`v${p}`} className={styles.gridLine} x1={p} y1={0} x2={p} y2={SIZE} />
        ))}
        {lines.map((p) => (
          <line key={`h${p}`} className={styles.gridLine} x1={0} y1={p} x2={SIZE} y2={p} />
        ))}
      </g>
      <rect className={styles.border} x={0} y={0} width={SIZE} height={SIZE} />

      <g data-testid="starts">
        {starts.map((cell, i) => (
          <g key={cellName(cell)} data-cell={cellName(cell)}>
            <title>{`Start P${i + 1}: ${cellName(cell)}`}</title>
            <StartShape x={cell.x * CELL} y={cell.y * CELL} label={`P${i + 1}`} />
          </g>
        ))}
      </g>

      <g data-testid="goal" data-cell={cellName(board.goal)}>
        <title>{`Goal: ${cellName(board.goal)}`}</title>
        <GoalShape cx={board.goal.x * CELL + CELL / 2} cy={board.goal.y * CELL + CELL / 2} />
      </g>

      <g data-testid="enemies">
        {board.enemies.map((cell) => (
          <g key={cellName(cell)} data-cell={cellName(cell)}>
            <title>{`Enemy: ${cellName(cell)}`}</title>
            <EnemyShape cx={cell.x * CELL + CELL / 2} cy={cell.y * CELL + CELL / 2} />
          </g>
        ))}
      </g>

      <g data-testid="walls">
        {board.walls.map((wall) => {
          const key = wall.sides.join(' ');
          return (
            <g key={key} data-wall={key}>
              <title>{wallTitle(wall)}</title>
              <WallShape
                segments={wall.sides.map((side) => {
                  const [a, b] = sideEndpoints(side);
                  return { x1: a.px * CELL, y1: a.py * CELL, x2: b.px * CELL, y2: b.py * CELL };
                })}
              />
            </g>
          );
        })}
      </g>

      {/* Above every wall (so a later piece never hides an earlier piece's end), below badges. */}
      <g data-testid="wall-ends" aria-hidden="true">
        {board.walls.flatMap((wall) =>
          wallEnds(wall).map((p) => (
            <WallEnd key={`${wall.sides.join(' ')}@${p.x},${p.y}`} x={p.x} y={p.y} />
          )),
        )}
      </g>

      <g data-testid="wall-labels" aria-hidden="true">
        {board.walls.map((wall, index) =>
          wall.id ? (
            <WallLabel
              key={wall.id}
              id={wall.id}
              x={labelPoints[index].x}
              y={labelPoints[index].y}
            />
          ) : null,
        )}
      </g>
    </svg>
  );
}
