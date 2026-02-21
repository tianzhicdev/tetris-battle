# Research Summary for Frontend Refactoring

## Project Structure

- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React frontend (main focus of refactoring)
  - `packages/game-core` - Shared game logic
  - `packages/partykit` - Multiplayer server
- **Build**: Vite + TypeScript
  - Command: `pnpm --filter web build`
  - Output: Single bundle ~943KB (265KB gzipped) - **NEEDS OPTIMIZATION**
  - Warning: Chunks larger than 500KB, suggests code splitting needed
- **Tests**: Vitest
  - Command: `pnpm --filter web test`
  - Most tests passing (1 theme test failing, unrelated to refactoring)
  - Test framework: Vitest with vi.mock() for mocking

## Existing Patterns

### Imports

The project uses:
- **Relative imports** for local files: `import { T } from '../../design-tokens'`
- **Workspace imports** for shared packages: `import { ABILITIES } from '@tetris-battle/game-core'`
- **Type imports** with `type` keyword: `import type { UserProfile } from '@tetris-battle/game-core'`

Example from Panel.tsx:
```tsx
import type { ReactNode } from 'react';
import { T } from '../../design-tokens';
```

### State Management

**Zustand stores** with separation of concerns:
- `stores/gameStore.ts` - Game state (legacy client-auth mode)
- `stores/friendStore.ts` - Friend & challenge state
- `stores/abilityStore.ts` - Ability unlocks and loadout
- `stores/debugStore.ts` - Debug panel state

Store pattern (from friendStore.ts):
```tsx
export const useFriendStore = create<FriendStore>((set) => ({
  friends: [],
  pendingRequests: [],
  // ... state
  loadFriends: async (userId) => {
    set({ friendsLoading: true });
    const result = await friendService.getFriendList(userId);
    set({ friends: result, friendsLoading: false });
  },
  // ... actions
}));
```

### Components

**Functional components** with hooks:
- All components use function declarations: `export function ComponentName()`
- Hooks: `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`
- Animation: `framer-motion` for animations
- Type safety: Interface props with TypeScript

Example component structure:
```tsx
interface PanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
}

export function Panel({ title, onClose, children, width = 480 }: PanelProps) {
  // Component logic
  return <div style={{ /* inline styles */ }}>...</div>;
}
```

### Current Styling Approach

**100% INLINE STYLES** - This is the core problem!

Three styling utilities exist but are underutilized:

1. **design-tokens.ts** - Centralized design tokens (EXISTS but underutilized)
   ```tsx
   export const T = {
     bg: { deep, panel, card, button, ... },
     border: { subtle, medium, accent, ... },
     text: { primary, secondary, tertiary, ... },
     accent: { cyan, purple, green, red, ... },
     font: { display, body, chinese, mono },
     radius: { sm: 4, md: 8, lg: 12, xl: 16 },
     glow: (color, intensity) => `...`,
     panelGlow: "...",
   }
   ```

2. **styles/glassUtils.ts** - Glassmorphism utility functions (CSSProperties objects)
   - `glassStyle()`, `glassDark()`, `glassBlue()`, `glassPurple()`, `glassGold()`
   - `glassDanger()`, `glassSuccess()`, `glassPanel()`, `glassModal()`
   - `mergeGlass()` to combine with custom styles
   - Used in FriendList.tsx but not widely adopted

3. **utils/animations.ts** - Framer Motion variants
   - `buttonVariants`, `springs`, `scoreVariants`, `overlayVariants`, `modalVariants`

**Current inline style pattern** (Panel.tsx example):
```tsx
<div
  style={{
    width,
    maxWidth: '95vw',
    background: T.bg.panel,
    backdropFilter: 'blur(20px)',
    borderRadius: `${T.radius.xl}px`,
    border: `1px solid ${T.border.accent}`,
    boxShadow: T.panelGlow,
    overflow: 'hidden',
  }}
>
```

**Problems identified**:
- 105 inline style instances in ServerAuthMultiplayerGame.tsx alone
- New style objects created on every render (performance issue)
- No reusability across components
- Inconsistent spacing, colors, opacity values
- Hard to maintain and theme

