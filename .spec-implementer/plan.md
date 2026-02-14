# Implementation Plan for Spec 003: AI Balancing and Ability System

## Overview
- Total steps: 12
- Estimated new files: 2
- Estimated modified files: 5
- Build command: `cd /Users/biubiu/projects/tetris-battle && pnpm build:all`
- Test command: `cd /Users/biubiu/projects/tetris-battle/packages/game-core && pnpm test`

## Steps

### Step 1: Add PlayerMetrics Type Definition

**Files to modify:**
- `packages/game-core/src/types.ts`

**Implementation details:**
After the `GameState` interface (around line 37), add:

```typescript
// AI Player Metrics for adaptive difficulty
export interface PlayerMetrics {
  averagePPM: number;         // Pieces per minute
  averageLockTime: number;    // Milliseconds to lock piece
  averageBoardHeight: number; // Average filled rows
  mistakeRate: number;        // 0-1, fraction of suboptimal moves
  pieceCount: number;         // Total pieces locked
  totalLockTime: number;      // Sum of all lock times (for rolling average)
  lastUpdateTime: number;     // Timestamp of last metrics update
}

export function createInitialPlayerMetrics(): PlayerMetrics {
  return {
    averagePPM: 30,           // Default ~1 piece every 2 seconds
    averageLockTime: 2000,    // Default 2 seconds
    averageBoardHeight: 8,    // Default mid-board
    mistakeRate: 0.3,         // Default moderate mistakes
    pieceCount: 0,
    totalLockTime: 0,
    lastUpdateTime: Date.now(),
  };
}
```

**Test:**
- Build game-core: `cd packages/game-core && pnpm build`
- Verify no TypeScript errors

**Verify:**
- Type definition exports correctly
- `createInitialPlayerMetrics()` returns valid object

---

### Step 2: Create Adaptive AI Logic

**Files to create:**
- `packages/game-core/src/ai/adaptiveAI.ts`

**Implementation details:**
Create new file with the following content (follow the pattern from aiPlayer.ts):

