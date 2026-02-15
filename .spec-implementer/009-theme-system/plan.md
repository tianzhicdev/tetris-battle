# Implementation Plan for Theme System (Spec 009)

## Overview
- Total steps: 18
- Estimated new files: 15
- Estimated modified files: 6

## Steps

### Step 1: Define Theme Type System

**Files to create:**
- `packages/web/src/themes/types.ts` — Complete theme interface and subtypes

**Implementation details:**
Create comprehensive TypeScript interfaces matching spec requirements:
```typescript
// Core theme interface with all properties from spec
export interface Theme {
  id: string;
  name: string;
  description: string;
  category: 'retro' | 'modern' | 'artistic' | 'technical';

  colors: ThemeColors;
  typography: ThemeTypography;
  blocks: BlockStyle;
  board: BoardStyle;
  effects: ThemeEffects;
  sounds: ThemeSounds;
  animations: ThemeAnimations;
  particles: ParticleStyle;

  // Canvas rendering function (existing pattern)
  renderBlock: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: TetrominoType) => void;

  // Optional CSS variables for UI theming
  cssVars?: Record<string, string>;
}

// Define all subinterfaces per spec (ThemeColors, ThemeTypography, etc.)
```

Follow the interface structure from spec lines 181-329. Use existing `TetrominoType` from `@tetris-battle/game-core`.

**Test:**
- Create `packages/web/src/themes/__tests__/types.test.ts`
- Test cases: Type checking only (TypeScript validation)
- Run: `pnpm --filter web type-check`

**Verify:**
- File compiles without errors
- Types exported correctly

---

### Step 2: Refactor Existing Glassmorphism Theme

**Files to create:**
- `packages/web/src/themes/glassmorphism.ts` — Refactored glass theme

**Files to modify:**
- `packages/web/src/themes.ts` — Will be replaced after all themes ready

**Implementation details:**
Extract existing `glassTheme` from `themes.ts` (lines 115-179) and expand to full Theme interface:

```typescript
import type { Theme } from './types';
import type { TetrominoType } from '@tetris-battle/game-core';

export const glassmorphismTheme: Theme = {
  id: 'glassmorphism',
  name: 'Glassmorphism',
  description: 'Modern iOS premium feel with frosted glass',
  category: 'modern',

  colors: {
    pieces: {
      I: '#00f0f0',
      O: '#f0f000',
      T: '#a000f0',
      S: '#00f000',
      Z: '#f00000',
      L: '#f0a000',
      J: '#0000f0',
    },
    background: '#0a0a1a',
    boardBackground: '#0a0a1a',
    gridLines: '#1a1a3a',
    text: '#ffffff',
    textSecondary: '#aaaaaa',
    accent: '#00f0f0',
    particleColor: '#00f0f0',
    glowColor: '#00f0f0',
  },

  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '1rem',
      button: '1.2rem',
    },
    fontWeight: {
      normal: 400,
      bold: 600,
    },
  },

  blocks: {
    style: 'glass',
    borderRadius: '2px',
    borderWidth: '2px',
    borderStyle: 'solid',
    shadow: '0 4px 8px rgba(0,0,0,0.3)',
    backdrop: 'blur(10px)',
  },

  board: {
    background: 'linear-gradient(135deg, #1a1a3a 0%, #0a0a1a 100%)',
    gridLineWidth: '1px',
    gridLineColor: '#1a1a3a',
    gridLineStyle: 'solid',
    padding: '10px',
    borderRadius: '12px',
    shadow: '0 8px 32px rgba(0,0,0,0.4)',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0.3s',
    transitionEasing: 'ease-out',
  },

  sounds: {
    move: '/sounds/glass/move.mp3',
    rotate: '/sounds/glass/rotate.mp3',
    drop: '/sounds/glass/drop.mp3',
    lineClear: '/sounds/glass/clear.mp3',
    gameOver: '/sounds/glass/gameover.mp3',
    abilityActivate: '/sounds/glass/ability.mp3',
    volumeMultiplier: 1.0,
  },

  animations: {
    blockLanding: '0.2s',
    lineClear: '0.4s',
    gameOver: '0.6s',
    blockFallEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    lineClearEffect: 'fade',
  },

  particles: {
    shape: 'circle',
    size: { min: 2, max: 6 },
    color: '#00f0f0',
    lifetime: 1000,
    gravity: 0.5,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    // Keep existing renderBlock implementation from themes.ts lines 130-178
    const colors = glassmorphismTheme.colors.pieces;
    const color = colors[type];
    // ... (copy existing logic)
  },

  cssVars: {
    '--theme-bg': '#0a0a1a',
    '--theme-text': '#ffffff',
    '--theme-accent': '#00f0f0',
  },
};
```

