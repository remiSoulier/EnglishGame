import { Grid } from './components/Grid';
import { Legend } from './components/Legend';
import { FIXTURE_BOARD } from './state/fixtureBoard';
import './styles/tokens.css';

function App() {
  return (
    <main>
      <h1>Board Game Companion</h1>
      {/* Temporary preview of the board grid (task #6) until the Board screen exists. */}
      <Grid board={FIXTURE_BOARD} />
      <Legend />
    </main>
  );
}

export default App;
