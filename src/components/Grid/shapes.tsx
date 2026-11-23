import { CELL } from './geometry';
import styles from './Grid.module.css';

interface ShapeProps {
  /** Centre of the shape in SVG user units. */
  cx: number;
  cy: number;
}

/** Enemy: red diamond with a white exclamation mark. */
export function EnemyShape({ cx, cy }: ShapeProps) {
  const r = CELL * 0.4;
  return (
    <g>
      <polygon
        className={styles.enemyBody}
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      />
      <line className={styles.enemyMark} x1={cx} y1={cy - r * 0.5} x2={cx} y2={cy + r * 0.12} />
      <circle className={styles.enemyDot} cx={cx} cy={cy + r * 0.42} r={2.4} />
    </g>
  );
}

/** Goal: five-pointed star. */
export function GoalShape({ cx, cy }: ShapeProps) {
  const outer = CELL * 0.42;
  const inner = outer * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(
      `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return <polygon className={styles.goal} points={points.join(' ')} />;
}

interface StartShapeProps {
  /** Top-left corner of the cell in SVG user units. */
  x: number;
  y: number;
  label: string;
}

/** Start cell: dashed square outline with a small player label. */
export function StartShape({ x, y, label }: StartShapeProps) {
  const inset = 4;
  return (
    <g>
      <rect
        className={styles.start}
        x={x + inset}
        y={y + inset}
        width={CELL - inset * 2}
        height={CELL - inset * 2}
        rx={2}
      />
      <text className={styles.startLabel} x={x + CELL / 2} y={y + CELL / 2}>
        {label}
      </text>
    </g>
  );
}

/** A wall segment between two points, in SVG user units. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A wall: one path made of thick, round-capped segments. */
export function WallShape({ segments }: { segments: Segment[] }) {
  const d = segments.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join('');
  return <path className={styles.wall} d={d} />;
}
