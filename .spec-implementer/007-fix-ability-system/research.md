# Research Summary for Spec 007: Fix Ability System

## Project Structure

- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `game-core`: Shared game logic, types, ability definitions
  - `web`: React client (Vite + TypeScript)
  - `partykit`: WebSocket multiplayer server
- **Build**: TypeScript compilation (`tsc`) for game-core, Vite for web
- **Tests**: Vitest framework
  - Run: `pnpm --filter game-core test`
  - Watch mode: `pnpm --filter game-core test:watch`
  - UI mode: `pnpm --filter game-core test:ui`

## Architecture: Dual-Mode System

The game supports TWO architectures for ability handling:

### 1. Legacy Client-Authoritative Mode (Default)
- Each client runs its own game loop
- Abilities applied locally via `game-core` functions
- Client sends `ability_activation` message to server
- Server relays as `ability_received` to opponent
- Opponent client applies effect locally
- **Files**: `PartykitMultiplayerGame.tsx`, `gameStore.ts`, `gameSync.ts`

### 2. New Server-Authoritative Mode (`?serverAuth=true`)
- Server runs game loop for both players
- Client sends `ability_activation` with player/target/ability
- Server validates stars, deducts cost
- Server applies effect to target's `ServerGameState`
- Server broadcasts state at 60fps
- Client renders server state (no local game logic)
- **Files**: `ServerAuthMultiplayerGame.tsx`, `ServerAuthGameClient.ts`, `ServerGameState.ts`

## Existing Patterns

### Ability Definition (JSON + TypeScript)

**File**: `packages/game-core/src/abilities.json`
```json
{
  "costFactor": 1,
  "abilities": {
    "screen_shake": {
      "id": "screen_shake",
      "type": "screen_shake",
      "name": "Screen Shake",
      "shortName": "SHAKE",
      "description": "Opponent's board vibrates violently. Visual chaos",
      "cost": 25,
      "duration": 10000,
      "category": "debuff",
      "unlockLevel": 1,
      "unlockCost": 0
    }
  }
}
```

**File**: `packages/game-core/src/abilities.ts`
```typescript
export const ABILITIES: Record<AbilityType, Ability> = loadAbilities();
```

### Ability Implementation (Effect Functions)

**File**: `packages/game-core/src/abilityEffects.ts`

**Pattern**: Pure functions that transform board state
```typescript
export function applyEarthquake(board: Board): Board {
  const newGrid = board.grid.map(row => [...row]);
  // Find all filled cells
  const filledCells: { x: number; y: number }[] = [];
  // ... collect cells

  // Remove 15-25 random blocks
  const numHoles = Math.floor(Math.random() * 11) + 15;
  for (let i = 0; i < numHoles && filledCells.length > 0; i++) {
    // Remove block
  }

  // Apply gravity
  return applyGravity({ ...board, grid: newGrid });
}
```

**Duration-based effects**: Managed by `AbilityEffectManager` class
```typescript
export class AbilityEffectManager {
  private activeEffects: Map<string, ActiveAbilityEffect> = new Map();

  activateEffect(abilityType: string, duration: number, data?: any): void {
    const now = Date.now();
    this.activeEffects.set(abilityType, {
      abilityType,
      startTime: now,
      endTime: now + duration,
      data,
    });
  }

  isEffectActive(abilityType: string): boolean {
    // Check if effect is still active
  }
}
```

### Client-Side Ability Activation (Legacy)

