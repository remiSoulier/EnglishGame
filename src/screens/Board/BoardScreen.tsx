import type { Board } from '../../engine';
import { Button } from '../../components/Button';
import { Grid } from '../../components/Grid';
import { Legend } from '../../components/Legend';
import { Menu } from '../../components/Menu';
import { PositionsList } from '../../components/PositionsList';
import { DIFFICULTY_LABEL } from './difficultyLabel';
import styles from './BoardScreen.module.css';

export interface BoardScreenProps {
  board: Board;
  playerCount: 2 | 3 | 4;
  /** Character chosen by each player (decision D19). */
  characters?: readonly number[];
  onQuestion: () => void;
  /** Draws the next board; always available (decision D11: no turn order). */
  onEndTurn: () => void;
  onNewBoard: () => void;
  /** Menu "End game": the caller asks for a confirmation, then deletes the game (decision D13). */
  onEndGame: () => void;
  /** Menu "Quit to home" (shown when provided). */
  onQuit?: () => void;
}

/** Board screen: turn header, grid, legend, positions and the actions (Question, End turn). */
export function BoardScreen({
  board,
  playerCount,
  characters,
  onQuestion,
  onEndTurn,
  onNewBoard,
  onEndGame,
  onQuit,
}: BoardScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Turn {board.turn}</h1>
          <p className={styles.meta}>{DIFFICULTY_LABEL[board.difficulty]}</p>
        </div>
        <Menu
          items={[
            { label: 'New board', onSelect: onNewBoard },
            { label: 'End game', onSelect: onEndGame },
            ...(onQuit ? [{ label: 'Quit to home', onSelect: onQuit }] : []),
          ]}
        />
      </header>

      <div className={styles.board}>
        <Grid board={board} playerCount={playerCount} characters={characters} />
        <Legend character={characters?.[0]} />
        <PositionsList board={board} playerCount={playerCount} />
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" fullWidth onClick={onQuestion}>
          Question
        </Button>
        <Button variant="primary" fullWidth onClick={onEndTurn}>
          End turn
        </Button>
      </div>
    </main>
  );
}
