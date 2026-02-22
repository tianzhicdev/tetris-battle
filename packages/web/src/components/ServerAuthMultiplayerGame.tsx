import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import {
  ClientAuthGameClient,
  type AbilityActivationResult,
  type PublicGameState,
} from '../services/partykit/ClientAuthGameClient';
import type { ConnectionStats } from '../services/ConnectionMonitor';
import { NextPiecePanel } from './NextPiecePanel';
import { FloatingBackground } from './FloatingBackground';

import { ParticleEffect } from './ParticleEffect';
import { FlashOverlay } from './FlashOverlay';
import { CyberpunkParticles, type CyberpunkParticlesHandle } from './CyberpunkParticles';
import { DebugLogger } from '../services/debug/DebugLogger';
import { DebugPanel } from './debug/DebugPanel';
import { useDebugStore } from '../stores/debugStore';
import {
  ABILITIES,
  getHardDropPosition,
  getAbilityTargeting,
  isDebuffAbility,
} from '@tetris-battle/game-core';
import type { Ability, UserProfile } from '@tetris-battle/game-core';
import { awardMatchRewards, type MatchRewards } from '../lib/rewards';
import type { Theme } from '../themes';
import { audioManager } from '../services/audioManager';
import { normalizePartykitHost } from '../services/partykit/host';
import { haptics } from '../utils/haptics';
import { buttonVariants, springs, scoreVariants, overlayVariants, modalVariants } from '../utils/animations';
import { GameHeader } from './game/GameHeader';
import { NextPieceQueue } from './game/NextPieceQueue';
import { OpponentPreview } from './game/OpponentPreview';
import { AbilityDock } from './game/AbilityDock';
import { GameTouchControls } from './game/GameTouchControls';
import { MobileGameLayout } from './game/MobileGameLayout';
import { Icon } from './ui/Icon';
import { useElementSize } from '../hooks/useElementSize';
import { computeBoardDisplaySize } from './game/boardDisplaySizing';

interface ServerAuthMultiplayerGameProps {
  roomId: string;
  playerId: string;
  opponentId: string;
  theme: Theme;
  profile: UserProfile;
  onExit: () => void;
  aiOpponent?: any;
  mockMode?: boolean;
  mockStatic?: boolean;
}

const BOMB_ABILITY_TYPES = new Set<string>(['circle_bomb', 'cross_firebomb']);
const CELL_MANIPULATION_ABILITY_TYPES = new Set<string>([
  'death_cross',
  'random_spawner',
  'gold_digger',
  'fill_holes',
  'clear_rows',
  'earthquake',
  'garbage_rain',
  'column_swap',
  'gravity_well',
  'flip_board',
  'quicksand',
]);
const DEFERRED_BOARD_DIFF_ABILITY_TYPES = new Set<string>([
  'circle_bomb',
  'cross_firebomb',
  'random_spawner',
  'gold_digger',
]);

type BoardFxState = {
  id: number;
  color: string;
  borderColor: string;
  glow: string;
};

type BoardCellPosition = {
  x: number;
  y: number;
};

type BoardDiff = {
  appeared: BoardCellPosition[];
  disappeared: BoardCellPosition[];
  mutated: BoardCellPosition[];
};

type BoardFxTarget = 'self' | 'opponent';

type PendingBoardAbilityFx = {
  abilityType: string;
  expiresAt: number;
};

type TimedEffectEntry = {
  abilityType: string;
  remainingMs: number;
  durationMs: number;
};

type ClearedRowSnapshot = {
  rowIndex: number;
  cells: string[];
};

type LineClearParticle = {
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

type HardDropTrailCell = {
  x: number;
  startY: number;
  endY: number;
  color: string;
};

type HardDropTrailEffect = {
  boardWidth: number;
  boardHeight: number;
  cells: HardDropTrailCell[];
  expiresAt: number;
};

type FloatingText = {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  born: number;
};

type LockFlash = {
  cells: Array<{ x: number; y: number }>;
  color: string;
  expiresAt: number;
};

function hexToRgbaColor(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function withColorAlpha(color: string, alpha: number): string {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const normalized = color.trim();

  const rgbMatch = normalized.match(
    /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*[0-9]*\.?[0-9]+\s*)?\)$/i
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
  }

  return color;
}

function extractClearedRowsFromPreviousBoard(previousGrid: any[][], linesCleared: number): ClearedRowSnapshot[] {
  if (!Array.isArray(previousGrid) || linesCleared <= 0) return [];

  const fullRows = previousGrid
    .map((row, rowIndex) => ({ rowIndex, cells: row }))
    .filter(({ cells }) => Array.isArray(cells) && cells.length > 0 && cells.every((cell) => typeof cell === 'string'))
    .map(({ rowIndex, cells }) => ({ rowIndex, cells: cells as string[] }));

  if (fullRows.length >= linesCleared) {
    return fullRows.slice(-linesCleared);
  }

  if (fullRows.length > 0) {
    return fullRows;
  }

  // Fallback: choose the densest rows nearest the bottom when exact full rows are not observable.
  const denseRows = previousGrid
    .map((row, rowIndex) => {
      const typedRow = Array.isArray(row) ? row : [];
      const filled = typedRow.filter((cell) => typeof cell === 'string').length;
      return { rowIndex, filled, cells: typedRow.filter((cell): cell is string => typeof cell === 'string') };
    })
    .filter((row) => row.filled > 0)
    .sort((a, b) => {
      if (b.filled !== a.filled) return b.filled - a.filled;
      return b.rowIndex - a.rowIndex;
    })
    .slice(0, linesCleared)
    .sort((a, b) => a.rowIndex - b.rowIndex);

  return denseRows.map((row) => ({
    rowIndex: row.rowIndex,
    cells: previousGrid[row.rowIndex].map((cell: any) => (typeof cell === 'string' ? cell : '')),
  }));
}

function cloneBoardGrid(grid: any[][]): any[][] {
  return grid.map((row) => [...row]);
}

function getBoardDiff(previousGrid: any[][], currentGrid: any[][]): BoardDiff {
  const appeared: BoardCellPosition[] = [];
  const disappeared: BoardCellPosition[] = [];
  const mutated: BoardCellPosition[] = [];
  const height = Math.min(previousGrid.length, currentGrid.length);
  const width = Math.min(previousGrid[0]?.length ?? 0, currentGrid[0]?.length ?? 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const before = previousGrid[y]?.[x] ?? null;
      const after = currentGrid[y]?.[x] ?? null;
      if (before === after) continue;
      if (before && !after) {
        disappeared.push({ x, y });
      } else if (!before && after) {
        appeared.push({ x, y });
      } else {
        mutated.push({ x, y });
      }
    }
  }

  return { appeared, disappeared, mutated };
}

function uniquePositions(positions: BoardCellPosition[]): BoardCellPosition[] {
  const deduped = new Map<string, BoardCellPosition>();
  for (const pos of positions) {
    deduped.set(`${pos.x},${pos.y}`, pos);
  }
  return Array.from(deduped.values());
}

function centerOfPositions(positions: BoardCellPosition[]): BoardCellPosition {
  if (positions.length === 0) return { x: 0, y: 0 };
  const sum = positions.reduce(
    (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }),
    { x: 0, y: 0 }
  );
  return {
    x: Math.round(sum.x / positions.length),
    y: Math.round(sum.y / positions.length),
  };
}

function stateHasEffect(state: any | null, effect: string): boolean {
  return !!state?.activeEffects?.includes(effect);
}

function buildMirageNextPieces(nextPieces: string[] | undefined): string[] {
  if (!Array.isArray(nextPieces)) return [];
  const cycle = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];
  return nextPieces.map((piece, index) => {
    const current = cycle.indexOf(piece);
    if (current < 0) return cycle[index % cycle.length];
    return cycle[(current + 1 + index) % cycle.length];
  });
}

function normalizeTimedEffects(raw: any, elapsedMs: number): TimedEffectEntry[] {
  if (!Array.isArray(raw)) return [];
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

  return raw
    .map((entry: any) => {
      const remainingBase = Number(entry?.remainingMs);
      if (!Number.isFinite(remainingBase) || remainingBase <= 0) return null;

      const durationBase = Number(entry?.durationMs);
      const durationMs = Math.max(
        Number.isFinite(durationBase) && durationBase > 0 ? durationBase : 0,
        remainingBase,
        1
      );
      const remainingMs = Math.max(0, remainingBase - elapsed);
      if (remainingMs <= 0) return null;

      return {
        abilityType: String(entry?.abilityType ?? 'effect'),
        remainingMs,
        durationMs,
      };
    })
    .filter((entry): entry is TimedEffectEntry => entry !== null);
}

function getTiltAngle(state: any | null): number {
  if (!stateHasEffect(state, 'tilt')) return 0;
  const direction = typeof state?.tiltDirection === 'number' ? state.tiltDirection : 1;
  return direction < 0 ? -5 : 5;
}

const INK_SPLASH_PATCHES = [
  {
    top: '3%',
    left: '4%',
    width: '34%',
    height: '28%',
    rotate: -8,
    clipPath:
      'polygon(4% 24%, 26% 8%, 58% 3%, 87% 15%, 97% 37%, 90% 74%, 66% 93%, 32% 97%, 9% 74%)',
  },
  {
    top: '18%',
    left: '52%',
    width: '39%',
    height: '30%',
    rotate: 7,
    clipPath:
      'polygon(8% 14%, 42% 2%, 76% 12%, 94% 38%, 88% 72%, 61% 95%, 24% 92%, 6% 60%)',
  },
  {
    top: '40%',
    left: '10%',
    width: '35%',
    height: '28%',
    rotate: -11,
    clipPath:
      'polygon(6% 24%, 23% 4%, 55% 1%, 84% 11%, 97% 38%, 88% 74%, 62% 95%, 28% 96%, 10% 70%)',
  },
  {
    top: '56%',
    left: '44%',
    width: '43%',
    height: '33%',
    rotate: 5,
    clipPath:
      'polygon(7% 16%, 32% 3%, 64% 4%, 88% 20%, 98% 48%, 90% 79%, 64% 97%, 27% 94%, 8% 66%)',
  },
  {
    top: '78%',
    left: '22%',
    width: '34%',
    height: '22%',
    rotate: -4,
    clipPath:
      'polygon(5% 24%, 28% 7%, 62% 8%, 88% 20%, 97% 46%, 90% 76%, 61% 94%, 24% 91%, 8% 67%)',
  },
];

const INK_SPLASH_DRIPS = [
  { left: '8%', width: '5%', height: '20%' },
  { left: '22%', width: '4%', height: '14%' },
  { left: '36%', width: '6%', height: '18%' },
  { left: '58%', width: '4%', height: '16%' },
  { left: '72%', width: '5%', height: '13%' },
  { left: '86%', width: '4%', height: '17%' },
];

function InkSplashMask({ idPrefix, borderRadius }: { idPrefix: string; borderRadius: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      {INK_SPLASH_PATCHES.map((patch, index) => (
        <div
          key={`${idPrefix}-ink-patch-${index}`}
          style={{
            position: 'absolute',
            top: patch.top,
            left: patch.left,
            width: patch.width,
            height: patch.height,
            transform: `rotate(${patch.rotate}deg)`,
            clipPath: patch.clipPath,
            background: 'linear-gradient(145deg, #000000 0%, #060606 52%, #000000 100%)',
            opacity: 1,
            boxShadow: '0 0 0 1px #000000, 0 0 10px rgba(0,0,0,0.35)',
          }}
        />
      ))}
      {INK_SPLASH_DRIPS.map((drip, index) => (
        <div
          key={`${idPrefix}-ink-drip-${index}`}
          style={{
            position: 'absolute',
            top: '-2%',
            left: drip.left,
            width: drip.width,
            height: drip.height,
            background: '#000000',
            borderRadius: '0 0 999px 999px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '-14%',
              left: '50%',
              width: '72%',
              height: '34%',
              transform: 'translateX(-50%)',
              borderRadius: '50%',
              background: '#000000',
            }}
          />
        </div>
      ))}
    </div>
  );
}

const MOCK_TETROMINO_TYPES = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'] as const;
const MOCK_TETROMINO_SHAPES: Record<string, number[][]> = {
  I: [
    [1, 1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  L: [
    [1, 0],
    [1, 0],
    [1, 1],
  ],
  J: [
    [0, 1],
    [0, 1],
    [1, 1],
  ],
};

type MockStatePayload = {
  board: (string | null)[][];
  currentPiece: any;
  magnetGhost: any | null;
  nextPieces: string[];
  score: number;
  stars: number;
  linesCleared: number;
  comboCount: number;
  isGameOver: boolean;
  activeEffects: string[];
  timedEffects: Array<{ abilityType: string; remainingMs: number; durationMs: number }>;
  pieceCountEffects: Array<{ abilityType: string; remaining: number; total: number }>;
  tiltDirection: number;
};

function createMockPiece(type: string, x: number, y: number): any {
  const shape = MOCK_TETROMINO_SHAPES[type] || MOCK_TETROMINO_SHAPES.T;
  return {
    type,
    shape,
    rotation: 0,
    position: { x, y },
    x,
    y,
  };
}

function createMockBoard(width: number, height: number, phase: number): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  for (let y = Math.floor(height * 0.45); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wave = Math.sin((x + phase * 0.7) * 0.8 + y * 0.35);
      const threshold = y > height - 4 ? -0.8 : -0.2;
      if (wave > threshold && ((x + y + phase) % 5 !== 0)) {
        const t = MOCK_TETROMINO_TYPES[(x + y + phase) % MOCK_TETROMINO_TYPES.length];
        grid[y][x] = t;
      }
    }
  }

  return grid;
}

