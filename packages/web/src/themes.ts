// Theme system for easy art style switching
import type { TetrominoType } from '@tetris-battle/game-core';

export interface Theme {
  name: string;
  colors: Record<TetrominoType, string>;
  backgroundColor: string;
  gridColor: string;
  textColor: string;
  uiBackgroundColor: string;
  renderBlock: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: TetrominoType
  ) => void;
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

const PIECE_GRADIENT_ANGLE: Record<TetrominoType, number> = {
  I: 180,
  O: 135,
  T: 150,
  S: 120,
  Z: 160,
  J: 140,
  L: 125,
};

const PIECE_HIGHLIGHT: Record<TetrominoType, { width: number; height: number }> = {
  I: { width: 0.56, height: 0.52 },
  O: { width: 0.52, height: 0.52 },
  T: { width: 0.58, height: 0.54 },
  S: { width: 0.55, height: 0.5 },
  Z: { width: 0.57, height: 0.52 },
  J: { width: 0.56, height: 0.54 },
  L: { width: 0.54, height: 0.52 },
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

function renderPolishedBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  type: TetrominoType
): void {
  const radius = Math.min(3, size * 0.25);
  const fill = createAngledGradient(ctx, x, y, size, PIECE_GRADIENT_ANGLE[type] ?? 135, color);
  const highlightProfile = PIECE_HIGHLIGHT[type] ?? { width: 0.58, height: 0.58 };

  // Outer soft glow.
  ctx.save();
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.fillStyle = fill;
  ctx.shadowColor = hexToRgba(color, 0.4);
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.restore();

  // Crisp near glow.
  ctx.save();
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.fillStyle = fill;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  // Top-left inner highlight for reflective depth.
  ctx.save();
  roundedRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  const highlight = ctx.createLinearGradient(
    x,
    y,
    x + size * highlightProfile.width,
    y + size * highlightProfile.height
  );
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(x, y, size * highlightProfile.width, size * highlightProfile.height);
  ctx.restore();
}

// Classic Tetris Theme - Simple colored blocks
const classicTheme: Theme = {
  name: 'Classic',
  colors: {
    I: '#00f0f0', // Cyan
    O: '#f0f000', // Yellow
    T: '#a000f0', // Purple
    S: '#00f000', // Green
    Z: '#f00000', // Red
    L: '#f0a000', // Orange
    J: '#0000f0', // Blue
  },
  backgroundColor: 'rgba(5, 5, 20, 0.75)',
  gridColor: 'rgba(255, 255, 255, 0.02)',
  textColor: '#ffffff',
  uiBackgroundColor: '#1a1a1a',
  renderBlock: (ctx, x, y, size, type) => {
    renderPolishedBlock(ctx, x, y, size, classicTheme.colors[type], type);
  },
};

// Retro Pixel Art Theme - 8-bit style with pixel patterns
const retroTheme: Theme = {
  name: 'Retro',
  colors: {
    I: '#00ffff', // Bright cyan
    O: '#ffff00', // Bright yellow
    T: '#ff00ff', // Magenta
    S: '#00ff00', // Bright green
    Z: '#ff0000', // Bright red
    L: '#ff8800', // Orange
    J: '#0088ff', // Bright blue
  },
  backgroundColor: 'rgba(5, 5, 20, 0.75)', // Dark blue-black
  gridColor: 'rgba(255, 255, 255, 0.02)',
  textColor: '#00ffff',
  uiBackgroundColor: '#1a1a3a',
  renderBlock: (ctx, x, y, size, type) => {
    renderPolishedBlock(ctx, x, y, size, retroTheme.colors[type], type);
  },
};

// Glassmorphic Theme - Modern frosted glass with glowing effects
const glassTheme: Theme = {
  name: 'Glass',
  colors: {
    I: '#00f0f0', // Cyan
    O: '#f0f000', // Yellow
    T: '#a000f0', // Purple
    S: '#00f000', // Green
    Z: '#f00000', // Red
    L: '#f0a000', // Orange
    J: '#0000f0', // Blue
  },
  backgroundColor: 'rgba(5, 5, 20, 0.75)',
  gridColor: 'rgba(255, 255, 255, 0.02)',
  textColor: '#ffffff',
  uiBackgroundColor: 'rgba(10, 10, 25, 0.8)',
  renderBlock: (ctx, x, y, size, type) => {
    renderPolishedBlock(ctx, x, y, size, glassTheme.colors[type], type);
  },
};

export const THEMES: Theme[] = [classicTheme, retroTheme, glassTheme];

// Default theme - using glassy theme now
export const DEFAULT_THEME = glassTheme;

export function getThemeByName(name: string): Theme {
  return THEMES.find(t => t.name === name) || DEFAULT_THEME;
}
