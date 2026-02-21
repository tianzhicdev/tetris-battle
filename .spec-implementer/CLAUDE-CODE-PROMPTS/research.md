# Research Summary for Cyberpunk Tetris Visual Overhaul

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React client (main UI)
  - `packages/game-core` - Shared game logic
  - `packages/partykit` - Multiplayer server
- **Build**: Vite + TypeScript (`pnpm --filter web build`)
- **Tests**: Vitest (`pnpm --filter web test`) - 90 tests passing
- **Dev**: `pnpm dev` runs Vite dev server

## Existing Patterns

### Imports
The project uses:
- Absolute imports from workspace packages: `@tetris-battle/game-core`
- Relative imports for local files: `'../components/GameHeader'`
- Named exports with destructuring: `import { GameHeader } from './game/GameHeader'`
- Type imports: `import type { Theme } from '../themes'`

Example from ServerAuthMultiplayerGame.tsx:
```typescript
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAbilityStore } from '../stores/abilityStore';
import { TetrisRenderer } from '../renderer/TetrisRenderer';
import type { Ability, UserProfile } from '@tetris-battle/game-core';
```

### Component Structure
Components use:
- Functional components with hooks
- TypeScript interfaces for props
- Inline styles (no CSS modules/styled-components)
- Framer Motion for animations
- `motion.div` with variants for interactive elements

Example from GameHeader.tsx:
```typescript
interface GameHeaderProps {
  score: number;
  stars: number;
  notifications: AbilityNotification[];
  isConnected: boolean;
  connectionStats: ConnectionStats | null;
}

export function GameHeader({ score, stars, ... }: GameHeaderProps) {
  return (
    <div style={{ ... }}>
      ...
    </div>
  );
}
```

### Styling Approach
- **Inline styles** everywhere (CSSProperties objects)
- **Colors**: rgba() for transparency, hex for solid colors
- **Responsive**: clamp() for sizing: `'clamp(48px, 7vh, 64px)'`
- **Gradients**: linear-gradient and radial-gradient extensively used
- **Glass effects**: backdrop-filter blur for glassmorphism
- **Animations**: Framer Motion variants in `utils/animations.ts`

Example from NextPieceQueue.tsx:
```typescript
<div style={{
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '8px 6px',
  borderRadius: '10px',
  background: 'rgba(9, 14, 30, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  backdropFilter: 'blur(14px)',
}}>
```

### Theme System
Located in `packages/web/src/themes/`:
- **types.ts**: Complete Theme interface with colors, typography, blocks, board, effects, sounds, animations, particles
- **glassmorphism.ts**: Example theme implementation
- **index.ts**: Theme registry and exports
- Themes accessed via `useTheme()` context hook
- Piece colors: `theme.colors.pieces['I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J']`
- Custom renderBlock function per theme for canvas rendering

Example from Theme interface:
```typescript
export interface ThemeColors {
  pieces: {
    I: string; O: string; T: string; S: string; Z: string; J: string; L: string;
  };
  background: string;
  boardBackground: string;
  gridLines: string;
  text: string;
  textSecondary: string;
  accent: string;
  particleColor: string;
  glowColor?: string;
}
```

### Particle System
Currently in ParticleEffect.tsx:
- Uses Framer Motion's `<motion.div>` for particle animations
- Renders particles as divs with border-radius: 50% (circles)
- Animates position, scale, opacity over 1 second
- Radial spread pattern from center point
- Box-shadow for glow effect

Example:
```typescript
<motion.div
  initial={{ x: particle.x, y: particle.y, scale: 1, opacity: 1 }}
  animate={{ x: particle.x + particle.vx * 100, y: particle.y + particle.vy * 100, scale: 0, opacity: 0 }}
  transition={{ duration: 1, ease: 'easeOut' }}
  style={{
    position: 'absolute',
    width: particle.size,
    height: particle.size,
    borderRadius: '50%',
    backgroundColor: particle.color,
    boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
  }}
/>
```

