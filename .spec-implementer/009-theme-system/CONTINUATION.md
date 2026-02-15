# Theme System Implementation - Continuation Guide

## Current Status

**Phase 3: Implementation - 7/18 steps completed (39%)**

### ✅ Completed (Steps 1-7):
1. **Theme Type System** - Full TypeScript interfaces matching spec
2. **Glassmorphism Theme** - Refactored from existing code
3. **Retro 8-bit Theme** - NES/Game Boy aesthetic
4. **Neon Cyberpunk Theme** - Tron/vaporwave style
5. **Minimalist Flat Theme** - Clean, modern design
6. **6 Additional Themes**:
   - Brutalist (raw, unpolished)
   - Isometric 3D (faux-3D depth)
   - Hand-drawn (sketch style)
   - Nature Organic (natural materials)
   - Terminal Hacker (green-screen)
   - Liquid Morphing (lava lamp vibes)
7. **Theme Registry** - Central export with backward compatibility

### 📁 Files Created:
- `packages/web/src/themes/types.ts` - Type definitions
- `packages/web/src/themes/index.ts` - Registry & exports
- `packages/web/src/themes/glassmorphism.ts`
- `packages/web/src/themes/retro8bit.ts`
- `packages/web/src/themes/neonCyberpunk.ts`
- `packages/web/src/themes/minimalistFlat.ts`
- `packages/web/src/themes/brutalist.ts`
- `packages/web/src/themes/isometric3d.ts`
- `packages/web/src/themes/handDrawn.ts`
- `packages/web/src/themes/natureOrganic.ts`
- `packages/web/src/themes/terminalHacker.ts`
- `packages/web/src/themes/liquidMorphing.ts`
- `packages/web/src/themes/__tests__/types.test.ts`
- `packages/web/src/themes/__tests__/glassmorphism.test.ts`

### ✅ Verification:
- Build: **PASSING** ✓
- Tests: **12 passing** (4 types + 8 glassmorphism) ✓
- TypeScript: **No errors** ✓

## Next Steps (Remaining 11 Steps)

### Step 8: Update TetrisRenderer (NEXT)
**Priority: MEDIUM** - TetrisRenderer already works with new themes via renderBlock()

The existing TetrisRenderer.ts already supports all themes because:
- Each theme provides its own `renderBlock()` function
- TetrisRenderer just calls `theme.renderBlock()` for each cell
- No changes strictly needed unless adding special rendering modes

**Optional enhancements:**
- Helper methods for isometric projection
- ASCII character rendering
- Performance optimizations

**Action**: Can **skip or defer** this step since themes already render correctly.

---

### Step 9: Create Theme Service ⭐ CRITICAL
**File**: `packages/web/src/services/themeService.ts`

Create service for theme persistence:
```typescript
// Save/load from localStorage
export function saveThemeToLocalStorage(themeId: string): void;
export function loadThemeFromLocalStorage(): string | null;

// Save/load from Supabase
export async function saveThemeToProfile(userId: string, themeId: string): Promise<boolean>;
export async function loadThemeFromProfile(userId: string): Promise<string | null>;

// Combined getter with fallback chain
export async function getCurrentThemeId(userId?: string): Promise<string>;

// Apply and persist
export async function applyTheme(themeId: string, userId?: string): Promise<Theme>;
```

**Test**: Create `__tests__/themeService.test.ts`

---

### Step 10: Create ThemeContext ⭐ CRITICAL
**File**: `packages/web/src/contexts/ThemeContext.tsx`

React context for theme state:
```typescript
interface ThemeContextType {
  theme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
  isLoading: boolean;
}

export function ThemeProvider({ children, userId });
export function useTheme(): ThemeContextType;
```

Loads theme on mount, provides to all components.

---

### Step 11-13: Create UI Components ⭐ CRITICAL

**Step 11**: `components/ThemeSelector.tsx`
- Modal overlay with theme grid
- Category filter
- Click to select

**Step 12**: `components/ThemeCard.tsx`
- Individual theme card
- Preview thumbnail
- Active state indicator

**Step 13**: `components/ThemePreview.tsx`
- Mini 5x5 canvas showing theme
- Renders sample blocks

