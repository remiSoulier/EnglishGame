import { CELL } from './geometry';
import { BADGE_HEIGHT, BADGE_WIDTH } from './wallLabels';
import styles from './Grid.module.css';

interface ShapeProps {
  /** Centre of the shape in SVG user units. */
  cx: number;
  cy: number;
}

interface CharacterShapeProps extends ShapeProps {
  /**
   * Character art URL (decorative). When set, the character fills the cell on a tinted plate
   * and the shape (diamond / star) becomes a small badge in the bottom-right corner, so the
   * element stays shape-coded, not colour-only.
   */
  character?: string;
}

/** Badge size when a character is shown: the shape shrinks to the cell's bottom-right corner. */
const BADGE_SCALE = 0.42;
/** Offset of that corner badge from the cell centre. */
const BADGE_OFFSET = CELL * 0.3;
/** Character art inset in its cell, and its tinted plate inset. */
const ART_INSET = 2.5;
const BACK_INSET = 1.5;

/** Tinted rounded plate and character art filling the cell centred on (cx, cy). */
function CharacterArt({
  cx,
  cy,
  src,
  back,
}: {
  cx: number;
  cy: number;
  src: string;
  back: string;
}) {
  const half = CELL / 2;
  return (
    <>
      <rect
        className={back}
        x={cx - half + BACK_INSET}
        y={cy - half + BACK_INSET}
        width={CELL - BACK_INSET * 2}
        height={CELL - BACK_INSET * 2}
        rx={8}
      />
      <image
        href={src}
        x={cx - half + ART_INSET}
        y={cy - half + ART_INSET}
        width={CELL - ART_INSET * 2}
        height={CELL - ART_INSET * 2}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      />
    </>
  );
}

/** Plain red diamond (no exclamation mark, D26), of half-diagonal `r`, centred on (cx, cy). */
function Diamond({ cx, cy, r }: ShapeProps & { r: number }) {
  return (
    <polygon
      className={styles.enemyBody}
      points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
    />
  );
}

/** Enemy: plain red diamond (a corner badge when a character is shown). */
export function EnemyShape({ cx, cy, character }: CharacterShapeProps) {
  const r = CELL * 0.4;
  if (!character) {
    return (
      <g>
        <Diamond cx={cx} cy={cy} r={r} />
      </g>
    );
  }
  return (
    <g>
      <CharacterArt cx={cx} cy={cy} src={character} back={styles.enemyBack} />
      <Diamond cx={cx + BADGE_OFFSET} cy={cy + BADGE_OFFSET} r={r * BADGE_SCALE} />
    </g>
  );
}