### Game Rendering Flow (Server-Auth Mode)
1. **Canvas Setup**: `ServerAuthMultiplayerGame` creates canvas refs for player and opponent boards
2. **TetrisRenderer**: Initialized with canvas, blockSize (30px), and theme
3. **Render Loop**: Triggered on state updates from server via `useEffect`
4. **Board Drawing**:
   - `renderer.clear()` - fills background
   - `renderer.drawGrid(board)` - draws grid lines
   - `renderer.drawBoard(board)` - calls `theme.renderBlock()` for each cell
   - Custom overlays (particles, effects) rendered on top
5. **Particle Canvas**: Separate canvas layer with `position: absolute, zIndex: 8, pointerEvents: none`

### State Management
Uses Zustand stores:
- `stores/gameStore.ts` - Game state (legacy client-auth mode)
- `stores/abilityStore.ts` - Ability loadout and unlocks
- `stores/friendStore.ts` - Friends and challenges
- `stores/debugStore.ts` - Debug panel state

Pattern:
```typescript
import { create } from 'zustand';

export const useDebugStore = create<DebugStore>((set, get) => ({
  isVisible: false,
  events: [],
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
}));
```

### Font Loading
Fonts loaded in index.html:
```html
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet" />
```

Already available:
- **Orbitron**: 400, 700, 900 weights (cyberpunk UI font)
- **Noto Sans SC**: 400, 700 weights (Chinese characters)

## Analogous Flow: Line Clear Particles (Reference Implementation)

The reference cyberpunk.jsx shows a complete particle system. Here's how it maps to the existing codebase:

### Current ParticleEffect Component (DOM-based)
Location: `packages/web/src/components/ParticleEffect.tsx`
- Uses Framer Motion for animation
- Renders particles as DOM divs
- Limited to simple radial burst

### Reference Particle System (Canvas-based)
From `docs/reference-cyberpunk.jsx`:
- Uses HTML5 Canvas with `requestAnimationFrame`
- Particle class with physics (vx, vy, gravity, decay)
- Multiple particle types: burst, trail, ambient, lock, lineSweep
- Persistent ref to maintain particle array across renders
- Canvas overlay with glow effects (shadowBlur, shadowColor)

Key pattern:
```javascript
class Particle {
  constructor(x, y, color, type = "burst") {
    this.x = x; this.y = y; this.color = color; this.type = type;
    if (type === "burst") {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp - 2;
      this.life = 1; this.decay = 0.014 + Math.random() * 0.02; this.size = 2 + Math.random() * 4;
    }
    // ... other types
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.type === "burst") this.vy += 0.14; // gravity
    this.life -= this.decay;
    return this.life > 0;
  }
}

// Rendering:
ctx.globalAlpha = Math.min(p.life, 1);
ctx.shadowColor = p.color;
ctx.shadowBlur = 10;
ctx.fillStyle = p.color;
if (p.type === "burst") {
  ctx.fillRect(p.x - s/2, p.y - s/2, s, s); // square
} else {
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); // circle
  ctx.fill();
}
```

## Integration Points

### Files to Create
1. **Particle System Module** (new file)
   - `packages/web/src/components/CyberpunkParticles.tsx`
   - Canvas-based particle system with Particle class
   - Multiple particle types (burst, trail, ambient, lock, lineSweep)
   - requestAnimationFrame loop
   - addParticles() public API

### Files to Modify

#### 1. ServerAuthMultiplayerGame.tsx
**Lines to modify:**
- ~Line 32-34: Import new CyberpunkParticles component
- ~Line 537-547: Add particle canvas ref and integration hooks
- Line clear detection (~line 700-800): Call addParticles for each cleared cell
- Hard drop detection: Call addParticles for trail effect
- Piece lock detection: Call addParticles for lock effect
- Board shake logic: Add screen shake state and transform

**Pattern to follow:**
```typescript
// Add ref
const particlesRef = useRef<CyberpunkParticlesHandle>(null);

// On line clear
if (linesCleared > yourState.linesCleared) {
  clearedRows.forEach(row => {
    for (let col = 0; col < boardWidth; col++) {
      particlesRef.current?.addParticles(
        col * CELL_SIZE + CELL_SIZE/2,
        row * CELL_SIZE + CELL_SIZE/2,
        cellColor,
        8,
        "burst"
      );
    }
  });
}
```

