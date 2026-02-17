/**
 * Theme Registry
 * Central export point for all themes.
 * Only glassmorphism is active — other themes were removed (see git history).
 */

// Export types
export * from './types';

// Export individual themes
export { glassmorphismTheme } from './glassmorphism';

import type { Theme, ThemeRegistry, ThemeCategoryGroups } from './types';
import type { TetrominoType } from '@tetris-battle/game-core';
import { glassmorphismTheme } from './glassmorphism';

/**
 * Theme Registry
 * Maps theme IDs to theme objects.
 * To add a new theme: create a file in this directory and add an entry here.
 */
export const THEME_REGISTRY: ThemeRegistry = {
  'glassmorphism': glassmorphismTheme,
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
  modern: ['glassmorphism'],
};

/**
 * Backward compatibility: THEMES array
 */
export const THEMES = getAllThemes();

/**
 * Backward compatibility: getThemeByName
 */
export function getThemeByName(name: string): Theme {
  const theme = getAllThemes().find(t => t.name === name);
  return theme || DEFAULT_THEME;
}

/**
 * Backward compatibility: Legacy theme interface adapter
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