/** Five-pointed star points with outer radius `outer`, centred on (cx, cy). */
function starPoints(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(
      `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(' ');
}

/** Goal: five-pointed star (a corner badge when the goal character is shown). */
export function GoalShape({ cx, cy, character }: CharacterShapeProps) {
  const outer = CELL * 0.42;
  if (!character) return <polygon className={styles.goal} points={starPoints(cx, cy, outer)} />;
  return (
    <g>
      <CharacterArt cx={cx} cy={cy} src={character} back={styles.goalBack} />
      <polygon
        className={styles.goal}
        points={starPoints(cx + BADGE_OFFSET, cy + BADGE_OFFSET, outer * BADGE_SCALE * 1.15)}
      />
    </g>
  );
}

interface StartShapeProps {
  /** Top-left corner of the cell in SVG user units. */
  x: number;
  y: number;
  /** Player label ("P1" … "P4"), on a small plate beside the character. */
  label?: string;
  /**
   * Cell edge the label plate sits against: the one on the board border, which never carries a
   * wall (D12), so no wall, halo or rivet can cover the label. Default `bottom`.
   */
  labelEdge?: 'top' | 'bottom';
  /** Character art URL (decorative), fitted in the cell beside the label. */
  character?: string;
}

/** Inset of the dashed start outline in the cell. */
const START_INSET = 4;
/**
 * Label plate: size, and distance of its centre from its (border) edge. It spans 1 … 14 units
 * from that edge and x 9 … 31 in the cell, so it stays clear of a wall on any other edge (lime
 * stroke 3 + halo 1.5 = 4.5 units deep) and of a rivet on a corner (radius 5.5).
 */
const PLATE_WIDTH = 22;
const PLATE_HEIGHT = 13;
const PLATE_FROM_EDGE = 7.5;
/** Height of the character box when it shares the cell with the label plate. */
const ART_WITH_LABEL = 24;
/** Soft disc behind the character (a rounded rect: circles are kept for rivets). */
const GLOW_RADIUS = 13;

/**
 * Start cell: dotted round outline, as in the Figma mockup (on a dark halo, so it reads on the board art), the
 * player's character and a small player label on a board-coloured plate (text 6.63:1).
 */
export function StartShape({ x, y, label, labelEdge = 'bottom', character }: StartShapeProps) {
  const side = CELL - START_INSET * 2;
  const top = labelEdge === 'top';
  const plateY = top ? y + PLATE_FROM_EDGE : y + CELL - PLATE_FROM_EDGE;
  // With a label the character fills the dashed outline on the other side of the plate; alone
  // it fills the whole outline.
  const art = label
    ? {
        x: x + 3,
        y: top ? y + CELL - START_INSET - ART_WITH_LABEL : y + START_INSET,
        width: CELL - 6,
        height: ART_WITH_LABEL,
      }
    : { x: x + 5, y: y + 5, width: CELL - 10, height: CELL - 10 };
  return (
    <g>
      <rect
        className={styles.startHalo}
        x={x + START_INSET}
        y={y + START_INSET}
        width={side}
        height={side}
        rx={side / 2}
      />
      <rect
        className={styles.start}
        x={x + START_INSET}
        y={y + START_INSET}
        width={side}
        height={side}
        rx={side / 2}
      />
      {character && (
        <>
          <rect
            className={styles.startGlow}
            x={x + CELL / 2 - GLOW_RADIUS}
            y={art.y + art.height / 2 - GLOW_RADIUS}
            width={GLOW_RADIUS * 2}
            height={GLOW_RADIUS * 2}
            rx={GLOW_RADIUS}
          />
          <image href={character} {...art} preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
        </>
      )}
      {label && (
        <>
          <rect
            className={styles.startPlate}
            x={x + CELL / 2 - PLATE_WIDTH / 2}
            y={plateY - PLATE_HEIGHT / 2}
            width={PLATE_WIDTH}
            height={PLATE_HEIGHT}
            rx={PLATE_HEIGHT / 2}
          />
          <text className={styles.startLabel} x={x + CELL / 2} y={plateY}>
            {label}
          </text>
        </>
      )}
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

/** SVG path data of a wall's segments. */
function wallPath(segments: Segment[]): string {
  return segments.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join('');
}

/** A wall: one path made of thick, round-capped segments. */
export function WallShape({ segments }: { segments: Segment[] }) {
  return <path className={styles.wall} d={wallPath(segments)} />;
}

/**
 * Dark halo under a wall (wider, board-coloured stroke), so the lime wall keeps its 9.64:1
 * contrast wherever it crosses a light spot of the board art.
 */
export function WallHalo({ segments }: { segments: Segment[] }) {
  return <path className={styles.wallHalo} d={wallPath(segments)} />;
}

/** Radius of a wall end mark, in SVG user units (outer edge = radius + half the 2-unit stroke). */
export const WALL_END_RADIUS = 4.5;

/**
 * Wall end mark ("rivet"): a small board-coloured disc ringed in the wall colour, drawn on each
 * free end of a piece so two pieces touching end to end read as two pieces.
 */
export function WallEnd({ x, y }: { x: number; y: number }) {
  return <circle className={styles.wallEnd} cx={x} cy={y} r={WALL_END_RADIUS} />;
}

/** Wall name badge (e.g. "W6"): dark bold text on a small white rounded box, centred on (x, y). */
export function WallLabel({ id, x, y }: { id: string; x: number; y: number }) {
  return (
    <g data-wall-label={id}>
      <rect
        className={styles.wallBadge}
        x={x - BADGE_WIDTH / 2}
        y={y - BADGE_HEIGHT / 2}
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        rx={4}
      />
      <text className={styles.wallBadgeText} x={x} y={y}>
        {id}
      </text>
    </g>
  );
}