#### 2. GameHeader.tsx
**Lines to modify:**
- Line 38-75: Replace boxed layout with floating numbers
- Remove background containers
- Add Orbitron font-family
- Add text-shadow for glows
- Make labels tiny and dim (8px, 25% opacity, letter-spacing: 4px)
- SCORE: 28-30px, weight 900, #00f0f0 with glow
- STARS/LINES: 18px, weight 700, their colors with softer glows
- Add COMBO counter (conditional render when combo > 0)

**Current structure:**
```typescript
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
  <div style={{ fontSize: '12px', color: '#9ad2ff', fontWeight: 700 }}>Score {score}</div>
  <div style={{ fontSize: '12px', color: '#d88cff', fontWeight: 800 }}>⭐ {stars}</div>
</div>
```

**Target structure (from reference):**
```typescript
<div style={{ display: 'flex', gap: 32, marginBottom: 10, alignItems: 'baseline' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 8, color: '#00f0f044', letterSpacing: 4 }}>SCORE</div>
    <div style={{ fontSize: 30, fontWeight: 900, color: '#00f0f0', textShadow: '0 0 20px #00f0f066, 0 0 50px #00f0f022', lineHeight: 1 }}>
      {score.toLocaleString()}
    </div>
  </div>
  {/* ... STARS, LINES, COMBO */}
</div>
```

#### 3. NextPieceQueue.tsx
**Lines to modify:**
- Line 33-84: Remove container backgrounds/borders
- Add fading opacity: [0.85, 0.45, 0.2]
- Add scaling: [1, 0.85, 0.7]
- Add transitions: 'all 0.3s ease'
- Change label to 7px, #ffffff16, letter-spacing 3px
- Mini blocks use gradient style with gradAngle

**Current:**
```typescript
<div style={{
  width: '58px',
  height: '58px',
  borderRadius: '8px',
  background: 'rgba(3, 6, 16, 0.7)',
  border: '1px solid rgba(0, 212, 255, 0.18)',
  // ...
```

**Target:**
```typescript
<div key={qi} style={{
  opacity: [0.85, 0.45, 0.2][qi],
  transform: `scale(${[1, 0.85, 0.7][qi]})`,
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.3s ease',
}}>
  {/* No container div, just piece cells with gradients */}
</div>
```

#### 4. AbilityDock.tsx
**Lines to modify:**
- Line 39-109: Replace emoji icons with Chinese characters
- Change button styling to "ghost" opacity mode
- Default opacity: 0.3
- Can't afford: 0.12
- Active: 1.0
- Add text-shadow on active: '0 0 16px #00f0f088, 0 0 30px #00f0f044'
- Font: Noto Sans SC, 24px for char
- Cost display: 8px Orbitron, #ffffff33 normal / #00f0f088 active

**Mapping abilities to Chinese chars:**
```typescript
const ABILITY_CHARS: Record<string, string> = {
  earthquake: '震',
  screen_shake: '揺',
  blind_spot: '墨',
  mini_blocks: '縮',
  fill_holes: '満',
  clear_rows: '消',
  // ... others
};
```

#### 5. GameTouchControls.tsx
**Lines to modify:**
- Line 13-23: Update baseButton style
- background: rgba(255,255,255,0.025)
- border: 1px solid rgba(255,255,255,0.06)
- borderRadius: 10px
- color: rgba(255,255,255,0.19)
- fontSize: system-ui font
- Use Unicode arrows: ◁, ▷, ▽, ▽▽, ↻
- width: 46px, height: 44px (hard drop wider: 56px)
- WebkitTapHighlightColor: transparent

#### 6. Board Rendering in ServerAuthMultiplayerGame
**Canvas rendering section (~line 1000-1200):**
- Board background: rgba(5, 5, 22, 0.78) with backdrop-filter: blur(6px)
- Grid lines: rgba(255,255,255,0.018) - ultra subtle
- Add vignette overlay div: radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(3,3,15,0.65) 100%)
- Board border: 1px solid rgba(0,240,240,0.09) with soft box-shadow

