/**
 * Theme Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase before importing themeService
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock themes module
vi.mock('../../themes', () => ({
  getTheme: vi.fn((id: string) => ({ id, name: 'Mock Theme' })),
  DEFAULT_THEME_ID: 'glassmorphism',
  THEME_IDS: ['glassmorphism'],
}));

import {
  saveThemeToLocalStorage,
  loadThemeFromLocalStorage,
  getCurrentThemeId,
} from '../themeService';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Theme Service', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('saveThemeToLocalStorage', () => {
    it('should save valid theme ID to localStorage', () => {
      saveThemeToLocalStorage('glassmorphism');
      expect(localStorage.getItem('tetris-theme-preference')).toBe('glassmorphism');
    });

    it('should save valid theme ID (glassmorphism again)', () => {
      saveThemeToLocalStorage('glassmorphism');
      expect(localStorage.getItem('tetris-theme-preference')).toBe('glassmorphism');
    });

    it('should fallback to default for invalid theme ID', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      saveThemeToLocalStorage('invalid-theme');
      expect(localStorage.getItem('tetris-theme-preference')).toBe('glassmorphism');
      consoleSpy.mockRestore();
    });
  });

  describe('loadThemeFromLocalStorage', () => {
    it('should load saved theme from localStorage', () => {
      localStorage.setItem('tetris-theme-preference', 'glassmorphism');
      expect(loadThemeFromLocalStorage()).toBe('glassmorphism');
    });

    it('should return null when nothing saved', () => {
      expect(loadThemeFromLocalStorage()).toBeNull();
    });
  });

  describe('getCurrentThemeId', () => {
    it('should return localStorage theme when available', async () => {
      localStorage.setItem('tetris-theme-preference', 'glassmorphism');
      const themeId = await getCurrentThemeId();
      expect(themeId).toBe('glassmorphism');
    });

    it('should return default when nothing saved', async () => {
      const themeId = await getCurrentThemeId();
      expect(themeId).toBe('glassmorphism');
    });

    it('should return default for invalid localStorage value', async () => {
      localStorage.setItem('tetris-theme-preference', 'invalid');
      const themeId = await getCurrentThemeId();
      expect(themeId).toBe('glassmorphism');
    });
  });
});
