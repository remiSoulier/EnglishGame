import { useEffect, useRef } from 'react';
import { Button } from '../../components/Button';
import styles from './WinnerScreen.module.css';

export interface WinnerScreenProps {
  playerCount: 2 | 3 | 4;
  /** Winning player (1-based) once declared, else `null`. */
  winner: null | number;
  onDeclare: (player: number) => void;
  /** Step 1 only: back to the board. */
  onBack: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

/** Decorative trophy (goal-green star on a gold cup). Hidden from screen readers. */
function Trophy() {
  return (
    <svg
      className={styles.trophy}
      width="96"
      height="96"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M18 8h28v14c0 8-6 14-14 14s-14-6-14-14V8z"
        fill="#f59e0b"
        stroke="#92400e"
        strokeWidth="2"
      />
      <path
        d="M18 12H9v4c0 6 4 10 10 10M46 12h9v4c0 6-4 10-10 10"
        fill="none"
        stroke="#92400e"
        strokeWidth="3"
      />
      <rect x="28" y="36" width="8" height="10" fill="#92400e" />
      <rect x="18" y="46" width="28" height="8" rx="2" fill="#92400e" />
      <path
        d="M32 12l2.6 5.4 5.9.8-4.3 4.1 1 5.9L32 25.4l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"
        fill="#ffffff"
      />
    </svg>
  );
}

/**
 * Screen 8, "We have a winner". Step 1 (no winner yet): pick the player who reached the goal, or
 * go Back to the board. Step 2 (winner declared): "Player X wins!" with Play again / Home. The
 * heading is focused whenever the step changes so screen readers announce it.
 */
export function WinnerScreen({
  playerCount,
  winner,
  onDeclare,
  onBack,
  onPlayAgain,
  onHome,
}: WinnerScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [winner]);

  if (winner === null) {
    const players = Array.from({ length: playerCount }, (_, i) => i + 1);
    return (
      <main className={styles.screen}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          We have a winner
        </h1>
        <p className={styles.text}>Who reached the goal?</p>
        <div className={styles.players}>
          {players.map((player) => (
            <Button
              key={player}
              variant="secondary"
              fullWidth
              className={styles.player}
              onClick={() => onDeclare(player)}
            >
              Player {player}
            </Button>
          ))}
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" fullWidth onClick={onBack}>
            Back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.screen} ${styles.won}`}>
      <Trophy />
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Player {winner} wins!
      </h1>
      <p className={styles.text}>Congratulations!</p>
      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onPlayAgain}>
          Play again
        </Button>
        <Button variant="secondary" fullWidth onClick={onHome}>
          Home
        </Button>
      </div>
    </main>
  );
}
