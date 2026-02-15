# Spec 011: Implement Missing Buff Abilities

## Status
🔴 **CRITICAL** - 7 buff abilities have no server implementation, debug panel has broken targeting

## Problem

### Current Issues
1. **Buff abilities send messages but have no effect** - circle_bomb, mini_blocks, cross_firebomb, fill_holes, cascade_multiplier, deflect_shield, piece_preview_plus all trigger network messages but server ignores them
2. **weird_shapes is broken** - Sets activeEffect flag but doesn't actually generate 4x4 hollowed pieces
3. **Debug panel targeting is confusing** - Self/opponent selector exists but buffs should always target self, debuffs should always target opponent
4. **No opponent event logging** - When you use weird_shapes on opponent, they see no debug event

## Missing Buff Abilities (7 Total)

### ❌ **Not Implemented**
1. **circle_bomb** - Piece becomes bomb, clears radius of 3 cells
2. **mini_blocks** - Next 5 pieces are 2-cell dominoes
3. **cross_firebomb** - Piece becomes bomb, clears 3 rows + 3 columns
4. **fill_holes** - Fill all empty spaces surrounded by blocks
5. **cascade_multiplier** - Double star earnings for 15s
6. **deflect_shield** - Block next incoming debuff
7. **piece_preview_plus** - Show 5 pieces instead of 3

### 🐛 **Broken**
8. **weird_shapes** - Flag set but piece generation unchanged

## Requirements

### 1. Implement Server-Side Buff Abilities

#### A. Bomb Abilities (circle_bomb, cross_firebomb)
These transform the current piece into a bomb that clears blocks when locked.

**ServerGameState.ts changes:**
```typescript
// Add to class properties
private bombMode: { type: 'circle' | 'cross' } | null = null;

// In applyAbility() - these target the PLAYER, not opponent
case 'circle_bomb':
  this.bombMode = { type: 'circle' };
  break;

case 'cross_firebomb':
  this.bombMode = { type: 'cross' };
  break;

// In lockPiece() - after piece locks, check for bomb
private lockPiece() {
  // ... existing lock logic ...

  // Check for bomb mode
  if (this.bombMode) {
    const centerX = this.gameState.currentPiece.position.x + 1;
    const centerY = this.gameState.currentPiece.position.y + 1;

    if (this.bombMode.type === 'circle') {
      this.gameState.board = applyCircleBomb(
        this.gameState.board,
        centerX,
        centerY,
        3 // radius
      );
    } else {
      this.gameState.board = applyCrossBomb(
        this.gameState.board,
        centerX,
        centerY,
        3 // size (3 rows + 3 cols)
      );
    }

    this.bombMode = null;
  }

  // ... existing spawn next piece logic ...
}
```

**game-core/src/abilityEffects.ts - Add new functions:**
```typescript
export function applyCircleBomb(board: Board, centerX: number, centerY: number, radius: number): Board {
  const newGrid = board.grid.map(row => [...row]);

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (distance <= radius) {
        newGrid[y][x] = null;
      }
    }
  }

  return { ...board, grid: newGrid };
}

export function applyCrossBomb(board: Board, centerX: number, centerY: number, size: number): Board {
  const newGrid = board.grid.map(row => [...row]);

  // Clear horizontal rows
  for (let dy = -size; dy <= size; dy++) {
    const y = centerY + dy;
    if (y >= 0 && y < board.height) {
      for (let x = 0; x < board.width; x++) {
        newGrid[y][x] = null;
      }
    }
  }

  // Clear vertical columns
  for (let dx = -size; dx <= size; dx++) {
    const x = centerX + dx;
    if (x >= 0 && x < board.width) {
      for (let y = 0; y < board.height; y++) {
        newGrid[y][x] = null;
      }
    }
  }

  return { ...board, grid: newGrid };
}
```

#### B. Mini Blocks
Spawns 2-cell domino pieces for next 5 pieces.