**Block rendering:**
- Store gradAngle per piece type in game-core
- Each cell: linear-gradient(${gradAngle}deg, ${color}dd, ${color}66)
- Box shadow: 0 0 6px ${color}44, 0 0 14px ${color}18
- Add child divs for 3D effect:
  - Top-left highlight: rgba(255,255,255,0.18), 40% width, 35% height
  - Bottom-right shadow: rgba(0,0,0,0.12), 50% width, 40% height
- border-radius: 3px

### Files to Reference During Implementation
1. **docs/reference-cyberpunk.jsx** - Complete reference for all visual styles
2. **packages/web/src/components/ServerAuthMultiplayerGame.tsx** - Main game component, board rendering
3. **packages/web/src/components/game/GameHeader.tsx** - HUD refactoring
4. **packages/web/src/components/game/NextPieceQueue.tsx** - Next piece styling
5. **packages/web/src/components/game/AbilityDock.tsx** - Skills bar refactoring
6. **packages/web/src/components/game/GameTouchControls.tsx** - Controls styling
7. **packages/web/src/themes/types.ts** - Theme system types
8. **packages/web/index.html** - Font imports (already has Orbitron + Noto Sans SC)

## Key Technical Notes

### Gradient Angles per Piece Type
From reference:
- I: 180°
- O: 135°
- T: 150°
- S: 120°
- Z: 160°
- J: 140°
- L: 130°

These should be stored in game-core alongside piece definitions so both board cells and active pieces use consistent gradients.

### Particle Physics Constants
From reference Particle class:
- **Burst**: gravity 0.14/frame, decay 0.014-0.034, size 2-6px, square shape
- **Trail**: upward drift -0.8 to -2.3 vy, decay 0.04-0.07, round
- **Lock**: outward explosion, decelerate 0.95x per frame, decay 0.035-0.06
- **Ambient**: slow upward -0.08 to -0.23 vy, very slow decay 0.001-0.003, tiny
- **LineSweep**: medium upward drift, long-lived decay 0.008-0.016

### Screen Shake Formula
From reference:
```javascript
const dur = 280;
const t = (Date.now() - start) / dur;
const decay = (1 - t) * (1 - t); // quadratic
shake = {
  x: (Math.random() - 0.5) * intensity * decay * 2,
  y: (Math.random() - 0.5) * intensity * decay * 2,
};
```

Intensity by event:
- 1 line: 7
- 2 lines: 12
- 3 lines: 17
- 4 lines (tetris): 22
- Hard drop: 3

### Floating Text Animation
From reference:
```javascript
const age = Math.min((Date.now() - born) / 1400, 1);
style={{
  top: y - age * 50, // float up 50px
  transform: `scale(${1 + age * 0.15})`, // scale 1 → 1.15
  opacity: age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85, // fade in 15%, fade out 85%
}}
```

Labels:
- SINGLE: white
- DOUBLE: #00f0f0 (cyan)
- TRIPLE: #f0a020 (orange)
- TETRIS!: #ff2080 (pink), 24px (vs 18px for others)
- Append ×{combo} if combo > 1

### Line Clear Flash Effect
From reference:
- Mark rows as "flashing" for 280ms before removing
- Flash style: linear-gradient(gradAngle, rgba(255,255,255,0.9), ${color}cc)
- Flash glow: 0 0 16px #ffffff, 0 0 30px ${color}88
- After 280ms: remove rows, shift down, trigger particles

### Hard Drop Trail
From reference:
- Render translucent cells from original Y to landing Y
- Trail cell style: background ${color}18, box-shadow 0 0 8px ${color}33
- Inset 5px on each side
- Duration: 140ms

### Lock Flash (Piece Settling Glow)
From reference:
- Overlay div on each locked cell for 180ms
- radial-gradient(circle, ${color}44, transparent 70%)
- Animation: scale 1.15 → 1.0, opacity 1 → 0
- Positioned 4px outside cell bounds (padding: -4px)

## Completion Criteria
Phase 1 complete when:
- ✅ Read all files referenced by spec (GameHeader, NextPieceQueue, AbilityDock, GameTouchControls, ServerAuthMultiplayerGame)
- ✅ Traced particle rendering flow (ParticleEffect.tsx, TetrisRenderer.ts)
- ✅ Research summary written with concrete examples
- ✅ Integration points identified with specific line numbers

**Ready to proceed to Phase 2: Planning.**
