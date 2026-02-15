/**
 * Hand-drawn Theme
 * Notebook doodles come to life
 */

import type { Theme } from './types';

export const handDrawnTheme: Theme = {
  id: 'hand-drawn',
  name: 'Hand-drawn',
  description: 'Notebook doodles come to life',
  category: 'artistic',

  colors: {
    pieces: {
      I: '#3498db',
      O: '#f1c40f',
      T: '#9b59b6',
      S: '#2ecc71',
      Z: '#e74c3c',
      L: '#e67e22',
      J: '#1abc9c',
    },
    background: '#ffffff',
    boardBackground: '#fafafa',
    gridLines: '#d0d0d0',
    text: '#2c3e50',
    textSecondary: '#95a5a6',
    accent: '#3498db',
    particleColor: '#3498db',
  },

  typography: {
    fontFamily: '"Permanent Marker", "Indie Flower", cursive',
    fontSize: {
      title: '2.8rem',
      score: '2rem',
      label: '1rem',
      button: '1.2rem',
    },
    fontWeight: {
      normal: 400,
      bold: 400,
    },
  },

  blocks: {
    style: 'sketch',
    borderRadius: '3px',
    borderWidth: '2px',
    borderStyle: 'solid',
    shadow: '2px 2px 0px rgba(0,0,0,0.1)',
  },

  board: {
    background: '#fafafa',
    gridLineWidth: '1px',
    gridLineColor: '#d0d0d0',
    gridLineStyle: 'dashed',
    padding: '15px',
    borderRadius: '4px',
    shadow: '3px 3px 0px rgba(0,0,0,0.1)',
    overlay: 'paper',
    overlayOpacity: 0.05,
  },

  effects: {
    transitionDuration: '0.3s',
    transitionEasing: 'ease-in-out',
  },

  sounds: {
    move: '/sounds/sketch/pencil.mp3',
    rotate: '/sounds/sketch/scribble.mp3',
    drop: '/sounds/sketch/paper.mp3',
    lineClear: '/sounds/sketch/erase.mp3',
    gameOver: '/sounds/sketch/crumple.mp3',
    abilityActivate: '/sounds/sketch/draw.mp3',
    volumeMultiplier: 0.8,
  },

  animations: {
    blockLanding: '0.25s',
    lineClear: '0.4s',
    gameOver: '0.5s',
    blockFallEasing: 'ease-in-out',
    lineClearEffect: 'fade',
  },

  particles: {
    shape: 'circle',
    size: { min: 2, max: 5 },
    color: ['#3498db', '#e74c3c', '#f1c40f'],
    lifetime: 800,
    gravity: 0.3,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = handDrawnTheme.colors.pieces[type];

    // Hand-drawn style with slightly wobbly edges
    ctx.fillStyle = color;

    // Draw with slight imperfection
    ctx.beginPath();
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + size - 1, y + 1);
    ctx.lineTo(x + size, y + size - 1);
    ctx.lineTo(x + 1, y + size);
    ctx.closePath();
    ctx.fill();

    // Sketchy border
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add texture
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 3; i++) {
      const tx = x + Math.random() * size;
      const ty = y + Math.random() * size;
      ctx.fillRect(tx, ty, 2, 2);
    }
  },

  cssVars: {
    '--theme-bg': '#ffffff',
    '--theme-text': '#2c3e50',
    '--theme-accent': '#3498db',
    '--theme-board-bg': '#fafafa',
    '--theme-grid': '#d0d0d0',
  },
};
