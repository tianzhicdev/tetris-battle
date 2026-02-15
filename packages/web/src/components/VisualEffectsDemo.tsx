import { useEffect, useRef, useState } from 'react';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import type { Board, CellValue } from '@tetris-battle/game-core';
import { DEFAULT_THEME } from '../themes';

/**
 * Visual Effects Demo Page
 * Shows different visual effect options for abilities
 * Categorized by: Bomb Effects and Cell Manipulation Effects
 */

type EffectCategory = 'bomb' | 'cell-manipulation';

interface EffectOption {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  trigger: (renderer: TetrisRenderer, board: Board) => void;
}

export function VisualEffectsDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Create a demo board
  const createDemoBoard = (): Board => {
    const grid: CellValue[][] = Array(20).fill(null).map(() => Array(10).fill(null));

    // Fill some cells for testing
    const colors: CellValue[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (let y = 15; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        if (Math.random() > 0.4) {
          grid[y][x] = colors[Math.floor(Math.random() * colors.length)] as CellValue;
        }
      }
    }

    return { width: 10, height: 20, grid };
  };

  const [board, setBoard] = useState<Board>(createDemoBoard());

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const blockSize = Math.min(
      Math.floor((window.innerHeight - 200) / 20),
      Math.floor((window.innerWidth * 0.4) / 10)
    );

    canvas.width = 10 * blockSize;
    canvas.height = 20 * blockSize;

    rendererRef.current = new TetrisRenderer(canvas, blockSize, DEFAULT_THEME);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Render loop
  useEffect(() => {
    const render = () => {
      if (rendererRef.current) {
        rendererRef.current.render(board, null, null, {
          showGrid: true,
          showGhost: false,
        });
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [board]);

  // Effect Options
  const effectOptions: EffectOption[] = [
    // BOMB EFFECTS
    {
      id: 'bomb-fire-1',
      name: 'Fire Explosion (Option 1)',
      category: 'bomb',
      description: 'Classic fire explosion with expanding rings',
      trigger: (renderer) => {
        const centerX = 5;
        const centerY = 10;
        renderer.animationManager.animateExplosion(centerX, centerY, 3, '#ff6a00');

        // Affected cells burn away
        const affectedCells: { x: number; y: number }[] = [];
        for (let r = 0; r <= 3; r++) {
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const x = Math.round(centerX + Math.cos(angle) * r);
            const y = Math.round(centerY + Math.sin(angle) * r);
            if (x >= 0 && x < 10 && y >= 0 && y < 20) {
              affectedCells.push({ x, y });
            }
          }
        }
        renderer.animationManager.animateBlocksDisappearing(affectedCells, '#ff4400');
      },
    },
    {
      id: 'bomb-fire-2',
      name: 'Fire Explosion (Option 2)',
      category: 'bomb',
      description: 'Intense fire with yellow-orange gradient',
      trigger: (renderer) => {
        const centerX = 5;
        const centerY = 10;
        // Multi-layered explosion
        renderer.animationManager.animateExplosion(centerX, centerY, 2, '#ffff00'); // Yellow core
        setTimeout(() => {
          renderer.animationManager.animateExplosion(centerX, centerY, 3, '#ff6a00'); // Orange ring
        }, 100);

        const affectedCells: { x: number; y: number }[] = [];
        for (let r = 0; r <= 3; r++) {
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const x = Math.round(centerX + Math.cos(angle) * r);
            const y = Math.round(centerY + Math.sin(angle) * r);
            if (x >= 0 && x < 10 && y >= 0 && y < 20) {
              affectedCells.push({ x, y });
            }
          }
        }
        renderer.animationManager.animateBlocksDisappearing(affectedCells, '#ff8800');
      },
    },
    {
      id: 'bomb-fire-3',
      name: 'Fire Explosion (Option 3)',
      category: 'bomb',
      description: 'Fast burning effect with flash',
      trigger: (renderer) => {
        const centerX = 5;
        const centerY = 10;

        const affectedCells: { x: number; y: number }[] = [];
        for (let r = 0; r <= 3; r++) {
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const x = Math.round(centerX + Math.cos(angle) * r);
            const y = Math.round(centerY + Math.sin(angle) * r);
            if (x >= 0 && x < 10 && y >= 0 && y < 20) {
              affectedCells.push({ x, y });
            }
          }
        }

        // Flash first
        renderer.animationManager.animateBlocksFlashing(affectedCells, '#ffffff');

        // Then burn
        setTimeout(() => {
          renderer.animationManager.animateBlocksDisappearing(affectedCells, '#ff3300');
          renderer.animationManager.animateExplosion(centerX, centerY, 3, '#ff6600');
        }, 150);
      },
    },

    // CELL MANIPULATION EFFECTS
    {
      id: 'empty-to-full-1',
      name: 'Empty → Full (Option 1)',
      category: 'cell-manipulation',
      description: 'Fade in with blue glow',
      trigger: (renderer) => {
        const emptyCells: { x: number; y: number }[] = [];
        for (let y = 15; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (!board.grid[y][x]) emptyCells.push({ x, y });
          }
        }
        renderer.animationManager.animateBlocksAppearing(emptyCells.slice(0, 10), '#00d4ff');
      },
    },
    {
      id: 'empty-to-full-2',
      name: 'Empty → Full (Option 2)',
      category: 'cell-manipulation',
      description: 'Flash then fade in with green',
      trigger: (renderer) => {
        const emptyCells: { x: number; y: number }[] = [];
        for (let y = 15; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (!board.grid[y][x]) emptyCells.push({ x, y });
          }
        }
        const cells = emptyCells.slice(0, 10);
        renderer.animationManager.animateBlocksFlashing(cells, '#00ff88');
        setTimeout(() => {
          renderer.animationManager.animateBlocksAppearing(cells, '#00ff88');
        }, 150);
      },
    },
    {
      id: 'empty-to-full-3',
      name: 'Empty → Full (Option 3)',
      category: 'cell-manipulation',
      description: 'Pulse effect with cyan',
      trigger: (renderer) => {
        const emptyCells: { x: number; y: number }[] = [];
        for (let y = 15; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (!board.grid[y][x]) emptyCells.push({ x, y });
          }
        }
        const cells = emptyCells.slice(0, 10);
        // Triple pulse
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            renderer.animationManager.animateBlocksFlashing(cells, '#00ffff');
          }, i * 200);
        }
        setTimeout(() => {
          renderer.animationManager.animateBlocksAppearing(cells, '#00d4ff');
        }, 600);
      },
    },
    {
      id: 'full-to-empty-1',
      name: 'Full → Empty (Option 1)',
      category: 'cell-manipulation',
      description: 'Fade out with red tint',
      trigger: (renderer) => {
        const fullCells: { x: number; y: number }[] = [];
        for (let y = 15; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (board.grid[y][x]) fullCells.push({ x, y });
          }
        }
        renderer.animationManager.animateBlocksDisappearing(fullCells.slice(0, 10), '#ff006e');
      },
    },
    {
      id: 'full-to-empty-2',
      name: 'Full → Empty (Option 2)',
      category: 'cell-manipulation',
      description: 'Flash then dissolve with purple',
      trigger: (renderer) => {
        const fullCells: { x: number; y: number }[] = [];
        for (let y = 15; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (board.grid[y][x]) fullCells.push({ x, y });
          }
        }
        const cells = fullCells.slice(0, 10);
        renderer.animationManager.animateBlocksFlashing(cells, '#c942ff');
        setTimeout(() => {
          renderer.animationManager.animateBlocksDisappearing(cells, '#c942ff');
        }, 150);
      },
    },
    {
      id: 'full-to-empty-3',
      name: 'Full → Empty (Option 3)',
      category: 'cell-manipulation',
      description: 'Shimmer effect with gold',
      trigger: (renderer) => {
        const fullCells: { x: number; y: number }[] = [];
        for (let y = 15; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (board.grid[y][x]) fullCells.push({ x, y });
          }
        }
        const cells = fullCells.slice(0, 10);
        // Shimmer sequence
        for (let i = 0; i < 2; i++) {
          setTimeout(() => {
            renderer.animationManager.animateBlocksFlashing(cells, '#ffd700');
          }, i * 150);
        }
        setTimeout(() => {
          renderer.animationManager.animateBlocksDisappearing(cells, '#ffaa00');
        }, 300);
      },
    },
  ];

  const triggerEffect = (option: EffectOption) => {
    if (!rendererRef.current) return;
    setSelectedEffect(option.id);
    option.trigger(rendererRef.current, board);
    setTimeout(() => setSelectedEffect(null), 1000);
  };

  const bombEffects = effectOptions.filter(e => e.category === 'bomb');
  const cellEffects = effectOptions.filter(e => e.category === 'cell-manipulation');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1433 100%)',
      color: '#fff',
      padding: '20px',
      fontFamily: 'monospace',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              marginBottom: '10px',
              color: '#00d4ff',
              textShadow: '0 0 20px rgba(0, 212, 255, 0.6)',
            }}>
              Visual Effects Options
            </h1>
            <p style={{ color: '#aaa' }}>
              Click each effect to preview. Select your preferred options.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: 'rgba(201, 66, 255, 0.2)',
              border: '1px solid rgba(201, 66, 255, 0.4)',
              color: '#c942ff',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            ← Back to Game
          </button>
        </div>

        <div style={{
          display: 'flex',
          gap: '30px',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}>
          {/* Game Board */}
          <div style={{
            background: 'rgba(10, 10, 30, 0.8)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(0, 212, 255, 0.3)',
          }}>
            <div style={{
              marginBottom: '15px',
              fontSize: '18px',
              color: '#00d4ff',
              fontWeight: 'bold',
            }}>
              Preview Board
            </div>
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                border: '2px solid rgba(0, 212, 255, 0.5)',
                borderRadius: '8px',
              }}
            />
            <button
              onClick={() => setBoard(createDemoBoard())}
              style={{
                marginTop: '15px',
                width: '100%',
                background: 'rgba(0, 255, 136, 0.2)',
                border: '1px solid rgba(0, 255, 136, 0.4)',
                color: '#00ff88',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '14px',
              }}
            >
              Reset Board
            </button>
          </div>

          {/* Effect Options */}
          <div style={{ flex: 1, minWidth: '400px' }}>
            {/* Bomb Effects */}
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{
                fontSize: '20px',
                marginBottom: '15px',
                color: '#ff6a00',
                textShadow: '0 0 15px rgba(255, 106, 0, 0.6)',
              }}>
                🔥 Bomb Effects
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '10px',
              }}>
                {bombEffects.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => triggerEffect(option)}
                    style={{
                      background: selectedEffect === option.id
                        ? 'rgba(255, 106, 0, 0.3)'
                        : 'rgba(255, 106, 0, 0.1)',
                      border: '1px solid rgba(255, 106, 0, 0.4)',
                      color: '#ff8c42',
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      transform: selectedEffect === option.id ? 'scale(0.98)' : 'scale(1)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {option.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#ffaa77', opacity: 0.8 }}>
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cell Manipulation Effects */}
            <div>
              <h2 style={{
                fontSize: '20px',
                marginBottom: '15px',
                color: '#00d4ff',
                textShadow: '0 0 15px rgba(0, 212, 255, 0.6)',
              }}>
                ✨ Cell Manipulation Effects
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '10px',
              }}>
                {cellEffects.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => triggerEffect(option)}
                    style={{
                      background: selectedEffect === option.id
                        ? 'rgba(0, 212, 255, 0.3)'
                        : 'rgba(0, 212, 255, 0.1)',
                      border: '1px solid rgba(0, 212, 255, 0.4)',
                      color: '#00d4ff',
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      transform: selectedEffect === option.id ? 'scale(0.98)' : 'scale(1)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {option.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8ac8ff', opacity: 0.8 }}>
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
