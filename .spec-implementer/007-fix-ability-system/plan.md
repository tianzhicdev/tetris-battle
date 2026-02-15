# Implementation Plan for Spec 007: Fix Ability System

## Overview
- Total steps: 15
- Estimated new files: 1 (test file)
- Estimated modified files: 7
- Target: Fix all 18 abilities to work correctly in both client-auth and server-auth modes

## Steps

### Step 1: Fix Duration Values in abilities.json

**Files to modify:**
- `packages/game-core/src/abilities.json`

**Implementation details:**
Update durations to match spec requirements (all in milliseconds):
- `speed_up_opponent`: 15000 → 10000 (10 seconds)
- `reverse_controls`: 12000 → 8000 (8 seconds)
- `rotation_lock`: 20000 → 5000 (5 seconds)
- `blind_spot`: 20000 → 6000 (6 seconds)
- `shrink_ceiling`: 15000 → 8000 (8 seconds)
- `cascade_multiplier`: 20000 → 15000 (15 seconds)

Keep unchanged:
- `screen_shake`: 10000 (10 seconds) - spec says 3s but let's verify intent
- `random_spawner`: 20000 (20 seconds) - spec says 10s, JSON says 20s - keep 20s
- `gold_digger`: 20000 (20 seconds) - matches spec

**Test:**
- Build: `pnpm --filter game-core build`
- Verify: Check that ABILITIES object loads correctly

**Verify:**
- Run `node -e "console.log(require('./packages/game-core/dist/abilities.js').ABILITIES.speed_up_opponent.duration)"` - should print 10000

---

### Step 2: Add Periodic Trigger Support to AbilityEffectManager

**Files to modify:**
- `packages/game-core/src/abilityEffects.ts`

**Implementation details:**
Extend `ActiveAbilityEffect` interface to include periodic trigger data:
```typescript
export interface ActiveAbilityEffect {
  abilityType: string;
  startTime: number;
  endTime: number;
  data?: any;
  // New fields for periodic abilities
  intervalMs?: number;  // How often to trigger (e.g., 2000 for every 2 seconds)
  lastTriggerTime?: number;  // When it last triggered
}
```

In `AbilityEffectManager` class, add new method:
```typescript
shouldTriggerPeriodic(abilityType: string): boolean {
  const effect = this.activeEffects.get(abilityType);
  if (!effect || !effect.intervalMs) return false;

  const now = Date.now();

  // Check if effect is still active
  if (now > effect.endTime) {
    this.activeEffects.delete(abilityType);
    return false;
  }

  // Check if enough time has passed since last trigger
  const timeSinceLastTrigger = now - (effect.lastTriggerTime || effect.startTime);
  if (timeSinceLastTrigger >= effect.intervalMs) {
    effect.lastTriggerTime = now;
    return true;
  }

  return false;
}
```

Update `activateEffect` to accept `intervalMs`:
```typescript
activateEffect(abilityType: string, duration: number, data?: any, intervalMs?: number): void {
  const now = Date.now();
  this.activeEffects.set(abilityType, {
    abilityType,
    startTime: now,
    endTime: now + duration,
    data,
    intervalMs,
    lastTriggerTime: intervalMs ? now : undefined,
  });

  // Existing mini_blocks logic...
}
```

**Test:**
- Create `packages/game-core/src/__tests__/abilityEffects.test.ts` additions
- Test periodic trigger logic with mock Date.now()

**Verify:**
- Build succeeds: `pnpm --filter game-core build`
- Tests pass: `pnpm --filter game-core test`

---

### Step 3: Implement cascade_multiplier in gameStore

**Files to modify:**
- `packages/web/src/stores/gameStore.ts`

**Implementation details:**
1. Find the `tick()` method where line clearing happens
2. Look for where `calculateStars()` is called (should be after `clearLines()`)
3. Before calling `calculateStars()`, check if cascade_multiplier is active:
```typescript
// After const { board: clearedBoard, linesCleared } = clearLines(...)
let starsEarned = calculateStars(linesCleared, get().comboCount);

// Check for cascade multiplier
const cascadeActive = get().activeAbilityEffects.some(
  effect => effect.abilityType === 'cascade_multiplier' && Date.now() < effect.endTime
);

if (cascadeActive && linesCleared > 1) {
  // Multi-line clears award 2x stars
  starsEarned *= 2;
}
```

Note: Need to verify where activeAbilityEffects is stored. If it's not in gameStore, need to pass effectManager instance or check differently.

