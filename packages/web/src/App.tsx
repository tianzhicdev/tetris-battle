import { useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { TetrisGame } from './components/TetrisGame';
import { Matchmaking } from './components/PartykitMatchmaking';
import { MultiplayerGame } from './components/PartykitMultiplayerGame';
import { THEMES } from './themes';

type GameMode = 'menu' | 'solo' | 'matchmaking' | 'multiplayer';

interface GameMatch {
  roomId: string;
  player1Id: string;
  player2Id: string;
}

function App() {
  const [mode, setMode] = useState<GameMode>('menu');
  const [currentTheme, setCurrentTheme] = useState(THEMES[1]); // Default to Retro
  const [gameMatch, setGameMatch] = useState<GameMatch | null>(null);

  // Generate a simple player ID (in production, use proper auth)
  const [playerId] = useState(() => `player_${Math.random().toString(36).substr(2, 9)}`);

  const handleSelectMode = (selectedMode: 'solo' | 'multiplayer') => {
    if (selectedMode === 'solo') {
      setMode('solo');
    } else {
      setMode('matchmaking');
    }
  };

  const handleMatchFound = (roomId: string, player1Id: string, player2Id: string) => {
    setGameMatch({ roomId, player1Id, player2Id });
    setMode('multiplayer');
  };

  const handleExitGame = () => {
    setGameMatch(null);
    setMode('menu');
  };

  const handleCancelMatchmaking = () => {
    setMode('menu');
  };

  if (mode === 'menu') {
    return <MainMenu onSelectMode={handleSelectMode} theme={currentTheme} />;
  }

  if (mode === 'solo') {
    return <TetrisGame onExit={handleExitGame} currentTheme={currentTheme} onThemeChange={setCurrentTheme} />;
  }

  if (mode === 'matchmaking') {
    return (
      <Matchmaking
        playerId={playerId}
        onMatchFound={handleMatchFound}
        onCancel={handleCancelMatchmaking}
        theme={currentTheme}
      />
    );
  }

  if (mode === 'multiplayer' && gameMatch) {
    const opponentId = gameMatch.player1Id === playerId ? gameMatch.player2Id : gameMatch.player1Id;

    return (
      <MultiplayerGame
        roomId={gameMatch.roomId}
        playerId={playerId}
        opponentId={opponentId}
        theme={currentTheme}
        onExit={handleExitGame}
      />
    );
  }

  return null;
}

export default App;
