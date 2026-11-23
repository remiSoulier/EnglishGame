import { useState } from 'react';
import { choiceKeys, type ChoiceKey, type Question } from '../../engine';
import { cardsLabel, questionTag } from '../questionText';
import styles from './QuestionScreen.module.css';

export interface QuestionScreenProps {
  question: Question;
  /** Active player, 1-based. */
  player: number;
  /** Cards at stake (1–3). */
  cards: number;
  /** Called once, with the first choice tapped (one try only). */
  onAnswer: (answer: ChoiceKey) => void;
}

/** Question screen: the question and its 2–4 choices as big buttons; the first tap answers. */
export function QuestionScreen({ question, player, cards, onAnswer }: QuestionScreenProps) {
  const [answered, setAnswered] = useState(false);

  const answer = (key: ChoiceKey) => {
    if (answered) return;
    setAnswered(true);
    onAnswer(key);
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.player}>
          Player {player} — for {cardsLabel(cards)}
        </p>
        <p className={styles.tag}>{questionTag(question.category, question.difficulty)}</p>
      </header>

      <h1 className={styles.question}>{question.question}</h1>

      <ul className={styles.choices} aria-label="Choices">
        {choiceKeys(question).map((key) => (
          <li key={key}>
            <button
              type="button"
              className={styles.choice}
              disabled={answered}
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