**ServerGameState.ts changes:**
```typescript
// Add property
private miniBlocksRemaining: number = 0;

// In applyAbility()
case 'mini_blocks':
  this.miniBlocksRemaining = 5;
  break;

// In lockPiece() - when spawning next piece
if (this.miniBlocksRemaining > 0) {
  this.gameState.currentPiece = createMiniBlock(this.gameState.board.width);
  this.miniBlocksRemaining--;
} else {
  const nextType = this.gameState.nextPieces[0];
  this.gameState.currentPiece = createTetromino(nextType, this.gameState.board.width);
  this.gameState.nextPieces.shift();
  this.gameState.nextPieces.push(getRandomTetrominoSeeded(this.rng));
}
```

**game-core/src/tetrominos.ts - Add:**
```typescript
export function createMiniBlock(boardWidth: number): Tetromino {
  // Random 2-cell domino: horizontal or vertical
  const isHorizontal = Math.random() > 0.5;

  return {
    type: 'I', // Reuse I piece visuals
    position: { x: Math.floor(boardWidth / 2) - 1, y: 0 },
    rotation: 0,
    shape: isHorizontal
      ? [[1, 1]]
      : [[1], [1]],
  };
}
```

#### C. Fill Holes
Fills all empty cells surrounded by filled cells.

**ServerGameState.ts:**
```typescript
case 'fill_holes':
  this.gameState.board = applyFillHoles(this.gameState.board);
  break;
```

**game-core/src/abilityEffects.ts:**
```typescript
export function applyFillHoles(board: Board): Board {
  const newGrid = board.grid.map(row => [...row]);

  for (let y = 1; y < board.height - 1; y++) {
    for (let x = 1; x < board.width - 1; x++) {
      if (newGrid[y][x] === null) {
        // Check if surrounded (at least 3 of 4 directions)
        const top = newGrid[y - 1][x] !== null;
        const bottom = newGrid[y + 1][x] !== null;
        const left = newGrid[y][x - 1] !== null;
        const right = newGrid[y][x + 1] !== null;

        const surrounded = [top, bottom, left, right].filter(Boolean).length >= 3;

        if (surrounded) {
          newGrid[y][x] = 'I'; // Fill with generic block
        }
      }
    }
  }

  return { ...board, grid: newGrid };
}
```

#### D. Cascade Multiplier
Doubles star earnings for 15 seconds.

**ServerGameState.ts:**
```typescript
// In lockPiece() - after calculating stars
if (linesCleared > 0) {
  let starsEarned = calculateStars(linesCleared, this.gameState.comboCount);

  // Check for cascade multiplier
  if (this.activeEffects.has('cascade_multiplier')) {
    const endTime = this.activeEffects.get('cascade_multiplier')!;
    if (Date.now() < endTime) {
      starsEarned *= 2;
    } else {
      this.activeEffects.delete('cascade_multiplier');
    }
  }

  this.gameState.stars = Math.min(
    STAR_VALUES.maxCapacity,
    this.gameState.stars + starsEarned
  );
}

// In applyAbility()
case 'cascade_multiplier':
  this.activeEffects.set('cascade_multiplier', Date.now() + 15000);
  break;
```

#### E. Deflect Shield
Blocks the next incoming debuff.

**ServerGameState.ts:**
```typescript
// Add property
private shieldActive: boolean = false;

// In applyAbility() - at the START, check shield
applyAbility(abilityType: string): void {
  // Check if shield blocks this ability
  if (this.shieldActive && this.isDebuff(abilityType)) {
    console.log(`[ServerGameState] Shield blocked ${abilityType}`);
    this.shieldActive = false;
    return; // Don't apply the debuff
  }

  switch (abilityType) {
    case 'deflect_shield':
      this.shieldActive = true;
      break;
    // ... rest of abilities
  }
}

private isDebuff(abilityType: string): boolean {
  const debuffs = [
    'earthquake', 'random_spawner', 'row_rotate', 'death_cross',
    'gold_digger', 'speed_up_opponent', 'reverse_controls',
    'rotation_lock', 'blind_spot', 'screen_shake', 'shrink_ceiling',
    'weird_shapes'
  ];
  return debuffs.includes(abilityType);
}
```

#### F. Piece Preview Plus
Shows 5 pieces instead of 3 in preview.

