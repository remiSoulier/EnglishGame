import { useEffect, useRef, useState } from 'react';
import { DEFAULT_OPEN_CONCEPT, LEXICON_CONCEPTS, LEXICON_LEVEL } from '../../data/lexicon';
import { GOAL_CHARACTER } from '../../state/players';
import { loadLearned, saveLearned } from '../../state/lexiconProgress';
import { ConceptCard } from './ConceptCard';
import styles from './LexiconScreen.module.css';

/** Which Lexicon screen is shown: the entry ("Basic concepts") or the full list ("See all"). */
export type LexiconView = 'main' | 'all';

export interface LexiconScreenProps {
  view: LexiconView;
  /** ‹ button: from "See all" back to the entry, from the entry out of the Lexicon. */
  onBack: () => void;
  onSeeAll: () => void;
}

/**
 * The Lexicon (decision D25), drawn over Home or the board (the screen behind stays inert and
 * untouched). The "learned" ticks are saved apart from the game (src/state/lexiconProgress.ts).
 */
export function LexiconScreen({ view, onBack, onSeeAll }: LexiconScreenProps) {
  const [learned, setLearned] = useState<string[]>(loadLearned);
  const [openId, setOpenId] = useState<string | null>(DEFAULT_OPEN_CONCEPT);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the heading when the Lexicon opens and when it switches screen.
  useEffect(() => {
    headingRef.current?.focus();
  }, [view]);

  const toggleLearned = (id: string) => {
    setLearned((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      saveLearned(next);
      return next;
    });
  };

  const total = LEXICON_CONCEPTS.length;
  const learnedCount = LEXICON_CONCEPTS.filter((c) => learned.includes(c.id)).length;
  const title = view === 'main' ? 'Lexicon' : 'All concepts';

  return (
    <main className={styles.screen} aria-labelledby="lexicon-title">
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack}>
          <span aria-hidden="true" className={styles.chevron}>
            ‹
          </span>
          <span className="sr-only">Back</span>
        </button>
        <h1 id="lexicon-title" ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        {view === 'main' && (
          <img
            className={styles.dragon}
            src={GOAL_CHARACTER.src}
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
          />
        )}
      </header>

      {view === 'main' ? (
        <>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>Concepts</dt>
              <dd className={styles.statValue}>{total}</dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>Learned</dt>
              <dd className={styles.statValue}>
                {learnedCount} / {total}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>Level</dt>
              <dd className={styles.statValue}>{LEXICON_LEVEL}</dd>
            </div>
          </dl>

          <section className={styles.section} aria-labelledby="lexicon-basic">
            <div className={styles.sectionHead}>
              <h2 id="lexicon-basic" className={styles.sectionTitle}>
                Basic concepts
              </h2>
              <button type="button" className={styles.seeAll} onClick={onSeeAll}>
                See all
              </button>
            </div>
            <ul className={styles.stack}>
              {LEXICON_CONCEPTS.map((concept) => (
                <ConceptCard
                  key={concept.id}
                  concept={concept}
                  open={openId === concept.id}
                  learned={learned.includes(concept.id)}
                  onToggleOpen={() => setOpenId((id) => (id === concept.id ? null : concept.id))}
                  onToggleLearned={() => toggleLearned(concept.id)}
                />
              ))}
            </ul>
          </section>
        </>
      ) : (
        // TODO(D25): provisional full list, the "See all" spec (screen 3) did not reach us.
        <ul className={styles.list}>
          {LEXICON_CONCEPTS.map((concept) => {
            const done = learned.includes(concept.id);
            return (
              <li key={concept.id} className={styles.row}>
                <span
                  className={styles.rowDot}
                  style={{ background: concept.color }}
                  aria-hidden="true"
                />
                <span className={styles.rowTitles}>
                  <span className={styles.rowWord}>{concept.word}</span>
                  <span className={styles.rowSubtitle}>{concept.subtitle}</span>
                </span>
                <button
                  type="button"
                  className={styles.learned}
                  aria-pressed={done}
                  aria-label={`${concept.word} learned`}
                  onClick={() => toggleLearned(concept.id)}
                >
                  <span aria-hidden="true">{done ? '✓' : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
