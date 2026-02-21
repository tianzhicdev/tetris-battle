import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { TETROMINO_SHAPES, type TetrominoType } from '@tetris-battle/game-core';
import { normalizePartykitHost } from '../services/partykit/host';
import { createLocalPartySocket, type PartySocketLike } from '../services/partykit/localRuntime';
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

interface DefenseLineClearCell {
  row: number;
  col: number;
}

interface DefenseLineClearSegment {
  row: number;
  startCol: number;
  endCol: number;
}

interface DefenseLineGameProps {
  playerId: string;
  roomId: string;
  theme: any;
  onExit: () => void;
  aiOpponent?: {
    local?: boolean;
    reactionCadenceMs?: number;
  };
}

const BOARD_ROWS = 20;
const BOARD_COLS = 10;
const DIVIDER_ROW = 10;
const TICK_MS = 700;
const CLEAR_FLASH_MS = 260;
const DROP_TRAIL_MS = 150;

type OverlayParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  life: number;
  decay: number;
  color: string;
  rotation: number;
  rotationVelocity: number;
};

type OverlayFlashCell = {
  row: number;
  col: number;
  color: string;
  expiresAt: number;
};

type OverlayTrail = {
  col: number;
  startRow: number;
  endRow: number;
  color: string;
  expiresAt: number;
};

type OverlayFxState = {
  flashes: OverlayFlashCell[];
  trails: OverlayTrail[];
  particles: OverlayParticle[];
};

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

function mapToVisual(actualRow: number, actualCol: number, viewAs: DefenseLinePlayer): [number, number] {
  if (viewAs === 'a') return [actualRow, actualCol];
  return [BOARD_ROWS - 1 - actualRow, BOARD_COLS - 1 - actualCol];
}

function cloneBoard(board: DefenseLineCell[][]): DefenseLineCell[][] {
  return board.map((row) => [...row]);
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

function isSolidForPlayer(board: DefenseLineCell[][], player: DefenseLinePlayer, row: number, col: number): boolean {
  const cell = board[row]?.[col];
  if (player === 'a') {
    return cell === 'a' || cell === 'x';
  }
  return cell === 'b' || cell === '0';
}

function canPlacePieceOnBoard(board: DefenseLineCell[][], player: DefenseLinePlayer, piece: DefenseLinePiece): boolean {
  for (const [row, col] of getPieceCells(piece)) {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
      return false;
    }
    if (isSolidForPlayer(board, player, row, col)) {
      return false;
    }
  }
  return true;
}

function computeHardDropPiece(board: DefenseLineCell[][], player: DefenseLinePlayer, piece: DefenseLinePiece): DefenseLinePiece {
  const step = player === 'a' ? 1 : -1;
  let dropped = { ...piece };

  while (true) {
    const candidate = { ...dropped, row: dropped.row + step };
    if (!canPlacePieceOnBoard(board, player, candidate)) {
      break;
    }
    dropped = candidate;
  }

  return dropped;
}