**Test:**
- Create `packages/web/src/themes/__tests__/glassmorphism.test.ts`
- Test cases: Theme structure validation, renderBlock function exists
- Run: `pnpm --filter web test glassmorphism`

**Verify:**
- Theme object matches Theme interface
- renderBlock function renders blocks correctly (visual test)

---

### Step 3: Create Retro 8-bit Theme

**Files to create:**
- `packages/web/src/themes/retro8bit.ts` — Retro 8-bit theme definition

**Implementation details:**
Create theme matching spec lines 33-42. Enhance existing `retroTheme` from `themes.ts`:

```typescript
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
    // Copy and adapt from existing retroTheme (themes.ts lines 72-111)
    // Add pixel pattern overlay
  },
};
```

**Test:**
- Add test case in `packages/web/src/themes/__tests__/themes.test.ts`
- Verify theme structure and pixel rendering

**Verify:**
- Theme validates against interface
- Pixel pattern visible in renderBlock

---

### Step 4: Create Neon Cyberpunk Theme

**Files to create:**
- `packages/web/src/themes/neonCyberpunk.ts` — Neon cyberpunk theme

**Implementation details:**
Create theme per spec lines 45-55:

```typescript
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
    // Neon outline with glow effect
    // Use radial gradients for glow
  },
};
```

**Test:**
- Add test in `themes.test.ts`

**Verify:**
- Glow effect visible in renderBlock
- Neon colors properly saturated

---

### Step 5: Create Minimalist Flat Theme

**Files to create:**
- `packages/web/src/themes/minimalistFlat.ts` — Minimalist theme

**Implementation details:**
Per spec lines 57-66:

```typescript
export const minimalistFlatTheme: Theme = {
  id: 'minimalist-flat',
  name: 'Minimalist Flat',
  description: 'Modern, clean, focused',
  category: 'modern',

  colors: {
    pieces: {
      I: '#95a5a6', // Gray
      O: '#ecf0f1', // Light gray
      T: '#bdc3c7', // Medium gray
      S: '#7f8c8d', // Dark gray
      Z: '#2c3e50', // Charcoal
      L: '#34495e', // Slate
      J: '#2980b9', // Subtle blue accent
    },
    background: '#ffffff',
    boardBackground: '#f8f9fa',
    gridLines: '#dee2e6',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    accent: '#2980b9',
    particleColor: '#95a5a6',
  },

  typography: {
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    fontSize: {
      title: '3rem',
      score: '2rem',
      label: '0.9rem',
      button: '1rem',
    },
    fontWeight: {
      normal: 300,
      bold: 500,
    },
  },

  blocks: {
    style: 'flat',
    borderRadius: '0px',
    borderWidth: '0px',
    borderStyle: 'none',
    shadow: 'none',
  },

  board: {
    background: '#f8f9fa',
    gridLineWidth: '1px',
    gridLineColor: '#dee2e6',
    gridLineStyle: 'solid',
    padding: '20px',
    borderRadius: '0px',
    shadow: 'none',
    overlay: 'none',
  },

  effects: {
    transitionDuration: '0.15s',
    transitionEasing: 'ease',
  },

  sounds: {
    move: '/sounds/minimal/soft-click.mp3',
    rotate: '/sounds/minimal/tap.mp3',
    drop: '/sounds/minimal/drop.mp3',
    lineClear: '/sounds/minimal/clear.mp3',
    gameOver: '/sounds/minimal/end.mp3',
    abilityActivate: '/sounds/minimal/activate.mp3',
    volumeMultiplier: 0.7, // Quieter
  },

  animations: {
    blockLanding: '0.1s',
    lineClear: '0.3s',
    gameOver: '0.4s',
    blockFallEasing: 'ease',
    lineClearEffect: 'fade',
  },

  particles: {
    shape: 'circle',
    size: { min: 2, max: 4 },
    color: '#95a5a6',
    lifetime: 600,
    gravity: 0.4,
    fadeOut: true,
  },

  renderBlock: (ctx, x, y, size, type) => {
    // Simple flat rectangle, no gradients
  },
};
```

