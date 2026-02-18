import { useEffect, useRef, useState } from 'react';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { ABILITIES, getAbilityTargeting, isDebuffAbility } from '@tetris-battle/game-core';
import type { Board, Tetromino, CellValue } from '@tetris-battle/game-core';
import { DEFAULT_THEME } from '../themes';
import { audioManager } from '../services/audioManager';

export function AbilityEffectsDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TetrisRenderer | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const animationFrameRef = useRef<number | null>(null);

  // Create a demo board with some filled cells
  const createDemoBoard = (): Board => {
    const grid: CellValue[][] = Array(20).fill(null).map(() => Array(10).fill(null));

    // Add some interesting patterns
    // Bottom rows - scattered blocks
    const colors: CellValue[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (let y = 18; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        if (Math.random() > 0.3) {
          grid[y][x] = colors[Math.floor(Math.random() * colors.length)] as CellValue;
        }
      }
    }

    // Middle section - some holes
    for (let y = 15; y < 18; y++) {
      for (let x = 0; x < 10; x++) {
        if (Math.random() > 0.5) {
          grid[y][x] = colors[Math.floor(Math.random() * colors.length)] as CellValue;
        }
      }
    }

    // Create a few complete rows
    for (let x = 0; x < 10; x++) {
      grid[19][x] = 'I';
      if (x !== 3 && x !== 7) {
        grid[17][x] = 'T';
      }
    }

    return { width: 10, height: 20, grid };
  };

  const [board, setBoard] = useState<Board>(createDemoBoard());
  const [currentPiece, setCurrentPiece] = useState<Tetromino>({
    type: 'T',
    position: { x: 3, y: 2 },
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    rotation: 0,
  });

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
        rendererRef.current.render(board, currentPiece, null, {
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
  }, [board, currentPiece]);

  // Auto-play: move piece down slowly
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setCurrentPiece(prev => {
        const newY = prev.position.y + 1;
        if (newY > 18) {
          // Reset to top with random type
          const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
          const newType = types[Math.floor(Math.random() * types.length)] as any;
          return {
            type: newType,
            position: { x: 3, y: 0 },
            shape: prev.shape,
            rotation: 0,
          };
        }
        return { ...prev, position: { ...prev.position, y: newY } };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [autoPlay]);

  const triggerAbilityEffect = (abilityType: string) => {
    setSelectedAbility(abilityType);
    const ability = Object.values(ABILITIES).find((a: any) => a.type === abilityType);

    if (!ability || !rendererRef.current) return;

    // Play sound effect
    if (isDebuffAbility(ability)) {
      audioManager.playSfx('ability_debuff_activate');
    } else {
      audioManager.playSfx('ability_buff_activate');
    }

    // Trigger visual effect based on ability type
    const renderer = rendererRef.current;

    switch (abilityType) {
      case 'earthquake':
        // Flash blocks and animate shake
        const allCells: { x: number; y: number }[] = [];
        for (let y = 0; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (board.grid[y][x]) allCells.push({ x, y });
          }
        }
        renderer.animationManager.animateBlocksFlashing(allCells, '#ff6a00');
        break;

      case 'circle_bomb':
      case 'cross_firebomb':
        // Show explosion at piece location
        const centerX = currentPiece.position.x + 1;
        const centerY = currentPiece.position.y + 1;

        if (abilityType === 'circle_bomb') {
          // Circle explosion
          const radius = 3;
          const affectedCells: { x: number; y: number }[] = [];
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= radius) {
                const x = centerX + dx;
                const y = centerY + dy;
                if (x >= 0 && x < 10 && y >= 0 && y < 20) {
                  affectedCells.push({ x, y });
                }
              }
            }
          }
          // Flash warning first
          renderer.animationManager.animateBlocksFlashing(affectedCells, '#ffffff');
          // Burning fire effect
          renderer.animationManager.animateBlocksBurning(affectedCells);
          // Explosion at center
          renderer.animationManager.animateExplosion(centerX, centerY, 3, '#ff6a00');
        } else {
          // Cross explosion
          const affectedCells: { x: number; y: number }[] = [];
          for (let dx = -5; dx <= 5; dx++) {
            const x = centerX + dx;
            if (x >= 0 && x < 10) affectedCells.push({ x, y: centerY });
          }
          for (let dy = -5; dy <= 5; dy++) {
            const y = centerY + dy;
            if (y >= 0 && y < 20) affectedCells.push({ x: centerX, y });
          }
          // Flash warning first
          renderer.animationManager.animateBlocksFlashing(affectedCells, '#ffffff');
          // Burning fire effect
          renderer.animationManager.animateBlocksBurning(affectedCells);
          // Explosion at center
          renderer.animationManager.animateExplosion(centerX, centerY, 2, '#ff4400');
        }
        audioManager.playSfx('ability_bomb_explode');
        break;

      case 'death_cross':
        // Clear cross pattern
        const crossCells: { x: number; y: number }[] = [];
        const pieceX = currentPiece.position.x + 1;
        const pieceY = currentPiece.position.y + 1;
        for (let x = 0; x < 10; x++) crossCells.push({ x, y: pieceY });
        for (let y = 0; y < 20; y++) crossCells.push({ x: pieceX, y });
        renderer.animationManager.animateBlocksDisappearing(crossCells, '#ff006e');
        break;

      case 'random_spawner':
        // Flash random blocks
        const randomCells: { x: number; y: number }[] = [];
        for (let i = 0; i < 15; i++) {
          randomCells.push({
            x: Math.floor(Math.random() * 10),
            y: Math.floor(Math.random() * 20)
          });
        }
        renderer.animationManager.animateBlocksFlashing(randomCells, '#00d4ff');
        break;

      case 'fill_holes':
        // Flash empty cells
        const emptyCells: { x: number; y: number }[] = [];
        for (let y = 0; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (!board.grid[y][x]) emptyCells.push({ x, y });
          }
        }
        renderer.animationManager.animateBlocksFlashing(emptyCells.slice(0, 30), '#00ff88');
        break;

      case 'gold_digger':
        // Flash bottom rows
        const bottomCells: { x: number; y: number }[] = [];
        for (let y = 17; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            bottomCells.push({ x, y });
          }
        }
        renderer.animationManager.animateBlocksDisappearing(bottomCells, '#ffd700');
        break;

      default:
        // Generic flash effect for other abilities
        const someCells: { x: number; y: number }[] = [];
        for (let i = 0; i < 20; i++) {
          someCells.push({
            x: Math.floor(Math.random() * 10),
            y: Math.floor(Math.random() * 20)
          });
        }
        renderer.animationManager.animateBlocksFlashing(someCells, '#00d4ff');
        break;
    }

    // Clear selection after effect
    setTimeout(() => setSelectedAbility(null), 1000);
  };

  const resetBoard = () => {
    setBoard(createDemoBoard());
    setCurrentPiece({
      type: 'T',
      position: { x: 3, y: 2 },
      shape: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      rotation: 0,
    });
  };

  const buffs = Object.values(ABILITIES).filter((a: any) => getAbilityTargeting(a) === 'self');
  const debuffs = Object.values(ABILITIES).filter((a: any) => getAbilityTargeting(a) === 'opponent');

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
              Ability Effects Demo
            </h1>
            <p style={{ color: '#aaa' }}>
              Click any ability button to see its visual effect on the game board
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
              display: 'flex',
              gap: '15px',
              marginBottom: '15px',
              alignItems: 'center',
            }}>
              <button
                onClick={resetBoard}
                style={{
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: '#00d4ff' }}>Auto-play piece</span>
              </label>
            </div>
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                border: '2px solid rgba(0, 212, 255, 0.5)',
                borderRadius: '8px',
              }}
            />
          </div>

          {/* Ability Buttons */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            {/* Buffs */}
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{
                fontSize: '20px',
                marginBottom: '15px',
                color: '#00d4ff',
                textShadow: '0 0 15px rgba(0, 212, 255, 0.6)',
              }}>
                Buffs (Help You)
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '10px',
              }}>
                {buffs.map((ability: any) => (
                  <button
                    key={ability.type}
                    onClick={() => triggerAbilityEffect(ability.type)}
                    style={{
                      background: selectedAbility === ability.type
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
                      transform: selectedAbility === ability.type ? 'scale(0.95)' : 'scale(1)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {ability.shortName}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8ac8ff', opacity: 0.8 }}>
                      {ability.description.substring(0, 40)}...
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Debuffs */}
            <div>
              <h2 style={{
                fontSize: '20px',
                marginBottom: '15px',
                color: '#c942ff',
                textShadow: '0 0 15px rgba(201, 66, 255, 0.6)',
              }}>
                Debuffs (Attack Opponent)
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '10px',
              }}>
                {debuffs.map((ability: any) => (
                  <button
                    key={ability.type}
                    onClick={() => triggerAbilityEffect(ability.type)}
                    style={{
                      background: selectedAbility === ability.type
                        ? 'rgba(255, 0, 110, 0.3)'
                        : 'rgba(255, 0, 110, 0.1)',
                      border: '1px solid rgba(255, 0, 110, 0.4)',
                      color: '#ff006e',
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      transform: selectedAbility === ability.type ? 'scale(0.95)' : 'scale(1)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {ability.shortName}
                    </div>
                    <div style={{ fontSize: '10px', color: '#ff8ac8', opacity: 0.8 }}>
                      {ability.description.substring(0, 40)}...
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
