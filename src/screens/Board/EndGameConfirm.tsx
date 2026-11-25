import { useId } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import styles from './NewBoardConfirm.module.css';

export interface EndGameConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown over the Board screen (rendered behind it, `inert`) before the menu's
 * "End game" (decision D13). The game is deleted and Home offers no "Continue game". Cancel /
 * Escape stays on the board.
 */
export function EndGameConfirm({ onConfirm, onCancel }: EndGameConfirmProps) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onCancel={onCancel}>
      <h2 id={titleId} className={styles.title}>
        End this game?
      </h2>
      <p className={styles.text}>The game will be deleted. You will go back to the home screen.</p>
      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onConfirm}>
          End game
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel} data-autofocus>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
