import { useState, useEffect, useRef, useCallback } from 'react';
import { MainMenu } from './components/MainMenu';
import { TetrisGame } from './components/TetrisGame';
import { Matchmaking } from './components/PartykitMatchmaking';
import { MultiplayerGame } from './components/PartykitMultiplayerGame';
import { ChallengeNotification } from './components/ChallengeNotification';
import { ChallengeWaiting } from './components/ChallengeWaiting';
import { AuthWrapper } from './components/AuthWrapper';
import { DEFAULT_THEME } from './themes';
import { progressionService } from './lib/supabase';
import { friendService } from './services/friendService';
import { PartykitPresence } from './services/partykit/presence';
import { useFriendStore } from './stores/friendStore';
import type { UserProfile } from '@tetris-battle/game-core';

type GameMode = 'menu' | 'solo' | 'matchmaking' | 'multiplayer';

interface GameMatch {
  roomId: string;
  player1Id: string;
  player2Id: string;
  aiOpponent?: any;
}

function GameApp({ profile: initialProfile }: { profile: UserProfile }) {
  const [mode, setMode] = useState<GameMode>('menu');
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME); // Default to Glass
  const [gameMatch, setGameMatch] = useState<GameMatch | null>(null);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const presenceRef = useRef<PartykitPresence | null>(null);

  const {
    loadFriends,
    loadPendingRequests,
    updatePresence,
    setIncomingChallenge,
    setOutgoingChallenge,
    clearChallenges,
    friends,
  } = useFriendStore();

  // Use Clerk user ID as player ID
  const playerId = profile.userId;

  // Initialize presence connection
  useEffect(() => {
    const host = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';
    const presence = new PartykitPresence(playerId, host);

    presence.connect({
      onPresenceUpdate: (userId, status) => {
        updatePresence(userId, status);
      },
      onChallengeReceived: (challenge) => {
        setIncomingChallenge({
          challengeId: challenge.challengeId,
          challengerId: challenge.challengerId,
          challengedId: playerId,
          challengerUsername: challenge.challengerUsername,
          challengerRank: challenge.challengerRank,
          challengerLevel: challenge.challengerLevel,
          expiresAt: challenge.expiresAt,
        });
      },
      onChallengeAccepted: (data) => {
        clearChallenges();
        setGameMatch({ roomId: data.roomId, player1Id: data.player1, player2Id: data.player2 });
        setMode('multiplayer');
      },
      onChallengeDeclined: () => {
        setOutgoingChallenge(null);
      },
      onChallengeExpired: () => {
        clearChallenges();
      },
      onChallengeCancelled: () => {
        setIncomingChallenge(null);
      },
    });

    presenceRef.current = presence;

    // Load friends and pending requests
    loadFriends(playerId);
    loadPendingRequests(playerId);

    return () => {
      presence.disconnect();
      presenceRef.current = null;
    };
  }, [playerId]);

  // Subscribe to friend presence when friend list changes
  useEffect(() => {
    if (presenceRef.current && friends.length > 0) {
      const friendIds = friends.map(f => f.userId);
      presenceRef.current.subscribeFriends(friendIds);
    }
  }, [friends]);

  // Update presence status based on game mode
  useEffect(() => {
    if (!presenceRef.current) return;
    switch (mode) {
      case 'menu':
        presenceRef.current.updateStatus('menu');
        break;
      case 'matchmaking':
        presenceRef.current.updateStatus('in_queue');
        break;
      case 'multiplayer':
      case 'solo':
        presenceRef.current.updateStatus('in_game');
        break;
    }
  }, [mode]);

  // Reload profile when returning to menu
  useEffect(() => {
    if (mode === 'menu') {
      // Small delay to ensure database writes complete
      setTimeout(() => {
        reloadProfile();
      }, 500);
    }
  }, [mode]);

  const reloadProfile = async () => {
    console.log('[APP] Reloading profile...', profile.userId);
    const updated = await progressionService.getUserProfile(profile.userId);
    console.log('[APP] Profile loaded:', updated);
    if (updated) {
      setProfile(updated);
      console.log('[APP] Profile state updated');
    } else {
      console.error('[APP] Failed to load profile');
    }
  };

  const handleSelectMode = (selectedMode: 'solo' | 'multiplayer') => {
    if (selectedMode === 'solo') {
      setMode('solo');
    } else {
      setMode('matchmaking');
    }
  };

  const handleMatchFound = (roomId: string, player1Id: string, player2Id: string, aiOpponent?: any) => {
    setGameMatch({ roomId, player1Id, player2Id, aiOpponent });
    setMode('multiplayer');
  };

  const handleExitGame = () => {
    setGameMatch(null);
    setMode('menu');
  };

  const handleCancelMatchmaking = () => {
    setMode('menu');
  };

  // Challenge handlers
  const handleChallenge = useCallback(async (friendUserId: string, friendUsername: string) => {
    const challengeId = await friendService.createChallenge(playerId, friendUserId);
    if (!challengeId) return;

    // Send via presence WebSocket
    presenceRef.current?.sendChallenge(
      challengeId,
      friendUserId,
      profile.username,
      profile.rank,
      profile.level
    );

    // Set outgoing challenge in store
    setOutgoingChallenge({
      challengeId,
      challengerId: playerId,
      challengedId: friendUserId,
      challengerUsername: friendUsername,
      challengerRank: 0,
      challengerLevel: 0,
      expiresAt: Date.now() + 120000,
    });
  }, [playerId, profile, setOutgoingChallenge]);

  const handleAcceptChallenge = useCallback(async (challengeId: string) => {
    await friendService.updateChallengeStatus(challengeId, 'accepted');
    presenceRef.current?.acceptChallenge(challengeId);
    setIncomingChallenge(null);
  }, [setIncomingChallenge]);

  const handleDeclineChallenge = useCallback(async (challengeId: string) => {
    await friendService.updateChallengeStatus(challengeId, 'declined');
    presenceRef.current?.declineChallenge(challengeId);
    setIncomingChallenge(null);
  }, [setIncomingChallenge]);

  const handleCancelChallenge = useCallback(async (challengeId: string) => {
    await friendService.updateChallengeStatus(challengeId, 'expired');
    presenceRef.current?.cancelChallenge(challengeId);
    setOutgoingChallenge(null);
  }, [setOutgoingChallenge]);

  return (
    <>
      {/* Global challenge notifications */}
      <ChallengeNotification
        onAccept={handleAcceptChallenge}
        onDecline={handleDeclineChallenge}
      />
      <ChallengeWaiting onCancel={handleCancelChallenge} />

      {/* Game mode routing */}
      {mode === 'menu' && (
        <MainMenu
          onSelectMode={handleSelectMode}
          theme={currentTheme}
          profile={profile}
          onProfileUpdate={setProfile}
          onChallenge={handleChallenge}
        />
      )}

      {mode === 'solo' && (
        <TetrisGame onExit={handleExitGame} currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
      )}

      {mode === 'matchmaking' && (
        <Matchmaking
          playerId={playerId}
          onMatchFound={handleMatchFound}
          onCancel={handleCancelMatchmaking}
          theme={currentTheme}
        />
      )}

      {mode === 'multiplayer' && gameMatch && (() => {
        const opponentId = gameMatch.player1Id === playerId ? gameMatch.player2Id : gameMatch.player1Id;
        return (
          <MultiplayerGame
            roomId={gameMatch.roomId}
            playerId={playerId}
            opponentId={opponentId}
            theme={currentTheme}
            profile={profile}
            onExit={handleExitGame}
            aiOpponent={gameMatch.aiOpponent}
          />
        );
      })()}
    </>
  );
}

function App() {
  return (
    <AuthWrapper>
      {(profile) => <GameApp profile={profile} />}
    </AuthWrapper>
  );
}

export default App;
