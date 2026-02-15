# Visual Effects System Documentation

## Overview

The visual effects system provides consistent, reusable animations for ability effects in the game. Effects are categorized into two main types:

1. **Bomb Effects** - Explosive abilities (fire/explosion animations)
2. **Cell Manipulation Effects** - Converting empty cells ↔ full cells

## Core Components

### BlockAnimationManager

**Location:** `packages/web/src/renderer/BlockAnimationManager.ts`

The central system managing all block animations.

#### Animation Types

```typescript
type AnimationType = 'fade-out' | 'fade-in' | 'flash' | 'shake' | 'explode';
```

#### Key Functions

##### 1. `animateBlocksDisappearing()`

**Purpose:** Animates blocks fading out (disappearing)

**Input:**
- `positions: Array<{ x: number; y: number }>` - Grid positions to animate
- `color?: string` - Optional overlay color (e.g., '#ff4400' for fire)

**Output:** void (adds animations to internal queue)

**Use For:**
- Bomb effects clearing cells
- Cells being removed/destroyed
- Full → Empty conversions

**Example:**
```typescript
renderer.animationManager.animateBlocksDisappearing(
  [{ x: 5, y: 10 }, { x: 6, y: 10 }],
  '#ff4400' // Orange-red fire color
);
```

---

##### 2. `animateBlocksAppearing()`

**Purpose:** Animates blocks fading in (appearing)

**Input:**
- `positions: Array<{ x: number; y: number }>` - Grid positions to animate
- `color?: string` - Optional overlay color (e.g., '#00d4ff' for blue glow)

**Output:** void

**Use For:**
- Cells being created/spawned
- Empty → Full conversions
- Fill holes ability

**Example:**
```typescript
renderer.animationManager.animateBlocksAppearing(
  [{ x: 3, y: 15 }, { x: 4, y: 15 }],
  '#00d4ff' // Cyan glow
);
```

---

##### 3. `animateBlocksFlashing()`

**Purpose:** Animates blocks flashing (highlighting affected area)

**Input:**
- `positions: Array<{ x: number; y: number }>` - Grid positions to animate
- `color: string` - Flash color (default: '#ffff00' yellow)

**Output:** void

**Use For:**
- Indicating affected cells before transformation
- Warning indicators
- Pre-effect highlighting

**Duration:** 150ms (quick flash)

**Example:**
```typescript
renderer.animationManager.animateBlocksFlashing(
  affectedCells,
  '#ffffff' // White flash
);
```

---

##### 4. `animateExplosion()`

**Purpose:** Creates an expanding explosion animation from a center point

**Input:**
- `centerX: number` - X coordinate of explosion center
- `centerY: number` - Y coordinate of explosion center
- `radius: number` - Explosion radius in grid cells
- `color?: string` - Explosion color (default: '#ff4444')

**Output:** void

**Use For:**
- Bomb abilities (circle bomb, cross bomb)
- Explosion visual effects
- Radial area attacks

**Behavior:** Creates expanding rings with staggered timing (50ms per ring)

**Example:**
```typescript
renderer.animationManager.animateExplosion(
  5, 10,    // Center at (5, 10)
  3,        // Radius of 3 cells
  '#ff6a00' // Orange fire
);
```

---

### Helper Functions

##### `getActiveAnimations()`
Returns all currently active animations (auto-filters expired ones)

##### `getAnimationProgress(anim)`
Returns progress (0-1) for a specific animation

##### `getFadeAlpha(anim, progress)`
Calculates alpha/opacity for fade animations

##### `getExplosionScale(progress)`
Calculates scale for explosion animations (pulse effect)

##### `clearAll()`
Clears all active animations

---

## Effect Categories

### 1. Bomb Effects 🔥

