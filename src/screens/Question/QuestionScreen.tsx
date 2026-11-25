import { useState } from 'react';
import { choiceKeys, type ChoiceKey, type Question } from '../../engine';
import { cardsLabel, questionTag } from '../questionText';
import styles from './QuestionScreen.module.css';

export interface QuestionScreenProps {
  question: Question;
  /** Cards at stake (1–3). */
  cards: number;
  /** Called once, with the first choice tapped (one try only). */
  onAnswer: (answer: ChoiceKey) => void;
}

/** Longest choice text that still fits a half-width card at 390 px. */
const GRID_MAX_CHARS = 12;

/**
 * Question screen: the question and its 2–4 choices as big buttons; the first tap answers.
 * A question with line breaks is a program to read: its lines before the last one are shown in
 * a framed box. Short choices are laid out as a 2×2 grid of cards, longer ones as a list.
 */
export function QuestionScreen({ question, cards, onAnswer }: QuestionScreenProps) {
  const [picked, setPicked] = useState<ChoiceKey | null>(null);

  const answer = (key: ChoiceKey) => {
    if (picked !== null) return;
    setPicked(key);
    onAnswer(key);
  };

  const keys = choiceKeys(question);
  const grid =
    keys.length % 2 === 0 &&
    keys.every((k) => (question.choices[k] ?? '').length <= GRID_MAX_CHARS);

  const lines = question.question.split('\n');
  const program = lines.length > 1 ? lines.slice(0, -1).join('\n') : null;
  const prompt = lines[lines.length - 1];

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.cards}>For {cardsLabel(cards)}</p>
        <p className={styles.tag}>{questionTag(question.category, question.difficulty)}</p>
      </header>

      {program !== null && <p className={styles.programLabel}>Read the program:</p>}
      <h1 className={styles.question}>
        {program !== null && <span className={styles.program}>{program + '\n'}</span>}
        {prompt}
      </h1>

      <ul
        className={grid ? `${styles.choices} ${styles.grid}` : styles.choices}
        aria-label="Choices"
      >
        {keys.map((key) => (
          <li key={key}>
            <button
              type="button"
              className={key === picked ? `${styles.choice} ${styles.picked}` : styles.choice}
              disabled={picked !== null}
              aria-label={`${key}: ${question.choices[key]}`}
              onClick={() => answer(key)}
            >
              <span className={styles.key} aria-hidden="true">
                {key}
              </span>
              <span className={styles.text}>{question.choices[key]}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
