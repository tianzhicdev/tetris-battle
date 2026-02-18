import { useMemo } from 'react';

// Tetrimino shapes as grid patterns (1 = filled cell)
const TETRIMINO_SHAPES: Record<string, { shape: number[][]; color: string }> = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: 'rgba(0, 212, 255, 0.15)', // cyan
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 'rgba(255, 215, 0, 0.15)', // yellow
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: 'rgba(201, 66, 255, 0.15)', // purple
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: 'rgba(0, 255, 136, 0.15)', // green
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: 'rgba(255, 0, 110, 0.15)', // red/pink
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: 'rgba(0, 100, 255, 0.15)', // blue
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: 'rgba(255, 165, 0, 0.15)', // orange
  },
};

const FLOATING_PIECES = [
  { type: 'I', x: '5%', y: '15%', size: 20, duration: 35, delay: 0, rotation: 15 },
  { type: 'T', x: '85%', y: '25%', size: 24, duration: 40, delay: -8, rotation: -20 },
  { type: 'O', x: '15%', y: '70%', size: 22, duration: 32, delay: -15, rotation: 10 },
  { type: 'S', x: '75%', y: '65%', size: 18, duration: 38, delay: -5, rotation: -15 },
  { type: 'Z', x: '50%', y: '10%', size: 20, duration: 42, delay: -12, rotation: 25 },
  { type: 'J', x: '90%', y: '80%', size: 16, duration: 36, delay: -20, rotation: -30 },
  { type: 'L', x: '25%', y: '45%', size: 18, duration: 34, delay: -3, rotation: 5 },
  { type: 'I', x: '60%', y: '85%', size: 16, duration: 45, delay: -18, rotation: 90 },
  { type: 'T', x: '40%', y: '30%', size: 14, duration: 38, delay: -10, rotation: -45 },
  { type: 'O', x: '70%', y: '5%', size: 20, duration: 30, delay: -7, rotation: 0 },
];

function TetriminoShape({ type, size, color }: { type: string; size: number; color: string }) {
  const { shape } = TETRIMINO_SHAPES[type];
  const gap = Math.max(1, size * 0.1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${gap}px`,
      }}
    >
      {shape.map((row, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', gap: `${gap}px` }}>
          {row.map((cell, colIdx) => (
            <div
              key={colIdx}
              style={{
                width: size,
                height: size,
                backgroundColor: cell ? color : 'transparent',
                borderRadius: size * 0.15,
                boxShadow: cell ? `0 0 ${size}px ${color}, inset 0 0 ${size * 0.3}px rgba(255,255,255,0.1)` : 'none',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FloatingBackground() {
  const keyframesId = useMemo(() => `tetris-float-${Math.random().toString(36).slice(2, 6)}`, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes ${keyframesId}-drift {
          0%, 100% { 
            transform: translate(0, 0) rotate(var(--start-rotation)); 
            opacity: 0.6;
          }
          25% { 
            transform: translate(30px, -50px) rotate(calc(var(--start-rotation) + 15deg)); 
            opacity: 0.8;
          }
          50% { 
            transform: translate(-25px, 30px) rotate(calc(var(--start-rotation) - 10deg)); 
            opacity: 0.5;
          }
          75% { 
            transform: translate(20px, 45px) rotate(calc(var(--start-rotation) + 5deg)); 
            opacity: 0.7;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-tetrimino { animation: none !important; opacity: 0.4 !important; }
        }
      `}</style>
      {FLOATING_PIECES.map((piece, i) => {
        const tetrimino = TETRIMINO_SHAPES[piece.type];
        return (
          <div
            key={i}
            className="floating-tetrimino"
            style={{
              position: 'absolute',
              left: piece.x,
              top: piece.y,
              // @ts-ignore - CSS custom property
              '--start-rotation': `${piece.rotation}deg`,
              animation: `${keyframesId}-drift ${piece.duration}s ease-in-out infinite`,
              animationDelay: `${piece.delay}s`,
              willChange: 'transform, opacity',
              filter: 'blur(1px)',
            } as React.CSSProperties}
          >
            <TetriminoShape
              type={piece.type}
              size={piece.size}
              color={tetrimino.color}
            />
          </div>
        );
      })}
    </div>
  );
}