**Test:**
- Add test in `themes.test.ts`

**Verify:**
- No gradients or shadows
- Clean flat appearance

---

### Step 6: Create Remaining 5 Themes (Brutalist, Isometric, Hand-drawn, Nature, Terminal, Liquid)

**Files to create:**
- `packages/web/src/themes/brutalist.ts`
- `packages/web/src/themes/isometric3d.ts`
- `packages/web/src/themes/handDrawn.ts`
- `packages/web/src/themes/natureOrganic.ts`
- `packages/web/src/themes/terminalHacker.ts`
- `packages/web/src/themes/liquidMorphing.ts`

**Implementation details:**
Follow the same pattern as Steps 3-5. Each theme:
1. Matches spec description for that theme
2. Implements all Theme interface properties
3. Has unique renderBlock() implementation
4. Uses appropriate fonts, colors, effects

Reference spec lines:
- Brutalist: 82-91
- Isometric 3D: 94-103
- Hand-drawn: 106-115
- Nature: 118-127
- Terminal: 129-139
- Liquid: 141-151

**Test:**
- Add test for each in `themes.test.ts`

**Verify:**
- All 10 themes defined
- Each has unique visual identity
- All match Theme interface

---

### Step 7: Create Theme Registry

**Files to create:**
- `packages/web/src/themes/index.ts` — Theme registry and exports

**Files to modify:**
- `packages/web/src/themes.ts` — Mark as deprecated, re-export from themes/index.ts

**Implementation details:**
```typescript
// packages/web/src/themes/index.ts
export * from './types';
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

import type { Theme } from './types';
import { glassmorphismTheme } from './glassmorphism';
// ... import all themes

export const THEME_REGISTRY: Record<string, Theme> = {
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

export const THEME_IDS = Object.keys(THEME_REGISTRY);

export function getTheme(id: string): Theme {
  return THEME_REGISTRY[id] || THEME_REGISTRY['glassmorphism'];
}

export function getAllThemes(): Theme[] {
  return Object.values(THEME_REGISTRY);
}

export const DEFAULT_THEME_ID = 'glassmorphism';
export const DEFAULT_THEME = THEME_REGISTRY[DEFAULT_THEME_ID];

// Backward compatibility exports
export const THEMES = getAllThemes(); // For old code using THEMES array
export { DEFAULT_THEME };
export { getThemeByName } from './compatibility'; // Adapter function

export const THEME_CATEGORIES = {
  retro: ['retro-8bit', 'terminal-hacker'],
  modern: ['glassmorphism', 'minimalist-flat', 'neon-cyberpunk'],
  artistic: ['hand-drawn', 'nature-organic', 'liquid-morphing'],
  technical: ['brutalist', 'isometric-3d'],
};
```