```typescript
import type { Board, Tetromino, Position, PlayerMetrics } from '../types';
import type { AIMove, AIDecision, AIWeights } from './aiPlayer';
import {
  findBestPlacement,
  generateMoves,
  evaluateBoard,
} from './aiPlayer';
import { isValidPosition, getHardDropPosition } from '../engine';

/**
 * Adaptive AI that mirrors player skill level
 */
export class AdaptiveAI {
  playerMetrics: PlayerMetrics;
  baseMistakeRate: number = 0.35; // 35% base mistake rate

  constructor(playerMetrics: PlayerMetrics) {
    this.playerMetrics = playerMetrics;
  }

  /**
   * Update player metrics for adaptation
   */
  updatePlayerMetrics(metrics: PlayerMetrics): void {
    this.playerMetrics = metrics;
  }

  /**
   * Calculate move delay to mirror player speed (±20% variance)
   */
  decideMoveDelay(): number {
    const baseDelay = Math.max(100, this.playerMetrics.averageLockTime);
    const variance = baseDelay * 0.2;
    const delay = baseDelay + (Math.random() * variance * 2 - variance);

    // Make AI slightly faster (10% advantage) to compensate for perfect execution
    return Math.max(80, delay * 0.9);
  }

  /**
   * Decide if AI should make an intentional mistake
   */
  shouldMakeMistake(): boolean {
    // Combine base mistake rate with player's mistake rate
    const totalRate = Math.min(0.8, this.baseMistakeRate + this.playerMetrics.mistakeRate);
    return Math.random() < totalRate;
  }

  /**
   * Find a reasonable (non-optimal) move
   */
  findReasonableMove(board: Board, piece: Tetromino): AIDecision {
    // Use weaker weights than optimal
    const reasonableWeights: AIWeights = {
      aggregateHeight: -0.3,  // Don't care as much about height
      completeLines: 6,       // Still prioritize line clears
      holes: -4,              // Avoid holes but not obsessively
      bumpiness: -0.2,        // Don't care much about smoothness
    };

    return findBestPlacement(board, piece, reasonableWeights);
  }

  /**
   * Make an intentional mistake
   */
  makeIntentionalMistake(board: Board, piece: Tetromino): AIDecision {
    const mistakeType = Math.random();

    if (mistakeType < 0.4) {
      // Random placement (40% of mistakes)
      return this.randomPlacement(board, piece);
    } else if (mistakeType < 0.7) {
      // Off-by-one error (30% of mistakes)
      return this.offByOnePlacement(board, piece);
    } else {
      // Skip rotation (30% of mistakes)
      return this.noRotationPlacement(board, piece);
    }
  }

  private randomPlacement(board: Board, piece: Tetromino): AIDecision {
    // Place piece at a random valid column
    const validColumns: number[] = [];

    for (let x = -2; x < board.width + 2; x++) {
      const movedPiece = { ...piece, position: { x, y: piece.position.y } };
      if (isValidPosition(board, movedPiece)) {
        validColumns.push(x);
      }
    }

    if (validColumns.length === 0) {
      return this.findReasonableMove(board, piece);
    }

    const randomX = validColumns[Math.floor(Math.random() * validColumns.length)];
    const movedPiece = { ...piece, position: { x: randomX, y: piece.position.y } };
    const finalPosition = getHardDropPosition(board, movedPiece);

    return {
      moves: generateMoves(piece, finalPosition, piece.rotation),
      targetPosition: finalPosition,
      targetRotation: piece.rotation,
      score: -1000,
    };
  }

  private offByOnePlacement(board: Board, piece: Tetromino): AIDecision {
    // Find best placement, then shift it 1 column left or right
    const bestDecision = this.findReasonableMove(board, piece);
    const offset = Math.random() < 0.5 ? -1 : 1;
    const newX = bestDecision.targetPosition.x + offset;

    // Validate the offset position
    const offsetPiece = { ...piece, position: { x: newX, y: piece.position.y }, rotation: bestDecision.targetRotation };

    for (let r = 0; r < bestDecision.targetRotation; r++) {
      // Apply rotations (simplified - just use the rotation count)
    }

    if (isValidPosition(board, { ...offsetPiece, position: { x: newX, y: offsetPiece.position.y } })) {
      const finalPosition = getHardDropPosition(board, { ...offsetPiece, position: { x: newX, y: offsetPiece.position.y } });
      return {
        moves: generateMoves(piece, finalPosition, bestDecision.targetRotation),
        targetPosition: finalPosition,
        targetRotation: bestDecision.targetRotation,
        score: -500,
      };
    }

    // If offset invalid, fall back to best move
    return bestDecision;
  }

  private noRotationPlacement(board: Board, piece: Tetromino): AIDecision {
    // Use piece without rotation
    const noRotationWeights: AIWeights = {
      aggregateHeight: -0.3,
      completeLines: 6,
      holes: -4,
      bumpiness: -0.2,
    };

    // Only try rotation 0
    let bestScore = -Infinity;
    let bestPlacement: AIDecision | null = null;

    for (let x = -2; x < board.width + 2; x++) {
      const movedPiece = { ...piece, position: { x, y: piece.position.y }, rotation: 0 };

      if (!isValidPosition(board, movedPiece)) {
        continue;
      }

      const finalPosition = getHardDropPosition(board, movedPiece);
      const evaluation = evaluateBoard(board);
      const score = evaluation.completeLines * noRotationWeights.completeLines;

      if (score > bestScore) {
        bestScore = score;
        bestPlacement = {
          moves: generateMoves(piece, finalPosition, 0),
          targetPosition: finalPosition,
          targetRotation: 0,
          score,
        };
      }
    }

    return bestPlacement || this.findReasonableMove(board, piece);
  }

  /**
   * Main decision function - decides move quality based on metrics
   */
  findMove(board: Board, piece: Tetromino): AIDecision {
    if (this.shouldMakeMistake()) {
      return this.makeIntentionalMistake(board, piece);
    }
    return this.findReasonableMove(board, piece);
  }
}
```

**Test:**
- Build: `cd packages/game-core && pnpm build`
- No test file yet (will add in next step)

**Verify:**
- TypeScript compiles
- AdaptiveAI class exports correctly

---

### Step 3: Add Tests for Adaptive AI

**Files to create:**
- `packages/game-core/src/ai/__tests__/adaptiveAI.test.ts`