function themeColorForCell(cell: DefenseLineCell, viewAs: DefenseLinePlayer, theme: any): string {
  const blockType = blockTypeForCell(cell, viewAs);
  const color = theme?.colors?.[blockType];
  if (typeof color === 'string') {
    return color;
  }
  if (viewAs === 'a') {
    return cell === 'a' ? '#67eaff' : '#7aa8ff';
  }
  return cell === 'b' ? '#ff78a5' : '#ffd37a';
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

export function DefenseLineGame({ playerId, roomId, theme, onExit, aiOpponent }: DefenseLineGameProps) {
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

  const socketRef = useRef<PartySocketLike | null>(null);
  const playerSideRef = useRef<DefenseLinePlayer | null>(null);
  const selfKickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutBlastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topInfoZoneRef = useRef<HTMLDivElement>(null);
  const leftInfoZoneRef = useRef<HTMLDivElement>(null);
  const playerBoardZoneRef = useRef<HTMLDivElement>(null);
  const rightInfoZoneRef = useRef<HTMLDivElement>(null);
  const actionZoneRef = useRef<HTMLDivElement>(null);
  const opponentBoardViewportRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const opponentOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const boardSnapshotRef = useRef<DefenseLineCell[][] | null>(null);
  const prevActivePiecesRef = useRef<{ a: DefenseLinePiece | null; b: DefenseLinePiece | null }>({
    a: null,
    b: null,
  });
  const mainFxRef = useRef<OverlayFxState>({ flashes: [], trails: [], particles: [] });
  const opponentFxRef = useRef<OverlayFxState>({ flashes: [], trails: [], particles: [] });
  const fxRafRef = useRef<number | null>(null);
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

  const drawOverlayCanvas = useCallback((canvas: HTMLCanvasElement | null, fx: OverlayFxState, now: number): boolean => {
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const cellWidth = canvas.width / BOARD_COLS;
    const cellHeight = canvas.height / BOARD_ROWS;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    fx.trails = fx.trails.filter((trail) => trail.expiresAt > now);
    for (const trail of fx.trails) {
      const alpha = Math.max(0, Math.min(1, (trail.expiresAt - now) / DROP_TRAIL_MS));
      const start = Math.min(trail.startRow, trail.endRow);
      const end = Math.max(trail.startRow, trail.endRow);
      for (let row = start; row <= end; row++) {
        const x = trail.col * cellWidth + Math.max(1, cellWidth * 0.14);
        const y = row * cellHeight + Math.max(1, cellHeight * 0.14);
        const w = Math.max(1, cellWidth - Math.max(2, cellWidth * 0.28));
        const h = Math.max(1, cellHeight - Math.max(2, cellHeight * 0.28));

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = trail.color;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.06 * alpha})`;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = trail.color;
        ctx.globalAlpha = 0.18 * alpha;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      }
    }

    fx.flashes = fx.flashes.filter((flash) => flash.expiresAt > now);
    for (const flash of fx.flashes) {
      const progress = Math.max(0, Math.min(1, 1 - ((flash.expiresAt - now) / CLEAR_FLASH_MS)));
      const alpha = Math.sin(progress * Math.PI) * 0.86;
      const x = flash.col * cellWidth;
      const y = flash.row * cellHeight;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = flash.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = flash.color;
      ctx.fillRect(x, y, cellWidth, cellHeight);
      ctx.restore();
    }

    const nextParticles: OverlayParticle[] = [];
    for (const particle of fx.particles) {
      particle.vy += particle.gravity;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationVelocity;
      particle.life -= particle.decay;
      if (particle.life <= 0) continue;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.life;
      ctx.shadowBlur = 8;
      ctx.shadowColor = particle.color;
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();

      nextParticles.push(particle);
    }
    fx.particles = nextParticles;

    return fx.trails.length > 0 || fx.flashes.length > 0 || fx.particles.length > 0;
  }, []);

  const runOverlayFrame = useCallback(() => {
    const now = Date.now();
    const mainActive = drawOverlayCanvas(mainOverlayCanvasRef.current, mainFxRef.current, now);
    const opponentActive = drawOverlayCanvas(opponentOverlayCanvasRef.current, opponentFxRef.current, now);
    if (mainActive || opponentActive) {
      fxRafRef.current = requestAnimationFrame(runOverlayFrame);
      return;
    }
    fxRafRef.current = null;
  }, [drawOverlayCanvas]);

  const ensureOverlayLoop = useCallback(() => {
    if (fxRafRef.current !== null) return;
    fxRafRef.current = requestAnimationFrame(runOverlayFrame);
  }, [runOverlayFrame]);

  const spawnParticlesAtCell = useCallback((
    fx: OverlayFxState,
    canvas: HTMLCanvasElement | null,
    visualRow: number,
    visualCol: number,
    color: string,
    count: number
  ) => {
    if (!canvas) return;
    if (visualRow < 0 || visualRow >= BOARD_ROWS || visualCol < 0 || visualCol >= BOARD_COLS) return;

    const cellWidth = canvas.width / BOARD_COLS;
    const cellHeight = canvas.height / BOARD_ROWS;
    const centerX = (visualCol + 0.5) * cellWidth;
    const centerY = (visualRow + 0.5) * cellHeight;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 2;
      fx.particles.push({
        x: centerX + (Math.random() - 0.5) * cellWidth * 0.25,
        y: centerY + (Math.random() - 0.5) * cellHeight * 0.25,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.35,
        gravity: 0.06,
        size: Math.max(2, Math.min(cellWidth, cellHeight) * (0.11 + Math.random() * 0.2)),
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotationVelocity: (Math.random() - 0.5) * 0.24,
      });
    }
  }, []);

  const triggerClearEffects = useCallback((cells: DefenseLineClearCell[]) => {
    const mainView = playerSideRef.current;
    if (!mainView || cells.length === 0) return;
    const opponentView: DefenseLinePlayer = mainView === 'a' ? 'b' : 'a';
    const now = Date.now();
    const snapshot = boardSnapshotRef.current;

    for (const cellPos of cells) {
      const actualCell = snapshot?.[cellPos.row]?.[cellPos.col] ?? (cellPos.row < DIVIDER_ROW ? '0' : 'x');

      const [mainRow, mainCol] = mapToVisual(cellPos.row, cellPos.col, mainView);
      const mainColor = themeColorForCell(actualCell, mainView, theme);
      mainFxRef.current.flashes.push({
        row: mainRow,
        col: mainCol,
        color: mainColor,
        expiresAt: now + CLEAR_FLASH_MS,
      });
      spawnParticlesAtCell(mainFxRef.current, mainOverlayCanvasRef.current, mainRow, mainCol, mainColor, 6);

      const [oppRow, oppCol] = mapToVisual(cellPos.row, cellPos.col, opponentView);
      const oppColor = themeColorForCell(actualCell, opponentView, theme);
      opponentFxRef.current.flashes.push({
        row: oppRow,
        col: oppCol,
        color: oppColor,
        expiresAt: now + CLEAR_FLASH_MS,
      });
      spawnParticlesAtCell(opponentFxRef.current, opponentOverlayCanvasRef.current, oppRow, oppCol, oppColor, 4);
    }

    ensureOverlayLoop();
  }, [ensureOverlayLoop, spawnParticlesAtCell, theme]);

  const triggerHardDropEffects = useCallback(() => {
    if (!state || !playerSide) return;
    const stateForPlayer = playerSide === 'a' ? state.playerA : state.playerB;
    const piece = stateForPlayer.activePiece;
    if (!piece) return;

    const dropped = computeHardDropPiece(state.board, playerSide, piece);
    const startCells = getPieceCells(piece);
    const endCells = getPieceCells(dropped);
    if (startCells.length === 0 || endCells.length === 0) return;

    const mainView: DefenseLinePlayer = playerSide;
    const opponentView: DefenseLinePlayer = playerSide === 'a' ? 'b' : 'a';
    const color = typeof theme?.colors?.[piece.type] === 'string' ? theme.colors[piece.type] : '#ffffff';
    const now = Date.now();

    for (let i = 0; i < Math.min(startCells.length, endCells.length); i++) {
      const [startRow, startCol] = startCells[i];
      const [endRow, endCol] = endCells[i];

      const [mainStartRow, mainStartCol] = mapToVisual(startRow, startCol, mainView);
      const [mainEndRow, mainEndCol] = mapToVisual(endRow, endCol, mainView);
      if (mainStartCol === mainEndCol) {
        mainFxRef.current.trails.push({
          col: mainEndCol,
          startRow: mainStartRow,
          endRow: mainEndRow,
          color,
          expiresAt: now + DROP_TRAIL_MS,
        });
      }
      spawnParticlesAtCell(mainFxRef.current, mainOverlayCanvasRef.current, mainEndRow, mainEndCol, color, 3);

      const [oppStartRow, oppStartCol] = mapToVisual(startRow, startCol, opponentView);
      const [oppEndRow, oppEndCol] = mapToVisual(endRow, endCol, opponentView);
      if (oppStartCol === oppEndCol) {
        opponentFxRef.current.trails.push({
          col: oppEndCol,
          startRow: oppStartRow,
          endRow: oppEndRow,
          color,
          expiresAt: now + DROP_TRAIL_MS,
        });
      }
      spawnParticlesAtCell(opponentFxRef.current, opponentOverlayCanvasRef.current, oppEndRow, oppEndCol, color, 2);
    }

    ensureOverlayLoop();
  }, [ensureOverlayLoop, playerSide, spawnParticlesAtCell, state, theme]);

  const triggerLockFlashEffects = useCallback((piece: DefenseLinePiece, owner: DefenseLinePlayer) => {
    const mainView = playerSideRef.current;
    if (!mainView) return;
    const opponentView: DefenseLinePlayer = mainView === 'a' ? 'b' : 'a';
    const ownerCell: DefenseLineCell = owner === 'a' ? 'a' : 'b';
    const now = Date.now();

    for (const [actualRow, actualCol] of getPieceCells(piece)) {
      if (actualRow < 0 || actualRow >= BOARD_ROWS || actualCol < 0 || actualCol >= BOARD_COLS) continue;

      const [mainRow, mainCol] = mapToVisual(actualRow, actualCol, mainView);
      const mainColor = themeColorForCell(ownerCell, mainView, theme);
      mainFxRef.current.flashes.push({
        row: mainRow,
        col: mainCol,
        color: mainColor,
        expiresAt: now + 130,
      });

      const [oppRow, oppCol] = mapToVisual(actualRow, actualCol, opponentView);
      const oppColor = themeColorForCell(ownerCell, opponentView, theme);
      opponentFxRef.current.flashes.push({
        row: oppRow,
        col: oppCol,
        color: oppColor,
        expiresAt: now + 130,
      });
    }

    ensureOverlayLoop();
  }, [ensureOverlayLoop, theme]);

  const canSendGameplayInput = useMemo(() => {
    return !!playerSide && isConnected && state?.status === 'playing' && !winner;
  }, [isConnected, playerSide, state?.status, winner]);

  const sendGameplayInput = useCallback((payload: unknown): boolean => {
    if (!canSendGameplayInput) return false;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, [canSendGameplayInput]);

  const handleMoveLeft = useCallback(() => {
    if (!sendGameplayInput({ type: 'move', direction: 'left' })) return;
    audioManager.playSfx('piece_move_left', 0.3);
  }, [sendGameplayInput]);

  const handleMoveRight = useCallback(() => {
    if (!sendGameplayInput({ type: 'move', direction: 'right' })) return;
    audioManager.playSfx('piece_move_right', 0.3);
  }, [sendGameplayInput]);

  const handleRotate = useCallback(() => {
    if (!sendGameplayInput({ type: 'rotate', direction: 'cw' })) return;
    audioManager.playSfx('piece_rotate', 0.45);
  }, [sendGameplayInput]);

  const handleSoftDrop = useCallback(() => {
    if (!sendGameplayInput({ type: 'soft_drop' })) return;
    audioManager.playSfx('soft_drop', 0.4);
  }, [sendGameplayInput]);

  const handleHardDrop = useCallback(() => {
    if (!sendGameplayInput({ type: 'hard_drop' })) return;
    audioManager.playSfx('hard_drop', 0.65);
    triggerHardDropEffects();
  }, [sendGameplayInput, triggerHardDropEffects]);

  useEffect(() => {
    playerSideRef.current = playerSide;
    if (fxRafRef.current !== null) {
      cancelAnimationFrame(fxRafRef.current);
      fxRafRef.current = null;
    }
    mainFxRef.current = { flashes: [], trails: [], particles: [] };
    opponentFxRef.current = { flashes: [], trails: [], particles: [] };
    prevActivePiecesRef.current = { a: null, b: null };

    const clearOverlay = (canvas: HTMLCanvasElement | null) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    clearOverlay(mainOverlayCanvasRef.current);
    clearOverlay(opponentOverlayCanvasRef.current);
  }, [playerSide]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setState(null);
    setPlayerSide(null);
    setCountdown(null);
    setWinner(null);
    setLastStateAtMs(null);
    boardSnapshotRef.current = null;

    const socket: PartySocketLike = aiOpponent?.local
      ? createLocalPartySocket('defenseline', roomId)
      : new PartySocket({
          host: normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST),
          party: 'defenseline',
          room: roomId,
        });
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: 'join',
        playerId,
        aiOpponent: aiOpponent?.local ? {
          enabled: true,
          reactionCadenceMs: aiOpponent.reactionCadenceMs,
        } : undefined,
      }));
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

      if (data.type === 'room_state') {
        if (data.winner === 'a' || data.winner === 'b') {
          setWinner(data.winner);
        }
        if (data.status === 'playing') {
          setCountdown(null);
        }
        if (data.status === 'waiting' || data.status === 'countdown' || data.status === 'playing' || data.status === 'finished') {
          setState((previous) => {
            if (!previous) return previous;
            const nextWinner = data.winner === 'a' || data.winner === 'b'
              ? data.winner
              : previous.winner;
            return {
              ...previous,
              status: data.status,
              winner: nextWinner,
            };
          });
        }
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
        const cells: DefenseLineClearCell[] = Array.isArray(data.cells)
          ? data.cells
              .filter((cell: any) =>
                cell &&
                Number.isInteger(cell.row) &&
                Number.isInteger(cell.col) &&
                cell.row >= 0 &&
                cell.row < BOARD_ROWS &&
                cell.col >= 0 &&
                cell.col < BOARD_COLS
              )
              .map((cell: any) => ({ row: cell.row, col: cell.col }))
          : [];
        if (cells.length === 0 && Array.isArray(data.segments)) {
          for (const segment of data.segments as DefenseLineClearSegment[]) {
            if (!Number.isInteger(segment?.row) || !Number.isInteger(segment?.startCol) || !Number.isInteger(segment?.endCol)) {
              continue;
            }
            for (let col = segment.startCol; col <= segment.endCol; col++) {
              if (segment.row < 0 || segment.row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) continue;
              cells.push({ row: segment.row, col });
            }
          }
        }
        if (rows > 0) {
          playClearSound(rows);
          triggerClearBlast(playerSideRef.current !== null && data.player === playerSideRef.current);
          triggerClearEffects(cells);
        }
        return;
      }

      if (data.type === 'state' && data.state) {
        const nextState = data.state as DefenseLineGameState;
        setState(nextState);
        boardSnapshotRef.current = cloneBoard(nextState.board);
        setLastStateAtMs(Date.now());
        if (nextState.status === 'playing') {
          setCountdown(null);
        }
        const resolvedWinner = nextState.winner === 'a' || nextState.winner === 'b'
          ? nextState.winner
          : null;
        setWinner((prev) => {
          if (resolvedWinner) return resolvedWinner;
          if (nextState.status === 'finished') return prev;
          return null;
        });
        return;
      }

      if ((data.type === 'win' || data.type === 'game_finished') && (data.winner === 'a' || data.winner === 'b')) {
        setWinner(data.winner);
      }
    });

    return () => {
      if (selfKickTimeoutRef.current) clearTimeout(selfKickTimeoutRef.current);
      if (layoutBlastTimeoutRef.current) clearTimeout(layoutBlastTimeoutRef.current);
      socket.close();
      socketRef.current = null;
    };
  }, [aiOpponent, playerId, roomId, triggerClearBlast, triggerClearEffects]);

  useEffect(() => {
    if (!state || !playerSide) return;
    drawDefenseBoard(mainCanvasRef.current, state, playerSide, theme);
    const opponentSide: DefenseLinePlayer = playerSide === 'a' ? 'b' : 'a';
    drawDefenseBoard(opponentCanvasRef.current, state, opponentSide, theme);
  }, [
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
    if (!state || !playerSide) return;

    const previous = prevActivePiecesRef.current;
    const current = {
      a: state.playerA.activePiece ? { ...state.playerA.activePiece } : null,
      b: state.playerB.activePiece ? { ...state.playerB.activePiece } : null,
    };

    for (const side of ['a', 'b'] as const) {
      const prevPiece = previous[side];
      const nextPiece = current[side];
      if (!prevPiece || !nextPiece) continue;

      const respawned = side === 'a'
        ? nextPiece.row < prevPiece.row
        : nextPiece.row > prevPiece.row;

      if (respawned) {
        triggerLockFlashEffects(prevPiece, side);
      }
    }

    prevActivePiecesRef.current = current;
  }, [playerSide, state, triggerLockFlashEffects]);

  useEffect(() => () => {
    if (fxRafRef.current !== null) {
      cancelAnimationFrame(fxRafRef.current);
      fxRafRef.current = null;
    }
    mainFxRef.current = { flashes: [], trails: [], particles: [] };
    opponentFxRef.current = { flashes: [], trails: [], particles: [] };
    const clearOverlay = (canvas: HTMLCanvasElement | null) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    clearOverlay(mainOverlayCanvasRef.current);
    clearOverlay(opponentOverlayCanvasRef.current);
  }, []);

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
    : state?.status === 'finished'
    ? 'MATCH OVER'
    : state?.status === 'playing'
    ? 'IN MATCH'
    : 'WAITING';

  const showResultOverlay = !!winner || state?.status === 'finished';
  const isWin = !!winner && playerSide === winner;
  const resultHeadline = winner
    ? (isWin ? 'VICTORY' : 'DEFEAT')
    : 'MATCH OVER';

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
            <canvas
              ref={mainOverlayCanvasRef}
              width={mainBoardDisplay.pixelWidth}
              height={mainBoardDisplay.pixelHeight}
              style={{
                position: 'absolute',
                inset: 0,
                width: `${mainBoardDisplay.pixelWidth}px`,
                height: `${mainBoardDisplay.pixelHeight}px`,
                borderRadius: 'clamp(6px, 1.5vw, 10px)',
                pointerEvents: 'none',
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
              <canvas
                ref={opponentOverlayCanvasRef}
                width={opponentBoardDisplay.pixelWidth}
                height={opponentBoardDisplay.pixelHeight}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${opponentBoardDisplay.pixelWidth}px`,
                  height: `${opponentBoardDisplay.pixelHeight}px`,
                  borderRadius: 'clamp(4px, 1vw, 6px)',
                  pointerEvents: 'none',
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
          { key: 'left', icon: '◀', onPress: handleMoveLeft },
          { key: 'hard', icon: '⏬', onPress: handleHardDrop },
          { key: 'down', icon: '▼', onPress: handleSoftDrop },
          { key: 'rotate', icon: '↻', onPress: handleRotate },
          { key: 'right', icon: '▶', onPress: handleMoveRight },
        ].map((control) => (
          <button
            key={control.key}
            disabled={!canSendGameplayInput}
            aria-disabled={!canSendGameplayInput}
            onPointerDown={(event) => {
              event.preventDefault();
              if (!canSendGameplayInput) return;
              control.onPress();
            }}
            style={{
              flex: 1,
              opacity: canSendGameplayInput ? 1 : 0.42,
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'clamp(8px, 2vw, 12px)',
              cursor: canSendGameplayInput ? 'pointer' : 'not-allowed',
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

      {showResultOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0, 0, 0, 0.74)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: 'min(92vw, 420px)',
              borderRadius: '16px',
              border: `2px solid ${winner ? (isWin ? 'rgba(0,255,136,0.5)' : 'rgba(255,0,110,0.5)') : 'rgba(125, 227, 255, 0.4)'}`,
              background: 'rgba(8, 10, 20, 0.94)',
              boxShadow: winner
                ? (isWin
                    ? '0 0 32px rgba(0, 255, 136, 0.32)'
                    : '0 0 32px rgba(255, 0, 110, 0.32)')
                : '0 0 24px rgba(125, 227, 255, 0.2)',
              padding: '22px 18px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 'clamp(24px, 7vw, 36px)',
                fontWeight: 900,
                letterSpacing: '1.4px',
                color: winner ? (isWin ? '#7dffb0' : '#ff7aa9') : '#7de3ff',
                textShadow: winner
                  ? (isWin ? '0 0 16px rgba(125, 255, 176, 0.55)' : '0 0 16px rgba(255, 122, 169, 0.55)')
                  : '0 0 14px rgba(125, 227, 255, 0.45)',
              }}
            >
              {resultHeadline}
            </div>
            <div
              style={{
                marginTop: '10px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.74)',
                letterSpacing: '0.35px',
              }}
            >
              {winner ? (isWin ? 'You won the match.' : 'You lost the match.') : 'Result synced. Match has ended.'}
            </div>
            <button
              onClick={onExit}
              style={{
                marginTop: '16px',
                width: '100%',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
