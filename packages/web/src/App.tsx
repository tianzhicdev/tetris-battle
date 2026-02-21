import { useState, useEffect, useRef, useCallback } from 'react';
import { MainMenu } from './components/MainMenu';
import { TetrisGame } from './components/TetrisGame';
import { Matchmaking } from './components/PartykitMatchmaking';
import { ServerAuthMultiplayerGame } from './components/ServerAuthMultiplayerGame';
import { DefenseLineMatchmaking } from './components/DefenseLineMatchmaking';
import { DefenseLineGame } from './components/DefenseLineGame';
import { audioManager } from './services/audioManager';
import { ChallengeWaiting } from './components/ChallengeWaiting';
import { ChallengeNotification } from './components/ChallengeNotification';
import { AuthWrapper } from './components/AuthWrapper';
import { useChallenges } from './hooks/useChallenges';
import { useFriendRequests } from './hooks/useFriendRequests';
import { supabase } from './lib/supabase';
import { AbilityEffectsDemo } from './components/AbilityEffectsDemo';
import { VisualEffectsDemo } from './components/VisualEffectsDemo';
import { TetriminoBgPreviewAll } from './components/TetriminoBgPreview';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { toLegacyTheme } from './themes/index';
import { progressionService } from './lib/supabase';
import { PartykitPresence } from './services/partykit/presence';
import { normalizePartykitHost } from './services/partykit/host';
import { useFriendStore } from './stores/friendStore';
import { ABILITY_IDS, type UserProfile } from '@tetris-battle/game-core';