**Implementation details:**
Follow the pattern from `aiPlayer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AdaptiveAI } from '../adaptiveAI';
import { createInitialPlayerMetrics } from '../../types';
import { createTetromino } from '../../tetrominos';
import { createBoard } from '../../engine';

describe('AdaptiveAI', () => {
  it('should calculate move delay based on player metrics', () => {
    const metrics = createInitialPlayerMetrics();
    metrics.averageLockTime = 2000; // 2 seconds

    const ai = new AdaptiveAI(metrics);
    const delay = ai.decideMoveDelay();

    // Should be within ±20% of base delay (2000ms), then reduced by 10%
    // So: 2000 * 0.9 = 1800, with variance of ±360
    expect(delay).toBeGreaterThanOrEqual(1440);
    expect(delay).toBeLessThanOrEqual(2160);
  });

  it('should make mistakes based on player mistake rate', () => {
    const metrics = createInitialPlayerMetrics();
    metrics.mistakeRate = 0.5; // 50% player mistakes

    const ai = new AdaptiveAI(metrics);

    // Test 100 decisions, expect ~85% mistakes (35% base + 50% player)
    let mistakeCount = 0;
    for (let i = 0; i < 100; i++) {
      if (ai.shouldMakeMistake()) {
        mistakeCount++;
      }
    }

    // Should be around 80-90 mistakes (allowing for randomness)
    expect(mistakeCount).toBeGreaterThanOrEqual(70);
    expect(mistakeCount).toBeLessThanOrEqual(95);
  });

  it('should find reasonable moves (not optimal)', () => {
    const board = createBoard(10, 20);
    const piece = createTetromino('I', 10);
    const metrics = createInitialPlayerMetrics();

    const ai = new AdaptiveAI(metrics);
    const decision = ai.findReasonableMove(board, piece);

    expect(decision).toBeDefined();
    expect(decision.moves).toHaveLength(1); // Just hard drop on empty board
    expect(decision.targetPosition).toBeDefined();
  });

  it('should make random placement mistakes', () => {
    const board = createBoard(10, 20);
    const piece = createTetromino('T', 10);
    const metrics = createInitialPlayerMetrics();

    const ai = new AdaptiveAI(metrics);
    const decision = ai.makeIntentionalMistake(board, piece);

    expect(decision).toBeDefined();
    expect(decision.score).toBeLessThan(0); // Mistakes have negative score
  });
});
```

**Test:**
- Run: `cd packages/game-core && pnpm test -- adaptiveAI`
- All 4 tests should pass

**Verify:**
- Tests pass
- Coverage for key functions

---

### Step 4: Export Adaptive AI from game-core

**Files to modify:**
- `packages/game-core/src/ai/index.ts`
- `packages/game-core/src/index.ts`

**Implementation details:**

In `packages/game-core/src/ai/index.ts`, add:
```typescript
export { AdaptiveAI } from './adaptiveAI';
```

In `packages/game-core/src/index.ts`, add to existing exports:
```typescript
export { AdaptiveAI } from './ai/adaptiveAI';
export { createInitialPlayerMetrics } from './types';
export type { PlayerMetrics } from './types';
```

**Test:**
- Build all: `cd /Users/biubiu/projects/tetris-battle && pnpm build:all`

**Verify:**
- No build errors
- Exports available in web package

---

### Step 5: Add Player Metrics Tracking to Game Server

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

1. At the top, import new types (around line 1-19):
```typescript
import {
  // ... existing imports
  createInitialPlayerMetrics,
  AdaptiveAI,
  type PlayerMetrics,
} from '@tetris-battle/game-core';
```

2. Update `PlayerState` interface (around line 30-34):
```typescript
interface PlayerState {
  playerId: string;
  connectionId: string;
  gameState: GameState | null;
  metrics: PlayerMetrics;        // NEW
  lastPieceLockTime: number;     // NEW
}
```

3. In `GameRoomServer` class, add fields (around line 42-47):
```typescript
export default class GameRoomServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();
  roomStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winnerId: string | null = null;

  // AI fields
  aiPlayer: AIPersona | null = null;
  aiGameState: CoreGameState | null = null;
  aiInterval: ReturnType<typeof setInterval> | null = null;
  aiMoveQueue: AIMove[] = [];
  aiLastMoveTime: number = 0;
  adaptiveAI: AdaptiveAI | null = null;  // NEW
  aiAbilityLoadout: string[] = [];       // NEW - AI's available abilities
  aiLastAbilityUse: number = 0;          // NEW - timestamp of last ability
```

4. In `handleJoinGame` (around line 83-88), update player initialization:
```typescript
this.players.set(playerId, {
  playerId,
  connectionId: conn.id,
  gameState: null,
  metrics: createInitialPlayerMetrics(),  // NEW
  lastPieceLockTime: Date.now(),          // NEW
});
```