---

### Step 14: Integrate into MainMenu ⭐ CRITICAL
**File**: `components/MainMenu.tsx`

Add theme button:
```typescript
const [showThemeSelector, setShowThemeSelector] = useState(false);

<button onClick={() => setShowThemeSelector(true)}>
  🎨 Themes
</button>

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

---

### Step 15: Update App.tsx ⭐ CRITICAL
**File**: `App.tsx`

Wrap in ThemeProvider:
```typescript
<AuthWrapper>
  {(profile) => (
    <ThemeProvider userId={profile.userId}>
      <GameApp profile={profile} />
    </ThemeProvider>
  )}
</AuthWrapper>
```

Replace local theme state with `useTheme()` hook.

---

### Step 16: Database Schema (OPTIONAL)
**Action**: Add `theme_preference` column to `user_profiles` table

Can be deferred - localStorage works without this.

---

### Step 17: Apply Theme to UI Components
**Files**: Various components

Replace hardcoded colors with theme values:
```typescript
const { theme } = useTheme();

<div style={{
  backgroundColor: theme.colors.background,
  color: theme.colors.text,
  fontFamily: theme.typography.fontFamily,
}}>
```

**Priority**: Medium - can be done incrementally

---

### Step 18: Comprehensive Testing & Verification
**Tests needed**:
- Theme service tests
- ThemeContext tests
- Component integration tests
- Visual verification of all 10 themes

**Manual testing**:
- Switch themes in UI
- Verify persistence across refresh
- Check all screens apply theme
- Test on mobile

---

## Quick Start for Next Session

```bash
# 1. Verify current state
pnpm --filter web build
pnpm --filter web test

# 2. Start with Step 9 (Theme Service)
# Create packages/web/src/services/themeService.ts

# 3. Then Step 10 (ThemeContext)
# Create packages/web/src/contexts/ThemeContext.tsx

# 4. Then Steps 11-13 (UI Components)
# Create theme selector components

# 5. Then Steps 14-15 (Integration)
# Wire everything together in MainMenu and App

# 6. Finally Step 18 (Testing)
# Verify everything works end-to-end
```

## Critical Path

The **minimum viable implementation** requires:
1. ✅ Themes (Done - Steps 1-7)
2. ⭐ Theme Service (Step 9) - Persistence
3. ⭐ ThemeContext (Step 10) - State management
4. ⭐ ThemeSelector UI (Steps 11-13) - User interface
5. ⭐ Integration (Steps 14-15) - Wire it all together

Steps 8, 16, 17 are **optional/polish**.

## Known Issues/Notes

- **Sound files**: Theme `sounds` properties reference placeholder paths (`/sounds/*/...`). These don't exist yet but won't break anything.
- **Textures**: Some themes reference texture files that don't exist. These are optional enhancements.
- **Old themes.ts**: Still exists, not deleted yet for backward compatibility during transition.
- **renderBlock() compatibility**: All themes work with existing TetrisRenderer - no changes needed there.

## Success Criteria

Implementation is complete when:
1. ✅ All 10 themes exist and validate
2. ⭐ User can select theme from UI
3. ⭐ Theme persists across page refresh (localStorage)
4. ⭐ Theme applies to canvas (blocks) and UI elements
5. ✓ Build passes
6. ✓ Tests pass
7. ⭐ Visual verification confirms all themes look correct

**Current**: 1/7 criteria met
**Target**: 7/7 criteria met

## Estimated Remaining Work

- **Step 9**: 30 minutes (theme service)
- **Step 10**: 20 minutes (context)
- **Steps 11-13**: 45 minutes (UI components)
- **Steps 14-15**: 30 minutes (integration)
- **Step 18**: 45 minutes (testing/verification)

**Total**: ~3 hours of focused implementation

## Files to Read First

When resuming:
1. `.spec-implementer/009-theme-system/work-log.md` - Current status
2. `.spec-implementer/009-theme-system/plan.md` - Detailed step instructions
3. `packages/web/src/themes/index.ts` - See what's built
4. `specs/009-theme-system.md` - Original requirements

Good luck! The foundation is solid. 🚀