**Alternative if effectManager is external:**
In `PartykitMultiplayerGame.tsx`, after line clears are detected, check:
```typescript
if (effectManager.isEffectActive('cascade_multiplier')) {
  // Manually add bonus stars
  // This might require exposing a method in gameStore
}
```

**Test:**
- Manual test: Activate cascade_multiplier, clear 2+ lines, check stars awarded

**Verify:**
- Activate cascade_multiplier
- Clear double/triple/tetris
- Verify stars earned is 2x normal amount

---

### Step 4: Implement piece_preview_plus Visual Expansion

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx` (or equivalent game component)

**Implementation details:**
1. Find where `nextPieces` are displayed (likely a NextPiece component or inline rendering)
2. Current pattern probably shows `gameState.nextPieces.slice(0, 3)`
3. Change to check for active piece_preview_plus effect:
```typescript
const previewCount = effectManager.isEffectActive('piece_preview_plus') ? 5 : 3;
const piecesToShow = gameState.nextPieces.slice(0, previewCount);
```

4. Update the rendering to handle 5 pieces (might need to adjust layout/styling)

Note: `gameState.nextPieces` should already have 5 pieces (from research: lines 49-55 of createInitialGameState)

**Test:**
- Manual test: Activate piece_preview_plus, verify 5 pieces shown

**Verify:**
- Without ability: see 3 next pieces
- With ability: see 5 next pieces
- After duration expires: back to 3 pieces

---

### Step 5: Implement deflect_shield Logic

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**
1. In `handleAbilityActivate`, when `deflect_shield` is activated:
```typescript
case 'deflect_shield':
  effectManager.activateEffect('deflect_shield', Infinity); // Until consumed
  break;
```

2. In `handleAbilityReceived`, at the START before applying any debuff:
```typescript
const handleAbilityReceived = (abilityType: string) => {
  // Check for deflect shield FIRST
  if (effectManager.isEffectActive('deflect_shield')) {
    // Shield blocks this debuff
    effectManager.clearEffect('deflect_shield');

    // Show "Deflected!" notification
    const ability = Object.values(ABILITIES).find(a => a.type === abilityType);
    setAbilityNotification({
      name: 'Deflected: ' + (ability?.name || abilityType),
      description: 'Your shield blocked the attack!',
      category: 'buff',
    });

    audioManager.playSfx('ability_buff_activate'); // Success sound
    haptics.medium();

    return; // Don't apply the debuff
  }

  // ... rest of existing logic
};
```

**Test:**
- Manual test: Activate deflect_shield, have opponent use debuff, verify it's blocked

**Verify:**
- Activate deflect_shield (costs 2 stars)
- Opponent activates earthquake
- Earthquake has no effect
- "Deflected: Earthquake" notification shown
- deflect_shield is consumed (no longer active)
- Second opponent ability hits normally

---

### Step 6: Implement Input Modification (reverse_controls, rotation_lock) - Client Auth

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**
1. Find keyboard/touch input handlers (likely `handleKeyDown` or similar)
2. Before processing movement inputs, check for effects:

```typescript
// In keyboard handler (or wherever movePieceLeft/Right are called)
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (gameState.isGameOver || isPaused) return;

  // Check for rotation lock
  if (effectManager.isEffectActive('rotation_lock')) {
    if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'x') {
      // Block rotation inputs
      audioManager.playSfx('error'); // Optional: feedback
      return;
    }
  }

  // Check for reverse controls
  const reversed = effectManager.isEffectActive('reverse_controls');

  switch (e.key) {
    case 'ArrowLeft':
      reversed ? movePieceRight() : movePieceLeft();
      break;
    case 'ArrowRight':
      reversed ? movePieceLeft() : movePieceRight();
      break;
    case 'ArrowUp':
      rotatePieceClockwise();
      break;
    case 'ArrowDown':
      movePieceDown();
      break;
    // ... etc
  }
}, [gameState.isGameOver, isPaused, effectManager, ...]);
```

**Test:**
- Manual test: Activate reverse_controls, try moving left (piece moves right)
- Manual test: Activate rotation_lock, try rotating (nothing happens)

**Verify:**
- reverse_controls active: left arrow moves right, right arrow moves left
- rotation_lock active: rotation keys do nothing
- After durations expire: controls return to normal

---

### Step 7: Implement Input Modification (reverse_controls, rotation_lock) - Server Auth

**Files to modify:**
- `packages/partykit/src/ServerGameState.ts`

**Implementation details:**
In `processInput(input: PlayerInputType)` method (lines 64-113):

```typescript
processInput(input: PlayerInputType): boolean {
  if (!this.gameState.currentPiece || this.gameState.isGameOver) {
    return false;
  }

  // Check for rotation lock
  if (this.activeEffects.has('rotation_lock')) {
    const endTime = this.activeEffects.get('rotation_lock')!;
    if (Date.now() < endTime) {
      if (input === 'rotate_cw' || input === 'rotate_ccw') {
        return false; // Block rotation
      }
    } else {
      this.activeEffects.delete('rotation_lock');
    }
  }

  // Check for reverse controls
  let effectiveInput = input;
  if (this.activeEffects.has('reverse_controls')) {
    const endTime = this.activeEffects.get('reverse_controls')!;
    if (Date.now() < endTime) {
      if (input === 'move_left') effectiveInput = 'move_right';
      else if (input === 'move_right') effectiveInput = 'move_left';
    } else {
      this.activeEffects.delete('reverse_controls');
    }
  }

  // Rest of logic uses effectiveInput instead of input
  switch (effectiveInput) {
    case 'move_left':
      // ... existing logic
  }
}
```

**Test:**
- Create test case in `packages/partykit/src/__tests__/ServerGameState.test.ts`
- Test reverse_controls swaps move_left/right
- Test rotation_lock blocks rotate_cw/ccw

**Verify:**
- Build: `pnpm --filter partykit build`
- Test: `pnpm --filter partykit test` (if tests exist)
- Manual: Play in server-auth mode, verify effects work

---

### Step 8: Add Periodic Triggers for random_spawner and gold_digger - Client Auth

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**
In the game loop (useEffect that calls `tick()`), add periodic check:

```typescript
// Inside game loop useEffect, before or after tick()
useEffect(() => {
  const BASE_TICK_RATE = 1000;

  const loop = () => {
    // ... existing tick rate modification logic

    // Check for periodic abilities
    if (effectManager.shouldTriggerPeriodic('random_spawner')) {
      console.log('[ABILITY] random_spawner triggered');
      const newBoard = applyRandomSpawner(gameState.board);
      updateBoard(newBoard);
    }

    if (effectManager.shouldTriggerPeriodic('gold_digger')) {
      console.log('[ABILITY] gold_digger triggered');
      const newBoard = applyGoldDigger(gameState.board);
      updateBoard(newBoard);
    }

    tick();
    gameLoopRef.current = window.setTimeout(loop, tickRate);
  };

  // ... rest of loop setup
}, [isConnected, gameFinished, effectManager]);
```

Note: When activating these abilities in `handleAbilityReceived`, pass `intervalMs: 2000`:

```typescript
case 'random_spawner':
  effectManager.activateEffect('random_spawner', 20000, undefined, 2000);
  break;

