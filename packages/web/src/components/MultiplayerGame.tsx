import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { GameSyncService } from '../services/gameSync';
import type { GameRoom, GameState } from '../lib/supabase';
import type { Theme } from '../themes';

interface MultiplayerGameProps {
  room: GameRoom;
  playerId: string;
  theme: Theme;
  onExit: () => void;
}

export function MultiplayerGame({ room, playerId, theme, onExit }: MultiplayerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const opponentRendererRef = useRef<TetrisRenderer | null>(null);
  const gameSyncRef = useRef<GameSyncService | null>(null);
  const gameLoopRef = useRef<number | null>(null);

  const [opponentState, setOpponentState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const opponentId = room.player1_id === playerId ? room.player2_id : room.player1_id;

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
  } = useGameStore();

  // Initialize game sync
  useEffect(() => {
    const sync = new GameSyncService(room.id, playerId);
    gameSyncRef.current = sync;

    const init = async () => {
      try {
        // Initialize game state in database
        await sync.initializeGameState(gameState.board, gameState.stars);

        // Subscribe to opponent's updates
        sync.subscribeToOpponent(opponentId!, (state) => {
          setOpponentState(state);
        });

        // Subscribe to abilities
        sync.subscribeToAbilities((ability) => {
          console.log('Received ability:', ability);
          // TODO: Apply ability effects
        });

        setIsConnected(true);
      } catch (error) {
        console.error('Failed to initialize game sync:', error);
      }
    };

    init();
    initGame();

    return () => {
      sync.cleanup();
    };
  }, [room.id, playerId, opponentId]);

  // Sync game state to database
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
      if (gameState.isGameOver) {
        gameSyncRef.current.updateRoomStatus('finished', opponentId!);
      }
    }
  }, [gameState, isConnected, opponentId]);

  // Initialize renderers
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new TetrisRenderer(canvasRef.current, 25, theme);
    }
    if (opponentCanvasRef.current) {
      opponentRendererRef.current = new TetrisRenderer(opponentCanvasRef.current, 25, theme);
    }
  }, [theme]);

  // Game loop
  useEffect(() => {
    const TICK_RATE = 1000;

    const loop = () => {
      tick();
      gameLoopRef.current = window.setTimeout(loop, TICK_RATE);
    };

    if (!gameState.isGameOver && isConnected) {
      gameLoopRef.current = window.setTimeout(loop, TICK_RATE);
    }

    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, [tick, gameState.isGameOver, isConnected]);

  // Render own board
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(gameState.board, gameState.currentPiece, ghostPiece, {
        showGrid: true,
        showGhost: true,
      });
    }
  }, [gameState.board, gameState.currentPiece, ghostPiece]);

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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePieceLeft();
          gameSyncRef.current?.sendEvent('move', { direction: 'left' });
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePieceRight();
          gameSyncRef.current?.sendEvent('move', { direction: 'right' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePieceDown();
          gameSyncRef.current?.sendEvent('move', { direction: 'down' });
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          rotatePieceClockwise();
          gameSyncRef.current?.sendEvent('rotate', { clockwise: true });
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          gameSyncRef.current?.sendEvent('drop', {});
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState.isGameOver,
    movePieceLeft,
    movePieceRight,
    movePieceDown,
    rotatePieceClockwise,
    hardDrop,
    togglePause,
  ]);

  return (
    <div
      style={{
        display: 'flex',
        gap: '20px',
        padding: '20px',
        backgroundColor: theme.backgroundColor,
        minHeight: '100vh',
        color: theme.textColor,
        fontFamily: 'monospace',
      }}
    >
      {/* Your Board */}
      <div>
        <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>YOU</h3>
        <canvas
          ref={canvasRef}
          width={250}
          height={500}
          style={{
            border: `3px solid ${theme.textColor}`,
            backgroundColor: theme.backgroundColor,
          }}
        />
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: theme.uiBackgroundColor,
            borderRadius: '5px',
          }}
        >
          <p>Score: {gameState.score}</p>
          <p>Stars: {gameState.stars} ⭐</p>
          <p>Lines: {gameState.linesCleared}</p>
        </div>
      </div>

      {/* Opponent's Board */}
      <div>
        <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>OPPONENT</h3>
        <canvas
          ref={opponentCanvasRef}
          width={250}
          height={500}
          style={{
            border: `3px solid ${theme.colors.Z}`,
            backgroundColor: theme.backgroundColor,
          }}
        />
        {opponentState && (
          <div
            style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: theme.uiBackgroundColor,
              borderRadius: '5px',
            }}
          >
            <p>Score: {opponentState.score}</p>
            <p>Stars: {opponentState.stars} ⭐</p>
            <p>Lines: {opponentState.lines_cleared}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ minWidth: '200px' }}>
        <h3>Controls</h3>
        <div
          style={{
            backgroundColor: theme.uiBackgroundColor,
            padding: '15px',
            borderRadius: '5px',
            marginTop: '10px',
          }}
        >
          <p>← → Move</p>
          <p>↑ Rotate</p>
          <p>↓ Soft Drop</p>
          <p>SPACE Hard Drop</p>
          <p>P Pause</p>
        </div>

        <button
          onClick={onExit}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '15px',
            fontSize: '16px',
            backgroundColor: theme.colors.Z,
            color: '#ffffff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Leave Game
        </button>

        {!isConnected && (
          <p style={{ marginTop: '20px', color: theme.colors.L }}>Connecting...</p>
        )}
      </div>

      {gameState.isGameOver && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: '40px',
            borderRadius: '10px',
            textAlign: 'center',
            zIndex: 1000,
          }}
        >
          <h2 style={{ fontSize: '3rem', marginBottom: '20px' }}>
            {opponentState?.is_game_over && !gameState.isGameOver ? 'YOU WIN!' : 'GAME OVER'}
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
