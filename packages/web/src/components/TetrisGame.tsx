import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import type { Theme } from '../themes';

interface TetrisGameProps {
  onExit?: () => void;
  currentTheme: Theme;
}

export function TetrisGame({ onExit, currentTheme }: TetrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const gameLoopRef = useRef<number | null>(null);

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
  } = useGameStore();

  // Initialize game
  useEffect(() => {
    initGame();
  }, [initGame]);

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new TetrisRenderer(canvasRef.current, 30, currentTheme);
    }
  }, [currentTheme]);

  // Game loop - pieces fall automatically
  useEffect(() => {
    const TICK_RATE = 1000; // 1 second per tick

    const loop = () => {
      tick();
      gameLoopRef.current = window.setTimeout(loop, TICK_RATE);
    };

    if (!gameState.isGameOver) {
      gameLoopRef.current = window.setTimeout(loop, TICK_RATE);
    }

    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, [tick, gameState.isGameOver]);

  // Render game
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(
        gameState.board,
        gameState.currentPiece,
        ghostPiece,
        {
          showGrid: true,
          showGhost: true,
        }
      );
    }
  }, [gameState.board, gameState.currentPiece, ghostPiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePieceLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePieceRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePieceDown();
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          e.preventDefault();
          rotatePieceClockwise();
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
    <div style={{
      display: 'flex',
      gap: '20px',
      padding: '20px',
      backgroundColor: currentTheme.backgroundColor,
      minHeight: '100vh',
    }}>
      {/* Game Board */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={300}
          height={600}
          style={{
            border: `3px solid ${currentTheme.textColor}`,
            backgroundColor: currentTheme.backgroundColor,
          }}
        />
        {gameState.isGameOver && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: currentTheme.textColor,
              padding: '20px',
              borderRadius: '10px',
              textAlign: 'center',
            }}
          >
            <h2>Game Over!</h2>
            <p>Score: {gameState.score}</p>
            <button
              onClick={initGame}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Play Again
            </button>
          </div>
        )}
        {isPaused && !gameState.isGameOver && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: currentTheme.textColor,
              padding: '20px',
              borderRadius: '10px',
            }}
          >
            <h2>PAUSED</h2>
          </div>
        )}
      </div>

      {/* UI Panel */}
      <div style={{
        color: currentTheme.textColor,
        fontFamily: 'monospace',
        minWidth: '200px',
      }}>
        <h1 style={{ marginTop: 0 }}>Tetris Battle</h1>

        {/* Stats */}
        <div style={{
          backgroundColor: currentTheme.uiBackgroundColor,
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px',
        }}>
          <h3 style={{ marginTop: 0 }}>Stats</h3>
          <p>Score: {gameState.score}</p>
          <p>Stars: {gameState.stars} ⭐</p>
          <p>Lines: {gameState.linesCleared}</p>
          <p>Combo: {gameState.comboCount}x</p>
        </div>

        {/* Back Button */}
        {onExit && (
          <button
            onClick={onExit}
            style={{
              width: '100%',
              padding: '15px',
              marginBottom: '20px',
              fontSize: '16px',
              backgroundColor: currentTheme.colors.Z,
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Back to Menu
          </button>
        )}

        {/* Controls */}
        <div style={{
          backgroundColor: currentTheme.uiBackgroundColor,
          padding: '15px',
          borderRadius: '5px',
        }}>
          <h3 style={{ marginTop: 0 }}>Controls</h3>
          <p>← → Move</p>
          <p>↑ Rotate</p>
          <p>↓ Soft Drop</p>
          <p>SPACE Hard Drop</p>
          <p>P Pause</p>
        </div>

        <p style={{
          marginTop: '20px',
          fontSize: '12px',
          opacity: 0.7
        }}>
          Multiplayer coming soon!
        </p>
      </div>
    </div>
  );
}
