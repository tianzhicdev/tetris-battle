import { useState, useEffect } from 'react';
import { MainMenu } from './components/MainMenu';
import { TetrisGame } from './components/TetrisGame';
import { Matchmaking } from './components/PartykitMatchmaking';
import { MultiplayerGame } from './components/PartykitMultiplayerGame';
import { AuthWrapper } from './components/AuthWrapper';
import { THEMES } from './themes';
import { progressionService } from './lib/supabase';
import type { UserProfile } from '@tetris-battle/game-core';

type GameMode = 'menu' | 'solo' | 'matchmaking' | 'multiplayer';

interface GameMatch {
  roomId: string;
  player1Id: string;
  player2Id: string;
}

function GameApp({ profile: initialProfile }: { profile: UserProfile }) {
  const [mode, setMode] = useState<GameMode>('menu');
  const [currentTheme, setCurrentTheme] = useState(THEMES[1]); // Default to Retro
  const [gameMatch, setGameMatch] = useState<GameMatch | null>(null);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);

  // Use Clerk user ID as player ID
  const playerId = profile.userId;

  // Reload profile when returning to menu
  useEffect(() => {
    if (mode === 'menu') {
      reloadProfile();
    }
  }, [mode]);

  const reloadProfile = async () => {
    const updated = await progressionService.getUserProfile(profile.userId);
    if (updated) {
      setProfile(updated);
    }
  };

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
    return (
      <MainMenu
        onSelectMode={handleSelectMode}
        theme={currentTheme}
        profile={profile}
        onProfileUpdate={setProfile}
      />
    );
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

function App() {
  return (
    <AuthWrapper>
      {(profile) => <GameApp profile={profile} />}
    </AuthWrapper>
  );
}

export default App;