**ServerGameState.ts:**
```typescript
// This is CLIENT-SIDE only, just track it
case 'piece_preview_plus':
  this.activeEffects.set('piece_preview_plus', Date.now() + 15000);
  break;
```

**Client will render more pieces when this effect is active.**

#### G. Fix weird_shapes
Actually generate 4x4 hollowed piece.

**ServerGameState.ts:**
```typescript
// In lockPiece() - when spawning next piece
if (this.activeEffects.has('weird_shapes')) {
  this.gameState.currentPiece = createWeirdShape(this.gameState.board.width);
  this.activeEffects.delete('weird_shapes');
} else if (this.miniBlocksRemaining > 0) {
  // ... mini blocks logic
} else {
  // ... normal piece logic
}
```

**game-core/src/tetrominos.ts:**
```typescript
export function createWeirdShape(boardWidth: number): Tetromino {
  // 4x4 hollowed square
  return {
    type: 'O', // Reuse O piece visuals
    position: { x: Math.floor(boardWidth / 2) - 2, y: 0 },
    rotation: 0,
    shape: [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
  };
}
```

### 2. Fix Debug Panel Targeting

**DebugPanel.tsx changes:**
```typescript
onAbilityTrigger={(abilityType, target) => {
  const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
  if (!ability) return;

  // Auto-determine target based on category
  const actualTarget = ability.category === 'buff' ? 'self' : 'opponent';

  if (actualTarget === 'opponent') {
    handleAbilityActivate(ability);
  } else {
    // Self-targeting abilities - trigger on own state
    console.log('[DEBUG] Self-ability trigger:', abilityType);
    // Send ability activation to server for self
    gameClientRef.current?.activateAbility(abilityType, playerId);
  }
}}
```

**AbilityTriggers.tsx - Remove target selector:**
```typescript
// Remove the radio buttons for self/opponent
// Always use correct target based on ability.category
const handleTrigger = (abilityType: string) => {
  const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
  const target = ability.category === 'buff' ? 'self' : 'opponent';
  onTrigger(abilityType, target);
};
```

### 3. Add Opponent Event Logging for Received Abilities

**ServerAuthGameClient.ts - in message handler:**
```typescript
case 'ability_received':
  if (onAbilityReceived) {
    onAbilityReceived(data.abilityType, data.fromPlayerId);
  }
  // Log in debug mode
  if (this.debugLogger) {
    const ability = ABILITIES[data.abilityType as keyof typeof ABILITIES];
    this.debugLogger.logEvent(
      'ability_received',
      `Received ${ability?.name || data.abilityType} from opponent`,
      { abilityType: data.abilityType, from: data.fromPlayerId }
    );
  }
  break;
```

### 4. Export New Functions

**game-core/src/abilityEffects.ts:**
```typescript
export {
  // ... existing exports
  applyCircleBomb,
  applyCrossBomb,
  applyFillHoles,
};
```

**game-core/src/tetrominos.ts:**
```typescript
export {
  // ... existing exports
  createMiniBlock,
  createWeirdShape,
};
```

**game-core/src/index.ts:**
```typescript
export {
  // ... existing exports
  applyCircleBomb,
  applyCrossBomb,
  applyFillHoles,
  createMiniBlock,
  createWeirdShape,
} from './abilityEffects';
```

## Unit Tests

### Test File: `packages/partykit/src/__tests__/ServerGameState.buff-abilities.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ServerGameState } from '../ServerGameState';

