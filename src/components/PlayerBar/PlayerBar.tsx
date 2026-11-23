import styles from './PlayerBar.module.css';

export interface PlayerBarProps {
  playerCount: 2 | 3 | 4;
  /** Active player, 1-based. */
  activePlayer: number;
  className?: string;
}

/** Row of player chips P1…Pn; the active player is marked with `aria-current`. */
export function PlayerBar({ playerCount, activePlayer, className }: PlayerBarProps) {
  const players = Array.from({ length: playerCount }, (_, i) => i + 1);
  return (
    <ol className={className ? `${styles.bar} ${className}` : styles.bar} aria-label="Players">
      {players.map((n) => {
        const active = n === activePlayer;
        return (
          <li
            key={n}
            className={active ? `${styles.chip} ${styles.active}` : styles.chip}
            aria-current={active ? 'true' : undefined}
          >
            P{n}
            {active && <span className={styles.visuallyHidden}> (now playing)</span>}
          </li>
        );
      })}
    </ol>
  );
}
