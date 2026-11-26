/*
 * Navigation (backlog #12, decision D8): the game reducer owns `screen`, there is no router.
 * The full map (each screen → the screens it leads to) is `NAVIGATION` in src/state/navigation.ts.
 * In short: Home → New game → Board ⇄ Question popup → Question → Result → Board (the question
 * popup, the question card and the result are all drawn over the board, as in the Figma mockup:
 * decision D18); Board → End
 * turn (at any time, no turn order: decision D11) → New board → Board; Board menu → New board
 * (confirm) / End game (confirm, game deleted: decision D13) → Home / Quit to home (confirm, game
 * kept) → Home → Continue game. The Lexicon (decision D25) opens from Home and from the board
 * menu as local UI state drawn over the current screen (left inert, never dispatched to), so
 * closing it returns exactly where the players were. The browser / Android back button maps to
 * the in-app Back where there is one (useSystemBack), and focus moves to the new screen's <h1>.
 */
import { useEffect, useRef, useState } from 'react';
import { ALL_QUESTIONS } from './data/questions';
import { getQuestion, newCode } from './engine';
import {
  BoardScreen,
  DIFFICULTY_LABEL,
  EndGameConfirm,
  NewBoardConfirm,
  QuitConfirm,
} from './screens/Board';
import { NewBoardScreen } from './screens/NewBoard';
import { HomeScreen } from './screens/Home';
import { LexiconScreen, type LexiconView } from './screens/Lexicon';
import { NewGameScreen } from './screens/NewGame';
import { QuestionScreen } from './screens/Question';
import { QuestionPopupScreen } from './screens/QuestionPopup';
import { ResultScreen } from './screens/Result';
import { GameProvider, useGame } from './state/GameContext';
import { canGoBack } from './state/navigation';
import { openQuestionAction } from './state/questionFlow';
import { useSystemBack } from './state/useSystemBack';
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
};

/** Confirmation dialogs of the board menu (local UI state, not saved). */
type BoardDialog = null | 'newBoard' | 'endGame' | 'quit';

/**
 * The Lexicon over Home or the board (decision D25): local UI state, so the reducer, the screen
 * and the saved game are never touched. Remembers the control that opened it and gives it focus
 * back on close.
 */
function useLexicon() {
  const [view, setView] = useState<LexiconView | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (view !== null || !restoreFocus.current) return;
    restoreFocus.current = false;
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus();
  }, [view]);

  return {
    view,
    open: () => {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement ? active : null;
      setView('main');
    },
    seeAll: () => setView('all'),
    /** ‹ / system back: "See all" → entry, entry → closed. */
    back: () => {
      if (view === 'all') {
        setView('main');
      } else {
        restoreFocus.current = true;
        setView(null);
      }
    },
  };
}

/**
 * Moves focus to the new screen's <h1> when the screen changes, unless something on the new
 * screen already has it (a dialog, or a screen that focuses its own heading such as Result, or
 * the Question button the popup returns focus to on Cancel).
 */
function useHeadingFocus(screen: string): void {
  const previous = useRef(screen);
  useEffect(() => {
    if (previous.current === screen) return;
    previous.current = screen;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && !active.closest('[inert]')) {
      return;
    }
    const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1')).find(
      (h1) => !h1.closest('[inert]'),
    );
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus();
  }, [screen]);
}

