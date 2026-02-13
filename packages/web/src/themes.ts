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
  backgroundColor: '#0a0a1a',
  gridColor: '#1a1a3a',
  textColor: '#ffffff',
  uiBackgroundColor: 'rgba(10, 10, 25, 0.8)',
  renderBlock: (ctx, x, y, size, type) => {
    const color = glassTheme.colors[type];

    // Parse color to RGB for calculations
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Translucent base color
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.fillRect(x, y, size, size);

    // Inner glow gradient
    const innerGlow = ctx.createRadialGradient(
      x + size / 2, y + size / 2, 0,
      x + size / 2, y + size / 2, size / 2
    );
    innerGlow.addColorStop(0, `rgba(255, 255, 255, 0.4)`);
    innerGlow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.2)`);
    innerGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = innerGlow;
    ctx.fillRect(x, y, size, size);

    // Highlight on top-left (glass reflection)
    const highlight = ctx.createLinearGradient(x, y, x + size * 0.6, y + size * 0.6);
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(x, y, size * 0.5, size * 0.5);

    // Outer border with glow
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

    // Inner bright edge
    ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

    // Shadow/depth effect on bottom-right
    const shadow = ctx.createLinearGradient(
      x + size, y + size, x + size * 0.4, y + size * 0.4
    );
    shadow.addColorStop(0, `rgba(0, 0, 0, 0.4)`);
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(x + size * 0.5, y + size * 0.5, size * 0.5, size * 0.5);
  },
};

export const THEMES: Theme[] = [classicTheme, retroTheme, glassTheme];

// Default theme - using glassy theme now
export const DEFAULT_THEME = glassTheme;

export function getThemeByName(name: string): Theme {
  return THEMES.find(t => t.name === name) || DEFAULT_THEME;
}
