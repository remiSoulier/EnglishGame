import { BoardScreen } from './screens/Board';
import { NewBoardScreen } from './screens/NewBoard';
import { useDemoGame } from './state/useDemoGame';
import './styles/tokens.css';
import './styles/global.css';

const noop = () => {};

/** Temporary demo game (task #8) until game state (#10) and navigation (#12). */
function App() {
  const game = useDemoGame();

  if (game.screen === 'newBoard') {
    return (
      <NewBoardScreen
        board={game.board}
        playerCount={game.playerCount}
        onStartTurn={game.startTurn}
      />
    );
  }

  return (
    <BoardScreen
      board={game.board}
      playerCount={game.playerCount}
      activePlayer={game.activePlayer}
      onQuestion={noop}
      onNextPlayer={game.nextPlayer}
      onEndTurn={game.endTurn}
      onNewBoard={noop}
      onWinner={noop}
    />
  );
}

export default App;
