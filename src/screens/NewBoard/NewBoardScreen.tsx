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
  onStartTurn: () => void;
}

/** New board screen (end of turn): the redrawn walls and enemies to copy onto the real board. */
export function NewBoardScreen({ board, playerCount, onStartTurn }: NewBoardScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Walls and enemies have moved</h1>
        <p className={styles.intro}>Copy the new walls and enemies onto your board.</p>
      </header>

      <div className={styles.board}>
        <Grid board={board} playerCount={playerCount} />
        <Legend />
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