5. In `startAIGameLoop` (around line 129-141), initialize AdaptiveAI:
```typescript
startAIGameLoop() {
  if (!this.aiPlayer) return;

  // Get human player for metrics
  const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
  if (!humanPlayer) return;

  // Initialize adaptive AI with player metrics
  this.adaptiveAI = new AdaptiveAI(humanPlayer.metrics);

  // Initialize AI game state
  this.aiGameState = createInitialGameState();
  // ... rest of existing code
```

6. In the AI game loop (around line 150-153), use adaptive move delay:
```typescript
const now = Date.now();

// Use adaptive move delay
const moveDelay = this.adaptiveAI ? this.adaptiveAI.decideMoveDelay() : 300;

if (now - this.aiLastMoveTime < moveDelay) {
  return;
}
```

7. In AI decision logic (around line 155-163), use adaptive AI:
```typescript
// If no moves queued, decide next placement
if (this.aiMoveQueue.length === 0 && this.adaptiveAI) {
  const decision = this.adaptiveAI.findMove(
    this.aiGameState.board,
    this.aiGameState.currentPiece
  );
  this.aiMoveQueue = decision.moves;
}
```

**Test:**
- Build partykit: `cd packages/partykit && pnpm build`

**Verify:**
- No TypeScript errors
- Server compiles successfully

---

### Step 6: Update Player Metrics on Game State Updates

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

In `handleGameStateUpdate` (around line 241-258), add metrics tracking:

```typescript
handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
  const player = this.players.get(playerId);
  if (!player) return;

  const previousState = player.gameState;
  player.gameState = state;

  // Update player metrics if piece was locked (new piece spawned)
  if (previousState && previousState.currentPiece && state.currentPiece) {
    const pieceLocked = (
      previousState.currentPiece.position.y !== state.currentPiece.position.y ||
      previousState.currentPiece.type !== state.currentPiece.type
    );

    if (pieceLocked) {
      const now = Date.now();
      const lockTime = now - player.lastPieceLockTime;
      player.lastPieceLockTime = now;

      // Update metrics (rolling average)
      const metrics = player.metrics;
      metrics.pieceCount++;
      metrics.totalLockTime += lockTime;
      metrics.averageLockTime = metrics.totalLockTime / metrics.pieceCount;

      // Calculate PPM (pieces per minute)
      const elapsedMinutes = (now - metrics.lastUpdateTime) / 60000;
      if (elapsedMinutes > 0) {
        metrics.averagePPM = metrics.pieceCount / elapsedMinutes;
      }

      // Calculate average board height
      const boardHeight = this.calculateBoardHeight(state.board);
      if (metrics.pieceCount === 1) {
        metrics.averageBoardHeight = boardHeight;
      } else {
        // Exponential moving average (favor recent data)
        metrics.averageBoardHeight = metrics.averageBoardHeight * 0.9 + boardHeight * 0.1;
      }

      // Update adaptive AI with new metrics
      if (this.adaptiveAI) {
        this.adaptiveAI.updatePlayerMetrics(metrics);
      }
    }
  }

  // Broadcast to opponent (existing code)
  const opponent = this.getOpponent(playerId);
  if (opponent) {
    const opponentConn = this.getConnection(opponent.connectionId);
    if (opponentConn) {
      opponentConn.send(JSON.stringify({
        type: 'opponent_state_update',
        state,
      }));
    }
  }
}
```

Add helper method in GameRoomServer class:

```typescript
calculateBoardHeight(board: any): number {
  if (!board || !board.grid) return 0;

  let maxHeight = 0;
  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      if (board.grid[y][x] !== null) {
        maxHeight = Math.max(maxHeight, board.height - y);
        break;
      }
    }
  }
  return maxHeight;
}
```

**Test:**
- Build partykit: `cd packages/partykit && pnpm build`

**Verify:**
- No TypeScript errors
- Metrics update logic compiles

---

### Step 7: Implement Ability Effects on AI Board

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

Import ability effect functions at top (around line 1-19):
```typescript
import {
  // ... existing imports
  applyEarthquake,
  applyClearRows,
  applyBomb,
  applyRandomSpawner,
  applyRowRotate,
  applyDeathCross,
  applyGoldDigger,
} from '@tetris-battle/game-core';
```

