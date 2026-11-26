import { useId, type CSSProperties } from 'react';
import type { LexiconConcept } from '../../data/lexicon';
import styles from './LexiconScreen.module.css';

export interface ConceptCardProps {
  concept: LexiconConcept;
  open: boolean;
  learned: boolean;
  onToggleOpen: () => void;
  onToggleLearned: () => void;
}

/**
 * One coloured card of the stack: character, word and subtitle (the button that opens or closes
 * the card) and the "learned" round on the right. Open, it shows the explanation, the mini
 * program, its result and the character's name.
 */
export function ConceptCard({
  concept,
  open,
  learned,
  onToggleOpen,
  onToggleLearned,
}: ConceptCardProps) {
  const panelId = useId();
  const { word, subtitle, color, character, explanation, program, result } = concept;
  return (
    <li
      className={open ? `${styles.card} ${styles.cardOpen}` : styles.card}
      style={{ '--card-color': color } as CSSProperties}
    >
      <div className={styles.cardHead}>
        <button
          type="button"
          className={styles.cardToggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggleOpen}
        >
          <span className={styles.avatar} aria-hidden="true">
            <img src={character.src} alt="" width={40} height={40} />
          </span>
          <span className={styles.cardTitles}>
            <span className={styles.word}>{word}</span>
            <span className={styles.subtitle}>{subtitle}</span>
          </span>
        </button>
        <button
          type="button"
          className={styles.learned}
          aria-pressed={learned}
          aria-label={`${word} learned`}
          onClick={onToggleLearned}
        >
          <span aria-hidden="true">{learned ? '✓' : ''}</span>
        </button>
      </div>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <p className={styles.explanation}>{explanation}</p>
        <pre className={styles.program}>
          <code>{program}</code>
        </pre>
        <div className={styles.cardFoot}>
          <p className={styles.result}>
            <span className="sr-only">Result: </span>
            {result}
          </p>
          <p className={styles.characterPill}>
            <span>{character.name}</span>
            <img src={character.src} alt="" aria-hidden="true" width={28} height={28} />
          </p>
        </div>
      </div>
    </li>
  );
}