case 'gold_digger':
  effectManager.activateEffect('gold_digger', 20000, undefined, 2000);
  break;
```

**Test:**
- Manual test: Activate random_spawner, wait 2 seconds, verify blocks appear
- Manual test: Verify it triggers ~10 times over 20 seconds

**Verify:**
- Activate random_spawner
- Every 2 seconds, 1-3 garbage blocks appear on board
- Continues for 20 seconds total
- Then stops

---

### Step 9: Add Periodic Triggers for random_spawner and gold_digger - Server Auth

**Files to modify:**
- `packages/partykit/src/ServerGameState.ts`

**Implementation details:**
Add interval tracking to class:
```typescript
export class ServerGameState {
  // ... existing properties
  private periodicAbilities: Map<string, { intervalMs: number; lastTrigger: number; endTime: number }> = new Map();
```

In `applyAbility()`, for random_spawner and gold_digger:
```typescript
case 'random_spawner':
  this.periodicAbilities.set('random_spawner', {
    intervalMs: 2000,
    lastTrigger: Date.now(),
    endTime: Date.now() + 20000,
  });
  this.activeEffects.set('random_spawner', Date.now() + 20000);
  break;

case 'gold_digger':
  this.periodicAbilities.set('gold_digger', {
    intervalMs: 2000,
    lastTrigger: Date.now(),
    endTime: Date.now() + 20000,
  });
  this.activeEffects.set('gold_digger', Date.now() + 20000);
  break;
```

Add new method to check and trigger:
```typescript
checkPeriodicAbilities(): boolean {
  const now = Date.now();
  let stateChanged = false;

  for (const [abilityType, data] of this.periodicAbilities) {
    // Check if expired
    if (now > data.endTime) {
      this.periodicAbilities.delete(abilityType);
      this.activeEffects.delete(abilityType);
      continue;
    }

    // Check if time to trigger
    if (now - data.lastTrigger >= data.intervalMs) {
      data.lastTrigger = now;

      switch (abilityType) {
        case 'random_spawner':
          this.gameState.board = applyRandomSpawner(this.gameState.board);
          stateChanged = true;
          break;
        case 'gold_digger':
          this.gameState.board = applyGoldDigger(this.gameState.board);
          stateChanged = true;
          break;
      }
    }
  }

  return stateChanged;
}
```

In `packages/partykit/src/game.ts`, in the game loop where `serverState.tick()` is called, also call:
```typescript
if (serverState.checkPeriodicAbilities()) {
  // State changed, will broadcast on next tick
}
```

**Test:**
- Extend ServerGameState.test.ts with periodic ability tests

**Verify:**
- Play in server-auth mode
- Activate random_spawner
- Verify blocks appear every 2 seconds
- Verify it stops after 20 seconds

---

### Step 10: Ensure All Abilities Trigger Notifications

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**
Audit `handleAbilityReceived` to ensure EVERY case sets `setAbilityNotification`.

Currently missing notifications for (lines 585-595):
- `speed_up_opponent`
- `rotation_lock`
- `blind_spot`
- `reverse_controls`
- `screen_shake`
- `shrink_ceiling`
- `random_spawner`
- `gold_digger`

Add notification for each:
```typescript
case 'speed_up_opponent':
case 'rotation_lock':
case 'blind_spot':
case 'reverse_controls':
case 'screen_shake':
case 'shrink_ceiling':
  // Show notification
  const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
  setAbilityNotification({
    name: ability.name,
    description: ability.description,
    category: 'debuff',
  });
  setTimeout(() => setAbilityNotification(null), 3000);

