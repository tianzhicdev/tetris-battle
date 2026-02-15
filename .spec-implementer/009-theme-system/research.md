# Research Summary for Theme System (Spec 009)

## Project Structure

- **Monorepo**: Yes, using pnpm workspaces
- **Packages**: `web` (React client), `partykit` (WebSocket server), `game-core` (shared logic)
- **Build**: Vite (web package), `pnpm --filter web build` or `pnpm build:all`
- **Tests**: Vitest, `pnpm --filter web test`
- **Dev**: `pnpm dev` (starts Vite dev server)

## Existing Patterns

### Imports
```typescript
// Relative imports for local files
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import { useGameStore } from '../stores/gameStore';

// Workspace imports for shared code
import type { GameState, Tetromino } from '@tetris-battle/game-core';
import { createInitialGameState } from '@tetris-battle/game-core';

// Named exports preferred over default exports
export function MyComponent() { }
export interface MyInterface { }
```

### State Management (Zustand)
```typescript
// stores/gameStore.ts pattern
import { create } from 'zustand';

interface GameStore {
  gameState: GameState;
  // ... state fields
  initGame: () => void;
  // ... actions
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialGameState(),
  // ... initial state

  initGame: () => {
    set({ gameState: createInitialGameState() });
  },
  // ... action implementations using set() and get()
}));
```

### Components
```typescript
// Functional components with TypeScript interfaces
interface MyComponentProps {
  onExit: () => void;
  theme: Theme;
  profile: UserProfile;
}

export function MyComponent({ onExit, theme, profile }: MyComponentProps) {
  const [state, setState] = useState<Type>(initialValue);
  const store = useStore(); // Zustand hooks

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  return (
    <div style={{ ...inlineStyles }}>
      {/* JSX */}
    </div>
  );
}
```

**Styling approach**: Mix of:
- Inline styles with theme values: `style={{ backgroundColor: theme.backgroundColor }}`
- CSS classes from `styles/glassmorphism.css`: `className="glass-panel"`
- Utility functions from `styles/glassUtils.ts`: `style={mergeGlass(glassBlue(), { padding: '20px' })}`

### Existing Theme System

**Current Implementation** (`packages/web/src/themes.ts`):
```typescript
interface Theme {
  name: string;
  colors: Record<TetrominoType, string>; // Piece colors
  backgroundColor: string;
  gridColor: string;
  textColor: string;
  uiBackgroundColor: string;
  renderBlock: (ctx: CanvasRenderingContext2D, x, y, size, type) => void;
}

// Three themes already exist:
const classicTheme: Theme = { /* ... */ };
const retroTheme: Theme = { /* ... */ };
const glassTheme: Theme = { /* ... */ };

export const THEMES: Theme[] = [classicTheme, retroTheme, glassTheme];
export const DEFAULT_THEME = glassTheme;
```

**Theme usage in App.tsx**:
```typescript
const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);

// Passed down as props to components
<MainMenu theme={currentTheme} />
<TetrisGame currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
<ServerAuthMultiplayerGame theme={currentTheme} />
```

**Theme usage in TetrisRenderer**:
```typescript
class TetrisRenderer {
  private theme: Theme;

  constructor(canvas, blockSize, theme?) {
    this.theme = theme || DEFAULT_THEME;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  drawBoard(board: Board): void {
    // Uses theme.renderBlock() to draw each cell
    this.theme.renderBlock(this.ctx, x, y, this.blockSize, cell);
  }
}
```

### Database (Supabase)
Not directly relevant to theme system. User profiles stored in Supabase:
```typescript
// lib/supabase.ts pattern
interface UserProfile {
  userId: string;
  username: string;
  coins: number;
  matchmakingRating: number;
  // ... other fields
}
```

Could potentially add `themePreference: string` field to user profile for persistence.

### Tests
```typescript
// __tests__/myComponent.test.ts pattern
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const result = render(<MyComponent />);
    expect(result).toBeTruthy();
  });
});
```

Tests use Vitest (Jest-compatible API). Current test count: 30+ passing tests in web package.

## Analogous Flow: Theme Selection & Application

