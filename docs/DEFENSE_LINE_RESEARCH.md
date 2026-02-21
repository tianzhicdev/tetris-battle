# Defense Line Feature - Research & Analysis

## Current Status: February 20, 2026

Branch: `defense-line`

---

## Understanding the Feature (from tech spec)

### Core Mechanic: Inverted Shared Board

**Board**: 5 columns × 30 rows

**Background zones**:
- Rows 0-14: background = '0' (empty for A, filled for B)
- Rows 15-29: background = 'x' (filled for A, empty for B)

**Cell Interpretation** (THE KEY RULE):

For Player A:
- `'a'` or `'x'` = **FILLED/SOLID** (cannot pass through)
- `'b'` or `'0'` = **EMPTY/PASSABLE** (can pass through)

For Player B:
- `'b'` or `'0'` = **FILLED/SOLID** (cannot pass through)
- `'a'` or `'x'` = **EMPTY/PASSABLE** (can pass through)

**What this means**:
- Since `board[row][col]` only stores `'a'`, `'b'`, or `null`
- When cell is `null`, we interpret it as background:
  - If row >= 15: it's 'x'-background
  - If row < 15: it's '0'-background
- For A: `null` in rows >= 15 acts as 'x' = solid
- For B: `null` in rows < 15 acts as '0' = solid

### Row Clearing Logic

