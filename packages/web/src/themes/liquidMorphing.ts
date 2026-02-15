/**
 * Liquid Morphing Theme
 * Soft, blobby, lava lamp vibes
 */

import type { Theme } from './types';

export const liquidMorphingTheme: Theme = {
  id: 'liquid-morphing',
  name: 'Liquid Morphing',
  description: 'Soft, blobby, lava lamp vibes',
  category: 'artistic',

  colors: {
    pieces: {
      I: '#ff6ec7',
      O: '#ffd93d',
      T: '#a78bfa',
      S: '#6ee7b7',
      Z: '#f87171',
      L: '#fb923c',
      J: '#60a5fa',
    },
    background: '#1a103d',
    boardBackground: '#2d1b69',
    gridLines: '#4c3299',
    text: '#f0abfc',
    textSecondary: '#c4b5fd',
    accent: '#ff6ec7',
    particleColor: '#ff6ec7',
    glowColor: '#a78bfa',
  },

  typography: {
    fontFamily: '"Quicksand", "Comfortaa", sans-serif',
    fontSize: {
      title: '3.2rem',
      score: '2.2rem',
      label: '1rem',
      button: '1.2rem',
    },
    fontWeight: {
      normal: 400,
      bold: 600,
    },
  },

  blocks: {
    style: 'glow',
    borderRadius: '12px',
    borderWidth: '0px',
    borderStyle: 'none',
    shadow: '0 0 15px currentColor',
    filter: 'blur(0.5px)',
  },

  board: {
    background: 'radial-gradient(circle, #2d1b69 0%, #1a103d 100%)',
    gridLineWidth: '1px',
    gridLineColor: '#4c3299',
    gridLineStyle: 'solid',
    padding: '20px',
    borderRadius: '24px',
    shadow: '0 8px 32px rgba(255,110,199,0.3), inset 0 0 40px rgba(167,139,250,0.2)',
    overlay: 'none',
  },

  effects: {
    blur: 1,
    bloom: true,
    transitionDuration: '0.5s',
    transitionEasing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bouncy
  },

  sounds: {
    move: '/sounds/liquid/blob-move.mp3',
    rotate: '/sounds/liquid/squish.mp3',
    drop: '/sounds/liquid/splash.mp3',
    lineClear: '/sounds/liquid/pop.mp3',
    gameOver: '/sounds/liquid/drain.mp3',
    abilityActivate: '/sounds/liquid/bubble.mp3',
    volumeMultiplier: 1.0,
  },

  animations: {
    blockLanding: '0.4s',
    lineClear: '0.6s',
    gameOver: '1s',
    blockFallEasing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    lineClearEffect: 'dissolve',
  },

  particles: {
    shape: 'circle',
    size: { min: 4, max: 12 },
    color: ['#ff6ec7', '#ffd93d', '#a78bfa', '#6ee7b7'],
    lifetime: 1500,
    gravity: 0.15,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = liquidMorphingTheme.colors.pieces[type];

    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Soft rounded blob
    const radius = size * 0.4;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    // Gradient fill for depth
    const gradient = ctx.createRadialGradient(
      x + size * 0.4,
      y + size * 0.4,
      0,
      x + size / 2,
      y + size / 2,
      size * 0.6
    );
    gradient.addColorStop(0, `rgba(${r + 40}, ${g + 40}, ${b + 40}, 0.9)`);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, `rgba(${r - 20}, ${g - 20}, ${b - 20}, 0.7)`);

    // Draw rounded blob
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + size, y, x + size, y + size, radius);
    ctx.arcTo(x + size, y + size, x, y + size, radius);
    ctx.arcTo(x, y + size, x, y, radius);
    ctx.arcTo(x, y, x + size, y, radius);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Highlight
    const highlight = ctx.createRadialGradient(
      x + size * 0.3,
      y + size * 0.3,
      0,
      x + size * 0.3,
      y + size * 0.3,
      size * 0.3
    );
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(x + size * 0.3, y + size * 0.3, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  },

  cssVars: {
    '--theme-bg': '#1a103d',
    '--theme-text': '#f0abfc',
    '--theme-accent': '#ff6ec7',
    '--theme-board-bg': '#2d1b69',
    '--theme-grid': '#4c3299',
  },
};
