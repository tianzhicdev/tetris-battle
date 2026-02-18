import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import {
  ServerAuthGameClient,
  type AbilityActivationResult,
  type GameStateUpdate,
} from '../services/partykit/ServerAuthGameClient';
import type { ConnectionStats } from '../services/ConnectionMonitor';
import { AbilityEffects } from './AbilityEffects';
import { NextPiecePanel } from './NextPiecePanel';
import { AbilityInfo } from './AbilityInfo';
import { ParticleEffect } from './ParticleEffect';
import { FlashOverlay } from './FlashOverlay';
import { Notification } from './Notification';
import { UserButton } from '@clerk/clerk-react';
import { DebugLogger } from '../services/debug/DebugLogger';
import { DebugPanel } from './debug/DebugPanel';
import { useDebugStore } from '../stores/debugStore';
import {
  AbilityEffectManager,
  ABILITIES,
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

interface ServerAuthMultiplayerGameProps {
  roomId: string;
  playerId: string;
  opponentId: string;
  theme: Theme;
  profile: UserProfile;
  onExit: () => void;
  aiOpponent?: any;
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
  aiOpponent
}: ServerAuthMultiplayerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const opponentRendererRef = useRef<TetrisRenderer | null>(null);
  const gameClientRef = useRef<ServerAuthGameClient | null>(null);

  // Local state for rendering (from server)
  const [yourState, setYourState] = useState<any | null>(null);
  const [opponentState, setOpponentState] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [effectManager] = useState(() => new AbilityEffectManager());
  const [activeEffects, setActiveEffects] = useState<any[]>([]);
  const [showAbilityInfo, setShowAbilityInfo] = useState(false);
  const [screenShake, setScreenShake] = useState(0);
  const [flashEffect, setFlashEffect] = useState<{ color: string } | null>(null);
  const [particles, setParticles] = useState<{ x: number; y: number; id: number; count?: number; colors?: string[] } | null>(null);
  const [selfBoardFx, setSelfBoardFx] = useState<BoardFxState | null>(null);
  const [opponentBoardFx, setOpponentBoardFx] = useState<BoardFxState | null>(null);
  const [abilityNotification, setAbilityNotification] = useState<{ name: string; description: string; category: 'buff' | 'debuff' } | null>(null);
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

  const { availableAbilities, setLoadout } = useAbilityStore();

  // Set player's loadout
  useEffect(() => {
    console.log('[SERVER-AUTH] Setting player loadout:', profile.loadout);
    setLoadout(profile.loadout);
  }, [profile.loadout, setLoadout]);

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

  // Initialize server-authoritative game client
  useEffect(() => {
    const host = normalizePartykitHost(import.meta.env.VITE_PARTYKIT_HOST);
    const client = new ServerAuthGameClient(roomId, playerId, host, profile.loadout, aiOpponent, debugLogger || undefined);
    gameClientRef.current = client;

    client.connect(
      // On state update from server
      (state: GameStateUpdate) => {
        setYourState(state.yourState);
        setOpponentState(state.opponentState);
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
        console.log(`[SERVER-AUTH] Received ability: ${abilityType} from ${fromPlayerId}`);
        handleAbilityReceived(abilityType, fromPlayerId);
      },
      // On ability activation result
      (result) => {
        handleAbilityActivationResult(result);
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
      pendingBoardAbilityFxRef.current = { self: null, opponent: null };
      client.disconnect();
      audioManager.stopMusic(true);
    };
  }, [roomId, playerId, onExit]);

  // Fetch opponent's profile for Rank calculation
  useEffect(() => {
    // Opponent profile fetching removed - no longer needed
  }, [opponentId]);

  // Initialize renderers
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new TetrisRenderer(canvasRef.current, 25, theme);
    }
    if (opponentCanvasRef.current) {
      opponentRendererRef.current = new TetrisRenderer(opponentCanvasRef.current, 8, theme);
    }
  }, [theme]);

  // Render own board from authoritative server state
  useEffect(() => {
    if (rendererRef.current && yourState) {
      applyBoardDiffAnimations(
        rendererRef.current,
        'self',
        yourState.board,
        yourState.activeEffects
      );

      const board = {
        grid: yourState.board,
        width: yourState.board?.[0]?.length ?? 10,
        height: yourState.board?.length ?? 20,
      };

      // Check active effects from server
      const blindSpotActive = yourState.activeEffects?.includes('blind_spot');
      const shrinkCeilingActive = yourState.activeEffects?.includes('shrink_ceiling');

      rendererRef.current.render(board, yourState.currentPiece, null, {
        showGrid: true,
        showGhost: false, // Server doesn't send ghost piece
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
  }, [yourState, applyBoardDiffAnimations, triggerBoardAbilityVisual]);

  // Render opponent's board
  useEffect(() => {
    if (opponentRendererRef.current && opponentState) {
      applyBoardDiffAnimations(
        opponentRendererRef.current,
        'opponent',
        opponentState.board,
        opponentState.activeEffects
      );

      const opponentBoard = {
        grid: opponentState.board,
        width: opponentState.board?.[0]?.length ?? 10,
        height: opponentState.board?.length ?? 20,
      };
      opponentRendererRef.current.render(opponentBoard, opponentState.currentPiece, null, {
        showGrid: true,
        showGhost: false,
      });
    }
  }, [opponentState, applyBoardDiffAnimations]);

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
    if (!yourState) return;

    const linesDiff = yourState.linesCleared - prevLinesRef.current;
    if (linesDiff > 0) {
      console.log(`[SERVER-AUTH] ${linesDiff} lines cleared!`);

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
  }, [yourState?.linesCleared]);

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

  // Handle ability activation
  const handleAbilityActivate = (ability: Ability) => {
    if (!gameClientRef.current || !yourState) return;

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
        setAbilityNotification({
          name: ability.name,
          description: ability.description,
          category: isDebuffAbility(ability) ? 'debuff' : 'buff',
        });
        setTimeout(() => setAbilityNotification(null), 3000);
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
    setAbilityNotification({
      name: ability.name,
      description: ability.description,
      category: isDebuffAbility(ability) ? 'debuff' : 'buff',
    });
    // Auto-dismiss notification after 3 seconds (instant abilities)
    // Duration abilities will continue showing in AbilityEffects component
    setTimeout(() => setAbilityNotification(null), 3000);

    audioManager.playSfx('ability_debuff_activate');

    // Track the effect locally for UI feedback
    if (ability.duration) {
      effectManager.activateEffect(abilityType, ability.duration);
      updateActiveEffects();
    }

    queueBoardAbilityFx(abilityType, 'self');
    triggerBoardAbilityVisual(abilityType, 'self');
  };

  // Update active effects display
  const updateActiveEffects = () => {
    setActiveEffects(effectManager.getActiveEffects());
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

  // Update active effects periodically
  useEffect(() => {
    const interval = setInterval(updateActiveEffects, 100);
    return () => clearInterval(interval);
  }, []);

  // Keyboard controls - send inputs to server
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameClientRef.current || !yourState || yourState.isGameOver || gameFinished) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          audioManager.playSfx('piece_move', 0.3);
          gameClientRef.current.sendInput('move_left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          audioManager.playSfx('piece_move', 0.3);
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
  }, [yourState, gameFinished, availableAbilities]);

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 50%, #0f0a1e 100%)',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      {/* Connection Quality Indicator - Top Left */}
      {connectionStats && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            padding: '2px 5px',
            background: 'rgba(0, 0, 0, 0.42)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontWeight: '600',
            lineHeight: 1,
            zIndex: 5,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            display: 'inline-block',
            background:
              connectionStats.quality === 'excellent'
                ? '#4ade80'
                : connectionStats.quality === 'good'
                ? '#fbbf24'
                : connectionStats.quality === 'poor'
                ? '#fb923c'
                : '#ef4444',
          }}>
          </span>
          <span style={{ color: '#ffffff' }}>
            {Math.round(connectionStats.avgLatency)}ms
          </span>
          <span
            style={{
              color:
                connectionStats.quality === 'excellent'
                  ? '#4ade80'
                  : connectionStats.quality === 'good'
                  ? '#fbbf24'
                  : connectionStats.quality === 'poor'
                  ? '#fb923c'
                  : '#ef4444',
              textTransform: 'capitalize',
              fontSize: '9px',
            }}
          >
            {connectionStats.quality}
          </span>
        </div>
      )}
      {/* Main Game Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 'clamp(2px, 0.5vw, 4px)', gap: 'clamp(2px, 0.5vw, 4px)' }}>
        {/* Left: Your Board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <motion.div
            animate={
              screenShake > 0
                ? {
                    x: [0, -10 * screenShake, 10 * screenShake, -10 * screenShake, 10 * screenShake, 0],
                    y: [0, -5 * screenShake, 5 * screenShake, -5 * screenShake, 5 * screenShake, 0],
                    rotate: [0, -2 * screenShake, 2 * screenShake, -2 * screenShake, 2 * screenShake, 0],
                  }
                : effectManager.isEffectActive('screen_shake')
                ? {
                    x: [0, -5, 5, -5, 5, 0],
                    y: [0, -3, 3, -3, 3, 0],
                    rotate: [0, -1, 1, -1, 1, 0],
                  }
                : { x: 0, y: 0, rotate: 0 }
            }
            transition={{
              duration: 0.4,
              repeat: effectManager.isEffectActive('screen_shake') ? Infinity : 0,
              ease: 'easeOut',
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <canvas
                ref={canvasRef}
                width={250}
                height={500}
                style={{
                  border: `2px solid ${selfBoardFx?.borderColor || '#00d4ff'}`,
                  backgroundColor: 'rgba(5,5,15,0.8)',
                  maxHeight: 'calc(100dvh - 110px)',
                  maxWidth: '100%',
                  height: 'auto',
                  width: 'auto',
                  objectFit: 'contain',
                  borderRadius: 'clamp(6px, 1.5vw, 10px)',
                  boxShadow: selfBoardFx?.glow || '0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 212, 255, 0.05)',
                }}
              />
              {yourState?.nextPieces?.length > 0 && (
                <NextPiecePanel nextPieces={yourState.nextPieces} />
              )}
            </div>
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
          <AbilityEffects activeEffects={activeEffects} theme={theme} />
          {yourState && (
            <div
              style={{
                marginTop: '4px',
                padding: '4px 6px',
                background: 'transparent',
                borderRadius: '8px',
                fontSize: 'clamp(9px, 2.2vw, 11px)',
                textAlign: 'center',
                fontWeight: '700',
                fontVariantNumeric: 'tabular-nums',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 10px)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(2px, 0.5vw, 3px)' }}>
                <span style={{ color: '#00d4ff', opacity: 0.7, fontSize: 'clamp(7px, 1.75vw, 9px)', fontWeight: '600' }}>Score</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`score-${yourState.score}`}
                    variants={scoreVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={springs.gentle}
                    style={{ color: '#00d4ff', textShadow: '0 0 8px rgba(0, 212, 255, 0.8)', display: 'inline-block' }}
                  >
                    {yourState.score}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(2px, 0.5vw, 3px)' }}>
                <span style={{ color: '#c942ff', opacity: 0.7, fontSize: 'clamp(7px, 1.75vw, 9px)', fontWeight: '600' }}>Stars</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`stars-${yourState.stars}`}
                    variants={scoreVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={springs.gentle}
                    style={{ color: '#c942ff', textShadow: '0 0 8px rgba(201, 66, 255, 0.8)', display: 'inline-block' }}
                  >
                    {yourState.stars}⭐
                  </motion.span>
                </AnimatePresence>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(2px, 0.5vw, 3px)' }}>
                <span style={{ color: '#00ff88', opacity: 0.7, fontSize: 'clamp(7px, 1.75vw, 9px)', fontWeight: '600' }}>Lines</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`lines-${yourState.linesCleared}`}
                    variants={scoreVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={springs.gentle}
                    style={{ color: '#00ff88', textShadow: '0 0 8px rgba(0, 255, 136, 0.8)', display: 'inline-block' }}
                  >
                    {yourState.linesCleared}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Right: Vertical Panel */}
        <div style={{
          width: 'clamp(85px, 22vw, 110px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(4px, 1vh, 8px)',
          overflow: 'hidden'
        }}>
          {/* Top Buttons */}
          <div style={{
            display: 'flex',
            gap: 'clamp(4px, 1vw, 6px)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <div style={{
              width: 'clamp(30px, 7.5vw, 38px)',
              height: 'clamp(30px, 7.5vw, 38px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <UserButton
                appearance={{
                  elements: {
                    rootBox: { width: '100%', height: '100%' },
                    avatarBox: { width: '100%', height: '100%' },
                  },
                }}
              />
            </div>

            <motion.button
              whileTap="tap"
              variants={buttonVariants}
              transition={springs.snappy}
              onClick={() => {
                haptics.light();
                setShowAbilityInfo(true);
              }}
              style={{
                padding: '6px',
                background: 'rgba(10, 10, 30, 0.4)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                color: '#ffffff',
                fontSize: 'clamp(14px, 3.5vw, 18px)',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: 'clamp(30px, 7.5vw, 38px)',
                height: 'clamp(30px, 7.5vw, 38px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              ?
            </motion.button>
          </div>

          {/* Opponent's Board */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'transparent',
            padding: 'clamp(4px, 1vw, 6px)',
            borderRadius: 'clamp(6px, 1.5vw, 10px)',
          }}>
            <canvas
              ref={opponentCanvasRef}
              width={80}
              height={160}
              style={{
                border: `1px solid ${opponentBoardFx?.borderColor || 'rgba(255, 0, 110, 0.5)'}`,
                backgroundColor: 'rgba(5,5,15,0.8)',
                width: 'clamp(65px, 17vw, 80px)',
                height: 'clamp(130px, 34vw, 160px)',
                borderRadius: 'clamp(4px, 1vw, 6px)',
                boxShadow: opponentBoardFx?.glow || '0 0 10px rgba(255, 0, 110, 0.3), inset 0 0 10px rgba(255, 0, 110, 0.05)',
              }}
            />
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

          {/* Abilities List */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(3px, 0.7vw, 5px)',
            overflow: 'auto',
            minHeight: 0,
            paddingRight: 'clamp(2px, 0.5vw, 3px)',
          }}>
            {yourState && availableAbilities.slice(0, 8).map((ability, index) => {
              const isAffordable = yourState.stars >= ability.cost;
              const isDebuff = isDebuffAbility(ability);

              return (
                <motion.button
                  key={index}
                  whileHover={isAffordable ? "hover" : undefined}
                  whileTap={isAffordable ? "tap" : undefined}
                  variants={buttonVariants}
                  transition={springs.bouncy}
                  onClick={() => {
                    if (isAffordable) {
                      haptics.medium();
                      handleAbilityActivate(ability);
                    }
                  }}
                  disabled={!isAffordable}
                  style={{
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                    background: isAffordable ? 'rgba(10, 10, 30, 0.6)' : 'rgba(10, 10, 30, 0.3)',
                    backdropFilter: 'blur(20px)',
                    border: isAffordable ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                    color: '#ffffff',
                    cursor: isAffordable ? 'pointer' : 'not-allowed',
                    opacity: isAffordable ? 1 : 0.3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'clamp(4px, 1vw, 6px)',
                    boxShadow: isAffordable ? '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
                    minHeight: 'clamp(32px, 8vw, 40px)',
                  }}
                  title={`${ability.name}: ${ability.description}`}
                >
                  <div style={{
                    fontSize: 'clamp(9px, 2.2vw, 11px)',
                    fontWeight: '800',
                    letterSpacing: '0.5px',
                    color: isAffordable ? '#ffffff' : '#666',
                    textShadow: isAffordable
                      ? (isDebuff ? '0 0 8px rgba(255, 0, 110, 0.6)' : '0 0 8px rgba(0, 212, 255, 0.6)')
                      : 'none',
                    textAlign: 'left',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {ability.shortName}
                  </div>
                  <div style={{
                    fontSize: 'clamp(7px, 1.8vw, 9px)',
                    fontWeight: '800',
                    background: isAffordable
                      ? (isDebuff ? 'rgba(255, 0, 110, 0.15)' : 'rgba(0, 212, 255, 0.15)')
                      : 'rgba(100, 100, 100, 0.1)',
                    padding: 'clamp(1px, 0.3vw, 2px) clamp(4px, 1vw, 6px)',
                    borderRadius: 'clamp(3px, 0.8vw, 4px)',
                    border: `1px solid ${isAffordable
                      ? (isDebuff ? 'rgba(255, 0, 110, 0.3)' : 'rgba(0, 212, 255, 0.3)')
                      : 'rgba(255,255,255,0.05)'}`,
                    color: isAffordable ? (isDebuff ? '#ff006e' : '#00d4ff') : '#666',
                    flexShrink: 0,
                    minWidth: 'clamp(20px, 5vw, 28px)',
                    textAlign: 'center',
                  }}>
                    {ability.cost}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Touch Controls */}
      <div style={{
        height: 'clamp(60px, 12vh, 80px)',
        display: 'flex',
        gap: 'clamp(4px, 1vw, 8px)',
        padding: 'clamp(6px, 1.5vw, 10px)',
        background: 'linear-gradient(180deg, rgba(10,10,25,0.4) 0%, rgba(5,5,15,0.8) 100%)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0, 212, 255, 0.2)',
        boxShadow: '0 -5px 25px rgba(0, 212, 255, 0.1)',
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
            audioManager.playSfx('piece_move', 0.3);
            gameClientRef.current.sendInput('move_left');
          }}
          style={{
            flex: 1,
            background: 'rgba(10, 10, 30, 0.6)',
            backdropFilter: 'blur(20px)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
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
            gameClientRef.current.sendInput('hard_drop');
          }}
          style={{
            flex: 1,
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(255, 0, 110, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255, 0, 110, 0.5)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="7 13 12 18 17 13" />
            <polyline points="7 6 12 11 17 6" />
          </svg>
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
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(201, 66, 255, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(201, 66, 255, 0.5)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="6 9 12 15 18 9" />
          </svg>
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
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(0, 255, 136, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
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
            audioManager.playSfx('piece_move', 0.3);
            gameClientRef.current.sendInput('move_right');
          }}
          style={{
            flex: 1,
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(255, 165, 0, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255, 165, 0, 0.5)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </motion.button>
      </div>

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

      <AnimatePresence>
        {showAbilityInfo && (
          <AbilityInfo onClose={() => setShowAbilityInfo(false)} />
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

      <Notification
        visible={!!abilityNotification}
        title={abilityNotification?.name || ''}
        message={abilityNotification?.description}
        variant={abilityNotification?.category}
      />

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
