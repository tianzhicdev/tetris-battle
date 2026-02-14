import { useEffect, useState } from 'react';
import { PartykitMatchmaking } from '../services/partykit/matchmaking';

interface MatchmakingProps {
  playerId: string;
  onMatchFound: (roomId: string, player1Id: string, player2Id: string, aiOpponent?: any) => void;
  onCancel: () => void;
  theme: any;
}

export function Matchmaking({ playerId, onMatchFound, onCancel, theme }: MatchmakingProps) {
  const [queuePosition, setQueuePosition] = useState<number>(-1);
  const [queueDuration, setQueueDuration] = useState<number>(0);
  const [dots, setDots] = useState('');
  const [matchmaking] = useState(() => {
    const host = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';
    return new PartykitMatchmaking(playerId, host);
  });

  useEffect(() => {
    // Animated dots
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Track queue duration
    const start = Date.now();
    const interval = setInterval(() => {
      setQueueDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    matchmaking.connect(
      (roomId, player1, player2, aiOpponent) => {
        console.log('Match found:', roomId, player1, player2, aiOpponent ? '(AI Match)' : '');
        onMatchFound(roomId, player1, player2, aiOpponent);
      },
      (position) => {
        setQueuePosition(position);
      }
    );

    return () => {
      matchmaking.disconnect();
    };
  }, [matchmaking, onMatchFound]);

  const handleCancel = () => {
    matchmaking.leaveQueue();
    matchmaking.disconnect();
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: 'clamp(20px, 5vw, 40px)',
      }}
    >
      <div
        style={{
          background: 'rgba(10, 10, 30, 0.95)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 'clamp(12px, 3vw, 16px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          padding: 'clamp(30px, 7.5vw, 40px)',
          textAlign: 'center',
          minWidth: 'min(400px, 100%)',
          maxWidth: '500px',
        }}
      >
        <h2 style={{ marginBottom: 'clamp(25px, 6.25vw, 30px)', fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: '700', color: '#00d4ff', textShadow: '0 0 15px rgba(0, 212, 255, 0.6)' }}>
          Finding Opponent{dots}
        </h2>

        {/* Animated spinner */}
        <div
          style={{
            width: 'clamp(60px, 15vw, 80px)',
            height: 'clamp(60px, 15vw, 80px)',
            margin: 'clamp(25px, 6.25vw, 30px) auto',
            border: '6px solid rgba(255, 255, 255, 0.1)',
            borderTop: '6px solid #00d4ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
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
          <p style={{ fontSize: 'clamp(16px, 4vw, 18px)', marginBottom: 'clamp(15px, 3.75vw, 20px)', color: '#00ff88', fontWeight: '700', textShadow: '0 0 10px rgba(0, 255, 136, 0.5)' }}>
            Queue Position: #{queuePosition}
          </p>
        )}

        <p style={{ opacity: 0.8, marginBottom: 'clamp(25px, 6.25vw, 30px)', fontSize: 'clamp(14px, 3.5vw, 16px)', color: '#aaa', fontWeight: '600' }}>
          {queueDuration >= 18
            ? 'Expanding search...'
            : queuePosition === 1
            ? "You're next! Waiting for another player..."
            : 'Searching for a worthy opponent...'}
        </p>

        <button
          onClick={handleCancel}
          style={{
            padding: 'clamp(12px, 3vw, 15px) clamp(30px, 7.5vw, 40px)',
            fontSize: 'clamp(16px, 4vw, 18px)',
            background: 'rgba(10, 10, 30, 0.6)',
            backdropFilter: 'blur(20px)',
            color: '#ff6e6e',
            border: '1px solid rgba(255, 110, 110, 0.4)',
            borderRadius: 'clamp(6px, 1.5vw, 8px)',
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: '700',
            boxShadow: '0 4px 15px rgba(255, 110, 110, 0.2)',
            transition: 'all 0.2s ease',
            textShadow: '0 0 10px rgba(255, 110, 110, 0.5)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
