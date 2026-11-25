import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { APP_NAME, APP_TAGLINE } from '../../state/appInfo';
import styles from './HomeScreen.module.css';

/** The saved game Home offers to continue. */
export interface SavedGameSummary {
  turn: number;
  code: string;
}

export interface HomeScreenProps {
  onNewGame: () => void;
  /** Game in progress (quit to home): shows "Continue game" above New game. */
  savedGame?: SavedGameSummary | null;
  onContinue?: () => void;
}

/** Decorative background of the home screen (SILVA): warm dots and a crescent moon / leaf. */
function Decor() {
  return (
    <svg
      className={styles.decor}
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="34" cy="150" r="6" fill="var(--silva-orange)" />
      <circle cx="58" cy="176" r="3.5" fill="var(--silva-orange)" opacity="0.8" />
      <circle cx="350" cy="96" r="6" fill="var(--silva-orange)" />
      <circle cx="330" cy="128" r="3.5" fill="var(--silva-orange)" opacity="0.8" />
      <circle cx="40" cy="470" r="4.5" fill="var(--silva-orange)" opacity="0.8" />
      <circle cx="356" cy="420" r="3.5" fill="var(--silva-orange)" opacity="0.7" />
      {/* Crescent moon / leaf: a disc with a forest disc cut out of it. */}
      <circle cx="226" cy="500" r="70" fill="var(--silva-forest-2)" />
      <circle cx="256" cy="474" r="64" fill="var(--color-home-bg)" />
    </svg>
  );
}

/**
 * Home screen: logo, app name and the main menu. With a saved game, the primary action is
 * "Continue game" (Turn N · code) and New game becomes secondary (it replaces the saved game).
 */
export function HomeScreen({ onNewGame, savedGame, onContinue }: HomeScreenProps) {
  const canContinue = savedGame != null && onContinue !== undefined;
  return (
    <main className={styles.screen}>
      <Decor />
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.logoBox}>
            <Logo className={styles.logo} size={72} />
          </div>
          <h1 className={styles.title}>{APP_NAME}</h1>
          <p className={styles.tagline}>{APP_TAGLINE}</p>
        </header>

        <nav className={styles.menu} aria-label="Main menu">
          {canContinue && (
            <Button variant="accent" fullWidth className={styles.continue} onClick={onContinue}>
              <span className={styles.continueLabel}>Continue game</span>
              <span className={styles.continueMeta}>
                Turn {savedGame.turn} · {savedGame.code}
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
