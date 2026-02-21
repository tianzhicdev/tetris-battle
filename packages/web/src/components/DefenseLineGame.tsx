import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { TETROMINO_SHAPES, type TetrominoType } from '@tetris-battle/game-core';
import { normalizePartykitHost } from '../services/partykit/host';
import { NextPiecePanel } from './NextPiecePanel';
import { FloatingBackground } from './FloatingBackground';
import { audioManager } from '../services/audioManager';

type DefenseLinePlayer = 'a' | 'b';
type DefenseLineCell = '0' | 'x' | 'a' | 'b';

interface DefenseLinePiece {
  type: TetrominoType;
  rotation: number;
  row: number;
  col: number;
}

interface DefenseLinePlayerState {
  activePiece: DefenseLinePiece | null;
  nextPiece: TetrominoType;
  rowsCleared: number;
  queue: TetrominoType[];
}

interface DefenseLineGameState {
  board: DefenseLineCell[][];
  activeRows: number[];
  playerA: DefenseLinePlayerState;
  playerB: DefenseLinePlayerState;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  winner: DefenseLinePlayer | null;
}

interface DefenseLineGameProps {
  playerId: string;
  roomId: string;
  theme: any;
  onExit: () => void;
}

const BOARD_ROWS = 40;
const BOARD_COLS = 10;
const DIVIDER_ROW = 20;
const MAIN_CANVAS_WIDTH = 250;
const MAIN_CANVAS_HEIGHT = 1000;
const OPPONENT_CANVAS_WIDTH = 80;
const OPPONENT_CANVAS_HEIGHT = 320;
const TICK_MS = 700;

function getPieceCells(piece: DefenseLinePiece | null): Array<[number, number]> {
  if (!piece) return [];
  const shapes = TETROMINO_SHAPES[piece.type];
  if (!shapes || shapes.length === 0) return [];
  const rotation = ((piece.rotation % shapes.length) + shapes.length) % shapes.length;
  const shape = shapes[rotation];
  const cells: Array<[number, number]> = [];

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] === 1) {
        cells.push([piece.row + row, piece.col + col]);
      }
    }
  }

  return cells;
}

function buildPieceLookup(piece: DefenseLinePiece | null): Set<string> {
  const set = new Set<string>();
  for (const [row, col] of getPieceCells(piece)) {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) continue;
    set.add(`${row}:${col}`);
  }
  return set;
}

function mapToActual(visualRow: number, visualCol: number, viewAs: DefenseLinePlayer): [number, number] {
  if (viewAs === 'a') return [visualRow, visualCol];
  return [BOARD_ROWS - 1 - visualRow, BOARD_COLS - 1 - visualCol];
}

function isFilledForViewer(cell: DefenseLineCell, viewAs: DefenseLinePlayer): boolean {
  return viewAs === 'a'
    ? cell === 'a' || cell === 'x'
    : cell === 'b' || cell === '0';
}

function blockTypeForCell(cell: DefenseLineCell, viewAs: DefenseLinePlayer): TetrominoType {
  if (viewAs === 'a') {
    return cell === 'a' ? 'I' : 'J';
  }
  return cell === 'b' ? 'Z' : 'L';
}

