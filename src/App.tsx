import { ALL_QUESTIONS } from './data/questions';
import { getQuestion, newCode } from './engine';
import { BoardScreen } from './screens/Board';
import { NewBoardScreen } from './screens/NewBoard';
import { HomeScreen } from './screens/Home';
import { NewGameScreen } from './screens/NewGame';
import { QuestionScreen } from './screens/Question';
import { QuestionPopupScreen } from './screens/QuestionPopup';
import { ResultScreen } from './screens/Result';
import { GameProvider, useGame } from './state/GameContext';
import { openQuestionAction } from './state/questionFlow';
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

  if (game && (screen === 'board' || screen === 'questionPopup')) {
    const pending = screen === 'questionPopup' ? game.pendingQuestion : null;
    // Same tree for both screens, so the board is not remounted under the popup and focus can
    // return to the Question button on Cancel.
    return (
      <>
        <div inert={pending !== null} aria-hidden={pending !== null || undefined}>
          <BoardScreen
            board={game.board}
            playerCount={game.playerCount}
            activePlayer={game.activePlayer}
            onQuestion={() => dispatch(openQuestionAction(game.askedQuestionIds))}
            onNextPlayer={() => dispatch({ type: 'NEXT_PLAYER' })}
            onEndTurn={() => dispatch({ type: 'END_TURN' })}
            // TODO(#12): ask for confirmation first.
            onNewBoard={() => dispatch({ type: 'NEW_BOARD', code: newCode() })}
            onWinner={() => dispatch({ type: 'OPEN_WINNER' })}
          />
        </div>
        {pending && (
          <QuestionPopupScreen
            player={game.activePlayer}
            cards={pending.cards}
            onShow={() => dispatch({ type: 'SHOW_QUESTION' })}
            onCancel={() => dispatch({ type: 'CANCEL_QUESTION' })}
          />
        )}
      </>
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

  const pending = game?.pendingQuestion;
  const question = pending ? getQuestion(pending.questionId, ALL_QUESTIONS) : undefined;

  if (game && pending && question && screen === 'question') {
    return (
      <QuestionScreen
        question={question}
        player={game.activePlayer}
        cards={pending.cards}
        onAnswer={(answer) => dispatch({ type: 'ANSWER_QUESTION', answer })}
      />
    );
  }

  if (game && pending?.answer && question && screen === 'result') {
    return (
      <ResultScreen
        question={question}
        player={game.activePlayer}
        cards={pending.cards}
        answer={pending.answer}
        correct={pending.correct === true}
        onContinue={() => dispatch({ type: 'CONTINUE' })}
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