**Test:**
- Create `packages/web/src/themes/__tests__/registry.test.ts`
- Test cases:
  - getTheme() returns correct theme
  - getTheme() with invalid ID returns default
  - getAllThemes() returns 10 themes
  - THEME_IDS has 10 entries

**Verify:**
- All themes accessible via registry
- Backward compatibility maintained

---

### Step 8: Update TetrisRenderer for New Themes

**Files to modify:**
- `packages/web/src/renderer/TetrisRenderer.ts` — Support new rendering styles

**Implementation details:**
In TetrisRenderer class:
1. Keep existing setTheme() method (line 28-30)
2. Update drawBoard() if needed for new block styles
3. Consider adding helper methods for special rendering (isometric projection, ASCII blocks)

Example for isometric support:
```typescript
private drawIsometricBlock(x: number, y: number, color: string): void {
  const isoX = (x - y) * (this.blockSize * 0.6);
  const isoY = (x + y) * (this.blockSize * 0.3);
  // Draw 3D cube faces
}
```

**Test:**
- Extend existing renderer tests
- Visual test: Render sample board with each theme

**Verify:**
- All 10 themes render correctly
- No rendering errors in console

---

### Step 9: Create Theme Service for Persistence

**Files to create:**
- `packages/web/src/services/themeService.ts` — Theme persistence logic

**Implementation details:**
Follow service pattern from `friendService.ts`:

```typescript
import { supabase } from '../lib/supabase';
import { getTheme, DEFAULT_THEME_ID, THEME_IDS } from '../themes';
import type { Theme } from '../themes/types';

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
      .update({ theme_preference: themeId })
      .eq('user_id', userId);

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
      .select('theme_preference')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('[THEME] Failed to load from profile:', error);
      return null;
    }

    return data.theme_preference;
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
```

**Test:**
- Create `packages/web/src/services/__tests__/themeService.test.ts`
- Test cases:
  - saveThemeToLocalStorage saves correct value
  - loadThemeFromLocalStorage returns saved value
  - getCurrentThemeId returns default when nothing saved
  - getCurrentThemeId returns saved theme when exists
  - Invalid theme ID falls back to default

**Verify:**
- localStorage works (test in browser console)
- Service functions don't throw errors

---

### Step 10: Add ThemeContext (Optional but Recommended)

**Files to create:**
- `packages/web/src/contexts/ThemeContext.tsx` — React context for theme

**Implementation details:**
```typescript
import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getTheme, DEFAULT_THEME_ID } from '../themes';
import type { Theme } from '../themes/types';
import { getCurrentThemeId, applyTheme } from '../services/themeService';

interface ThemeContextType {
  theme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  userId?: string;
}

export function ThemeProvider({ children, userId }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [isLoading, setIsLoading] = useState(true);

  const theme = useMemo(() => getTheme(themeId), [themeId]);

  // Load theme on mount
  useEffect(() => {
    getCurrentThemeId(userId).then(id => {
      setThemeId(id);
      setIsLoading(false);
    });
  }, [userId]);

  // Apply theme and persist
  const handleSetTheme = async (newThemeId: string) => {
    const newTheme = await applyTheme(newThemeId, userId);
    setThemeId(newThemeId);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme: handleSetTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

**Test:**
- Create `packages/web/src/contexts/__tests__/ThemeContext.test.tsx`
- Test cases:
  - Provider provides theme value
  - setTheme updates theme
  - useTheme throws error outside provider

**Verify:**
- Context works in test environment
- No TypeScript errors

---

### Step 11: Create Theme Selector Component

**Files to create:**
- `packages/web/src/components/ThemeSelector.tsx` — Main theme selector UI

**Implementation details:**
Follow grid layout pattern from `AbilityShop.tsx`:

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllThemes, THEME_CATEGORIES } from '../themes';
import type { Theme } from '../themes/types';
import { ThemeCard } from './ThemeCard';
import { audioManager } from '../services/audioManager';
import { glassModal, mergeGlass } from '../styles/glassUtils';

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onClose: () => void;
}

export function ThemeSelector({ currentThemeId, onSelectTheme, onClose }: ThemeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const themes = getAllThemes();
  const filteredThemes = selectedCategory
    ? themes.filter(t => THEME_CATEGORIES[selectedCategory]?.includes(t.id))
    : themes;

  const handleSelectTheme = (themeId: string) => {
    audioManager.playSfx('button_click');
    onSelectTheme(themeId);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={mergeGlass(glassModal(), {
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '30px',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '20px', fontSize: '2rem' }}>Choose Your Style</h2>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedCategory(null)}>All</button>
          {Object.keys(THEME_CATEGORIES).map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        {/* Theme grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
        }}>
          {filteredThemes.map(theme => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === currentThemeId}
              onClick={() => handleSelectTheme(theme.id)}
            />
          ))}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

**Test:**
- Create `packages/web/src/components/__tests__/ThemeSelector.test.tsx`
- Test cases:
  - Renders all themes
  - Clicking theme calls onSelectTheme
  - Category filter works

**Verify:**
- Component renders without errors
- Grid layout looks good

---

### Step 12: Create Theme Card Component

**Files to create:**
- `packages/web/src/components/ThemeCard.tsx` — Individual theme preview card

**Implementation details:**
```typescript
import { motion } from 'framer-motion';
import type { Theme } from '../themes/types';
import { ThemePreview } from './ThemePreview';
import { glassStyle, mergeGlass } from '../styles/glassUtils';

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}

