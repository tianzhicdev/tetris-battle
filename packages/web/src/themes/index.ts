/**
 * Theme Registry
 * Central export point for all themes
 */

// Export types
export * from './types';

// Export individual themes
export { glassmorphismTheme } from './glassmorphism';
export { retro8bitTheme } from './retro8bit';
export { neonCyberpunkTheme } from './neonCyberpunk';
export { minimalistFlatTheme } from './minimalistFlat';
export { brutalistTheme } from './brutalist';
export { isometric3dTheme } from './isometric3d';
export { handDrawnTheme } from './handDrawn';
export { natureOrganicTheme } from './natureOrganic';
export { terminalHackerTheme } from './terminalHacker';
export { liquidMorphingTheme } from './liquidMorphing';

import type { Theme, ThemeRegistry, ThemeCategoryGroups } from './types';
import type { TetrominoType } from '@tetris-battle/game-core';
import { glassmorphismTheme } from './glassmorphism';
import { retro8bitTheme } from './retro8bit';
import { neonCyberpunkTheme } from './neonCyberpunk';
import { minimalistFlatTheme } from './minimalistFlat';
import { brutalistTheme } from './brutalist';
import { isometric3dTheme } from './isometric3d';
import { handDrawnTheme } from './handDrawn';
import { natureOrganicTheme } from './natureOrganic';
import { terminalHackerTheme } from './terminalHacker';
import { liquidMorphingTheme } from './liquidMorphing';

/**
 * Theme Registry
 * Maps theme IDs to theme objects
 */
export const THEME_REGISTRY: ThemeRegistry = {
  'glassmorphism': glassmorphismTheme,
  'retro-8bit': retro8bitTheme,
  'neon-cyberpunk': neonCyberpunkTheme,
  'minimalist-flat': minimalistFlatTheme,
  'brutalist': brutalistTheme,
  'isometric-3d': isometric3dTheme,
  'hand-drawn': handDrawnTheme,
  'nature-organic': natureOrganicTheme,
  'terminal-hacker': terminalHackerTheme,
  'liquid-morphing': liquidMorphingTheme,
};

/**
 * Array of all theme IDs
 */
export const THEME_IDS = Object.keys(THEME_REGISTRY);

/**
 * Get theme by ID with fallback to default
 */
export function getTheme(id: string): Theme {
  return THEME_REGISTRY[id] || THEME_REGISTRY['glassmorphism'];
}

/**
 * Get all themes as array
 */
export function getAllThemes(): Theme[] {
  return Object.values(THEME_REGISTRY);
}

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'glassmorphism';

/**
 * Default theme object
 */
export const DEFAULT_THEME = THEME_REGISTRY[DEFAULT_THEME_ID];

/**
 * Theme categories for filtering
 */
export const THEME_CATEGORIES: ThemeCategoryGroups = {
  retro: ['retro-8bit', 'terminal-hacker'],
  modern: ['glassmorphism', 'minimalist-flat', 'neon-cyberpunk'],
  artistic: ['hand-drawn', 'nature-organic', 'liquid-morphing'],
  technical: ['brutalist', 'isometric-3d'],
};

/**
 * Backward compatibility: THEMES array
 * For existing code that uses the old THEMES array
 */
export const THEMES = getAllThemes();

/**
 * Backward compatibility: getThemeByName
 * For existing code that uses name instead of ID
 */
export function getThemeByName(name: string): Theme {
  const theme = getAllThemes().find(t => t.name === name);
  return theme || DEFAULT_THEME;
}

/**
 * Backward compatibility: Legacy theme interface adapter
 * For components expecting the old Theme interface
 */
export interface LegacyTheme {
  name: string;
  backgroundColor: string;
  gridColor: string;
  textColor: string;
  uiBackgroundColor: string;
  colors: Record<string, string>;
  renderBlock: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: TetrominoType
  ) => void;
}

export function toLegacyTheme(theme: Theme): LegacyTheme {
  return {
    name: theme.name,
    backgroundColor: theme.colors.background,
    gridColor: theme.colors.gridLines,
    textColor: theme.colors.text,
    uiBackgroundColor: theme.colors.boardBackground,
    colors: theme.colors.pieces,
    renderBlock: theme.renderBlock,
  };
}
