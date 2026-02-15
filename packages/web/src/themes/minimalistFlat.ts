/**
 * Minimalist Flat Theme
 * Modern, clean, focused design
 */

import type { Theme } from './types';

export const minimalistFlatTheme: Theme = {
  id: 'minimalist-flat',
  name: 'Minimalist Flat',
  description: 'Modern, clean, focused',
  category: 'modern',

  colors: {
    pieces: {
      I: '#95a5a6', // Gray
      O: '#ecf0f1', // Light gray
      T: '#bdc3c7', // Medium gray
      S: '#7f8c8d', // Dark gray
      Z: '#2c3e50', // Charcoal
      L: '#34495e', // Slate
      J: '#2980b9', // Subtle blue accent
    },
    background: '#ffffff',
    boardBackground: '#f8f9fa',
    gridLines: '#dee2e6',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    accent: '#2980b9',
    particleColor: '#95a5a6',
  },

  typography: {
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '0.9rem',
      button: '1rem',
    },
    fontWeight: {
      normal: 300,
      bold: 500,
    },
  },

  blocks: {
    style: 'flat',
    borderRadius: '0px',
    borderWidth: '0px',
    borderStyle: 'none',
    shadow: 'none',
  },

  board: {
    background: '#f8f9fa',
    gridLineWidth: '1px',
    gridLineColor: '#dee2e6',
    gridLineStyle: 'solid',
    padding: '20px',
    borderRadius: '0px',
    shadow: 'none',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0.15s',
    transitionEasing: 'ease',
  },

  sounds: {
    move: '/sounds/minimal/soft-click.mp3',
    rotate: '/sounds/minimal/tap.mp3',
    drop: '/sounds/minimal/drop.mp3',
    lineClear: '/sounds/minimal/clear.mp3',
    gameOver: '/sounds/minimal/end.mp3',
    abilityActivate: '/sounds/minimal/activate.mp3',
    volumeMultiplier: 0.7, // Quieter
  },

  animations: {
    blockLanding: '0.1s',
    lineClear: '0.3s',
    gameOver: '0.4s',
    blockFallEasing: 'ease',
    lineClearEffect: 'fade',
  },

  particles: {
    shape: 'circle',
    size: { min: 2, max: 4 },
    color: '#95a5a6',
    lifetime: 600,
    gravity: 0.4,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = minimalistFlatTheme.colors.pieces[type];

    // Simple flat rectangle, no gradients
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  },

  cssVars: {
    '--theme-bg': '#ffffff',
    '--theme-text': '#2c3e50',
    '--theme-accent': '#2980b9',
    '--theme-board-bg': '#f8f9fa',
    '--theme-grid': '#dee2e6',
  },
};
