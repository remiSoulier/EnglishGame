import { useId } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import styles from './NewBoardConfirm.module.css';

export interface NewBoardConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown over the Board screen (which the caller renders behind it, `inert`) before
 * the menu's "New board" replaces the game (decision D8). Cancel / Escape keeps the game as is.
 */
export function NewBoardConfirm({ onConfirm, onCancel }: NewBoardConfirmProps) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onCancel={onCancel}>
      <h2 id={titleId} className={styles.title}>
        Start a new board?
      </h2>
      <p className={styles.text}>
        The current game ends. A new board starts at turn 1 with the same players.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onConfirm}>
          New board
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel} data-autofocus>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