**Current flow (basic):**
1. App.tsx maintains `currentTheme` state (useState)
2. Theme passed as prop to child components
3. Components apply theme via inline styles or TetrisRenderer

**No UI for theme selection exists yet** - this is the core feature to build.

**Similar pattern to trace**: Ability loadout selection (from AbilityShop/LoadoutManager):
1. User opens shop/loadout UI
2. UI shows grid of available items (abilities)
3. User selects items (click to toggle)
4. Selection saved to store (abilityStore.setLoadout())
5. Selection persisted to database (via Supabase)
6. Store value used throughout game

**Theme system should follow similar pattern**:
1. Settings/Profile page shows theme selector UI
2. Grid of theme cards with previews
3. Click theme to select
4. Save to localStorage + Supabase user profile
5. Apply theme immediately (update App.tsx state)
6. All components react to theme change

## Integration Points

### Files that need modification:

1. **packages/web/src/themes.ts** (EXPAND)
   - Line 4-18: Expand `Theme` interface to match spec
   - Line 20-185: Keep existing themes, refactor to new structure
   - Add 7 new theme definitions (spec requires 10 total, we have 3)

2. **packages/web/src/App.tsx** (MINOR CHANGES)
   - Line 29: Keep `currentTheme` state
   - Line 10: Import `getThemeByName` or theme registry
   - Add effect to load theme from localStorage/profile on mount
   - Pass theme to new components that need it

3. **packages/web/src/renderer/TetrisRenderer.ts** (MINOR CHANGES)
   - Line 28-30: Keep `setTheme()` method
   - May need to handle new block rendering styles (isometric, ASCII, etc.)

4. **packages/web/src/components/TetrisGame.tsx** (NO CHANGES)
   - Already accepts `currentTheme` and `onThemeChange` props
   - Already passes theme to TetrisRenderer

5. **packages/web/src/components/ServerAuthMultiplayerGame.tsx** (NO CHANGES)
   - Already accepts `theme` prop (line 35)
   - Would need to apply theme to UI elements (currently mostly uses glass utils)

6. **packages/web/src/components/MainMenu.tsx** (MODERATE CHANGES)
   - Line 40-50: Apply theme.backgroundColor, theme.textColor
   - Add "Theme" button to open theme selector modal
   - Import and render ThemeSelector component

7. **packages/web/src/styles/glassmorphism.css** (KEEP AS-IS)
   - Current glassmorphism styles work for "Glass" theme
   - Other themes won't use these classes (different visual styles)

8. **packages/web/src/lib/supabase.ts** or create new service
   - Add function to save/load theme preference from user profile
   - May need database migration to add `theme_preference` column

### Files to create:

1. **packages/web/src/themes/** (NEW DIRECTORY)
   - `index.ts` - Theme registry, exports all themes
   - `types.ts` - Theme interface and related types
   - `glassmorphism.ts` - Refactored glass theme
   - `retro8bit.ts` - Retro 8-bit theme
   - `neonCyberpunk.ts` - Neon cyberpunk theme
   - `minimalistFlat.ts` - Minimalist flat theme
   - `brutalist.ts` - Brutalist theme
   - `isometric3d.ts` - Isometric 3D theme
   - `handDrawn.ts` - Hand-drawn/sketch theme
   - `natureOrganic.ts` - Nature/organic theme
   - `terminalHacker.ts` - Terminal/hacker theme
   - `liquidMorphing.ts` - Liquid/morphing theme

2. **packages/web/src/components/ThemeSelector.tsx** (NEW)
   - Theme grid/carousel UI
   - Theme card components with previews
   - Theme selection logic

3. **packages/web/src/components/ThemePreview.tsx** (NEW)
   - Mini Tetris board preview for each theme
   - Shows sample blocks in theme style

4. **packages/web/src/contexts/ThemeContext.tsx** (NEW - OPTIONAL)
   - React context for theme state (alternative to props drilling)
   - ThemeProvider wrapper component
   - useTheme() hook for consuming theme in any component

5. **packages/web/src/services/themeService.ts** (NEW)
   - Functions to save/load theme from localStorage
   - Functions to save/load theme from Supabase
   - Theme validation helpers

6. **packages/web/src/__tests__/themeSystem.test.ts** (NEW)
   - Unit tests for theme definitions
   - Tests for ThemeSelector component
   - Tests for theme persistence

## Key Files to Reference During Implementation

### Phase 1 (Foundation):
- `packages/web/src/themes.ts` - Current theme structure to refactor
- `packages/web/src/renderer/TetrisRenderer.ts` - How themes are used in rendering
- `packages/web/src/App.tsx` - Theme state management

### Phase 2 (Theme Definitions):
- `packages/game-core/src/types.ts` - TetrominoType and other core types
- `packages/web/src/themes.ts` - Existing theme renderBlock implementations
- `packages/web/src/styles/glassmorphism.css` - Glass theme styling reference

### Phase 3 (UI Components):
- `packages/web/src/components/AbilityShop.tsx` - Grid layout pattern
- `packages/web/src/components/LoadoutManager.tsx` - Item selection pattern
- `packages/web/src/components/ProfilePage.tsx` - Settings UI pattern
- `packages/web/src/styles/glassUtils.ts` - Styling utilities

### Phase 4 (Persistence):
- `packages/web/src/lib/supabase.ts` - Database service patterns
- `packages/web/src/stores/abilityStore.ts` - Zustand store pattern
- `packages/web/src/services/friendService.ts` - Service layer pattern

## Current Theme Architecture Assessment

**Strengths:**
- Simple interface, easy to understand
- Custom renderBlock() function allows full control
- Canvas-based rendering is performant
- Already supports multiple themes (3 exist)

**Limitations:**
- Theme interface is too minimal for spec requirements
- No typography configuration
- No particle system configuration
- No sound configuration
- No CSS/UI theming (only canvas blocks)
- No theme selection UI
- No persistence

**Refactoring needed:**
1. Expand Theme interface to include all spec properties
2. Split canvas rendering (renderBlock) from UI styling
3. Add theme metadata (name, description, category)
4. Create theme registry system
5. Build theme selection UI
6. Implement theme persistence

## Proposed Architecture

### Theme Structure (New):
```typescript
interface Theme {
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

  // Rendering
  renderBlock: (ctx, x, y, size, type) => void;

  // CSS variables for UI (optional)
  cssVars?: Record<string, string>;
}
```

### Theme Registry:
```typescript
// themes/index.ts
export const THEME_REGISTRY: Record<string, Theme> = {
  'glassmorphism': glassmorphismTheme,
  'retro-8bit': retro8bitTheme,
  // ... all 10 themes
};

export function getTheme(id: string): Theme {
  return THEME_REGISTRY[id] || THEME_REGISTRY['glassmorphism'];
}

export const THEME_CATEGORIES = {
  retro: ['retro-8bit', 'terminal-hacker'],
  modern: ['glassmorphism', 'minimalist-flat', 'neon-cyberpunk'],
  artistic: ['hand-drawn', 'nature-organic', 'liquid-morphing'],
  technical: ['brutalist', 'isometric-3d'],
};
```

### Context vs Props:
**Recommendation**: Use Context + Store hybrid
- Create ThemeContext for easy access
- Store theme state in localStorage + App.tsx
- Provide `useTheme()` hook for components
- Avoid props drilling through many levels

## Performance Considerations

1. **Canvas rendering**: Existing renderBlock() pattern is efficient
2. **CSS themes**: Use CSS variables for dynamic theming where possible
3. **Asset loading**: Lazy-load theme-specific assets (fonts, textures, sounds)
4. **Theme switching**: Should be instant for canvas themes, may need transition for UI
5. **Mobile**: Some themes (blur-heavy) may need mobile-optimized variants

## Notes

- Spec asks for 10 themes, 3 already exist (Classic, Retro, Glass)
- Need to implement 7 new themes
- "Retro" theme exists but may need enhancement to match "Retro 8-bit" spec
- "Glass" theme exists and closely matches "Glassmorphism" spec
- Classic theme can stay as-is or be phased out
- Priority order: Complete foundation → Implement all 10 themes → Build UI → Add persistence
- Can reuse glass utilities (`glassUtils.ts`) for glassmorphism theme
- Consider using CSS custom properties for theme colors applied to UI elements
