import { cellName, type Board } from '../../engine';

/** Short English summary of a board, used as the SVG accessible name. */
export function describeBoard(board: Board): string {
  const enemies = board.enemies.map(cellName);
  const enemyText =
    enemies.length === 0
      ? 'No enemies.'
      : `${enemies.length === 1 ? 'Enemy' : 'Enemies'} on ${enemies.join(', ')}.`;
  const wallText = `${board.walls.length} ${board.walls.length === 1 ? 'wall' : 'walls'}.`;
  return `Board, turn ${board.turn}. Goal on ${cellName(board.goal)}. ${enemyText} ${wallText}`;
}
