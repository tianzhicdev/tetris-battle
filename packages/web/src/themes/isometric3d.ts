/**
 * Isometric 3D Theme
 * Faux-3D depth without full rendering
 */

import type { Theme } from './types';

export const isometric3dTheme: Theme = {
  id: 'isometric-3d',
  name: 'Isometric 3D',
  description: 'Faux-3D depth without full rendering',
  category: 'technical',

  colors: {
    pieces: {
      I: '#4fc3f7',
      O: '#fff176',
      T: '#ba68c8',
      S: '#81c784',
      Z: '#e57373',
      L: '#ffb74d',
      J: '#64b5f6',
    },
    background: '#37474f',
    boardBackground: '#455a64',
    gridLines: '#546e7a',
    text: '#eceff1',
    textSecondary: '#b0bec5',
    accent: '#4fc3f7',
    particleColor: '#4fc3f7',
  },

  typography: {
    fontFamily: '"Roboto", sans-serif',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '1rem',
      button: '1.1rem',
    },
    fontWeight: {
      normal: 400,
      bold: 700,
    },
  },

  blocks: {
    style: 'isometric',
    borderRadius: '2px',
    borderWidth: '1px',
    borderStyle: 'solid',
    shadow: '2px 2px 4px rgba(0,0,0,0.3)',
  },

  board: {
    background: 'linear-gradient(135deg, #455a64 0%, #37474f 100%)',
    gridLineWidth: '1px',
    gridLineColor: '#546e7a',
    gridLineStyle: 'solid',
    padding: '15px',
    borderRadius: '8px',
    shadow: '0 8px 16px rgba(0,0,0,0.4)',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0.25s',
    transitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  sounds: {
    move: '/sounds/iso/move.mp3',
    rotate: '/sounds/iso/rotate.mp3',
    drop: '/sounds/iso/drop.mp3',
    lineClear: '/sounds/iso/clear.mp3',
    gameOver: '/sounds/iso/gameover.mp3',
    abilityActivate: '/sounds/iso/ability.mp3',
    volumeMultiplier: 1.0,
  },

  animations: {
    blockLanding: '0.2s',
    lineClear: '0.35s',
    gameOver: '0.6s',
    blockFallEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    lineClearEffect: 'slide',
  },

  particles: {
    shape: 'square',
    size: { min: 3, max: 7 },
    color: '#4fc3f7',
    lifetime: 900,
    gravity: 0.6,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = isometric3dTheme.colors.pieces[type];

    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Top face (lighter)
    ctx.fillStyle = `rgb(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)})`;
    ctx.fillRect(x, y, size, size * 0.3);

    // Front face (normal)
    ctx.fillStyle = color;
    ctx.fillRect(x, y + size * 0.3, size * 0.7, size * 0.7);

    // Right face (darker)
    ctx.fillStyle = `rgb(${Math.max(r - 40, 0)}, ${Math.max(g - 40, 0)}, ${Math.max(b - 40, 0)})`;
    ctx.fillRect(x + size * 0.7, y + size * 0.3, size * 0.3, size * 0.7);

    // Borders for depth
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  },

  cssVars: {
    '--theme-bg': '#37474f',
    '--theme-text': '#eceff1',
    '--theme-accent': '#4fc3f7',
    '--theme-board-bg': '#455a64',
    '--theme-grid': '#546e7a',
  },
};