export function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      style={mergeGlass(glassStyle(), {
        padding: '15px',
        borderRadius: '12px',
        cursor: 'pointer',
        border: isActive ? '2px solid #00ffff' : '1px solid rgba(255,255,255,0.2)',
        boxShadow: isActive
          ? '0 0 20px rgba(0,255,255,0.5)'
          : '0 4px 16px rgba(0,0,0,0.2)',
      })}
      onClick={onClick}
    >
      <ThemePreview theme={theme} />
      <h3 style={{ marginTop: '10px', fontSize: '1.1rem' }}>{theme.name}</h3>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '5px' }}>
        {theme.description}
      </p>
      {isActive && (
        <div style={{ marginTop: '8px', color: '#00ffff', fontSize: '0.9rem' }}>
          ✓ Active
        </div>
      )}
    </motion.div>
  );
}
```

**Test:**
- Add to ThemeSelector tests

**Verify:**
- Cards render correctly
- Active state shows visually

---

### Step 13: Create Theme Preview Component

**Files to create:**
- `packages/web/src/components/ThemePreview.tsx` — Mini Tetris board preview

**Implementation details:**
```typescript
import { useEffect, useRef } from 'react';
import type { Theme } from '../themes/types';
import { TetrominoType } from '@tetris-battle/game-core';

interface ThemePreviewProps {
  theme: Theme;
}

// Sample 5x5 mini board for preview
const PREVIEW_PATTERN: (TetrominoType | null)[][] = [
  [null, 'I', 'I', 'I', 'I'],
  [null, null, 'O', 'O', null],
  ['T', 'T', 'T', null, null],
  [null, 'T', null, 'S', 'S'],
  ['Z', 'Z', null, null, 'S'],
];