function drawDefenseBoard(
  canvas: HTMLCanvasElement | null,
  state: DefenseLineGameState,
  viewAs: DefenseLinePlayer,
  theme: any
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cellSize = canvas.width / BOARD_COLS;
  const aActive = buildPieceLookup(state.playerA.activePiece);
  const bActive = buildPieceLookup(state.playerB.activePiece);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(5, 5, 20, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let visualRow = 0; visualRow < BOARD_ROWS; visualRow++) {
    for (let visualCol = 0; visualCol < BOARD_COLS; visualCol++) {
      const [row, col] = mapToActual(visualRow, visualCol, viewAs);
      const key = `${row}:${col}`;
      let cell = state.board[row]?.[col] ?? (row < DIVIDER_ROW ? '0' : 'x');

      if (aActive.has(key)) cell = 'a';
      if (bActive.has(key)) cell = 'b';

      if (!isFilledForViewer(cell, viewAs)) continue;

      const blockType = blockTypeForCell(cell, viewAs);
      const x = visualCol * cellSize;
      const y = visualRow * cellSize;
      if (typeof theme?.renderBlock === 'function') {
        theme.renderBlock(ctx, x, y, cellSize, blockType);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= BOARD_COLS; x++) {
    const drawX = x * cellSize;
    ctx.beginPath();
    ctx.moveTo(drawX, 0);
    ctx.lineTo(drawX, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= BOARD_ROWS; y++) {
    const drawY = y * cellSize;
    ctx.beginPath();
    ctx.moveTo(0, drawY);
    ctx.lineTo(canvas.width, drawY);
    ctx.stroke();
  }

  const dividerY = (BOARD_ROWS / 2) * cellSize;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = Math.max(1, cellSize * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, dividerY);
  ctx.lineTo(canvas.width, dividerY);
  ctx.stroke();
}

function playClearSound(clearedRows: number): void {
  if (clearedRows >= 4) {
    audioManager.playSfx('line_clear_tetris', 0.75);
  } else if (clearedRows === 3) {
    audioManager.playSfx('line_clear_triple', 0.75);
  } else if (clearedRows === 2) {
    audioManager.playSfx('line_clear_double', 0.75);
  } else if (clearedRows === 1) {
    audioManager.playSfx('line_clear_single', 0.75);
  }
}

export function DefenseLineGame({ playerId, roomId, theme, onExit }: DefenseLineGameProps) {
  const [state, setState] = useState<DefenseLineGameState | null>(null);
  const [playerSide, setPlayerSide] = useState<DefenseLinePlayer | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<DefenseLinePlayer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastStateAtMs, setLastStateAtMs] = useState<number | null>(null);
  const [selfBoardKick, setSelfBoardKick] = useState(false);
  const [layoutBlast, setLayoutBlast] = useState(false);

  const socketRef = useRef<PartySocket | null>(null);
  const playerSideRef = useRef<DefenseLinePlayer | null>(null);
  const selfKickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutBlastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);

  const yourState = useMemo(() => {
    if (!state || !playerSide) return null;
    return playerSide === 'a' ? state.playerA : state.playerB;
  }, [state, playerSide]);

  const opponentState = useMemo(() => {
    if (!state || !playerSide) return null;
    return playerSide === 'a' ? state.playerB : state.playerA;
  }, [state, playerSide]);

  const nextPieces = useMemo(() => {
    if (!yourState) return [];
    return [yourState.nextPiece, ...yourState.queue.slice(0, 4)];
  }, [yourState]);

  const yourRowsCleared = yourState?.rowsCleared ?? 0;
  const opponentRowsCleared = opponentState?.rowsCleared ?? 0;
  const totalRowsCleared = yourRowsCleared + opponentRowsCleared;

  const syncAgeMs = useMemo(() => {
    if (!lastStateAtMs) return null;
    return Math.max(0, nowMs - lastStateAtMs);
  }, [lastStateAtMs, nowMs]);

  const connectionDot = useMemo(() => {
    if (!isConnected) return '#ef4444';
    if (syncAgeMs === null) return '#fbbf24';
    if (syncAgeMs < TICK_MS) return '#4ade80';
    if (syncAgeMs < TICK_MS * 2) return '#fbbf24';
    return '#fb923c';
  }, [isConnected, syncAgeMs]);

  const triggerClearBlast = useCallback((clearedBySelf: boolean) => {
    if (layoutBlastTimeoutRef.current) {
      clearTimeout(layoutBlastTimeoutRef.current);
      layoutBlastTimeoutRef.current = null;
    }
    setLayoutBlast(true);
    layoutBlastTimeoutRef.current = setTimeout(() => setLayoutBlast(false), 220);

    if (clearedBySelf) {
      if (selfKickTimeoutRef.current) {
        clearTimeout(selfKickTimeoutRef.current);
        selfKickTimeoutRef.current = null;
      }
      setSelfBoardKick(true);
      selfKickTimeoutRef.current = setTimeout(() => setSelfBoardKick(false), 160);
    }
  }, []);

  const sendInput = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }, []);

  const handleMoveLeft = useCallback(() => {
    audioManager.playSfx('piece_move_left', 0.3);
    sendInput({ type: 'move', direction: 'left' });
  }, [sendInput]);

  const handleMoveRight = useCallback(() => {
    audioManager.playSfx('piece_move_right', 0.3);
    sendInput({ type: 'move', direction: 'right' });
  }, [sendInput]);

  const handleRotate = useCallback(() => {
    audioManager.playSfx('piece_rotate', 0.45);
    sendInput({ type: 'rotate', direction: 'cw' });
  }, [sendInput]);

  const handleSoftDrop = useCallback(() => {
    audioManager.playSfx('soft_drop', 0.4);
    sendInput({ type: 'soft_drop' });
  }, [sendInput]);

  const handleHardDrop = useCallback(() => {
    audioManager.playSfx('hard_drop', 0.65);
    sendInput({ type: 'hard_drop' });
  }, [sendInput]);

  useEffect(() => {
    playerSideRef.current = playerSide;
  }, [playerSide]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
    const socket = new PartySocket({
      host,
      party: 'defenseline',
      room: roomId,
    });
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setIsConnected(true);
      socket.send(JSON.stringify({ type: 'join', playerId }));
    });

    socket.addEventListener('close', () => {
      setIsConnected(false);
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

      if (data.type === 'clear') {
        const rows = Array.isArray(data.rows) ? data.rows.length : 0;
        if (rows > 0) {
          playClearSound(rows);
          triggerClearBlast(playerSideRef.current !== null && data.player === playerSideRef.current);
        }
        return;
      }

      if (data.type === 'state' && data.state) {
        setState(data.state as DefenseLineGameState);
        setLastStateAtMs(Date.now());
        if (data.state.status === 'playing') {
          setCountdown(null);
        }
        if (data.state.winner === 'a' || data.state.winner === 'b') {
          setWinner(data.state.winner);
        }
        return;
      }

      if (data.type === 'win' && (data.winner === 'a' || data.winner === 'b')) {
        setWinner(data.winner);
      }
    });

    return () => {
      if (selfKickTimeoutRef.current) clearTimeout(selfKickTimeoutRef.current);
      if (layoutBlastTimeoutRef.current) clearTimeout(layoutBlastTimeoutRef.current);
      socket.close();
      socketRef.current = null;
    };
  }, [playerId, roomId, triggerClearBlast]);

  useEffect(() => {
    if (!state || !playerSide) return;
    drawDefenseBoard(mainCanvasRef.current, state, playerSide, theme);
    const opponentSide: DefenseLinePlayer = playerSide === 'a' ? 'b' : 'a';
    drawDefenseBoard(opponentCanvasRef.current, state, opponentSide, theme);
  }, [state, playerSide, theme, selfBoardKick]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!playerSide || !state || state.status !== 'playing') return;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handleMoveLeft();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleMoveRight();
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          event.preventDefault();
          handleRotate();
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleSoftDrop();
          break;
        case ' ':
          event.preventDefault();
          handleHardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleHardDrop, handleMoveLeft, handleMoveRight, handleRotate, handleSoftDrop, playerSide, state]);

  const statusText = winner
    ? (playerSide === winner ? 'YOU WIN' : 'YOU LOSE')
    : countdown !== null && countdown > 0
    ? `START IN ${countdown}`
    : !isConnected
    ? 'CONNECTING'
    : state?.status === 'playing'
    ? 'IN MATCH'
    : 'WAITING';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 50%, #0f0a1e 100%)',
        color: '#ffffff',
        fontFamily: '"Orbitron", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <FloatingBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 7,
          paddingTop: 'max(12px, calc(env(safe-area-inset-top) + 8px))',
          paddingLeft: 'clamp(8px, 2vw, 14px)',
          paddingRight: 'clamp(8px, 2vw, 14px)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 'clamp(8px, 1.6vw, 16px)',
            alignItems: 'start',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {[
            {
              label: 'YOU ROWS',
              value: yourRowsCleared,
              color: '#67eaff',
              glow: '0 0 10px rgba(0, 212, 255, 0.6), 0 0 20px rgba(0, 212, 255, 0.28)',
            },
            {
              label: 'OPP ROWS',
              value: opponentRowsCleared,
              color: '#df82ff',
              glow: '0 0 10px rgba(201, 66, 255, 0.58), 0 0 20px rgba(201, 66, 255, 0.24)',
            },
            {
              label: 'TOTAL',
              value: totalRowsCleared,
              color: '#7dffb0',
              glow: '0 0 10px rgba(0, 255, 136, 0.55), 0 0 20px rgba(0, 255, 136, 0.22)',
            },
          ].map((stat) => (
            <div key={stat.label} style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '9px',
                  lineHeight: 1,
                  letterSpacing: '3px',
                  color: 'rgba(255,255,255,0.3)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 'clamp(30px, 7.6vw, 84px)',
                  lineHeight: 0.86,
                  fontWeight: 900,
                  letterSpacing: '-1px',
                  color: stat.color,
                  textShadow: stat.glow,
                  whiteSpace: 'nowrap',
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onExit}
          title="Exit match"
          aria-label="Exit match"
          style={{
            position: 'absolute',
            top: 'calc(max(12px, calc(env(safe-area-inset-top) + 8px)) + 2px)',
            right: 'clamp(8px, 2vw, 14px)',
            zIndex: 8,
            background: 'transparent',
            border: 'none',
            padding: '2px',
            margin: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            lineHeight: 1,
            color: 'rgba(255,255,255,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              display: 'inline-block',
              background: connectionDot,
              boxShadow: '0 0 6px rgba(74, 222, 128, 0.5)',
            }}
          />
          <span
            style={{
              fontSize: '8px',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.2px',
              whiteSpace: 'nowrap',
            }}
          >
            {syncAgeMs !== null ? `${Math.round(syncAgeMs)}ms` : '--'}
          </span>
        </button>

        <div
          style={{
            position: 'absolute',
            top: 'calc(max(12px, calc(env(safe-area-inset-top) + 8px)) + 2px)',
            left: 'clamp(8px, 2vw, 14px)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(8, 12, 20, 0.74)',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.6px',
            color: winner ? '#7dffb0' : countdown !== null && countdown > 0 ? '#ffd166' : 'rgba(255,255,255,0.82)',
            textTransform: 'uppercase',
          }}
        >
          {statusText}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
          padding: 'clamp(4px, 0.8vh, 8px) clamp(4px, 0.8vw, 8px) clamp(6px, 1vh, 10px)',
          gap: 'clamp(2px, 0.5vw, 4px)',
          transform: layoutBlast ? 'translateY(4px)' : 'translateY(0)',
          transition: 'transform 180ms ease-out',
        }}
      >
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0, justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', maxHeight: '100%' }}>
            {nextPieces.length > 0 && <NextPiecePanel nextPieces={nextPieces} />}
            <div
              style={{
                position: 'relative',
                maxHeight: '100%',
                height: '100%',
                background: 'rgba(5, 5, 20, 0.75)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius: 'clamp(6px, 1.5vw, 10px)',
                transform: selfBoardKick ? 'translateY(-4px)' : 'translateY(0)',
                transition: 'transform 160ms ease-out',
              }}
            >
              <canvas
                ref={mainCanvasRef}
                width={MAIN_CANVAS_WIDTH}
                height={MAIN_CANVAS_HEIGHT}
                style={{
                  display: 'block',
                  border: '1px solid rgba(0, 240, 240, 0.15)',
                  backgroundColor: 'transparent',
                  maxHeight: '100%',
                  height: '100%',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 'clamp(6px, 1.5vw, 10px)',
                  boxShadow: '0 0 20px rgba(0, 240, 240, 0.08), 0 0 60px rgba(0, 240, 240, 0.03)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'clamp(6px, 1.5vw, 10px)',
                  pointerEvents: 'none',
                  background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,10,24,0.6) 100%)',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            width: 'clamp(85px, 22vw, 110px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(4px, 1vh, 8px)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'transparent',
              padding: 'clamp(4px, 1vw, 6px)',
              borderRadius: 'clamp(6px, 1.5vw, 10px)',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 'clamp(65px, 17vw, 80px)',
                height: 'clamp(180px, 46vw, 260px)',
              }}
            >
              <canvas
                ref={opponentCanvasRef}
                width={OPPONENT_CANVAS_WIDTH}
                height={OPPONENT_CANVAS_HEIGHT}
                style={{
                  display: 'block',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(5, 5, 20, 0.72)',
                  width: '100%',
                  height: '100%',
                  borderRadius: 'clamp(4px, 1vw, 6px)',
                  boxShadow: '0 0 8px rgba(255, 255, 255, 0.08)',
                }}
              />
            </div>
            <div
              style={{
                marginTop: '3px',
                padding: '3px 6px',
                background: 'transparent',
                borderRadius: '4px',
                fontSize: 'clamp(6px, 1.5vw, 8px)',
                textAlign: 'center',
                fontWeight: 700,
              }}
            >
              <div style={{ color: '#ff006e', textShadow: '0 0 8px rgba(255, 0, 110, 0.8)' }}>
                OPP {opponentRowsCleared}
              </div>
              <div style={{ color: '#c942ff', textShadow: '0 0 8px rgba(201, 66, 255, 0.8)' }}>
                YOU {yourRowsCleared}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              width: 'clamp(65px, 17vw, 80px)',
              maxWidth: 'clamp(65px, 17vw, 80px)',
              alignSelf: 'center',
              overflowY: 'auto',
            }}
          >
            {countdown !== null && countdown > 0 && (
              <div
                style={{
                  background: 'rgba(26, 16, 5, 0.86)',
                  border: '1px solid rgba(255, 196, 92, 0.34)',
                  borderRadius: '5px',
                  padding: '4px',
                  fontSize: '8px',
                  color: '#ffd176',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '0.4px',
                }}
              >
                START {countdown}
              </div>
            )}

            {winner && (
              <div
                style={{
                  background: playerSide === winner ? 'rgba(6, 28, 16, 0.86)' : 'rgba(30, 8, 14, 0.86)',
                  border: playerSide === winner
                    ? '1px solid rgba(0, 255, 136, 0.34)'
                    : '1px solid rgba(255, 0, 110, 0.34)',
                  borderRadius: '5px',
                  padding: '4px',
                  fontSize: '8px',
                  color: playerSide === winner ? '#7dffb0' : '#ff7aa9',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '0.4px',
                }}
              >
                {playerSide === winner ? 'YOU WIN' : 'YOU LOSE'}
              </div>
            )}

            <div
              style={{
                background: 'rgba(8, 12, 22, 0.85)',
                border: '1px solid rgba(0, 212, 255, 0.24)',
                borderRadius: '5px',
                padding: '4px',
                fontSize: '8px',
                color: '#7de3ff',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              SYNC {syncAgeMs !== null ? `${Math.round(syncAgeMs)}ms` : '--'}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          height: 'clamp(60px, 12vh, 80px)',
          display: 'flex',
          gap: 'clamp(4px, 1vw, 8px)',
          padding: 'clamp(6px, 1.5vw, 10px)',
          paddingBottom: 'calc(clamp(6px, 1.5vw, 10px) + max(2px, env(safe-area-inset-bottom)))',
          background: 'linear-gradient(180deg, rgba(8, 10, 18, 0.36) 0%, rgba(5, 7, 14, 0.68) 100%)',
          backdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {[
          { key: 'left', icon: '◀', onPress: handleMoveLeft },
          { key: 'hard', icon: '⏬', onPress: handleHardDrop },
          { key: 'down', icon: '▼', onPress: handleSoftDrop },
          { key: 'rotate', icon: '↻', onPress: handleRotate },
          { key: 'right', icon: '▶', onPress: handleMoveRight },
        ].map((control) => (
          <button
            key={control.key}
            onPointerDown={(event) => {
              event.preventDefault();
              control.onPress();
            }}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'clamp(8px, 2vw, 12px)',
              cursor: 'pointer',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              fontSize: 'clamp(18px, 4.5vw, 28px)',
              lineHeight: 1,
            }}
          >
            {control.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