**For Player A:**
A row is "filled" (clearable) if ALL cells are either:
- `'a'` (A's own piece), OR
- `'x'` (background in rows >= 15)

Which in code means:
```typescript
// For A, a cell is "filled" if:
cell === 'a' || (cell === null && row >= 15)
```

**For Player B:**
A row is "filled" (clearable) if ALL cells are either:
- `'b'` (B's own piece), OR
- `'0'` (background in rows < 15)

Which in code means:
```typescript
// For B, a cell is "filled" if:
cell === 'b' || (cell === null && row < 15)
```

### Win Condition
First player to clear 10 rows wins.

### Controls
Only 5 actions needed:
1. **Left** - move piece left
2. **Right** - move piece right
3. **Rotate** - rotate piece clockwise (only need CW, not CCW)
4. **Down** - soft drop (move down faster)
5. **Drop** - hard drop (instant drop)

---

## Issues Found in Current Implementation

### ❌ ISSUE #1: Row Clearing Logic is COMPLETELY WRONG

**Location**: `packages/partykit/src/DefenseLineGameState.ts:364-388`

**Current Code**:
```typescript
private getClearableRows(player: DefenseLinePlayer): number[] {
  const rows = Array.from(this.activeRows).sort((a, b) => a - b);

  return rows.filter((row) => {
    for (let col = 0; col < BOARD_COLS; col++) {
      const cell = this.board[row][col];
      if (player === 'a') {
        if (row >= 15) {
          continue; // ❌ WRONG! Skips checking cells in x-zone
        }
        if (cell !== 'a') {
          return false;
        }
      } else {
        if (row < 15) {
          continue; // ❌ WRONG! Skips checking cells in 0-zone
        }
        if (cell !== 'b') {
          return false;
        }
      }
    }
    return true;
  });
}
```

**Problem**:
- For A: Only checks rows 0-14, requires ALL cells to be 'a'
  - **WRONG**: Should check ALL rows, and count 'x' (null in rows >= 15) as filled
- For B: Only checks rows 15-29, requires ALL cells to be 'b'
  - **WRONG**: Should check ALL rows, and count '0' (null in rows < 15) as filled

**Why it's wrong**:
- A can NEVER clear rows in the x-zone (rows 15-29) because it skips them!
- B can NEVER clear rows in the 0-zone (rows 0-14) because it skips them!
- This completely breaks the "enemy zone raid" mechanic from the spec

**Correct Implementation**:
```typescript
private getClearableRows(player: DefenseLinePlayer): number[] {
  const rows = Array.from(this.activeRows).sort((a, b) => a - b);

  return rows.filter((row) => {
    for (let col = 0; col < BOARD_COLS; col++) {
      const cell = this.board[row][col];

      if (player === 'a') {
        // For A: row is filled if all cells are 'a' or 'x' (null in x-zone)
        if (cell === 'a') continue; // 'a' = filled for A
        if (cell === null && row >= 15) continue; // null in x-zone = filled for A
        return false; // any other cell = not filled
      } else {
        // For B: row is filled if all cells are 'b' or '0' (null in 0-zone)
        if (cell === 'b') continue; // 'b' = filled for B
        if (cell === null && row < 15) continue; // null in 0-zone = filled for B
        return false; // any other cell = not filled
      }
    }
    return true;
  });
}
```

---

### ✅ CORRECT: Collision Detection Logic

**Location**: `packages/partykit/src/DefenseLineGameState.ts:405-425`

The `isSolidForPlayer` method is **CORRECT**:

```typescript
private isSolidForPlayer(player: DefenseLinePlayer, row: number, col: number): boolean {
  const cell = this.board[row][col];

  if (player === 'a') {
    if (cell === 'a') return true;  // ✓ A's pieces = solid
    if (cell === 'b') return false; // ✓ B's pieces = passable
    return row >= 15;                // ✓ Empty in x-zone = solid, empty in 0-zone = passable
  }

  if (cell === 'b') return true;    // ✓ B's pieces = solid
  if (cell === 'a') return false;   // ✓ A's pieces = passable
  return row < 15;                   // ✓ Empty in 0-zone = solid, empty in x-zone = passable
}
```

This correctly implements the inversion rule for collision detection.

---

### ❌ ISSUE #2: Too Many Controls

**Location**: `packages/web/src/components/DefenseLineGame.tsx:225-232`

**Current UI**:
```tsx
<button onClick={() => sendInput({ type: 'move', direction: 'left' })}>Left</button>
<button onClick={() => sendInput({ type: 'rotate', direction: 'cw' })}>Rotate</button>
<button onClick={() => sendInput({ type: 'move', direction: 'right' })}>Right</button>
<button onClick={() => sendInput({ type: 'soft_drop' })}>Soft Drop</button>
<button onClick={() => sendInput({ type: 'rotate', direction: 'ccw' })}>CCW</button>  ❌ NOT NEEDED
<button onClick={() => sendInput({ type: 'hard_drop' })}>Hard Drop</button>
```

**Problem**:
- Has 6 buttons: Left, Rotate CW, Right, Soft Drop, **CCW**, Hard Drop
- Spec only needs 5: Left, Right, Rotate (CW only), Down (soft drop), Drop (hard drop)
- CCW rotation is unnecessary complexity

**Fix**: Remove CCW button

---

### ❌ ISSUE #3: Board Display Too Large

**Location**: `packages/web/src/components/DefenseLineRenderer.tsx:138-150`

**Current Rendering**:
```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
    gap: '2px',
    width: 'min(280px, 75vw)', // ❌ Board is 280px wide for 5 columns
    ...
  }}
>
```

**Problem**:
- Board: 30 rows × 5 columns
- Width: 280px
- Each cell: ~56px × 56px (with aspect-ratio 1:1)
- **Total height: ~1,680px** (30 rows × 56px) - WAY TOO TALL!
- On mobile, this creates massive scrolling
- Hard to see the whole board at once

**User's complaint**: "make the game board smaller; it is way too big now"

**Suggested fixes**:
1. **Option A**: Reduce cell size by reducing board width
   - Change width from `280px` to `150px`
   - Cell size: ~30px × 30px
   - Total height: ~900px (more manageable)

2. **Option B**: Non-square cells (vertical compression)
   - Use `aspect-ratio: 1 / 1.5` or similar
   - Make cells taller than wide
   - Reduce vertical space

3. **Option C** (User's suggestion): "reuse the normal gaming page, just use a different board size"
   - Use `ServerAuthMultiplayerGame.tsx` as base
   - Adapt it for defense line with 5×30 board
   - Benefit: Reuses existing responsive layout, animations, UI

---

## Comparison with Existing Game Component

### Current Defense Line Setup
- **Dedicated component**: `DefenseLineGame.tsx` (235 lines)
- **Simple renderer**: `DefenseLineRenderer.tsx` (170 lines)
- **Basic UI**: Minimal controls, no animations
- **Board size**: Fixed width, no mobile optimization

### Existing Game Component
- **Component**: `ServerAuthMultiplayerGame.tsx` (3,640 lines)
- **Features**:
  - Responsive layout (mobile portrait/landscape)
  - Touch controls with haptics
  - Visual effects (particles, flashes, etc.)
  - Animated game board
  - Score display, ability dock
  - Post-game modal
- **Board rendering**: Uses `TetrisRenderer` with themes

### Could We Reuse ServerAuthMultiplayerGame?

**Pros**:
- Already handles responsive layout
- Mobile-optimized controls
- Visual polish (animations, effects)
- Consistent UX with main game mode

**Cons**:
- Component is massive (3,640 lines) - hard to modify
- Tightly coupled to abilities system
- Board size is hardcoded to 10×20
- Different game mechanics (garbage vs overwriting)

**Verdict**:
- **Not practical** to fully reuse ServerAuthMultiplayerGame
- **Better approach**: Extract reusable parts:
  - Mobile layout logic from `MobileGameLayout.tsx`
  - Touch controls from `GameTouchControls.tsx`
  - Renderer patterns from `TetrisRenderer.ts`
- Create optimized defense line components using these patterns

---

## Summary of Required Fixes

### Critical (Breaks Game Logic)
1. ✅ **Fix `getClearableRows` method** - Currently prevents clearing in enemy zones
   - File: `packages/partykit/src/DefenseLineGameState.ts:364-388`
   - Impact: HIGH - game is unplayable without this

### High Priority (UX)
2. ✅ **Remove CCW control button**
   - File: `packages/web/src/components/DefenseLineGame.tsx:230`
   - Impact: MEDIUM - simplifies controls

3. ✅ **Reduce board display size**
   - File: `packages/web/src/components/DefenseLineRenderer.tsx:144`
   - Options:
     - Reduce width to `150px` (quick fix)
     - Use responsive sizing like main game
     - Extract layout patterns from ServerAuthMultiplayerGame

### Future Enhancements
4. ⏳ **Extract reusable game layout patterns**
   - Create shared mobile layout component
   - Reuse touch controls styling
   - Add visual effects (particle system, flash overlays)

---

## Next Steps

1. **Fix critical bug**: Update `getClearableRows` method
2. **Simplify controls**: Remove CCW button, reorganize layout
3. **Optimize display**: Reduce board size (quick: change width to 150-180px)
4. **Test thoroughly**: Verify row clearing works in both zones
5. **Consider refactor**: Extract mobile layout patterns for future reuse

---

## Testing Checklist

After fixes:

### Row Clearing
- [ ] A can clear rows in 0-zone (rows 0-14) with all 'a' cells
- [ ] A can clear rows in x-zone (rows 15-29) with mix of 'a' and null cells
- [ ] B can clear rows in 0-zone (rows 0-14) with mix of 'b' and null cells
- [ ] B can clear rows in x-zone (rows 15-29) with all 'b' cells
- [ ] Active rows detection works correctly
- [ ] Win condition triggers at 10 clears

### Controls
- [ ] 5 buttons displayed: Left, Right, Rotate, Down, Drop
- [ ] Keyboard controls work (arrows + space)
- [ ] Touch controls work on mobile

### Display
- [ ] Board fits on screen without excessive scrolling
- [ ] Both players see correct orientation (A: row 0 top, B: row 29 top)
- [ ] Defense line visible between rows 14 and 15
- [ ] Cells colored correctly (A: orange, B: cyan)
- [ ] Ghost piece shows correct landing position

---

**Research Complete**: Ready for implementation
**Estimated Time**: 1-2 hours
**Risk**: Low (fixes are isolated to specific methods)
