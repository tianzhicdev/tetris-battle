import { useEffect, useRef } from 'react';
import { TETROMINO_SHAPES } from '@tetris-battle/game-core';
import { useTheme } from '../contexts/ThemeContext';

// Canonical (rotation-0) shape for each piece type
type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';

const CELL = 10;        // px per mini-cell
const SLOT = 48;        // px height per piece slot
const PANEL_W = 46;     // canvas width
const GAP = 4;          // px gap between slots
const OPACITY_FALLOFF = [0.8, 0.5, 0.3, 0.15, 0.1] as const;

const PIECE_GRADIENT_ANGLE: Record<TetrominoType, number> = {
  I: 180,
  O: 135,
  T: 150,
  S: 120,
  Z: 160,
  J: 140,
  L: 125,
};

function createAngledGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angleDeg: number,
  color: string
): CanvasGradient {
  const radians = (angleDeg * Math.PI) / 180;
  const half = size / 2;
  const cx = x + half;
  const cy = y + half;
  const dx = Math.cos(radians) * half;
  const dy = Math.sin(radians) * half;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  gradient.addColorStop(0, hexToRgba(color, 0.9));
  gradient.addColorStop(1, hexToRgba(color, 0.6));
  return gradient;
}

interface Props {
  nextPieces: string[];  // up to 5 TetrominoType strings
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function NextPiecePanel({ nextPieces }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  const canvasH = nextPieces.length * SLOT + Math.max(0, nextPieces.length - 1) * GAP;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PANEL_W, canvasH);

    nextPieces.forEach((typeStr, slotIndex) => {
      const type = typeStr as TetrominoType;
      const shape = TETROMINO_SHAPES[type]?.[0];
      if (!shape) return;
      const pieceOpacity = OPACITY_FALLOFF[slotIndex] ?? 0.1;
      const gradientAngle = PIECE_GRADIENT_ANGLE[type] ?? 135;

      const rows = shape.length;
      const cols = shape[0].length;

      // Center the piece in the slot
      const pieceW = cols * CELL;
      const pieceH = rows * CELL;
      const offsetX = Math.floor((PANEL_W - pieceW) / 2);
      const slotY = slotIndex * (SLOT + GAP);
      const offsetY = slotY + Math.floor((SLOT - pieceH) / 2);

      // Get piece color from theme, fall back to tetrominos.ts default
      const color = (theme.colors?.pieces as Record<string, string>)?.[type] ?? '#ffffff';

      ctx.save();
      ctx.globalAlpha = pieceOpacity;

      // Draw each cell
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!shape[r][c]) continue;
          const x = offsetX + c * CELL;
          const y = offsetY + r * CELL;
          const size = CELL - 1;
          const radius = Math.min(3, size * 0.25);
          const gradient = createAngledGradient(ctx, x + 0.5, y + 0.5, size, gradientAngle, color);

          ctx.save();
          roundedRectPath(ctx, x + 0.5, y + 0.5, size, size, radius);
          ctx.fillStyle = gradient;
          ctx.shadowColor = hexToRgba(color, 0.4);
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.restore();

          ctx.save();
          roundedRectPath(ctx, x + 0.5, y + 0.5, size, size, radius);
          ctx.fillStyle = gradient;
          ctx.shadowColor = color;
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.restore();

          ctx.save();
          roundedRectPath(ctx, x + 0.5, y + 0.5, size, size, radius);
          ctx.clip();
          const highlight = ctx.createLinearGradient(x + 0.5, y + 0.5, x + 0.5 + size * 0.58, y + 0.5 + size * 0.58);
          highlight.addColorStop(0, 'rgba(255,255,255,0.2)');
          highlight.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = highlight;
          ctx.fillRect(x + 0.5, y + 0.5, size * 0.58, size * 0.58);
          ctx.restore();
        }
      }

      ctx.restore();
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
