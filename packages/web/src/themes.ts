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
  backgroundColor: '#000000',
  gridColor: '#1a1a1a',
  textColor: '#ffffff',
  uiBackgroundColor: '#1a1a1a',
  renderBlock: (ctx, x, y, size, type) => {
    const color = classicTheme.colors[type];
    // Solid block with border
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

    // Shine effect
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);
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
  backgroundColor: '#0a0a1a', // Dark blue-black
  gridColor: '#1a1a3a',
  textColor: '#00ffff',
  uiBackgroundColor: '#1a1a3a',
  renderBlock: (ctx, x, y, size, type) => {
    const color = retroTheme.colors[type];
    const pixelSize = Math.max(2, Math.floor(size / 8));

    // Base color
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // Pixel pattern overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let py = 0; py < size; py += pixelSize * 2) {
      for (let px = 0; px < size; px += pixelSize * 2) {
        if ((px + py) % (pixelSize * 4) === 0) {
          ctx.fillRect(x + px, y + py, pixelSize, pixelSize);
        }
      }
    }

    // Outer border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // Inner highlight (top-left)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = pixelSize;
    ctx.beginPath();
    ctx.moveTo(x + pixelSize, y + size - pixelSize);
    ctx.lineTo(x + pixelSize, y + pixelSize);
    ctx.lineTo(x + size - pixelSize, y + pixelSize);
    ctx.stroke();

    // Inner shadow (bottom-right)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x + size - pixelSize, y + pixelSize);
    ctx.lineTo(x + size - pixelSize, y + size - pixelSize);
    ctx.lineTo(x + pixelSize, y + size - pixelSize);
    ctx.stroke();
  },
};

export const THEMES: Theme[] = [classicTheme, retroTheme];

// Default theme
export const DEFAULT_THEME = retroTheme;

export function getThemeByName(name: string): Theme {
  return THEMES.find(t => t.name === name) || DEFAULT_THEME;
}
