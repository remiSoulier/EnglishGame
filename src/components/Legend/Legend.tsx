import type { ReactNode } from 'react';
import { enemyCharacter, GOAL_CHARACTER, playerCharacter } from '../../state/players';
import { CELL } from '../Grid/geometry';
import { EnemyShape, GoalShape, StartShape, WallEnd, WallShape } from '../Grid/shapes';
import styles from './Legend.module.css';

export interface LegendProps {
  className?: string;
  /** Character shown for "Start": player 1's (index in PLAYER_CHARACTERS, decision D19). */
  character?: number;
}

const PAD = 4;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.icon}
      viewBox={`${-PAD} ${-PAD} ${CELL + PAD * 2} ${CELL + PAD * 2}`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const C = CELL / 2;

/** Legend of the board symbols, using the same shapes as `Grid`. */
export function Legend({ className, character }: LegendProps) {
  return (
    <ul className={className ? `${styles.legend} ${className}` : styles.legend} aria-label="Legend">
      <li className={styles.item}>
        <Icon>
          <WallShape segments={[{ x1: C, y1: 4, x2: C, y2: CELL - 4 }]} />
          <WallEnd x={C} y={4} />
          <WallEnd x={C} y={CELL - 4} />
        </Icon>
        Wall
      </li>
      <li className={styles.item}>
        <Icon>
          <EnemyShape cx={C} cy={C} character={enemyCharacter(0).src} />
        </Icon>
        Enemy
      </li>
      <li className={styles.item}>
        <Icon>
          <GoalShape cx={C} cy={C} character={GOAL_CHARACTER.src} />
        </Icon>
        Goal
      </li>
      <li className={styles.item}>
        <Icon>
          <StartShape
            x={0}
            y={0}
            character={playerCharacter(0, character === undefined ? undefined : [character]).src}
          />
        </Icon>
        Start
      </li>
    </ul>
  );
}