### Tests

**Vitest** with standard patterns:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/friendService', () => ({
  friendService: { ... }
}));

describe('FriendStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFriendStore.setState({ /* reset */ });
  });

  it('loads friends and sets state', async () => {
    const mockFriends = [{ ... }];
    mockFriendService.getFriendList.mockResolvedValue(mockFriends);

    await useFriendStore.getState().loadFriends('u1');

    expect(mockFriendService.getFriendList).toHaveBeenCalledWith('u1');
    expect(useFriendStore.getState().friends).toEqual(mockFriends);
  });
});
```

## Component Organization Analysis

### Current Structure (MESSY)

```
components/
├── ui/             (12 files - design system components)
│   ├── all-icons.tsx (39KB - centralized icons, DONE)
│   ├── PrimaryButton.tsx, ControlButton.tsx, SkillButton.tsx
│   ├── Panel.tsx, Input.tsx, Label.tsx
│   ├── Icon.tsx, CoinsBadge.tsx, StatBadge.tsx, MatchRow.tsx
│   └── Tabs.tsx
├── game/           (6 files - game-specific components)
│   ├── AbilityDock.tsx, GameHeader.tsx, GameTouchControls.tsx
│   ├── MobileGameLayout.tsx, NextPieceQueue.tsx, OpponentPreview.tsx
├── debug/          (5 files - debug tools)
│   ├── DebugPanel.tsx, EventsLog.tsx, NetworkStats.tsx
│   ├── AbilityTriggers.tsx, GameStateInspector.tsx
└── [root]          (20+ files - EVERYTHING ELSE, UNORGANIZED)
    ├── ServerAuthMultiplayerGame.tsx (3,640 lines - CRITICAL!)
    ├── FriendList.tsx (656 lines)
    ├── AbilityEffectsDemo.tsx (481 lines)
    ├── PartykitMatchmaking.tsx (301 lines)
    ├── MainMenu.tsx, ProfilePage.tsx, AbilityManager.tsx
    ├── AbilityCard.tsx, AbilityCarousel.tsx, AbilityCopy.tsx
    ├── ChallengeNotification.tsx, ChallengeWaiting.tsx
    ├── PostMatchScreen.tsx, UsernameSetup.tsx, AuthWrapper.tsx
    ├── TetrisGame.tsx, NextPiecePanel.tsx, TouchControls.tsx
    ├── ParticleEffect.tsx, FlashOverlay.tsx, CyberpunkParticles.tsx
    ├── FloatingBackground.tsx, ThemeCard.tsx, ThemePreview.tsx
    └── VisualEffectsDemo.tsx, TetriminoBgPreview.tsx, Notification.tsx
