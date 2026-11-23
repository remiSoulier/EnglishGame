import { useId } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import styles from './NewBoardConfirm.module.css';

export interface QuitConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown over the Board screen (rendered behind it, `inert`) before the menu's
 * "Quit to home". The game is kept: Home then offers "Continue game". Cancel / Escape stays.
 */
export function QuitConfirm({ onConfirm, onCancel }: QuitConfirmProps) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onCancel={onCancel}>
      <h2 id={titleId} className={styles.title}>
        Quit this game?
      </h2>
      <p className={styles.text}>
        The game will be saved. You can continue it from the home screen.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onConfirm}>
          Quit
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel} data-autofocus>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
