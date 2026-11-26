import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ENEMY_COUNT, newCode, type Difficulty } from '../../engine';
import { Button } from '../../components/Button';
import { defaultCharacters, pickCharacter, PLAYER_CHARACTERS } from '../../state/players';
import type { PlayerCount } from '../../state/types';
import styles from './NewGameScreen.module.css';

/** Settings chosen on the new game screen. */
export interface NewGameSettings {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  /** Canonical board code (`XXXX-XXX`), always random (decision D22: no code shown or typed). */
  code: string;
  /** Character of each player, as indexes in PLAYER_CHARACTERS (decision D19), all different. */
  characters: number[];
}

export interface NewGameScreenProps {
  onStart: (settings: NewGameSettings) => void;
  onBack: () => void;
  /** A game is saved: warn that starting replaces it (no confirmation). */
  replacesGame?: boolean;
}

const PLAYER_OPTIONS: readonly PlayerCount[] = [2, 3, 4];

const DIFFICULTY_OPTIONS: readonly { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface SegmentProps<T extends string | number> {
  name: string;
  value: T;
  checked: boolean;
  /** Accessible name when the visible text is split over several lines. */
  ariaLabel?: string;
  onSelect: (value: T) => void;
  children: ReactNode;
}

/** One option of a segmented control: a native radio input inside a large label. */
function Segment<T extends string | number>({
  name,
  value,
  checked,
  ariaLabel,
  onSelect,
  children,
}: SegmentProps<T>) {
  return (
    <label className={styles.segment}>
      <input
        className={styles.radio}
        type="radio"
        name={name}
        value={String(value)}
        checked={checked}
        aria-label={ariaLabel}
        onChange={() => onSelect(value)}
      />
      <span className={styles.segmentText}>{children}</span>
    </label>
  );
}

/** New game screen: players, their characters and difficulty; the board is always random (D22). */
export function NewGameScreen({ onStart, onBack, replacesGame = false }: NewGameScreenProps) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  // One character per possible player (4); the first `playerCount` are used.
  const [characters, setCharacters] = useState<number[]>(() => defaultCharacters(4));
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const id = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart({ playerCount, difficulty, code: newCode(), characters: chosen() });
  }

  function chosen(): number[] {
    return characters.slice(0, playerCount);
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <button type="button" className={styles.back} onClick={onBack}>
            <span aria-hidden="true" className={styles.chevron}>
              ‹
            </span>
            <span className="sr-only">Back</span>
          </button>
          <h1 className={styles.title}>New game</h1>
        </div>
        {replacesGame && <p className={styles.notice}>This will replace your current game.</p>}
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Players</legend>
          <div className={styles.segments}>
            {PLAYER_OPTIONS.map((count) => (
              <Segment
                key={count}
                name={`${id}-players`}
                value={count}
                checked={playerCount === count}
                onSelect={setPlayerCount}
              >
                {count}
              </Segment>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Characters</legend>
          <div className={styles.characterRows}>
            {characters.slice(0, playerCount).map((current, player) => (
              <fieldset key={player} className={styles.characterRow}>
                <legend className={styles.characterPlayer}>
                  <span aria-hidden="true">P{player + 1}</span>
                  <span className="sr-only">Player {player + 1}</span>
                </legend>
                <div className={styles.characterOptions}>
                  {PLAYER_CHARACTERS.map((character, index) => (
                    <Segment
                      key={character.name}
                      name={`${id}-character-${player}`}
                      value={index}
                      checked={current === index}
                      ariaLabel={character.name}
                      onSelect={(value) =>
                        setCharacters((list) => pickCharacter(list, player, value))
                      }
                    >
                      <img
                        className={styles.characterArt}
                        src={character.src}
                        alt=""
                        aria-hidden="true"
                        width={40}
                        height={40}
                      />
                      <span className={styles.characterName} aria-hidden="true">
                        {character.name}
                      </span>
                    </Segment>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Difficulty</legend>
          <div className={`${styles.segments} ${styles.stacked}`}>
            {DIFFICULTY_OPTIONS.map(({ value, label }) => (
              <Segment
                key={value}
                name={`${id}-difficulty`}
                value={value}
                checked={difficulty === value}
                ariaLabel={`${label} — ${ENEMY_COUNT[value]} enemies`}
                onSelect={setDifficulty}
              >
                <span className={styles.segmentMain}>{label}</span>
                <span className={styles.segmentSub}>{ENEMY_COUNT[value]} enemies</span>
              </Segment>
            ))}
          </div>
        </fieldset>

        <div className={styles.actions}>
          <Button type="submit" variant="accent" fullWidth>
            Start game
          </Button>
        </div>
      </form>
    </main>
  );
}
