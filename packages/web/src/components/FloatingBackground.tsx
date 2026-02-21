import { useMemo } from 'react';

// Tetrimino shapes as grid patterns (1 = filled cell)
const TETRIMINO_SHAPES: Record<string, { shape: number[][]; color: string }> = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: 'rgba(0, 212, 255, 0.34)', // cyan
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 'rgba(255, 215, 0, 0.34)', // yellow
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: 'rgba(201, 66, 255, 0.34)', // purple
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: 'rgba(0, 255, 136, 0.34)', // green
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: 'rgba(255, 0, 110, 0.34)', // red/pink
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: 'rgba(0, 100, 255, 0.34)', // blue
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: 'rgba(255, 165, 0, 0.34)', // orange
  },
};

type FloatingPieceConfig = {
  type: keyof typeof TETRIMINO_SHAPES;
  x: string;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
  driftX: number;
  opacity: number;
};

const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
const LANE_X = ['4%', '10%', '16%', '22%', '29%', '36%', '43%', '50%', '57%', '64%', '71%', '78%', '85%', '92%'] as const;

const FLOATING_PIECES: FloatingPieceConfig[] = LANE_X.flatMap((x, laneIndex) => {
  const primaryDuration = 2.8 + (laneIndex % 4) * 0.45; // 2.8-4.15s (FLY!)
  const secondaryDuration = 3.1 + ((laneIndex + 2) % 4) * 0.45; // 3.1-4.45s
  const phase = laneIndex * 0.24;
  const primaryDrift = (laneIndex % 2 === 0 ? 1 : -1) * (24 + (laneIndex % 4) * 7);
  const secondaryDrift = -primaryDrift * 0.9;

  return [
    {
      type: PIECE_TYPES[laneIndex % PIECE_TYPES.length],
      x,
      size: 13 + (laneIndex % 5) * 2,
      duration: primaryDuration,
      delay: -phase,
      rotation: -24 + (laneIndex % 7) * 8,
      driftX: primaryDrift,
      opacity: 0.82 + (laneIndex % 3) * 0.05,
    },
    {
      type: PIECE_TYPES[(laneIndex + 3) % PIECE_TYPES.length],
      x,
      size: 12 + ((laneIndex + 2) % 5) * 2,
      duration: secondaryDuration,
      delay: -(phase + primaryDuration / 2),
      rotation: 18 - (laneIndex % 6) * 7,
      driftX: secondaryDrift,
      opacity: 0.78 + ((laneIndex + 1) % 3) * 0.05,
    },
  ];
});

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
        @keyframes ${keyframesId}-fall {
          0% {
            transform: translate3d(0, -150vh, 0) rotate(var(--start-rotation));
            opacity: 0;
          }
          2% {
            opacity: var(--piece-opacity);
          }
          98% {
            opacity: var(--piece-opacity);
          }
          100% {
            transform: translate3d(var(--drift-x), 150vh, 0) rotate(calc(var(--start-rotation) + 34deg));
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-tetrimino { animation: none !important; opacity: 0.6 !important; }
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
              top: '-16vh',
              // @ts-ignore - CSS custom property
              '--start-rotation': `${piece.rotation}deg`,
              // @ts-ignore - CSS custom property
              '--drift-x': `${piece.driftX}px`,
              // @ts-ignore - CSS custom property
              '--piece-opacity': `${piece.opacity}`,
              animation: `${keyframesId}-fall ${piece.duration}s linear infinite`,
              animationDelay: `${piece.delay}s`,
              willChange: 'transform, opacity',
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