Replace `handleAbilityActivation` (around line 274-286) with:

```typescript
handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
  const targetPlayer = this.players.get(targetPlayerId);
  if (!targetPlayer) return;

  // If target is AI, apply ability to AI board directly
  if (this.aiPlayer && targetPlayerId === this.aiPlayer.id && this.aiGameState) {
    this.applyAbilityToAI(abilityType);
    return;
  }

  // If target is human player, send ability_received message
  const targetConn = this.getConnection(targetPlayer.connectionId);
  if (targetConn) {
    targetConn.send(JSON.stringify({
      type: 'ability_received',
      abilityType,
      fromPlayerId: playerId,
    }));
  }
}

applyAbilityToAI(abilityType: string) {
  if (!this.aiGameState) return;

  console.log(`Applying ability ${abilityType} to AI`);

  // Store board before ability for verification
  const boardBefore = JSON.stringify(this.aiGameState.board.grid);

  switch (abilityType) {
    case 'earthquake':
      this.aiGameState.board = applyEarthquake(this.aiGameState.board);
      break;

    case 'clear_rows':
      const { board: clearedBoard, rowsCleared } = applyClearRows(this.aiGameState.board, 5);
      this.aiGameState.board = clearedBoard;
      break;

    case 'cross_firebomb':
    case 'circle_bomb':
      // These are player buffs, not debuffs - shouldn't target AI
      console.warn(`Buff ability ${abilityType} sent to AI - ignoring`);
      break;

    case 'random_spawner':
      this.aiGameState.board = applyRandomSpawner(this.aiGameState.board);
      break;

    case 'row_rotate':
      this.aiGameState.board = applyRowRotate(this.aiGameState.board);
      break;

    case 'death_cross':
      this.aiGameState.board = applyDeathCross(this.aiGameState.board);
      break;

    case 'gold_digger':
      this.aiGameState.board = applyGoldDigger(this.aiGameState.board);
      break;

    // Time-based debuffs (handled client-side for human players)
    case 'speed_up_opponent':
    case 'reverse_controls':
    case 'rotation_lock':
    case 'blind_spot':
    case 'screen_shake':
    case 'shrink_ceiling':
    case 'cascade_multiplier':
      // For AI, we can apply these as instant effects or ignore
      console.log(`Time-based ability ${abilityType} on AI - not implemented yet`);
      break;

    default:
      console.warn(`Unknown ability type: ${abilityType}`);
  }

  // Clear AI move queue to force re-planning with new board state
  this.aiMoveQueue = [];

  // Check if board actually changed
  const boardAfter = JSON.stringify(this.aiGameState.board.grid);
  if (boardBefore !== boardAfter) {
    console.log(`AI board modified by ${abilityType}`);
  }

  // Broadcast updated AI state to human player immediately
  this.broadcastAIState();
}

broadcastAIState() {
  if (!this.aiGameState || !this.aiPlayer) return;

  const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
  if (!humanPlayer) return;

  const conn = this.getConnection(humanPlayer.connectionId);
  if (!conn) return;

  conn.send(JSON.stringify({
    type: 'opponent_state_update',
    state: {
      board: this.aiGameState.board.grid,
      score: this.aiGameState.score,
      stars: this.aiGameState.stars,
      linesCleared: this.aiGameState.linesCleared,
      comboCount: this.aiGameState.comboCount || 0,
      isGameOver: this.aiGameState.isGameOver,
      currentPiece: this.aiGameState.currentPiece,
    },
  }));
}
```

**Test:**
- Build partykit: `cd packages/partykit && pnpm build`

**Verify:**
- No TypeScript errors
- All ability effect imports resolve

---

### Step 8: Implement AI Ability Usage - Decision Logic

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

1. In `startAIGameLoop`, set up AI ability loadout (around line 129-141):

```typescript
startAIGameLoop() {
  // ... existing initialization code

  // Set AI ability loadout (match player's unlocked abilities)
  // For now, use a simple set of abilities available to level 1+ players
  this.aiAbilityLoadout = [
    'earthquake',
    'random_spawner',
    'death_cross',
    'row_rotate',
    'gold_digger',
  ];
  this.aiLastAbilityUse = Date.now();

  // ... rest of existing code
}
```

2. In the AI game loop interval (around line 200-210, after piece lock), add ability decision:

