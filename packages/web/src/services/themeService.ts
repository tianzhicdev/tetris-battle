/**
 * Theme Service
 * Handles theme persistence to localStorage and Supabase
 */

import { supabase } from '../lib/supabase';
import { getTheme, DEFAULT_THEME_ID, THEME_IDS, type Theme } from '../themes/index';

const STORAGE_KEY = 'tetris-theme-preference';

/**
 * Save theme preference to localStorage
 */
export function saveThemeToLocalStorage(themeId: string): void {
  if (!THEME_IDS.includes(themeId)) {
    console.warn(`[THEME] Invalid theme ID: ${themeId}, using default`);
    themeId = DEFAULT_THEME_ID;
  }
  localStorage.setItem(STORAGE_KEY, themeId);
}

/**
 * Load theme preference from localStorage
 */
export function loadThemeFromLocalStorage(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Save theme preference to user profile in Supabase
 */
export async function saveThemeToProfile(userId: string, themeId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ themePreference: themeId })
      .eq('userId', userId);

    if (error) {
      console.error('[THEME] Failed to save to profile:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[THEME] Error saving theme:', err);
    return false;
  }
}

/**
 * Load theme preference from user profile in Supabase
 */
export async function loadThemeFromProfile(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('themePreference')
      .eq('userId', userId)
      .single();

    if (error || !data) {
      console.error('[THEME] Failed to load from profile:', error);
      return null;
    }

    return data.themePreference || null;
  } catch (err) {
    console.error('[THEME] Error loading theme:', err);
    return null;
  }
}

/**
 * Get current theme with fallback logic:
 * 1. Try profile (if userId provided)
 * 2. Try localStorage
 * 3. Use default
 */
export async function getCurrentThemeId(userId?: string): Promise<string> {
  // Try profile first
  if (userId) {
    const profileTheme = await loadThemeFromProfile(userId);
    if (profileTheme && THEME_IDS.includes(profileTheme)) {
      return profileTheme;
    }
  }

  // Try localStorage
  const localTheme = loadThemeFromLocalStorage();
  if (localTheme && THEME_IDS.includes(localTheme)) {
    return localTheme;
  }

  // Default
  return DEFAULT_THEME_ID;
}

/**
 * Apply theme and persist
 */
export async function applyTheme(themeId: string, userId?: string): Promise<Theme> {
  const theme = getTheme(themeId);

  // Save to localStorage immediately
  saveThemeToLocalStorage(themeId);

  // Save to profile (async, don't wait)
  if (userId) {
    saveThemeToProfile(userId, themeId).catch(err => {
      console.warn('[THEME] Failed to persist to profile:', err);
    });
  }

  return theme;
}