**File**: `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Lines 364-471**: `handleAbilityActivate(ability: Ability)`
```typescript
const handleAbilityActivate = (ability: Ability) => {
  // 1. Deduct stars
  deductStars(ability.cost);

  // 2. Show notification
  setAbilityNotification({...});

  // 3. Play sound
  if (ability.category === 'buff') {
    audioManager.playSfx('ability_buff_activate');
  } else {
    audioManager.playSfx('ability_debuff_activate');
  }

  // 4. Apply effect
  if (ability.category === 'buff') {
    // Apply to self
    if (ability.duration) {
      effectManager.activateEffect(ability.type, ability.duration);
    }

    switch (ability.type) {
      case 'clear_rows':
        const { board } = applyClearRows(gameState.board, 5);
        updateBoard(board);
        break;
      // ... other buff cases
    }
  } else {
    // Send debuff to opponent via server
    gameSyncRef.current?.activateAbility(ability.type, opponentId);
  }
};
```

**Lines 474-597**: `handleAbilityReceived(abilityType: string)`
```typescript
const handleAbilityReceived = (abilityType: string) => {
  // 1. Play sound
  audioManager.playSfx('ability_debuff_activate');

  // 2. Track duration-based effects
  if (ability.duration) {
    effectManager.activateEffect(abilityType, ability.duration);
  }

  // 3. Apply instant effects
  switch (abilityType) {
    case 'earthquake':
      // Animate blocks disappearing
      rendererRef.current.animationManager.animateBlocksDisappearing(...);
      // Apply after delay
      setTimeout(() => {
        const newBoard = applyEarthquake(gameState.board);
        updateBoard(newBoard);
      }, 100);
      break;
    // ... other debuff cases
  }
};
```

### Server-Side Ability Handling

**File**: `packages/partykit/src/game.ts` (Lines 560-603)
```typescript
handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
  // 1. Validate stars (server-auth mode)
  const playerState = this.serverGameStates.get(playerId);
  if (playerState) {
    const abilityCost = this.getAbilityCost(abilityType);
    if (playerState.gameState.stars < abilityCost) {
      console.warn('Insufficient stars');
      return; // Reject
    }
    playerState.gameState.stars -= abilityCost;
  }

  // 2. Apply to target's ServerGameState
  const targetServerState = this.serverGameStates.get(targetPlayerId);
  if (targetServerState) {
    targetServerState.applyAbility(abilityType);
    this.broadcastState();
    return;
  }

  // 3. Fallback: Send to client (legacy mode)
  const targetConn = this.getConnection(targetPlayer.connectionId);
  if (targetConn) {
    targetConn.send(JSON.stringify({
      type: 'ability_received',
      abilityType,
      fromPlayerId: playerId,
    }));
  }
}
```

**File**: `packages/partykit/src/ServerGameState.ts` (Lines 203-269)
```typescript
applyAbility(abilityType: string): void {
  switch (abilityType) {
    case 'earthquake':
      this.gameState.board = applyEarthquake(this.gameState.board);
      break;

    case 'speed_up_opponent':
      this.tickRate = 1000 / 3; // 3x faster
      this.activeEffects.set('speed_up_opponent', Date.now() + 10000);
      setTimeout(() => {
        this.tickRate = 1000;
        this.activeEffects.delete('speed_up_opponent');
      }, 10000);
      break;

    case 'reverse_controls':
      this.activeEffects.set('reverse_controls', Date.now() + 8000);
      break;

    // ... other abilities
  }
}
```

### Visual Effects

**Animations**: `TetrisRenderer.animationManager`
- `animateBlocksDisappearing(blocks, color)`: Fade out blocks
- `animateBlocksAppearing(blocks, color)`: Fade in blocks
- `animateBlocksFlashing(blocks, color)`: Flash blocks

**Screen Effects**:
- `setScreenShake(intensity)`: 0-3 intensity levels
- `setFlashEffect({ color })`: Full-screen color flash
- `setParticles({ x, y, id })`: Particle explosions

**Rendering Special States** (PartykitMultiplayerGame.tsx:312-338):
```typescript
// Check for active effects
const blindSpotRows = effectManager.isEffectActive('blind_spot') ? 4 : 0;
const shrinkCeilingRows = effectManager.isEffectActive('shrink_ceiling') ? 4 : 0;

rendererRef.current.render(gameState.board, gameState.currentPiece, ghostPiece, {
  showGrid: true,
  showGhost: true,
  isBomb: gameState.bombType !== null,
  blindSpotRows,
});

// Draw shrink ceiling overlay
if (shrinkCeilingRows > 0) {
  rendererRef.current.drawShrinkCeiling(gameState.board, shrinkCeilingRows);
}
```

### Time-Based Periodic Abilities

**Problem**: `random_spawner` and `gold_digger` need to trigger every 2 seconds for 10/20 seconds.

**Current Implementation**: Duration stored in `activeEffects`, but NO periodic trigger mechanism exists.

**Needed Pattern**:
```typescript
// In effectManager or game loop
if (effectManager.isEffectActive('random_spawner')) {
  const timeSinceLastTrigger = now - lastRandomSpawnerTrigger;
  if (timeSinceLastTrigger >= 2000) {
    // Apply random_spawner effect
    const newBoard = applyRandomSpawner(gameState.board);
    updateBoard(newBoard);
    lastRandomSpawnerTrigger = now;
  }
}
```

### Tests

**File**: `packages/game-core/src/__tests__/abilityEffects.test.ts`

**Pattern**:
```typescript
import { describe, it, expect } from 'vitest';
import { createBoard } from '../engine';
import { applyEarthquake } from '../abilityEffects';

