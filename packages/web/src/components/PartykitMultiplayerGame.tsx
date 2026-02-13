import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { PartykitGameSync } from '../services/partykit/gameSync';
import { AbilityEffects } from './AbilityEffects';
import {
  AbilityEffectManager,
  ABILITIES,
  applyClearRows,
  applyRandomSpawner,
  applyEarthquake,
} from '@tetris-battle/game-core';
import type { Ability } from '@tetris-battle/game-core';
import type { Theme } from '../themes';
import { audioManager } from '../services/audioManager';

interface MultiplayerGameProps {
  roomId: string;
  playerId: string;
  opponentId: string;
  theme: Theme;
  onExit: () => void;
}

export function MultiplayerGame({ roomId, playerId, opponentId, theme, onExit }: MultiplayerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const opponentRendererRef = useRef<TetrisRenderer | null>(null);
  const gameSyncRef = useRef<PartykitGameSync | null>(null);
  const gameLoopRef = useRef<number | null>(null);

  const [opponentState, setOpponentState] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [effectManager] = useState(() => new AbilityEffectManager());
  const [activeEffects, setActiveEffects] = useState<any[]>([]);
  const [explosion, setExplosion] = useState<{ x: number; y: number; startTime: number } | null>(null);

  const { availableAbilities } = useAbilityStore();

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

  // Initialize game sync
  useEffect(() => {
    const host = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';
    const sync = new PartykitGameSync(roomId, playerId, host);
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

  // Sync game state to server
  useEffect(() => {
    if (gameSyncRef.current && isConnected) {
      gameSyncRef.current.updateGameState(
        gameState.board,
        gameState.score,
        gameState.stars,
        gameState.linesCleared,
        gameState.comboCount,
        gameState.isGameOver
      );

      // Check for game over
      if (gameState.isGameOver && !gameFinished) {
        gameSyncRef.current.gameOver();
      }
    }
  }, [gameState, isConnected, gameFinished]);

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

    if (!gameState.isGameOver && isConnected && !gameFinished) {
      gameLoopRef.current = window.setTimeout(loop, BASE_TICK_RATE);
    }

    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, [tick, gameState.isGameOver, isConnected, gameFinished]);

  // Set up bomb explosion callback
  useEffect(() => {
    setOnBombExplode((x, y, type) => {
      console.log('Explosion triggered at', x, y, type);
      setExplosion({ x, y, startTime: Date.now() });
      // Clear explosion after 500ms
      setTimeout(() => setExplosion(null), 500);
    });
  }, [setOnBombExplode]);

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
      opponentRendererRef.current.render(opponentBoard, null, null, {
        showGrid: true,
        showGhost: false,
      });
    }
  }, [opponentState]);

  // Handle ability activation
  const handleAbilityActivate = (ability: Ability) => {
    console.log('Activating ability:', ability.name);

    // Deduct stars first
    deductStars(ability.cost);

    // Play sound based on ability category
    if (ability.category === 'buff') {
      audioManager.playSfx('ability_buff_activate');
    } else if (ability.category === 'debuff') {
      audioManager.playSfx('ability_debuff_activate');
    }

    if (ability.category === 'buff' || ability.category === 'defense' || ability.category === 'ultra') {
      // Apply buff/defense/ultra to self (or handle ultra effects)
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
          // Clear bottom 5 rows
          const { board: clearedBoard } = applyClearRows(gameState.board, 5);
          updateBoard(clearedBoard);
          break;
        }

        case 'mini_blocks': {
          // Activate mini blocks - next 5 pieces will be 2-cell dominoes
          setMiniBlocksRemaining(5);
          console.log('Mini Blocks activated - next 5 pieces will be small');
          break;
        }

        case 'cascade_multiplier':
          // Duration-based effects handled by AbilityEffectManager
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
        // Shift all rows randomly
        const newBoard = applyEarthquake(gameState.board);
        updateBoard(newBoard);
        break;
      }

      case 'weird_shapes': {
        // Next 3 pieces will be weird 5x5 shapes
        setWeirdShapesRemaining(3);
        console.log('Weird Shapes received - next 3 pieces will be large random shapes');
        break;
      }

      case 'speed_up_opponent':
      case 'rotation_lock':
      case 'blind_spot':
      case 'reverse_controls':
      case 'screen_shake':
      case 'shrink_ceiling':
      case 'random_spawner':
        // Duration-based effects handled by AbilityEffectManager
        // These will be checked during game loop or rendering
        break;
    }
  };

  // Update active effects display
  const updateActiveEffects = () => {
    setActiveEffects(effectManager.getActiveEffects());
  };

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
  }, [gameState.board]);

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
          hardDrop();
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

  const isWinner = winnerId === playerId;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh', // Dynamic viewport height for mobile
        width: '100vw',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      {/* Main Game Area - Top Section */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '4px', gap: '4px' }}>
        {/* Left: Your Board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h3 style={{
            textAlign: 'center',
            margin: '0 0 4px 0',
            fontSize: 'clamp(11px, 2.8vw, 14px)',
            fontWeight: '700',
            letterSpacing: '1px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
          }}>YOUR BOARD</h3>
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transform: effectManager.isEffectActive('screen_shake')
              ? `translate(${Math.sin(Date.now() / 50) * 5}px, ${Math.cos(Date.now() / 70) * 5}px) rotate(${Math.sin(Date.now() / 100) * 2}deg)`
              : 'none',
            transition: 'none',
          }}>
            <canvas
              ref={canvasRef}
              width={250}
              height={500}
              style={{
                border: '3px solid rgba(102, 126, 234, 0.5)',
                backgroundColor: 'rgba(0,0,0,0.3)',
                maxHeight: 'calc(100dvh - 110px)', // Account for header and bottom controls
                maxWidth: '100%',
                height: 'auto',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: 'clamp(6px, 1.5vw, 10px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px rgba(102, 126, 234, 0.1)',
              }}
            />
          </div>
          <AbilityEffects activeEffects={activeEffects} theme={theme} />
          <div
            style={{
              marginTop: '4px',
              padding: '6px 8px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: 'clamp(9px, 2.2vw, 11px)',
              textAlign: 'center',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ marginRight: '8px' }}>🎯 {gameState.score}</span>
            <span style={{ marginRight: '8px' }}>⭐ {gameState.stars}</span>
            <span>📊 {gameState.linesCleared}</span>
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
          {/* Settings Button */}
          <button
            onClick={() => {
              if (confirm('Leave game?')) onExit();
            }}
            style={{
              padding: '6px',
              background: 'linear-gradient(135deg, rgba(250, 112, 154, 0.3) 0%, rgba(254, 225, 64, 0.3) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              color: '#ffffff',
              fontSize: 'clamp(16px, 4vw, 20px)',
              cursor: 'pointer',
              width: 'clamp(34px, 8.5vw, 42px)',
              height: 'clamp(34px, 8.5vw, 42px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            ⚙
          </button>

          {/* Opponent's Board */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.15) 0%, rgba(245, 87, 108, 0.15) 100%)',
            padding: 'clamp(4px, 1vw, 6px)',
            borderRadius: 'clamp(6px, 1.5vw, 10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h3 style={{
              margin: '0 0 3px 0',
              fontSize: 'clamp(7px, 2vw, 9px)',
              fontWeight: '700',
              letterSpacing: '0.5px',
              opacity: 0.8,
            }}>OPPONENT</h3>
            <canvas
              ref={opponentCanvasRef}
              width={80}
              height={160}
              style={{
                border: '2px solid rgba(245, 87, 108, 0.4)',
                backgroundColor: 'rgba(0,0,0,0.3)',
                width: 'clamp(65px, 17vw, 80px)',
                height: 'clamp(130px, 34vw, 160px)',
                borderRadius: 'clamp(4px, 1vw, 6px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            />
            {opponentState && (
              <div
                style={{
                  marginTop: '3px',
                  padding: '3px 6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '4px',
                  fontSize: 'clamp(6px, 1.5vw, 8px)',
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                <div>🎯 {opponentState.score}</div>
                <div>⭐ {opponentState.stars}</div>
              </div>
            )}
          </div>

          {/* Abilities Grid - 4 rows x 2 columns */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'repeat(4, 1fr)',
            gap: 'clamp(3px, 0.8vw, 6px)',
            overflow: 'hidden',
            minHeight: 0,
          }}>
            {availableAbilities.slice(0, 8).map((ability, index) => {
              const isAffordable = gameState.stars >= ability.cost;
              const gradient = ability.category === 'buff'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';

              return (
                <button
                  key={index}
                  onClick={() => {
                    if (isAffordable) {
                      handleAbilityActivate(ability);
                    }
                  }}
                  disabled={!isAffordable}
                  style={{
                    padding: 'clamp(3px, 0.8vw, 5px)',
                    background: isAffordable ? gradient : 'rgba(0,0,0,0.3)',
                    border: isAffordable
                      ? '1px solid rgba(255,255,255,0.3)'
                      : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'clamp(4px, 1vw, 8px)',
                    color: '#ffffff',
                    cursor: isAffordable ? 'pointer' : 'not-allowed',
                    opacity: isAffordable ? 1 : 0.4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 0,
                    minWidth: 0,
                    boxShadow: isAffordable
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  title={`${ability.name} (${ability.cost}⭐)`}
                >
                  <div style={{
                    fontSize: 'clamp(14px, 3.5vw, 18px)',
                    lineHeight: 1,
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}>
                    {ability.icon}
                  </div>
                  <div style={{
                    fontSize: 'clamp(7px, 1.8vw, 9px)',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    fontWeight: '600',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '1px 3px',
                    borderRadius: '3px',
                  }}>
                    {ability.cost}⭐
                  </div>
                </button>
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
          background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
          backdropFilter: 'blur(10px)',
          borderTop: `1px solid rgba(255,255,255,0.1)`,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Soft Drop */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            audioManager.playSfx('soft_drop', 0.4);
            movePieceDown();
          }}
          onClick={() => {
            audioManager.playSfx('soft_drop', 0.4);
            movePieceDown();
          }}
          style={{
            flex: 1,
            fontSize: 'clamp(18px, 5vw, 28px)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            fontWeight: 'bold',
          }}
        >
          ↓
        </button>
        {/* Hard Drop */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            audioManager.playSfx('hard_drop');
            hardDrop();
          }}
          onClick={() => {
            audioManager.playSfx('hard_drop');
            hardDrop();
          }}
          style={{
            flex: 1,
            fontSize: 'clamp(18px, 5vw, 28px)',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)',
            fontWeight: 'bold',
          }}
        >
          ⬇⬇
        </button>
        {/* Move Left */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            audioManager.playSfx('piece_move', 0.3);
            effectManager.isEffectActive('reverse_controls') ? movePieceRight() : movePieceLeft();
          }}
          onClick={() => {
            audioManager.playSfx('piece_move', 0.3);
            effectManager.isEffectActive('reverse_controls') ? movePieceRight() : movePieceLeft();
          }}
          style={{
            flex: 1,
            fontSize: 'clamp(18px, 5vw, 28px)',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 4px 15px rgba(79, 172, 254, 0.4)',
            fontWeight: 'bold',
          }}
        >
          ←
        </button>
        {/* Rotate */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            audioManager.playSfx('piece_rotate', 0.5);
            if (!effectManager.isEffectActive('rotation_lock')) {
              rotatePieceClockwise();
            }
          }}
          onClick={() => {
            audioManager.playSfx('piece_rotate', 0.5);
            if (!effectManager.isEffectActive('rotation_lock')) {
              rotatePieceClockwise();
            }
          }}
          style={{
            flex: 1,
            fontSize: 'clamp(18px, 5vw, 28px)',
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 4px 15px rgba(67, 233, 123, 0.4)',
            fontWeight: 'bold',
          }}
        >
          ↻
        </button>
        {/* Move Right */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            audioManager.playSfx('piece_move', 0.3);
            effectManager.isEffectActive('reverse_controls') ? movePieceLeft() : movePieceRight();
          }}
          onClick={() => {
            audioManager.playSfx('piece_move', 0.3);
            effectManager.isEffectActive('reverse_controls') ? movePieceLeft() : movePieceRight();
          }}
          style={{
            flex: 1,
            fontSize: 'clamp(18px, 5vw, 28px)',
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            minWidth: 0,
            boxShadow: '0 4px 15px rgba(250, 112, 154, 0.4)',
            fontWeight: 'bold',
          }}
        >
          →
        </button>
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

      {gameFinished && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            padding: '40px',
            borderRadius: '10px',
            textAlign: 'center',
            zIndex: 1000,
            border: `3px solid ${isWinner ? theme.colors.T : theme.colors.Z}`,
          }}
        >
          <h2 style={{ fontSize: '3rem', marginBottom: '20px' }}>
            {isWinner ? 'YOU WIN! 🎉' : 'YOU LOSE'}
          </h2>
          <p style={{ fontSize: '1.5rem', marginBottom: '30px' }}>
            Final Score: {gameState.score}
          </p>
          <button
            onClick={onExit}
            style={{
              padding: '15px 40px',
              fontSize: '18px',
              backgroundColor: theme.colors.T,
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}
