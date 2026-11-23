import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { APP_NAME, APP_TAGLINE } from '../../state/appInfo';
import styles from './HomeScreen.module.css';

export interface HomeScreenProps {
  onNewGame: () => void;
}

/** Home screen: logo, app name and the main menu. */
export function HomeScreen({ onNewGame }: HomeScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Logo className={styles.logo} />
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.tagline}>{APP_TAGLINE}</p>
      </header>

      <nav className={styles.menu} aria-label="Main menu">
        <Button variant="primary" fullWidth onClick={onNewGame}>
          New game
        </Button>
        <Button variant="secondary" fullWidth disabled>
          How to play <span className={styles.soon}>(coming soon)</span>
        </Button>
        <Button variant="secondary" fullWidth disabled>
          Lexicon <span className={styles.soon}>(coming soon)</span>
        </Button>
      </nav>
    </main>
  );
}