export function ThemePreview({ theme }: ThemePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const blockSize = 15;
    const width = 5 * blockSize;
    const height = 5 * blockSize;

    // Clear
    ctx.fillStyle = theme.colors.boardBackground;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = theme.colors.gridLines;
    ctx.lineWidth = 1;
    for (let x = 0; x <= 5; x++) {
      ctx.beginPath();
      ctx.moveTo(x * blockSize, 0);
      ctx.lineTo(x * blockSize, height);
      ctx.stroke();
    }
    for (let y = 0; y <= 5; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * blockSize);
      ctx.lineTo(width, y * blockSize);
      ctx.stroke();
    }

    // Draw blocks
    PREVIEW_PATTERN.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          theme.renderBlock(ctx, x * blockSize, y * blockSize, blockSize, cell);
        }
      });
    });
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      width={75}
      height={75}
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: '8px',
        backgroundColor: theme.colors.boardBackground,
      }}
    />
  );
}
```

**Test:**
- Visual test only (render all themes)

**Verify:**
- Each theme preview looks distinct
- Canvas renders without errors

---

### Step 14: Integrate Theme Selector into Main Menu

**Files to modify:**
- `packages/web/src/components/MainMenu.tsx` — Add theme button and modal

**Implementation details:**
At line 26 (after other state):
```typescript
const [showThemeSelector, setShowThemeSelector] = useState(false);
```

Import ThemeSelector and useTheme:
```typescript
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
```

In the button section (around line 130, after Friends button):
```typescript
<button
  onClick={() => {
    audioManager.playSfx('button_click');
    setShowThemeSelector(true);
  }}
  className="glass-button"
  style={mergeGlass(glassBlue(), { /* ... */ })}
>
  🎨 Themes
</button>
```

At end of component, before closing div:
```typescript
<AnimatePresence>
  {showThemeSelector && (
    <ThemeSelector
      currentThemeId={themeId}
      onSelectTheme={setTheme}
      onClose={() => setShowThemeSelector(false)}
    />
  )}
</AnimatePresence>
```

**Test:**
- Manual test: Click theme button, selector opens
- Select theme, UI updates

**Verify:**
- Theme button visible in main menu
- Clicking opens selector modal
- Selecting theme closes modal and applies theme

---

### Step 15: Update App.tsx to Use ThemeContext

**Files to modify:**
- `packages/web/src/App.tsx` — Wrap in ThemeProvider, use context

**Implementation details:**
Replace local theme state (line 29) with context usage.

At top of imports:
```typescript
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
```

Modify GameApp component to use context:
```typescript
function GameApp({ profile }: { profile: UserProfile }) {
  const { theme, themeId, setTheme } = useTheme();
  // Remove: const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);

  // Use theme, themeId, setTheme from context
  // ... rest of component
}
```

Wrap in ThemeProvider in App component:
```typescript
function App() {
  return (
    <AuthWrapper>
      {(profile) => (
        <ThemeProvider userId={profile.userId}>
          <GameApp profile={profile} />
        </ThemeProvider>
      )}
    </AuthWrapper>
  );
}
```

**Test:**
- Run app in browser
- Theme should persist across page refreshes

**Verify:**
- Theme loads on mount
- Theme persists in localStorage
- No console errors

---

### Step 16: Add Database Schema for Theme Preference

**Files to create:**
- `migrations/add-theme-preference.sql` (if using Supabase migrations)

**Implementation details:**
```sql
-- Add theme_preference column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'glassmorphism';

-- Add check constraint to validate theme IDs
ALTER TABLE user_profiles
ADD CONSTRAINT valid_theme_preference
CHECK (theme_preference IN (
  'glassmorphism',
  'retro-8bit',
  'neon-cyberpunk',
  'minimalist-flat',
  'brutalist',
  'isometric-3d',
  'hand-drawn',
  'nature-organic',
  'terminal-hacker',
  'liquid-morphing'
));
```

Or if manually updating Supabase:
1. Go to Supabase dashboard
2. Navigate to user_profiles table
3. Add column: `theme_preference` (text, default: 'glassmorphism')

**Test:**
- Verify column exists in database
- Test saving theme to profile via themeService

**Verify:**
- Column exists
- Constraint works (invalid themes rejected)

---

### Step 17: Apply Theme to UI Components (Beyond Canvas)

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` — Apply theme colors/typography
- `packages/web/src/components/MainMenu.tsx` — Use theme typography/colors
- `packages/web/src/components/PostMatchScreen.tsx` — Apply theme
- `packages/web/src/App.tsx` — Set body background from theme