**Recommended Approach:**
- Flash affected cells first (white/yellow)
- Trigger explosion animation at bomb location
- Fade out affected cells with fire color (#ff4400 to #ff8800)

**Example Pattern:**
```typescript
// 1. Flash affected area
renderer.animationManager.animateBlocksFlashing(affectedCells, '#ffffff');

// 2. Explosion at center (after brief delay)
setTimeout(() => {
  renderer.animationManager.animateExplosion(centerX, centerY, radius, '#ff6a00');
  renderer.animationManager.animateBlocksDisappearing(affectedCells, '#ff4400');
}, 150);
```

**Bomb Color Palette:**
- Core: `#ffff00` (yellow-white)
- Mid: `#ff6a00` (orange)
- Outer: `#ff4400` (red-orange)
- Burning: `#ff8800` to `#ff3300`

---

### 2. Cell Manipulation Effects ✨

#### Empty → Full (Spawning/Creating)

**Recommended Approach:**
- Flash cells to indicate target (cyan/green)
- Fade in with glow color
- Optional: Pulse effect before fade-in

**Example Pattern:**
```typescript
// Flash first
renderer.animationManager.animateBlocksFlashing(cells, '#00ff88');

// Then fade in
setTimeout(() => {
  renderer.animationManager.animateBlocksAppearing(cells, '#00ff88');
}, 150);
```

**Spawn Color Palette:**
- Blue/Cyan: `#00d4ff` (tech/digital)
- Green: `#00ff88` (nature/growth)
- White/Cyan: `#00ffff` (energy)

#### Full → Empty (Clearing/Removing)

**Recommended Approach:**
- Flash cells to indicate target
- Fade out with accent color
- Optional: Shimmer effect before removal

**Example Pattern:**
```typescript
// Shimmer effect (multiple flashes)
for (let i = 0; i < 2; i++) {
  setTimeout(() => {
    renderer.animationManager.animateBlocksFlashing(cells, '#ffd700');
  }, i * 150);
}

// Then fade out
setTimeout(() => {
  renderer.animationManager.animateBlocksDisappearing(cells, '#ffaa00');
}, 300);
```

**Clear Color Palette:**
- Purple: `#c942ff` (magic/transformation)
- Red/Pink: `#ff006e` (destruction)
- Gold: `#ffd700` (collection/harvesting)

---

## Demo Pages

### 1. Ability Effects Demo
**URL:** `/?demo=abilities`
- Shows all 20 abilities in action
- Live game board with auto-playing tetromino
- Click buttons to trigger individual ability effects

### 2. Visual Effects Options Demo
**URL:** `/?demo=effects`
- **NEW** - Effect design comparison page
- Shows 3 options each for:
  - Bomb explosions (fire effects)
  - Empty → Full (spawn effects)
  - Full → Empty (clear effects)
- Click to preview different visual styles
- Select preferred option for each category

---

## Integration Example

### Ability Handler Pattern

```typescript
function handleAbilityActivation(abilityType: string) {
  const renderer = rendererRef.current;
  if (!renderer) return;

  switch (abilityType) {
    case 'circle_bomb':
      // 1. Identify affected cells
      const affectedCells = getAffectedCells(centerX, centerY, radius);

      // 2. Flash warning
      renderer.animationManager.animateBlocksFlashing(affectedCells, '#ffffff');

      // 3. Explosion + burn (delayed)
      setTimeout(() => {
        renderer.animationManager.animateExplosion(centerX, centerY, 3, '#ff6a00');
        renderer.animationManager.animateBlocksDisappearing(affectedCells, '#ff4400');
        audioManager.playSfx('ability_bomb_explode');
      }, 150);
      break;

    case 'fill_holes':
      // 1. Find empty cells
      const emptyCells = findEmptyCells();

      // 2. Flash targets
      renderer.animationManager.animateBlocksFlashing(emptyCells, '#00ff88');

      // 3. Fill with glow (delayed)
      setTimeout(() => {
        renderer.animationManager.animateBlocksAppearing(emptyCells, '#00ff88');
      }, 150);
      break;
  }
}
```

---

## Performance Notes

- **Default Duration:** 300ms per animation
- **Flash Duration:** 150ms (quick indicator)
- **Explosion:** Staggered 50ms per ring
- **Auto-cleanup:** Expired animations are automatically removed
- **Max Concurrent:** Unlimited (optimized via RAF)

---

## Color Recommendations

### Buff Abilities (Help Player)
- Primary: `#00d4ff` (cyan/blue)
- Accent: `#00ff88` (green)
- Highlight: `#00ffff` (bright cyan)

### Debuff Abilities (Attack Opponent)
- Primary: `#ff006e` (pink/magenta)
- Accent: `#c942ff` (purple)
- Highlight: `#ff00ff` (bright magenta)

### Destructive Effects
- Fire: `#ff6a00` to `#ff3300` (orange to red)
- Gold/Collection: `#ffd700` to `#ffaa00`
- Energy: `#ffffff` (white flash)

---

## Next Steps

1. ✅ Themes reduced to 5 (retro-8bit, glassmorphism, neon-cyberpunk, isometric-3d, liquid-morphing)
2. ✅ Visual Effects Demo page created (`/?demo=effects`)
3. ⏳ Fix spawn mechanics (only spawn at bottom or next to full cells)
4. ⏳ Update ability naming format: "X DEATH (Death Cross)"
5. ⏳ Implement selected visual effects from demo page

---

## Testing URLs

- **Ability Effects:** http://localhost:5175/?demo=abilities
- **Visual Effects Options:** http://localhost:5175/?demo=effects
- **Main Game:** http://localhost:5175/
