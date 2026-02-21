import { useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { normalizePartykitHost } from '../services/partykit/host';
import type { DefenseLinePlayer } from './DefenseLineRenderer';

interface DefenseLineMatchmakingProps {
  playerId: string;
  theme: any;
  onCancel: () => void;
  onMatchReady: (player: DefenseLinePlayer) => void;
}

const ROOM_ID = 'global-v5';

export function DefenseLineMatchmaking({ playerId, theme, onCancel, onMatchReady }: DefenseLineMatchmakingProps) {
  const [connected, setConnected] = useState(false);
  const [assignedSide, setAssignedSide] = useState<DefenseLinePlayer | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const socketRef = useRef<PartySocket | null>(null);
  const startedRef = useRef(false);
  const assignedSideRef = useRef<DefenseLinePlayer | null>(null);
  const onMatchReadyRef = useRef(onMatchReady);

  useEffect(() => {
    onMatchReadyRef.current = onMatchReady;
  }, [onMatchReady]);

  useEffect(() => {
    assignedSideRef.current = assignedSide;
  }, [assignedSide]);

  // Wait timer
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
      // Auto-join immediately — server assigns side
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
        setAssignedSide(data.player);
        return;
      }

      if (data.type === 'countdown') {
        setCountdown(typeof data.seconds === 'number' ? data.seconds : null);
        return;
      }

      if (data.type === 'state' && data.state?.status === 'playing' && !startedRef.current && assignedSideRef.current) {
        startedRef.current = true;
        onMatchReadyRef.current(assignedSideRef.current);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [playerId]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        background: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: 'monospace',
        padding: '24px',
      }}
    >
      <h2 style={{ margin: 0 }}>Defense Line</h2>
      <div style={{ opacity: 0.85 }}>
        {!connected ? 'Connecting...' : assignedSide ? `Joined as ${assignedSide.toUpperCase()}` : 'Joining...'}
      </div>

      {assignedSide && countdown === null && (
        <div style={{ fontSize: '14px', color: '#ccc' }}>
          Waiting for opponent... ({waitSeconds}s)
          {waitSeconds >= 7 && <div style={{ color: '#ffd166', marginTop: '4px' }}>AI opponent joining soon...</div>}
        </div>
      )}

      {countdown !== null && countdown > 0 && (
        <div style={{ fontSize: '22px', color: '#ffd166', fontWeight: 700 }}>
          Match starts in {countdown}
        </div>
      )}

      <button
        onClick={onCancel}
        style={{
          marginTop: '12px',
          border: '1px solid rgba(255,255,255,0.4)',
          background: 'rgba(0,0,0,0.25)',
          color: '#fff',
          borderRadius: '8px',
          padding: '10px 14px',
          cursor: 'pointer',
        }}
      >
        Back
      </button>
    </div>
  );
}
