/**
 * Glassmorphism Theme Test
 */

import { describe, it, expect } from 'vitest';
import { glassmorphismTheme } from '../glassmorphism';

describe('Glassmorphism Theme', () => {
  it('should have correct theme metadata', () => {
    expect(glassmorphismTheme.id).toBe('glassmorphism');
    expect(glassmorphismTheme.name).toBe('Glassmorphism');
    expect(glassmorphismTheme.category).toBe('modern');
    expect(glassmorphismTheme.description).toContain('frosted glass');
  });

  it('should have all required pieces colors', () => {
    expect(glassmorphismTheme.colors.pieces.I).toBe('#00f0f0');
    expect(glassmorphismTheme.colors.pieces.O).toBe('#f0f000');
    expect(glassmorphismTheme.colors.pieces.T).toBe('#a000f0');
    expect(glassmorphismTheme.colors.pieces.S).toBe('#00f000');
    expect(glassmorphismTheme.colors.pieces.Z).toBe('#f00000');
    expect(glassmorphismTheme.colors.pieces.L).toBe('#f0a000');
    expect(glassmorphismTheme.colors.pieces.J).toBe('#0000f0');
  });

  it('should have renderBlock function', () => {
    expect(typeof glassmorphismTheme.renderBlock).toBe('function');
  });

  it('should have glass block style', () => {
    expect(glassmorphismTheme.blocks.style).toBe('glass');
  });

  it('should have CSS variables', () => {
    expect(glassmorphismTheme.cssVars).toBeDefined();
    expect(glassmorphismTheme.cssVars?.['--theme-bg']).toBe('#0a0a1a');
    expect(glassmorphismTheme.cssVars?.['--theme-accent']).toBe('#00f0f0');
  });

  it('should have typography configuration', () => {
    expect(glassmorphismTheme.typography.fontFamily).toContain('system-ui');
    expect(glassmorphismTheme.typography.fontSize.title).toBe('3rem');
  });

  it('should have animation configuration', () => {
    expect(glassmorphismTheme.animations.lineClearEffect).toBe('fade');
    expect(glassmorphismTheme.animations.blockFallEasing).toBeTruthy();
  });

  it('should have particle configuration', () => {
    expect(glassmorphismTheme.particles.shape).toBe('circle');
    expect(glassmorphismTheme.particles.fadeOut).toBe(true);
  });
});
