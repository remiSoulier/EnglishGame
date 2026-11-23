import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ENEMY_COUNT, newCode, parseCode, type Difficulty } from '../../engine';
import { Button } from '../../components/Button';
import type { PlayerCount } from '../../state/types';
import styles from './NewGameScreen.module.css';

/** Settings chosen on the new game screen. */
export interface NewGameSettings {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  /** Canonical board code (`XXXX-XXX`). */
  code: string;
}

export interface NewGameScreenProps {
  onStart: (settings: NewGameSettings) => void;
  onBack: () => void;
}

type BoardChoice = 'random' | 'code';

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

/** New game screen: players, difficulty and board (random or entered code). */
export function NewGameScreen({ onStart, onBack }: NewGameScreenProps) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<BoardChoice>('random');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const codeId = `${id}-code`;
  const errorId = `${id}-code-error`;

  function validate(): string | null {
    const result = parseCode(codeInput);
    if (result.ok) {
      setCodeError(null);
      return result.code;
    }
    setCodeError(result.error);
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (board === 'random') {
      onStart({ playerCount, difficulty, code: newCode() });
      return;
    }
    const code = validate();
    if (code === null) {
      codeRef.current?.focus();
      return;
    }
    onStart({ playerCount, difficulty, code });
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Button variant="ghost" className={styles.back} onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </Button>
        <h1 className={styles.title}>New game</h1>
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
          <legend className={styles.legend}>Difficulty</legend>
          <div className={styles.segments}>
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

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Board</legend>
          <div className={`${styles.segments} ${styles.stacked}`}>
            <Segment
              name={`${id}-board`}
              value="random"
              checked={board === 'random'}
              onSelect={setBoard}
            >
              Random board
            </Segment>
            <Segment
              name={`${id}-board`}
              value="code"
              checked={board === 'code'}
              onSelect={setBoard}
            >
              Enter a board code
            </Segment>
          </div>

          {board === 'code' && (
            <div className={styles.codeField}>
              <label className={styles.codeLabel} htmlFor={codeId}>
                Board code
              </label>
              <input
                ref={codeRef}
                id={codeId}
                className={styles.codeInput}
                type="text"
                value={codeInput}
                placeholder="K7F2-9QX"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                aria-invalid={codeError !== null}
                aria-describedby={codeError !== null ? errorId : undefined}
                onChange={(event) => {
                  setCodeInput(event.target.value);
                  if (codeError !== null) setCodeError(null);
                }}
                onBlur={() => {
                  if (codeInput.trim() !== '') validate();
                }}
              />
              <p id={errorId} className={styles.error} role="alert">
                {codeError}
              </p>
            </div>
          )}
        </fieldset>

        <div className={styles.actions}>
          <Button type="submit" variant="primary" fullWidth>
            Start game
          </Button>
        </div>
      </form>
    </main>
  );
}
