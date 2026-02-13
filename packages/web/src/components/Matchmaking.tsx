import { useEffect, useState } from 'react';
import { MatchmakingService } from '../services/matchmaking';
import type { GameRoom } from '../lib/supabase';

interface MatchmakingProps {
  playerId: string;
  onMatchFound: (room: GameRoom) => void;
  onCancel: () => void;
  theme: any;
}

export function Matchmaking({ playerId, onMatchFound, onCancel, theme }: MatchmakingProps) {
  const [queuePosition, setQueuePosition] = useState<number>(-1);
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Animated dots
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let pollInterval: any;
    let unsubscribe: (() => void) | null = null;

    const startMatchmaking = async () => {
      try {
        // Join queue
        await MatchmakingService.joinQueue(playerId);

        // Poll for matches every 2 seconds
        pollInterval = setInterval(async () => {
          const room = await MatchmakingService.checkForMatch(playerId);
          if (room) {
            clearInterval(pollInterval);
            if (unsubscribe) unsubscribe();
            onMatchFound(room);
          }

          // Update queue position
          const pos = await MatchmakingService.getQueuePosition(playerId);
          setQueuePosition(pos);
        }, 2000);

        // Also subscribe to real-time updates
        unsubscribe = MatchmakingService.subscribeToQueue(playerId, (room) => {
          clearInterval(pollInterval);
          if (unsubscribe) unsubscribe();
          onMatchFound(room);
        });
      } catch (error) {
        console.error('Matchmaking error:', error);
      }
    };

    startMatchmaking();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (unsubscribe) unsubscribe();
      MatchmakingService.leaveQueue(playerId);
    };
  }, [playerId, onMatchFound]);

  const handleCancel = async () => {
    await MatchmakingService.leaveQueue(playerId);
    onCancel();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          backgroundColor: theme.uiBackgroundColor,
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center',
          minWidth: '400px',
        }}
      >
        <h2 style={{ marginBottom: '30px', fontSize: '2rem' }}>
          Finding Opponent{dots}
        </h2>

        {/* Animated spinner */}
        <div
          style={{
            width: '80px',
            height: '80px',
            margin: '30px auto',
            border: `8px solid ${theme.gridColor}`,
            borderTop: `8px solid ${theme.colors.I}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>

        {queuePosition > 0 && (
          <p style={{ fontSize: '18px', marginBottom: '20px' }}>
            Queue Position: #{queuePosition}
          </p>
        )}

        <p style={{ opacity: 0.7, marginBottom: '30px' }}>
          {queuePosition === 1
            ? "You're next! Waiting for another player..."
            : 'Searching for a worthy opponent...'}
        </p>

        <button
          onClick={handleCancel}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: theme.colors.Z,
            color: '#ffffff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
