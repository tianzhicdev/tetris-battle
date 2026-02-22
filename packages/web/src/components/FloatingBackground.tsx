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
  size: number;
  duration: number;
  delay: number;
  rotation: number;
  rotationDelta: number;
  startX: string;
  startY: string;
  endX: string;
  endY: string;
  opacity: number;
};

const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
const TRAJECTORY_POINTS = [8, 14, 20, 26, 32, 38, 44, 56, 62, 68, 74, 80, 86, 92] as const;

type PieceTrajectory = {
  startX: string;
  startY: string;
  endX: string;
  endY: string;
};

function createTrajectory(laneIndex: number, variant: 'primary' | 'secondary'): PieceTrajectory {
  const side = (laneIndex + (variant === 'secondary' ? 1 : 0)) % 4;
  const point = TRAJECTORY_POINTS[(laneIndex * 2 + (variant === 'secondary' ? 3 : 0)) % TRAJECTORY_POINTS.length];
  const axisOffset = point - 50;
  const sway = (laneIndex % 2 === 0 ? 1 : -1) * (7 + (laneIndex % 4) * 3);

  switch (side) {
    case 0: // top -> bottom
      return {
        startX: `${axisOffset}vw`,
        startY: '-72vh',
        endX: `${axisOffset + sway}vw`,
        endY: '72vh',
      };
    case 1: // right -> left
      return {
        startX: '72vw',
        startY: `${axisOffset}vh`,
        endX: '-72vw',
        endY: `${axisOffset + sway}vh`,
      };
    case 2: // bottom -> top
      return {
        startX: `${axisOffset}vw`,
        startY: '72vh',
        endX: `${axisOffset - sway}vw`,
        endY: '-72vh',
      };
    default: // left -> right
      return {
        startX: '-72vw',
        startY: `${axisOffset}vh`,
        endX: '72vw',
        endY: `${axisOffset - sway}vh`,
      };
  }
}

const FLOATING_PIECES: FloatingPieceConfig[] = TRAJECTORY_POINTS.flatMap((_, laneIndex) => {
  const primaryDuration = 6.2 + (laneIndex % 4) * 0.7;
  const secondaryDuration = 6.8 + ((laneIndex + 2) % 4) * 0.75;
  const phase = laneIndex * 0.38;

  return [
    {
      type: PIECE_TYPES[laneIndex % PIECE_TYPES.length],
      size: 13 + (laneIndex % 5) * 2,
      duration: primaryDuration,
      delay: -phase,
      rotation: -24 + (laneIndex % 7) * 8,
      rotationDelta: 28 + (laneIndex % 4) * 6,
      opacity: 0.82 + (laneIndex % 3) * 0.05,
      ...createTrajectory(laneIndex, 'primary'),
    },
    {
      type: PIECE_TYPES[(laneIndex + 3) % PIECE_TYPES.length],
      size: 12 + ((laneIndex + 2) % 5) * 2,
      duration: secondaryDuration,
      delay: -(phase + primaryDuration / 2),
      rotation: 18 - (laneIndex % 6) * 7,
      rotationDelta: 24 + ((laneIndex + 1) % 4) * 7,
      opacity: 0.78 + ((laneIndex + 1) % 3) * 0.05,
      ...createTrajectory(laneIndex, 'secondary'),
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
            transform: translate3d(var(--start-x), var(--start-y), 0) rotate(var(--start-rotation));
            opacity: 0;
          }
          2% {
            opacity: var(--piece-opacity);
          }
          98% {
            opacity: var(--piece-opacity);
          }
          100% {
            transform: translate3d(var(--end-x), var(--end-y), 0) rotate(calc(var(--start-rotation) + var(--rotation-delta)));
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-tetrimino { animation-duration: 14s !important; opacity: 0.5 !important; }
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
              left: '50%',
              top: '50%',
              // @ts-ignore - CSS custom property
              '--start-rotation': `${piece.rotation}deg`,
              // @ts-ignore - CSS custom property
              '--rotation-delta': `${piece.rotationDelta}deg`,
              // @ts-ignore - CSS custom property
              '--start-x': piece.startX,
              // @ts-ignore - CSS custom property
              '--start-y': piece.startY,
              // @ts-ignore - CSS custom property
              '--end-x': piece.endX,
              // @ts-ignore - CSS custom property
              '--end-y': piece.endY,
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
