import { useEffect, useId, useRef } from 'react';
import { Button } from '../../components/Button';
import { choiceKeys, type ChoiceKey, type Question } from '../../engine';
import { cardsLabel } from '../questionText';
import styles from './ResultScreen.module.css';

export interface ResultScreenProps {
  question: Question;
  /** Cards at stake (1–3). */
  cards: number;
  /** The player's answer. */
  answer: ChoiceKey;
  correct: boolean;
  onContinue: () => void;
}

/** Small navy instruction card with a lavender dot pattern (decorative). */
function CardsIllustration() {
  return (
    <svg
      className={styles.cardsArt}
      viewBox="0 0 44 52"
      width="44"
      height="52"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="2" width="32" height="44" rx="5" fill="var(--silva-lavender)" />
      <rect x="3" y="6" width="32" height="44" rx="5" fill="var(--silva-navy)" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={11 + col * 8}
            cy={18 + row * 10}
            r="2.4"
            fill={(row + col) % 2 === 0 ? 'var(--silva-lime)' : 'var(--silva-lavender)'}
          />
        )),
      )}
    </svg>
  );
}

/**
 * Result screen: Correct! / Wrong answer (icon + text, not colour only), the cards to draw, the
 * choices with the right one and the player's pick labelled, the explanation, and Continue.
 * The heading is focused on mount so screen readers announce the result.
 */
export function ResultScreen({ question, cards, answer, correct, onContinue }: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const choiceClass = (key: ChoiceKey) => {
    if (key === question.answer) return `${styles.choice} ${styles.right}`;
    if (key === answer) return `${styles.choice} ${styles.wrong}`;
    return styles.choice;
  };

  return (
    <main className={styles.screen}>
      <section
        className={`${styles.banner} ${correct ? styles.bannerRight : styles.bannerWrong}`}
        aria-labelledby={titleId}
      >
        <h1 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          <span className={styles.icon} aria-hidden="true">
            {correct ? '✓' : '✗'}
          </span>
          {correct ? 'Correct!' : 'Wrong answer'}
        </h1>
        {correct ? (
          <div className={styles.drawCard}>
            <CardsIllustration />
            <div>
              <p className={styles.draw}>Draw {cardsLabel(cards)}</p>
              <p className={styles.drawFrom}>from the instruction card deck</p>
            </div>
          </div>
        ) : (
          <p className={styles.noCards}>No cards this time.</p>
        )}
      </section>

      <h2 className={styles.question}>{question.question}</h2>
      <ul className={styles.choices} aria-label="Choices">
        {choiceKeys(question).map((key) => (
          <li key={key} className={choiceClass(key)}>
            <span className={styles.key}>{key}</span>
            <span className={styles.body}>
              <span className={styles.text}>{question.choices[key]}</span>
              {key === question.answer && (
                <span className={styles.labelRight}>
                  <span aria-hidden="true">✓ </span>Correct answer
                  {key === answer && ' · Your answer'}
                </span>
              )}
              {key === answer && key !== question.answer && (
                <span className={styles.labelWrong}>
                  <span aria-hidden="true">✗ </span>Your answer
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.why}>
        <p className={styles.whyLabel}>Why?</p>
        <p className={styles.explanation}>{question.explanation}</p>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" fullWidth onClick={onContinue}>
          Continue
        </Button>
      </div>
    </main>
  );
}
