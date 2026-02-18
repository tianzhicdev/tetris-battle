import { useEffect, useRef } from 'react';
import { TETROMINO_SHAPES } from '@tetris-battle/game-core';
import { useTheme } from '../contexts/ThemeContext';

// Canonical (rotation-0) shape for each piece type
type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';

const CELL = 10;        // px per mini-cell
const SLOT = 48;        // px height per piece slot
const PANEL_W = 46;     // canvas width
const GAP = 4;          // px gap between slots
const LABEL_H = 18;     // px for "NEXT" label

interface Props {
  nextPieces: string[];  // up to 5 TetrominoType strings
}

export function NextPiecePanel({ nextPieces }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  const canvasH = LABEL_H + nextPieces.length * (SLOT + GAP);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PANEL_W, canvasH);

    // "NEXT" label
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `bold ${LABEL_H - 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', PANEL_W / 2, LABEL_H - 5);

    nextPieces.forEach((typeStr, slotIndex) => {
      const type = typeStr as TetrominoType;
      const shape = TETROMINO_SHAPES[type]?.[0];
      if (!shape) return;

      const rows = shape.length;
      const cols = shape[0].length;

      // Center the piece in the slot
      const pieceW = cols * CELL;
      const pieceH = rows * CELL;
      const offsetX = Math.floor((PANEL_W - pieceW) / 2);
      const slotY = LABEL_H + slotIndex * (SLOT + GAP);
      const offsetY = slotY + Math.floor((SLOT - pieceH) / 2);

      // Slot background
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.roundRect(2, slotY, PANEL_W - 4, SLOT, 4);
      ctx.fill();

      // Get piece color from theme, fall back to tetrominos.ts default
      const color = (theme.colors?.pieces as Record<string, string>)?.[type] ?? '#ffffff';

      // Draw each cell
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!shape[r][c]) continue;
          const x = offsetX + c * CELL;
          const y = offsetY + r * CELL;

          // Fill
          ctx.fillStyle = color + '33';
          ctx.strokeStyle = color + 'cc';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1, 2);
          ctx.fill();
          ctx.stroke();

          // Top-left highlight
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x + 1, y + 1, CELL * 0.4, 2);
          ctx.fillRect(x + 1, y + 1, 2, CELL * 0.4);
        }
      }
    });
  }, [nextPieces, theme, canvasH]);

  return (
    <canvas
      ref={canvasRef}
      width={PANEL_W}
      height={canvasH}
      style={{
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