**Implementation details:**
In each component, replace hardcoded colors with theme values:

Example for MainMenu (line 40-50):
```typescript
const { theme } = useTheme();

return (
  <div style={{
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
    // ... other styles
  }}>
```

In App.tsx, add effect to set CSS variables:
```typescript
useEffect(() => {
  if (theme.cssVars) {
    Object.entries(theme.cssVars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }
  document.body.style.backgroundColor = theme.colors.background;
  document.body.style.color = theme.colors.text;
  document.body.style.fontFamily = theme.typography.fontFamily;
}, [theme]);
```

**Test:**
- Visual test: Switch themes, verify UI updates

**Verify:**
- All major UI elements respect theme
- Typography changes visible
- Color scheme consistent

---

### Step 18: Comprehensive Testing and Polish

**Files to create:**
- `packages/web/src/__tests__/themeIntegration.test.tsx` — Integration tests

**Implementation details:**
Test complete flow:
```typescript
describe('Theme System Integration', () => {
  it('should load default theme on first visit', async () => {
    // Test getCurrentThemeId returns default
  });

  it('should persist theme selection to localStorage', async () => {
    // Test applyTheme saves to localStorage
  });

  it('should persist theme selection to profile', async () => {
    // Test applyTheme saves to Supabase
  });

  it('should render all 10 themes without errors', () => {
    // Render each theme, check for console errors
  });

  it('should switch themes mid-game without breaking state', () => {
    // Start game, switch theme, verify game continues
  });
});
```

Manual tests per spec:
- Scenario 1: Theme selection (spec line 663-670)
- Scenario 2: Mid-game theme change (spec line 672-679)
- Scenario 3: Theme consistency (spec line 681-687)
- Scenario 4: Theme preview (spec line 689-695)
- Scenario 5: Mobile responsiveness (spec line 697-703)

**Test:**
- Run all tests: `pnpm --filter web test`
- Run build: `pnpm --filter web build`
- Manual testing in browser

**Verify:**
- All automated tests pass
- Build succeeds with no errors
- All manual scenarios work
- Performance acceptable (theme switch <100ms)

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| Theme interface defined (spec line 181-329) | Step 1 |
| 10 themes implemented | Steps 2-6 |
| Theme registry and getTheme() | Step 7 |
| Theme selection UI | Steps 11-12 |
| Theme preview thumbnails | Step 13 |
| Theme selector in settings/menu | Step 14 |
| Theme persists to localStorage | Step 9 |
| Theme persists to Supabase profile | Steps 9, 16 |
| Theme applies to canvas (renderBlock) | Steps 2-6, 8 |
| Theme applies to UI elements | Step 17 |
| Mid-game theme switching works | Step 18 (test) |
| Theme consistency across screens | Step 17 |
| Build succeeds | Step 18 |
| Tests pass | Steps 1-18 (individual tests) |

## Build/Test Commands

- **Install dependencies**: `pnpm install`
- **Type check**: `pnpm --filter web type-check`
- **Run tests**: `pnpm --filter web test`
- **Run specific test**: `pnpm --filter web test <filename>`
- **Build web**: `pnpm --filter web build`
- **Build all**: `pnpm build:all`
- **Dev mode**: `pnpm dev`
- **Test in browser**: Navigate to `http://localhost:5173`

## Notes

- Steps 1-7 are foundation (types, themes, registry)
- Steps 8-10 are infrastructure (rendering, persistence, context)
- Steps 11-15 are UI (components, integration)
- Steps 16-17 are polish (database, full UI theming)
- Step 18 is validation (comprehensive testing)

- Can skip Step 10 (ThemeContext) if prefer props, but context is cleaner
- Step 16 (database) can be done later if Supabase access not available
- Prioritize getting 10 themes working over UI polish
- Sound files (theme.sounds) can use placeholders initially
