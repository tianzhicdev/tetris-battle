/**
 * Retro 8-bit Theme
 * NES/Game Boy era nostalgia with pixel art graphics
 */

import type { Theme } from './types';

export const retro8bitTheme: Theme = {
  id: 'retro-8bit',
  name: 'Retro 8-bit',
  description: 'NES/Game Boy era nostalgia',
  category: 'retro',

  colors: {
    pieces: {
      I: '#00ffff', // Bright cyan
      O: '#ffff00', // Bright yellow
      T: '#ff00ff', // Magenta
      S: '#00ff00', // Bright green
      Z: '#ff0000', // Bright red
      L: '#ff8800', // Orange
      J: '#0088ff', // Bright blue
    },
    background: '#0a0a1a', // Dark blue-black
    boardBackground: '#0a0a1a',
    gridLines: '#1a1a3a',
    text: '#00ffff',
    textSecondary: '#00ff00',
    accent: '#ff00ff',
    particleColor: '#00ffff',
  },

  typography: {
    fontFamily: '"Press Start 2P", "Courier New", monospace',
    fontSize: {
      title: '2.5rem',
      score: '1.5rem',
      label: '0.8rem',
      button: '1rem',
    },
    fontWeight: {
      normal: 400,
      bold: 400, // Pixel fonts don't have bold
    },
    textTransform: 'uppercase',
  },

  blocks: {
    style: 'textured', // Pixel art style
    borderRadius: '0px', // Sharp edges
    borderWidth: '2px',
    borderStyle: 'solid',
    shadow: 'none', // No shadows in 8-bit
  },

  board: {
    background: '#0a0a1a',
    gridLineWidth: '2px',
    gridLineColor: '#1a1a3a',
    gridLineStyle: 'solid',
    padding: '10px',
    borderRadius: '0px', // No rounded corners
    shadow: 'none',
    overlay: 'scanlines',
    overlayOpacity: 0.1,
  },

  effects: {
    scanlines: true,
    crtCurve: true,
    chromaticAberration: true,
    transitionDuration: '0.1s',
    transitionEasing: 'steps(4)', // Stepped animation
  },

  sounds: {
    move: '/sounds/retro/blip.mp3',
    rotate: '/sounds/retro/rotate.mp3',
    drop: '/sounds/retro/drop.mp3',
    lineClear: '/sounds/retro/clear.mp3',
    gameOver: '/sounds/retro/gameover.mp3',
    abilityActivate: '/sounds/retro/powerup.mp3',
    volumeMultiplier: 1.2,
  },

  animations: {
    blockLanding: '0.1s',
    lineClear: '0.3s',
    gameOver: '0.5s',
    blockFallEasing: 'steps(8)',
    lineClearEffect: 'flash',
  },

  particles: {
    shape: 'square',
    size: { min: 4, max: 8 },
    color: ['#00ffff', '#ff00ff', '#ffff00'],
    lifetime: 800,
    gravity: 0.3,
    fadeOut: false, // Hard disappear
  },

  renderBlock: (ctx, x, y, size, type) => {
    const color = retro8bitTheme.colors.pieces[type];
    const pixelSize = Math.max(2, Math.floor(size / 8));

    // Base color
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);

    // Pixel pattern overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let py = 0; py < size; py += pixelSize * 2) {
      for (let px = 0; px < size; px += pixelSize * 2) {
        if ((px + py) % (pixelSize * 4) === 0) {
          ctx.fillRect(x + px, y + py, pixelSize, pixelSize);
        }
      }
    }

    // Outer border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // Inner highlight (top-left)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = pixelSize;
    ctx.beginPath();
    ctx.moveTo(x + pixelSize, y + size - pixelSize);
    ctx.lineTo(x + pixelSize, y + pixelSize);
    ctx.lineTo(x + size - pixelSize, y + pixelSize);
    ctx.stroke();

    // Inner shadow (bottom-right)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x + size - pixelSize, y + pixelSize);
    ctx.lineTo(x + size - pixelSize, y + size - pixelSize);
    ctx.lineTo(x + pixelSize, y + size - pixelSize);
    ctx.stroke();
  },

  cssVars: {
    '--theme-bg': '#0a0a1a',
    '--theme-text': '#00ffff',
    '--theme-accent': '#ff00ff',
    '--theme-board-bg': '#0a0a1a',
    '--theme-grid': '#1a1a3a',
  },
};
