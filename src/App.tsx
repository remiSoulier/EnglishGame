import { newCode } from './engine';
import { BoardScreen } from './screens/Board';
import { NewBoardScreen } from './screens/NewBoard';
import { HomeScreen } from './screens/Home';
import { NewGameScreen } from './screens/NewGame';
import { GameProvider, useGame } from './state/GameContext';
import type { Screen } from './state/types';
import './styles/tokens.css';
import './styles/global.css';

/** Titles of the screens not built yet (placeholders). */
const PLACEHOLDER_TITLE: Readonly<Record<Screen, string>> = {
  home: 'Home',
  newGame: 'New game',
  board: 'Board',
  questionPopup: 'Question',
  question: 'Question',
  result: 'Result',
  newBoard: 'New board',
  winner: 'We have a winner',
};

const noop = () => {};

/** Renders the screen chosen by the game reducer. */
function Screens() {
  const { state, dispatch } = useGame();
  const { screen, game } = state;

  if (screen === 'home') {
    return <HomeScreen onNewGame={() => dispatch({ type: 'GO_NEW_GAME' })} />;
  }

  if (screen === 'newGame') {
    return (
      <NewGameScreen
        onStart={(settings) => dispatch({ type: 'START_GAME', ...settings })}
        onBack={() => dispatch({ type: 'BACK' })}
      />
    );
  }

  if (game && screen === 'board') {
    return (
      <BoardScreen
        board={game.board}
        playerCount={game.playerCount}
        activePlayer={game.activePlayer}
        // TODO(#13/#14): open the question flow.
        onQuestion={noop}
        onNextPlayer={() => dispatch({ type: 'NEXT_PLAYER' })}
        onEndTurn={() => dispatch({ type: 'END_TURN' })}
        // TODO(#12): ask for confirmation first.
        onNewBoard={() => dispatch({ type: 'NEW_BOARD', code: newCode() })}
        onWinner={() => dispatch({ type: 'OPEN_WINNER' })}
      />
    );
  }

  if (game && screen === 'newBoard') {
    return (
      <NewBoardScreen
        board={game.board}
        playerCount={game.playerCount}
        onStartTurn={() => dispatch({ type: 'START_TURN' })}
      />
    );
  }

  return (
    <main>
      <h1>{PLACEHOLDER_TITLE[screen]}</h1>
    </main>
  );
}

function App() {
  return (
    <GameProvider>
      <Screens />
    </GameProvider>
  );
}

export default App;
