import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { ServerAuthGameClient, type GameStateUpdate } from '../services/partykit/ServerAuthGameClient';
import { AbilityEffects } from './AbilityEffects';
import { AbilityInfo } from './AbilityInfo';
import { ParticleEffect } from './ParticleEffect';
import { FlashOverlay } from './FlashOverlay';
import { AbilityNotification } from './AbilityNotification';
import { UserButton } from '@clerk/clerk-react';
import { DebugLogger } from '../services/debug/DebugLogger';
import { DebugPanel } from './debug/DebugPanel';
import { useDebugStore } from '../stores/debugStore';
import {
  AbilityEffectManager,
  ABILITIES,
  COIN_VALUES,
  XP_VALUES,
  calculateLevel,
  getAvailableAbilities,
  calculateRankChange,
  isInPlacement,
} from '@tetris-battle/game-core';
import type { Ability, UserProfile, MatchResult } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';
import type { Theme } from '../themes';
import { audioManager } from '../services/audioManager';
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
  const [particles, setParticles] = useState<{ x: number; y: number; id: number } | null>(null);
  const [abilityNotification, setAbilityNotification] = useState<{ name: string; description: string; category: 'buff' | 'debuff' } | null>(null);
  const [matchRewards, setMatchRewards] = useState<{
    coinsEarned: number;
    xpEarned: number;
    rankChange: number;
    rankAfter: number;
    leveledUp: boolean;
    newLevel: number;
    newAbilities: string[];
    isPlacement: boolean;
  } | null>(null);
  const [abilitiesUsedCount, setAbilitiesUsedCount] = useState(0);
  const [opponentProfile, setOpponentProfile] = useState<UserProfile | null>(null);
  const matchStartTimeRef = useRef<number>(Date.now());
  const [debugLogger, setDebugLogger] = useState<DebugLogger | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);

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

  // Initialize server-authoritative game client
  useEffect(() => {
    const host = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';
    const client = new ServerAuthGameClient(roomId, playerId, host, profile.loadout, aiOpponent, debugLogger || undefined);
    gameClientRef.current = client;

    client.connect(
      // On state update from server
      (state: GameStateUpdate) => {
        console.log('[SERVER-AUTH] State update received:', state);
        setYourState(state.yourState);
        setOpponentState(state.opponentState);
      },
      // On opponent disconnected
      () => {
        alert('Opponent disconnected!');
        onExit();
      },
      // On game finished
      (winner) => {
        setGameFinished(true);
        setWinnerId(winner);
      },
      // On ability received
      (abilityType, fromPlayerId) => {
        console.log(`[SERVER-AUTH] Received ability: ${abilityType} from ${fromPlayerId}`);
        handleAbilityReceived(abilityType);
      }
    );

    setIsConnected(true);

    // Start gameplay music
    audioManager.playMusic('gameplay_normal', true);

    return () => {
      client.disconnect();
      audioManager.stopMusic(true);
    };
  }, [roomId, playerId, onExit]);

  // Fetch opponent's profile for Rank calculation
  useEffect(() => {
    const fetchOpponentProfile = async () => {
      const profile = await progressionService.getUserProfile(opponentId);
      if (profile) {
        setOpponentProfile(profile);
      }
    };
    fetchOpponentProfile();
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

  // Render own board from server state
  useEffect(() => {
    if (rendererRef.current && yourState) {
      const board = {
        grid: yourState.board,
        width: 10,
        height: 20,
      };

      // Check active effects from server
      const blindSpotActive = yourState.activeEffects?.includes('blind_spot');
      const shrinkCeilingActive = yourState.activeEffects?.includes('shrink_ceiling');

      rendererRef.current.render(board, yourState.currentPiece, null, {
        showGrid: true,
        showGhost: false, // Server doesn't send ghost piece
        isBomb: false,
        blindSpotRows: blindSpotActive ? 4 : 0,
      });

      // Draw shrink ceiling overlay
      if (shrinkCeilingActive) {
        rendererRef.current.drawShrinkCeiling(board, 4);
      }
    }
  }, [yourState]);

  // Render opponent's board
  useEffect(() => {
    if (opponentRendererRef.current && opponentState) {
      const opponentBoard = {
        grid: opponentState.board,
        width: 10,
        height: 20,
      };
      opponentRendererRef.current.render(opponentBoard, opponentState.currentPiece, null, {
        showGrid: true,
        showGhost: false,
      });
    }
  }, [opponentState]);

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

  // Handle ability activation
  const handleAbilityActivate = (ability: Ability) => {
    if (!gameClientRef.current || !yourState) return;

    // In debug mode, bypass star cost check
    if (!isDebugMode && yourState.stars < ability.cost) {
      console.warn('[SERVER-AUTH] Not enough stars for ability');
      return;
    }

    console.log('[SERVER-AUTH] Activating ability:', ability.name);

    // Log ability usage in debug mode
    if (debugLogger) {
      const target = ability.category === 'buff' ? 'self' : 'opponent';
      debugLogger.logEvent('ability_used', `You used ${ability.name} (${ability.shortName}) on ${target}`, {
        ability: ability.type,
        name: ability.name,
        category: ability.category,
        target
      });
    }

    // Track ability usage
    setAbilitiesUsedCount(prev => prev + 1);

    // Show notification
    setAbilityNotification({
      name: ability.name,
      description: ability.description,
      category: ability.category as 'buff' | 'debuff',
    });
    setTimeout(() => setAbilityNotification(null), 3000);

    // Play sound
    if (ability.category === 'buff') {
      audioManager.playSfx('ability_buff_activate');
    } else if (ability.category === 'debuff') {
      audioManager.playSfx('ability_debuff_activate');
    }

    // Send to server
    if (ability.category === 'buff') {
      // Buff abilities target self
      gameClientRef.current.activateAbility(ability.type, playerId);
    } else {
      // Debuff abilities target opponent
      gameClientRef.current.activateAbility(ability.type, opponentId);
    }
  };

  // Handle receiving ability from opponent
  const handleAbilityReceived = (abilityType: string) => {
    console.log('[SERVER-AUTH] Received ability from opponent:', abilityType);

    const abilities = Object.values(ABILITIES);
    const ability = abilities.find((a: any) => a.type === abilityType);

    if (!ability) return;

    // Log ability received in debug mode
    if (debugLogger) {
      debugLogger.logEvent('opponent_ability', `Opponent used ${ability.name} (${ability.shortName}) on you`, {
        ability: abilityType,
        name: ability.name,
        category: ability.category
      });
    }

    audioManager.playSfx('ability_debuff_activate');

    // Track the effect locally for UI feedback
    if (ability.duration) {
      effectManager.activateEffect(abilityType, ability.duration);
      updateActiveEffects();
    }
  };

  // Update active effects display
  const updateActiveEffects = () => {
    setActiveEffects(effectManager.getActiveEffects());
  };

  // Calculate and save match rewards
  const calculateMatchRewards = useCallback(async (isWin: boolean) => {
    if (!yourState) return;

    console.log('[SERVER-AUTH REWARDS] Starting reward calculation...', { isWin, opponentProfile, profile });

    let currentOpponentProfile = opponentProfile;
    if (!currentOpponentProfile) {
      const fetchedProfile = await progressionService.getUserProfile(opponentId);
      if (fetchedProfile) {
        setOpponentProfile(fetchedProfile);
        currentOpponentProfile = fetchedProfile;
      } else {
        currentOpponentProfile = { rank: 1000 } as UserProfile;
      }
    }

    const outcome: 'win' | 'loss' = isWin ? 'win' : 'loss';
    const matchDuration = Math.floor((Date.now() - matchStartTimeRef.current) / 1000);

    const opponentRank = currentOpponentProfile?.rank || 1000;
    const rankChange = calculateRankChange(
      profile.rank,
      opponentRank,
      outcome,
      profile.gamesPlayed
    );
    const rankAfter = profile.rank + rankChange;
    const isPlacementMatch = isInPlacement(profile.gamesPlayed);

    let coinsEarned = isWin ? COIN_VALUES.win : COIN_VALUES.loss;

    if (yourState.linesCleared >= 40) {
      coinsEarned += COIN_VALUES.lines40Plus;
    } else if (yourState.linesCleared >= 20) {
      coinsEarned += COIN_VALUES.lines20Plus;
    }

    if (abilitiesUsedCount >= 5) {
      coinsEarned += COIN_VALUES.abilities5Plus;
    } else if (abilitiesUsedCount === 0 && isWin) {
      coinsEarned += COIN_VALUES.noAbilityWin;
    }

    let xpEarned = XP_VALUES.matchComplete;
    if (isWin) {
      xpEarned += XP_VALUES.matchWin;
    }

    const newCoins = profile.coins + coinsEarned;
    const newXp = profile.xp + xpEarned;
    const oldLevel = profile.level;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > oldLevel;

    const availableAbilitiesBefore = getAvailableAbilities(oldLevel);
    const availableAbilitiesAfter = getAvailableAbilities(newLevel);
    const newAbilities = availableAbilitiesAfter
      .filter(unlock => !availableAbilitiesBefore.find(u => u.abilityId === unlock.abilityId))
      .map(unlock => unlock.abilityId);

    await progressionService.updateUserProfile(profile.userId, {
      coins: newCoins,
      xp: newXp,
      level: newLevel,
      rank: rankAfter,
      gamesPlayed: profile.gamesPlayed + 1,
      lastActiveAt: Date.now(),
    });

    const matchResult: MatchResult = {
      id: `${profile.userId}-${Date.now()}`,
      userId: profile.userId,
      opponentId: opponentId,
      outcome,
      linesCleared: yourState.linesCleared,
      abilitiesUsed: abilitiesUsedCount,
      coinsEarned,
      xpEarned,
      rankChange,
      rankAfter,
      opponentRank,
      duration: matchDuration,
      timestamp: Date.now(),
    };

    await progressionService.saveMatchResult(matchResult);

    setMatchRewards({
      coinsEarned,
      xpEarned,
      rankChange,
      rankAfter,
      leveledUp,
      newLevel,
      newAbilities,
      isPlacement: isPlacementMatch,
    });
  }, [opponentProfile, profile, opponentId, yourState, abilitiesUsedCount]);

  // Update active effects periodically
  useEffect(() => {
    const interval = setInterval(updateActiveEffects, 100);
    return () => clearInterval(interval);
  }, []);

  // Keyboard controls - send inputs to server
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameClientRef.current || !yourState || yourState.isGameOver || gameFinished) return;

      const isReversed = effectManager.isEffectActive('reverse_controls');

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          audioManager.playSfx('piece_move', 0.3);
          gameClientRef.current.sendInput(isReversed ? 'move_right' : 'move_left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          audioManager.playSfx('piece_move', 0.3);
          gameClientRef.current.sendInput(isReversed ? 'move_left' : 'move_right');
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
          if (!effectManager.isEffectActive('rotation_lock')) {
            audioManager.playSfx('piece_rotate', 0.5);
            gameClientRef.current.sendInput('rotate_cw');
          }
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
            <canvas
              ref={canvasRef}
              width={250}
              height={500}
              style={{
                border: '2px solid #00d4ff',
                backgroundColor: 'rgba(5,5,15,0.8)',
                maxHeight: 'calc(100dvh - 110px)',
                maxWidth: '100%',
                height: 'auto',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: 'clamp(6px, 1.5vw, 10px)',
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 212, 255, 0.05)',
              }}
            />
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
                border: '1px solid rgba(255, 0, 110, 0.5)',
                backgroundColor: 'rgba(5,5,15,0.8)',
                width: 'clamp(65px, 17vw, 80px)',
                height: 'clamp(130px, 34vw, 160px)',
                borderRadius: 'clamp(4px, 1vw, 6px)',
                boxShadow: '0 0 10px rgba(255, 0, 110, 0.3), inset 0 0 10px rgba(255, 0, 110, 0.05)',
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
                      ? (ability.category === 'buff' ? '0 0 8px rgba(0, 212, 255, 0.6)' : '0 0 8px rgba(255, 0, 110, 0.6)')
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
                      ? (ability.category === 'buff' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 0, 110, 0.15)')
                      : 'rgba(100, 100, 100, 0.1)',
                    padding: 'clamp(1px, 0.3vw, 2px) clamp(4px, 1vw, 6px)',
                    borderRadius: 'clamp(3px, 0.8vw, 4px)',
                    border: `1px solid ${isAffordable
                      ? (ability.category === 'buff' ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 0, 110, 0.3)')
                      : 'rgba(255,255,255,0.05)'}`,
                    color: isAffordable ? (ability.category === 'buff' ? '#00d4ff' : '#ff006e') : '#666',
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
            const isReversed = effectManager.isEffectActive('reverse_controls');
            gameClientRef.current.sendInput(isReversed ? 'move_right' : 'move_left');
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
            if (!effectManager.isEffectActive('rotation_lock')) {
              audioManager.playSfx('piece_rotate', 0.5);
              gameClientRef.current.sendInput('rotate_cw');
            }
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
            const isReversed = effectManager.isEffectActive('reverse_controls');
            gameClientRef.current.sendInput(isReversed ? 'move_left' : 'move_right');
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
                      <span style={{ color: '#fff', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>Coins</span>
                      <span style={{ color: '#ffd700', fontWeight: '700', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>
                        +{matchRewards.coinsEarned}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>XP</span>
                      <span style={{ color: '#00d4ff', fontWeight: '700', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>
                        +{matchRewards.xpEarned}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 'clamp(13px, 3.2vw, 16px)' }}>
                        Rank {matchRewards.isPlacement && '(Placement)'}
                      </span>
                      <span style={{
                        color: matchRewards.rankChange >= 0 ? '#00ff88' : '#ff006e',
                        fontWeight: '700',
                        fontSize: 'clamp(13px, 3.2vw, 16px)'
                      }}>
                        {matchRewards.rankChange >= 0 ? '+' : ''}{matchRewards.rankChange} → {matchRewards.rankAfter}
                      </span>
                    </div>
                    {matchRewards.leveledUp && (
                      <div style={{
                        marginTop: 'clamp(4px, 1vw, 6px)',
                        padding: 'clamp(6px, 1.5vw, 8px)',
                        background: 'rgba(255, 215, 0, 0.15)',
                        borderRadius: 'clamp(4px, 1vw, 6px)',
                        textAlign: 'center',
                      }}>
                        <span style={{
                          color: '#ffd700',
                          fontWeight: '800',
                          fontSize: 'clamp(14px, 3.5vw, 18px)',
                          textShadow: '0 0 10px rgba(255, 215, 0, 0.6)',
                        }}>
                          LEVEL UP! → {matchRewards.newLevel}
                        </span>
                      </div>
                    )}
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
          count={50}
          onComplete={() => setParticles(null)}
        />
      )}

      <AbilityNotification
        abilityName={abilityNotification?.name || null}
        description={abilityNotification?.description || null}
        category={abilityNotification?.category || null}
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

            if (target === 'opponent') {
              handleAbilityActivate(ability);
            } else {
              // Self-targeting abilities (buffs) - trigger on own state
              // For now, just log (server-auth doesn't support self-buffs yet)
              console.log('[DEBUG] Self-ability trigger not implemented in server-auth mode:', abilityType);
            }
          }}
        />
      )}
    </div>
  );
}
