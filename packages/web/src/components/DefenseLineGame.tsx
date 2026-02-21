import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { normalizePartykitHost } from '../services/partykit/host';
import {
  DefenseLineRenderer,
  canPlaceDefenseLinePiece,
  type DefenseLineGameState,
  type DefenseLinePiece,
  type DefenseLinePlayer,
} from './DefenseLineRenderer';

interface DefenseLineGameProps {
  playerId: string;
  preferredSide: DefenseLinePlayer | null;
  theme: any;
  onExit: () => void;
}

const ROOM_ID = 'global';

export function DefenseLineGame({ playerId, preferredSide, theme, onExit }: DefenseLineGameProps) {
  const [state, setState] = useState<DefenseLineGameState | null>(null);
  const [playerSide, setPlayerSide] = useState<DefenseLinePlayer | null>(preferredSide);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<DefenseLinePlayer | null>(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);

    const socket = new PartySocket({
      host,
      party: 'defense-line',
      room: ROOM_ID,
    });

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnected(true);
      socket.send(JSON.stringify({
        type: 'join',
        playerId,
        player: preferredSide ?? undefined,
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
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [playerId, preferredSide]);

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
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        sendInput({ type: 'rotate', direction: 'ccw' });
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

  const ghostPiece = useMemo(() => {
    if (!state || !playerSide) {
      return null;
    }

    const current = playerSide === 'a' ? state.playerA.activePiece : state.playerB.activePiece;
    if (!current) {
      return null;
    }

    const step = playerSide === 'a' ? 1 : -1;
    let ghost: DefenseLinePiece = { ...current };

    while (canPlaceDefenseLinePiece(state, playerSide, { ...ghost, row: ghost.row + step })) {
      ghost = { ...ghost, row: ghost.row + step };
    }

    return ghost;
  }, [playerSide, state]);

  const scoreText = useMemo(() => {
    if (!state || !playerSide) {
      return 'A: 0/10 | B: 0/10';
    }

    const a = state.playerA.rowsCleared;
    const b = state.playerB.rowsCleared;

    if (playerSide === 'a') {
      return `You ${a}/10 | Opponent ${b}/10`;
    }

    return `You ${b}/10 | Opponent ${a}/10`;
  }, [playerSide, state]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.backgroundColor,
        color: theme.textColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '24px 12px',
        fontFamily: 'monospace',
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

      <h2 style={{ margin: 0, color: '#f5f5f5' }}>Defense Line</h2>
      <div style={{ fontSize: '15px', color: '#ddd' }}>{scoreText}</div>

      {countdown !== null && countdown > 0 && (
        <div style={{ fontSize: '22px', color: '#ffd166', fontWeight: 700 }}>Starting in {countdown}</div>
      )}

      {winner && (
        <div style={{ fontSize: '22px', color: '#7bff9b', fontWeight: 700 }}>
          {playerSide === winner ? 'You Win' : 'You Lose'}
        </div>
      )}

      {state && playerSide ? (
        <DefenseLineRenderer
          state={state}
          viewAs={playerSide}
          ghostPiece={ghostPiece}
        />
      ) : (
        <div style={{ opacity: 0.8 }}>Waiting for game state...</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', width: 'min(360px, 90vw)' }}>
        <button onClick={() => sendInput({ type: 'move', direction: 'left' })}>Left</button>
        <button onClick={() => sendInput({ type: 'rotate', direction: 'cw' })}>Rotate</button>
        <button onClick={() => sendInput({ type: 'move', direction: 'right' })}>Right</button>
        <button onClick={() => sendInput({ type: 'soft_drop' })}>Soft Drop</button>
        <button onClick={() => sendInput({ type: 'rotate', direction: 'ccw' })}>CCW</button>
        <button onClick={() => sendInput({ type: 'hard_drop' })}>Hard Drop</button>
      </div>
    </div>
  );
}
