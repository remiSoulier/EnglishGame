import type { ReactNode } from 'react';
import { TUTORIAL_CARDS, type HowToPlayIllustration } from '../../data/howToPlay';
import { ENEMY_CHARACTERS, GOAL_CHARACTER, PLAYER_CHARACTERS } from '../../state/players';
import styles from './HowToPlayScreen.module.css';

const [kitkat] = PLAYER_CHARACTERS;
const [croco] = ENEMY_CHARACTERS;

/** Decorative wrapper: hidden from assistive tech (the step text says it all). */
function Decor({ children }: { children: ReactNode }) {
  return (
    <div className={styles.illustration} aria-hidden="true">
      {children}
    </div>
  );
}

/** Step 1: a mini board with the 4 start corners and the dragon, and the New game choices. */
function Setup() {
  return (
    <Decor>
      <div className={styles.miniBoard}>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`${styles.start} ${styles[`start${n}`]}`}>
            {n}
          </span>
        ))}
        <img className={styles.miniDragon} src={GOAL_CHARACTER.src} alt="" />
      </div>
      <div className={styles.phone}>
        <span className={styles.phoneLabel}>On the phone</span>
        <span className={styles.phoneButtons}>
          {[2, 3, 4].map((n) => (
            <span key={n} className={n === 4 ? styles.phoneOn : styles.phoneOff}>
              {n}
            </span>
          ))}
        </span>
        <span className={styles.phoneHint}>Players · characters · level</span>
      </div>
    </Decor>
  );
}

/** Step 2: the three instruction cards fanned like a hand (the only illustration with alts). */
function Cards() {
  return (
    <div className={`${styles.illustration} ${styles.hand}`}>
      {TUTORIAL_CARDS.map((card) => (
        <img
          key={card.src}
          className={styles.handCard}
          src={card.src}
          alt={card.alt}
          width={92}
          height={122}
          style={{ transform: `rotate(${card.tilt}deg)` }}
        />
      ))}
    </div>
  );
}

/** Step 3: the question card back and what happens after the answer. */
function Question() {
  return (
    <Decor>
      <img className={styles.questionCard} src="/art/card-question.webp" alt="" />
      <span className={styles.pills}>
        <span className={`${styles.pill} ${styles.pillNavy}`}>Question for 2 cards</span>
        <span className={`${styles.pill} ${styles.pillMint}`}>Right: draw 2 cards</span>
        <span className={`${styles.pill} ${styles.pillLilac}`}>Wrong: turn over</span>
      </span>
    </Decor>
  );
}

/** Step 4: Kitkat, a wall, an empty square and the crocodile on a coral square. */
function Obstacles() {
  return (
    <Decor>
      <div className={styles.row}>
        <span className={styles.cell}>
          <img src={kitkat.src} alt="" />
        </span>
        <span className={styles.rowWall} />
        <span className={styles.cell} />
        <span className={`${styles.cell} ${styles.cellEnemy}`}>
          <img src={croco.src} alt="" />
        </span>
      </div>
    </Decor>
  );
}

/** Step 5: turn 1 → turn 2, one wall has moved. */
function EndTurn() {
  return (
    <Decor>
      <span className={styles.turn}>
        <span className={styles.turnBoard}>
          <span className={`${styles.turnWall} ${styles.turnWall1}`} />
        </span>
        <span className={styles.turnLabel}>Turn 1</span>
      </span>
      <span className={styles.turnArrow}>→</span>
      <span className={styles.turn}>
        <span className={styles.turnBoard}>
          <span className={`${styles.turnWall} ${styles.turnWall2}`} />
        </span>
        <span className={styles.turnLabel}>Turn 2</span>
      </span>
    </Decor>
  );
}

/** Step 6: the dragon, who wins, and how to end the game. */
function Win() {
  return (
    <Decor>
      <div className={styles.winBox}>
        <img src={GOAL_CHARACTER.src} alt="" />
        <span className={styles.winText}>
          <span className={styles.winTitle}>First one wins!</span>
          <span className={styles.winMenu}>Menu ≡ › End game</span>
        </span>
      </div>
    </Decor>
  );
}

const ILLUSTRATIONS: Readonly<Record<HowToPlayIllustration, () => ReactNode>> = {
  setup: Setup,
  cards: Cards,
  question: Question,
  obstacles: Obstacles,
  endTurn: EndTurn,
  win: Win,
};

/** The illustration of one step. */
export function Illustration({ kind }: { kind: HowToPlayIllustration }) {
  const Draw = ILLUSTRATIONS[kind];
  return <Draw />;
}
