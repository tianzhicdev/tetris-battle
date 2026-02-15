/**
 * Nature Organic Theme
 * Natural materials and seasons
 */

import type { Theme } from './types';

export const natureOrganicTheme: Theme = {
  id: 'nature-organic',
  name: 'Nature Organic',
  description: 'Natural materials and seasons',
  category: 'artistic',

  colors: {
    pieces: {
      I: '#5dade2',
      O: '#f9e79f',
      T: '#bb8fce',
      S: '#82e0aa',
      Z: '#ec7063',
      L: '#f0b27a',
      J: '#85c1e9',
    },
    background: '#f5f5dc',
    boardBackground: '#f0e68c',
    gridLines: '#d2b48c',
    text: '#4a4a4a',
    textSecondary: '#8b7355',
    accent: '#82e0aa',
    particleColor: '#82e0aa',
  },

  typography: {
    fontFamily: '"Lora", "Merriweather", serif',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '1rem',
      button: '1.1rem',
    },
    fontWeight: {
      normal: 400,
      bold: 600,
    },
  },

  blocks: {
    style: 'textured',
    borderRadius: '4px',
    borderWidth: '1px',
    borderStyle: 'solid',
    shadow: '1px 1px 3px rgba(0,0,0,0.2)',
    texture: '/textures/wood-grain.png',
  },

  board: {
    background: 'linear-gradient(135deg, #f0e68c 0%, #f5f5dc 100%)',
    gridLineWidth: '1px',
    gridLineColor: '#d2b48c',
    gridLineStyle: 'solid',
    padding: '15px',
    borderRadius: '12px',
    shadow: '0 4px 12px rgba(0,0,0,0.15)',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0.4s',
    transitionEasing: 'ease-in-out',
  },

  sounds: {
    move: '/sounds/nature/wood-tap.mp3',
    rotate: '/sounds/nature/leaf-rustle.mp3',
    drop: '/sounds/nature/stone-drop.mp3',
    lineClear: '/sounds/nature/wind-chime.mp3',
    gameOver: '/sounds/nature/bell.mp3',
    abilityActivate: '/sounds/nature/sparkle.mp3',
    volumeMultiplier: 0.9,
  },

  animations: {
    blockLanding: '0.3s',
    lineClear: '0.5s',
    gameOver: '0.7s',
    blockFallEasing: 'ease-in-out',
    lineClearEffect: 'dissolve',
  },

  particles: {
    shape: 'circle',
    size: { min: 3, max: 8 },
    color: ['#82e0aa', '#f9e79f', '#bb8fce'],
    lifetime: 1200,
    gravity: 0.2,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = natureOrganicTheme.colors.pieces[type];

    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Base color with slight texture
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // Organic texture overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 5; i++) {
      const tx = x + Math.random() * size;
      const ty = y + Math.random() * size;
      ctx.fillRect(tx, ty, 1, 1);
    }

    // Soft border
    ctx.strokeStyle = `rgba(${Math.max(r - 30, 0)}, ${Math.max(g - 30, 0)}, ${Math.max(b - 30, 0)}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Highlight
    const gradient = ctx.createLinearGradient(x, y, x + size * 0.5, y + size * 0.5);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size * 0.4, size * 0.4);
  },

  cssVars: {
    '--theme-bg': '#f5f5dc',
    '--theme-text': '#4a4a4a',
    '--theme-accent': '#82e0aa',
    '--theme-board-bg': '#f0e68c',
    '--theme-grid': '#d2b48c',
  },
};