function buildMockTimedEffects(
  now: number,
  definitions: Array<{ abilityType: string; durationMs: number; cadenceMs: number }>
): Array<{ abilityType: string; remainingMs: number; durationMs: number }> {
  return definitions
    .map((entry) => {
      const offset = now % entry.cadenceMs;
      const remainingMs = entry.durationMs - (offset % entry.durationMs);
      return {
        abilityType: entry.abilityType,
        remainingMs,
        durationMs: entry.durationMs,
      };
    })
    .filter((entry) => entry.remainingMs > 0);
}

/**
 * ServerAuthMultiplayerGame - Server-Authoritative Version
 *
 * Key differences from PartykitMultiplayerGame:
 * - NO game loop (server runs the loop)
 * - NO gameStore usage (server owns game state)
 * - ONLY renders from server-provided state
 * - Sends inputs on keyboard/touch events instead of executing them locally
 */
export function ServerAuthMultiplayerGame({
  roomId,
  playerId,
  opponentId,
  theme,
  profile,
  onExit,
  aiOpponent,
  mockMode = false,
  mockStatic = false,
}: ServerAuthMultiplayerGameProps) {
  const opponentMiniBoardWidth = 'clamp(72px, 18vw, 98px)';
  const topUiInset = 'max(12px, calc(env(safe-area-inset-top) + 8px))';
  const bottomUiInset = 'max(2px, env(safe-area-inset-bottom))';
  const statsCardsTop = topUiInset;
  const statsToBoardGap = 'clamp(4px, 0.7vh, 8px)';
  const abilitiesBarHeight = 'clamp(52px, 9vh, 64px)';
  const controlsGapHeight = '0px';
  const controlsBarHeight = 'clamp(60px, 12vh, 80px)';
  const boardBottomPadding = 'clamp(2px, 0.6vh, 6px)';
  const statsOverlaySidePadding = 'clamp(8px, 2vw, 14px)';
  const topInfoZoneRef = useRef<HTMLDivElement>(null);
  const leftInfoZoneRef = useRef<HTMLDivElement>(null);
  const playerBoardZoneRef = useRef<HTMLDivElement>(null);
  const rightInfoZoneRef = useRef<HTMLDivElement>(null);
  const actionZoneRef = useRef<HTMLDivElement>(null);
  const opponentBoardViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineClearOverlayRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const opponentRendererRef = useRef<TetrisRenderer | null>(null);
  const cyberpunkParticlesRef = useRef<CyberpunkParticlesHandle>(null);
  const gameClientRef = useRef<ClientAuthGameClient | null>(null);
  const lineClearParticlesRef = useRef<LineClearParticle[]>([]);
  const hardDropParticlesRef = useRef<LineClearParticle[]>([]);
  const hardDropTrailRef = useRef<HardDropTrailEffect | null>(null);
  const lineClearParticlesRafRef = useRef<number | null>(null);
  const hardDropShakeRafRef = useRef<number | null>(null);
  const prevBoardForLineClearFxRef = useRef<any[][] | null>(null);

  // Local state for rendering (from server)
  const [yourState, setYourState] = useState<any | null>(null);
  const [opponentState, setOpponentState] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const [screenShake, setScreenShake] = useState(0);
  const [flashEffect, setFlashEffect] = useState<{ color: string } | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [flashingRows, setFlashingRows] = useState<Array<{ rowIndex: number; expiresAt: number }>>([]);
  const [lockFlash, setLockFlash] = useState<LockFlash | null>(null);
  const [particles, setParticles] = useState<{ x: number; y: number; id: number; count?: number; colors?: string[] } | null>(null);
  const [selfBoardFx, setSelfBoardFx] = useState<BoardFxState | null>(null);
  const [opponentBoardFx, setOpponentBoardFx] = useState<BoardFxState | null>(null);
  const [abilityNotifications, setAbilityNotifications] = useState<Array<{ id: number; name: string; description: string; category: 'buff' | 'debuff' }>>([]);
  const notificationIdRef = useRef(0);
  const [matchRewards, setMatchRewards] = useState<MatchRewards | null>(null);
  const matchStartTimeRef = useRef<number>(Date.now());
  const pendingAbilityActivationsRef = useRef(new Map<string, { ability: Ability; target: 'self' | 'opponent' }>());
  const abilityResponseTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const boardFxTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingBombVisualRef = useRef<string | null>(null);
  const prevYourPieceRef = useRef<any | null>(null);
  const prevSelfBoardRef = useRef<any[][] | null>(null);
  const prevOpponentBoardRef = useRef<any[][] | null>(null);
  const pendingBoardAbilityFxRef = useRef<{ self: PendingBoardAbilityFx | null; opponent: PendingBoardAbilityFx | null }>({
    self: null,
    opponent: null,
  });
  const [debugLogger, setDebugLogger] = useState<DebugLogger | null>(null);
  const debugLoggerRef = useRef<DebugLogger | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
  const [effectClockMs, setEffectClockMs] = useState(() => Date.now());
  const [lastStateFrameMs, setLastStateFrameMs] = useState(() => Date.now());
  const statsBlastControls = useAnimationControls();
  const rightPanelBlastControls = useAnimationControls();
  const abilitiesBlastControls = useAnimationControls();
  const controlsBlastControls = useAnimationControls();
  const playerDropBounceControls = useAnimationControls();
  const [isMobilePortrait, setIsMobilePortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches;
  });
  const playerBoardZoneSize = useElementSize(playerBoardZoneRef);
  const rightInfoZoneSize = useElementSize(rightInfoZoneRef);
  const opponentBoardViewportSize = useElementSize(opponentBoardViewportRef);

  const { availableAbilities, setLoadout } = useAbilityStore();

  const yourBoardWidth = yourState?.boardWidth ?? yourState?.board?.[0]?.length ?? 10;
  const yourBoardHeight = yourState?.boardHeight ?? yourState?.board?.length ?? 20;
  const opponentBoardWidth = opponentState?.boardWidth ?? opponentState?.board?.[0]?.length ?? 10;
  const opponentBoardHeight = opponentState?.boardHeight ?? opponentState?.board?.length ?? 20;

  const yourBoardDisplay = useMemo(
    () =>
      computeBoardDisplaySize({
        availableWidth: playerBoardZoneSize.width,
        availableHeight: playerBoardZoneSize.height,
        boardWidth: yourBoardWidth,
        boardHeight: yourBoardHeight,
        baseWidthColumns: 10,
        minCellSize: 4,
      }),
    [playerBoardZoneSize.height, playerBoardZoneSize.width, yourBoardHeight, yourBoardWidth]
  );

  const opponentBoardDisplay = useMemo(
    () =>
      computeBoardDisplaySize({
        availableWidth: opponentBoardViewportSize.width,
        availableHeight: opponentBoardViewportSize.height,
        boardWidth: opponentBoardWidth,
        boardHeight: opponentBoardHeight,
        baseWidthColumns: 10,
        minCellSize: 2,
      }),
    [opponentBoardHeight, opponentBoardViewportSize.height, opponentBoardViewportSize.width, opponentBoardWidth]
  );
  const rightInfoEffectsMaxHeight = useMemo(() => {
    if (rightInfoZoneSize.height <= 0) return 160;
    const reservedForOpponentBoard = opponentBoardDisplay.pixelHeight + 42;
    return Math.max(80, rightInfoZoneSize.height - reservedForOpponentBoard);
  }, [opponentBoardDisplay.pixelHeight, rightInfoZoneSize.height]);

  const yourTimedEffects = useMemo(() => {
    const raw = Array.isArray(yourState?.timedEffects) ? yourState.timedEffects : [];
    return normalizeTimedEffects(raw, effectClockMs - lastStateFrameMs);
  }, [yourState?.timedEffects, effectClockMs, lastStateFrameMs]);

  const opponentTimedEffects = useMemo(() => {
    const raw = Array.isArray(opponentState?.timedEffects) ? opponentState.timedEffects : [];
    return normalizeTimedEffects(raw, effectClockMs - lastStateFrameMs);
  }, [opponentState?.timedEffects, effectClockMs, lastStateFrameMs]);

  // Piece count effects (mini_blocks, shapeshifter, magnet, etc.)
  const yourPieceCountEffects = useMemo(() => {
    const raw = Array.isArray(yourState?.pieceCountEffects) ? yourState.pieceCountEffects : [];
    return raw.filter((e: any) => e?.remaining > 0);
  }, [yourState?.pieceCountEffects]);

  const opponentPieceCountEffects = useMemo(() => {
    const raw = Array.isArray(opponentState?.pieceCountEffects) ? opponentState.pieceCountEffects : [];
    return raw.filter((e: any) => e?.remaining > 0);
  }, [opponentState?.pieceCountEffects]);

  // Defensive ability indicators
  const yourDefensiveAbility = useMemo(() => {
    const effects = yourState?.activeEffects || [];
    if (effects.includes('reflect')) return 'reflect';
    if (effects.includes('shield')) return 'shield';
    return null;
  }, [yourState?.activeEffects]);

  const opponentDefensiveAbility = useMemo(() => {
    const effects = opponentState?.activeEffects || [];
    if (effects.includes('reflect')) return 'reflect';
    if (effects.includes('shield')) return 'shield';
    return null;
  }, [opponentState?.activeEffects]);

  const selfBoardTheme = useMemo(
    () => ({
      ...theme,
      backgroundColor: withColorAlpha(theme.backgroundColor, 0.62),
    }),
    [theme]
  );
  const selfBoardShellBackground = useMemo(
    () => withColorAlpha(theme.backgroundColor, 0.62),
    [theme.backgroundColor]
  );

  // Helper to queue notifications (max 2 visible, auto-dismiss after 2.5s)
  const queueNotification = useCallback((name: string, description: string, category: 'buff' | 'debuff') => {
    const id = ++notificationIdRef.current;
    setAbilityNotifications(prev => {
      const next = [...prev, { id, name, description, category }];
      // Keep only last 2
      return next.slice(-2);
    });
    setTimeout(() => {
      setAbilityNotifications(prev => prev.filter(n => n.id !== id));
    }, 2500);
  }, []);

  const displayNextPieces = useMemo(() => {
    if (!yourState?.nextPieces) return [];
    if (stateHasEffect(yourState, 'mirage')) {
      return buildMirageNextPieces(yourState.nextPieces);
    }
    return yourState.nextPieces;
  }, [yourState?.nextPieces, yourState?.activeEffects]);

  // Set player's loadout
  useEffect(() => {
    console.log('[SERVER-AUTH] Setting player loadout:', profile.loadout);
    setLoadout(profile.loadout);
  }, [profile.loadout, setLoadout]);

  useEffect(() => {
    if (mockStatic) return;
    const interval = setInterval(() => setEffectClockMs(Date.now()), 100);
    return () => clearInterval(interval);
  }, [mockStatic]);

  useEffect(() => {
    return () => {
      if (lineClearParticlesRafRef.current !== null) {
        cancelAnimationFrame(lineClearParticlesRafRef.current);
      }
      if (hardDropShakeRafRef.current !== null) {
        cancelAnimationFrame(hardDropShakeRafRef.current);
      }
      lineClearParticlesRafRef.current = null;
      hardDropShakeRafRef.current = null;
      lineClearParticlesRef.current = [];
      hardDropParticlesRef.current = [];
      hardDropTrailRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px) and (orientation: portrait)');
    const updateLayout = () => {
      setIsMobilePortrait(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener('change', updateLayout);
    window.addEventListener('resize', updateLayout);

    return () => {
      mediaQuery.removeEventListener('change', updateLayout);
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  // Initialize debug mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.get('debug') === 'true';
    setIsDebugMode(debugEnabled);
    if (debugEnabled) {
      setDebugLogger(new DebugLogger());
      // Auto-open debug panel when debug mode is enabled
      const { togglePanel, isOpen } = useDebugStore.getState();
      if (!isOpen) {
        togglePanel();
      }
    }
  }, []);

  useEffect(() => {
    debugLoggerRef.current = debugLogger;
    gameClientRef.current?.setDebugLogger(debugLogger);
  }, [debugLogger]);

  const triggerBoardAbilityVisual = useCallback((abilityType: string, target: 'self' | 'opponent') => {
    const isBomb = BOMB_ABILITY_TYPES.has(abilityType);
    const isCellManip = CELL_MANIPULATION_ABILITY_TYPES.has(abilityType);
    if (!isBomb && !isCellManip) return;

    const fx: BoardFxState = isBomb
      ? {
          id: Date.now(),
          color: 'rgba(255, 120, 0, 0.25)',
          borderColor: 'rgba(255, 150, 0, 0.9)',
          glow: '0 0 28px rgba(255, 120, 0, 0.9), 0 0 52px rgba(255, 90, 0, 0.45)',
        }
      : {
          id: Date.now(),
          color: 'rgba(90, 180, 255, 0.2)',
          borderColor: 'rgba(80, 210, 255, 0.85)',
          glow: '0 0 22px rgba(80, 210, 255, 0.75), 0 0 40px rgba(30, 160, 255, 0.35)',
        };

    if (target === 'self') {
      setSelfBoardFx(fx);
    } else {
      setOpponentBoardFx(fx);
    }

    const clearTimeoutId = setTimeout(() => {
      if (target === 'self') {
        setSelfBoardFx(prev => (prev?.id === fx.id ? null : prev));
      } else {
        setOpponentBoardFx(prev => (prev?.id === fx.id ? null : prev));
      }
    }, 450);
    boardFxTimeoutsRef.current.push(clearTimeoutId);

    setFlashEffect({ color: fx.color });

    const targetCanvas = target === 'self' ? canvasRef.current : opponentCanvasRef.current;
    if (targetCanvas) {
      const rect = targetCanvas.getBoundingClientRect();
      setParticles({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        id: Date.now(),
        count: isBomb ? 70 : 36,
        colors: isBomb
          ? ['#ffd166', '#ff8c42', '#ff5d5d', '#ffe066']
          : ['#00d4ff', '#00ffcc', '#c942ff', '#7cf8ff'],
      });
    }

    if (isBomb) {
      setScreenShake(2);
      const shakeTimeout = setTimeout(() => setScreenShake(0), 350);
      boardFxTimeoutsRef.current.push(shakeTimeout);
      audioManager.playSfx('ability_bomb_explode', 0.9);
    }
  }, []);

  const queueBoardAbilityFx = useCallback((abilityType: string, target: BoardFxTarget) => {
    if (!BOMB_ABILITY_TYPES.has(abilityType) && !CELL_MANIPULATION_ABILITY_TYPES.has(abilityType)) {
      return;
    }
    pendingBoardAbilityFxRef.current[target] = {
      abilityType,
      expiresAt: Date.now() + 8000,
    };
  }, []);

  const triggerHardDropShake = useCallback(() => {
    if (hardDropShakeRafRef.current !== null) {
      cancelAnimationFrame(hardDropShakeRafRef.current);
    }

    const intensity = 0.2;
    const durationMs = 200;
    const startMs = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startMs;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - progress;
      const value = intensity * eased;
      setScreenShake((prev) => Math.max(prev, value));

      if (progress < 1) {
        hardDropShakeRafRef.current = requestAnimationFrame(tick);
        return;
      }

      hardDropShakeRafRef.current = null;
      setScreenShake((prev) => (prev <= intensity ? 0 : prev));
    };

    hardDropShakeRafRef.current = requestAnimationFrame(tick);
  }, []);

  const triggerHardDropBounce = useCallback(() => {
    void playerDropBounceControls.start({
      y: [0, -5, 0],
      transition: { duration: 0.18, ease: 'easeOut' },
    });
  }, [playerDropBounceControls]);

  const triggerLineClearExplosionPulse = useCallback((linesCleared: number) => {
    const intensity = Math.max(1, Math.min(4, linesCleared));
    const statsLift = 3 + intensity * 1.5;
    const sidePush = 4 + intensity * 2;
    const bottomPush = 4 + intensity * 1.75;
    const duration = 0.24 + intensity * 0.02;

    void Promise.all([
      statsBlastControls.start({
        y: [0, -statsLift, 0],
        transition: { duration, ease: 'easeOut' },
      }),
      rightPanelBlastControls.start({
        x: [0, sidePush, 0],
        transition: { duration, ease: 'easeOut' },
      }),
      abilitiesBlastControls.start({
        y: [0, bottomPush, 0],
        transition: { duration, ease: 'easeOut' },
      }),
      controlsBlastControls.start({
        y: [0, bottomPush, 0],
        transition: { duration, ease: 'easeOut' },
      }),
    ]);
  }, [abilitiesBlastControls, controlsBlastControls, rightPanelBlastControls, statsBlastControls]);

  const addFloatingText = useCallback((text: string, x: number, y: number, color: string, size: number) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, text, x, y, color, size, born: Date.now() }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1400);
  }, []);

  const runLineClearParticlesFrame = useCallback(() => {
    const canvas = lineClearOverlayRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      lineClearParticlesRafRef.current = null;
      return;
    }

    const now = Date.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activeTrail = hardDropTrailRef.current;
    let isTrailActive = false;
    if (activeTrail && activeTrail.expiresAt > now) {
      isTrailActive = true;
      const cellWidth = canvas.width / activeTrail.boardWidth;
      const cellHeight = canvas.height / activeTrail.boardHeight;
      const inset = 4;

      for (const segment of activeTrail.cells) {
        const start = Math.min(segment.startY, segment.endY);
        const end = Math.max(segment.startY, segment.endY);
        for (let y = start; y <= end; y++) {
          const drawX = segment.x * cellWidth + inset;
          const drawY = y * cellHeight + inset;
          const drawW = Math.max(1, cellWidth - inset * 2);
          const drawH = Math.max(1, cellHeight - inset * 2);

          ctx.save();
          ctx.shadowBlur = 8;
          ctx.shadowColor = hexToRgbaColor(segment.color, 0.27);
          ctx.fillStyle = hexToRgbaColor(segment.color, 0.13);
          ctx.fillRect(drawX, drawY, drawW, drawH);
          ctx.restore();
        }
      }
    } else if (activeTrail) {
      hardDropTrailRef.current = null;
    }

    // Render flashing rows (white flash effect)
    const activeFlashingRows = flashingRows.filter(row => row.expiresAt > now);
    if (activeFlashingRows.length > 0) {
      const cellHeight = canvas.height / 20; // Standard tetris height

      ctx.save();
      for (const { rowIndex } of activeFlashingRows) {
        const y = rowIndex * cellHeight;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#ffffff';
        ctx.fillRect(0, y, canvas.width, cellHeight);
      }
      ctx.restore();
    }

    const integrateParticles = (particles: LineClearParticle[]): LineClearParticle[] => {
      const nextParticles: LineClearParticle[] = [];
      for (const particle of particles) {
        particle.vy += particle.gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationVelocity;
        particle.life -= particle.decay;
        if (particle.life <= 0) continue;

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.shadowBlur = 8;
        ctx.shadowColor = hexToRgbaColor(particle.color, Math.min(1, particle.life + 0.25));
        ctx.fillStyle = hexToRgbaColor(particle.color, particle.life);
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.restore();

        nextParticles.push(particle);
      }
      return nextParticles;
    };

    lineClearParticlesRef.current = integrateParticles(lineClearParticlesRef.current);
    hardDropParticlesRef.current = integrateParticles(hardDropParticlesRef.current);

    const hasActiveFlash = activeFlashingRows.length > 0;
    if (isTrailActive || hasActiveFlash || lineClearParticlesRef.current.length > 0 || hardDropParticlesRef.current.length > 0) {
      lineClearParticlesRafRef.current = requestAnimationFrame(runLineClearParticlesFrame);
      return;
    }

    lineClearParticlesRafRef.current = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [flashingRows]);

  const spawnLineClearParticles = useCallback((clearedRows: ClearedRowSnapshot[], boardWidth: number, boardHeight: number) => {
    const canvas = lineClearOverlayRef.current;
    if (!canvas || clearedRows.length === 0 || boardWidth <= 0 || boardHeight <= 0) return;

    const pieceColors = theme.colors as Record<string, string>;
    const cellWidth = canvas.width / boardWidth;
    const cellHeight = canvas.height / boardHeight;
    const spawned: LineClearParticle[] = [];

    for (const clearedRow of clearedRows) {
      const yCenter = (clearedRow.rowIndex + 0.5) * cellHeight;
      for (let x = 0; x < boardWidth; x++) {
        const piece = clearedRow.cells[x];
        if (!piece) continue;
        const color = pieceColors[piece] || '#ffffff';
        const xCenter = (x + 0.5) * cellWidth;

        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.9 + Math.random() * 2.8;
          spawned.push({
            x: xCenter + (Math.random() - 0.5) * cellWidth * 0.4,
            y: yCenter + (Math.random() - 0.5) * cellHeight * 0.4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.6,
            gravity: 0.12,
            size: Math.max(2, Math.min(cellWidth, cellHeight) * (0.14 + Math.random() * 0.24)),
            life: 1,
            decay: 0.015 + Math.random() * 0.025,
            color,
            rotation: Math.random() * Math.PI * 2,
            rotationVelocity: (Math.random() - 0.5) * 0.25,
          });
        }
      }
    }

    if (spawned.length === 0) return;
    lineClearParticlesRef.current = [...lineClearParticlesRef.current, ...spawned];
    if (lineClearParticlesRafRef.current === null) {
      lineClearParticlesRafRef.current = requestAnimationFrame(runLineClearParticlesFrame);
    }
  }, [runLineClearParticlesFrame, theme.colors]);

  const triggerHardDropTrailImpact = useCallback(() => {
    if (!yourState?.currentPiece || !Array.isArray(yourState.board)) return;

    const boardGrid = yourState.board;
    const boardHeight = boardGrid.length;
    const boardWidth = boardGrid[0]?.length ?? 10;
    if (boardHeight <= 0 || boardWidth <= 0) return;

    const piece = yourState.currentPiece as any;
    const shape = Array.isArray(piece.shape) ? piece.shape : [];
    const startX = piece.position?.x ?? piece.x;
    const startY = piece.position?.y ?? piece.y;
    if (!Number.isFinite(startX) || !Number.isFinite(startY) || shape.length === 0) return;

    const pieceForDrop = {
      ...piece,
      shape,
      position: { x: startX, y: startY },
    };
    const boardForDrop = {
      grid: boardGrid,
      width: boardWidth,
      height: boardHeight,
    };
    const finalPosition = getHardDropPosition(boardForDrop as any, pieceForDrop as any);
    const finalY = finalPosition?.y;
    if (!Number.isFinite(finalY)) return;

    const pieceColor = (theme.colors as Record<string, string>)[piece.type] || '#ffffff';
    const trailCells: HardDropTrailCell[] = [];
    const dustParticles: LineClearParticle[] = [];
    const overlayCanvas = lineClearOverlayRef.current;
    const cellWidth = overlayCanvas ? overlayCanvas.width / boardWidth : 0;
    const cellHeight = overlayCanvas ? overlayCanvas.height / boardHeight : 0;

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;

        const boardX = startX + x;
        const originalY = startY + y;
        const landedY = finalY + y;
        if (boardX < 0 || boardX >= boardWidth || landedY < 0 || landedY >= boardHeight) continue;

        trailCells.push({
          x: boardX,
          startY: Math.max(0, originalY),
          endY: landedY,
          color: pieceColor,
        });

        if (overlayCanvas && cellWidth > 0 && cellHeight > 0) {
          const impactCenterX = (boardX + 0.5) * cellWidth;
          const impactCenterY = (landedY + 1) * cellHeight - Math.max(2, cellHeight * 0.16);

          for (let i = 0; i < 4; i++) {
            dustParticles.push({
              x: impactCenterX + (Math.random() - 0.5) * cellWidth * 0.35,
              y: impactCenterY + (Math.random() - 0.5) * cellHeight * 0.2,
              vx: -0.25 + Math.random() * 0.5,
              vy: -(0.5 + Math.random()),
              gravity: 0.04,
              size: Math.max(2, Math.min(cellWidth, cellHeight) * (0.09 + Math.random() * 0.14)),
              life: 1,
              decay: 0.03 + Math.random() * 0.018,
              color: pieceColor,
              rotation: Math.random() * Math.PI * 2,
              rotationVelocity: (Math.random() - 0.5) * 0.2,
            });
          }
        }
      }
    }

    if (trailCells.length > 0) {
      hardDropTrailRef.current = {
        boardWidth,
        boardHeight,
        cells: trailCells,
        expiresAt: Date.now() + 150,
      };
    }

    if (dustParticles.length > 0) {
      hardDropParticlesRef.current = [...hardDropParticlesRef.current, ...dustParticles];
    }

    // Spawn cyberpunk trail particles for hard drop
    if (trailCells.length > 0) {
      const CELL_SIZE = yourBoardDisplay.cellSize;
      trailCells.forEach(({ x: boardX, endY, color }) => {
        const x = boardX * CELL_SIZE + CELL_SIZE / 2;
        const y = endY * CELL_SIZE + CELL_SIZE / 2;
        cyberpunkParticlesRef.current?.addParticles(x, y, color, 5, 'trail');
      });
    }

    if ((trailCells.length > 0 || dustParticles.length > 0) && lineClearParticlesRafRef.current === null) {
      lineClearParticlesRafRef.current = requestAnimationFrame(runLineClearParticlesFrame);
    }

    triggerHardDropShake();
  }, [
    runLineClearParticlesFrame,
    theme.colors,
    triggerHardDropShake,
    yourBoardDisplay.cellSize,
    yourState?.board,
    yourState?.currentPiece,
  ]);

  useEffect(() => {
    if (!mockMode) return;

    setIsConnected(true);
    const startMs = Date.now();
    let tickCount = 0;

    if (mockStatic) {
      const now = Date.now();
      const staticYourTimedEffects = [
        { abilityType: 'wide_load', remainingMs: 7200, durationMs: 9000 },
      ];
      const staticOpponentTimedEffects = [
        { abilityType: 'mirage', remainingMs: 4100, durationMs: 5000 },
        { abilityType: 'blind_spot', remainingMs: 3600, durationMs: 5000 },
        { abilityType: 'reverse_controls', remainingMs: 5200, durationMs: 6000 },
      ];

      const yourStateMock: MockStatePayload = {
        board: createMockBoard(12, 20, 18),
        currentPiece: createMockPiece('T', 4, 3),
        magnetGhost: createMockPiece('T', 6, 15),
        nextPieces: ['I', 'T', 'L', 'O', 'S'],
        score: 14320,
        stars: 186,
        linesCleared: 42,
        comboCount: 3,
        isGameOver: false,
        activeEffects: staticYourTimedEffects.map((entry) => entry.abilityType),
        timedEffects: staticYourTimedEffects,
        pieceCountEffects: [
          { abilityType: 'magnet', remaining: 2, total: 3 },
          { abilityType: 'overcharge', remaining: 1, total: 3 },
        ],
        tiltDirection: 1,
      };

      const opponentStateMock: MockStatePayload = {
        board: createMockBoard(10, 20, 27),
        currentPiece: createMockPiece('Z', 4, 4),
        magnetGhost: null,
        nextPieces: ['Z', 'J', 'I', 'T', 'O'],
        score: 12980,
        stars: 141,
        linesCleared: 39,
        comboCount: 2,
        isGameOver: false,
        activeEffects: staticOpponentTimedEffects.map((entry) => entry.abilityType),
        timedEffects: staticOpponentTimedEffects,
        pieceCountEffects: [
          { abilityType: 'shapeshifter', remaining: 2, total: 3 },
        ],
        tiltDirection: -1,
      };

      setLastStateFrameMs(now);
      setYourState(yourStateMock);
      setOpponentState(opponentStateMock);
      setConnectionStats({
        latency: 42,
        avgLatency: 42,
        minLatency: 24,
        maxLatency: 77,
        quality: 'good',
      });

      setAbilityNotifications([]);

      return () => {
        setIsConnected(false);
        setConnectionStats(null);
        setAbilityNotifications([]);
      };
    }

    const tick = () => {
      tickCount += 1;
      const now = Date.now();
      const elapsed = now - startMs;
      const phase = Math.floor(elapsed / 350);

      const yourWideLoadActive = Math.floor(elapsed / 9000) % 2 === 0;
      const yourBoardWidth = yourWideLoadActive ? 12 : 10;
      const yourPieceX = 1 + (Math.floor(elapsed / 500) % Math.max(1, yourBoardWidth - 3));
      const opponentPieceX = 1 + (Math.floor((elapsed + 2200) / 520) % 7);

      const yourTimedEffects = buildMockTimedEffects(now, [
        { abilityType: 'tilt', durationMs: 10000, cadenceMs: 18000 },
        { abilityType: 'screen_shake', durationMs: 5000, cadenceMs: 24000 },
      ]);
      if (yourWideLoadActive) {
        yourTimedEffects.push({
          abilityType: 'wide_load',
          remainingMs: 9000 - (elapsed % 9000),
          durationMs: 9000,
        });
      }

      const opponentTimedEffects = buildMockTimedEffects(now + 1800, [
        { abilityType: 'mirage', durationMs: 5000, cadenceMs: 14000 },
        { abilityType: 'reverse_controls', durationMs: 6000, cadenceMs: 20000 },
        { abilityType: 'blind_spot', durationMs: 5000, cadenceMs: 17000 },
      ]);

      const yourActiveEffects = yourTimedEffects.map((entry) => entry.abilityType);
      const opponentActiveEffects = opponentTimedEffects.map((entry) => entry.abilityType);

      const yourStateMock: MockStatePayload = {
        board: createMockBoard(yourBoardWidth, 20, phase),
        currentPiece: createMockPiece(MOCK_TETROMINO_TYPES[phase % MOCK_TETROMINO_TYPES.length], yourPieceX, 2 + (phase % 2)),
        magnetGhost: createMockPiece(MOCK_TETROMINO_TYPES[(phase + 1) % MOCK_TETROMINO_TYPES.length], yourPieceX + 1, 15),
        nextPieces: ['I', 'T', 'L', 'O', 'S'],
        score: 12800 + phase * 24,
        stars: 120 + ((phase * 3) % 170),
        linesCleared: 38 + Math.floor(phase / 8),
        comboCount: phase % 5,
        isGameOver: false,
        activeEffects: yourActiveEffects,
        timedEffects: yourTimedEffects,
        pieceCountEffects: [
          { abilityType: 'magnet', remaining: 2 + (phase % 2), total: 3 },
          { abilityType: 'overcharge', remaining: 1 + (phase % 3), total: 3 },
        ],
        tiltDirection: phase % 2 === 0 ? 1 : -1,
      };

      const opponentStateMock: MockStatePayload = {
        board: createMockBoard(10, 20, phase + 5),
        currentPiece: createMockPiece(MOCK_TETROMINO_TYPES[(phase + 2) % MOCK_TETROMINO_TYPES.length], opponentPieceX, 3 + ((phase + 1) % 2)),
        magnetGhost: null,
        nextPieces: ['Z', 'J', 'I', 'T', 'O'],
        score: 11900 + phase * 20,
        stars: 95 + ((phase * 2) % 150),
        linesCleared: 35 + Math.floor(phase / 9),
        comboCount: (phase + 1) % 4,
        isGameOver: false,
        activeEffects: opponentActiveEffects,
        timedEffects: opponentTimedEffects,
        pieceCountEffects: [{ abilityType: 'shapeshifter', remaining: 1 + ((phase + 2) % 3), total: 3 }],
        tiltDirection: phase % 3 === 0 ? -1 : 1,
      };

      setLastStateFrameMs(now);
      setYourState(yourStateMock);
      setOpponentState(opponentStateMock);
      setConnectionStats({
        latency: 36 + ((phase * 7) % 34),
        avgLatency: 36 + ((phase * 7) % 34),
        minLatency: 21,
        maxLatency: 74,
        quality: phase % 9 < 6 ? 'excellent' : 'good',
      });

      if (tickCount % 18 === 0) {
        const abilityIds = ['earthquake', 'tilt', 'wide_load', 'magnet'];
        const ability = ABILITIES[abilityIds[(tickCount / 18) % abilityIds.length] as keyof typeof ABILITIES];
        if (ability) {
          queueNotification(ability.name, ability.description, isDebuffAbility(ability) ? 'debuff' : 'buff');
          triggerBoardAbilityVisual(ability.type, isDebuffAbility(ability) ? 'self' : 'opponent');
        }
      }
    };

    tick();
    const interval = setInterval(tick, 250);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
      setConnectionStats(null);
    };
  }, [mockMode, mockStatic, queueNotification, triggerBoardAbilityVisual]);

  const applyBoardDiffAnimations = useCallback((
    renderer: TetrisRenderer,
    target: BoardFxTarget,
    currentGrid: any[][],
    activeEffects?: string[]
  ) => {
    const previousBoardRef = target === 'self' ? prevSelfBoardRef : prevOpponentBoardRef;
    const previousGrid = previousBoardRef.current;
    const now = Date.now();

    const pendingFx = pendingBoardAbilityFxRef.current[target];
    if (pendingFx && pendingFx.expiresAt <= now) {
      pendingBoardAbilityFxRef.current[target] = null;
    }

    const pendingAbility = pendingBoardAbilityFxRef.current[target]?.abilityType;
    const periodicAbility = activeEffects?.includes('random_spawner')
      ? 'random_spawner'
      : activeEffects?.includes('gold_digger')
      ? 'gold_digger'
      : null;

    if (previousGrid && (pendingAbility || periodicAbility)) {
      const diff = getBoardDiff(previousGrid, currentGrid);
      const allChanged = uniquePositions([
        ...diff.appeared,
        ...diff.disappeared,
        ...diff.mutated,
      ]);

      if (allChanged.length > 0) {
        const abilityType = pendingAbility || periodicAbility!;

        if (BOMB_ABILITY_TYPES.has(abilityType)) {
          // Flash warning first
          renderer.animationManager.animateBlocksFlashing(allChanged, '#ffffff');
          // Burning fire effect on cleared cells
          renderer.animationManager.animateBlocksBurning(allChanged);
          // Explosion at center
          const center = centerOfPositions(allChanged);
          renderer.animationManager.animateExplosion(center.x, center.y, 3, '#ff6a00');
        } else {
          if (diff.disappeared.length > 0) {
            renderer.animationManager.animateBlocksDisappearing(diff.disappeared, '#ff5d73');
          }
          if (diff.appeared.length > 0) {
            renderer.animationManager.animateBlocksAppearing(diff.appeared, '#53d8ff');
          }
          if (diff.mutated.length > 0) {
            renderer.animationManager.animateBlocksFlashing(diff.mutated, '#9cf8ff');
          }
          renderer.animationManager.animateBlocksFlashing(allChanged, '#7cf8ff');
        }

        if (pendingAbility) {
          pendingBoardAbilityFxRef.current[target] = null;
        }
      } else if (pendingAbility && !DEFERRED_BOARD_DIFF_ABILITY_TYPES.has(pendingAbility)) {
        pendingBoardAbilityFxRef.current[target] = null;
      }
    }

    previousBoardRef.current = cloneBoardGrid(currentGrid);
  }, []);

  // Initialize client-authoritative game client
  useEffect(() => {
    if (mockMode) return;

    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
    const client = new ClientAuthGameClient(roomId, playerId, host, profile.loadout, aiOpponent, debugLogger || undefined);
    gameClientRef.current = client;

    client.connect(
      // On local state update (from client-side game engine - zero latency)
      (state: PublicGameState) => {
        setLastStateFrameMs(Date.now());
        setYourState(state);
      },
      // On opponent disconnected
      () => {
        setGameFinished(true);
        setWinnerId(playerId);
      },
      // On game finished
      (winner) => {
        setGameFinished(true);
        setWinnerId(winner);
      },
      // On ability received
      (abilityType, fromPlayerId) => {
        console.log(`[CLIENT-AUTH] Received ability: ${abilityType} from ${fromPlayerId}`);
        handleAbilityReceived(abilityType, fromPlayerId);
      },
      // On ability activation result
      (result) => {
        handleAbilityActivationResult(result);
      },
      // On opponent state update (from server relay - low frequency)
      (opponentSummary: PublicGameState) => {
        setOpponentState(opponentSummary);
      }
    );

    setIsConnected(true);

    // Subscribe to connection stats updates
    const unsubscribeStats = client.subscribeToConnectionStats((stats) => {
      setConnectionStats(stats);
    });

    // Start gameplay music
    audioManager.playMusic('gameplay_normal', true);

    return () => {
      unsubscribeStats();
      pendingAbilityActivationsRef.current.clear();
      for (const timeout of abilityResponseTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      abilityResponseTimeoutsRef.current.clear();
      for (const timeout of boardFxTimeoutsRef.current) {
        clearTimeout(timeout);
      }
      boardFxTimeoutsRef.current = [];
      pendingBombVisualRef.current = null;
      prevYourPieceRef.current = null;
      prevSelfBoardRef.current = null;
      prevOpponentBoardRef.current = null;
      prevBoardForLineClearFxRef.current = null;
      lineClearParticlesRef.current = [];
      hardDropParticlesRef.current = [];
      hardDropTrailRef.current = null;
      if (lineClearParticlesRafRef.current !== null) {
        cancelAnimationFrame(lineClearParticlesRafRef.current);
        lineClearParticlesRafRef.current = null;
      }
      const overlayCanvas = lineClearOverlayRef.current;
      const overlayCtx = overlayCanvas?.getContext('2d');
      if (overlayCanvas && overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      pendingBoardAbilityFxRef.current = { self: null, opponent: null };
      client.disconnect();
      audioManager.stopMusic(true);
    };
  }, [roomId, playerId, onExit, aiOpponent, debugLogger, profile.loadout, mockMode]);

  // Fetch opponent's profile for Rank calculation
  useEffect(() => {
    // Opponent profile fetching removed - no longer needed
  }, [opponentId]);

  // Initialize renderers
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new TetrisRenderer(canvasRef.current, 25, selfBoardTheme);
    }
    if (opponentCanvasRef.current) {
      opponentRendererRef.current = new TetrisRenderer(opponentCanvasRef.current, 8, theme);
    }
  }, [selfBoardTheme, theme]);

  // Render own board from authoritative server state
  useEffect(() => {
    if (rendererRef.current && yourState) {
      rendererRef.current.setTheme(selfBoardTheme);
      applyBoardDiffAnimations(
        rendererRef.current,
        'self',
        yourState.board,
        yourState.activeEffects
      );

      const board = {
        grid: yourState.board,
        width: yourBoardWidth,
        height: yourBoardHeight,
      };
      rendererRef.current.setBlockSize(yourBoardDisplay.cellSize);

      // Check active effects from server
      const blindSpotActive = yourState.activeEffects?.includes('blind_spot');
      const shrinkCeilingActive = yourState.activeEffects?.includes('shrink_ceiling');

      rendererRef.current.render(board, yourState.currentPiece, yourState.magnetGhost ?? null, {
        showGrid: true,
        showGhost: !!yourState.magnetGhost,
        isBomb: pendingBombVisualRef.current !== null,
        bombType: pendingBombVisualRef.current as 'circle_bomb' | 'cross_firebomb' | undefined,
        blindSpotRows: blindSpotActive ? 4 : 0,
      });

      // Draw shrink ceiling overlay
      if (shrinkCeilingActive) {
        rendererRef.current.drawShrinkCeiling(board, 4);
      }

      // Bomb visual should happen when the bombed piece actually locks and a new piece spawns.
      const prevPiece = prevYourPieceRef.current;
      const currPiece = yourState.currentPiece;
      if (pendingBombVisualRef.current && prevPiece && currPiece) {
        const prevY = prevPiece.position?.y ?? prevPiece.y ?? 0;
        const currY = currPiece.position?.y ?? currPiece.y ?? 0;
        if (currY < prevY) {
          triggerBoardAbilityVisual(pendingBombVisualRef.current, 'self');
          pendingBombVisualRef.current = null;
        }
      }
      prevYourPieceRef.current = currPiece;
    }
  }, [
    yourState,
    applyBoardDiffAnimations,
    triggerBoardAbilityVisual,
    selfBoardTheme,
    yourBoardDisplay.cellSize,
    yourBoardHeight,
    yourBoardWidth,
  ]);

  // Render opponent's board
  useEffect(() => {
    if (opponentRendererRef.current && opponentState) {
      opponentRendererRef.current.setTheme(theme);
      applyBoardDiffAnimations(
        opponentRendererRef.current,
        'opponent',
        opponentState.board,
        opponentState.activeEffects
      );

      const opponentBoard = {
        grid: opponentState.board,
        width: opponentBoardWidth,
        height: opponentBoardHeight,
      };
      opponentRendererRef.current.setBlockSize(opponentBoardDisplay.cellSize);
      opponentRendererRef.current.render(opponentBoard, opponentState.currentPiece, opponentState.magnetGhost ?? null, {
        showGrid: true,
        showGhost: !!opponentState.magnetGhost,
      });
    }
  }, [
    opponentState,
    applyBoardDiffAnimations,
    theme,
    opponentBoardDisplay.cellSize,
    opponentBoardHeight,
    opponentBoardWidth,
  ]);

  // Track opponent state changes for debug logging
  const prevOpponentStateRef = useRef<any>(null);
  useEffect(() => {
    if (!opponentState || !debugLogger) return;

    const prev = prevOpponentStateRef.current;
    if (!prev) {
      prevOpponentStateRef.current = opponentState;
      return;
    }

    // Detect opponent piece movement (position changes)
    if (prev.currentPiece && opponentState.currentPiece) {
      const prevX = prev.currentPiece.x;
      const prevY = prev.currentPiece.y;
      const prevRotation = prev.currentPiece.rotation;
      const currX = opponentState.currentPiece.x;
      const currY = opponentState.currentPiece.y;
      const currRotation = opponentState.currentPiece.rotation;

      // Rotation change
      if (prevRotation !== currRotation) {
        debugLogger.logEvent('opponent_rotate', `Opponent rotated piece`, { rotation: currRotation });
      }

      // Horizontal movement
      if (prevX !== currX) {
        const direction = currX > prevX ? 'right' : 'left';
        debugLogger.logEvent('opponent_move', `Opponent moved ${direction}`, { x: currX });
      }

      // Vertical movement (soft drop)
      if (prevY !== currY && currY > prevY) {
        debugLogger.logEvent('opponent_drop', `Opponent soft dropped`, { y: currY });
      }
    }

    // Detect opponent piece placement (new piece spawned)
    if (prev.currentPiece?.type !== opponentState.currentPiece?.type) {
      debugLogger.logEvent('opponent_place', `Opponent placed piece (${prev.currentPiece?.type})`, {
        piece: prev.currentPiece?.type,
        newPiece: opponentState.currentPiece?.type
      });
    }

    // Detect opponent line clears
    if (opponentState.linesCleared > prev.linesCleared) {
      const linesDiff = opponentState.linesCleared - prev.linesCleared;
      const label = linesDiff >= 4 ? 'TETRIS' : linesDiff === 3 ? 'Triple' : linesDiff === 2 ? 'Double' : 'Single';
      debugLogger.logEvent('opponent_clear', `Opponent cleared ${linesDiff} line${linesDiff > 1 ? 's' : ''} (${label})`, {
        lines: linesDiff,
        total: opponentState.linesCleared
      });
    }

    // Detect opponent score changes
    if (opponentState.score > prev.score) {
      const scoreDiff = opponentState.score - prev.score;
      debugLogger.logEvent('opponent_score', `Opponent scored +${scoreDiff} points`, {
        points: scoreDiff,
        total: opponentState.score
      });
    }

    // Detect opponent game over
    if (!prev.isGameOver && opponentState.isGameOver) {
      debugLogger.logEvent('opponent_gameover', `Opponent's game ended`, {});
    }

    prevOpponentStateRef.current = opponentState;
  }, [opponentState, debugLogger]);

  // Star earned popup state
  const prevStarsRef = useRef(0);
  const [starPopups, setStarPopups] = useState<Array<{ id: number; amount: number; combo: number }>>([]);

  // Track line clears from server for effects
  const prevLinesRef = useRef(0);
  useEffect(() => {
    if (!yourState || !Array.isArray(yourState.board)) return;

    if (prevLinesRef.current === 0 && yourState.linesCleared > 4) {
      prevLinesRef.current = yourState.linesCleared;
      prevBoardForLineClearFxRef.current = cloneBoardGrid(yourState.board);
      return;
    }

    const linesDiff = yourState.linesCleared - prevLinesRef.current;
    if (linesDiff > 0) {
      console.log(`[SERVER-AUTH] ${linesDiff} lines cleared!`);
      triggerLineClearExplosionPulse(linesDiff);

      const previousBoard = prevBoardForLineClearFxRef.current;
      if (previousBoard) {
        const clearedRows = extractClearedRowsFromPreviousBoard(previousBoard, linesDiff);
        if (clearedRows.length > 0) {
          const boardWidth = previousBoard[0]?.length ?? yourState.board[0]?.length ?? 10;
          const boardHeight = previousBoard.length || yourState.board.length || 20;
          spawnLineClearParticles(clearedRows, boardWidth, boardHeight);

          // Spawn cyberpunk particles for each cleared cell
          const CELL_SIZE = yourBoardDisplay.cellSize;
          clearedRows.forEach(({ rowIndex, cells }) => {
            cells.forEach((cellColor, colIndex) => {
              if (cellColor) {
                const x = colIndex * CELL_SIZE + CELL_SIZE / 2;
                const y = rowIndex * CELL_SIZE + CELL_SIZE / 2;
                // Burst particles (explosive)
                cyberpunkParticlesRef.current?.addParticles(x, y, cellColor, 8, 'burst');
                // Line sweep particles (slower, glowing)
                cyberpunkParticlesRef.current?.addParticles(x, y, cellColor, 3, 'lineSweep');
              }
            });
          });

          // Add floating text for line clear
          const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
          const colors = ['', '#ffffff', '#00f0f0', '#f0a020', '#ff2080'];
          const label = labels[linesDiff] || 'MULTI!';
          const labelColor = colors[linesDiff] || '#ff2080';
          const size = linesDiff === 4 ? 24 : 18;
          const comboCount = yourState.comboCount ?? 0;
          const comboText = comboCount > 1 ? ` ×${comboCount}` : '';

          // Get center row for positioning
          const centerRowIndex = clearedRows[Math.floor(clearedRows.length / 2)]?.rowIndex ?? 10;

          // Line clear label
          addFloatingText(
            label + comboText,
            boardWidth * CELL_SIZE / 2,
            centerRowIndex * CELL_SIZE - 10,
            labelColor,
            size
          );

          // Score earned (estimate based on lines cleared)
          const baseScore = linesDiff * 100;
          const scoreEarned = baseScore * (comboCount > 1 ? comboCount : 1);
          addFloatingText(
            `+${scoreEarned}`,
            boardWidth * CELL_SIZE / 2,
            centerRowIndex * CELL_SIZE + 18,
            '#ffffffcc',
            13
          );

          // Add flashing row effect (280ms duration)
          const flashDuration = 280;
          const now = Date.now();
          const newFlashingRows = clearedRows.map(({ rowIndex }) => ({
            rowIndex,
            expiresAt: now + flashDuration
          }));
          setFlashingRows(prev => [...prev, ...newFlashingRows]);
          setTimeout(() => {
            setFlashingRows(prev => prev.filter(row => row.expiresAt > Date.now()));
          }, flashDuration + 50);
        }
      }

      if (linesDiff >= 4) {
        // TETRIS!
        haptics.heavy();
        setScreenShake(3);
        setFlashEffect({ color: 'rgba(0, 255, 136, 0.8)' });
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          setParticles({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: Date.now() });
        }
      } else if (linesDiff >= 2) {
        haptics.medium();
        setScreenShake(2);
        setFlashEffect({ color: 'rgba(0, 212, 255, 0.6)' });
      } else {
        haptics.light();
        setScreenShake(1);
        setFlashEffect({ color: 'rgba(255, 255, 255, 0.4)' });
      }

      setTimeout(() => setScreenShake(0), 400);
    }
    prevLinesRef.current = yourState.linesCleared;
    prevBoardForLineClearFxRef.current = cloneBoardGrid(yourState.board);
  }, [
    yourState?.linesCleared,
    yourState?.board,
    yourState?.comboCount,
    spawnLineClearParticles,
    triggerLineClearExplosionPulse,
    addFloatingText,
    yourBoardDisplay.cellSize,
  ]);

  // Show "+N ⭐" popup when stars are earned (threshold filters passive regen)
  useEffect(() => {
    if (!yourState) return;
    const diff = yourState.stars - prevStarsRef.current;
    // Passive regen is ~1/sec; only pop on meaningful earns (line clears, abilities, etc.)
    if (diff >= 3) {
      const id = Date.now();
      const combo = yourState.comboCount ?? 0;
      setStarPopups(prev => [...prev, { id, amount: diff, combo }]);
      setTimeout(() => setStarPopups(prev => prev.filter(p => p.id !== id)), 1400);
    }
    prevStarsRef.current = yourState.stars;
  }, [yourState?.stars]);

  // Track piece changes for lock particles
  const prevPieceRef = useRef<any>(null);
  useEffect(() => {
    if (!yourState?.currentPiece) return;

    const currentPiece = yourState.currentPiece as any;
    const prevPiece = prevPieceRef.current;

    // Detect when piece changes (previous piece locked, new piece spawned)
    if (prevPiece && (
      prevPiece.type !== currentPiece.type ||
      prevPiece.x !== currentPiece.x ||
      prevPiece.y !== currentPiece.y ||
      Math.abs(prevPiece.x - currentPiece.x) > 3 // New piece spawned at different location
    )) {
      // Previous piece locked - spawn lock particles and flash
      const CELL_SIZE = yourBoardDisplay.cellSize;
      const shape = prevPiece.shape || [];
      const color = prevPiece.color || '#00d4ff';
      const lockCells: Array<{ x: number; y: number }> = [];

      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const x = (prevPiece.x + c) * CELL_SIZE + CELL_SIZE / 2;
            const y = (prevPiece.y + r) * CELL_SIZE + CELL_SIZE / 2;
            cyberpunkParticlesRef.current?.addParticles(x, y, color, 3, 'lock');
            lockCells.push({ x: prevPiece.x + c, y: prevPiece.y + r });
          }
        }
      }

      // Trigger lock flash effect (180ms duration)
      if (lockCells.length > 0) {
        setLockFlash({
          cells: lockCells,
          color,
          expiresAt: Date.now() + 180
        });
        setTimeout(() => setLockFlash(null), 200);
      }
    }

    prevPieceRef.current = currentPiece;
  }, [yourBoardDisplay.cellSize, yourState?.currentPiece]);

  // Handle ability activation
  const handleAbilityActivate = (ability: Ability) => {
    if (!yourState) return;

    if (mockMode) {
      if (yourState.stars < ability.cost) return;
      const target = getAbilityTargeting(ability);
      setYourState((prev: any) =>
        prev
          ? {
              ...prev,
              stars: Math.max(0, prev.stars - ability.cost),
            }
          : prev
      );
      queueNotification(
        ability.name,
        ability.description,
        isDebuffAbility(ability) ? 'debuff' : 'buff'
      );
      queueBoardAbilityFx(ability.type, target);
      triggerBoardAbilityVisual(ability.type, target);
      return;
    }

    if (!gameClientRef.current) return;

    // In debug mode, bypass star cost check
    if (!isDebugMode && yourState.stars < ability.cost) {
      console.warn('[SERVER-AUTH] Not enough stars for ability');
      return;
    }

    console.log('[SERVER-AUTH] Activating ability:', ability.name);
    const target = getAbilityTargeting(ability);
    const targetPlayerId = target === 'self' ? playerId : opponentId;
    const requestId = gameClientRef.current.activateAbility(ability.type, targetPlayerId);

    if (!requestId) {
      console.warn('[SERVER-AUTH] Failed to send ability activation request');
      debugLoggerRef.current?.logEvent('ability_send_failed', `Failed to send ${ability.name} to server`, {
        ability: ability.type,
        target,
      });
      return;
    }

    pendingAbilityActivationsRef.current.set(requestId, { ability, target });
    debugLoggerRef.current?.logEvent('ability_attempted', `Attempted ${ability.name} (${ability.shortName}) on ${target}`, {
      requestId,
      ability: ability.type,
      name: ability.name,
      category: ability.category,
      target,
    });
    const timeout = setTimeout(() => {
      if (!pendingAbilityActivationsRef.current.has(requestId)) return;
      pendingAbilityActivationsRef.current.delete(requestId);
      abilityResponseTimeoutsRef.current.delete(requestId);
      debugLoggerRef.current?.logEvent(
        'ability_no_response',
        `No server response for ${ability.name} (${requestId})`,
        {
          requestId,
          ability: ability.type,
          target,
        }
      );
    }, 3000);
    abilityResponseTimeoutsRef.current.set(requestId, timeout);
  };

  // Handle server acceptance/rejection for your ability requests
  const handleAbilityActivationResult = (result: AbilityActivationResult) => {
    const pending = result.requestId ? pendingAbilityActivationsRef.current.get(result.requestId) : undefined;
    if (result.requestId) {
      pendingAbilityActivationsRef.current.delete(result.requestId);
      const timeout = abilityResponseTimeoutsRef.current.get(result.requestId);
      if (timeout) {
        clearTimeout(timeout);
        abilityResponseTimeoutsRef.current.delete(result.requestId);
      }
    }

    const abilityFromCatalog = ABILITIES[result.abilityType as keyof typeof ABILITIES];
    const ability = pending?.ability || abilityFromCatalog;
    const target = pending?.target || (result.targetPlayerId === playerId ? 'self' : 'opponent');

    if (result.accepted) {
      if (ability) {
        queueNotification(
          ability.name,
          ability.description,
          isDebuffAbility(ability) ? 'debuff' : 'buff'
        );
        if (isDebuffAbility(ability)) {
          audioManager.playSfx('ability_debuff_activate');
        } else {
          audioManager.playSfx('ability_buff_activate');
        }
        queueBoardAbilityFx(ability.type, target);
        if (BOMB_ABILITY_TYPES.has(ability.type) && target === 'self') {
          pendingBombVisualRef.current = ability.type;
        } else {
          triggerBoardAbilityVisual(ability.type, target);
        }
      }
      debugLoggerRef.current?.logEvent(
        'ability_used',
        `Ability accepted: ${ability?.name || result.abilityType} on ${target}`,
        {
          ...result,
          target,
          abilityName: ability?.name,
        }
      );
      return;
    }

    console.warn('[SERVER-AUTH] Ability rejected:', result);
    debugLoggerRef.current?.logEvent(
      'ability_rejected',
      `Ability rejected: ${ability?.name || result.abilityType} (${result.reason || 'unknown'})`,
      {
        ...result,
        target,
        abilityName: ability?.name,
      }
    );
  };

  // Handle receiving ability from opponent
  const handleAbilityReceived = (abilityType: string, fromPlayerId: string) => {
    if (fromPlayerId === playerId) {
      // Self-targeted buff notification is handled by ability_activation_result path.
      return;
    }
    console.log('[SERVER-AUTH] Received ability from opponent:', abilityType);

    const abilities = Object.values(ABILITIES);
    const ability = abilities.find((a: any) => a.type === abilityType);

    if (!ability) return;

    // Log ability received in debug mode
    debugLoggerRef.current?.logEvent('opponent_ability', `Opponent used ${ability.name} (${ability.shortName}) on you`, {
      ability: abilityType,
      name: ability.name,
      category: ability.category
    });

    // Show notification for the ability received
    queueNotification(
      ability.name,
      ability.description,
      isDebuffAbility(ability) ? 'debuff' : 'buff'
    );

    audioManager.playSfx('ability_debuff_activate');

    queueBoardAbilityFx(abilityType, 'self');
    triggerBoardAbilityVisual(abilityType, 'self');
  };

  // Calculate and save match rewards
  const calculateMatchRewards = useCallback(async (isWin: boolean) => {
    console.log('[SERVER-AUTH REWARDS] Starting reward calculation...', { isWin, aiOpponent, profile });

    const outcome: 'win' | 'loss' = isWin ? 'win' : 'loss';
    const matchDuration = Math.floor((Date.now() - matchStartTimeRef.current) / 1000);

    // Determine opponent type
    let opponentType: 'human' | 'ai_easy' | 'ai_medium' | 'ai_hard';
    if (aiOpponent) {
      // AI opponent - use difficulty from aiOpponent object
      opponentType = aiOpponent.difficulty || 'ai_medium';
    } else {
      // Human opponent
      opponentType = 'human';
    }

    // Call new reward system
    const rewards = await awardMatchRewards(
      profile.userId,
      outcome,
      opponentType,
      matchDuration,
      opponentId
    );

    if (rewards) {
      setMatchRewards(rewards);
    }
  }, [profile, opponentId, aiOpponent]);

  const sendMobileInput = useCallback((input: 'move_left' | 'move_right' | 'soft_drop' | 'hard_drop' | 'rotate_cw') => {
    if (!gameClientRef.current || !yourState || yourState.isGameOver || gameFinished) return;

    switch (input) {
      case 'move_left':
        haptics.light();
        audioManager.playSfx('piece_move_left', 0.3);
        break;
      case 'move_right':
        haptics.light();
        audioManager.playSfx('piece_move_right', 0.3);
        break;
      case 'soft_drop':
        haptics.light();
        audioManager.playSfx('soft_drop', 0.4);
        break;
      case 'hard_drop':
        haptics.medium();
        audioManager.playSfx('hard_drop');
        triggerHardDropBounce();
        triggerHardDropTrailImpact();
        break;
      case 'rotate_cw':
        haptics.light();
        audioManager.playSfx('piece_rotate', 0.5);
        break;
    }

    gameClientRef.current.sendInput(input);
  }, [yourState, gameFinished, triggerHardDropBounce, triggerHardDropTrailImpact]);

  const handleMoveLeft = useCallback(() => sendMobileInput('move_left'), [sendMobileInput]);
  const handleMoveRight = useCallback(() => sendMobileInput('move_right'), [sendMobileInput]);
  const handleSoftDrop = useCallback(() => sendMobileInput('soft_drop'), [sendMobileInput]);
  const handleHardDrop = useCallback(() => sendMobileInput('hard_drop'), [sendMobileInput]);
  const handleRotateCw = useCallback(() => sendMobileInput('rotate_cw'), [sendMobileInput]);


  // Keyboard controls - send inputs to server
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameClientRef.current || !yourState || yourState.isGameOver || gameFinished) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          audioManager.playSfx('piece_move_left', 0.3);
          gameClientRef.current.sendInput('move_left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          audioManager.playSfx('piece_move_right', 0.3);
          gameClientRef.current.sendInput('move_right');
          break;
        case 'ArrowDown':
          e.preventDefault();
          audioManager.playSfx('soft_drop', 0.4);
          gameClientRef.current.sendInput('soft_drop');
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          audioManager.playSfx('piece_rotate', 0.5);
          gameClientRef.current.sendInput('rotate_cw');
          break;
        case ' ':
          e.preventDefault();
          audioManager.playSfx('hard_drop');
          haptics.medium();
          triggerHardDropBounce();
          triggerHardDropTrailImpact();
          gameClientRef.current.sendInput('hard_drop');
          break;
        case '1':
        case '2':
        case '3':
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (availableAbilities[index]) {
            handleAbilityActivate(availableAbilities[index]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [yourState, gameFinished, availableAbilities, triggerHardDropBounce, triggerHardDropTrailImpact]);

  // Calculate rewards when game finishes
  useEffect(() => {
    if (gameFinished && winnerId && !matchRewards) {
      const isWin = winnerId === playerId;

      // Log game result in debug mode
      if (debugLogger) {
        if (isWin) {
          debugLogger.logEvent('game_win', `You won the game!`, { winnerId });
        } else {
          debugLogger.logEvent('game_lose', `Opponent won the game`, { winnerId });
        }
      }

      calculateMatchRewards(isWin);
    }
  }, [gameFinished, winnerId, playerId, matchRewards, calculateMatchRewards, debugLogger]);

  // Play victory or defeat music
  useEffect(() => {
    if (gameFinished && winnerId) {
      const isWin = winnerId === playerId;
      audioManager.stopMusic();
      if (isWin) {
        audioManager.playMusic('victory_theme', false);
        haptics.success();
      } else {
        audioManager.playMusic('defeat_theme', false);
        haptics.error();
      }
    }
  }, [gameFinished, winnerId, playerId]);

  const isWinner = winnerId === playerId;
  const useLegacyMobileLayout = false;
  const demoGridCellSize = 64;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 50%, #0f0a1e 100%)',
        color: '#ffffff',
        fontFamily: '"Orbitron", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      <FloatingBackground />
      {useLegacyMobileLayout && isMobilePortrait ? (
        <MobileGameLayout
          header={(
            <GameHeader
              score={yourState?.score ?? 0}
              stars={yourState?.stars ?? 0}
              linesCleared={yourState?.linesCleared ?? 0}
              comboCount={yourState?.comboCount ?? 0}
              notifications={abilityNotifications}
              isConnected={isConnected}
              connectionStats={connectionStats}
            />
          )}
          nextQueue={<NextPieceQueue nextPieces={displayNextPieces} maxItems={5} />}
          board={(
            <motion.div
              animate={
                screenShake > 0
                  ? {
                      x: [0, -10 * screenShake, 10 * screenShake, -10 * screenShake, 10 * screenShake, 0],
                      y: [0, -5 * screenShake, 5 * screenShake, -5 * screenShake, 5 * screenShake, 0],
                      rotate: [0, -2 * screenShake, 2 * screenShake, -2 * screenShake, 2 * screenShake, 0],
                    }
                  : stateHasEffect(yourState, 'screen_shake')
                  ? {
                      x: [0, -5, 5, -5, 5, 0],
                      y: [0, -3, 3, -3, 3, 0],
                      rotate: [0, -1, 1, -1, 1, 0],
                    }
                  : { x: 0, y: 0, rotate: 0 }
              }
              transition={{
                duration: 0.4,
                repeat: stateHasEffect(yourState, 'screen_shake') ? Infinity : 0,
                ease: 'easeOut',
              }}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {yourDefensiveAbility && (
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    zIndex: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '4px 6px',
                    borderRadius: '6px',
                    background: yourDefensiveAbility === 'reflect' ? 'rgba(201,66,255,0.2)' : 'rgba(0,212,255,0.2)',
                    border: `1px solid ${yourDefensiveAbility === 'reflect' ? 'rgba(201,66,255,0.5)' : 'rgba(0,212,255,0.5)'}`,
                    color: yourDefensiveAbility === 'reflect' ? '#c942ff' : '#00d4ff',
                  }}
                >
                  <span>{yourDefensiveAbility === 'reflect' ? '🪞' : '🛡️'}</span>
                  <span>{yourDefensiveAbility === 'reflect' ? 'REFLECT' : 'SHIELD'}</span>
                </div>
              )}
              <div
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  transform: getTiltAngle(yourState) ? `rotate(${getTiltAngle(yourState)}deg) scale(0.96)` : 'none',
                  transition: 'transform 200ms ease-out',
                  position: 'relative',
                  background: selfBoardShellBackground,
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  borderRadius: '9px',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={yourBoardDisplay.pixelWidth}
                  height={yourBoardDisplay.pixelHeight}
                  style={{
                    display: 'block',
                    position: 'relative',
                    zIndex: 1,
                    height: `${yourBoardDisplay.pixelHeight}px`,
                    maxHeight: 'calc(100dvh - 170px)',
                    width: `${yourBoardDisplay.pixelWidth}px`,
                    maxWidth: '100%',
                    borderRadius: '9px',
                    border: `1px solid ${selfBoardFx?.borderColor || 'rgba(0, 240, 240, 0.09)'}`,
                    backgroundColor: 'transparent',
                    boxShadow: selfBoardFx?.glow || '0 0 30px rgba(0, 240, 240, 0.03)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '9px',
                    pointerEvents: 'none',
                    zIndex: 2,
                    background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(3,3,15,0.65) 100%)',
                  }}
                />
                <canvas
                  ref={lineClearOverlayRef}
                  width={yourBoardDisplay.pixelWidth}
                  height={yourBoardDisplay.pixelHeight}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
                <CyberpunkParticles
                  ref={cyberpunkParticlesRef}
                  width={yourBoardDisplay.pixelWidth}
                  height={yourBoardDisplay.pixelHeight}
                />
                {stateHasEffect(yourState, 'ink_splash') && !mockMode && (
                  <InkSplashMask idPrefix="mobile-self" borderRadius="9px" />
                )}
              </div>
              <AnimatePresence>
                {starPopups.map((popup) => (
                  <motion.div
                    key={popup.id}
                    initial={{ opacity: 0, y: 0, scale: 0.7 }}
                    animate={{ opacity: 1, y: -16, scale: 1 }}
                    exit={{ opacity: 0, y: -46, scale: 0.85 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      top: '34%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                      zIndex: 50,
                      fontSize: '18px',
                      fontWeight: 900,
                      color: '#c942ff',
                      textShadow: '0 0 16px rgba(201,66,255,0.9), 0 0 32px rgba(201,66,255,0.5)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    +{popup.amount} ⭐
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Floating score text on line clears */}
              {floatingTexts.map(ft => {
                const age = Math.min((Date.now() - ft.born) / 1400, 1);
                return (
                  <div key={ft.id} style={{
                    position: 'absolute',
                    left: ft.x,
                    top: ft.y - age * 50,
                    transform: `translateX(-50%) scale(${1 + age * 0.15})`,
                    fontSize: ft.size,
                    fontWeight: 900,
                    color: ft.color,
                    textShadow: `0 0 10px ${ft.color}, 0 0 30px ${ft.color}66`,
                    opacity: age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85,
                    zIndex: 20,
                    pointerEvents: 'none',
                    letterSpacing: 3,
                    whiteSpace: 'nowrap',
                    fontFamily: 'Orbitron',
                  }}>
                    {ft.text}
                  </div>
                );
              })}
              {/* Lock flash effect on piece settling */}
              {lockFlash && lockFlash.expiresAt > Date.now() && lockFlash.cells.map((cell, i) => {
                const CELL_SIZE = yourBoardDisplay.cellSize;
                const age = Math.min((Date.now() - (lockFlash.expiresAt - 180)) / 180, 1);
                const opacity = 1 - age;
                const scale = 1.15 - (age * 0.15);

                return (
                  <div
                    key={`lf-${i}`}
                    style={{
                      position: 'absolute',
                      left: cell.x * CELL_SIZE - 4,
                      top: cell.y * CELL_SIZE - 4,
                      width: CELL_SIZE + 8,
                      height: CELL_SIZE + 8,
                      background: `radial-gradient(circle, ${lockFlash.color}44, transparent 70%)`,
                      opacity,
                      transform: `scale(${scale})`,
                      zIndex: 3,
                      pointerEvents: 'none',
                      transition: 'opacity 0.18s ease-out, transform 0.18s ease-out',
                    }}
                  />
                );
              })}
            </motion.div>
          )}
          opponentPreview={(
            <OpponentPreview
              canvasRef={opponentCanvasRef}
              score={opponentState?.score ?? 0}
              stars={opponentState?.stars ?? 0}
              defensiveAbility={opponentDefensiveAbility}
            />
          )}
          abilityDock={(
            <AbilityDock
              abilities={availableAbilities}
              stars={yourState?.stars ?? 0}
              timedEffects={yourTimedEffects}
              onActivate={(ability) => {
                haptics.medium();
                handleAbilityActivate(ability);
              }}
            />
          )}
          controls={(
            <GameTouchControls
              onMoveLeft={handleMoveLeft}
              onMoveRight={handleMoveRight}
              onHardDrop={handleHardDrop}
              onSoftDrop={handleSoftDrop}
              onRotateCw={handleRotateCw}
            />
          )}
        />
      ) : (
        <>
      {/* Top HUD: floating text stats + compact latency badge */}
      <motion.div
        animate={statsBlastControls}
        ref={topInfoZoneRef}
        data-zone="top-info-zone"
        style={{
          position: 'relative',
          paddingTop: statsCardsTop,
          paddingLeft: statsOverlaySidePadding,
          paddingRight: statsOverlaySidePadding,
          paddingBottom: statsToBoardGap,
          zIndex: 7,
          pointerEvents: 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 'clamp(8px, 1.6vw, 16px)',
          alignItems: 'start',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {[
          {
            key: 'score',
            label: 'SCORE',
            value: yourState?.score ?? 0,
            color: '#67eaff',
            glow: '0 0 10px rgba(0, 212, 255, 0.6), 0 0 20px rgba(0, 212, 255, 0.28)',
          },
          {
            key: 'stars',
            label: 'STARS',
            value: yourState?.stars ?? 0,
            color: '#df82ff',
            glow: '0 0 10px rgba(201, 66, 255, 0.58), 0 0 20px rgba(201, 66, 255, 0.24)',
          },
          {
            key: 'lines',
            label: 'LINES',
            value: yourState?.linesCleared ?? 0,
            color: '#7dffb0',
            glow: '0 0 10px rgba(0, 255, 136, 0.55), 0 0 20px rgba(0, 255, 136, 0.22)',
          },
        ].map((stat) => (
          <div key={stat.key} style={{ minWidth: 0, textAlign: 'center' }}>
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
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`hud-${stat.key}-${stat.value}`}
                variants={scoreVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={springs.gentle}
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
              </motion.div>
            </AnimatePresence>
          </div>
        ))}
      </motion.div>
      <motion.button
        whileTap="tap"
        variants={buttonVariants}
        transition={springs.snappy}
        onClick={onExit}
        title="Exit match"
        aria-label="Exit match"
        style={{
          position: 'absolute',
          top: '2px',
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
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            display: 'inline-block',
            background:
              connectionStats?.quality === 'excellent'
                ? '#4ade80'
                : connectionStats?.quality === 'good'
                ? '#fbbf24'
                : connectionStats?.quality === 'poor'
                ? '#fb923c'
                : '#ef4444',
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
          {Number.isFinite(connectionStats?.avgLatency)
            ? `${Math.round(connectionStats!.avgLatency)}ms`
            : '--'}
        </span>
      </motion.button>
      {/* Main Game Area */}
	      <div
          data-zone="middle-play-zone"
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            paddingLeft: 'clamp(2px, 0.5vw, 4px)',
            paddingRight: 'clamp(2px, 0.5vw, 4px)',
            paddingBottom: boardBottomPadding,
            paddingTop: statsToBoardGap,
            gap: 'clamp(2px, 0.5vw, 4px)',
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
            {displayNextPieces.length > 0 && (
              <NextPiecePanel nextPieces={displayNextPieces} />
            )}
          </div>

	        {/* Player Board Zone */}
	        <div
            ref={playerBoardZoneRef}
            data-zone="player-board-zone"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              position: 'relative',
            }}
          >
          {/* Defensive Ability Indicator - Your Board */}
          {yourDefensiveAbility && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: yourDefensiveAbility === 'reflect' 
                  ? 'rgba(201, 66, 255, 0.2)' 
                  : 'rgba(0, 212, 255, 0.2)',
                border: `2px solid ${yourDefensiveAbility === 'reflect' ? 'rgba(201, 66, 255, 0.6)' : 'rgba(0, 212, 255, 0.6)'}`,
                borderRadius: '8px',
                padding: '6px 10px',
                boxShadow: yourDefensiveAbility === 'reflect'
                  ? '0 0 15px rgba(201, 66, 255, 0.5), inset 0 0 10px rgba(201, 66, 255, 0.2)'
                  : '0 0 15px rgba(0, 212, 255, 0.5), inset 0 0 10px rgba(0, 212, 255, 0.2)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {yourDefensiveAbility === 'reflect' ? '🪞' : '🛡️'}
              </span>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                color: yourDefensiveAbility === 'reflect' ? '#c942ff' : '#00d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {yourDefensiveAbility === 'reflect' ? 'REFLECT' : 'SHIELD'}
              </span>
            </div>
          )}
          <motion.div
            animate={
              screenShake > 0
                ? {
                    x: [0, -10 * screenShake, 10 * screenShake, -10 * screenShake, 10 * screenShake, 0],
                    y: [0, -5 * screenShake, 5 * screenShake, -5 * screenShake, 5 * screenShake, 0],
                    rotate: [0, -2 * screenShake, 2 * screenShake, -2 * screenShake, 2 * screenShake, 0],
                  }
                : stateHasEffect(yourState, 'screen_shake')
                ? {
                    x: [0, -5, 5, -5, 5, 0],
                    y: [0, -3, 3, -3, 3, 0],
                    rotate: [0, -1, 1, -1, 1, 0],
                  }
                : { x: 0, y: 0, rotate: 0 }
            }
            transition={{
              duration: 0.4,
              repeat: stateHasEffect(yourState, 'screen_shake') ? Infinity : 0,
              ease: 'easeOut',
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              position: 'relative',
            }}
          >
            <motion.div
              animate={playerDropBounceControls}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}
            >
              <div
                style={{
                  position: 'relative',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  width: 'fit-content',
                  transform: getTiltAngle(yourState)
                    ? `rotate(${getTiltAngle(yourState)}deg) scale(0.96)`
                    : 'none',
                  transition: 'transform 200ms ease-out',
                  background: selfBoardShellBackground,
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: 'clamp(6px, 1.5vw, 10px)',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={yourBoardDisplay.pixelWidth}
                  height={yourBoardDisplay.pixelHeight}
                  style={{
                    display: 'block',
                    position: 'relative',
                    zIndex: 1,
                    maxWidth: '100%',
                    height: `${yourBoardDisplay.pixelHeight}px`,
                    width: `${yourBoardDisplay.pixelWidth}px`,
                    objectFit: 'contain',
                    borderRadius: 'clamp(6px, 1.5vw, 10px)',
                    border: `1px solid ${selfBoardFx?.borderColor || 'rgba(0, 240, 240, 0.15)'}`,
                    backgroundColor: 'transparent',
                    boxShadow: selfBoardFx?.glow || '0 0 20px rgba(0, 240, 240, 0.08), 0 0 60px rgba(0, 240, 240, 0.03)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'clamp(6px, 1.5vw, 10px)',
                    pointerEvents: 'none',
                    zIndex: 2,
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,10,24,0.6) 100%)',
                  }}
                />
                <canvas
                  ref={lineClearOverlayRef}
                  width={yourBoardDisplay.pixelWidth}
                  height={yourBoardDisplay.pixelHeight}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
                {stateHasEffect(yourState, 'ink_splash') && !mockMode && (
                  <InkSplashMask idPrefix="self" borderRadius="clamp(6px, 1.5vw, 10px)" />
                )}
              </div>
            </motion.div>
            {/* Stars earned popups */}
            <AnimatePresence>
              {starPopups.map(popup => (
                <motion.div
                  key={popup.id}
                  initial={{ opacity: 0, y: 0, scale: 0.7 }}
                  animate={{ opacity: 1, y: -20, scale: 1 }}
                  exit={{ opacity: 0, y: -55, scale: 0.85 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: '38%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex: 50,
                    fontSize: 'clamp(20px, 5vw, 28px)',
                    fontWeight: '900',
                    color: '#c942ff',
                    textShadow: '0 0 16px rgba(201,66,255,0.9), 0 0 32px rgba(201,66,255,0.5)',
                    letterSpacing: '1px',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  +{popup.amount} ⭐
                  {popup.combo > 0 && (
                    <span style={{ fontSize: '0.6em', opacity: 0.85, marginLeft: '6px', color: '#ffd700', textShadow: '0 0 12px rgba(255,215,0,0.8)' }}>
                      COMBO x{popup.combo + 1}
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

	        {/* Right: Vertical Panel */}
	        <motion.div
            animate={rightPanelBlastControls}
            ref={rightInfoZoneRef}
            data-zone="right-info-zone"
	          style={{
	          width: 'clamp(85px, 22vw, 110px)',
	          display: 'flex',
	          flexDirection: 'column',
	          gap: 'clamp(4px, 1vh, 8px)',
	          overflow: 'hidden',
	        }}>
	          {/* Opponent's Board */}
		          <div style={{
		            display: 'flex',
		            flexDirection: 'column',
		            alignItems: 'center',
		            background: 'transparent',
		            padding: 'clamp(4px, 1vw, 6px)',
		            borderRadius: 'clamp(6px, 1.5vw, 10px)',
		            position: 'relative',
		          }}>
	            {/* Defensive Ability Indicator - Opponent */}
	            {opponentDefensiveAbility && (
	              <div
	                style={{
	                  position: 'absolute',
	                  top: '-4px',
	                  right: '-4px',
	                  zIndex: 20,
	                  display: 'flex',
	                  alignItems: 'center',
	                  gap: '3px',
	                  background: opponentDefensiveAbility === 'reflect' 
	                    ? 'rgba(201, 66, 255, 0.25)' 
	                    : 'rgba(255, 0, 110, 0.25)',
	                  border: `1px solid ${opponentDefensiveAbility === 'reflect' ? 'rgba(201, 66, 255, 0.7)' : 'rgba(255, 0, 110, 0.7)'}`,
	                  borderRadius: '5px',
	                  padding: '3px 6px',
	                  boxShadow: opponentDefensiveAbility === 'reflect'
	                    ? '0 0 10px rgba(201, 66, 255, 0.5)'
	                    : '0 0 10px rgba(255, 0, 110, 0.5)',
	                }}
	              >
	                <span style={{ fontSize: '12px' }}>
	                  {opponentDefensiveAbility === 'reflect' ? '🪞' : '🛡️'}
	                </span>
	                <span style={{ 
	                  fontSize: '8px', 
	                  fontWeight: 700, 
	                  color: opponentDefensiveAbility === 'reflect' ? '#c942ff' : '#ff006e',
	                  textTransform: 'uppercase',
	                }}>
	                  {opponentDefensiveAbility === 'reflect' ? 'REFL' : 'SHLD'}
	                </span>
	              </div>
	            )}
	            <div
                ref={opponentBoardViewportRef}
	              style={{
	                position: 'relative',
	                width: opponentMiniBoardWidth,
	                height: 'clamp(130px, 34vw, 160px)',
	                transform: getTiltAngle(opponentState)
	                  ? `rotate(${getTiltAngle(opponentState)}deg) scale(0.95)`
	                  : 'none',
	                transition: 'transform 200ms ease-out',
	              }}
	            >
	              <canvas
	                ref={opponentCanvasRef}
	                width={opponentBoardDisplay.pixelWidth}
	                height={opponentBoardDisplay.pixelHeight}
	                style={{
	                  display: 'block',
	                  border: `1px solid ${opponentBoardFx?.borderColor || 'rgba(255, 255, 255, 0.1)'}`,
	                  backgroundColor: 'rgba(5, 5, 20, 0.72)',
	                  width: `${opponentBoardDisplay.pixelWidth}px`,
	                  height: `${opponentBoardDisplay.pixelHeight}px`,
	                  borderRadius: 'clamp(4px, 1vw, 6px)',
	                  boxShadow: opponentBoardFx?.glow || '0 0 8px rgba(255, 255, 255, 0.08)',
	                }}
	              />
                {stateHasEffect(opponentState, 'ink_splash') && !mockMode && (
                  <InkSplashMask idPrefix="opponent" borderRadius="clamp(4px, 1vw, 6px)" />
                )}
	            </div>
		            {opponentState && (
	              <div style={{
	                marginTop: '3px',
	                padding: '3px 6px',
                background: 'transparent',
                borderRadius: '4px',
                fontSize: 'clamp(6px, 1.5vw, 8px)',
                textAlign: 'center',
                fontWeight: '700',
              }}>
                <div style={{ color: '#ff006e', textShadow: '0 0 8px rgba(255, 0, 110, 0.8)' }}>{opponentState.score}</div>
	                <div style={{ color: '#c942ff', textShadow: '0 0 8px rgba(201, 66, 255, 0.8)' }}>{opponentState.stars}</div>
	              </div>
	            )}
	          </div>

            {(yourTimedEffects.length > 0 || opponentTimedEffects.length > 0 || yourPieceCountEffects.length > 0 || opponentPieceCountEffects.length > 0) && (
	              <div
	                style={{
	                  marginTop: '6px',
	                  display: 'flex',
	                  flexDirection: 'column',
	                  gap: '4px',
	                  width: opponentMiniBoardWidth,
	                  maxWidth: opponentMiniBoardWidth,
	                  alignSelf: 'center',
	                  maxHeight: `${rightInfoEffectsMaxHeight}px`,
	                  overflowY: 'auto',
	                  paddingRight: 0,
	                }}
	              >
                {opponentTimedEffects.map((effect: TimedEffectEntry) => {
                  const progress = Math.max(0, Math.min(1, effect.remainingMs / effect.durationMs));
                  const ability = ABILITIES[effect.abilityType as keyof typeof ABILITIES];
                  return (
                    <div
                      key={`right-opp-${effect.abilityType}`}
                      style={{
                        background: 'rgba(24, 5, 16, 0.86)',
                        border: '1px solid rgba(255, 0, 110, 0.28)',
                        borderRadius: '5px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: '8px', color: '#ff7aa9', padding: '2px 4px', fontWeight: 700 }}>
                        OPP {ability?.shortName || effect.abilityType}
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.14)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progress * 100}%`,
                            background: 'linear-gradient(90deg, #ff2f7c 0%, #ff8e73 100%)',
                            transition: 'width 100ms linear',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {opponentPieceCountEffects.map((effect: any) => {
                  const ability = ABILITIES[effect.abilityType as keyof typeof ABILITIES];
                  const progress = effect.total > 0 ? Math.max(0, Math.min(1, effect.remaining / effect.total)) : 0;
                  return (
                    <div
                      key={`right-opp-pc-${effect.abilityType}`}
                      style={{
                        background: 'rgba(22, 10, 6, 0.85)',
                        border: '1px solid rgba(255, 165, 0, 0.28)',
                        borderRadius: '5px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: '8px', color: '#ffb07d', padding: '2px 4px', fontWeight: 700 }}>
                        OPP {ability?.shortName || effect.abilityType} {effect.remaining}/{effect.total}
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.14)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progress * 100}%`,
                            background: 'linear-gradient(90deg, #ff9f40 0%, #ffd06b 100%)',
                            transition: 'width 100ms linear',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {yourTimedEffects.map((effect: TimedEffectEntry) => {
                  const progress = Math.max(0, Math.min(1, effect.remainingMs / effect.durationMs));
                  const ability = ABILITIES[effect.abilityType as keyof typeof ABILITIES];
                  return (
                    <div
                      key={`right-you-${effect.abilityType}`}
                      style={{
                        background: 'rgba(6, 10, 22, 0.85)',
                        border: '1px solid rgba(0, 212, 255, 0.28)',
                        borderRadius: '5px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: '8px', color: '#7de3ff', padding: '2px 4px', fontWeight: 700 }}>
                        YOU {ability?.shortName || effect.abilityType}
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.14)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progress * 100}%`,
                            background: 'linear-gradient(90deg, #00d4ff 0%, #66f6ff 100%)',
                            transition: 'width 100ms linear',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {yourPieceCountEffects.map((effect: any) => {
                  const ability = ABILITIES[effect.abilityType as keyof typeof ABILITIES];
                  const progress = effect.total > 0 ? Math.max(0, Math.min(1, effect.remaining / effect.total)) : 0;
                  return (
                    <div
                      key={`right-you-pc-${effect.abilityType}`}
                      style={{
                        background: 'rgba(6, 22, 10, 0.85)',
                        border: '1px solid rgba(0, 255, 136, 0.28)',
                        borderRadius: '5px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: '8px', color: '#7dffb0', padding: '2px 4px', fontWeight: 700 }}>
                        YOU {ability?.shortName || effect.abilityType} {effect.remaining}/{effect.total}
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.14)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progress * 100}%`,
                            background: 'linear-gradient(90deg, #00ff88 0%, #8affc5 100%)',
                            transition: 'width 100ms linear',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

	        </motion.div>
      </div>

      <div
        ref={actionZoneRef}
        data-zone="action-zone"
        style={{
          position: 'relative',
          zIndex: 7,
        }}
      >
      {/* Bottom Ability Bar (6 slots) */}
      <motion.div
        animate={abilitiesBlastControls}
        data-zone="abilities-zone"
        style={{
        height: abilitiesBarHeight,
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        placeItems: 'center',
        gap: 'clamp(4px, 0.8vw, 8px)',
        padding: 'clamp(6px, 1vw, 10px)',
        background: 'linear-gradient(180deg, rgba(7, 9, 20, 0.34) 0%, rgba(5, 7, 16, 0.62) 100%)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        {Array.from({ length: 6 }).map((_, index) => {
          const ability = availableAbilities[index];
          if (!ability) {
            return (
              <div
                key={`ability-empty-${index}`}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              />
            );
          }

          const isAffordable = (yourState?.stars ?? 0) >= ability.cost;

          return (
            <motion.button
              key={`bottom-ability-${ability.id}-${index}`}
              whileTap={isAffordable ? 'tap' : undefined}
              variants={buttonVariants}
              transition={springs.snappy}
              onClick={() => {
                if (!isAffordable) return;
                haptics.medium();
                handleAbilityActivate(ability);
              }}
              disabled={!isAffordable}
              title={`${ability.name}: ${ability.description}`}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: '#fff',
                display: 'grid',
                gridTemplateRows: '1fr auto',
                alignItems: 'center',
                justifyItems: 'center',
                rowGap: '2px',
                padding: '4px',
                cursor: isAffordable ? 'pointer' : 'not-allowed',
                opacity: isAffordable ? 1 : 0.38,
                minWidth: 0,
                textAlign: 'center',
              }}
            >
              <Icon
                type="ability"
                name={ability.type}
                color={isDebuffAbility(ability) ? '#ff7aa9' : '#7de3ff'}
                size={28}
                active={isAffordable}
              />
              <span
                style={{
                  fontSize: '8px',
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  color: 'rgba(255,255,255,0.25)',
                  lineHeight: 1,
                }}
              >
                ★{ability.cost}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Touch Controls */}
      <motion.div
        animate={controlsBlastControls}
        data-zone="controls-zone"
        style={{
        marginTop: controlsGapHeight,
        height: controlsBarHeight,
        display: 'flex',
        gap: 'clamp(4px, 1vw, 8px)',
        padding: 'clamp(6px, 1.5vw, 10px)',
        paddingBottom: `calc(clamp(6px, 1.5vw, 10px) + ${bottomUiInset})`,
        background: 'linear-gradient(180deg, rgba(8, 10, 18, 0.36) 0%, rgba(5, 7, 14, 0.68) 100%)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        {/* Move Left */}
        <motion.button
          whileTap="tap"
          variants={buttonVariants}
          transition={springs.snappy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!gameClientRef.current) return;
            haptics.light();
            audioManager.playSfx('piece_move_left', 0.3);
            gameClientRef.current.sendInput('move_left');
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
          }}
        >
          <Icon type="control" name="left" color="rgba(255,255,255,0.4)" size={24} />
        </motion.button>

        {/* Hard Drop */}
        <motion.button
          whileTap="tap"
          variants={buttonVariants}
          transition={springs.snappy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!gameClientRef.current) return;
            audioManager.playSfx('hard_drop');
            haptics.medium();
            triggerHardDropBounce();
            triggerHardDropTrailImpact();
            gameClientRef.current.sendInput('hard_drop');
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
          }}
        >
          <Icon type="control" name="drop" color="rgba(255,255,255,0.4)" size={24} />
        </motion.button>

        {/* Soft Drop */}
        <motion.button
          whileTap="tap"
          variants={buttonVariants}
          transition={springs.snappy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!gameClientRef.current) return;
            haptics.light();
            audioManager.playSfx('soft_drop', 0.4);
            gameClientRef.current.sendInput('soft_drop');
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
          }}
        >
          <Icon type="control" name="down" color="rgba(255,255,255,0.4)" size={24} />
        </motion.button>

        {/* Rotate */}
        <motion.button
          whileTap="tap"
          variants={buttonVariants}
          transition={springs.snappy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!gameClientRef.current) return;
            haptics.light();
            audioManager.playSfx('piece_rotate', 0.5);
            gameClientRef.current.sendInput('rotate_cw');
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
          }}
        >
          <Icon type="control" name="rotate" color="rgba(255,255,255,0.4)" size={24} />
        </motion.button>

        {/* Move Right */}
        <motion.button
          whileTap="tap"
          variants={buttonVariants}
          transition={springs.snappy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!gameClientRef.current) return;
            haptics.light();
            audioManager.playSfx('piece_move_right', 0.3);
            gameClientRef.current.sendInput('move_right');
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
          }}
        >
          <Icon type="control" name="right" color="rgba(255,255,255,0.4)" size={24} />
        </motion.button>
      </motion.div>
      </div>
        </>
      )}

      {!isConnected && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '12px',
          backgroundColor: theme.uiBackgroundColor,
          padding: '10px',
          borderRadius: '5px',
        }}>
          Connecting...
        </div>
      )}

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameFinished && (
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(10px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={springs.smooth}
              style={{
                background: 'rgba(10, 10, 30, 0.95)',
                backdropFilter: 'blur(30px)',
                border: `2px solid ${isWinner ? '#00ff88' : '#ff006e'}`,
                borderRadius: 'clamp(16px, 4vw, 24px)',
                padding: 'clamp(32px, 8vw, 48px)',
                textAlign: 'center',
                maxWidth: '90vw',
                width: 'clamp(300px, 80vw, 500px)',
                boxShadow: isWinner
                  ? '0 0 40px rgba(0, 255, 136, 0.5), inset 0 0 30px rgba(0, 255, 136, 0.1)'
                  : '0 0 40px rgba(255, 0, 110, 0.5), inset 0 0 30px rgba(255, 0, 110, 0.1)',
              }}
            >
              <h2 style={{
                fontSize: 'clamp(32px, 8vw, 48px)',
                marginBottom: 'clamp(16px, 4vw, 24px)',
                fontWeight: '800',
                color: isWinner ? '#00ff88' : '#ff006e',
                textShadow: isWinner ? '0 0 20px rgba(0, 255, 136, 0.8)' : '0 0 20px rgba(255, 0, 110, 0.8)',
                letterSpacing: '2px',
              }}>
                {isWinner ? 'VICTORY!' : 'DEFEAT'}
              </h2>

              {yourState && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'clamp(12px, 3vw, 16px)',
                  marginBottom: 'clamp(24px, 6vw, 32px)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'clamp(8px, 2vw, 12px)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                  }}>
                    <span style={{ color: '#aaa', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>Score</span>
                    <span style={{ color: '#fff', fontWeight: '700', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>{yourState.score}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'clamp(8px, 2vw, 12px)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                  }}>
                    <span style={{ color: '#aaa', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>Lines Cleared</span>
                    <span style={{ color: '#fff', fontWeight: '700', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>{yourState.linesCleared}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'clamp(8px, 2vw, 12px)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                  }}>
                    <span style={{ color: '#aaa', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>Stars Earned</span>
                    <span style={{ color: '#c942ff', fontWeight: '700', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>{yourState.stars}</span>
                  </div>
                </div>
              )}

              {/* Rewards */}
              {matchRewards && (
                <div style={{
                  marginBottom: 'clamp(24px, 6vw, 32px)',
                  padding: 'clamp(12px, 3vw, 16px)',
                  background: 'rgba(0, 255, 136, 0.1)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  borderRadius: 'clamp(8px, 2vw, 12px)',
                  boxShadow: '0 0 20px rgba(0, 255, 136, 0.2)',
                }}>
                  <h3 style={{
                    fontSize: 'clamp(16px, 4vw, 20px)',
                    fontWeight: '700',
                    color: '#00ff88',
                    marginBottom: 'clamp(8px, 2vw, 12px)',
                    textShadow: '0 0 10px rgba(0, 255, 136, 0.6)',
                  }}>
                    REWARDS
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'clamp(6px, 1.5vw, 8px)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>Coins Earned</span>
                      <span style={{ color: '#ffd700', fontWeight: '700', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>
                        +{matchRewards.coins}
                      </span>
                    </div>
                    {matchRewards.breakdown.firstWinBonus > 0 && (
                      <div style={{ fontSize: 'clamp(11px, 2.75vw, 13px)', color: '#aaa', paddingLeft: 'clamp(8px, 2vw, 12px)' }}>
                        + First win bonus: {matchRewards.breakdown.firstWinBonus}
                      </div>
                    )}
                    {matchRewards.breakdown.streakBonus > 0 && (
                      <div style={{ fontSize: 'clamp(11px, 2.75vw, 13px)', color: '#aaa', paddingLeft: 'clamp(8px, 2vw, 12px)' }}>
                        + Win streak bonus: {matchRewards.breakdown.streakBonus}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>Total Balance</span>
                      <span style={{ color: '#ffd700', fontWeight: '700', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>
                        {matchRewards.newCoins} 💰
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
                onClick={onExit}
                style={{
                  width: '100%',
                  padding: 'clamp(12px, 3vw, 16px)',
                  fontSize: 'clamp(16px, 4vw, 20px)',
                  fontWeight: '800',
                  background: 'rgba(10, 10, 30, 0.6)',
                  backdropFilter: 'blur(20px)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'clamp(8px, 2vw, 12px)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}
              >
                Continue
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {flashEffect && (
        <FlashOverlay
          color={flashEffect.color}
          onComplete={() => setFlashEffect(null)}
        />
      )}

      {particles && (
        <ParticleEffect
          key={particles.id}
          x={particles.x}
          y={particles.y}
          count={particles.count ?? 50}
          colors={particles.colors}
          onComplete={() => setParticles(null)}
        />
      )}

      {/* Compact notifications (overlays top stats row) */}
      {!mockStatic && abilityNotifications.length > 0 && (
        <div
          data-zone="top-info-zone-notifications"
          style={{
            position: 'fixed',
            top: statsCardsTop,
            left: '8px',
            width: mockMode ? `${demoGridCellSize * 6 - 12}px` : '320px',
            maxHeight: mockMode ? `${demoGridCellSize * 2 - 12}px` : '120px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {abilityNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{
                borderRadius: '6px',
                border: `1px solid ${notif.category === 'debuff' ? 'rgba(255, 0, 110, 0.5)' : 'rgba(0, 212, 255, 0.5)'}`,
                background: notif.category === 'debuff' ? 'rgba(36, 6, 20, 0.85)' : 'rgba(6, 20, 36, 0.85)',
                boxShadow: notif.category === 'debuff'
                  ? '0 0 10px rgba(255, 0, 110, 0.22)'
                  : '0 0 10px rgba(0, 212, 255, 0.22)',
                padding: '4px 6px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: notif.category === 'debuff' ? '#ff76a7' : '#7de3ff',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {notif.name}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  lineHeight: 1.25,
                  color: 'rgba(255,255,255,0.88)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {notif.description}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Debug Panel */}
      {isDebugMode && debugLogger && (
        <DebugPanel
          debugLogger={debugLogger}
          gameClient={gameClientRef.current}
          yourState={yourState}
          opponentState={opponentState}
          onAbilityTrigger={(abilityType, target) => {
            const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
            if (!ability) return;
            // Target selection is validated server-side by ability category.
            // In debug mode this still uses the standard activation pathway.
            void target;
            handleAbilityActivate(ability);
          }}
        />
      )}
    </div>
  );
}
