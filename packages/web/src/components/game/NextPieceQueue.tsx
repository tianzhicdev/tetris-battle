import { TETROMINO_SHAPES } from '@tetris-battle/game-core';
import { useTheme } from '../../contexts/ThemeContext';

type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';

interface NextPieceQueueProps {
  nextPieces: string[];
  maxItems?: number;
}

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

export function NextPieceQueue({ nextPieces, maxItems = 5 }: NextPieceQueueProps) {
  const { theme } = useTheme();
  const visiblePieces = nextPieces.slice(0, maxItems);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px 6px',
        borderRadius: '10px',
        background: 'rgba(9, 14, 30, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
        {visiblePieces.map((type, idx) => {
          const piece = type as TetrominoType;
          const matrix = normalizeTo4x4(piece);
          const color = (theme.colors?.pieces as Record<string, string> | undefined)?.[piece] ?? '#00d4ff';
          return (
            <div
              key={`${type}-${idx}`}
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '8px',
                background: 'rgba(3, 6, 16, 0.7)',
                border: '1px solid rgba(0, 212, 255, 0.18)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gridTemplateRows: 'repeat(4, 1fr)',
                gap: '2px',
                padding: '5px',
                boxSizing: 'border-box',
              }}
            >
              {matrix.flatMap((row, r) =>
                row.map((filled, c) => (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      borderRadius: '2px',
                      background: filled ? `${color}aa` : 'rgba(255, 255, 255, 0.03)',
                      border: filled ? `1px solid ${color}` : '1px solid rgba(255, 255, 255, 0.03)',
                    }}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
