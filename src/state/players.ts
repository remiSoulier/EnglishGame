/** An illustrated character drawn on the board (precached art in public/art/, works offline). */
export interface PlayerCharacter {
  /** Display name, e.g. "Kitkat". */
  name: string;
  /** Precached art (public/art/), served from the app root so it works offline. */
  src: string;
}

/**
 * Character roles chosen by the user (decision D15): the cat, the bat, the mushroom and the
 * hedgehog are the protagonists (players), the dragon is the goal, the crocodile, the ghost (the
 * hooded "croque-mort") and the spider are the enemies. Change the mapping here only.
 */

/** Default character of each player, in player order (P1, P2, P3, P4). */
export const PLAYER_CHARACTERS: readonly PlayerCharacter[] = [
  { name: 'Kitkat', src: '/art/char-kitkat.webp' },
  { name: 'Batman', src: '/art/char-batman.webp' },
  { name: 'Mushi', src: '/art/char-toad.webp' },
  { name: 'Gus', src: '/art/char-gus.webp' },
];

/** The goal: the dragon. */
export const GOAL_CHARACTER: PlayerCharacter = { name: 'Dragon', src: '/art/char-dragon.webp' };

/** Enemy characters, used in turn for the board's enemies (enemy 1, enemy 2, …). */
export const ENEMY_CHARACTERS: readonly PlayerCharacter[] = [
  { name: 'Croco', src: '/art/char-croco.webp' },
  { name: 'Kevin', src: '/art/char-croque-mort.webp' },
  { name: 'Vecna', src: '/art/char-spider.webp' },
];

/**
 * Character of player `index` (0-based). `characters` is the game's choice (decision D19:
 * `characters[i]` is an index in `PLAYER_CHARACTERS`); without it, player i plays character i.
 * Cycles if there are more players than characters.
 */
export function playerCharacter(index: number, characters?: readonly number[]): PlayerCharacter {
  const chosen = characters?.[index];
  const i = chosen !== undefined && isCharacterIndex(chosen) ? chosen : index;
  return PLAYER_CHARACTERS[i % PLAYER_CHARACTERS.length];
}

/** True for an index of `PLAYER_CHARACTERS`. */
export function isCharacterIndex(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < PLAYER_CHARACTERS.length
  );
}

/** True when `characters` gives one character to each of `playerCount` players, all different. */
export function isValidCharacters(characters: unknown, playerCount: number): boolean {
  return (
    Array.isArray(characters) &&
    characters.length === playerCount &&
    characters.every(isCharacterIndex) &&
    new Set(characters).size === characters.length
  );
}

/** Default characters: player i plays character i. */
export function defaultCharacters(playerCount: number): number[] {
  return Array.from({ length: playerCount }, (_, i) => i);
}

/** Character of the board's enemy number `index` (0-based), alternating the enemy characters. */
export function enemyCharacter(index: number): PlayerCharacter {
  return ENEMY_CHARACTERS[index % ENEMY_CHARACTERS.length];
}

/**
 * Gives `character` to player `player`; if another player had it, the two swap, so every player
 * keeps a different character (decision D19). `null` = no character chosen yet (on New game, a
 * player taps their character again to deselect it).
 */
export function pickCharacter(
  characters: readonly (number | null)[],
  player: number,
  character: number,
): (number | null)[] {
  const next = [...characters];
  const other = next.indexOf(character);
  if (other !== -1 && other !== player) next[other] = next[player];
  next[player] = character;
  return next;
}
