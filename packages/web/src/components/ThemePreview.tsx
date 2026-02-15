/**
 * Theme Preview Component
 * Renders a mini Tetris board showing theme appearance
 */

import { useEffect, useRef } from 'react';
import type { Theme } from '../themes/types';
import type { TetrominoType } from '@tetris-battle/game-core';

interface ThemePreviewProps {
  theme: Theme;
}

// Sample 5x5 mini board for preview
const PREVIEW_PATTERN: (TetrominoType | null)[][] = [
  [null, 'I', 'I', 'I', 'I'],
  [null, null, 'O', 'O', null],
  ['T', 'T', 'T', null, null],
  [null, 'T', null, 'S', 'S'],
  ['Z', 'Z', null, null, 'S'],
];

export function ThemePreview({ theme }: ThemePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const blockSize = 15;
    const width = 5 * blockSize;
    const height = 5 * blockSize;

    // Clear
    ctx.fillStyle = theme.colors.boardBackground;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = theme.colors.gridLines;
    ctx.lineWidth = 1;
    for (let x = 0; x <= 5; x++) {
      ctx.beginPath();
      ctx.moveTo(x * blockSize, 0);
      ctx.lineTo(x * blockSize, height);
      ctx.stroke();
    }
    for (let y = 0; y <= 5; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * blockSize);
      ctx.lineTo(width, y * blockSize);
      ctx.stroke();
    }

    // Draw blocks
    PREVIEW_PATTERN.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          theme.renderBlock(ctx, x * blockSize, y * blockSize, blockSize, cell);
        }
      });
    });
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      width={75}
      height={75}
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: '8px',
        backgroundColor: theme.colors.boardBackground,
      }}
    />
  );
}
