/**
 * Glassmorphism Theme
 * Modern iOS premium feel with frosted glass effects
 */

import type { Theme } from './types';

const PIECE_GRADIENT_ANGLE: Record<string, number> = {
  I: 180,
  O: 135,
  T: 150,
  S: 120,
  Z: 160,
  J: 140,
  L: 130,
};

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
  gradient.addColorStop(0, hexToRgba(color, 0.867)); // dd in hex = 221/255 ≈ 0.867
  gradient.addColorStop(1, hexToRgba(color, 0.4));   // 66 in hex = 102/255 ≈ 0.4
  return gradient;
}

export const glassmorphismTheme: Theme = {
  id: 'glassmorphism',
  name: 'Glassmorphism',
  description: 'Modern iOS premium feel with frosted glass',
  category: 'modern',

  colors: {
    pieces: {
      I: '#00f0f0', // Cyan
      O: '#f0f000', // Yellow
      T: '#a000f0', // Purple
      S: '#00f000', // Green
      Z: '#f00000', // Red
      L: '#f0a000', // Orange
      J: '#0000f0', // Blue
    },
    background: 'rgba(5, 5, 22, 0.78)',
    boardBackground: 'rgba(5, 5, 22, 0.78)',
    gridLines: 'rgba(255, 255, 255, 0.018)',
    text: '#ffffff',
    textSecondary: '#aaaaaa',
    accent: '#00f0f0',
    particleColor: '#00f0f0',
    glowColor: '#00f0f0',
  },

  typography: {
    fontFamily: '"Orbitron", system-ui, -apple-system, "SF Pro Display", sans-serif',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '1rem',
      button: '1.2rem',
    },
    fontWeight: {
      normal: 400,
      bold: 600,
    },
  },

  blocks: {
    style: 'glass',
    borderRadius: '3px',
    borderWidth: '2px',
    borderStyle: 'solid',
    shadow: '0 4px 8px rgba(0,0,0,0.3)',
    backdrop: 'blur(10px)',
  },

  board: {
    background: 'rgba(5, 5, 20, 0.75)',
    gridLineWidth: '1px',
    gridLineColor: '#ffffff05',
    gridLineStyle: 'solid',
    padding: '10px',
    borderRadius: '12px',
    shadow: '0 8px 32px rgba(0,0,0,0.4)',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0.3s',
    transitionEasing: 'ease-out',
  },

  sounds: {
    move: '/sounds/glass/move.mp3',
    rotate: '/sounds/glass/rotate.mp3',
    drop: '/sounds/glass/drop.mp3',
    lineClear: '/sounds/glass/clear.mp3',
    gameOver: '/sounds/glass/gameover.mp3',
    abilityActivate: '/sounds/glass/ability.mp3',
    volumeMultiplier: 1.0,
  },

  animations: {
    blockLanding: '0.2s',
    lineClear: '0.4s',
    gameOver: '0.6s',
    blockFallEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    lineClearEffect: 'fade',
  },

  particles: {
    shape: 'circle',
    size: { min: 2, max: 6 },
    color: '#00f0f0',
    lifetime: 1000,
    gravity: 0.5,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = glassmorphismTheme.colors.pieces[type];
    const radius = Math.min(3, size * 0.25);
    const gradient = createAngledGradient(
      ctx,
      x,
      y,
      size,
      PIECE_GRADIENT_ANGLE[type] ?? 135,
      color
    );

    ctx.save();
    roundedRectPath(ctx, x, y, size, size, radius);
    ctx.fillStyle = gradient;
    ctx.shadowColor = hexToRgba(color, 0.4);
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRectPath(ctx, x, y, size, size, radius);
    ctx.fillStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    // Top-left highlight (3D effect)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x + 2, y + 2, size * 0.4, size * 0.35);
    ctx.restore();

    // Bottom-right shadow (3D effect)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(x + size - (size * 0.5) - 1, y + size - (size * 0.4) - 1, size * 0.5, size * 0.4);
    ctx.restore();
  },

  cssVars: {
    '--theme-bg': 'rgba(5, 5, 20, 0.75)',
    '--theme-text': '#ffffff',
    '--theme-accent': '#00f0f0',
    '--theme-board-bg': 'rgba(5, 5, 20, 0.75)',
    '--theme-grid': '#ffffff05',
  },
};
