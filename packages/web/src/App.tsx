import { useState, useEffect, useRef, useCallback } from 'react';
import { MainMenu } from './components/MainMenu';
import { TetrisGame } from './components/TetrisGame';
import { Matchmaking } from './components/PartykitMatchmaking';
import { ServerAuthMultiplayerGame } from './components/ServerAuthMultiplayerGame';
import { Notification } from './components/Notification';
import { audioManager } from './services/audioManager';
import { ChallengeWaiting } from './components/ChallengeWaiting';
import { AuthWrapper } from './components/AuthWrapper';
import { AbilityEffectsDemo } from './components/AbilityEffectsDemo';
import { VisualEffectsDemo } from './components/VisualEffectsDemo';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { toLegacyTheme } from './themes/index';
import { progressionService } from './lib/supabase';
import { friendService } from './services/friendService';
import { PartykitPresence } from './services/partykit/presence';
import { normalizePartykitHost } from './services/partykit/host';
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
  const { theme } = useTheme();
  const currentTheme = toLegacyTheme(theme); // Convert to legacy format for existing components
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
    incomingChallenge,
  } = useFriendStore();

  const [challengeTimeLeft, setChallengeTimeLeft] = useState(120);

  // Use Clerk user ID as player ID
  const playerId = profile.userId;

  // Handle challenge countdown timer
  useEffect(() => {
    if (!incomingChallenge) {
      setChallengeTimeLeft(120);
      return;
    }

    const remaining = Math.max(0, Math.floor((incomingChallenge.expiresAt - Date.now()) / 1000));
    setChallengeTimeLeft(remaining);

    const interval = setInterval(() => {
      setChallengeTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          handleDeclineChallenge(incomingChallenge.challengeId);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingChallenge]);

  // Initialize presence connection
  useEffect(() => {
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
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

  const handleMatchFound = useCallback((roomId: string, player1Id: string, player2Id: string, aiOpponent?: any) => {
    setGameMatch({ roomId, player1Id, player2Id, aiOpponent });
    setMode('multiplayer');
  }, []);

  const handleExitGame = useCallback(() => {
    setGameMatch(null);
    setMode('menu');
  }, []);

  const handleCancelMatchmaking = useCallback(() => {
    setMode('menu');
  }, []);

  // Challenge handlers
  const handleChallenge = useCallback(async (friendUserId: string, friendUsername: string) => {
    const challengeId = await friendService.createChallenge(playerId, friendUserId);
    if (!challengeId) return;

    // Send via presence WebSocket
    presenceRef.current?.sendChallenge(
      challengeId,
      friendUserId,
      profile.username,
      profile.matchmakingRating,
      0 // level no longer exists
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
      <Notification
        visible={!!incomingChallenge}
        title={incomingChallenge?.challengerUsername || 'Challenge'}
        message={`Lv ${incomingChallenge?.challengerLevel || 0} · Rank ${incomingChallenge?.challengerRank || 0}`}
        variant="challenge"
        countdown={challengeTimeLeft}
        actions={incomingChallenge ? [
          {
            label: 'Accept',
            onClick: () => {
              audioManager.playSfx('button_click');
              handleAcceptChallenge(incomingChallenge.challengeId);
            },
            variant: 'success',
          },
          {
            label: 'Decline',
            onClick: () => {
              audioManager.playSfx('button_click');
              handleDeclineChallenge(incomingChallenge.challengeId);
            },
            variant: 'danger',
          },
        ] : undefined}
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
        <TetrisGame onExit={handleExitGame} currentTheme={currentTheme} onThemeChange={() => {}} />
      )}

      {mode === 'matchmaking' && (
        <Matchmaking
          playerId={playerId}
          rank={profile.matchmakingRating}
          onMatchFound={handleMatchFound}
          onCancel={handleCancelMatchmaking}
          theme={currentTheme}
        />
      )}

      {mode === 'multiplayer' && gameMatch && (() => {
        const opponentId = gameMatch.player1Id === playerId ? gameMatch.player2Id : gameMatch.player1Id;
        return (
          <ServerAuthMultiplayerGame
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
  // Check if demo mode is enabled via URL parameter
  const params = new URLSearchParams(window.location.search);
  const demoMode = params.get('demo');

  if (demoMode === 'abilities') {
    return <AbilityEffectsDemo />;
  }

  if (demoMode === 'effects') {
    return <VisualEffectsDemo />;
  }

  return (
    <AuthWrapper>
      {(profile) => (
        <ThemeProvider userId={profile.userId}>
          <GameApp profile={profile} />
        </ThemeProvider>
      )}
    </AuthWrapper>
  );
}

export default App;
