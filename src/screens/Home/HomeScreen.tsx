import { Button } from '../../components/Button';
import { APP_NAME, APP_TAGLINE } from '../../state/appInfo';
import styles from './HomeScreen.module.css';

/** The saved game Home offers to continue. */
export interface SavedGameSummary {
  turn: number;
  /** Difficulty label shown next to the turn (Easy, Medium or Hard); no board code (D22). */
  difficulty: string;
}

export interface HomeScreenProps {
  onNewGame: () => void;
  /** Game in progress (quit to home): shows "Continue game" above New game. */
  savedGame?: SavedGameSummary | null;
  onContinue?: () => void;
}

/**
 * Quick light glints on the lake (image coordinates of the 1002 × 1442 art): position, length,
 * delay and duration in seconds, staggered so a few always shimmer.
 */
const GLINTS: readonly { x: number; y: number; w: number; delay: number; duration: number }[] = [
  { x: 70, y: 790, w: 90, delay: 0, duration: 2.6 },
  { x: 260, y: 760, w: 60, delay: 1.1, duration: 2.2 },
  { x: 420, y: 820, w: 110, delay: 0.5, duration: 3 },
  { x: 140, y: 880, w: 70, delay: 1.8, duration: 2.4 },
  { x: 330, y: 930, w: 130, delay: 0.9, duration: 3.2 },
  { x: 60, y: 1000, w: 100, delay: 2.3, duration: 2.8 },
  { x: 460, y: 1040, w: 80, delay: 0.3, duration: 2.5 },
  { x: 640, y: 1010, w: 120, delay: 1.5, duration: 3.1 },
  { x: 860, y: 1060, w: 90, delay: 0.7, duration: 2.7 },
  { x: 230, y: 1100, w: 140, delay: 2, duration: 3.4 },
  { x: 880, y: 760, w: 70, delay: 1.3, duration: 2.3 },
  { x: 560, y: 760, w: 50, delay: 2.6, duration: 2.1 },
];

/**
 * Home screen: logo, app name and the main menu. With a saved game, the primary action is
 * "Continue game" (Turn N · difficulty) and New game becomes secondary (it replaces the saved game).
 * The background is an animated night lake scene (decision D20): the lake without its boat
 * (public/art/bg-lake.webp), quick glints on the water, ripples and the moon boat
 * (public/art/scene-boat.webp) gently rocking on its own layer — all precached, decorative, and
 * still with prefers-reduced-motion and the title is the SILVA logo (public/silva-logo.svg), as in the Figma mockup. The
 * <h1> keeps the text "SILVA" for screen readers; the logo image itself is decorative.
 */
export function HomeScreen({ onNewGame, savedGame, onContinue }: HomeScreenProps) {
  const canContinue = savedGame != null && onContinue !== undefined;
  return (
    <main className={styles.screen}>
      <div className={styles.sceneBox} aria-hidden="true">
        <div className={styles.scene} data-testid="home-scene">
          <svg
            className={styles.water}
            viewBox="0 0 1002 1442"
            preserveAspectRatio="none"
            focusable="false"
          >
            {GLINTS.map(({ x, y, w, delay, duration }, i) => (
              <line
                key={i}
                className={styles.glint}
                x1={x}
                y1={y}
                x2={x + w}
                y2={y}
                style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s` }}
              />
            ))}
          </svg>
          <img className={styles.boat} src="/art/scene-boat.webp" alt="" width={259} height={293} />
          <svg
            className={styles.water}
            viewBox="0 0 1002 1442"
            preserveAspectRatio="none"
            focusable="false"
          >
            <ellipse className={styles.ripple} cx={752} cy={948} rx={150} ry={22} />
            <ellipse
              className={`${styles.ripple} ${styles.rippleLate}`}
              cx={752}
              cy={948}
              rx={150}
              ry={22}
            />
          </svg>
        </div>
        <div className={styles.veil} />
      </div>
      {/* The dragon (the goal) floats over the lake (decision D19), decorative. */}
      <img
        className={styles.dragon}
        src="/art/char-dragon.webp"
        alt=""
        aria-hidden="true"
        width={96}
        height={128}
      />
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <img
              className={styles.logo}
              src="/silva-logo.svg"
              alt=""
              aria-hidden="true"
              width={240}
              height={159}
            />
            <span className={styles.titleText}>{APP_NAME}</span>
          </h1>
          <p className={styles.tagline}>{APP_TAGLINE}</p>
        </header>

        <nav className={styles.menu} aria-label="Main menu">
          {canContinue && (
            <Button variant="accent" fullWidth className={styles.continue} onClick={onContinue}>
              <span className={styles.continueLabel}>Continue game</span>
              <span className={styles.continueMeta}>
                Turn {savedGame.turn} · {savedGame.difficulty}
              </span>
            </Button>
          )}
          <Button variant={canContinue ? 'onDark' : 'accent'} fullWidth onClick={onNewGame}>
            New game
          </Button>
          <Button variant="onDark" fullWidth disabled>
            How to play <span className={styles.soon}>(coming soon)</span>
          </Button>
          <Button variant="onDark" fullWidth disabled>
            Lexicon <span className={styles.soon}>(coming soon)</span>
          </Button>
        </nav>
      </div>
    </main>
  );
}