type GameMode =
  | 'menu'
  | 'solo'
  | 'matchmaking'
  | 'multiplayer'
  | 'defense-line-matchmaking'
  | 'defense-line';

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
  const [defenseLineSide, setDefenseLineSide] = useState<'a' | 'b'>('a');
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const presenceRef = useRef<PartykitPresence | null>(null);

  const {
    clearChallenges,
    friends,
    cancelChallenge,
    sendChallenge,
  } = useFriendStore();

  // Use Clerk user ID as player ID
  const playerId = profile.userId;

  // Set up database-first challenge subscriptions
  useChallenges(mode === 'menu' ? playerId : '');

  // Set up real-time friend request notifications
  useFriendRequests(mode === 'menu' ? playerId : '');

  // Initialize presence connection (for online status only, not challenges)
  useEffect(() => {
    if (!playerId) return;

    // Keep presence only in menu to avoid extra sockets during matchmaking/gameplay.
    if (mode !== 'menu') {
      if (presenceRef.current) {
        console.log('[PRESENCE] Disconnecting (non-menu mode)');
        presenceRef.current.disconnect();
        presenceRef.current = null;
      }
      return;
    }

    // CRITICAL: Prevent duplicate connections if effect runs multiple times
    if (presenceRef.current) {
      return;
    }

    console.log('[PRESENCE] Initializing connection for player:', playerId);
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
    const presence = new PartykitPresence(playerId, host);

    presence.connect({
      onPresenceUpdate: (userId, status) => {
        // Use store method directly instead of from props
        useFriendStore.getState().updatePresence(userId, status);
      },
      // Challenge callbacks - no-ops since now handled by Supabase Realtime
      onChallengeReceived: () => {},
      onChallengeAccepted: () => {},
      onChallengeDeclined: () => {},
      onChallengeExpired: () => {},
      onChallengeCancelled: () => {},
    });

    presenceRef.current = presence;

    // Load friends and pending requests (call directly from store)
    useFriendStore.getState().loadFriends(playerId);
    useFriendStore.getState().loadPendingRequests(playerId);

    return () => {
      if (presenceRef.current === presence) {
        console.log('[PRESENCE] Cleanup disconnect');
        presence.disconnect();
        presenceRef.current = null;
      }
    };
  }, [playerId, mode]);

  // Listen for accepted challenges (as challenger) to navigate to game
  useEffect(() => {
    if (!playerId || mode !== 'menu') return;

    const subscription = supabase
      .channel(`challenge_accepted_${playerId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challenger_id=eq.${playerId}`,
      }, (payload) => {
        const challenge = payload.new as any;

        if (challenge.status === 'accepted' && challenge.room_id) {
          console.log('[APP] Challenge accepted, navigating to game');
          clearChallenges();
          setGameMatch({
            roomId: challenge.room_id,
            player1Id: challenge.challenger_id,
            player2Id: challenge.challenged_id,
          });
          setMode('multiplayer');
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [playerId, mode, clearChallenges]);

  // Subscribe to friend presence when friend list changes
  useEffect(() => {
    if (presenceRef.current && friends.length > 0) {
      const friendIds = friends.map(f => f.userId);
      presenceRef.current.subscribeFriends(friendIds);
    }
  }, [friends]);

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

  const handleSelectMode = (selectedMode: 'solo' | 'multiplayer' | 'defense-line') => {
    if (selectedMode === 'solo') {
      setMode('solo');
    } else if (selectedMode === 'defense-line') {
      setMode('defense-line-matchmaking');
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

  const handleDefenseLineReady = useCallback((side: 'a' | 'b') => {
    setDefenseLineSide(side);
    setMode('defense-line');
  }, []);

  const handleExitDefenseLine = useCallback(() => {
    setMode('menu');
  }, []);

  const handleCancelMatchmaking = useCallback(() => {
    setMode('menu');
  }, []);

  // Challenge handlers
  const handleChallenge = useCallback(async (friendUserId: string, friendUsername: string) => {
    try {
      await sendChallenge(friendUserId, friendUsername, playerId);
    } catch (error) {
      console.error('[APP] Failed to send challenge:', error);
      alert('Failed to send challenge. Please try again.');
    }
  }, [playerId, sendChallenge]);

  const handleCancelChallenge = useCallback(async (challengeId: string) => {
    audioManager.playSfx('button_click');
    await cancelChallenge(challengeId, playerId);
  }, [cancelChallenge, playerId]);

  const handleNavigate = useCallback((path: string, options?: any) => {
    console.log('[APP] Navigation triggered:', path, options);

    // Parse roomId from path (format: /game?roomId=xxx&mode=friend)
    const url = new URL(path, window.location.origin);
    const roomId = url.searchParams.get('roomId');
    const opponentId = options?.state?.opponentId;

    if (roomId && opponentId) {
      console.log('[APP] Setting up game match:', { roomId, playerId, opponentId });
      clearChallenges();
      setGameMatch({
        roomId,
        player1Id: playerId,
        player2Id: opponentId,
      });
      setMode('multiplayer');
    } else {
      console.error('[APP] Missing roomId or opponentId:', { roomId, opponentId });
    }
  }, [playerId, clearChallenges]);

  return (
    <>
      {/* Challenge notifications */}
      <ChallengeNotification userId={playerId} onNavigate={handleNavigate} />
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
        <TetrisGame onExit={handleExitGame} currentTheme={currentTheme} />
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

      {mode === 'defense-line-matchmaking' && (
        <DefenseLineMatchmaking
          playerId={playerId}
          theme={currentTheme}
          onCancel={handleCancelMatchmaking}
          onMatchReady={handleDefenseLineReady}
        />
      )}

      {mode === 'defense-line' && (
        <DefenseLineGame
          playerId={playerId}
          assignedSide={defenseLineSide}
          theme={currentTheme}
          onExit={handleExitDefenseLine}
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

function MockGameDemo() {
  const { theme } = useTheme();
  const currentTheme = toLegacyTheme(theme);
  const now = Date.now();
  const mockProfile: UserProfile = {
    userId: 'mock_player_001',
    username: 'LayoutTester',
    coins: 99999,
    matchmakingRating: 1420,
    gamesPlayed: 240,
    gamesWon: 133,
    lastActiveAt: now,
    unlockedAbilities: ABILITY_IDS,
    loadout: ['earthquake', 'ink_splash', 'wide_load', 'tilt', 'magnet', 'screen_shake'],
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    updatedAt: now,
  };

  return (
    <ServerAuthMultiplayerGame
      roomId="mock_room_layout"
      playerId={mockProfile.userId}
      opponentId="mock_opponent_001"
      theme={currentTheme}
      profile={mockProfile}
      onExit={() => {
        window.location.href = window.location.pathname;
      }}
      mockMode
    />
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

  if (demoMode === 'bg') {
    return (
      <ThemeProvider userId="preview">
        <TetriminoBgPreviewAll />
      </ThemeProvider>
    );
  }

  if (demoMode === 'game') {
    return (
      <ThemeProvider userId="preview-game-layout">
        <MockGameDemo />
      </ThemeProvider>
    );
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
