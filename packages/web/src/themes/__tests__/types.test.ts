/**
 * Theme Types Test
 * Validates theme type definitions
 */

import { describe, it, expect } from 'vitest';
import type { Theme, ThemeColors, ThemeTypography, BlockStyle, BoardStyle } from '../types';

describe('Theme Types', () => {
  it('should allow valid theme definition', () => {
    const validTheme: Theme = {
      id: 'test-theme',
      name: 'Test Theme',
      description: 'A test theme',
      category: 'modern',

      colors: {
        pieces: {
          I: '#00ffff',
          O: '#ffff00',
          T: '#ff00ff',
          S: '#00ff00',
          Z: '#ff0000',
          L: '#ff8800',
          J: '#0000ff',
        },
        background: '#000000',
        boardBackground: '#0a0a1a',
        gridLines: '#1a1a3a',
        text: '#ffffff',
        textSecondary: '#aaaaaa',
        accent: '#00ffff',
        particleColor: '#00ffff',
      },

      typography: {
        fontFamily: 'monospace',
        fontSize: {
          title: '3rem',
          score: '2rem',
          label: '1rem',
          button: '1.2rem',
        },
        fontWeight: {
          normal: 400,
          bold: 700,
        },
      },

      blocks: {
        style: 'flat',
        borderRadius: '0px',
        borderWidth: '2px',
        borderStyle: 'solid',
      },

      board: {
        background: '#0a0a1a',
        gridLineWidth: '1px',
        gridLineColor: '#1a1a3a',
        gridLineStyle: 'solid',
        padding: '10px',
        borderRadius: '8px',
      },

      effects: {
        transitionDuration: '0.3s',
        transitionEasing: 'ease-out',
      },

      sounds: {
        move: '/sounds/move.mp3',
        rotate: '/sounds/rotate.mp3',
        drop: '/sounds/drop.mp3',
        lineClear: '/sounds/clear.mp3',
        gameOver: '/sounds/gameover.mp3',
        abilityActivate: '/sounds/ability.mp3',
      },

      animations: {
        blockLanding: '0.2s',
        lineClear: '0.4s',
        gameOver: '0.6s',
        blockFallEasing: 'ease-out',
        lineClearEffect: 'fade',
      },

      particles: {
        shape: 'circle',
        size: { min: 2, max: 6 },
        color: '#00ffff',
        lifetime: 1000,
        gravity: 0.5,
        fadeOut: true,
      },

      renderBlock: () => {}, // Mock function
    };

    expect(validTheme.id).toBe('test-theme');
    expect(validTheme.name).toBe('Test Theme');
    expect(validTheme.category).toBe('modern');
    expect(validTheme.colors.pieces.I).toBe('#00ffff');
    expect(validTheme.typography.fontFamily).toBe('monospace');
  });

  it('should allow optional theme properties', () => {
    const themeWithOptionals: Partial<Theme> = {
      colors: {
        pieces: {
          I: '#00ffff',
          O: '#ffff00',
          T: '#ff00ff',
          S: '#00ff00',
          Z: '#ff0000',
          L: '#ff8800',
          J: '#0000ff',
        },
        background: '#000000',
        boardBackground: '#0a0a1a',
        gridLines: '#1a1a3a',
        text: '#ffffff',
        textSecondary: '#aaaaaa',
        accent: '#00ffff',
        particleColor: '#00ffff',
        glowColor: '#00ffff', // Optional
      },
      effects: {
        blur: 10, // Optional
        bloom: true, // Optional
        scanlines: true, // Optional
        transitionDuration: '0.3s',
        transitionEasing: 'ease-out',
      },
      cssVars: {
        '--theme-bg': '#000000',
      },
    };

    expect(themeWithOptionals.colors?.glowColor).toBe('#00ffff');
    expect(themeWithOptionals.effects?.blur).toBe(10);
    expect(themeWithOptionals.cssVars?.['--theme-bg']).toBe('#000000');
  });

  it('should enforce theme category types', () => {
    const categories: Array<Theme['category']> = ['retro', 'modern', 'artistic', 'technical'];
    expect(categories).toContain('retro');
    expect(categories).toContain('modern');
    expect(categories).toContain('artistic');
    expect(categories).toContain('technical');
  });

  it('should enforce block style types', () => {
    const styles: Array<BlockStyle['style']> = [
      'flat',
      'gradient',
      'textured',
      'isometric',
      'ascii',
      'glow',
      'glass',
      'sketch',
    ];
    expect(styles.length).toBe(8);
  });
});