```typescript
case 'hard_drop':
  // ... existing hard_drop logic

  // After clearing lines, update AI stars
  this.aiGameState.stars += linesCleared * 10; // Simplified star earning

  // Spawn next piece
  this.aiGameState.currentPiece = createTetromino(
    this.aiGameState.nextPieces[0],
    this.aiGameState.board.width
  );
  this.aiGameState.nextPieces.shift();
  this.aiGameState.nextPieces.push(getRandomTetromino());

  // Check game over
  if (!isValidPosition(this.aiGameState.board, this.aiGameState.currentPiece)) {
    this.aiGameState.isGameOver = true;
    this.handleGameOver(this.aiPlayer!.id);
  }

  // AI ability usage decision (after locking piece)
  this.aiConsiderUsingAbility();

  break;
```

3. Add `aiConsiderUsingAbility` method to GameRoomServer class:

```typescript
aiConsiderUsingAbility() {
  if (!this.aiGameState || !this.aiPlayer || this.aiAbilityLoadout.length === 0) {
    return;
  }

  const now = Date.now();
  const timeSinceLastAbility = now - this.aiLastAbilityUse;

  // Cooldown: 10-30 seconds between abilities
  const minCooldown = 10000;
  const cooldownVariance = 20000;
  const cooldown = minCooldown + Math.random() * cooldownVariance;

  if (timeSinceLastAbility < cooldown) {
    return;
  }

  // Need enough stars (30-80)
  const abilityCost = 30 + Math.floor(Math.random() * 50);
  if (this.aiGameState.stars < abilityCost) {
    return;
  }

  // Get human player state
  const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
  if (!humanPlayer || !humanPlayer.gameState) {
    return;
  }

  // Decide: offensive (player is winning) or defensive (AI is losing)
  const aiHeight = this.calculateBoardHeight(this.aiGameState.board);
  const playerHeight = humanPlayer.gameState.board ? this.calculateBoardHeight(humanPlayer.gameState.board) : 0;

  const useAbility = Math.random() < 0.3; // 30% chance to use ability when available
  if (!useAbility) {
    return;
  }

  // Pick random ability from loadout
  const abilityType = this.aiAbilityLoadout[Math.floor(Math.random() * this.aiAbilityLoadout.length)];

  console.log(`AI using ability: ${abilityType} (${this.aiGameState.stars} stars)`);

  // Spend stars
  this.aiGameState.stars -= abilityCost;
  this.aiLastAbilityUse = now;

  // Send ability to human player
  const humanConn = this.getConnection(humanPlayer.connectionId);
  if (humanConn) {
    humanConn.send(JSON.stringify({
      type: 'ability_received',
      abilityType,
      fromPlayerId: this.aiPlayer.id,
    }));
  }
}
```

**Test:**
- Build partykit: `cd packages/partykit && pnpm build`

**Verify:**
- No TypeScript errors
- Ability decision logic compiles

---

### Step 9: Update AI Persona to Remove Difficulty

**Files to modify:**
- `packages/game-core/src/ai/aiPersona.ts`

**Implementation details:**

Change `generateAIPersona` function (around line 20-57):

```typescript
export function generateAIPersona(targetRank?: number): AIPersona {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

  // All AI uses 'medium' difficulty (will be overridden by adaptive AI)
  // Rank still used for matchmaking
  let rank: number;

  if (targetRank) {
    // Match rank to target within ±200
    rank = targetRank + Math.floor(Math.random() * 400) - 200;
    rank = Math.max(200, Math.min(2200, rank)); // Clamp to valid range
  } else {
    // Random rank
    rank = 500 + Math.floor(Math.random() * 1500);
  }

  return {
    id: `bot_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    difficulty: 'medium', // Always medium (ignored by adaptive AI)
    rank,
    isBot: true,
  };
}
```

**Test:**
- Build game-core: `cd packages/game-core && pnpm build`

**Verify:**
- `generateAIPersona()` always returns 'medium' difficulty
- Rank still varies appropriately

---

### Step 10: Remove Difficulty from UI (if shown)

**Files to check and potentially modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`
- `packages/web/src/components/MainMenu.tsx`

**Implementation details:**

Search for any UI showing "Easy/Medium/Hard" difficulty selection for AI matches. If found, remove or simplify to "Play vs AI".

Check `packages/web/src/components/MainMenu.tsx` for any difficulty selector. If it exists, remove it.

**Test:**
- Build web: `cd packages/web && pnpm build`

