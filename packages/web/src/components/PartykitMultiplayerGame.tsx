import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { PartykitGameSync } from '../services/partykit/gameSync';
import { AbilityCarousel } from './AbilityCarousel';
import { AbilityEffects } from './AbilityEffects';
import { TouchControls } from './TouchControls';
import {
  AbilityEffectManager,
  ABILITIES,
  applyClearRows,
  applyRandomSpawner,
  applyEarthquake,
  applyColumnBomb,
  createMiniBlock,
} from '@tetris-battle/game-core';
import type { Ability } from '@tetris-battle/game-core';
import type { Theme } from '../themes';

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

    return () => {
      sync.disconnect();
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
      // Opponent canvas is smaller (100x200), so cellSize = 10
      opponentRendererRef.current = new TetrisRenderer(opponentCanvasRef.current, 10, theme);
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
      rendererRef.current.render(gameState.board, gameState.currentPiece, ghostPiece, {
        showGrid: true,
        showGhost: true,
        isBomb: gameState.bombType !== null,
      });

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

        case 'piece_preview_plus':
        case 'mini_blocks':
        case 'cascade_multiplier':
        case 'deflect_shield':
          // Duration-based effects handled by AbilityEffectManager
          break;

        case 'board_swap':
        case 'gravity_invert':
        case 'mirror_match':
          // Ultra abilities - send to opponent for special handling
          gameSyncRef.current?.activateAbility(ability.type, opponentId);
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

    // Track the effect
    if (ability.duration) {
      effectManager.activateEffect(abilityType, ability.duration);
      updateActiveEffects();
    }

    // Apply instant debuff effects
    switch (abilityType) {
      case 'random_spawner': {
        // Add random junk blocks to board
        const newBoard = applyRandomSpawner(gameState.board);
        updateBoard(newBoard);
        break;
      }

      case 'earthquake': {
        // Shift all rows randomly
        const newBoard = applyEarthquake(gameState.board);
        updateBoard(newBoard);
        break;
      }

      case 'column_bomb': {
        // Drop 8 garbage blocks into random column
        const newBoard = applyColumnBomb(gameState.board);
        updateBoard(newBoard);
        break;
      }

      case 'speed_up_opponent':
      case 'weird_shapes':
      case 'rotation_lock':
      case 'blind_spot':
      case 'reverse_controls':
      case 'screen_shake':
      case 'shrink_ceiling':
      case 'mirror_blocks':
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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver || gameFinished) return;

      // Check if reverse controls is active
      const isReversed = effectManager.isEffectActive('reverse_controls');

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (isReversed) {
            movePieceRight(); // Reversed!
          } else {
            movePieceLeft();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isReversed) {
            movePieceLeft(); // Reversed!
          } else {
            movePieceRight();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePieceDown();
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          // Check if rotation is locked by debuff
          if (!effectManager.isEffectActive('rotation_lock')) {
            rotatePieceClockwise();
          }
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
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
        alignItems: 'center',
        padding: '10px 10px 180px 10px', // Extra bottom padding for fixed controls
        backgroundColor: theme.backgroundColor,
        minHeight: '100vh',
        color: theme.textColor,
        fontFamily: 'monospace',
        gap: '15px',
      }}
    >
      {/* Main Game Area */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Your Board */}
        <div style={{ position: 'relative' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '14px' }}>YOU</h3>
          <div style={{
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
                border: `2px solid ${theme.textColor}`,
                backgroundColor: theme.backgroundColor,
                maxWidth: '100%',
              }}
            />
          </div>
          <AbilityEffects activeEffects={activeEffects} theme={theme} />
          <div
            style={{
              marginTop: '5px',
              padding: '8px',
              backgroundColor: theme.uiBackgroundColor,
              borderRadius: '5px',
              fontSize: '12px',
            }}
          >
            <p style={{ margin: '2px 0' }}>Score: {gameState.score}</p>
            <p style={{ margin: '2px 0' }}>Stars: {gameState.stars} ⭐</p>
            <p style={{ margin: '2px 0' }}>Lines: {gameState.linesCleared}</p>
          </div>
        </div>

        {/* Opponent's Board - Much Smaller */}
        <div>
          <h3 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '12px' }}>OPPONENT</h3>
          <canvas
            ref={opponentCanvasRef}
            width={100}
            height={200}
            style={{
              border: `2px solid ${theme.colors.Z}`,
              backgroundColor: theme.backgroundColor,
            }}
          />
          {opponentState && (
            <div
              style={{
                marginTop: '5px',
                padding: '5px',
                backgroundColor: theme.uiBackgroundColor,
                borderRadius: '3px',
                fontSize: '10px',
              }}
            >
              <p style={{ margin: '2px 0' }}>S: {opponentState.score}</p>
              <p style={{ margin: '2px 0' }}>⭐: {opponentState.stars}</p>
              <p style={{ margin: '2px 0' }}>L: {opponentState.linesCleared}</p>
            </div>
          )}
        </div>
      </div>

      {/* Abilities - Smaller */}
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <AbilityCarousel
          currentStars={gameState.stars}
          onActivate={handleAbilityActivate}
          theme={theme}
        />
      </div>

      {/* Touch Controls for Mobile */}
      <TouchControls
        onMoveLeft={effectManager.isEffectActive('reverse_controls') ? movePieceRight : movePieceLeft}
        onMoveRight={effectManager.isEffectActive('reverse_controls') ? movePieceLeft : movePieceRight}
        onRotate={rotatePieceClockwise}
        onSoftDrop={movePieceDown}
        onHardDrop={hardDrop}
        theme={theme}
      />

      {/* Compact Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '500px' }}>
        <div
          style={{
            backgroundColor: theme.uiBackgroundColor,
            padding: '10px',
            borderRadius: '5px',
            fontSize: '11px',
            flex: '1',
            minWidth: '150px',
          }}
        >
          <h4 style={{ marginTop: 0, marginBottom: '5px', fontSize: '12px' }}>Controls</h4>
          <p style={{ margin: '2px 0' }}>← → Move</p>
          <p style={{ margin: '2px 0' }}>↑ Rotate</p>
          <p style={{ margin: '2px 0' }}>SPACE Drop</p>
        </div>

        <button
          onClick={onExit}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: theme.colors.Z,
            color: '#ffffff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            alignSelf: 'center',
          }}
        >
          Leave Game
        </button>
      </div>

      {!isConnected && (
        <p style={{ fontSize: '12px', color: theme.colors.L }}>Connecting...</p>
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
