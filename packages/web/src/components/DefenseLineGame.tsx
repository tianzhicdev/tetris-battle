import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { TETROMINO_SHAPES, type TetrominoType } from '@tetris-battle/game-core';
import { normalizePartykitHost } from '../services/partykit/host';
import { NextPiecePanel } from './NextPiecePanel';
import { FloatingBackground } from './FloatingBackground';
import { audioManager } from '../services/audioManager';
import { useElementSize } from '../hooks/useElementSize';
import { computeBoardDisplaySize } from './game/boardDisplaySizing';

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
  onPlayAgain?: () => void;
}

const BOARD_ROWS = 20;
const BOARD_COLS = 10;
const DIVIDER_ROW = 10;
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

function computeGhostPiece(
  piece: DefenseLinePiece | null,
  board: DefenseLineCell[][],
  player: DefenseLinePlayer,
): DefenseLinePiece | null {
  if (!piece) return null;
  const step = player === 'a' ? 1 : -1;
  let ghost = { ...piece };

  while (true) {
    const candidate = { ...ghost, row: ghost.row + step };
    const cells = getPieceCells(candidate);
    let blocked = false;
    for (const [row, col] of cells) {
      if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
        blocked = true;
        break;
      }
      const cell = board[row]?.[col] ?? (row < DIVIDER_ROW ? '0' : 'x');
      const solid = player === 'a'
        ? (cell === 'a' || cell === 'x')
        : (cell === 'b' || cell === '0');
      if (solid) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
    ghost = candidate;
  }

  // Don't show ghost if it's in the same position as the active piece
  if (ghost.row === piece.row && ghost.col === piece.col) return null;
  return ghost;
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
  theme: any,
  ghostPiece?: DefenseLinePiece | null,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cellSize = canvas.width / BOARD_COLS;
  const aActive = buildPieceLookup(state.playerA.activePiece);
  const bActive = buildPieceLookup(state.playerB.activePiece);
  const ghostLookup = buildPieceLookup(ghostPiece ?? null);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(5, 5, 20, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw ghost piece first (underneath active pieces)
  for (let visualRow = 0; visualRow < BOARD_ROWS; visualRow++) {
    for (let visualCol = 0; visualCol < BOARD_COLS; visualCol++) {
      const [row, col] = mapToActual(visualRow, visualCol, viewAs);
      const key = `${row}:${col}`;
      if (!ghostLookup.has(key)) continue;
      // Skip cells where the active piece already is
      if (aActive.has(key) || bActive.has(key)) continue;

      const x = visualCol * cellSize;
      const y = visualRow * cellSize;
      const inset = cellSize * 0.12;
      ctx.strokeStyle = 'rgba(0, 240, 240, 0.35)';
      ctx.lineWidth = Math.max(1, cellSize * 0.06);
      ctx.strokeRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
    }
  }

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

export function DefenseLineGame({ playerId, roomId, theme, onExit, onPlayAgain }: DefenseLineGameProps) {
  const opponentMiniBoardWidth = 'clamp(72px, 18vw, 98px)';
  const [state, setState] = useState<DefenseLineGameState | null>(null);
  const [playerSide, setPlayerSide] = useState<DefenseLinePlayer | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<DefenseLinePlayer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastStateAtMs, setLastStateAtMs] = useState<number | null>(null);
  const [selfBoardKick, setSelfBoardKick] = useState(false);
  const [layoutBlast, setLayoutBlast] = useState(false);

  const [showPostMatch, setShowPostMatch] = useState(false);

  const socketRef = useRef<PartySocket | null>(null);
  const playerSideRef = useRef<DefenseLinePlayer | null>(null);
  const selfKickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutBlastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DAS/ARR refs for auto-repeat
  const DAS_MS = 170;
  const ARR_MS = 50;
  const dasTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topInfoZoneRef = useRef<HTMLDivElement>(null);
  const leftInfoZoneRef = useRef<HTMLDivElement>(null);
  const playerBoardZoneRef = useRef<HTMLDivElement>(null);
  const rightInfoZoneRef = useRef<HTMLDivElement>(null);
  const actionZoneRef = useRef<HTMLDivElement>(null);
  const opponentBoardViewportRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const playerBoardZoneSize = useElementSize(playerBoardZoneRef);
  const rightInfoZoneSize = useElementSize(rightInfoZoneRef);
  const opponentBoardViewportSize = useElementSize(opponentBoardViewportRef);

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

  const ghostPiece = useMemo(() => {
    if (!state || !playerSide || !yourState?.activePiece) return null;
    return computeGhostPiece(yourState.activePiece, state.board, playerSide);
  }, [state, playerSide, yourState]);

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
  const defenseBoardWidth = state?.board?.[0]?.length ?? BOARD_COLS;
  const defenseBoardHeight = state?.board?.length ?? BOARD_ROWS;

  const mainBoardDisplay = useMemo(
    () =>
      computeBoardDisplaySize({
        availableWidth: playerBoardZoneSize.width,
        availableHeight: playerBoardZoneSize.height,
        boardWidth: defenseBoardWidth,
        boardHeight: defenseBoardHeight,
        baseWidthColumns: 10,
        minCellSize: 4,
      }),
    [defenseBoardHeight, defenseBoardWidth, playerBoardZoneSize.height, playerBoardZoneSize.width]
  );

  const opponentBoardDisplay = useMemo(
    () =>
      computeBoardDisplaySize({
        availableWidth: opponentBoardViewportSize.width,
        availableHeight: opponentBoardViewportSize.height,
        boardWidth: defenseBoardWidth,
        boardHeight: defenseBoardHeight,
        baseWidthColumns: 10,
        minCellSize: 2,
      }),
    [defenseBoardHeight, defenseBoardWidth, opponentBoardViewportSize.height, opponentBoardViewportSize.width]
  );

  const rightInfoPanelsMaxHeight = useMemo(() => {
    if (rightInfoZoneSize.height <= 0) return 140;
    const reservedForBoard = opponentBoardDisplay.pixelHeight + 40;
    return Math.max(60, rightInfoZoneSize.height - reservedForBoard);
  }, [opponentBoardDisplay.pixelHeight, rightInfoZoneSize.height]);

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

  const stopAutoRepeat = useCallback(() => {
    if (dasTimeoutRef.current) {
      clearTimeout(dasTimeoutRef.current);
      dasTimeoutRef.current = null;
    }
    if (arrIntervalRef.current) {
      clearInterval(arrIntervalRef.current);
      arrIntervalRef.current = null;
    }
  }, []);

  const startAutoRepeat = useCallback((action: () => void) => {
    stopAutoRepeat();
    action();
    dasTimeoutRef.current = setTimeout(() => {
      arrIntervalRef.current = setInterval(action, ARR_MS);
    }, DAS_MS);
  }, [stopAutoRepeat]);

  // Show post-match overlay shortly after winner is determined
  useEffect(() => {
    if (!winner) return;
    const timer = setTimeout(() => setShowPostMatch(true), 800);
    return () => clearTimeout(timer);
  }, [winner]);

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
      stopAutoRepeat();
      socket.close();
      socketRef.current = null;
    };
  }, [playerId, roomId, triggerClearBlast, stopAutoRepeat]);

  useEffect(() => {
    if (!state || !playerSide) return;
    drawDefenseBoard(mainCanvasRef.current, state, playerSide, theme, ghostPiece);
    const opponentSide: DefenseLinePlayer = playerSide === 'a' ? 'b' : 'a';
    drawDefenseBoard(opponentCanvasRef.current, state, opponentSide, theme);
  }, [
    ghostPiece,
    mainBoardDisplay.pixelHeight,
    mainBoardDisplay.pixelWidth,
    opponentBoardDisplay.pixelHeight,
    opponentBoardDisplay.pixelWidth,
    playerSide,
    selfBoardKick,
    state,
    theme,
  ]);

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
        ref={topInfoZoneRef}
        data-zone="top-info-zone"
        style={{
          position: 'relative',
          zIndex: 7,
          paddingTop: 'max(12px, calc(env(safe-area-inset-top) + 8px))',
          paddingLeft: 'clamp(8px, 2vw, 14px)',
          paddingRight: 'clamp(8px, 2vw, 14px)',
          paddingBottom: 'clamp(4px, 0.7vh, 8px)',
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
      </div>

      <div
        data-zone="middle-play-zone"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          minHeight: 0,
          overflow: 'hidden',
          padding: 'clamp(4px, 0.8vh, 8px) clamp(4px, 0.8vw, 8px) clamp(6px, 1vh, 10px)',
          gap: 'clamp(2px, 0.5vw, 4px)',
          transform: layoutBlast ? 'translateY(4px)' : 'translateY(0)',
          transition: 'transform 180ms ease-out',
        }}
      >
        <div
          ref={leftInfoZoneRef}
          data-zone="left-info-zone"
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          {nextPieces.length > 0 && <NextPiecePanel nextPieces={nextPieces} />}
        </div>

        <div
          ref={playerBoardZoneRef}
          data-zone="player-board-zone"
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
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
              width={mainBoardDisplay.pixelWidth}
              height={mainBoardDisplay.pixelHeight}
              style={{
                display: 'block',
                border: '1px solid rgba(0, 240, 240, 0.15)',
                backgroundColor: 'transparent',
                width: `${mainBoardDisplay.pixelWidth}px`,
                height: `${mainBoardDisplay.pixelHeight}px`,
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

        <div
          ref={rightInfoZoneRef}
          data-zone="right-info-zone"
          style={{
            width: 'clamp(85px, 22vw, 110px)',
            minHeight: 0,
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
              ref={opponentBoardViewportRef}
              style={{
                position: 'relative',
                width: opponentMiniBoardWidth,
                height: 'clamp(130px, 34vw, 160px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <canvas
                ref={opponentCanvasRef}
                width={opponentBoardDisplay.pixelWidth}
                height={opponentBoardDisplay.pixelHeight}
                style={{
                  display: 'block',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(5, 5, 20, 0.72)',
                  width: `${opponentBoardDisplay.pixelWidth}px`,
                  height: `${opponentBoardDisplay.pixelHeight}px`,
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
              width: opponentMiniBoardWidth,
              maxWidth: opponentMiniBoardWidth,
              alignSelf: 'center',
              maxHeight: `${rightInfoPanelsMaxHeight}px`,
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
              {statusText}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={actionZoneRef}
        data-zone="action-zone"
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
          { key: 'left', icon: '◀', onPress: handleMoveLeft, repeatable: true },
          { key: 'hard', icon: '⏬', onPress: handleHardDrop, repeatable: false },
          { key: 'down', icon: '▼', onPress: handleSoftDrop, repeatable: true },
          { key: 'rotate', icon: '↻', onPress: handleRotate, repeatable: false },
          { key: 'right', icon: '▶', onPress: handleMoveRight, repeatable: true },
        ].map((control) => (
          <button
            key={control.key}
            onPointerDown={(event) => {
              event.preventDefault();
              if (control.repeatable) {
                startAutoRepeat(control.onPress);
              } else {
                control.onPress();
              }
            }}
            onPointerUp={stopAutoRepeat}
            onPointerLeave={stopAutoRepeat}
            onPointerCancel={stopAutoRepeat}
            onContextMenu={(e) => e.preventDefault()}
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
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {control.icon}
          </button>
        ))}
      </div>

      {/* Post-match overlay */}
      {showPostMatch && winner && playerSide && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(3, 3, 12, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            fontFamily: '"Orbitron", sans-serif',
          }}
        >
          <div
            style={{
              background: 'rgba(8, 10, 24, 0.92)',
              backdropFilter: 'blur(30px)',
              border: `3px solid ${playerSide === winner ? '#00f08c' : '#ff3c50'}`,
              borderRadius: '16px',
              boxShadow: `0 0 40px ${playerSide === winner ? 'rgba(0, 240, 140, 0.15)' : 'rgba(255, 60, 80, 0.15)'}, inset 0 0 40px rgba(0, 240, 240, 0.02)`,
              padding: 'clamp(24px, 6vw, 40px)',
              maxWidth: '420px',
              width: '88%',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                margin: '0 0 24px 0',
                fontSize: 'clamp(36px, 10vw, 52px)',
                fontWeight: 900,
                letterSpacing: '4px',
                color: playerSide === winner ? '#00f08c' : '#ff3c50',
                textShadow: `0 0 18px ${playerSide === winner ? 'rgba(0, 240, 140, 0.6)' : 'rgba(255, 60, 80, 0.6)'}, 0 0 45px ${playerSide === winner ? 'rgba(0, 240, 140, 0.25)' : 'rgba(255, 60, 80, 0.25)'}`,
              }}
            >
              {playerSide === winner ? 'VICTORY' : 'DEFEAT'}
            </h1>

            {/* Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '28px',
              }}
            >
              <div
                style={{
                  background: 'rgba(0, 240, 240, 0.06)',
                  border: '1px solid rgba(0, 240, 240, 0.15)',
                  borderRadius: '10px',
                  padding: '12px 8px',
                }}
              >
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '6px' }}>
                  YOUR ROWS
                </div>
                <div style={{ fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 900, color: '#67eaff', textShadow: '0 0 10px rgba(0, 212, 255, 0.6)' }}>
                  {yourRowsCleared}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(201, 66, 255, 0.06)',
                  border: '1px solid rgba(201, 66, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '12px 8px',
                }}
              >
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '6px' }}>
                  OPP ROWS
                </div>
                <div style={{ fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 900, color: '#df82ff', textShadow: '0 0 10px rgba(201, 66, 255, 0.6)' }}>
                  {opponentRowsCleared}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {onPlayAgain && (
                <button
                  onClick={() => {
                    audioManager.playSfx('button_click');
                    onPlayAgain();
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: '"Orbitron", sans-serif',
                    letterSpacing: '2px',
                    color: '#000',
                    background: 'linear-gradient(135deg, #00f08c, #00d4ff)',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(0, 240, 140, 0.3)',
                    touchAction: 'manipulation',
                  }}
                >
                  PLAY AGAIN
                </button>
              )}
              <button
                onClick={() => {
                  audioManager.playSfx('button_click');
                  onExit();
                }}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: '"Orbitron", sans-serif',
                  letterSpacing: '2px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                EXIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