**Verify:**
- No UI references to Easy/Medium/Hard difficulty

---

### Step 11: Add Integration Tests

**Files to create:**
- `packages/game-core/src/ai/__tests__/integration.test.ts`

**Implementation details:**

```typescript
import { describe, it, expect } from 'vitest';
import { AdaptiveAI } from '../adaptiveAI';
import { createInitialPlayerMetrics } from '../../types';
import { createTetromino } from '../../tetrominos';
import { createBoard } from '../../engine';

describe('AI Integration Tests', () => {
  it('should adapt to slow player', () => {
    const slowMetrics = createInitialPlayerMetrics();
    slowMetrics.averageLockTime = 5000; // 5 seconds per piece
    slowMetrics.mistakeRate = 0.6;      // 60% mistakes

    const ai = new AdaptiveAI(slowMetrics);

    // Move delay should be ~4500ms (5000 * 0.9)
    const delay = ai.decideMoveDelay();
    expect(delay).toBeGreaterThan(3000);
    expect(delay).toBeLessThan(6000);

    // Should make lots of mistakes
    let mistakes = 0;
    for (let i = 0; i < 100; i++) {
      if (ai.shouldMakeMistake()) mistakes++;
    }
    expect(mistakes).toBeGreaterThan(70); // > 70% mistake rate
  });

  it('should adapt to fast player', () => {
    const fastMetrics = createInitialPlayerMetrics();
    fastMetrics.averageLockTime = 1000; // 1 second per piece
    fastMetrics.mistakeRate = 0.1;      // 10% mistakes

    const ai = new AdaptiveAI(fastMetrics);

    // Move delay should be ~900ms (1000 * 0.9)
    const delay = ai.decideMoveDelay();
    expect(delay).toBeGreaterThan(500);
    expect(delay).toBeLessThan(1500);

    // Should make fewer mistakes
    let mistakes = 0;
    for (let i = 0; i < 100; i++) {
      if (ai.shouldMakeMistake()) mistakes++;
    }
    expect(mistakes).toBeLessThan(60); // < 60% mistake rate (35% base + 10% player)
  });

  it('should make valid moves even when making mistakes', () => {
    const board = createBoard(10, 20);
    const piece = createTetromino('T', 10);
    const metrics = createInitialPlayerMetrics();

    const ai = new AdaptiveAI(metrics);

    // Run 10 decisions (mix of good and bad moves)
    for (let i = 0; i < 10; i++) {
      const decision = ai.findMove(board, piece);

      expect(decision).toBeDefined();
      expect(decision.moves).toBeDefined();
      expect(decision.moves.length).toBeGreaterThan(0);
      expect(decision.targetPosition).toBeDefined();
    }
  });
});
```

**Test:**
- Run: `cd packages/game-core && pnpm test`
- All tests should pass

**Verify:**
- Integration tests pass
- Adaptive AI works end-to-end

---

### Step 12: Final Build and Smoke Test

**Files to test:**
- All packages

**Implementation details:**

Run full build:
```bash
cd /Users/biubiu/projects/tetris-battle
pnpm build:all
```

Run all tests:
```bash
cd packages/game-core
pnpm test
```

**Verify:**
- All builds succeed
- All tests pass
- No TypeScript errors
- No console warnings

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| "Win rate: 45-55% (tested over 100 games)" | Steps 2-3 (adaptive AI with mirroring) - NEEDS_MANUAL_TEST |
| "All player abilities visibly affect AI board" | Step 7 (ability effects on AI) |
| "AI uses 2-4 abilities per match on average" | Step 8 (AI ability usage) - NEEDS_MANUAL_TEST |
| "AI feels like similar skill human opponent" | Steps 2-3, 5-6 (adaptive mirroring) - NEEDS_MANUAL_TEST |
| "Player metrics tracked (PPM, lock time, board height)" | Step 6 (metrics tracking) |
| "AI makes mistakes (30-40% base rate)" | Steps 2-3 (mistake logic) |
| "Difficulty tiers removed" | Step 9 (remove difficulty) |
| "AI earns and spends stars" | Step 8 (star management) |

## Build/Test Commands
- Build all: `cd /Users/biubiu/projects/tetris-battle && pnpm build:all`
- Test game-core: `cd /Users/biubiu/projects/tetris-battle/packages/game-core && pnpm test`
- Run dev server: `cd /Users/biubiu/projects/tetris-battle && pnpm dev`
