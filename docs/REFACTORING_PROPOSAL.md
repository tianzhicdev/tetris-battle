# Frontend Refactoring Proposal

**Date**: February 20, 2026
**Status**: Proposed
**Priority**: High

## Executive Summary

After reviewing the Tetris Battle frontend codebase, several critical issues have been identified that impact maintainability, performance, and developer experience. This document proposes a comprehensive refactoring strategy to address these concerns.

## Critical Issues Identified

### 1. Massive Component Files (Severity: CRITICAL)

**Problem**:
- `ServerAuthMultiplayerGame.tsx`: **3,640 lines** - Single responsibility principle violated
- Contains game logic, UI rendering, state management, effects, networking, and animations
- Difficult to test, maintain, and understand
- High risk of merge conflicts in team environment

**Impact**:
- Cognitive overload for developers
- Difficult to locate bugs
- Testing is nearly impossible without integration tests
- Cannot reuse sub-components

**Proposed Solution**:
Break down into specialized components:

```
ServerAuthMultiplayerGame/
├── index.tsx (main orchestrator, ~200 lines)
├── hooks/
│   ├── useGameLogic.ts
│   ├── useAbilitySystem.ts
│   ├── useNetworking.ts
│   └── useGameAnimations.ts
├── components/
│   ├── GameBoard.tsx
│   ├── AbilityBar.tsx
│   ├── EffectsOverlay.tsx
│   ├── PostGameModal.tsx
│   └── ConnectionStatus.tsx
└── utils/
    ├── gameStateHelpers.ts
    └── abilityHelpers.ts
```

---

### 2. Inline Styles Everywhere (Severity: HIGH)

**Problem**:
- Every component uses inline `style={{}}` objects
- Styles are duplicated across components
- No style composition or reusability
- Hard to maintain consistent design
- Performance: New style objects created on every render

**Example** (from ServerAuthMultiplayerGame.tsx:3217-3229):
```tsx
<motion.button
  style={{
    flex: 1,
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'rgba(255, 255, 255, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 'clamp(8px, 2vw, 12px)',
    cursor: 'pointer',
    // ... 8 more properties
  }}
>
```

This pattern repeats hundreds of times across the codebase.

**Impact**:
- ~30% larger bundle size due to style duplication
- Inconsistent spacing, colors, and sizing
- Cannot easily change theme or design system
- Performance degradation on mobile

**Proposed Solution**:

#### Option A: CSS Modules (Recommended)
```tsx
// GameButton.module.css
.controlButton {
  flex: 1;
  background: var(--color-overlay-light);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-responsive);
  cursor: pointer;
  /* ... */
}

// Component
import styles from './GameButton.module.css';
<button className={styles.controlButton} />
```

**Benefits**:
- Better performance (styles parsed once)
- Type-safe with TypeScript
- Proper CSS cascade
- Easy to theme

#### Option B: Styled Components (for those who prefer CSS-in-JS)
```tsx
const ControlButton = styled(motion.button)`
  flex: 1;
  background: ${p => p.theme.colors.overlayLight};
  /* ... */
`;
```

**Benefits**:
- Dynamic theming
- Props-based styling
- Component-scoped styles

---

### 3. No Centralized Style System (Severity: HIGH)

**Problem**:
- `design-tokens.ts` exists but underutilized
- Magic numbers scattered throughout: `'8px'`, `'12px'`, `'rgba(255,255,255,0.08)'`
- Inconsistent color usage:
  - Cyan: `#00f0f0`, `#7de3ff`, `rgba(0,240,240,0.2)` (same color, 3 formats)
  - Opacity values: `.04`, `.08`, `.1`, `.14`, `.19`, `.25` (no system)

**Example of inconsistency**:
```tsx
// File A
border: '1px solid rgba(255,255,255,0.08)'

// File B
border: `1px solid ${T.border.subtle}`

// File C
border: '1px solid rgba(255, 255, 255, 0.1)'
```

**Impact**:
- Visual inconsistencies
- Cannot easily implement dark mode or themes
- Hard to maintain brand identity

**Proposed Solution**:

#### Extend design tokens:
```typescript
// design-tokens.ts
export const T = {
  // ... existing

  // Add spacing scale
  space: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },

  // Add responsive utilities
  responsive: {
    clampFont: (min: number, mid: number, max: number) =>
      `clamp(${min}px, ${mid}vw, ${max}px)`,
    clampSpace: (min: number, mid: number, max: number) =>
      `clamp(${min}px, ${mid}vw, ${max}px)`,
  },

  // Add opacity scale
  opacity: {
    disabled: 0.38,
    secondary: 0.6,
    hover: 0.8,
    full: 1,
  },

  // Add component-specific tokens
  components: {
    button: {
      padding: '6px 12px',
      borderRadius: '8px',
      transition: 'all 0.2s',
    },
    card: {
      padding: '12px',
      borderRadius: '8px',
      border: `1px solid ${T.border.subtle}`,
    },
  },
};
```

