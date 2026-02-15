# Tetris Battle - Rendering Architecture

## Overview

This document explains how the client-side rendering system works, including how game state is rendered and how animations are managed and displayed.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Client-Server Model](#client-server-model)
3. [Rendering Pipeline](#rendering-pipeline)
4. [Animation System](#animation-system)
5. [Complete Data Flow Example](#complete-data-flow-example)
6. [Key Files and Their Roles](#key-files-and-their-roles)

---

## Architecture Overview

### The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ServerAuthMultiplayerGame.tsx (React Component)       │ │
│  │  - Receives state from server via WebSocket            │ │
│  │  - Manages rendering on client side                    │ │
│  │  - NO game logic (server owns that)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                    │
│                          │ Renders to Canvas                  │
│                          ▼                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  TetrisRenderer.ts                                      │ │
│  │  - Draws board, pieces, effects to HTML5 Canvas        │ │
│  │  - Calls BlockAnimationManager for animations          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                    │
│                          │ Gets animations                    │
│                          ▼                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  BlockAnimationManager.ts                               │ │
│  │  - Stores animation queue in memory                     │ │
│  │  - Returns active animations                            │ │
│  │  - Auto-filters expired animations                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                │ WebSocket (Partykit)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         SERVER SIDE                          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ServerAuthGameClient.ts                                │ │
│  │  - Runs authoritative game loop                         │ │
│  │  - Sends state updates to clients                       │ │
│  │  - Validates all inputs and abilities                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** The server owns the game state. The client only renders what the server tells it to render.

---

## Client-Server Model

### Server Responsibilities (Not on Client)
- Run the game loop (gravity, piece movement, collision detection)
- Validate player inputs
- Process ability activations
- Determine game outcomes (win/lose)
- Send authoritative state updates to clients

### Client Responsibilities (What Runs in Browser)
- **Receive** game state updates from server via WebSocket
- **Render** game state to canvas
- **Trigger** visual effects (animations, particles, screen shake)
- **Send** user inputs (keyboard, touch) to server
- **Display** UI elements (scores, abilities, notifications)

**Important:** `ServerAuthMultiplayerGame.tsx` runs entirely on the client side in the browser. Despite the name "ServerAuth", the component itself is a React component running in your browser that connects to the server.

---

## Rendering Pipeline

### 1. State Updates Trigger Rendering

When the server sends a state update, React's `useEffect` hooks detect changes and trigger renders:

```typescript
// Location: packages/web/src/components/ServerAuthMultiplayerGame.tsx:485-504

useEffect(() => {
  if (rendererRef.current && yourState) {
    // Apply board diff animations (fade-in, fade-out)
    applyBoardDiffAnimations(
      rendererRef.current,
      'self',
      yourState.board,
      yourState.activeEffects
    );

    // Render the current game state
    const board = { grid: yourState.board, width: 10, height: 20 };
    rendererRef.current.render(
      board,
      yourState.currentPiece,
      yourState.ghostPiece,
      { /* render options */ }
    );
  }
}, [yourState, gameStore.predictedState, applyBoardDiffAnimations]);
```

**Flow:**
1. Server sends state update → `setYourState(newState)` called
2. `yourState` changes → `useEffect` hook fires
3. `applyBoardDiffAnimations()` compares old vs new board → queues animations
4. `renderer.render()` draws current frame to canvas

### 2. TetrisRenderer.render() Method

This is the main rendering function that draws everything:

```typescript
// Location: packages/web/src/renderer/TetrisRenderer.ts:368-409

render(board, currentPiece, ghostPiece, options) {
  // 1. Clear canvas
  this.clear();

  // 2. Draw grid lines
  if (showGrid) {
    this.drawGrid(board);
  }

  // 3. Draw locked blocks on board
  this.drawBoard(board);

  // 4. Draw animations ON TOP of locked blocks
  this.drawAnimations();  // ← THIS IS WHERE ANIMATIONS ARE RENDERED

  // 5. Draw bomb blast radius preview (if applicable)
  if (isBomb && bombType && currentPiece) {
    this.drawBombBlastRadius(currentPiece, bombType);
  }

  // 6. Draw ghost piece (preview)
  if (showGhost && ghostPiece) {
    this.drawPiece(ghostPiece, true, isBomb);
  }

  // 7. Draw current falling piece
  if (currentPiece) {
    this.drawPiece(currentPiece, false, isBomb);
  }

  // 8. Draw fog/blind spot overlay (if active)
  if (blindSpotRows > 0) {
    this.drawBlindSpot(board, blindSpotRows);
  }
}
```

**Important:** The `render()` method is called **every time the game state changes**. This could be 60 times per second during active gameplay.

### 3. Drawing Animations

The `drawAnimations()` method reads active animations and renders them:

```typescript
// Location: packages/web/src/renderer/TetrisRenderer.ts:79-124

drawAnimations(): void {
  // Get all active animations (expired ones are auto-filtered)
  const activeAnimations = this.animationManager.getActiveAnimations();

  activeAnimations.forEach(anim => {
    const progress = this.animationManager.getAnimationProgress(anim);  // 0.0 to 1.0
    const px = anim.x * this.blockSize;  // Grid position → pixel position
    const py = anim.y * this.blockSize;

    this.ctx.save();  // Save canvas state

    switch (anim.type) {
      case 'fade-out':
      case 'fade-in':
      case 'flash': {
        const alpha = this.animationManager.getFadeAlpha(anim, progress);
        this.ctx.globalAlpha = alpha;  // Set transparency

        // Draw colored overlay
        const color = anim.color || '#ffffff';
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px, py, this.blockSize, this.blockSize);
        break;
      }

      case 'explode': {
        const scale = this.animationManager.getExplosionScale(progress);
        const alpha = 1 - progress;  // Fade out as it expands

        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = anim.color || '#ff4444';

        // Draw expanding circle
        const centerX = px + this.blockSize / 2;
        const centerY = py + this.blockSize / 2;
        const radius = (this.blockSize / 2) * scale;

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      }
    }

    this.ctx.restore();  // Restore canvas state
  });
}
```

**Key Points:**
- `getActiveAnimations()` returns all animations that haven't expired yet
- Each animation has a progress value (0.0 = just started, 1.0 = finished)
- Animations are drawn on top of the game board but below the current piece
- Canvas state is saved/restored to prevent visual artifacts

---

## Animation System

### How Animations Work

#### 1. Adding Animations

When an ability is activated or a board change happens, animations are **queued**:

```typescript
// Location: packages/web/src/renderer/BlockAnimationManager.ts:24-36

animateBlocksDisappearing(positions: Array<{ x: number; y: number }>, color?: string): void {
  const now = Date.now();
  positions.forEach(({ x, y }) => {
    this.animations.push({
      x,
      y,
      type: 'fade-out',
      startTime: now,           // When animation started
      duration: 300,             // How long it lasts (milliseconds)
      color,                     // Optional overlay color
    });
  });
}
```

**Important:** Animations are stored in a simple array in memory:

```typescript
private animations: BlockAnimation[] = [];
```

#### 2. Reading Animations

The renderer reads animations every frame:

```typescript
// Location: packages/web/src/renderer/BlockAnimationManager.ts:98-105

getActiveAnimations(): BlockAnimation[] {
  const now = Date.now();
  // Auto-filter expired animations
  this.animations = this.animations.filter(
    anim => now - anim.startTime < anim.duration
  );
  return this.animations;
}
```

**Automatic Cleanup:** Expired animations (where `currentTime - startTime >= duration`) are automatically removed from the array.

#### 3. Animation Progress

Each animation has a progress value from 0.0 (start) to 1.0 (end):

```typescript
// Location: packages/web/src/renderer/BlockAnimationManager.ts:110-114

getAnimationProgress(anim: BlockAnimation): number {
  const now = Date.now();
  const elapsed = now - anim.startTime;
  return Math.min(1, elapsed / anim.duration);
}
```

This progress value is used to calculate visual properties:

- **Fade-out:** `alpha = 1 - progress` (1.0 → 0.0)
- **Fade-in:** `alpha = progress` (0.0 → 1.0)
- **Flash:** `alpha = sin(progress * π)` (0 → 1 → 0, like a pulse)
- **Explode:** `scale = 1 + sin(progress * π) * 0.5` (grows then shrinks)

### Animation Types

| Type | Duration | Purpose | Visual Effect |
|------|----------|---------|---------------|
| **fade-out** | 300ms | Blocks disappearing | Block fades from solid to transparent |
| **fade-in** | 300ms | Blocks appearing | Block fades from transparent to solid |
| **flash** | 150ms | Quick highlight | Block flashes brightly then fades (sine wave) |
| **explode** | 200ms | Bomb explosions | Expanding circles that fade out |

### Animation Colors

Different abilities use different colors:

```typescript
// Fire effects (bombs)
renderer.animationManager.animateBlocksDisappearing(cells, '#ff4400');  // Orange-red
renderer.animationManager.animateExplosion(x, y, 3, '#ff6a00');        // Orange

// Spawn effects (cell creation)
renderer.animationManager.animateBlocksAppearing(cells, '#00ff88');    // Green-cyan

// Clear effects (cell removal)
renderer.animationManager.animateBlocksDisappearing(cells, '#ff5d73'); // Pink-red
```

---

## Complete Data Flow Example

Let's trace what happens when a player activates the "Circle Bomb" ability:

### Step 1: User Clicks Ability Button

```typescript
// Location: ServerAuthMultiplayerGame.tsx:634-676

handleAbilityActivate(ability) {
  // Send request to server
  const requestId = gameClientRef.current.activateAbility(ability.type, targetPlayerId);

  // Store locally to track the request
  pendingAbilityActivationsRef.current.set(requestId, { ability, target });

  // Queue visual effect (will trigger when board changes)
  queueBoardAbilityFx(ability.type, target);
}
```

**What happens:**
- WebSocket message sent to server: `{ type: 'activateAbility', abilityType: 'circle_bomb', ... }`
- Client stores this as a "pending" activation
- Client queues a visual effect to trigger when the board changes

### Step 2: Server Processes Ability

The server:
1. Validates the ability (does player have enough stars?)
2. Applies the ability effect to the game board
3. Sends updated state to both players

### Step 3: Client Receives State Update

```typescript
// Location: ServerAuthMultiplayerGame.tsx:485-504

useEffect(() => {
  if (rendererRef.current && yourState) {
    // Compare old board vs new board
    applyBoardDiffAnimations(
      rendererRef.current,
      'self',
      yourState.board,
      yourState.activeEffects
    );

    // Render current state
    rendererRef.current.render(board, currentPiece, ghostPiece);
  }
}, [yourState]);
```

### Step 4: Board Diff Animations Triggered

```typescript
// Location: ServerAuthMultiplayerGame.tsx:309-356

applyBoardDiffAnimations(renderer, target, currentGrid, activeEffects) {
  const previousGrid = prevSelfBoardRef.current;

  if (previousGrid && pendingAbility) {
    // Compare old vs new board
    const diff = getBoardDiff(previousGrid, currentGrid);

    if (BOMB_ABILITY_TYPES.has(abilityType)) {
      // Bomb animation: flash + explosion + disappear
      renderer.animationManager.animateBlocksFlashing(allChanged, '#ffd166');
      renderer.animationManager.animateBlocksDisappearing(allChanged, '#ff8c42');

      const center = centerOfPositions(allChanged);
      renderer.animationManager.animateExplosion(center.x, center.y, 3, '#ff6a00');
    }
  }

  // Update "previous board" reference for next comparison
  prevSelfBoardRef.current = cloneBoardGrid(currentGrid);
}
```

**What happens:**
- Compare old board (before ability) with new board (after ability)
- Find all cells that changed (appeared, disappeared, mutated)
- Queue animations based on the ability type
- Store current board as "previous" for next comparison

### Step 5: Animations Are Queued

```typescript
// BlockAnimationManager.ts

// Flash all affected cells (yellow)
animations.push({ x: 5, y: 10, type: 'flash', startTime: now, duration: 150, color: '#ffd166' });
animations.push({ x: 6, y: 10, type: 'flash', startTime: now, duration: 150, color: '#ffd166' });
// ... more cells

// Explosion at center (expanding rings)
animations.push({ x: 5, y: 10, type: 'explode', startTime: now + 0,   duration: 200, color: '#ff6a00' });
animations.push({ x: 6, y: 10, type: 'explode', startTime: now + 50,  duration: 200, color: '#ff6a00' });
animations.push({ x: 7, y: 10, type: 'explode', startTime: now + 100, duration: 200, color: '#ff6a00' });
// ... expanding outward

// Blocks disappearing (fade out)
animations.push({ x: 5, y: 10, type: 'fade-out', startTime: now, duration: 300, color: '#ff8c42' });
animations.push({ x: 6, y: 10, type: 'fade-out', startTime: now, duration: 300, color: '#ff8c42' });
// ... more cells
```

**Result:** The `animations` array now contains ~50+ animation objects.

### Step 6: Continuous Rendering

Every time `yourState` changes (which could be 60 times per second):

```typescript
renderer.render(board, piece, ghost, options)
  → this.clear()                    // Clear canvas
  → this.drawBoard(board)           // Draw locked blocks
  → this.drawAnimations()           // ← Read and draw active animations
      → getActiveAnimations()       // Filter expired, return active
      → forEach animation:
          calculate progress
          draw based on type (fade, explode, etc.)
  → this.drawPiece(piece)           // Draw current piece
```

**Frame-by-frame:**

```
Frame 1 (0ms):     Flash starts (alpha = 0.5), explosion ring 1 starts (scale = 1.0)
Frame 2 (16ms):    Flash brighter (alpha = 0.8), explosion ring 1 growing (scale = 1.2)
Frame 3 (50ms):    Flash done, explosion ring 2 starts, fade-out begins (alpha = 0.9)
Frame 4 (100ms):   Explosion ring 3 starts, fade-out continuing (alpha = 0.7)
Frame 5 (150ms):   Explosions expanding, fade-out visible (alpha = 0.5)
...
Frame 18 (300ms):  All animations complete, auto-removed from queue
```

---

## Key Files and Their Roles

### 1. `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Role:** Main game component running on client side

**Key Responsibilities:**
- Connect to server via WebSocket (`ServerAuthGameClient`)
- Receive game state updates from server
- Create and manage `TetrisRenderer` instances (one for player, one for opponent)
- Trigger visual effects (animations, particles, screen shake)
- Send user inputs to server
- Handle ability activation UI
- Manage game lifecycle (connection, disconnection, game over)

**Key Code Sections:**
- Lines 152-157: Create renderer refs
- Lines 485-504: Main render loop for player board
- Lines 506-526: Render loop for opponent board
- Lines 309-356: Board diff animation system
- Lines 634-676: Ability activation handler

**Important:** Despite the name "ServerAuth", this entire file runs in the browser. The "ServerAuth" refers to the fact that the **server** is authoritative (owns game state), not that this file runs on the server.

### 2. `packages/web/src/renderer/TetrisRenderer.ts`

**Role:** Canvas rendering engine

**Key Responsibilities:**
- Draw game board, pieces, and effects to HTML5 Canvas
- Manage `BlockAnimationManager` instance
- Convert game state (grid arrays) to visual pixels
- Handle theme-based rendering (colors, styles)
- Draw special effects (bomb preview, blind spot fog, ghost pieces)

**Key Methods:**
- `render()` (line 368): Main rendering function, called every frame
- `drawBoard()` (line 62): Draw all locked blocks on the board
- `drawAnimations()` (line 79): Read animations from manager and draw them
- `drawPiece()` (line 126): Draw tetromino pieces
- `drawExplosion()` (line 215): Draw explosion effects (legacy, mostly replaced by BlockAnimationManager)

**Canvas Context:** Uses HTML5 Canvas 2D context (`CanvasRenderingContext2D`) for all drawing operations.

### 3. `packages/web/src/renderer/BlockAnimationManager.ts`

**Role:** Animation state management

**Key Responsibilities:**
- Store animation queue in memory (array)
- Provide API for adding animations (fade-in, fade-out, flash, explode)
- Auto-filter expired animations
- Calculate animation progress (0.0 to 1.0)
- Calculate visual properties (alpha, scale) based on progress

**Key Methods:**
- `animateBlocksDisappearing()` (line 24): Queue fade-out animations
- `animateBlocksAppearing()` (line 41): Queue fade-in animations
- `animateBlocksFlashing()` (line 58): Queue flash animations
- `animateExplosion()` (line 75): Queue expanding explosion rings
- `getActiveAnimations()` (line 98): Return all active animations, auto-filter expired
- `getAnimationProgress()` (line 110): Calculate 0.0-1.0 progress for an animation

**Data Structure:**
```typescript
private animations: BlockAnimation[] = [
  { x: 5, y: 10, type: 'fade-out', startTime: 1234567890, duration: 300, color: '#ff4400' },
  { x: 6, y: 10, type: 'explode', startTime: 1234567890, duration: 200, color: '#ff6a00' },
  // ... more animations
];
```

### 4. `packages/web/src/services/partykit/ServerAuthGameClient.ts`

**Role:** WebSocket client for server communication

**Key Responsibilities:**
- Connect to Partykit server via WebSocket
- Send player inputs (move, rotate, drop, ability activation)
- Receive game state updates from server
- Call callbacks when state changes (`onYourStateUpdate`, `onOpponentStateUpdate`)

**Not shown in this document, but important to understand:**
- This is what bridges the client (browser) and server (Partykit)
- All game logic happens on the server, this just sends/receives messages

### 5. `packages/game-core/src/abilityEffects.ts`

**Role:** Ability logic (server-side)

**Note:** This file runs on the **server**, not the client. It's imported by the server to process ability effects.

**Key Functions:**
- `applyCircleBomb()`: Clear blocks in radius
- `applyDeathCross()`: Toggle diagonal blocks
- `applyRandomSpawner()`: Add random blocks (strategic placement)
- `applyGoldDigger()`: Remove random blocks
- ... 18+ ability implementations

**Client never calls these directly.** The server calls them, then sends updated board state to clients.

---

## Summary: How It All Works Together

### Question: "What reads animations and renders them?"

**Answer:**

1. **Animations are stored** in `BlockAnimationManager.animations` array (in memory)
2. **Animations are queued** by `ServerAuthMultiplayerGame` when board changes are detected
3. **Animations are read** by `TetrisRenderer.drawAnimations()` every frame
4. **Animations are rendered** to HTML5 Canvas using Canvas 2D drawing API
5. **Animations are auto-cleaned** by `getActiveAnimations()` filtering out expired ones

### Question: "Is ServerAuthMultiplayerGame.tsx running on the client side?"

**Answer:** Yes! It's a React component that runs entirely in the browser. The "ServerAuth" name means the **server is authoritative** (owns game state), not that the component runs on the server. The component:
- Runs in the user's browser
- Connects to the server via WebSocket
- Receives state updates from server
- Renders those updates to canvas
- Sends user inputs to server

### Data Flow Summary

```
User Action
  ↓
Send to Server (WebSocket)
  ↓
Server Processes (game logic runs here)
  ↓
Server Sends New State (WebSocket)
  ↓
Client Receives State (ServerAuthMultiplayerGame.tsx)
  ↓
Compare Old vs New Board (getBoardDiff)
  ↓
Queue Animations (BlockAnimationManager)
  ↓
Render Frame (TetrisRenderer.render)
  ↓
Draw Board → Draw Animations → Draw Pieces
  ↓
User Sees Visual Effect
```

### Key Insight: Reactive Rendering

The system uses **React's reactive model**:
- When `yourState` changes → `useEffect` fires → `renderer.render()` called
- When `opponentState` changes → `useEffect` fires → `opponentRenderer.render()` called
- This happens automatically, no manual `requestAnimationFrame` loop needed
- Animations are drawn on every render, with progress calculated based on `Date.now()`

The beauty of this design:
- **Separation of concerns:** Server owns logic, client owns visuals
- **Performance:** Client only renders, doesn't run game loop
- **Cheat prevention:** All validation happens server-side
- **Smooth animations:** Even if state updates are slow (e.g., 20fps from server), animations interpolate smoothly (60fps in browser)

---

## Debugging Tips

### View Animations in Browser DevTools

1. Open browser console (F12)
2. Access the animation manager:
   ```javascript
   // In a running game
   const animations = rendererRef.current.animationManager.getActiveAnimations();
   console.log(animations);
   ```

3. Inspect a specific animation:
   ```javascript
   const anim = animations[0];
   console.log({
     position: { x: anim.x, y: anim.y },
     type: anim.type,
     age: Date.now() - anim.startTime,
     duration: anim.duration,
     expired: (Date.now() - anim.startTime) >= anim.duration
   });
   ```

### Add Debug Logging

Add console logs to see when animations are triggered:

```typescript
// In applyBoardDiffAnimations()
if (diff.disappeared.length > 0) {
  console.log(`[ANIM] Fading out ${diff.disappeared.length} blocks`, diff.disappeared);
  renderer.animationManager.animateBlocksDisappearing(diff.disappeared, color);
}
```

### Slow Down Animations for Testing

Temporarily increase duration in `BlockAnimationManager.ts`:

```typescript
private readonly DEFAULT_DURATION = 3000; // Change from 300ms to 3000ms (3 seconds)
```

Now you can see animations in slow motion!

---

## Related Documentation

- **VISUAL_EFFECTS_SYSTEM.md** - Detailed guide on using the animation API
- **abilities.json** - Ability configurations including costs and effects
- **abilityEffects.ts** - Server-side ability logic implementations

---

*Last updated: 2026-02-15*
