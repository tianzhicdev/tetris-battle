/**
 * Neon Cyberpunk Theme
 * Tron meets vaporwave arcade with glowing effects
 */

import type { Theme } from './types';

export const neonCyberpunkTheme: Theme = {
  id: 'neon-cyberpunk',
  name: 'Neon Cyberpunk',
  description: 'Tron meets vaporwave arcade',
  category: 'modern',

  colors: {
    pieces: {
      I: '#00ffff', // Electric cyan
      O: '#ffff00', // Neon yellow
      T: '#ff00ff', // Hot magenta
      S: '#00ff99', // Neon green
      Z: '#ff0066', // Hot pink
      L: '#ff6600', // Neon orange
      J: '#0066ff', // Electric blue
    },
    background: '#000000',
    boardBackground: '#0a0a1a',
    gridLines: '#ff00ff',
    text: '#00ffff',
    textSecondary: '#ff00ff',
    accent: '#ff00ff',
    particleColor: '#00ffff',
    glowColor: '#ff00ff',
  },

  typography: {
    fontFamily: '"Orbitron", "Rajdhani", sans-serif',
    fontSize: {
      title: '3.5rem',
      score: '2.5rem',
      label: '1.1rem',
      button: '1.3rem',
    },
    fontWeight: {
      normal: 400,
      bold: 700,
    },
    letterSpacing: '0.05em',
  },

  blocks: {
    style: 'glow',
    borderRadius: '4px',
    borderWidth: '2px',
    borderStyle: 'solid',
    shadow: '0 0 20px currentColor',
    filter: 'brightness(1.2)',
  },

  board: {
    background: 'linear-gradient(135deg, #000000 0%, #0a001a 100%)',
    gridLineWidth: '1px',
    gridLineColor: '#ff00ff',
    gridLineStyle: 'solid',
    padding: '15px',
    borderRadius: '8px',
    shadow: '0 0 40px rgba(255,0,255,0.5), inset 0 0 20px rgba(0,255,255,0.2)',
    overlay: 'scanlines',
    overlayOpacity: 0.05,
  },

  effects: {
    bloom: true,
    chromaticAberration: true,
    scanlines: true,
    transitionDuration: '0.2s',
    transitionEasing: 'ease-out',
  },

  sounds: {
    move: '/sounds/neon/synth-move.mp3',
    rotate: '/sounds/neon/synth-rotate.mp3',
    drop: '/sounds/neon/bass-drop.mp3',
    lineClear: '/sounds/neon/synth-clear.mp3',
    gameOver: '/sounds/neon/synth-end.mp3',
    abilityActivate: '/sounds/neon/power.mp3',
    volumeMultiplier: 1.1,
  },

  animations: {
    blockLanding: '0.15s',
    lineClear: '0.4s',
    gameOver: '0.8s',
    blockFallEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    lineClearEffect: 'explode',
  },

  particles: {
    shape: 'circle',
    size: { min: 1, max: 4 },
    color: ['#00ffff', '#ff00ff'],
    lifetime: 1200,
    gravity: 0.2,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = neonCyberpunkTheme.colors.pieces[type];

    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Neon glow background
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.shadowBlur = 0;

    // Inner gradient
    const gradient = ctx.createRadialGradient(
      x + size / 2,
      y + size / 2,
      0,
      x + size / 2,
      y + size / 2,
      size / 2
    );
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.3)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);

    // Neon border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  },

  cssVars: {
    '--theme-bg': '#000000',
    '--theme-text': '#00ffff',
    '--theme-accent': '#ff00ff',
    '--theme-board-bg': '#0a0a1a',
    '--theme-grid': '#ff00ff',
  },
};
