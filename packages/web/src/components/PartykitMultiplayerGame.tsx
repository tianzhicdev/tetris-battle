import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { PartykitGameSync } from '../services/partykit/gameSync';
import { AbilityEffects } from './AbilityEffects';
import { AbilityInfo } from './AbilityInfo';
import { ParticleEffect } from './ParticleEffect';
import { FlashOverlay } from './FlashOverlay';
import { AbilityNotification } from './AbilityNotification';
import { UserButton } from '@clerk/clerk-react';
import { DebugLogger } from '../services/debug/DebugLogger';
import { DebugPanel } from './debug/DebugPanel';
import {
  AbilityEffectManager,
  ABILITIES,
  applyClearRows,
  applyRandomSpawner,
  applyEarthquake,
  applyDeathCross,
  applyGoldDigger,
  applyRowRotate,
  applyFillHoles,
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

interface MultiplayerGameProps {
  roomId: string;
  playerId: string;
  opponentId: string;
  theme: Theme;
  profile: UserProfile;
  onExit: () => void;
  aiOpponent?: any;
}

export function MultiplayerGame({ roomId, playerId, opponentId, theme, profile, onExit, aiOpponent }: MultiplayerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const opponentRendererRef = useRef<TetrisRenderer | null>(null);
  const gameSyncRef = useRef<PartykitGameSync | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastSyncedStateRef = useRef<string>('');

  const [opponentState, setOpponentState] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [effectManager] = useState(() => new AbilityEffectManager());
  const [activeEffects, setActiveEffects] = useState<any[]>([]);
  const [explosion, setExplosion] = useState<{ x: number; y: number; startTime: number } | null>(null);
  const [showAbilityInfo, setShowAbilityInfo] = useState(false);
  const [screenShake, setScreenShake] = useState(0); // 0 = no shake, 1-3 = intensity
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

  const {
    gameState,
    ghostPiece,
    isPaused,
    initGame,
    movePieceLeft,
    movePieceRight,
    movePieceDown,
    rotatePieceClockwise,
    hardDrop,
    tick,
    togglePause,
    updateBoard,
    deductStars,
    setBombType,
    setCascadeMultiplier,
    setMiniBlocksRemaining,
    setWeirdShapesRemaining,
    setShrinkCeilingRows,
    setOnBombExplode,
  } = useGameStore();

  // Set player's loadout
  useEffect(() => {
    console.log('[GAME] Setting player loadout:', profile.loadout);
    setLoadout(profile.loadout);
  }, [profile.loadout, setLoadout]);

  // Initialize debug mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.get('debug') === 'true';
    setIsDebugMode(debugEnabled);
    if (debugEnabled) {
      setDebugLogger(new DebugLogger());
    }
  }, []);

  // Initialize game sync
  useEffect(() => {
    const host = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';
    const sync = new PartykitGameSync(roomId, playerId, host, aiOpponent, debugLogger || undefined);
    gameSyncRef.current = sync;

    sync.connect(
      // On opponent state update
      (state) => {
        setOpponentState(state);
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
        console.log(`Received ability: ${abilityType} from ${fromPlayerId}`);
        handleAbilityReceived(abilityType);
      }
    );

    setIsConnected(true);
    initGame();

    // Start gameplay music
    audioManager.playMusic('gameplay_normal', true);

    return () => {
      sync.disconnect();
      audioManager.stopMusic(true);
    };
  }, [roomId, playerId, onExit, initGame]);

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

  // Sync game state to server (only when OUR state changes, not opponent's)
  useEffect(() => {
    if (!gameSyncRef.current || !isConnected) {
      return;
    }

    // Create a stable hash of the state we care about syncing
    const currentStateHash = JSON.stringify({
      board: gameState.board.grid,
      score: gameState.score,
      stars: gameState.stars,
      linesCleared: gameState.linesCleared,
      comboCount: gameState.comboCount,
      isGameOver: gameState.isGameOver,
    });

    // Only sync if our own state has actually changed
    if (currentStateHash === lastSyncedStateRef.current) {
      return; // No change, skip sync
    }

    console.log('[SYNC] State changed, checking if sync needed', {
      currentHash: currentStateHash.substring(0, 50),
      lastHash: lastSyncedStateRef.current.substring(0, 50),
      willSync: currentStateHash !== lastSyncedStateRef.current,
    });

    // Update sync timestamp
    lastSyncedStateRef.current = currentStateHash;

    // Sync to server
    gameSyncRef.current.updateGameState(
      gameState.board,
      gameState.score,
      gameState.stars,
      gameState.linesCleared,
      gameState.comboCount,
      gameState.isGameOver,
      gameState.currentPiece
    );

    // Check for game over
    if (gameState.isGameOver && !gameFinished) {
      gameSyncRef.current.gameOver();
    }
  }, [gameState.board.grid, gameState.score, gameState.stars, gameState.linesCleared,
      gameState.comboCount, gameState.isGameOver, isConnected, gameFinished]);

  // Initialize renderers
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new TetrisRenderer(canvasRef.current, 25, theme);
    }
    if (opponentCanvasRef.current) {
      // Opponent canvas is smaller (80x160), so cellSize = 8
      opponentRendererRef.current = new TetrisRenderer(opponentCanvasRef.current, 8, theme);
    }
  }, [theme]);

  // Game loop with dynamic tick rate
  useEffect(() => {
    const BASE_TICK_RATE = 1000;

    const loop = () => {
      // Check for speed modifying effects
      let tickRate = BASE_TICK_RATE;

      // Speed up opponent makes pieces fall faster (debuff)
      if (effectManager.isEffectActive('speed_up_opponent')) {
        tickRate = BASE_TICK_RATE / 3; // 3x faster
      }

      tick();
      gameLoopRef.current = window.setTimeout(loop, tickRate);
    };

    if (!gameState.isGameOver && isConnected && !gameFinished && !gameLoopRef.current) {
      console.log('[GAME LOOP] Starting game loop');
      gameLoopRef.current = window.setTimeout(loop, BASE_TICK_RATE);
    }

    return () => {
      if (gameLoopRef.current) {
        console.log('[GAME LOOP] Cleaning up game loop');
        clearTimeout(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [isConnected, gameFinished]); // BUGFIX: Removed tick and gameState.isGameOver to prevent multiple game loops

  // Set up bomb explosion callback
  useEffect(() => {
    setOnBombExplode((x, y, type) => {
      console.log('Explosion triggered at', x, y, type);
      setExplosion({ x, y, startTime: Date.now() });

      // Trigger dramatic effects for bomb
      haptics.heavy();
      setScreenShake(3); // Maximum shake
      setFlashEffect({ color: 'rgba(255, 100, 0, 0.7)' }); // Orange flash

      // Get screen position for particles (approximate center of board)
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setParticles({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: Date.now() });
      }

      setTimeout(() => {
        setExplosion(null);
        setScreenShake(0);
      }, 500);
    });
  }, [setOnBombExplode]);

  // Monitor for line clears and trigger effects
  const prevLinesRef = useRef(gameState.linesCleared);
  useEffect(() => {
    const linesDiff = gameState.linesCleared - prevLinesRef.current;
    if (linesDiff > 0) {
      // Line clear detected!
      console.log(`${linesDiff} lines cleared!`);

      if (linesDiff >= 4) {
        // TETRIS! Maximum effects
        haptics.heavy();
        setScreenShake(3);
        setFlashEffect({ color: 'rgba(0, 255, 136, 0.8)' }); // Green flash
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          setParticles({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: Date.now() });
        }
      } else if (linesDiff >= 2) {
        // Double/Triple
        haptics.medium();
        setScreenShake(2);
        setFlashEffect({ color: 'rgba(0, 212, 255, 0.6)' }); // Cyan flash
      } else {
        // Single line
        haptics.light();
        setScreenShake(1);
        setFlashEffect({ color: 'rgba(255, 255, 255, 0.4)' }); // White flash
      }

      setTimeout(() => setScreenShake(0), 400);
    }
    prevLinesRef.current = gameState.linesCleared;
  }, [gameState.linesCleared]);

  // Render own board
  useEffect(() => {
    if (rendererRef.current) {
      // Check if blind spot is active
      const blindSpotRows = effectManager.isEffectActive('blind_spot') ? 4 : 0;
      const shrinkCeilingRows = effectManager.isEffectActive('shrink_ceiling') ? 4 : 0;

      rendererRef.current.render(gameState.board, gameState.currentPiece, ghostPiece, {
        showGrid: true,
        showGhost: true,
        isBomb: gameState.bombType !== null,
        blindSpotRows,
      });

      // Draw shrink ceiling overlay
      if (shrinkCeilingRows > 0) {
        rendererRef.current.drawShrinkCeiling(gameState.board, shrinkCeilingRows);
      }

      // Draw explosion if active
      if (explosion) {
        const elapsed = Date.now() - explosion.startTime;
        const progress = Math.min(elapsed / 500, 1); // 500ms animation
        const radius = gameState.bombType === 'cross' ? 4 : 3;
        rendererRef.current.drawExplosion(explosion.x, explosion.y, radius, progress);
      }
    }
  }, [gameState.board, gameState.currentPiece, ghostPiece, gameState.bombType, explosion]);

  // Render opponent's board
  useEffect(() => {
    if (opponentRendererRef.current && opponentState) {
      const opponentBoard = {
        grid: opponentState.board,
        width: 10,
        height: 20,
      };
      // Show opponent's current piece if available
      const opponentPiece = opponentState.currentPiece || null;
      opponentRendererRef.current.render(opponentBoard, opponentPiece, null, {
        showGrid: true,
        showGhost: false,
      });
    }
  }, [opponentState]);

  // Wrap hardDrop to add effects (no screen shake, just haptics)
  const handleHardDrop = () => {
    hardDrop();
    haptics.medium();
  };

  // Handle ability activation
  const handleAbilityActivate = (ability: Ability) => {
    console.log('Activating ability:', ability.name);

    // Track ability usage
    setAbilitiesUsedCount(prev => prev + 1);

    // Deduct stars first
    deductStars(ability.cost);

    // Show notification
    setAbilityNotification({
      name: ability.name,
      description: ability.description,
      category: ability.category as 'buff' | 'debuff',
    });
    setTimeout(() => setAbilityNotification(null), 3000);

    // Play sound based on ability category
    if (ability.category === 'buff') {
      audioManager.playSfx('ability_buff_activate');
    } else if (ability.category === 'debuff') {
      audioManager.playSfx('ability_debuff_activate');
    }

    if (ability.category === 'buff') {
      // Apply buff to self
      if (ability.duration) {
        effectManager.activateEffect(ability.type, ability.duration);
        updateActiveEffects();
      }

      // Apply instant buff effects
      switch (ability.type) {
        case 'cross_firebomb': {
          // Make current piece a bomb - it will explode when it lands
          setBombType('cross');
          console.log('Cross FireBomb activated - piece will explode on landing');
          break;
        }

        case 'circle_bomb': {
          // Make current piece a bomb - it will explode when it lands
          setBombType('circle');
          console.log('Circle Bomb activated - piece will explode on landing');
          break;
        }

        case 'clear_rows': {
          // Animate bottom 5 rows being cleared
          const rowsToAnimate: Array<{ x: number; y: number }> = [];
          for (let y = gameState.board.height - 5; y < gameState.board.height; y++) {
            for (let x = 0; x < gameState.board.width; x++) {
              if (gameState.board.grid[y]?.[x]) {
                rowsToAnimate.push({ x, y });
              }
            }
          }

          if (rendererRef.current) {
            rendererRef.current.animationManager.animateBlocksDisappearing(rowsToAnimate, '#00ff88');
          }

          // Clear bottom 5 rows
          setTimeout(() => {
            const { board: clearedBoard } = applyClearRows(gameState.board, 5);
            updateBoard(clearedBoard);
          }, 200);
          break;
        }

        case 'mini_blocks': {
          // Activate mini blocks - next 5 pieces will be 2-cell dominoes
          setMiniBlocksRemaining(5);
          console.log('Mini Blocks activated - next 5 pieces will be small');
          break;
        }

        case 'fill_holes': {
          // Find empty enclosed spaces that will be filled
          const holesToFill: Array<{ x: number; y: number }> = [];
          for (let y = 0; y < gameState.board.height; y++) {
            for (let x = 0; x < gameState.board.width; x++) {
              if (!gameState.board.grid[y][x]) {
                // This is a simplified check - actual fill_holes has more complex logic
                holesToFill.push({ x, y });
              }
            }
          }

          if (rendererRef.current && holesToFill.length > 0) {
            rendererRef.current.animationManager.animateBlocksAppearing(holesToFill, '#00d4ff');
          }

          // Fill all enclosed empty spaces
          const filledBoard = applyFillHoles(gameState.board);
          updateBoard(filledBoard);
          break;
        }

        case 'cascade_multiplier':
          // Duration-based effects handled by AbilityEffectManager
          break;

        case 'deflect_shield':
          // Activate shield with infinite duration (until consumed)
          effectManager.activateEffect('deflect_shield', 999999999); // Very long duration, consumed on use
          updateActiveEffects();
          console.log('Deflect shield activated - next debuff will be blocked');
          break;
      }
    } else {
      // Send debuff to opponent
      gameSyncRef.current?.activateAbility(ability.type, opponentId);
    }
  };

  // Handle receiving ability from opponent
  const handleAbilityReceived = (abilityType: string) => {
    console.log('Received ability from opponent:', abilityType);

    // Find ability definition
    const abilities = Object.values(ABILITIES);
    const ability = abilities.find((a: any) => a.type === abilityType);

    if (!ability) return;

    // Check for deflect shield FIRST
    if (effectManager.isEffectActive('deflect_shield')) {
      // Shield blocks this debuff
      effectManager.clearEffect('deflect_shield');

      // Show "Deflected!" notification
      setAbilityNotification({
        name: 'Deflected: ' + (ability?.name || abilityType),
        description: 'Your shield blocked the attack!',
        category: 'buff',
      });
      setTimeout(() => setAbilityNotification(null), 3000);

      audioManager.playSfx('ability_buff_activate'); // Success sound
      haptics.medium();

      return; // Don't apply the debuff
    }

    // Play debuff sound (we're receiving a debuff from opponent)
    audioManager.playSfx('ability_debuff_activate');

    // Track the effect
    if (ability.duration) {
      effectManager.activateEffect(abilityType, ability.duration);
      updateActiveEffects();
    }

    // Apply instant debuff effects
    switch (abilityType) {
      case 'earthquake': {
        // Find blocks that will be removed
        const removedBlocks: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < gameState.board.height; y++) {
          for (let x = 0; x < gameState.board.width; x++) {
            if (gameState.board.grid[y][x]) {
              // Check if this block will be removed (roughly 15-25 out of all blocks)
              if (Math.random() < 0.3) { // Approximate probability
                removedBlocks.push({ x, y });
              }
            }
          }
        }

        // Trigger fade-out animation for removed blocks
        if (rendererRef.current) {
          rendererRef.current.animationManager.animateBlocksDisappearing(removedBlocks, '#888888');
        }

        // Apply the effect after brief delay for animation
        setTimeout(() => {
          const newBoard = applyEarthquake(gameState.board);
          updateBoard(newBoard);
        }, 100);
        break;
      }

      case 'death_cross': {
        // Flash diagonal blocks
        const diagonalBlocks: Array<{ x: number; y: number }> = [];
        const board = gameState.board;

        // Diagonal from bottom-left to top-right
        for (let i = 0; i < Math.min(board.width, board.height); i++) {
          const x = i;
          const y = board.height - 1 - i;
          if (y >= 0) {
            diagonalBlocks.push({ x, y });
          }
        }

        // Diagonal from bottom-right to top-left
        for (let i = 0; i < Math.min(board.width, board.height); i++) {
          const x = board.width - 1 - i;
          const y = board.height - 1 - i;
          if (y >= 0 && x >= 0) {
            diagonalBlocks.push({ x, y });
          }
        }

        // Trigger flash animation
        if (rendererRef.current) {
          rendererRef.current.animationManager.animateBlocksFlashing(diagonalBlocks, '#ff00ff');
        }

        // Apply the effect after animation
        setTimeout(() => {
          const newBoard = applyDeathCross(gameState.board);
          updateBoard(newBoard);
        }, 150);
        break;
      }

      case 'row_rotate': {
        // Flash all blocks briefly to indicate rotation
        const allBlocks: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < gameState.board.height; y++) {
          for (let x = 0; x < gameState.board.width; x++) {
            if (gameState.board.grid[y][x]) {
              allBlocks.push({ x, y });
            }
          }
        }

        if (rendererRef.current) {
          rendererRef.current.animationManager.animateBlocksFlashing(allBlocks, '#00d4ff');
        }

        // Rotate each row randomly
        const newBoard = applyRowRotate(gameState.board);
        updateBoard(newBoard);
        break;
      }

      case 'weird_shapes': {
        // Next piece will be weird 5x5 shape
        setWeirdShapesRemaining(1);
        console.log('Weird Shapes received - next piece will be large hollowed shape');
        break;
      }

      case 'speed_up_opponent':
      case 'rotation_lock':
      case 'blind_spot':
      case 'reverse_controls':
      case 'screen_shake':
      case 'shrink_ceiling':
      case 'random_spawner':
      case 'gold_digger':
        // Duration-based effects handled by AbilityEffectManager
        // These will be checked during game loop or rendering
        break;
    }
  };

  // Update active effects display
  const updateActiveEffects = () => {
    setActiveEffects(effectManager.getActiveEffects());
  };

  // Calculate and save match rewards
  const calculateMatchRewards = useCallback(async (isWin: boolean) => {
    console.log('[REWARDS] Starting reward calculation...', { isWin, opponentProfile, profile });

    // Ensure we have opponent profile
    let currentOpponentProfile = opponentProfile;
    if (!currentOpponentProfile) {
      console.error('[REWARDS] Opponent profile not loaded, fetching now...');
      const fetchedProfile = await progressionService.getUserProfile(opponentId);
      if (fetchedProfile) {
        setOpponentProfile(fetchedProfile);
        currentOpponentProfile = fetchedProfile;
      } else {
        console.error('[REWARDS] Could not fetch opponent profile, using default Rank');
        currentOpponentProfile = { rank: 1000 } as UserProfile;
      }
    }

    const outcome: 'win' | 'loss' = isWin ? 'win' : 'loss';
    const matchDuration = Math.floor((Date.now() - matchStartTimeRef.current) / 1000);

    // Calculate Rank change
    const opponentRank = currentOpponentProfile?.rank || 1000;
    console.log('[REWARDS] Calculating Rank...', { playerRank: profile.rank, opponentRank, gamesPlayed: profile.gamesPlayed });
    const rankChange = calculateRankChange(
      profile.rank,
      opponentRank,
      outcome,
      profile.gamesPlayed
    );
    const rankAfter = profile.rank + rankChange;
    const isPlacementMatch = isInPlacement(profile.gamesPlayed);

    // Calculate base coins
    let coinsEarned = isWin ? COIN_VALUES.win : COIN_VALUES.loss;

    // Performance bonuses
    if (gameState.linesCleared >= 40) {
      coinsEarned += COIN_VALUES.lines40Plus;
    } else if (gameState.linesCleared >= 20) {
      coinsEarned += COIN_VALUES.lines20Plus;
    }

    if (abilitiesUsedCount >= 5) {
      coinsEarned += COIN_VALUES.abilities5Plus;
    } else if (abilitiesUsedCount === 0 && isWin) {
      coinsEarned += COIN_VALUES.noAbilityWin;
    }

    // Calculate XP
    let xpEarned = XP_VALUES.matchComplete;
    if (isWin) {
      xpEarned += XP_VALUES.matchWin;
    }

    // Calculate new totals
    const newCoins = profile.coins + coinsEarned;
    const newXp = profile.xp + xpEarned;
    const oldLevel = profile.level;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > oldLevel;

    // Check for newly unlocked abilities
    const availableAbilitiesBefore = getAvailableAbilities(oldLevel);
    const availableAbilitiesAfter = getAvailableAbilities(newLevel);
    const newAbilities = availableAbilitiesAfter
      .filter(unlock => !availableAbilitiesBefore.find(u => u.abilityId === unlock.abilityId))
      .map(unlock => unlock.abilityId);

    console.log('[REWARDS] Updating profile...', { newCoins, newXp, newLevel, rankAfter });

    // Update profile in database
    const updated = await progressionService.updateUserProfile(profile.userId, {
      coins: newCoins,
      xp: newXp,
      level: newLevel,
      rank: rankAfter,
      gamesPlayed: profile.gamesPlayed + 1,
      lastActiveAt: Date.now(),
    });

    console.log('[REWARDS] Profile updated:', updated);

    // Save match result
    const matchResult: MatchResult = {
      id: `${profile.userId}-${Date.now()}`,
      userId: profile.userId,
      opponentId: opponentId,
      outcome,
      linesCleared: gameState.linesCleared,
      abilitiesUsed: abilitiesUsedCount,
      coinsEarned,
      xpEarned,
      rankChange,
      rankAfter,
      opponentRank,
      duration: matchDuration,
      timestamp: Date.now(),
    };

    console.log('[REWARDS] Saving match result...', matchResult);
    const saved = await progressionService.saveMatchResult(matchResult);
    console.log('[REWARDS] Match result saved:', saved);

    // Set rewards for display
    console.log('[REWARDS] Setting rewards for display...');
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
    console.log('[REWARDS] Rewards calculation complete!');
  }, [opponentProfile, profile, opponentId, gameState.linesCleared, abilitiesUsedCount]);

  // Update active effects periodically
  useEffect(() => {
    const interval = setInterval(updateActiveEffects, 100);
    return () => clearInterval(interval);
  }, []);

  // Sync cascade multiplier with effect manager
  useEffect(() => {
    const interval = setInterval(() => {
      const isActive = effectManager.isEffectActive('cascade_multiplier');
      setCascadeMultiplier(isActive);
    }, 100);
    return () => clearInterval(interval);
  }, [setCascadeMultiplier]);

  // Sync shrink ceiling with effect manager
  useEffect(() => {
    const interval = setInterval(() => {
      const isActive = effectManager.isEffectActive('shrink_ceiling');
      setShrinkCeilingRows(isActive ? 4 : 0);
    }, 100);
    return () => clearInterval(interval);
  }, [setShrinkCeilingRows]);

  // Periodic random spawner effect - spawn blocks every 2 seconds while active
  useEffect(() => {
    const interval = setInterval(() => {
      const isActive = effectManager.isEffectActive('random_spawner');
      if (isActive) {
        const newBoard = applyRandomSpawner(gameState.board);
        updateBoard(newBoard);
      }
    }, 2000); // Every 2 seconds
    return () => clearInterval(interval);
  }, []); // Empty deps - interval runs once, accesses current gameState via closure

  // Periodic gold digger effect - remove blocks every 2 seconds while active
  useEffect(() => {
    const interval = setInterval(() => {
      const isActive = effectManager.isEffectActive('gold_digger');
      if (isActive) {
        const newBoard = applyGoldDigger(gameState.board);
        updateBoard(newBoard);
      }
    }, 2000); // Every 2 seconds
    return () => clearInterval(interval);
  }, []); // Empty deps - interval runs once, accesses current gameState via closure

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver || gameFinished) return;

      // Check if reverse controls is active
      const isReversed = effectManager.isEffectActive('reverse_controls');

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          audioManager.playSfx('piece_move', 0.3);
          if (isReversed) {
            movePieceRight(); // Reversed!
          } else {
            movePieceLeft();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          audioManager.playSfx('piece_move', 0.3);
          if (isReversed) {
            movePieceLeft(); // Reversed!
          } else {
            movePieceRight();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          audioManager.playSfx('soft_drop', 0.4);
          movePieceDown();
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          // Check if rotation is locked by debuff
          if (!effectManager.isEffectActive('rotation_lock')) {
            audioManager.playSfx('piece_rotate', 0.5);
            rotatePieceClockwise();
          }
          break;
        case ' ':
          e.preventDefault();
          audioManager.playSfx('hard_drop');
          handleHardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          audioManager.playSfx(isPaused ? 'resume' : 'pause');
          togglePause();
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
  }, [
    gameState.isGameOver,
    gameFinished,
    movePieceLeft,
    movePieceRight,
    movePieceDown,
    rotatePieceClockwise,
    hardDrop,
    togglePause,
    availableAbilities,
  ]);

  // Calculate rewards when game finishes
  useEffect(() => {
    if (gameFinished && winnerId && !matchRewards) {
      console.log('[GAME] Game finished, calculating rewards...', { winnerId, playerId });
      const isWin = winnerId === playerId;
      calculateMatchRewards(isWin);
    } else if (gameFinished && winnerId && matchRewards) {
      console.log('[GAME] Rewards already calculated:', matchRewards);
    }
  }, [gameFinished, winnerId, playerId, matchRewards, calculateMatchRewards]);

  // Play victory or defeat music when game finishes
  useEffect(() => {
    if (gameFinished && winnerId) {
      const isWin = winnerId === playerId;

      // Stop gameplay music
      audioManager.stopMusic();

      // Play victory or defeat theme
      if (isWin) {
        console.log('[AUDIO] Playing victory theme');
        audioManager.playMusic('victory_theme', false); // Don't loop
        haptics.success();
      } else {
        console.log('[AUDIO] Playing defeat theme');
        audioManager.playMusic('defeat_theme', false); // Don't loop
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
        height: '100dvh', // Dynamic viewport height for mobile
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
      {/* Main Game Area - Top Section */}
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
                maxHeight: 'calc(100dvh - 110px)', // Account for header and bottom controls
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
          <div
            style={{
              marginTop: '4px',
              padding: '4px 6px',
              background: 'transparent',
              border: 'none',
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
                  key={`score-${gameState.score}`}
                  variants={scoreVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={springs.gentle}
                  style={{ color: '#00d4ff', textShadow: '0 0 8px rgba(0, 212, 255, 0.8)', display: 'inline-block' }}
                >
                  {gameState.score}
                </motion.span>
              </AnimatePresence>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(2px, 0.5vw, 3px)' }}>
              <span style={{ color: '#c942ff', opacity: 0.7, fontSize: 'clamp(7px, 1.75vw, 9px)', fontWeight: '600' }}>Stars</span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={`stars-${gameState.stars}`}
                  variants={scoreVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={springs.gentle}
                  style={{ color: '#c942ff', textShadow: '0 0 8px rgba(201, 66, 255, 0.8)', display: 'inline-block' }}
                >
                  {gameState.stars}⭐
                </motion.span>
              </AnimatePresence>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(2px, 0.5vw, 3px)' }}>
              <span style={{ color: '#00ff88', opacity: 0.7, fontSize: 'clamp(7px, 1.75vw, 9px)', fontWeight: '600' }}>Lines</span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={`lines-${gameState.linesCleared}`}
                  variants={scoreVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={springs.gentle}
                  style={{ color: '#00ff88', textShadow: '0 0 8px rgba(0, 255, 136, 0.8)', display: 'inline-block' }}
                >
                  {gameState.linesCleared}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right: Vertical Panel */}
        <div style={{
          width: 'clamp(85px, 22vw, 110px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(4px, 1vh, 8px)',
          overflow: 'hidden'
        }}>
          {/* Top Buttons Row */}
          <div style={{
            display: 'flex',
            gap: 'clamp(4px, 1vw, 6px)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {/* User Account Button */}
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
                    rootBox: {
                      width: '100%',
                      height: '100%',
                    },
                    avatarBox: {
                      width: '100%',
                      height: '100%',
                    },
                    userButtonPopoverCard: {
                      background: 'rgba(10, 10, 30, 0.95)',
                      backdropFilter: 'blur(30px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                    },
                    userButtonPopoverActionButton: {
                      color: '#ffffff',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.1)',
                      },
                    },
                    userButtonPopoverActionButtonText: {
                      color: '#ffffff',
                    },
                    userButtonPopoverFooter: {
                      background: 'rgba(0, 0, 0, 0.2)',
                    },
                  },
                }}
              />
            </div>

            {/* Ability Info Button */}
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
            border: 'none',
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
              <div
                style={{
                  marginTop: '3px',
                  padding: '3px 6px',
                  background: 'transparent',
                  borderRadius: '4px',
                  fontSize: 'clamp(6px, 1.5vw, 8px)',
                  textAlign: 'center',
                  fontWeight: '700',
                  border: 'none',
                }}
              >
                <div style={{ color: '#ff006e', textShadow: '0 0 8px rgba(255, 0, 110, 0.8)' }}>{opponentState.score}</div>
                <div style={{ color: '#c942ff', textShadow: '0 0 8px rgba(201, 66, 255, 0.8)' }}>{opponentState.stars}</div>
              </div>
            )}
          </div>

          {/* Abilities List - One per row with text names */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(3px, 0.7vw, 5px)',
            overflow: 'auto',
            minHeight: 0,
            paddingRight: 'clamp(2px, 0.5vw, 3px)',
          }}>
            {availableAbilities.slice(0, 8).map((ability, index) => {
              const isAffordable = gameState.stars >= ability.cost;

              return (
                <motion.button
                  key={index}
                  initial="initial"
                  animate="animate"
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
                    background: isAffordable
                      ? 'rgba(10, 10, 30, 0.6)'
                      : 'rgba(10, 10, 30, 0.3)',
                    backdropFilter: 'blur(20px)',
                    border: isAffordable
                      ? `1px solid rgba(255, 255, 255, 0.2)`
                      : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 'clamp(6px, 1.5vw, 8px)',
                    color: '#ffffff',
                    cursor: isAffordable ? 'pointer' : 'not-allowed',
                    opacity: isAffordable ? 1 : 0.3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'clamp(4px, 1vw, 6px)',
                    boxShadow: isAffordable
                      ? '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      : 'none',
                    minHeight: 'clamp(32px, 8vw, 40px)',
                    position: 'relative',
                  }}
                  title={`${ability.name}: ${ability.description}`}
                >
                  <div style={{
                    fontSize: 'clamp(9px, 2.2vw, 11px)',
                    fontWeight: '800',
                    letterSpacing: '0.5px',
                    color: isAffordable ? '#ffffff' : '#666',
                    textShadow: isAffordable
                      ? (ability.category === 'buff'
                        ? '0 0 8px rgba(0, 212, 255, 0.6)'
                        : '0 0 8px rgba(255, 0, 110, 0.6)')
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
                      ? (ability.category === 'buff'
                        ? 'rgba(0, 212, 255, 0.15)'
                        : 'rgba(255, 0, 110, 0.15)')
                      : 'rgba(100, 100, 100, 0.1)',
                    padding: 'clamp(1px, 0.3vw, 2px) clamp(4px, 1vw, 6px)',
                    borderRadius: 'clamp(3px, 0.8vw, 4px)',
                    border: `1px solid ${isAffordable
                      ? (ability.category === 'buff'
                        ? 'rgba(0, 212, 255, 0.3)'
                        : 'rgba(255, 0, 110, 0.3)')
                      : 'rgba(255,255,255,0.05)'}`,
                    color: isAffordable
                      ? (ability.category === 'buff' ? '#00d4ff' : '#ff006e')
                      : '#666',
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

      {/* Bottom: Touch Controls - Single Row */}
      <div
        style={{
          height: 'clamp(60px, 12vh, 80px)',
          display: 'flex',
          gap: 'clamp(4px, 1vw, 8px)',
          padding: 'clamp(6px, 1.5vw, 10px)',
          background: 'linear-gradient(180deg, rgba(10,10,25,0.4) 0%, rgba(5,5,15,0.8) 100%)',
          backdropFilter: 'blur(20px)',
          borderTop: `1px solid rgba(0, 212, 255, 0.2)`,
          boxShadow: '0 -5px 25px rgba(0, 212, 255, 0.1)',
        }}
      >
        {/* Move Left */}
        <motion.button
          whileTap="tap"
          variants={buttonVariants}
          transition={springs.snappy}
          onPointerDown={(e) => {
            e.preventDefault();
            haptics.light();
            audioManager.playSfx('piece_move', 0.3);
            effectManager.isEffectActive('reverse_controls') ? movePieceRight() : movePieceLeft();
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 30, 0.6)',
            backdropFilter: 'blur(20px)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            audioManager.playSfx('hard_drop');
            handleHardDrop();
          }}
          className="glass-button"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(255, 0, 110, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 0 20px rgba(255, 0, 110, 0.5), inset 0 0 10px rgba(255, 0, 110, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            haptics.light();
            audioManager.playSfx('soft_drop', 0.4);
            movePieceDown();
          }}
          className="glass-button"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(201, 66, 255, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 0 20px rgba(201, 66, 255, 0.5), inset 0 0 10px rgba(201, 66, 255, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            haptics.light();
            audioManager.playSfx('piece_rotate', 0.5);
            if (!effectManager.isEffectActive('rotation_lock')) {
              rotatePieceClockwise();
            }
          }}
          className="glass-button"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(0, 255, 136, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.5), inset 0 0 10px rgba(0, 255, 136, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            haptics.light();
            audioManager.playSfx('piece_move', 0.3);
            effectManager.isEffectActive('reverse_controls') ? movePieceLeft() : movePieceRight();
          }}
          className="glass-button"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 30, 0.6)',
            color: '#ffffff',
            border: '2px solid rgba(255, 165, 0, 0.4)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 0 20px rgba(255, 165, 0, 0.5), inset 0 0 10px rgba(255, 165, 0, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <svg width="clamp(20px, 5vw, 32px)" height="clamp(20px, 5vw, 32px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
                textShadow: isWinner
                  ? '0 0 20px rgba(0, 255, 136, 0.8)'
                  : '0 0 20px rgba(255, 0, 110, 0.8)',
                letterSpacing: '2px',
              }}>
                {isWinner ? 'VICTORY!' : 'DEFEAT'}
              </h2>

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
                  <span style={{ color: '#fff', fontWeight: '700', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>{gameState.score}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'clamp(8px, 2vw, 12px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'clamp(6px, 1.5vw, 8px)',
                }}>
                  <span style={{ color: '#aaa', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>Lines Cleared</span>
                  <span style={{ color: '#fff', fontWeight: '700', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>{gameState.linesCleared}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'clamp(8px, 2vw, 12px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'clamp(6px, 1.5vw, 8px)',
                }}>
                  <span style={{ color: '#aaa', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>Stars Earned</span>
                  <span style={{ color: '#c942ff', fontWeight: '700', fontSize: 'clamp(14px, 3.5vw, 18px)' }}>{gameState.stars}</span>
                </div>
              </div>

              {/* Rewards Section */}
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
                    {matchRewards.newAbilities.length > 0 && (
                      <div style={{
                        marginTop: 'clamp(4px, 1vw, 6px)',
                        padding: 'clamp(6px, 1.5vw, 8px)',
                        background: 'rgba(0, 212, 255, 0.15)',
                        borderRadius: 'clamp(4px, 1vw, 6px)',
                        textAlign: 'center',
                      }}>
                        <span style={{
                          color: '#00d4ff',
                          fontWeight: '700',
                          fontSize: 'clamp(12px, 3vw, 15px)',
                          textShadow: '0 0 8px rgba(0, 212, 255, 0.6)',
                        }}>
                          {matchRewards.newAbilities.length} NEW {matchRewards.newAbilities.length === 1 ? 'ABILITY' : 'ABILITIES'} AVAILABLE!
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

      {/* Flash overlay for line clears */}
      {flashEffect && (
        <FlashOverlay
          color={flashEffect.color}
          onComplete={() => setFlashEffect(null)}
        />
      )}

      {/* Particle effects */}
      {particles && (
        <ParticleEffect
          key={particles.id}
          x={particles.x}
          y={particles.y}
          count={50}
          onComplete={() => setParticles(null)}
        />
      )}

      {/* Ability activation notification */}
      <AbilityNotification
        abilityName={abilityNotification?.name || null}
        description={abilityNotification?.description || null}
        category={abilityNotification?.category || null}
      />

      {/* Debug Panel */}
      {isDebugMode && debugLogger && (
        <DebugPanel
          debugLogger={debugLogger}
          gameClient={gameSyncRef.current}
          yourState={gameState}
          opponentState={opponentState}
          onAbilityTrigger={(abilityType, target) => {
            const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
            if (!ability) return;

            console.log('[DEBUG] Triggering ability:', abilityType, 'on', target);
            handleAbilityActivate(ability);
          }}
        />
      )}
    </div>
  );
}
