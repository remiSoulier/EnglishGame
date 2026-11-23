import { useId } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { cardsLabel } from '../questionText';
import styles from './QuestionPopupScreen.module.css';

export interface QuestionPopupScreenProps {
  /** Active player, 1-based. */
  player: number;
  /** Cards at stake (1–3). */
  cards: number;
  onShow: () => void;
  onCancel: () => void;
}

/**
 * Question popup, shown over the Board screen (which the caller renders behind it, `inert`):
 * "Player N — Question for X cards", Show the question / Cancel.
 */
export function QuestionPopupScreen({ player, cards, onShow, onCancel }: QuestionPopupScreenProps) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onCancel={onCancel}>
      <h2 id={titleId} className={styles.title}>
        <span className={styles.player}>Player {player} —</span> Question for {cardsLabel(cards)}
      </h2>
      <p className={styles.text}>
        Answer correctly to draw {cardsLabel(cards)}. One try only: a wrong answer ends your turn.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onShow} data-autofocus>
          Show the question
        </Button>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