describe('ServerGameState - Buff Abilities', () => {
  let state: ServerGameState;

  beforeEach(() => {
    state = new ServerGameState('player1', 12345, []);
    // Lock a few pieces to have blocks on board
    for (let i = 0; i < 5; i++) {
      state.processInput('hard_drop');
    }
  });

  describe('Bomb Abilities', () => {
    it('should apply circle_bomb - clears radius on lock', () => {
      const blocksBefore = countBlocks(state.gameState.board.grid);

      state.applyAbility('circle_bomb');
      state.processInput('hard_drop'); // Lock the bomb piece

      const blocksAfter = countBlocks(state.gameState.board.grid);
      expect(blocksAfter).toBeLessThan(blocksBefore);
    });

    it('should apply cross_firebomb - clears cross pattern', () => {
      const blocksBefore = countBlocks(state.gameState.board.grid);

      state.applyAbility('cross_firebomb');
      state.processInput('hard_drop');

      const blocksAfter = countBlocks(state.gameState.board.grid);
      expect(blocksAfter).toBeLessThan(blocksBefore);
    });

    it('should reset bomb mode after lock', () => {
      state.applyAbility('circle_bomb');
      state.processInput('hard_drop');

      // Next piece should not be a bomb
      const blocksBefore = countBlocks(state.gameState.board.grid);
      state.processInput('hard_drop');
      const blocksAfter = countBlocks(state.gameState.board.grid);

      // Should add blocks, not remove (normal piece)
      expect(blocksAfter).toBeGreaterThanOrEqual(blocksBefore);
    });
  });

  describe('Mini Blocks', () => {
    it('should spawn 5 mini blocks', () => {
      state.applyAbility('mini_blocks');

      for (let i = 0; i < 5; i++) {
        const piece = state.gameState.currentPiece;
        expect(piece).toBeDefined();

        // Mini block should be 2 cells max
        const cellCount = piece!.shape.flat().filter(c => c === 1).length;
        expect(cellCount).toBeLessThanOrEqual(2);

        state.processInput('hard_drop');
      }

      // 6th piece should be normal
      const normalPiece = state.gameState.currentPiece;
      const normalCells = normalPiece!.shape.flat().filter(c => c === 1).length;
      expect(normalCells).toBeGreaterThan(2);
    });
  });

  describe('Fill Holes', () => {
    it('should fill surrounded empty cells', () => {
      // Create a board with holes
      const grid = state.gameState.board.grid;
      grid[19][5] = 'I';
      grid[18][4] = 'I';
      grid[18][5] = null; // Hole
      grid[18][6] = 'I';
      grid[17][5] = 'I';

      state.applyAbility('fill_holes');

      // Hole at [18][5] should now be filled
      expect(grid[18][5]).not.toBeNull();
    });
  });

  describe('Cascade Multiplier', () => {
    it('should double stars earned for 15s', () => {
      // Set up for a line clear
      const row = state.gameState.board.grid[19];
      for (let x = 0; x < 9; x++) {
        row[x] = 'I';
      }

      state.applyAbility('cascade_multiplier');

      const starsBefore = state.gameState.stars;

      // Position piece to complete line
      while (state.gameState.currentPiece!.position.x > 9) {
        state.processInput('move_left');
      }
      state.processInput('hard_drop');

      const starsAfter = state.gameState.stars;
      const starsEarned = starsAfter - starsBefore;

      // Should earn more than normal (doubled)
      expect(starsEarned).toBeGreaterThan(0);
      expect(state.getActiveEffects()).toContain('cascade_multiplier');
    });

    it('should stop doubling after 15s', () => {
      state.applyAbility('cascade_multiplier');

      // Manually expire
      state.activeEffects.set('cascade_multiplier', Date.now() - 1000);

      expect(state.getActiveEffects()).not.toContain('cascade_multiplier');
    });
  });

  describe('Deflect Shield', () => {
    it('should block next incoming debuff', () => {
      state.applyAbility('deflect_shield');

      // Try to apply a debuff
      const tickRateBefore = state.tickRate;
      state.applyAbility('speed_up_opponent');

      // Should still be normal speed (shield blocked it)
      expect(state.tickRate).toBe(tickRateBefore);

      // Shield should be consumed
      // Next debuff should work
      state.applyAbility('speed_up_opponent');
      expect(state.tickRate).not.toBe(tickRateBefore);
    });

    it('should not block buffs, only debuffs', () => {
      state.applyAbility('deflect_shield');

      // Buffs should still work
      state.applyAbility('cascade_multiplier');
      expect(state.getActiveEffects()).toContain('cascade_multiplier');
    });
  });

  describe('Piece Preview Plus', () => {
    it('should activate preview effect', () => {
      state.applyAbility('piece_preview_plus');

      expect(state.getActiveEffects()).toContain('piece_preview_plus');
    });

    it('should expire after 15s', () => {
      state.applyAbility('piece_preview_plus');

      state.activeEffects.set('piece_preview_plus', Date.now() - 1000);

      expect(state.getActiveEffects()).not.toContain('piece_preview_plus');
    });
  });

  describe('Weird Shapes - Fixed', () => {
    it('should spawn 4x4 hollowed piece', () => {
      state.applyAbility('weird_shapes');

      // Lock current piece to trigger weird shape spawn
      state.processInput('hard_drop');

      const piece = state.gameState.currentPiece!;

      // Should be 4x4 shape
      expect(piece.shape.length).toBe(4);
      expect(piece.shape[0].length).toBe(4);

      // Should be hollowed (center 2x2 empty)
      expect(piece.shape[1][1]).toBe(0);
      expect(piece.shape[1][2]).toBe(0);
      expect(piece.shape[2][1]).toBe(0);
      expect(piece.shape[2][2]).toBe(0);

      // Outer edges should be filled
      expect(piece.shape[0][0]).toBe(1);
      expect(piece.shape[3][3]).toBe(1);
    });

    it('should only affect next piece', () => {
      state.applyAbility('weird_shapes');
      state.processInput('hard_drop');

      // Next piece after weird shape should be normal
      state.processInput('hard_drop');
      const normalPiece = state.gameState.currentPiece!;

      expect(normalPiece.shape.length).toBeLessThanOrEqual(4);
      expect(normalPiece.shape[0].length).toBeLessThanOrEqual(4);
    });
  });
});

