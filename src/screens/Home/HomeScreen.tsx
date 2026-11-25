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

/**
 * Home screen: logo, app name and the main menu. With a saved game, the primary action is
 * "Continue game" (Turn N · code) and New game becomes secondary (it replaces the saved game).
 * The background is the night forest illustration (public/art/bg-vert.webp, precached).
 */
export function HomeScreen({ onNewGame, savedGame, onContinue }: HomeScreenProps) {
  const canContinue = savedGame != null && onContinue !== undefined;
  return (
    <main className={styles.screen}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.logoBox}>
            <Logo className={styles.logo} size={72} />
          </div>
          <div className={styles.titleCard}>
            <h1 className={styles.title}>{APP_NAME}</h1>
            <p className={styles.tagline}>{APP_TAGLINE}</p>
          </div>
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