/** Renders the screen chosen by the game reducer. */
function Screens() {
  const { state, dispatch } = useGame();
  const { screen, game } = state;
  // Local UI state: the "Start a new board?" / "End this game?" / "Quit this game?" confirmation
  // over the board.
  const [boardDialog, setBoardDialog] = useState<BoardDialog>(null);
  const dialog = screen === 'board' ? boardDialog : null;
  const lexicon = useLexicon();
  // Only reachable from Home and the board (its menu).
  const lexiconView = screen === 'home' || screen === 'board' ? lexicon.view : null;
  const lexiconScreen = lexiconView && (
    <LexiconScreen view={lexiconView} onBack={lexicon.back} onSeeAll={lexicon.seeAll} />
  );

  // System back: leaves the Lexicon step by step, closes a confirmation, else the in-app Back
  // where there is one.
  useSystemBack(lexiconView !== null || dialog !== null || canGoBack(state), () => {
    if (lexiconView !== null) lexicon.back();
    else if (dialog !== null) setBoardDialog(null);
    else dispatch({ type: 'BACK' });
  });
  useHeadingFocus(screen);

  if (screen === 'home') {
    const covered = lexiconView !== null;
    return (
      <>
        <div inert={covered} aria-hidden={covered || undefined}>
          <HomeScreen
            onNewGame={() => dispatch({ type: 'GO_NEW_GAME' })}
            savedGame={game && { turn: game.turn, difficulty: DIFFICULTY_LABEL[game.difficulty] }}
            onContinue={() => dispatch({ type: 'CONTINUE_GAME' })}
            onLexicon={lexicon.open}
          />
        </div>
        {lexiconScreen}
      </>
    );
  }

  if (screen === 'newGame') {
    return (
      <NewGameScreen
        onStart={(settings) => dispatch({ type: 'START_GAME', ...settings })}
        onBack={() => dispatch({ type: 'BACK' })}
        replacesGame={game !== null}
      />
    );
  }

  const overBoard =
    screen === 'board' ||
    screen === 'questionPopup' ||
    screen === 'question' ||
    screen === 'result';

  if (game && overBoard) {
    const pending = game.pendingQuestion;
    const question = pending ? getQuestion(pending.questionId, ALL_QUESTIONS) : undefined;
    const popup = screen === 'questionPopup' ? pending : null;
    const showQuestion = screen === 'question' && pending !== null && question !== undefined;
    const showResult = screen === 'result' && pending?.answer != null && question !== undefined;
    const covered =
      popup !== null || showQuestion || showResult || dialog !== null || lexiconView !== null;
    // Same tree for every screen drawn over the board, so the board is not remounted under the
    // popup / question card / result and focus can return to the Question button on Cancel.
    return (
      <>
        <div inert={covered} aria-hidden={covered || undefined}>
          <BoardScreen
            board={game.board}
            playerCount={game.playerCount}
            characters={game.characters}
            onQuestion={() => dispatch(openQuestionAction(game.askedQuestionIds))}
            onEndTurn={() => dispatch({ type: 'END_TURN' })}
            onNewBoard={() => setBoardDialog('newBoard')}
            onEndGame={() => setBoardDialog('endGame')}
            onQuit={() => setBoardDialog('quit')}
            onLexicon={lexicon.open}
          />
        </div>
        {lexiconScreen}
        {popup && (
          <QuestionPopupScreen
            cards={popup.cards}
            onShow={() => dispatch({ type: 'SHOW_QUESTION' })}
            onCancel={() => dispatch({ type: 'CANCEL_QUESTION' })}
          />
        )}
        {showQuestion && (
          <QuestionScreen
            question={question}
            cards={pending.cards}
            onAnswer={(answer) => dispatch({ type: 'ANSWER_QUESTION', answer })}
          />
        )}
        {showResult && (
          <ResultScreen
            question={question}
            cards={pending.cards}
            answer={pending.answer!}
            correct={pending.correct === true}
            onContinue={() => dispatch({ type: 'CONTINUE' })}
          />
        )}
        {dialog === 'newBoard' && (
          <NewBoardConfirm
            onConfirm={() => {
              setBoardDialog(null);
              dispatch({ type: 'NEW_BOARD', code: newCode() });
            }}
            onCancel={() => setBoardDialog(null)}
          />
        )}
        {dialog === 'endGame' && (
          <EndGameConfirm
            onConfirm={() => {
              setBoardDialog(null);
              dispatch({ type: 'END_GAME' });
            }}
            onCancel={() => setBoardDialog(null)}
          />
        )}
        {dialog === 'quit' && (
          <QuitConfirm
            onConfirm={() => {
              setBoardDialog(null);
              dispatch({ type: 'QUIT_TO_HOME' });
            }}
            onCancel={() => setBoardDialog(null)}
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
        characters={game.characters}
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
