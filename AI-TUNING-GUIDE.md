# AI Tuning Guide - Tetris Battle

## How AI Makes Decisions

### 1. Board Evaluation (packages/game-core/src/ai/adaptiveAI.ts:52-61)

AI evaluates every possible placement using **4 weighted metrics**:

```typescript
const reasonableWeights: AIWeights = {
  aggregateHeight: -0.3,  // Penalty for tall stacks
  completeLines: 6,       // Reward for completing lines
  holes: -4,              // Penalty for creating holes
  bumpiness: -0.2,        // Penalty for uneven surface
};
```

**Score formula**:
```
score = (aggregateHeight × -0.3) + (completeLines × 6) + (holes × -4) + (bumpiness × -0.2)
```

Higher score = better placement

### 2. Mistake System (adaptiveAI.ts:43-80)

AI intentionally makes mistakes 15% of the time:

```typescript
baseMistakeRate: 0.15  // 15% chance per piece
```

**Mistake types**:
- **40%** - Random placement: Pick any valid column
- **30%** - Off-by-one: Best placement ±1 column
- **30%** - No rotation: Use piece without rotating

### 3. Move Timing (adaptiveAI.ts:30-37)

AI mirrors player speed with slight advantage:

```typescript
decideMoveDelay(): number {
  const baseDelay = Math.max(100, this.playerMetrics.averageLockTime);
  const variance = baseDelay * 0.2; // ±20% randomness
  const delay = baseDelay + (Math.random() * variance * 2 - variance);

  return Math.max(80, delay * 0.9); // 10% faster than player
}
```

**Example**: If player takes 300ms to make moves:
- AI takes 270ms ±54ms = **216-324ms per move**

### 4. Gravity System (packages/partykit/src/game.ts:187)

```typescript
const GRAVITY_INTERVAL = 1000; // 1 second between falls
```

Pieces fall automatically every 1 second, just like human players.

## Tunable Parameters

### Difficulty (adaptiveAI.ts:15)

```typescript
baseMistakeRate: 0.15  // Current: 15%
```

**Difficulty levels**:
- 0.05 (5%) - Very Hard
- 0.10 (10%) - Hard
- **0.15 (15%)** - **Current: Balanced**
- 0.20 (20%) - Medium
- 0.30 (30%) - Easy
- 0.50 (50%) - Very Easy

### Strategy Weights (adaptiveAI.ts:54-58)

**Current weights** (reasonable AI):
```typescript
aggregateHeight: -0.3,  // Penalty for height
completeLines: 6,       // Reward for lines
holes: -4,              // Penalty for holes
bumpiness: -0.2,        // Penalty for bumpiness
```

**Optimal AI** (too good):
```typescript
aggregateHeight: -0.51,  // Care more about height
completeLines: 8,        // Strongly prioritize lines
holes: -8,               // Avoid holes obsessively
bumpiness: -0.18,        // Smooth surface important
```

**Weak AI** (too bad):
```typescript
aggregateHeight: -0.1,   // Don't care about height
completeLines: 3,        // Barely care about lines
holes: -1,               // Holes are fine
bumpiness: -0.05,        // Bumpy is ok
```

### Move Speed (adaptiveAI.ts:36)

```typescript
return Math.max(80, delay * 0.9);  // Current: 10% faster than player
```

**Speed multipliers**:
- `0.7` - 30% faster (aggressive)
- `0.8` - 20% faster (fast)
- **`0.9`** - **Current: 10% faster (balanced)**
- `1.0` - Same speed as player
- `1.2` - 20% slower (passive)

### Gravity Speed (game.ts:187)

```typescript
const GRAVITY_INTERVAL = 1000;  // Current: 1 second
```

**Options**:
- `500` - 0.5 seconds (too fast)
- `800` - 0.8 seconds (fast)
- **`1000`** - **Current: 1 second (standard Tetris)**
- `1500` - 1.5 seconds (slow, more time to position)
- `2000` - 2 seconds (very slow)

### AI Ability Loadout (game.ts:159-165)

```typescript
this.aiAbilityLoadout = [
  'earthquake',      // Shift rows
  'random_spawner',  // Add garbage
  'death_cross',     // Toggle blocks (OVERPOWERED - clears board!)
  'row_rotate',      // Rotate rows
  'gold_digger',     // Remove blocks continuously
];
```

**Recommended balanced loadout**:
```typescript
this.aiAbilityLoadout = [
  'earthquake',       // Debuff: Shift rows (moderate)
  'random_spawner',   // Debuff: Add garbage blocks (moderate)
  'row_rotate',       // Debuff: Rotate rows (moderate)
  'speed_up_opponent', // Debuff: 3x speed (strong but fair)
  'screen_shake',     // Debuff: Visual distraction (weak)
];
```

## Current Bugs

### Bug 1: death_cross Clears Entire Board

**Problem**: death_cross toggles all blocks (filled → empty, empty → filled)
- Result: Player's entire board gets cleared

**Fix**: Remove death_cross and gold_digger from AI loadout

### Bug 2: AI Barely Moves Pieces

**Problem**: Gravity too fast relative to move execution
- Gravity: 1000ms (piece falls)
- Move delay: 216-324ms per move
- Moves needed: 3-5 moves
- Total time: 648-1620ms
- **Result**: Piece falls (1000ms) before AI finishes moving (1620ms)

**Fix**: Execute moves instantly (no delay between moves), only delay between pieces

## Recommended Fixes

### 1. Fix AI Ability Loadout
Replace overpowered abilities with balanced ones.

### 2. Fix Move Execution Timing
- Execute all moves for current piece immediately
- Only delay between pieces (match gravity timing)

### 3. Adjust Difficulty
- Keep 15% mistake rate
- Slightly reduce board evaluation weights for more human-like play
