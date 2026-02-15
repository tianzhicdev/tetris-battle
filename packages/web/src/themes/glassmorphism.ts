/**
 * Glassmorphism Theme
 * Modern iOS premium feel with frosted glass effects
 */

import type { Theme } from './types';

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
    background: '#0a0a1a',
    boardBackground: '#0a0a1a',
    gridLines: '#1a1a3a',
    text: '#ffffff',
    textSecondary: '#aaaaaa',
    accent: '#00f0f0',
    particleColor: '#00f0f0',
    glowColor: '#00f0f0',
  },

  typography: {
    fontFamily: 'system-ui, -apple-system, "SF Pro Display", sans-serif',
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
    borderRadius: '2px',
    borderWidth: '2px',
    borderStyle: 'solid',
    shadow: '0 4px 8px rgba(0,0,0,0.3)',
    backdrop: 'blur(10px)',
  },

  board: {
    background: 'linear-gradient(135deg, #1a1a3a 0%, #0a0a1a 100%)',
    gridLineWidth: '1px',
    gridLineColor: '#1a1a3a',
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

    // Parse color to RGB for calculations
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Translucent base color
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.fillRect(x, y, size, size);

    // Inner glow gradient
    const innerGlow = ctx.createRadialGradient(
      x + size / 2,
      y + size / 2,
      0,
      x + size / 2,
      y + size / 2,
      size / 2
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
      x + size,
      y + size,
      x + size * 0.4,
      y + size * 0.4
    );
    shadow.addColorStop(0, `rgba(0, 0, 0, 0.4)`);
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(x + size * 0.5, y + size * 0.5, size * 0.5, size * 0.5);
  },

  cssVars: {
    '--theme-bg': '#0a0a1a',
    '--theme-text': '#ffffff',
    '--theme-accent': '#00f0f0',
    '--theme-board-bg': '#0a0a1a',
    '--theme-grid': '#1a1a3a',
  },
};