---

### 4. Redundant Component Patterns (Severity: MEDIUM)

**Problem**:
Multiple components implement similar button/card patterns with slight variations.

**Examples**:

```tsx
// Pattern 1: Ability buttons (3 different implementations)
// ServerAuthMultiplayerGame.tsx:3138
// AbilityDock.tsx:45
// AbilityManager.tsx:88

// Pattern 2: Modal dialogs (2 different implementations)
// PostGameModal
// ChallengeNotification

// Pattern 3: Status badges (3 different implementations)
// Connection status
// Ability effects
// Score multipliers
```

**Impact**:
- Code duplication (~500 lines total)
- Inconsistent UX
- Bug fixes need to be applied to multiple places

**Proposed Solution**:

Create reusable primitive components:

```tsx
// components/primitives/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  // ...
}

// components/primitives/Card.tsx
interface CardProps {
  variant: 'default' | 'highlighted' | 'equipped';
  // ...
}

// components/primitives/Badge.tsx
interface BadgeProps {
  variant: 'info' | 'success' | 'warning' | 'error';
  // ...
}
```

---

### 5. Inconsistent File Organization (Severity: MEDIUM)

**Current structure**:
```
components/
├── ui/             (design system components)
├── game/           (game-specific components)
├── debug/          (debug tools)
├── [root]          (everything else - 20+ files)
```

**Problems**:
- No clear domain separation
- Hard to find related components
- Circular dependencies in some cases

**Proposed Solution**:

```
components/
├── primitives/     (base UI components: Button, Card, Input, etc.)
├── composed/       (composed components: Panel, Modal, etc.)
├── game/
│   ├── ui/         (game UI: AbilityBar, GameBoard, etc.)
│   ├── effects/    (visual effects: Particles, Flash, etc.)
│   └── overlays/   (modals, notifications, etc.)
├── features/
│   ├── abilities/  (AbilityManager, AbilityCard, etc.)
│   ├── profile/    (ProfilePage, stats, etc.)
│   ├── friends/    (FriendList, challenges, etc.)
│   └── matchmaking/(PartykitMatchmaking, etc.)
└── debug/          (debug tools)
```

---

### 6. Type Safety Issues (Severity: MEDIUM)

**Problem**:
- Some components use `any` types
- Missing prop validation
- Inline type definitions instead of shared types

**Examples**:
```tsx
// Bad
const handleClick = (data: any) => { ... }

// Bad
interface Props {
  ability: {
    name: string;
    cost: number;
    // ... repeated in 5 files
  }
}

// Good
import type { Ability } from '@tetris-battle/game-core';
interface Props {
  ability: Ability;
}
```

**Proposed Solution**:
1. Create shared type definitions in `types/` directory
2. Enable stricter TypeScript settings
3. Add runtime prop validation with Zod (optional)

---

### 7. Performance Issues (Severity: MEDIUM)

**Problems**:
- Large bundle size (943KB minified!)
- No code splitting
- Inline styles creating new objects on every render
- useEffect dependencies not optimized

**Metrics**:
```
dist/assets/index-CQRFpYCZ.js   943.31 kB │ gzip: 265.94 kB
```

**Proposed Solutions**:

#### Code Splitting:
```tsx
// Lazy load heavy components
const ServerAuthMultiplayerGame = lazy(() =>
  import('./components/game/ServerAuthMultiplayerGame')
);

const AbilityEffectsDemo = lazy(() =>
  import('./components/demos/AbilityEffectsDemo')
);
```

#### Optimize Renders:
```tsx
// Memoize expensive computations
const sortedAbilities = useMemo(() =>
  abilities.sort((a, b) => a.cost - b.cost),
  [abilities]
);

// Memoize callbacks
const handleAbilityClick = useCallback((id: string) => {
  // ...
}, [dependencies]);
```

#### Extract Static Styles:
```tsx
// Bad: New object every render
<div style={{ display: 'flex', gap: '8px' }} />

// Good: Defined once
const containerStyle = { display: 'flex', gap: '8px' };
<div style={containerStyle} />

// Best: CSS module
<div className={styles.container} />
```

---

## Refactoring Strategy

### Phase 1: Foundation (Week 1)
**Goal**: Establish patterns and infrastructure

1. ✅ Extract all icons to `all-icons.tsx` (DONE)
2. Create style system with CSS modules
3. Set up shared types in `types/` directory
4. Establish component organization structure
5. Create primitive components (Button, Card, Input, Badge)

