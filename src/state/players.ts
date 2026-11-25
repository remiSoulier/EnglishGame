/** A player's character: the illustrated token drawn on their start cell. */
export interface PlayerCharacter {
  /** Display name, e.g. "Kitkat". */
  name: string;
  /** Precached art (public/art/), served from the app root so it works offline. */
  src: string;
}

/**
 * Default character of each player, in player order (P1, P2, P3, P4). Change the mapping here
 * only; other characters available in public/art/: char-batman, char-croque-mort, char-gus.
 */
export const PLAYER_CHARACTERS: readonly PlayerCharacter[] = [
  { name: 'Kitkat', src: '/art/char-kitkat.webp' },
  { name: 'Croco', src: '/art/char-croco.webp' },
  { name: 'Dragon', src: '/art/char-dragon.webp' },
  { name: 'Toad', src: '/art/char-toad.webp' },
];

/** Character of player `index` (0-based), cycling if there are more players than characters. */
export function playerCharacter(index: number): PlayerCharacter {
  return PLAYER_CHARACTERS[index % PLAYER_CHARACTERS.length];
}