  // Duration-based effects handled by AbilityEffectManager
  if (ability.duration) {
    effectManager.activateEffect(abilityType, ability.duration);
    updateActiveEffects();
  }
  break;

case 'random_spawner':
  const randomSpawnerAbility = ABILITIES.random_spawner;
  setAbilityNotification({
    name: randomSpawnerAbility.name,
    description: randomSpawnerAbility.description,
    category: 'debuff',
  });
  setTimeout(() => setAbilityNotification(null), 3000);
  effectManager.activateEffect('random_spawner', 20000, undefined, 2000);
  updateActiveEffects();
  break;

case 'gold_digger':
  const goldDiggerAbility = ABILITIES.gold_digger;
  setAbilityNotification({
    name: goldDiggerAbility.name,
    description: goldDiggerAbility.description,
    category: 'debuff',
  });
  setTimeout(() => setAbilityNotification(null), 3000);
  effectManager.activateEffect('gold_digger', 20000, undefined, 2000);
  updateActiveEffects();
  break;
```

**Test:**
- Manual test: Each ability shows notification when received

**Verify:**
- For each of 18 abilities, verify notification appears with name, description, category
- Verify notification disappears after 3 seconds

---

### Step 11: Add Duration Timers for Active Effects Display

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx` (or create new component)

**Implementation details:**
1. Find where `activeEffects` are displayed (or create display if missing)
2. For each active effect, show remaining time:

```typescript
// In component render
<div className="active-effects">
  {activeEffects.map(effect => {
    const remaining = effectManager.getRemainingTime(effect.abilityType);
    const seconds = Math.ceil(remaining / 1000);
    return (
      <div key={effect.abilityType} className="effect-badge">
        {ABILITIES[effect.abilityType]?.shortName || effect.abilityType}
        <span className="timer">{seconds}s</span>
      </div>
    );
  })}
</div>
```

3. Update `updateActiveEffects()` to trigger re-render every second for countdown:

```typescript
// Add interval to update display
useEffect(() => {
  if (activeEffects.length === 0) return;

  const interval = setInterval(() => {
    updateActiveEffects();
  }, 1000);

  return () => clearInterval(interval);
}, [activeEffects.length]);
```

**Test:**
- Manual test: Activate duration ability, watch countdown timer

**Verify:**
- Duration timer shows correct seconds remaining
- Timer counts down every second
- Timer disappears when effect expires

---

### Step 12: Verify All Instant Effect Abilities Work

**Files to modify:**
- None (verification step)

**Implementation details:**
Test each instant effect ability manually in both modes:

**Instant Effects to Test:**
- `earthquake`: Check 15-25 blocks removed, gravity applied
- `clear_rows`: Check bottom 5 rows cleared
- `death_cross`: Check diagonals toggle filled↔empty
- `row_rotate`: Check each row rotates randomly
- `fill_holes`: Check enclosed spaces filled

**Test:**
For each ability:
1. Start game (client-auth mode)
2. Earn enough stars (cheat: modify starting stars in code temporarily)
3. Activate ability on opponent
4. Observe board change
5. Repeat in server-auth mode (`?serverAuth=true`)

**Verify:**
- All 5 instant effects work in client-auth mode
- All 5 instant effects work in server-auth mode
- Visual animations play correctly
- Effects match spec descriptions

---

### Step 13: Create Comprehensive Ability Tests

**Files to create:**
- `packages/game-core/src/__tests__/abilities.comprehensive.test.ts`

**Implementation details:**
Create test suite covering all 18 abilities:

```typescript
import { describe, it, expect } from 'vitest';
import { createBoard } from '../engine';
import {
  applyEarthquake,
  applyClearRows,
  applyDeathCross,
  applyRowRotate,
  applyFillHoles,
  applyRandomSpawner,
  applyGoldDigger,
  AbilityEffectManager,
} from '../abilityEffects';
import { ABILITIES } from '../abilities';

describe('Ability System - Comprehensive Tests', () => {
  describe('Instant Board Effects', () => {
    it('earthquake removes 15-25 blocks and applies gravity', () => {
      const board = createBoard(10, 20);
      // Fill bottom half with blocks
      for (let y = 10; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          board.grid[y][x] = 'I';
        }
      }

      const result = applyEarthquake(board);

      // Count remaining blocks
      const before = 100; // 10 rows * 10 columns
      const after = result.grid.flat().filter(c => c !== null).length;
      const removed = before - after;

      expect(removed).toBeGreaterThanOrEqual(15);
      expect(removed).toBeLessThanOrEqual(25);
    });

    it('clear_rows removes bottom 5 rows', () => {
      const board = createBoard(10, 20);
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          board.grid[y][x] = 'T';
        }
      }

      const { board: result, rowsCleared } = applyClearRows(board, 5);

      expect(rowsCleared).toBe(5);
      // Bottom 5 rows should be empty now
      for (let y = 15; y < 20; y++) {
        expect(result.grid[y].every(c => c === null)).toBe(true);
      }
    });

    it('death_cross toggles diagonal cells', () => {
      const board = createBoard(10, 20);
      // Fill board completely
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          board.grid[y][x] = 'I';
        }
      }

      const result = applyDeathCross(board);

      // Check bottom-left to top-right diagonal
      for (let i = 0; i < Math.min(10, 20); i++) {
        const x = i;
        const y = 19 - i;
        if (y >= 0) {
          // Should be null (was filled, now toggled)
          expect(result.grid[y][x]).toBe(null);
        }
      }
    });

    // ... more tests for row_rotate, fill_holes
  });

  describe('Periodic Effects', () => {
    it('random_spawner adds 1-3 blocks to empty cells', () => {
      const board = createBoard(10, 20);

      const result = applyRandomSpawner(board);

      const addedBlocks = result.grid.flat().filter(c => c !== null).length;
      expect(addedBlocks).toBeGreaterThanOrEqual(1);
      expect(addedBlocks).toBeLessThanOrEqual(3);
    });

    it('gold_digger removes 1-3 blocks from filled cells', () => {
      const board = createBoard(10, 20);
      // Fill 20 cells
      for (let i = 10; i < 20; i++) {
        for (let j = 0; j < 2; j++) {
          board.grid[i][j] = 'T';
        }
      }

      const before = board.grid.flat().filter(c => c !== null).length;
      const result = applyGoldDigger(board);
      const after = result.grid.flat().filter(c => c !== null).length;
      const removed = before - after;

      expect(removed).toBeGreaterThanOrEqual(1);
      expect(removed).toBeLessThanOrEqual(3);
    });
  });

  describe('AbilityEffectManager - Duration Tracking', () => {
    it('activates and tracks duration-based effects', () => {
      const manager = new AbilityEffectManager();

      manager.activateEffect('speed_up_opponent', 10000);

      expect(manager.isEffectActive('speed_up_opponent')).toBe(true);
      expect(manager.getRemainingTime('speed_up_opponent')).toBeGreaterThan(9000);
      expect(manager.getRemainingTime('speed_up_opponent')).toBeLessThanOrEqual(10000);
    });

    it('expires effects after duration', async () => {
      const manager = new AbilityEffectManager();

      manager.activateEffect('test_effect', 100);
      expect(manager.isEffectActive('test_effect')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.isEffectActive('test_effect')).toBe(false);
    });

    it('handles periodic triggers correctly', async () => {
      const manager = new AbilityEffectManager();

      manager.activateEffect('random_spawner', 5000, undefined, 1000);

      // Should not trigger immediately
      expect(manager.shouldTriggerPeriodic('random_spawner')).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should trigger after 1 second
      expect(manager.shouldTriggerPeriodic('random_spawner')).toBe(true);

      // Should not trigger again immediately
      expect(manager.shouldTriggerPeriodic('random_spawner')).toBe(false);
    });
  });

  describe('Ability Definitions', () => {
    it('all 18 abilities are defined in ABILITIES', () => {
      const abilityTypes = [
        'screen_shake', 'speed_up_opponent', 'earthquake', 'clear_rows',
        'death_cross', 'row_rotate', 'random_spawner', 'gold_digger',
        'reverse_controls', 'rotation_lock', 'blind_spot', 'shrink_ceiling',
        'weird_shapes', 'mini_blocks', 'cross_firebomb', 'circle_bomb',
        'cascade_multiplier', 'fill_holes',
      ];

      abilityTypes.forEach(type => {
        expect(ABILITIES[type]).toBeDefined();
        expect(ABILITIES[type].name).toBeTruthy();
        expect(ABILITIES[type].cost).toBeGreaterThan(0);
      });
    });

    it('buff abilities have category "buff"', () => {
      const buffAbilities = [
        'mini_blocks', 'cross_firebomb', 'circle_bomb',
        'cascade_multiplier', 'fill_holes', 'clear_rows'
      ];

      buffAbilities.forEach(type => {
        expect(ABILITIES[type].category).toBe('buff');
      });
    });

    it('debuff abilities have category "debuff"', () => {
      const debuffAbilities = [
        'screen_shake', 'speed_up_opponent', 'earthquake',
        'death_cross', 'row_rotate', 'random_spawner', 'gold_digger',
        'reverse_controls', 'rotation_lock', 'blind_spot', 'shrink_ceiling',
        'weird_shapes'
      ];

      debuffAbilities.forEach(type => {
        expect(ABILITIES[type].category).toBe('debuff');
      });
    });
  });
});
```

**Test:**
- Run: `pnpm --filter game-core test abilities.comprehensive`

**Verify:**
- All tests pass
- Coverage includes all 18 abilities
- Tests cover both instant and duration effects

---

### Step 14: Update CLAUDE.md with Ability System Documentation

**Files to modify:**
- `CLAUDE.md`

**Implementation details:**
Add new section after "Common Tasks":

```markdown
## Ability System

### How Abilities Work

Abilities are special powers players can activate during gameplay. There are 18 abilities total:
- **Buffs** (6): Help the player who activates them
- **Debuffs** (12): Hinder the opponent

### Ability Categories

**Instant Board Effects:**
- `earthquake`: Removes 15-25 random blocks
- `clear_rows`: Clears bottom 5 rows
- `death_cross`: Toggles diagonal blocks (filled ↔ empty)
- `row_rotate`: Rotates each row randomly
- `fill_holes`: Fills enclosed empty spaces

**Periodic Effects (2-second interval):**
- `random_spawner`: Adds 1-3 garbage blocks every 2s for 20s
- `gold_digger`: Removes 1-2 blocks every 2s for 20s

**Duration Effects:**
- `speed_up_opponent`: 3x tick rate for 10s
- `reverse_controls`: Swap left/right for 8s
- `rotation_lock`: Disable rotation for 5s
- `blind_spot`: Hide bottom 4 rows for 6s
- `screen_shake`: Visual shake for 10s
- `shrink_ceiling`: Block top 4 rows for 8s

**Buff Abilities:**
- `cross_firebomb`: Current piece explodes in cross pattern on landing
- `circle_bomb`: Current piece explodes in circle on landing
- `cascade_multiplier`: 2x stars on multi-line clears for 15s
- `mini_blocks`: Next 5 pieces are 2-cell dominoes
- `piece_preview_plus`: Show 5 next pieces instead of 3 for 15s
- `deflect_shield`: Block next incoming debuff (one-time use)

**Piece Modifiers:**
- `weird_shapes`: Next piece is 4x4 hollowed shape

### Implementation Patterns

**Adding a New Ability:**

1. Define in `packages/game-core/src/abilities.json`:
```json
{
  "new_ability": {
    "id": "new_ability",
    "type": "new_ability",
    "name": "Ability Name",
    "shortName": "SHORT",
    "description": "What it does",
    "cost": 50,
    "duration": 10000,
    "category": "debuff",
    "unlockLevel": 1,
    "unlockCost": 0
  }
}
```

2. If instant board effect, implement in `packages/game-core/src/abilityEffects.ts`:
```typescript
export function applyNewAbility(board: Board): Board {
  const newGrid = board.grid.map(row => [...row]);
  // ... modify newGrid
  return { ...board, grid: newGrid };
}
```

3. Handle in client (PartykitMultiplayerGame.tsx):
```typescript
// If buff
case 'new_ability':
  const result = applyNewAbility(gameState.board);
  updateBoard(result);
  break;

// If debuff (in handleAbilityReceived)
case 'new_ability':
  const ability = ABILITIES.new_ability;
  setAbilityNotification({...});
  const newBoard = applyNewAbility(gameState.board);
  updateBoard(newBoard);
  break;
```

4. Handle in server (ServerGameState.ts):
```typescript
case 'new_ability':
  this.gameState.board = applyNewAbility(this.gameState.board);
  break;
```

5. Add tests in `packages/game-core/src/__tests__/abilities.comprehensive.test.ts`

### Ability Effect Manager

The `AbilityEffectManager` class tracks active duration-based effects:

```typescript
effectManager.activateEffect('speed_up', 10000); // 10 second duration
effectManager.isEffectActive('speed_up'); // true
effectManager.getRemainingTime('speed_up'); // milliseconds left

// For periodic abilities
effectManager.activateEffect('random_spawner', 20000, undefined, 2000);
effectManager.shouldTriggerPeriodic('random_spawner'); // true every 2 seconds
```

### Testing Abilities

**Run all ability tests:**
```bash
pnpm --filter game-core test abilities
```

**Manual testing with all abilities available:**
Add `?testMode=true` to URL to unlock all abilities in the carousel.
```
http://localhost:5173/?testMode=true
```

### Debugging Abilities

**Check ability activation:**
- Client logs: `[ABILITY]` prefix for activations
- Server logs: `[ABILITY]` prefix for server-side handling

**Common issues:**
- Ability not working: Check if effect function exists in abilityEffects.ts
- Duration not expiring: Check AbilityEffectManager.isEffectActive()
- Periodic ability not triggering: Check shouldTriggerPeriodic() in game loop
- Input modification not working: Check processInput() or keyboard handler
```

**Test:**
- Build docs: Verify markdown renders correctly

**Verify:**
- CLAUDE.md updated with comprehensive ability documentation
- Future contributors can reference this to understand ability system

---

### Step 15: Final Integration Testing & Verification

**Files to modify:**
- None (verification step)

**Implementation details:**
Systematic testing of all 18 abilities in both modes following spec acceptance criteria:

**Test Matrix:**
For each ability, verify in BOTH modes (client-auth and server-auth):
1. Can activate (stars deducted)
2. Effect applies to correct target
3. Effect is observable
4. Duration persists (if applicable)
5. Notification appears
6. Visual feedback present

**Scenario 1: Instant Effect Abilities**
- earthquake, clear_rows, death_cross, row_rotate, fill_holes
- GIVEN Player A has 10+ stars
- WHEN Player A uses ability on Player B
- THEN stars deducted, board changes immediately, notification shown

**Scenario 2: Duration-Based Abilities**
- speed_up_opponent, reverse_controls, rotation_lock, blind_spot, shrink_ceiling
- GIVEN ability activated
- THEN effect persists for full duration, timer shows countdown, effect ends after duration

**Scenario 3: Periodic Abilities**
- random_spawner, gold_digger
- GIVEN ability activated
- THEN effect triggers every 2 seconds for full duration
- WHEN duration expires, THEN triggers stop

**Scenario 4: Buff Abilities**
- cascade_multiplier, piece_preview_plus, deflect_shield, cross_firebomb, circle_bomb, mini_blocks
- GIVEN ability activated on self
- THEN effect applies to self, not opponent
- AND effect is observable (preview expands, stars multiply, bomb explodes, etc.)

**Scenario 5: Deflect Shield**
- GIVEN Player A activates deflect_shield (2 stars)
- WHEN Player B uses earthquake on Player A
- THEN earthquake has no effect, notification shows "Deflected: Earthquake"
- AND deflect_shield is consumed
- WHEN Player B uses second ability
- THEN second ability hits normally

**Test:**
Create manual test checklist:
```
Client-Auth Mode:
☐ earthquake - instant board effect
☐ clear_rows - clears 5 rows
☐ death_cross - diagonal toggle
☐ row_rotate - rows rotate
☐ fill_holes - fills enclosed spaces
☐ random_spawner - triggers every 2s
☐ gold_digger - triggers every 2s
☐ speed_up_opponent - 3x speed for 10s
☐ reverse_controls - swaps left/right for 8s
☐ rotation_lock - blocks rotation for 5s
☐ blind_spot - hides bottom 4 rows for 6s
☐ screen_shake - visual shake for 10s
☐ shrink_ceiling - blocks top 4 rows for 8s
☐ cascade_multiplier - 2x stars on multi-line for 15s
☐ piece_preview_plus - shows 5 pieces for 15s
☐ deflect_shield - blocks next debuff
☐ cross_firebomb - cross explosion on landing
☐ circle_bomb - circle explosion on landing
☐ mini_blocks - 5 small pieces

Server-Auth Mode (?serverAuth=true):
☐ [repeat all 18 above]
```

**Verify:**
- ✅ 18/18 abilities fully functional
- ✅ 100% of abilities show visual feedback
- ✅ 100% of abilities work in both modes
- ✅ 0 abilities with unclear effects
- ✅ All acceptance criteria from spec met

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| **Effect exists**: Code implements described effect | Steps 1-9 |
| **Target correct**: Applies to intended player | Steps 3-5 (buffs), 6-9 (debuffs) |
| **Duration works**: Time-based effects persist | Steps 1, 2, 6-9 |
| **Cost correct**: Deducts right amount of stars | Step 1 (JSON), existing server validation |
| **Visual feedback**: Player sees confirmation | Steps 10-11 |
| **Observable impact**: Effect clearly visible | Steps 12, 15 |
| **Instant effects functional** | Steps 12, 15 (earthquake, clear_rows, death_cross, row_rotate, fill_holes) |
| **Duration effects functional** | Steps 6-7, 15 (speed_up, reverse_controls, rotation_lock, blind_spot, shrink_ceiling) |
| **Periodic effects functional** | Steps 8-9, 15 (random_spawner, gold_digger) |
| **Buff effects functional** | Steps 3-5, 15 (cascade_multiplier, piece_preview_plus, deflect_shield, bombs, mini_blocks) |
| **Both modes work** | Steps 6-9, 12, 15 (separate client-auth and server-auth implementations) |
| **Notifications for all** | Step 10 |
| **Duration timers** | Step 11 |
| **Deflect shield blocks debuff** | Step 5, 15 |
| **Scenario 1: Instant effects** | Step 15 |
| **Scenario 2: Duration effects** | Step 15 |
| **Scenario 3: Periodic effects** | Step 15 |
| **Scenario 4: Buff abilities** | Step 15 |
| **Scenario 5: Deflect shield** | Step 15 |

## Build/Test Commands

**Build:**
```bash
pnpm --filter game-core build      # Build shared game logic
pnpm --filter web build            # Build web client
pnpm --filter partykit build       # Build server (if applicable)
pnpm build:all                     # Build all packages
```

**Test:**
```bash
pnpm --filter game-core test                    # Run all game-core tests
pnpm --filter game-core test abilities          # Run ability tests only
pnpm --filter game-core test:watch              # Watch mode
pnpm --filter game-core test:ui                 # UI mode
```

**Dev:**
```bash
pnpm dev                           # Start dev server (web + partykit)
```

**Test URLs:**
- Client-auth mode: `http://localhost:5173/`
- Server-auth mode: `http://localhost:5173/?serverAuth=true`
- All abilities unlocked: `http://localhost:5173/?testMode=true`

## Dependencies Between Steps

```
Step 1 (Fix JSON durations)
  ↓
Step 2 (Add periodic trigger support)
  ↓
Step 3-5 (Implement missing buffs)
  ↓
Step 6-7 (Implement input modification)
  ↓
Step 8-9 (Implement periodic triggers)
  ↓
Step 10 (Add notifications)
  ↓
Step 11 (Add duration timers)
  ↓
Step 12 (Verify instant effects)
  ↓
Step 13 (Create tests)
  ↓
Step 14 (Update docs)
  ↓
Step 15 (Final integration testing)
```

Steps 3-9 can be parallelized (independent implementations).
Steps 10-11 can be done in parallel.
Steps 12-14 can be done in parallel.
Step 15 must be last.
