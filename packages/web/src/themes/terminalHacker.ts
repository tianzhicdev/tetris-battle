/**
 * Terminal Hacker Theme
 * Green-screen retro computing aesthetic
 */

import type { Theme } from './types';

export const terminalHackerTheme: Theme = {
  id: 'terminal-hacker',
  name: 'Terminal Hacker',
  description: 'Green-screen retro computing',
  category: 'retro',

  colors: {
    pieces: {
      I: '#00ff00',
      O: '#00ff00',
      T: '#00ff00',
      S: '#00ff00',
      Z: '#00ff00',
      L: '#00ff00',
      J: '#00ff00',
    },
    background: '#000000',
    boardBackground: '#000000',
    gridLines: '#003300',
    text: '#00ff00',
    textSecondary: '#006600',
    accent: '#00ff00',
    particleColor: '#00ff00',
    glowColor: '#00ff00',
  },

  typography: {
    fontFamily: '"Courier New", "Consolas", monospace',
    fontSize: {
      title: '2.5rem',
      score: '1.8rem',
      label: '0.9rem',
      button: '1rem',
    },
    fontWeight: {
      normal: 400,
      bold: 700,
    },
    textTransform: 'uppercase',
  },

  blocks: {
    style: 'ascii',
    borderRadius: '0px',
    borderWidth: '1px',
    borderStyle: 'solid',
    shadow: '0 0 8px #00ff00',
  },

  board: {
    background: '#000000',
    gridLineWidth: '1px',
    gridLineColor: '#003300',
    gridLineStyle: 'solid',
    padding: '10px',
    borderRadius: '0px',
    shadow: '0 0 20px rgba(0,255,0,0.3)',
    overlay: 'scanlines',
    overlayOpacity: 0.15,
  },

  effects: {
    scanlines: true,
    crtCurve: true,
    transitionDuration: '0.05s',
    transitionEasing: 'steps(2)',
  },

  sounds: {
    move: '/sounds/terminal/key.mp3',
    rotate: '/sounds/terminal/tap.mp3',
    drop: '/sounds/terminal/enter.mp3',
    lineClear: '/sounds/terminal/delete.mp3',
    gameOver: '/sounds/terminal/error.mp3',
    abilityActivate: '/sounds/terminal/exec.mp3',
    volumeMultiplier: 0.9,
  },

  animations: {
    blockLanding: '0.05s',
    lineClear: '0.2s',
    gameOver: '0.4s',
    blockFallEasing: 'steps(4)',
    lineClearEffect: 'dissolve',
  },

  particles: {
    shape: 'square',
    size: { min: 2, max: 6 },
    color: '#00ff00',
    lifetime: 600,
    gravity: 0.2,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = terminalHackerTheme.colors.pieces[type];

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.shadowBlur = 0;

    // ASCII character style
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.fillRect(x, y, size, size);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  },

  cssVars: {
    '--theme-bg': '#000000',
    '--theme-text': '#00ff00',
    '--theme-accent': '#00ff00',
    '--theme-board-bg': '#000000',
    '--theme-grid': '#003300',
  },
};