describe('Ability Effects', () => {
  describe('applyEarthquake', () => {
    it('removes 15-25 blocks and applies gravity', () => {
      const board = createBoard(10, 20);
      // Fill some cells
      board.grid[19][0] = 'I';
      // ... more setup

      const result = applyEarthquake(board);

      // Assertions
      expect(result.grid[19][0]).toBe(...);
    });
  });
});
```

## Ability Inventory & Status

### Implemented Instant Effects (Board Manipulation)
✅ **earthquake**: Removes 15-25 random blocks, applies gravity
✅ **clear_rows**: Clears bottom 5 rows
✅ **death_cross**: Toggles diagonal blocks
✅ **row_rotate**: Rotates each row randomly
✅ **fill_holes**: Fills enclosed empty spaces

### Implemented Duration Effects (Tracked by AbilityEffectManager)
✅ **speed_up_opponent**: 3x tick rate (client-side: line 231-233)
✅ **blind_spot**: Hides bottom 4 rows (client-side: line 315)
✅ **shrink_ceiling**: Blocks top 4 rows (client-side: line 316, 326-328)
✅ **screen_shake**: Visual shake (client-side: line 255, 589)
✅ **reverse_controls**: Tracked but NOT implemented in input handler
✅ **rotation_lock**: Tracked but NOT implemented in input handler

### Periodic Effects (BROKEN - No Trigger Mechanism)
❌ **random_spawner**: Should trigger every 2s for 20s (effect exists, not triggered)
❌ **gold_digger**: Should trigger every 2s for 20s (effect exists, not triggered)

### Buff Abilities
✅ **cross_firebomb**: Sets bombType to 'cross', explodes on landing
✅ **circle_bomb**: Sets bombType to 'circle', explodes on landing
✅ **clear_rows**: Clears bottom 5 rows (buff version)
✅ **mini_blocks**: Next 5 pieces are 2-cell dominoes
✅ **fill_holes**: Fills enclosed spaces (buff version)
❓ **cascade_multiplier**: Tracked but NOT implemented (no 2x stars on line clear)
❓ **piece_preview_plus**: NOT implemented (no code to show 5 pieces)
❓ **deflect_shield**: NOT implemented (no deflection logic)

### Piece Modification Abilities
✅ **weird_shapes**: Next piece is 4x4 hollowed shape (tracked via weirdShapesRemaining)

### Not in JSON (AI-only)
- **add_junk_rows**: Adds garbage rows (exists in abilityEffects.ts, has tests)
- **scramble_board**: Scrambles board (exists in abilityEffects.ts, has tests)
- **gravity_flip**: Flips board vertically (exists in abilityEffects.ts, has tests)

## Integration Points

### Files That Need Modification

#### 1. `packages/game-core/src/abilityEffects.ts`
- ✅ Instant effects exist
- ❌ Need to verify all 18 abilities have corresponding functions
- ❌ Missing: piece_preview logic, deflect_shield logic, cascade_multiplier logic

#### 2. `packages/web/src/components/PartykitMultiplayerGame.tsx`
- ✅ Lines 364-471: `handleAbilityActivate` (buff handling)
- ✅ Lines 474-597: `handleAbilityReceived` (debuff handling)
- ❌ Missing: Input modification for `reverse_controls` and `rotation_lock`
- ❌ Missing: Periodic trigger for `random_spawner` and `gold_digger`
- ❌ Missing: Line clear multiplier for `cascade_multiplier`
- ❌ Missing: Preview expansion for `piece_preview_plus`
- ❌ Missing: Deflection logic for `deflect_shield`

#### 3. `packages/web/src/stores/gameStore.ts`
- Need to check if reverse_controls/rotation_lock flags exist
- Need to check if piece preview expansion is supported

#### 4. `packages/partykit/src/ServerGameState.ts`
- ✅ Lines 203-269: `applyAbility` switch statement
- ✅ Has instant effects: earthquake, clear_rows, random_spawner, row_rotate, death_cross, gold_digger
- ✅ Has duration tracking: speed_up, reverse_controls, rotation_lock, blind_spot, screen_shake, shrink_ceiling
- ❌ Missing: Periodic triggers for random_spawner and gold_digger
- ❌ Missing: Input modification for reverse_controls and rotation_lock
- ❌ Missing: Buff abilities (those apply to self, not opponent)

#### 5. `packages/partykit/src/game.ts`
- ✅ Lines 560-603: `handleAbilityActivation` validates and routes
- ✅ Has star validation
- No changes needed (delegates to ServerGameState)

#### 6. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
- Need to check if this handles input modification (reverse_controls, rotation_lock)

### Missing Functionality Summary

**Input Modification** (reverse_controls, rotation_lock):
- Client-auth: Need to check inputs before processing in PartykitMultiplayerGame
- Server-auth: Need to modify ServerGameState.processInput() to check activeEffects

**Periodic Triggers** (random_spawner, gold_digger):
- Need interval tracking in game loop (both client and server)
- Trigger applyRandomSpawner/applyGoldDigger every 2 seconds

**Buff Implementations**:
- `cascade_multiplier`: Need to check activeEffects when calculating stars from line clears
- `piece_preview_plus`: Need to show nextPieces[0..4] instead of [0..2]
- `deflect_shield`: Need to intercept incoming debuffs and cancel if shield active

**Visual Feedback** (all abilities):
- AbilityNotification component exists
- Need to ensure ALL abilities trigger notification
- Need duration timers for active effects display

## Key Files to Reference During Implementation

### Core Logic
- `packages/game-core/src/abilities.json` - Ability definitions
- `packages/game-core/src/abilityEffects.ts` - Effect implementation functions
- `packages/game-core/src/abilities.ts` - ABILITIES export
- `packages/game-core/src/types.ts` - Type definitions

### Client (Legacy)
- `packages/web/src/components/PartykitMultiplayerGame.tsx` - Main game component
- `packages/web/src/stores/gameStore.ts` - Game state management
- `packages/web/src/stores/abilityStore.ts` - Ability selection

### Client (Server-Auth)
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - Server-auth game component
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` - Input sender

