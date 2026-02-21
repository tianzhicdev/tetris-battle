import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { normalizePartykitHost } from '../services/partykit/host';
import {
  DefenseLineRenderer,
  type DefenseLineGameState,
  type DefenseLinePlayer,
} from './DefenseLineRenderer';

interface DefenseLineGameProps {
  playerId: string;
  assignedSide: DefenseLinePlayer;
  theme: any;
  onExit: () => void;
}

const ROOM_ID = 'global-v5';

export function DefenseLineGame({ playerId, assignedSide, theme, onExit }: DefenseLineGameProps) {
  const [state, setState] = useState<DefenseLineGameState | null>(null);
  const [playerSide, setPlayerSide] = useState<DefenseLinePlayer | null>(assignedSide);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<DefenseLinePlayer | null>(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);

    const socket = new PartySocket({
      host,
      party: 'defenseline',
      room: ROOM_ID,
    });

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnected(true);
      socket.send(JSON.stringify({
        type: 'join',
        playerId,
      }));
    });

    socket.addEventListener('close', () => {
      setConnected(false);
    });

    socket.addEventListener('message', (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === 'join_ack' && (data.player === 'a' || data.player === 'b')) {
        setPlayerSide(data.player);
        return;
      }

      if (data.type === 'countdown' && typeof data.seconds === 'number') {
        setCountdown(data.seconds);
        return;
      }

      if (data.type === 'state' && data.state) {
        setState(data.state as DefenseLineGameState);
        if (data.state.status === 'playing') {
          setCountdown(null);
        }
        if (data.state.winner) {
          setWinner(data.state.winner as DefenseLinePlayer);
        }
        return;
      }

      if (data.type === 'win' && (data.winner === 'a' || data.winner === 'b')) {
        setWinner(data.winner);
        return;
      }

    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [playerId, assignedSide]);

  const sendInput = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!playerSide || !state || state.status !== 'playing') {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        sendInput({ type: 'move', direction: 'left' });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        sendInput({ type: 'move', direction: 'right' });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        sendInput({ type: 'rotate', direction: 'cw' });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        sendInput({ type: 'soft_drop' });
      } else if (event.code === 'Space') {
        event.preventDefault();
        sendInput({ type: 'hard_drop' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playerSide, sendInput, state]);


  const scoreText = useMemo(() => {
    if (!state || !playerSide) {
      return 'A: 0 | B: 0';
    }

    const a = state.playerA.rowsCleared;
    const b = state.playerB.rowsCleared;

    if (playerSide === 'a') {
      return `You: ${a} | Opponent: ${b}`;
    }

    return `You: ${b} | Opponent: ${a}`;
  }, [playerSide, state]);

  return (
    <div
      style={{
        minHeight: '100vh',
        height: '100vh',
        background: theme.backgroundColor,
        color: theme.textColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '4px',
        padding: '8px 0',
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', width: 'min(440px, 90vw)', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onExit}
          style={{
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.3)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <div style={{ fontSize: '13px', opacity: 0.85 }}>
          {connected ? 'Connected' : 'Connecting...'} {playerSide ? `as ${playerSide.toUpperCase()}` : ''}
        </div>
      </div>

      <h2 style={{ margin: 0, color: '#f5f5f5', fontSize: '18px' }}>Defense Line</h2>
      <div style={{ fontSize: '13px', color: '#ddd' }}>{scoreText}</div>

      {countdown !== null && countdown > 0 && (
        <div style={{ fontSize: '18px', color: '#ffd166', fontWeight: 700 }}>Starting in {countdown}</div>
      )}

      {winner && (
        <div style={{ fontSize: '18px', color: '#7bff9b', fontWeight: 700 }}>
          {playerSide === winner ? 'You Win' : 'You Lose'}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        {state && playerSide ? (
          <DefenseLineRenderer
            state={state}
            viewAs={playerSide}
          />
        ) : (
          <div style={{ opacity: 0.8 }}>Waiting for game state...</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', width: '100%', maxWidth: '100vw', padding: '0 12px' }}>
        <button
          onClick={() => sendInput({ type: 'move', direction: 'left' })}
          style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
        >
          ◀
        </button>
        <button
          onClick={() => sendInput({ type: 'hard_drop' })}
          style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, background: 'rgba(0,212,255,0.2)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: '6px', cursor: 'pointer', color: '#00d4ff' }}
        >
          ⏬
        </button>
        <button
          onClick={() => sendInput({ type: 'soft_drop' })}
          style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
        >
          ▼
        </button>
        <button
          onClick={() => sendInput({ type: 'rotate', direction: 'cw' })}
          style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
        >
          ↻
        </button>
        <button
          onClick={() => sendInput({ type: 'move', direction: 'right' })}
          style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
