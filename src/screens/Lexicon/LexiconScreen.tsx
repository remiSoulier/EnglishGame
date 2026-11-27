import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  conceptsOf,
  LEXICON_CONCEPTS,
  LEXICON_LEVEL,
  SECTION_TITLE,
  type LexiconSection,
} from '../../data/lexicon';
import { GOAL_CHARACTER } from '../../state/players';
import { loadLearned, saveLearned } from '../../state/lexiconProgress';
import { ConceptCard } from './ConceptCard';
import { activeIndex, DECK_STEP, placeCards } from './deckLayout';
import styles from './LexiconScreen.module.css';

/** Sections, in screen order. */
const SECTIONS: readonly LexiconSection[] = ['basic', 'further'];

/** Index of each concept in the deck (all the concepts, in card order). */
const DECK_INDEX = new Map(LEXICON_CONCEPTS.map((c, i) => [c.id, i]));

/** Whether the user asked for less motion (no smooth scroll then). */
function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

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
  /** Card at the front of the deck, driven by the scroll (D29). */
  const [active, setActive] = useState(0);
  const [heights, setHeights] = useState<number[]>(() => LEXICON_CONCEPTS.map(() => 0));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  /** Card being scrolled to after a tap: scroll positions on the way are ignored. */
  const pending = useRef<number | null>(null);
  const pendingTimer = useRef(0);

  // Focus the heading when the Lexicon opens and when it switches screen.
  useEffect(() => {
    headingRef.current?.focus();
  }, [view]);

  // Scrolling the screen moves the deck: one card per DECK_STEP pixels of scroll.
  useEffect(() => {
    const screenEl = screenRef.current;
    if (view !== 'main' || !screenEl) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const track = trackRef.current;
      if (!track) return;
      const index = activeIndex(screenEl.scrollTop - track.offsetTop, LEXICON_CONCEPTS.length);
      if (pending.current !== null) {
        if (index !== pending.current) return;
        pending.current = null;
      }
      setActive(index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    screenEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      screenEl.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [view]);

  // Measure the cards to stack the next ones under the front one. A card is measured as it will
  // be once its panel has unfolded (or folded): the cards move to their places while it does.
  const measure = useCallback((front: number) => {
    const next = LEXICON_CONCEPTS.map((_, i) => {
      const card = cardRefs.current[i];
      if (!card) return 0;
      const panel = card.querySelector<HTMLElement>('[data-panel]');
      const closed = card.offsetHeight - (panel?.offsetHeight ?? 0);
      // The content's own height: the panel itself may still be unfolding (0 high).
      const content = panel?.firstElementChild?.scrollHeight ?? 0;
      return i === front ? closed + content : closed;
    });
    setHeights((old) => (old.every((h, i) => h === next[i]) ? old : next));
  }, []);
  useLayoutEffect(() => measure(active), [measure, active, view]);
  useEffect(() => {
    const remeasure = () => measure(active);
    window.addEventListener('resize', remeasure);
    document.fonts?.ready.then(remeasure, () => {});
    return () => window.removeEventListener('resize', remeasure);
  }, [measure, active]);
  useEffect(() => () => window.clearTimeout(pendingTimer.current), []);

  /** Brings card `index` to the front, scrolling the screen to its place in the deck. */
  const select = (index: number) => {
    if (index === active) return;
    setActive(index);
    const screenEl = screenRef.current;
    const track = trackRef.current;
    if (!screenEl || !track) return;
    // Until the scroll reaches the card (or gives up), the cards on the way stay behind.
    pending.current = index;
    window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(() => {
      pending.current = null;
    }, 1000);
    screenEl.scrollTo?.({
      top: track.offsetTop + index * DECK_STEP,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  };

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
  const placements = placeCards(heights, active);
  const activeSection = LEXICON_CONCEPTS[active].section;

  return (
    <main
      ref={screenRef}
      className={view === 'main' ? `${styles.screen} ${styles.snap}` : styles.screen}
      aria-labelledby="lexicon-title"
    >
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

          {/* The deck (D29): a tall track whose sticky stage shows the cards; each DECK_STEP of
              scroll brings the next card to the front, in its detailed view. */}
          <div
            ref={trackRef}
            className={styles.track}
            style={{ '--deck-steps': LEXICON_CONCEPTS.length - 1 } as CSSProperties}
          >
            {LEXICON_CONCEPTS.map((concept, i) => (
              <span
                key={concept.id}
                className={styles.snapPoint}
                style={{ top: i * DECK_STEP }}
                aria-hidden="true"
              />
            ))}
            <div className={styles.stage}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionTitles}>
                  {SECTIONS.map((section) => (
                    <h2
                      key={section}
                      id={`lexicon-${section}`}
                      className={
                        section === activeSection
                          ? styles.sectionTitle
                          : `${styles.sectionTitle} sr-only`
                      }
                    >
                      {SECTION_TITLE[section]}
                    </h2>
                  ))}
                </div>
                <button type="button" className={styles.seeAll} onClick={onSeeAll}>
                  See all
                </button>
              </div>
              <div className={styles.deck}>
                {SECTIONS.map((section) => (
                  <section key={section} aria-labelledby={`lexicon-${section}`}>
                    <ul className={styles.stack}>
                      {conceptsOf(section).map((concept) => {
                        const i = DECK_INDEX.get(concept.id)!;
                        const place = placements[i];
                        return (
                          <ConceptCard
                            key={concept.id}
                            itemRef={(el) => {
                              cardRefs.current[i] = el;
                            }}
                            concept={concept}
                            open={i === active}
                            learned={learned.includes(concept.id)}
                            hidden={place.hidden}
                            style={
                              {
                                top: place.top,
                                zIndex: place.z,
                                '--card-scale': place.scale,
                              } as CSSProperties
                            }
                            onSelect={() => select(i)}
                            onToggleLearned={() => toggleLearned(concept.id)}
                          />
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        // Full list of the concepts, by section, with their learned rounds.
        SECTIONS.map((section) => (
          <section key={section} className={styles.section} aria-labelledby={`all-${section}`}>
            <h2 id={`all-${section}`} className={`${styles.sectionTitle} ${styles.listTitle}`}>
              {SECTION_TITLE[section]}
            </h2>
            <ul className={styles.list}>
              {conceptsOf(section).map((concept) => {
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
          </section>
        ))
      )}
    </main>
  );
}
