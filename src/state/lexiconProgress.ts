import { LEXICON_CONCEPTS } from '../data/lexicon';

/**
 * localStorage key of the Lexicon progress (decision D25). Separate from the saved game
 * (`bgc.game.v2`, src/state/storage.ts): reading or writing it never touches the game.
 */
export const LEXICON_STORAGE_KEY = 'silva.lexicon.v1';

/** Version of the saved shape; bump it (and the key) on an incompatible change. */
export const LEXICON_STORAGE_VERSION = 1;

const KNOWN_IDS = new Set(LEXICON_CONCEPTS.map((c) => c.id));

/**
 * Ids of the concepts marked as learned, in Lexicon order. Anything unreadable (no storage,
 * invalid JSON, other version, wrong shape) gives an empty list; unknown or repeated ids are
 * dropped.
 */
export function loadLearned(): string[] {
  try {
    const raw = window.localStorage.getItem(LEXICON_STORAGE_KEY);
    if (raw === null) return [];
    const saved: unknown = JSON.parse(raw);
    if (
      typeof saved !== 'object' ||
      saved === null ||
      (saved as Record<string, unknown>).version !== LEXICON_STORAGE_VERSION
    ) {
      return [];
    }
    const learned = (saved as Record<string, unknown>).learned;
    if (!Array.isArray(learned)) return [];
    return normalize(learned);
  } catch {
    return [];
  }
}

/** Saves the learned concepts (unknown ids dropped). Fails silently without storage. */
export function saveLearned(ids: readonly unknown[]): void {
  try {
    window.localStorage.setItem(
      LEXICON_STORAGE_KEY,
      JSON.stringify({ version: LEXICON_STORAGE_VERSION, learned: normalize(ids) }),
    );
  } catch {
    // Storage full or unavailable: the ticks still work until the page is reloaded.
  }
}

/** Known ids only, once each, in Lexicon order. */
function normalize(ids: readonly unknown[]): string[] {
  const set = new Set(
    ids.filter((id): id is string => typeof id === 'string' && KNOWN_IDS.has(id)),
  );
  return LEXICON_CONCEPTS.map((c) => c.id).filter((id) => set.has(id));
}