function countBlocks(grid: any[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  return count;
}
```

## Acceptance Criteria

### Server Implementation
- [ ] circle_bomb clears radius of 3 cells when piece locks
- [ ] cross_firebomb clears 3 rows + 3 columns when piece locks
- [ ] mini_blocks spawns 5 domino pieces (2 cells each)
- [ ] fill_holes fills all surrounded empty cells
- [ ] cascade_multiplier doubles stars for 15 seconds
- [ ] deflect_shield blocks next incoming debuff
- [ ] piece_preview_plus tracked in activeEffects
- [ ] weird_shapes spawns actual 4x4 hollowed piece

### Debug Panel
- [ ] Remove self/opponent selector
- [ ] Buffs auto-target self
- [ ] Debuffs auto-target opponent
- [ ] Clear UX showing which abilities affect whom

### Event Logging
- [ ] Opponent sees debug event when receiving abilities
- [ ] Events show ability name and source player
- [ ] Events appear in real-time during gameplay

### Tests
- [ ] All 36 existing tests still pass
- [ ] 15+ new tests for buff abilities pass
- [ ] Tests can be run locally with `pnpm test`
- [ ] Edge cases covered (expired effects, shield consumed, etc.)

## Files to Modify

### partykit package
- `src/ServerGameState.ts` - Add all buff ability logic
- `src/__tests__/ServerGameState.buff-abilities.test.ts` - New test file

### game-core package
- `src/abilityEffects.ts` - Add applyCircleBomb, applyCrossBomb, applyFillHoles
- `src/tetrominos.ts` - Add createMiniBlock, createWeirdShape
- `src/index.ts` - Export new functions

### web package
- `src/components/debug/DebugPanel.tsx` - Auto-target based on category
- `src/components/debug/AbilityTriggers.tsx` - Remove selector
- `src/services/partykit/ServerAuthGameClient.ts` - Add received ability logging

## Success Metrics

1. **All 7 buff abilities work** - Visible effect when activated
2. **Tests pass** - 50+ tests covering all abilities
3. **Debug panel clear** - No confusion about targeting
4. **Event logging complete** - Both players see ability usage in debug mode

## Implementation Notes

- Bomb abilities require tracking `bombMode` flag and checking it in `lockPiece()`
- Mini blocks and weird shapes require overriding normal piece generation
- Cascade multiplier needs to check activeEffect when calculating stars
- Deflect shield must check at START of applyAbility() before applying effect
- All buff abilities target the player themselves, not opponent
- Client-side rendering may need updates for piece_preview_plus (shows 5 pieces)