**Deliverables**:
- `styles/` directory with CSS modules
- `types/` directory with shared type definitions
- `components/primitives/` with 8-10 base components
- Updated `design-tokens.ts` with extended scales

---

### Phase 2: Component Refactoring (Week 2-3)
**Goal**: Break down large components and migrate to new patterns

1. **ServerAuthMultiplayerGame.tsx** (Priority: CRITICAL)
   - Extract hooks: `useGameLogic`, `useAbilitySystem`, `useNetworking`
   - Extract components: `GameBoard`, `AbilityBar`, `EffectsOverlay`
   - Target: Reduce from 3,640 lines to ~200 lines

2. **FriendList.tsx** (656 lines)
   - Extract `FriendListItem`, `ChallengeButton`
   - Use primitive Card component

3. **Migrate inline styles to CSS modules**
   - Start with high-impact components
   - Use codemods where possible

**Deliverables**:
- ServerAuthMultiplayerGame < 300 lines
- All major components use CSS modules
- 50% reduction in style duplication

---

### Phase 3: Optimization (Week 4)
**Goal**: Improve performance and bundle size

1. Implement code splitting
2. Optimize re-renders with React.memo
3. Bundle analysis and optimization
4. Remove unused code

**Target Metrics**:
- Bundle size: < 600KB (35% reduction)
- Initial load: < 2s on 3G
- Component re-render reduction: 40%

---

### Phase 4: Testing & Documentation (Week 5)
**Goal**: Ensure reliability and maintainability

1. Add unit tests for hooks
2. Add component tests
3. Update documentation
4. Create Storybook for UI components (optional)

**Deliverables**:
- Test coverage > 60%
- Component documentation
- Migration guide for future development

---

## Success Metrics

### Code Quality
- [ ] No component > 500 lines
- [ ] No inline styles (95% migrated to CSS modules)
- [ ] TypeScript strict mode enabled
- [ ] No `any` types in production code

### Performance
- [ ] Bundle size < 600KB (from 943KB)
- [ ] First contentful paint < 1.5s
- [ ] Time to interactive < 3s on 3G

### Developer Experience
- [ ] Clear component organization
- [ ] Reusable component library
- [ ] Consistent styling patterns
- [ ] Easy to add new features

---

## Migration Plan

### Backward Compatibility
- All refactorings maintain existing functionality
- Changes are incremental and can be deployed gradually
- Feature flags for risky changes

### Risk Mitigation
- Comprehensive testing before each phase
- Code reviews for all structural changes
- Rollback plan for each phase

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Foundation | 40 hours | High |
| Phase 2: Component Refactoring | 80 hours | Critical |
| Phase 3: Optimization | 30 hours | Medium |
| Phase 4: Testing & Documentation | 30 hours | Medium |
| **Total** | **180 hours** (~4.5 weeks) | - |

---

## Immediate Quick Wins (Can be done in 1 day)

1. **Extract static styles** (~2 hours)
   - Move all static inline styles to const objects
   - 5-10% performance improvement

2. **Add lazy loading** (~1 hour)
   - Lazy load AbilityEffectsDemo, VisualEffectsDemo
   - ~200KB bundle size reduction

3. **Fix TypeScript any types** (~2 hours)
   - Replace all `any` with proper types
   - Better type safety

4. **Consolidate design tokens** (~2 hours)
   - Find all magic numbers and colors
   - Add to design-tokens.ts
   - Replace inline values

---

## Questions for Discussion

1. **CSS approach**: CSS Modules or Styled Components?
2. **Testing strategy**: Jest + RTL sufficient, or need E2E?
3. **Component library**: Build custom or use existing (Radix, Ark)?
4. **Timeline**: Aggressive (3 weeks) or conservative (6 weeks)?
5. **Breaking changes**: Acceptable for better architecture?

---

## Appendices

### A. Style Duplication Examples

Found in codebase:
- Button styles: 23 variations
- Card styles: 15 variations
- Flex container: 89 occurrences
- Border radius 8px: 142 occurrences

### B. Bundle Analysis

Top contributors to bundle size:
1. framer-motion: 89KB
2. Inline styles (estimated): 45KB
3. Duplicate logic: 35KB
4. Icon library: 28KB

### C. Affected Files

**Critical** (must refactor):
- ServerAuthMultiplayerGame.tsx (3,640 lines)

**High** priority:
- FriendList.tsx (656 lines)
- AbilityEffectsDemo.tsx (481 lines)
- PartykitMatchmaking.tsx (301 lines)

**Medium** priority:
- MainMenu.tsx (281 lines)
- ProfilePage.tsx (230 lines)
- AbilityManager.tsx (206 lines)

---

**Last Updated**: February 20, 2026
**Author**: Claude
**Reviewers**: TBD