```

**Key Problems**:
- No domain separation (game, abilities, friends, profile all mixed)
- ServerAuthMultiplayerGame.tsx is 3,640 lines (should be <300)
- Duplicate button patterns (3 different button components in ui/)
- No clear hierarchy or discoverability

### File Size Analysis

**Critical** (>1000 lines):
- ServerAuthMultiplayerGame.tsx: 3,640 lines ❌

**High Priority** (>500 lines):
- FriendList.tsx: 656 lines ❌
- AbilityEffectsDemo.tsx: 481 lines (close to threshold)

**Medium Priority** (200-500 lines):
- PartykitMatchmaking.tsx: 301 lines
- MainMenu.tsx, ProfilePage.tsx, AbilityManager.tsx

**Well-sized** (<200 lines):
- All ui/ components ✓
- All game/ components ✓
- All debug/ components ✓

## ServerAuthMultiplayerGame.tsx Deep Dive

**Current structure** (3,640 lines):
- Lines 1-100: Imports, types, constants
- Lines 100-300: Helper functions (hexToRgbaColor, getBoardDiff, etc.)
- Lines 300-500: Mock data functions (for demo mode)
- Lines 500-3640: Main component with:
  - 50+ useState hooks
  - 30+ useEffect hooks
  - Game connection logic
  - Ability system logic
  - Rendering logic (board, UI, modals)
  - Animation logic
  - Touch controls logic
  - Post-game modal logic

**What can be extracted**:

1. **Hooks** (custom hooks in hooks/ directory):
   - `useGameConnection` - WebSocket connection, message handling
   - `useAbilitySystem` - Ability activation, effects, cooldowns
   - `useGameAnimations` - Particle effects, screen shake, flash overlays
   - `useBoardRendering` - Canvas rendering, board diff calculations

2. **Components** (separate .tsx files):
   - `GameBoard` - Canvas rendering + board state
   - `AbilityBar` - Already extracted to game/AbilityDock.tsx ✓
   - `EffectsOverlay` - Particles, flash, screen shake container
   - `PostGameModal` - Post-match results and rewards
   - `ConnectionStatus` - Network status indicator
   - `GameControls` - Already extracted to game/GameTouchControls.tsx ✓

3. **Utils** (pure functions):
   - `gameStateHelpers.ts` - getBoardDiff, cloneBoardGrid, etc.
   - `abilityHelpers.ts` - ability validation, targeting logic
   - `mockDataHelpers.ts` - createMockBoard, buildMockTimedEffects

**After refactoring**:
- `ServerAuthMultiplayerGame/index.tsx` - ~200 lines (orchestrator only)
- `ServerAuthMultiplayerGame/hooks/` - 4 custom hooks
- `ServerAuthMultiplayerGame/components/` - 5 sub-components
- `ServerAuthMultiplayerGame/utils/` - 3 utility files

## CSS Modules Integration Plan

**Vite already supports CSS Modules out of the box!** ✓

No additional config needed. Just create `.module.css` files and import:

```tsx
import styles from './Button.module.css';
<button className={styles.primary}>Click me</button>
```

**TypeScript support**:
Vite automatically generates type definitions for CSS modules.

**Design token integration**:
Use CSS variables in `.module.css` files:

```css
/* styles/variables.css */
:root {
  --color-bg-panel: rgba(8, 10, 24, 0.92);
  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-accent-cyan: #00f0f0;
  --radius-md: 8px;
  --font-display: 'Orbitron', sans-serif;
}

