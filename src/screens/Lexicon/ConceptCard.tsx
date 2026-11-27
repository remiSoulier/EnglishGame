import { useId, type CSSProperties, type Ref } from 'react';
import type { LexiconConcept } from '../../data/lexicon';
import styles from './LexiconScreen.module.css';

export interface ConceptCardProps {
  concept: LexiconConcept;
  /** At the front of the deck: the card shows its detailed view. */
  open: boolean;
  learned: boolean;
  /** Brings the card to the front (tap on its title, or keyboard focus inside it). */
  onSelect: () => void;
  onToggleLearned: () => void;
  /** Position in the deck (top, scale, stacking), from `placeCards`. */
  style?: CSSProperties;
  /** Behind the front card, too deep to peek out. */
  hidden?: boolean;
  itemRef?: Ref<HTMLLIElement>;
}

/** Keyboard focus (not a tap, which selects through the click itself). */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * One coloured card of the deck: character, word and subtitle (the button that brings the card to
 * the front) and the "learned" round on the right. At the front, it shows the explanation, the
 * mini program, its result and the character's name.
 */
export function ConceptCard({
  concept,
  open,
  learned,
  onSelect,
  onToggleLearned,
  style,
  hidden = false,
  itemRef,
}: ConceptCardProps) {
  const panelId = useId();
  const { word, subtitle, color, character, explanation, program, result } = concept;
  const classes = [styles.card, open && styles.cardOpen, hidden && styles.cardHidden];
  return (
    <li
      ref={itemRef}
      className={classes.filter(Boolean).join(' ')}
      style={{ '--card-color': color, ...style } as CSSProperties}
      onFocus={open ? undefined : (event) => focusVisible(event.target) && onSelect()}
    >
      <div className={styles.cardHead}>
        <button
          type="button"
          className={styles.cardToggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onSelect}
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
      {/* Hidden while closed, but still laid out (0 high) so it can unfold smoothly. */}
      <div id={panelId} className={styles.panel} hidden={!open} data-panel="">
        <div className={styles.panelInner}>
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
      </div>
    </li>
  );
}
