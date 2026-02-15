/**
 * Theme System Type Definitions
 * Comprehensive theming support for Tetris Battle
 */

import type { TetrominoType } from '@tetris-battle/game-core';

/**
 * Theme color configuration
 */
export interface ThemeColors {
  // Tetromino piece colors
  pieces: {
    I: string;
    O: string;
    T: string;
    S: string;
    Z: string;
    J: string;
    L: string;
  };

  // UI colors
  background: string;
  boardBackground: string;
  gridLines: string;
  text: string;
  textSecondary: string;
  accent: string;

  // Effect colors
  particleColor: string;
  glowColor?: string;
}

/**
 * Theme typography configuration
 */
export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    title: string;
    score: string;
    label: string;
    button: string;
  };
  fontWeight: {
    normal: number;
    bold: number;
  };
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

/**
 * Block rendering style configuration
 */
export interface BlockStyle {
  // Rendering style
  style: 'flat' | 'gradient' | 'textured' | 'isometric' | 'ascii' | 'glow' | 'glass' | 'sketch';

  // Block properties
  borderRadius: string;
  borderWidth: string;
  borderStyle: string;
  shadow?: string;

  // Special effects
  texture?: string; // URL or data URI
  filter?: string; // CSS filter
  backdrop?: string; // backdrop-filter for glassmorphism

  // Animation properties
  landingAnimation?: 'bounce' | 'squash' | 'shake' | 'glow' | 'none';
  lockAnimation?: 'fade' | 'flash' | 'pulse' | 'none';
}

/**
 * Board styling configuration
 */
export interface BoardStyle {
  background: string; // color, gradient, or image URL
  gridLineWidth: string;
  gridLineColor: string;
  gridLineStyle: 'solid' | 'dashed' | 'dotted';
  padding: string;
  borderRadius: string;
  shadow?: string;

  // Special overlays
  overlay?: 'scanlines' | 'crt' | 'paper' | 'glass' | 'none';
  overlayOpacity?: number;
}

/**
 * Theme visual effects configuration
 */
export interface ThemeEffects {
  // Post-processing effects
  blur?: number;
  bloom?: boolean;
  chromaticAberration?: boolean;
  scanlines?: boolean;
  crtCurve?: boolean;
  vignette?: boolean;

  // Transition effects
  transitionDuration: string;
  transitionEasing: string;
}

/**
 * Theme sound configuration
 */
export interface ThemeSounds {
  // Sound effect identifiers or URLs
  move: string;
  rotate: string;
  drop: string;
  lineClear: string;
  gameOver: string;
  abilityActivate: string;

  // Volume multiplier for this theme
  volumeMultiplier?: number;
}

/**
 * Theme animation configuration
 */
export interface ThemeAnimations {
  // Animation durations
  blockLanding: string;
  lineClear: string;
  gameOver: string;

  // Animation styles
  blockFallEasing: string;
  lineClearEffect: 'fade' | 'explode' | 'dissolve' | 'slide' | 'flash';
}

/**
 * Particle system configuration
 */
export interface ParticleStyle {
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'custom';
  size: { min: number; max: number };
  color: string | string[];
  lifetime: number;
  gravity: number;
  fadeOut: boolean;

  // Special particle types per theme
  customParticle?: string; // Component name or renderer
}

/**
 * Complete theme definition
 */
export interface Theme {
  // Metadata
  id: string;
  name: string;
  description: string;
  category: 'retro' | 'modern' | 'artistic' | 'technical';

  // Visual properties
  colors: ThemeColors;
  typography: ThemeTypography;
  blocks: BlockStyle;
  board: BoardStyle;
  effects: ThemeEffects;

  // Audio
  sounds: ThemeSounds;

  // Animations & particles
  animations: ThemeAnimations;
  particles: ParticleStyle;

  // Canvas rendering function
  renderBlock: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: TetrominoType
  ) => void;

  // Optional CSS variables for UI theming
  cssVars?: Record<string, string>;
}

/**
 * Theme registry type
 */
export type ThemeRegistry = Record<string, Theme>;

/**
 * Theme category groups
 */
export type ThemeCategoryGroups = Record<string, string[]>;
