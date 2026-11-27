import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { HOW_TO_PLAY_STEPS } from '../../data/howToPlay';
import { Illustration } from './Illustrations';
import { swipeStep } from './swipe';
import styles from './HowToPlayScreen.module.css';

export interface HowToPlayScreenProps {
  /** ‹, Skip and the system back button: back to Home. */
  onClose: () => void;
  /** "Start a game" on the last step: opens New game. */
  onStartGame: () => void;
}

const LAST = HOW_TO_PLAY_STEPS.length - 1;

/**
 * How to play (decision D28): a 6-step tutorial, one rule per screen, drawn over Home like the
 * Lexicon. The night lake scene of Home on top, a white sheet with the step below.
 */
export function HowToPlayScreen({ onClose, onStartGame }: HowToPlayScreenProps) {
  const [index, setIndex] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const sheetRef = useRef<HTMLElement>(null);
  /** Where the finger went down (touch or pen only), to tell a swipe from a tap or a scroll. */
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);
  /** Direction of the last step change: +1 forward, −1 back (slides the sheet in from there). */
  const direction = useRef(0);
  const step = HOW_TO_PLAY_STEPS[index];

  // Opening: focus the screen title. Each step change: focus the step title (announced).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      titleRef.current?.focus();
      return;
    }
    headingRef.current?.focus();
    // The new step slides in from the side it comes from (not with reduced motion).
    const sheet = sheetRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (sheet?.animate && !reduce && direction.current !== 0) {
      sheet.animate(
        [
          { transform: `translateX(${direction.current * 32}px)`, opacity: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    }
  }, [index]);

  const go = (to: number) => {
    const next = Math.min(LAST, Math.max(0, to));
    direction.current = Math.sign(next - index);
    setIndex(next);
  };

  // Swipe left: next step; swipe right: previous step (D35). A swipe left on the last step does
  // not start a game: only the "Start a game" button does.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const move = swipeStep(event.clientX - start.x, event.clientY - start.y);
    if (move !== 0) go(index + move);
  };
  const onPointerCancel = () => {
    touchStart.current = null;
  };

  // Left / right arrows move between steps while focus is inside the screen (no global shortcut).
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' && index < LAST) {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      go(index - 1);
    }
  };

  return (
    <main
      className={styles.screen}
      aria-labelledby="how-title"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className={styles.scene}>
        <div className={styles.bar}>
          <button type="button" className={styles.back} onClick={onClose}>
            <span aria-hidden="true" className={styles.chevron}>
              ‹
            </span>
            <span className="sr-only">Back to home</span>
          </button>
          <h1 id="how-title" ref={titleRef} tabIndex={-1} className={styles.title}>
            How to play
          </h1>
          <button type="button" className={styles.skip} onClick={onClose}>
            Skip
          </button>
        </div>
        <img
          key={step.character.src}
          className={styles.character}
          src={step.character.src}
          alt=""
          aria-hidden="true"
          width={150}
          height={170}
        />
      </div>

      <section ref={sheetRef} className={styles.sheet} aria-labelledby="how-step-title">
        <p
          className={step.dark ? `${styles.badge} ${styles.badgeDark}` : styles.badge}
          style={{ '--step-color': step.color } as CSSProperties}
        >
          Step {index + 1} of {HOW_TO_PLAY_STEPS.length}
        </p>
        <h2 id="how-step-title" ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
          {step.title}
        </h2>
        <p className={styles.text}>{step.text}</p>

        <Illustration kind={step.illustration} />

        <ol className={styles.dots} aria-hidden="true">
          {HOW_TO_PLAY_STEPS.map((s, i) => (
            <li key={s.title} className={i === index ? styles.dotOn : styles.dot} />
          ))}
        </ol>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.prev}
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className={styles.next}
            onClick={() => (index === LAST ? onStartGame() : go(index + 1))}
          >
            {index === LAST ? 'Start a game' : 'Next'}
          </button>
        </div>
      </section>
    </main>
  );
}