### Server
- `packages/partykit/src/ServerGameState.ts` - Server-side game state
- `packages/partykit/src/game.ts` - Game room party server

### Tests
- `packages/game-core/src/__tests__/abilityEffects.test.ts` - Existing tests
- Pattern: Vitest, describe/it, createBoard helper

## Analogous Flow: Ability Activation End-to-End

### Client-Authoritative Mode

1. **User clicks ability button** → `handleAbilityActivate(ability)`
2. **Deduct stars** → `deductStars(ability.cost)`
3. **If buff**:
   - Apply effect locally (updateBoard, setBombType, etc.)
   - If duration: `effectManager.activateEffect(type, duration)`
4. **If debuff**:
   - Send to server: `gameSyncRef.current?.activateAbility(type, opponentId)`
5. **Server receives** → `handleAbilityActivation(playerId, type, targetId)`
6. **Server validates** (if server-auth) or relays
7. **Server sends to opponent** → `ability_received` message
8. **Opponent receives** → `handleAbilityReceived(abilityType)`
9. **Opponent applies**:
   - Trigger animation (animateBlocksDisappearing, etc.)
   - Apply effect after delay (updateBoard)
   - If duration: `effectManager.activateEffect(type, duration)`

### Server-Authoritative Mode

1. **User clicks ability button** → sends `ability_activation` message
2. **Server receives** → `handleAbilityActivation(playerId, type, targetId)`
3. **Server validates stars** → check `playerState.gameState.stars >= cost`
4. **Server deducts stars** → `playerState.gameState.stars -= cost`
5. **Server applies to target** → `targetServerState.applyAbility(type)`
6. **Server broadcasts state** → `state_update` to both clients
7. **Clients receive state** → render based on server state
8. **Client checks activeEffects** → show visual overlays, notifications

## Durations from abilities.json

```
speed_up_opponent: 15000ms (15s) - DIFFERS from spec (spec says 10s)
reverse_controls: 12000ms (12s) - DIFFERS from spec (spec says 8s)
rotation_lock: 20000ms (20s) - DIFFERS from spec (spec says 5s)
blind_spot: 20000ms (20s) - DIFFERS from spec (spec says 6s)
screen_shake: 10000ms (10s) - matches spec
shrink_ceiling: 15000ms (15s) - DIFFERS from spec (spec says 8s)
random_spawner: 20000ms (20s) - matches spec
gold_digger: 20000ms (20s) - matches spec
cascade_multiplier: 20000ms (20s) - DIFFERS from spec (spec says 15s)
```

**Note**: JSON durations are in milliseconds and differ from spec. Need to clarify which is correct.

## Research Completion Checklist

✅ Read abilities.json (all ability definitions)
✅ Read abilityEffects.ts (all effect functions)
✅ Read PartykitMultiplayerGame.tsx (client-side activation/reception)
✅ Read ServerGameState.ts (server-side application)
✅ Read game.ts (server-side routing)
✅ Traced ability flow end-to-end (client → server → opponent)
✅ Identified all integration points
✅ Found existing test patterns
✅ Documented missing functionality
✅ Found duration discrepancies between spec and JSON
