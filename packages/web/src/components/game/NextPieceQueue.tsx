import { TETROMINO_SHAPES } from '@tetris-battle/game-core';

type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';

interface NextPieceQueueProps {
  nextPieces: string[];
  maxItems?: number;
}

const PIECE_GRADIENT_ANGLE: Record<string, number> = {
  I: 180,
  O: 135,
  T: 150,
  S: 120,
  Z: 160,
  J: 140,
  L: 130,
};

const PIECE_COLORS: Record<string, string> = {
  I: '#00f0f0', // Cyan
  O: '#f0f000', // Yellow
  T: '#a000f0', // Purple
  S: '#00f000', // Green
  Z: '#f00000', // Red
  L: '#f0a000', // Orange
  J: '#0000f0', // Blue
};

function normalizeTo4x4(type: TetrominoType): number[][] {
  const shape = TETROMINO_SHAPES[type]?.[0] ?? [[0, 0, 0, 0]];
  const rows = shape.length;
  const cols = shape[0]?.length ?? 0;
  const matrix = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
  const rowOffset = Math.floor((4 - rows) / 2);
  const colOffset = Math.floor((4 - cols) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      matrix[r + rowOffset][c + colOffset] = shape[r][c] ? 1 : 0;
    }
  }

  return matrix;
}

export function NextPieceQueue({ nextPieces, maxItems = 3 }: NextPieceQueueProps) {
  const visiblePieces = nextPieces.slice(0, maxItems);
  const opacities = [0.85, 0.45, 0.2];
  const scales = [1, 0.85, 0.7];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        paddingTop: '8px',
      }}
    >
      {/* NEXT label - tiny and dim */}
      <div style={{ fontSize: '7px', color: '#ffffff16', letterSpacing: '3px', marginBottom: '4px' }}>
        NEXT
      </div>

      {/* Piece stack - no containers, just fading pieces */}
      {visiblePieces.map((type, idx) => {
        const piece = type as TetrominoType;
        const matrix = normalizeTo4x4(piece);
        const color = PIECE_COLORS[piece] || '#00d4ff';
        const gradAngle = PIECE_GRADIENT_ANGLE[piece] || 135;
        const opacity = opacities[idx] || 0.2;
        const scale = scales[idx] || 0.7;

        return (
          <div
            key={`${type}-${idx}`}
            style={{
              opacity,
              transform: `scale(${scale})`,
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Mini piece grid - 12px cells with gradients */}
            <div style={{ position: 'relative', width: '48px', height: '48px' }}>
              {matrix.flatMap((row, r) =>
                row.map((filled, c) => {
                  if (!filled) return null;
                  const cellSize = 12;
                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        position: 'absolute',
                        left: c * cellSize - (4 * cellSize) / 2 + 24,
                        top: r * cellSize - (4 * cellSize) / 2 + 24,
                        width: cellSize - 1,
                        height: cellSize - 1,
                        borderRadius: '2px',
                        background: `linear-gradient(${gradAngle}deg, ${color}cc, ${color}66)`,
                        boxShadow: `0 0 4px ${color}44`,
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
