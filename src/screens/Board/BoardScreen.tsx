import type { Board, Difficulty } from '../../engine';
import { Button } from '../../components/Button';
import { Grid } from '../../components/Grid';
import { Legend } from '../../components/Legend';
import { Menu } from '../../components/Menu';
import { PlayerBar } from '../../components/PlayerBar';
import { PositionsList } from '../../components/PositionsList';
import styles from './BoardScreen.module.css';

export interface BoardScreenProps {
  board: Board;
  playerCount: 2 | 3 | 4;
  /** Active player, 1-based. */
  activePlayer: number;
  onQuestion: () => void;
  onNextPlayer: () => void;
  onEndTurn: () => void;
  onNewBoard: () => void;
  onWinner: () => void;
  /** Menu "Quit to home" (shown when provided). */
  onQuit?: () => void;
}

const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** Board screen: turn header, players, grid, legend and the turn actions. */
export function BoardScreen({
  board,
  playerCount,
  activePlayer,
  onQuestion,
  onNextPlayer,
  onEndTurn,
  onNewBoard,
  onWinner,
  onQuit,
}: BoardScreenProps) {
  const isLastPlayer = activePlayer >= playerCount;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Turn {board.turn}</h1>
          <p className={styles.meta}>
            Code {board.code} · {DIFFICULTY_LABEL[board.difficulty]}
          </p>
        </div>
        <Menu
          items={[
            { label: 'New board', onSelect: onNewBoard },
            { label: 'We have a winner', onSelect: onWinner },
            ...(onQuit ? [{ label: 'Quit to home', onSelect: onQuit }] : []),
          ]}
        />
      </header>

      <PlayerBar playerCount={playerCount} activePlayer={activePlayer} />

      <div className={styles.board}>
        <Grid board={board} playerCount={playerCount} />
        <Legend />
        <PositionsList board={board} playerCount={playerCount} />
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={onQuestion}>
          Question
        </Button>
        {isLastPlayer ? (
          <Button variant="primary" fullWidth onClick={onEndTurn}>
            End turn
          </Button>
        ) : (
          <Button variant="primary" fullWidth onClick={onNextPlayer}>
            Next player
          </Button>
        )}
      </div>
    </main>
  );
}
