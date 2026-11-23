import { useState } from 'react';
import { BoardScreen } from './screens/Board';
import { FIXTURE_BOARD } from './state/fixtureBoard';
import './styles/tokens.css';
import './styles/global.css';

const PLAYER_COUNT = 4;
const noop = () => {};

/** Temporary local demo of the Board screen (task #7) until game state (#10) and navigation (#12). */
function App() {
  const [activePlayer, setActivePlayer] = useState(1);
  const [turn, setTurn] = useState(FIXTURE_BOARD.turn);

  return (
    <BoardScreen
      board={{ ...FIXTURE_BOARD, turn }}
      playerCount={PLAYER_COUNT}
      activePlayer={activePlayer}
      onQuestion={noop}
      onNextPlayer={() => setActivePlayer((p) => Math.min(p + 1, PLAYER_COUNT))}
      onEndTurn={() => {
        setActivePlayer(1);
        setTurn((t) => t + 1);
      }}
      onNewBoard={noop}
      onWinner={noop}
    />
  );
}

export default App;
