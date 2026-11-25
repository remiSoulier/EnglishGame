/** An illustrated character drawn on the board (precached art in public/art/, works offline). */
export interface PlayerCharacter {
  /** Display name, e.g. "Kitkat". */
  name: string;
  /** Precached art (public/art/), served from the app root so it works offline. */
  src: string;
}

/**
 * Character roles chosen by the user (decision D15): the cat, the bat, the mushroom and the
 * hedgehog are the protagonists (players), the dragon is the goal, the crocodile and the ghost
 * (the hooded "croque-mort") are the enemies. A spider enemy will be added when its art exists.
 * Change the mapping here only.
 */

/** Default character of each player, in player order (P1, P2, P3, P4). */
export const PLAYER_CHARACTERS: readonly PlayerCharacter[] = [
  { name: 'Kitkat', src: '/art/char-kitkat.webp' },
  { name: 'Bat', src: '/art/char-batman.webp' },
  { name: 'Toad', src: '/art/char-toad.webp' },
  { name: 'Gus', src: '/art/char-gus.webp' },
];

/** The goal: the dragon. */
export const GOAL_CHARACTER: PlayerCharacter = { name: 'Dragon', src: '/art/char-dragon.webp' };

/** Enemy characters, used in turn for the board's enemies (enemy 1, enemy 2, …). */
export const ENEMY_CHARACTERS: readonly PlayerCharacter[] = [
  { name: 'Croco', src: '/art/char-croco.webp' },
  { name: 'Ghost', src: '/art/char-croque-mort.webp' },
];

/** Character of player `index` (0-based), cycling if there are more players than characters. */
export function playerCharacter(index: number): PlayerCharacter {
  return PLAYER_CHARACTERS[index % PLAYER_CHARACTERS.length];
}

/** Character of the board's enemy number `index` (0-based), alternating the enemy characters. */
export function enemyCharacter(index: number): PlayerCharacter {
  return ENEMY_CHARACTERS[index % ENEMY_CHARACTERS.length];
}
