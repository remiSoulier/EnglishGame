import { cellName, type Board } from '../../engine';
import { Button } from '../../components/Button';
import { Grid } from '../../components/Grid';
import { Legend } from '../../components/Legend';
import { PositionsList } from '../../components/PositionsList';
import styles from './NewBoardScreen.module.css';

export interface NewBoardScreenProps {
  /** The new board (already redrawn for the next turn). */
  board: Board;
  playerCount: 2 | 3 | 4;
  /** Character chosen by each player (decision D19). */
  characters?: readonly number[];
  onStartTurn: () => void;
}

/**
 * New board screen (end of turn): the redrawn walls and enemies to copy onto the real board.
 * It opens with a quick shuffle (decision D24): the board is shuffled like a deck of cards, then
 * the walls and enemies are dealt onto it one after the other, so players see the board changed.
 * Decorative only, and still with prefers-reduced-motion.
 */
export function NewBoardScreen({
  board,
  playerCount,
  characters,
  onStartTurn,
}: NewBoardScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        {board.turn > 1 && <p className={styles.eyebrow}>End of turn {board.turn - 1}</p>}
        <h1 className={styles.title}>Walls and enemies have moved</h1>
        <p className={styles.intro}>Copy the new walls and enemies onto your board.</p>
      </header>

      <div className={styles.board}>
        <div className={styles.shuffle} data-testid="board-shuffle">
          <Grid board={board} playerCount={playerCount} characters={characters} />
        </div>
        <Legend character={characters?.[0]} />
        <p className={styles.reminder}>The goal stays on {cellName(board.goal)}</p>
        <PositionsList board={board} playerCount={playerCount} />
      </div>

      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onStartTurn}>
          Start turn {board.turn}
        </Button>
      </div>
    </main>
  );
}