/* Button.module.css */
.primary {
  background: var(--color-bg-button);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  color: var(--color-accent-cyan);
  font-family: var(--font-display);
}
```

**Migration strategy**:
1. Create `styles/variables.css` with all design tokens as CSS vars
2. Import in main.tsx: `import './styles/variables.css'`
3. Create primitive component CSS modules (Button, Card, Input, etc.)
4. Gradually migrate components from inline styles to CSS modules
5. Keep design-tokens.ts for programmatic access (e.g., dynamic colors in canvas)

## Integration Points for Refactoring

### Files that will be created:

**Phase 1 - Style System**:
- `styles/variables.css` - CSS variables from design tokens
- `components/primitives/Button/Button.module.css`
- `components/primitives/Button/index.tsx`
- `components/primitives/Card/Card.module.css`
- `components/primitives/Card/index.tsx`
- `components/primitives/Input/Input.module.css`
- `components/primitives/Input/index.tsx`
- `components/primitives/Badge/Badge.module.css`
- `components/primitives/Badge/index.tsx`
- `types/components.ts` - Shared component prop types

**Phase 2 - Component Extraction**:
- `components/game/ServerAuthMultiplayerGame/index.tsx`
- `components/game/ServerAuthMultiplayerGame/hooks/useGameConnection.ts`
- `components/game/ServerAuthMultiplayerGame/hooks/useAbilitySystem.ts`
- `components/game/ServerAuthMultiplayerGame/hooks/useGameAnimations.ts`
- `components/game/ServerAuthMultiplayerGame/hooks/useBoardRendering.ts`
- `components/game/ServerAuthMultiplayerGame/components/GameBoard.tsx`
- `components/game/ServerAuthMultiplayerGame/components/EffectsOverlay.tsx`
- `components/game/ServerAuthMultiplayerGame/components/PostGameModal.tsx`
- `components/game/ServerAuthMultiplayerGame/components/ConnectionStatus.tsx`
- `components/game/ServerAuthMultiplayerGame/utils/gameStateHelpers.ts`
- `components/game/ServerAuthMultiplayerGame/utils/abilityHelpers.ts`

### Files that will be modified:

**Phase 1**:
- `main.tsx` - Add `import './styles/variables.css'`
- `design-tokens.ts` - Add spacing scale, opacity scale, responsive utilities
- Existing ui/ components - Migrate to CSS modules

**Phase 2**:
- `App.tsx` - Update import path for ServerAuthMultiplayerGame
- `FriendList.tsx` - Extract FriendListItem, migrate to CSS modules
- `AbilityEffectsDemo.tsx` - Use primitive components
- `PartykitMatchmaking.tsx` - Use primitive Card component

**Phase 3**:
- `vite.config.ts` - Add code splitting configuration
- Various components - Add React.memo where appropriate

## Key Files to Reference During Implementation

**Style System Reference**:
- `design-tokens.ts` - Source of truth for design values
- `styles/glassUtils.ts` - Glass effect patterns to translate to CSS
- `utils/animations.ts` - Framer Motion variants to keep

**Component Patterns Reference**:
- `components/ui/Panel.tsx` - Good example of using design tokens
- `components/game/GameHeader.tsx` - Clean component structure
- `stores/friendStore.ts` - Zustand store pattern

**Test Patterns Reference**:
- `__tests__/friendStore.test.ts` - Store testing pattern
- `__tests__/friendService.test.ts` - Service testing with mocks

**Build Config Reference**:
- `vite.config.ts` - Vite configuration (minimal, will need updates for code splitting)
- `tsconfig.json` - TypeScript config (strict mode)
- `package.json` - Dependencies and scripts

## Naming Conventions Observed

- **Files**: PascalCase for components (`Panel.tsx`), camelCase for utils (`glassUtils.ts`)
- **Components**: PascalCase function declarations (`export function Panel()`)
- **Types**: PascalCase interfaces (`interface PanelProps`)
- **Constants**: SCREAMING_SNAKE_CASE (`const BOMB_ABILITY_TYPES`)
- **Variables**: camelCase (`const activeTab`)
- **CSS Modules**: camelCase class names (`styles.primary`)

## Performance Baseline

**Current metrics** (from build output):
- Bundle size: 943.26 KB minified (265.93 KB gzipped)
- Build warning: Chunks larger than 500KB
- No code splitting
- No lazy loading

**Target metrics** (from spec):
- Bundle size: < 600KB (35% reduction)
- Code split heavy components (AbilityEffectsDemo, VisualEffectsDemo)
- Lazy load routes

## Migration Risk Assessment

**Low Risk**:
- Creating CSS modules (additive, doesn't break existing)
- Creating primitive components (additive)
- Extracting helper functions to utils/ (no behavior change)

**Medium Risk**:
- Migrating existing components to CSS modules (visual regression risk)
- Breaking down ServerAuthMultiplayerGame (complex, many interdependencies)

**High Risk**:
- None identified (refactoring maintains functionality)

**Mitigation**:
- Test thoroughly after each phase
- Keep inline styles working alongside CSS modules initially
- Use feature flags if needed (already exists: `?debug=true`)
- Comprehensive visual testing before deployment

## Dependencies Analysis

**Current style-related dependencies**:
- `framer-motion` (89KB) - Keep for animations ✓
- No styled-components, no emotion, no tailwind
- React inline styles only

**No additional dependencies needed** for CSS Modules! ✓

## Conclusion

The refactoring is feasible and low-risk. Key insights:

1. **CSS Modules already supported** by Vite - no config needed
2. **Design tokens exist** but need to be exposed as CSS variables
3. **Component structure is good** except for ServerAuthMultiplayerGame
4. **Test framework is solid** - can add tests for new components
5. **Build is simple** - Vite makes everything easy
6. **No breaking changes** - all refactoring maintains functionality

**Biggest win**: Converting 105 inline styles in ServerAuthMultiplayerGame to CSS modules will:
- Reduce bundle size by ~5-10%
- Improve render performance (styles parsed once, not every render)
- Make theming possible (CSS variables can be swapped at runtime)

**Recommended approach**: Incremental migration, Phase 1 first (foundation), then Phase 2 (component refactoring).
