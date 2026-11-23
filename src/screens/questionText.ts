/** "1 card", "2 cards", "3 cards". */
export function cardsLabel(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}
