import { useEffect, useState } from 'react';
import { PartykitMatchmaking } from '../services/partykit/matchmaking';

interface MatchmakingProps {
  playerId: string;
  onMatchFound: (roomId: string, player1Id: string, player2Id: string) => void;
  onCancel: () => void;
  theme: any;
}

export function Matchmaking({ playerId, onMatchFound, onCancel, theme }: MatchmakingProps) {
  const [queuePosition, setQueuePosition] = useState<number>(-1);
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
    matchmaking.connect(
      (roomId, player1, player2) => {
        console.log('Match found:', roomId, player1, player2);
        onMatchFound(roomId, player1, player2);
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
