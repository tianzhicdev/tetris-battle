/**
 * Brutalist Theme
 * Raw, unpolished, striking design
 */

import type { Theme } from './types';

export const brutalistTheme: Theme = {
  id: 'brutalist',
  name: 'Brutalist',
  description: 'Raw, unpolished, striking',
  category: 'technical',

  colors: {
    pieces: {
      I: '#000000',
      O: '#ffffff',
      T: '#000000',
      S: '#ffffff',
      Z: '#ff0000', // One harsh accent
      L: '#000000',
      J: '#ffffff',
    },
    background: '#ffffff',
    boardBackground: '#ffffff',
    gridLines: '#000000',
    text: '#000000',
    textSecondary: '#666666',
    accent: '#ff0000',
    particleColor: '#000000',
  },

  typography: {
    fontFamily: '"Courier New", "IBM Plex Mono", monospace',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '1rem',
      button: '1.2rem',
    },
    fontWeight: {
      normal: 700,
      bold: 900,
    },
    textTransform: 'uppercase',
  },

  blocks: {
    style: 'flat',
    borderRadius: '0px',
    borderWidth: '3px',
    borderStyle: 'solid',
    shadow: 'none',
  },

  board: {
    background: '#ffffff',
    gridLineWidth: '2px',
    gridLineColor: '#000000',
    gridLineStyle: 'solid',
    padding: '0px',
    borderRadius: '0px',
    shadow: 'none',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0s', // Instant
    transitionEasing: 'steps(1)',
  },

  sounds: {
    move: '/sounds/brutalist/click.mp3',
    rotate: '/sounds/brutalist/clack.mp3',
    drop: '/sounds/brutalist/thud.mp3',
    lineClear: '/sounds/brutalist/break.mp3',
    gameOver: '/sounds/brutalist/end.mp3',
    abilityActivate: '/sounds/brutalist/activate.mp3',
    volumeMultiplier: 1.3,
  },

  animations: {
    blockLanding: '0s',
    lineClear: '0.2s',
    gameOver: '0.3s',
    blockFallEasing: 'steps(1)',
    lineClearEffect: 'flash',
  },

  particles: {
    shape: 'square',
    size: { min: 6, max: 12 },
    color: '#000000',
    lifetime: 400,
    gravity: 0.8,
    fadeOut: false,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = brutalistTheme.colors.pieces[type];

    // Solid fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // Thick border
    ctx.strokeStyle = color === '#ffffff' ? '#000000' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);
  },

  cssVars: {
    '--theme-bg': '#ffffff',
    '--theme-text': '#000000',
    '--theme-accent': '#ff0000',
    '--theme-board-bg': '#ffffff',
    '--theme-grid': '#000000',
  },
};
