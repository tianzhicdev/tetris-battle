import { useEffect, useState, useCallback, useRef } from 'react';
import { PartykitMatchmaking } from '../services/partykit/matchmaking';
import { normalizePartykitHost } from '../services/partykit/host';

interface MatchmakingProps {
  playerId: string;
  rank: number;
  onMatchFound: (roomId: string, player1Id: string, player2Id: string, aiOpponent?: any) => void;
  onCancel: () => void;
  theme: any;
}

interface WebSocketEvent {
  timestamp: number;
  type: 'sent' | 'received' | 'status';
  data: any;
}

export function Matchmaking({ playerId, rank, onMatchFound, onCancel, theme }: MatchmakingProps) {
  const [queuePosition, setQueuePosition] = useState<number>(-1);
  const [queueDuration, setQueueDuration] = useState<number>(0);
  const [dots, setDots] = useState('');
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [wsEvents, setWsEvents] = useState<WebSocketEvent[]>([]);
  const matchmakingRef = useRef<PartykitMatchmaking | null>(null);
  const onMatchFoundRef = useRef(onMatchFound);

  // Initialize debug mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.get('debug') === 'true';
    setIsDebugMode(debugEnabled);
  }, []);

  // Helper to add WebSocket event to debug log
  const addWsEvent = useCallback((type: 'sent' | 'received' | 'status', data: any) => {
    setWsEvents(prev => [...prev.slice(-19), { timestamp: Date.now(), type, data }]);
  }, []);

  useEffect(() => {
    onMatchFoundRef.current = onMatchFound;
  }, [onMatchFound]);

  // Initialize matchmaking service
  if (!matchmakingRef.current) {
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
    matchmakingRef.current = new PartykitMatchmaking(playerId, host, rank, addWsEvent);
  }
  const matchmaking = matchmakingRef.current;

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
        onMatchFoundRef.current(roomId, player1, player2, aiOpponent);
      },
      (position) => {
        setQueuePosition(position);
      },
      (status) => {
        setWsStatus(status);
        if (status !== 'connected') {
          setQueuePosition(-1);
        }
      }
    );

    return () => {
      matchmaking.disconnect();
    };
  }, [matchmaking]);

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

      {/* Debug Panel */}
      {isDebugMode && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          borderRadius: '8px',
          padding: '16px',
          maxWidth: '400px',
          maxHeight: '60vh',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#00ff88',
          boxShadow: '0 8px 32px rgba(0, 212, 255, 0.3)',
          zIndex: 1000,
        }}>
          <div style={{
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
            fontWeight: 'bold',
            color: '#00d4ff',
          }}>
            🐛 Matchmaking Debug
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#aaa' }}>Connection Status:</span>{' '}
              <span style={{
                color: wsStatus === 'connected' ? '#00ff88' : wsStatus === 'connecting' ? '#ffa500' : '#ff6e6e',
                fontWeight: 'bold'
              }}>
                {wsStatus.toUpperCase()}
              </span>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#aaa' }}>Queue Position:</span>{' '}
              <span style={{ color: '#00d4ff', fontWeight: 'bold' }}>
                {queuePosition > 0 ? `#${queuePosition}` : '-'}
              </span>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#aaa' }}>Time Waiting:</span>{' '}
              <span style={{ color: '#c942ff', fontWeight: 'bold' }}>
                {queueDuration}s
              </span>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#aaa' }}>Player ID:</span>{' '}
              <span style={{ color: '#fff', fontSize: '10px' }}>
                {playerId}
              </span>
            </div>
            <div>
              <span style={{ color: '#aaa' }}>Rank:</span>{' '}
              <span style={{ color: '#ffd700', fontWeight: 'bold' }}>
                {rank}
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(0, 212, 255, 0.3)'
          }}>
            <div style={{
              marginBottom: '8px',
              color: '#00d4ff',
              fontWeight: 'bold'
            }}>
              WebSocket Events ({wsEvents.length})
            </div>
            <div style={{
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '10px'
            }}>
              {wsEvents.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No events yet...</div>
              ) : (
                wsEvents.slice().reverse().map((event, idx) => {
                  const time = new Date(event.timestamp).toLocaleTimeString();
                  const color = event.type === 'sent' ? '#ffa500' : event.type === 'received' ? '#00ff88' : '#00d4ff';
                  return (
                    <div key={idx} style={{
                      marginBottom: '8px',
                      padding: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderLeft: `3px solid ${color}`,
                      borderRadius: '4px'
                    }}>
                      <div style={{ color: '#aaa', marginBottom: '4px' }}>
                        {time} <span style={{ color, fontWeight: 'bold' }}>[{event.type.toUpperCase()}]</span>
                      </div>
                      <div style={{ color: '#fff', wordBreak: 'break-all' }}>
                        {JSON.stringify(event.data, null, 2)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
