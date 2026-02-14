# Research Summary for Spec 001: AI Players

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/game-core` - Platform-agnostic game engine (TypeScript)
  - `packages/web` - React frontend with Vite
  - `packages/partykit` - WebSocket multiplayer server
- **Build**: TypeScript compiler (`tsc`)
  - game-core: `pnpm --filter game-core build` (tsc)
  - web: `pnpm --filter web build` (tsc -b && vite build)
- **Tests**: No test framework currently configured (need to add vitest/jest)

## Existing Patterns

### Imports
All packages use ES modules:
```typescript
// Barrel exports pattern in game-core
export * from './types';
export * from './engine';
export * from './abilities';

// Cross-package imports in web
import { createBoard, movePiece, rotatePiece } from '@tetris-battle/game-core';

// Relative imports within package
import type { GameState, Tetromino } from './types';
```

### State Management
No Zustand stores in game-core (pure functions only). Web uses Zustand:
```typescript
// packages/web/src/stores/gameStore.ts
export const useGameStore = create<GameStore>((set) => ({
  // state fields
  // actions that call game-core functions
}));
```

### Game Engine (game-core)
Pure functional approach - all engine functions are stateless:
```typescript
// Example from engine.ts:210
export function getHardDropPosition(board: Board, piece: Tetromino): Position {
  let dropPiece = { ...piece };
  while (isValidPosition(board, movePiece(dropPiece, 0, 1))) {
    dropPiece = movePiece(dropPiece, 0, 1);
  }
  return dropPiece.position;
}
```

Key engine functions available:
- `isValidPosition(board, piece)` - collision detection
- `movePiece(piece, dx, dy)` - returns new piece with updated position
- `rotatePiece(piece, clockwise)` - returns rotated piece
- `lockPiece(board, piece)` - returns new board with piece locked
- `clearLines(board)` - returns { board, linesCleared }
- `getHardDropPosition(board, piece)` - returns final drop position

### Server Messages (Partykit)
JSON messages over WebSocket:
```typescript
// Matchmaking flow (packages/partykit/src/matchmaking.ts:20-26)
onMessage(message: string, sender: Party.Connection) {
  const data = JSON.parse(message);
  if (data.type === 'join_queue') { /* ... */ }
  else if (data.type === 'leave_queue') { /* ... */ }
}

// Game room messages (packages/partykit/src/game.ts:39-55)
switch (data.type) {
  case 'join_game': /* ... */
  case 'game_state_update': /* ... */
  case 'ability_activation': /* ... */
  case 'game_over': /* ... */
}
```

Message format pattern:
```typescript
// Client -> Server
{ type: 'join_queue', playerId: string }
{ type: 'game_state_update', playerId: string, state: GameState }
{ type: 'ability_activation', playerId: string, abilityType: string, targetPlayerId: string }

// Server -> Client
{ type: 'match_found', roomId: string, player1: string, player2: string }
{ type: 'opponent_state_update', state: GameState }
{ type: 'ability_received', abilityType: string, fromPlayerId: string }
```

### Database (Progression)
Uses Supabase (via packages/web/src/lib/supabase.ts). Key schemas from progression.ts:

```typescript
// UserProfile (progression.ts:4-17)
interface UserProfile {
  userId: string; // Clerk user ID
  username: string;
  level: number;
  xp: number;
  coins: number;
  rank: number;
  gamesPlayed: number;
  // ...
}

// MatchResult (progression.ts:19-33)
interface MatchResult {
  id: string;
  userId: string;
  opponentId: string; // ← AI will use "bot_<name>" prefix
  outcome: 'win' | 'loss' | 'draw';
  linesCleared: number;
  abilitiesUsed: number;
  coinsEarned: number;
  xpEarned: number;
  rankChange: number;
  // ...
}
```

### Tests
No tests exist in game-core yet. Need to:
1. Add vitest as devDependency to game-core
2. Create test setup following vitest conventions
3. Place tests in `packages/game-core/src/ai/__tests__/`

## Analogous Flow: Matchmaking → Game → Rewards

### 1. Matchmaking (packages/partykit/src/matchmaking.ts:29-53)
```typescript
handleJoinQueue(playerId: string, conn: Party.Connection) {
  this.queue.push({ id: playerId, connectionId: conn.id, joinedAt: Date.now() });
  conn.send(JSON.stringify({ type: 'queue_joined', position: this.queue.length }));
  this.tryMatch(); // ← Matches first 2 players in queue
}

tryMatch() {
  if (this.queue.length < 2) return;
  const player1 = this.queue.shift()!;
  const player2 = this.queue.shift()!;
  const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Send match_found to both players
  conn1.send(JSON.stringify({ type: 'match_found', roomId, player1: player1.id, player2: player2.id }));
  conn2.send(JSON.stringify({ type: 'match_found', roomId, player1: player1.id, player2: player2.id }));
}
```

**AI Integration Point**: After 10 seconds in queue, create AI match instead of waiting for player2.

### 2. Game Room (packages/partykit/src/game.ts)
Players connect to room, send game state updates:
```typescript
handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
  player.gameState = state;

  // Broadcast to opponent
  const opponent = this.getOpponent(playerId);
  opponentConn.send(JSON.stringify({ type: 'opponent_state_update', state }));
}
```

**AI Integration Point**: Server needs to run AI game loop and broadcast AI state updates using same message format.

### 3. Abilities (packages/partykit/src/game.ts:121-133)
```typescript
handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
  const targetConn = this.getConnection(targetPlayer.connectionId);
  targetConn.send(JSON.stringify({
    type: 'ability_received',
    abilityType,
    fromPlayerId: playerId,
  }));
}
```

**AI Integration Point**: AI needs to receive abilities and apply effects to its game state. AI (medium/hard) should also use abilities.

### 4. Rewards (packages/web/src/lib/rewards.ts:19-128)
```typescript
async function awardMatchRewards(userId, outcome, linesCleared, abilitiesUsed, matchDuration, opponentId) {
  // Calculate coins/XP
  const totalCoins = baseCoins + performanceBonus + streakBonus + firstWinBonus;
  const totalXp = baseXp + winBonus;

  // Save match result
  await progressionService.saveMatchResult({
    userId,
    opponentId, // ← For AI: "bot_TetrisBot_42"
    outcome,
    linesCleared,
    abilitiesUsed,
    coinsEarned: totalCoins,
    xpEarned: totalXp,
    rankChange: 0,
    // ...
  });

  // Update user profile
  await progressionService.updateUserProfile(userId, { coins: newCoins, xp: newXp, level: newLevel });
}
```

**AI Integration Point**: Reduce rewards to 50% for AI matches, set rankChange to 0.

## Integration Points

### New Files to Create
1. **packages/game-core/src/ai/aiPlayer.ts** - Core AI logic
2. **packages/game-core/src/ai/aiDifficulty.ts** - Difficulty presets (easy/medium/hard)
3. **packages/game-core/src/ai/aiPersona.ts** - Bot name/rank generation
4. **packages/game-core/src/ai/index.ts** - Barrel export
5. **packages/game-core/src/ai/__tests__/aiPlayer.test.ts** - AI tests
6. **packages/game-core/src/ai/__tests__/aiDifficulty.test.ts** - Difficulty tests

### Existing Files to Modify

1. **packages/game-core/src/index.ts** (line 8, add):
   ```typescript
   export * from './ai';
   ```

2. **packages/partykit/src/matchmaking.ts**:
   - Add timeout tracking to `QueuedPlayer` interface (line 3)
   - Modify `handleJoinQueue` to track join time (line 29)
   - Add `checkAIFallback` method to create AI matches after 10s
   - Call `checkAIFallback` in `tryMatch` (line 59)

3. **packages/partykit/src/game.ts**:
   - Add `aiGameState` and `aiInterval` fields to class
   - Add `startAIGameLoop` method to run AI logic
   - Modify `handleJoinGame` to detect AI matches and start AI loop (line 58)
   - Modify `handleAbilityActivation` to handle AI receiving abilities (line 121)
   - Add AI state broadcast in game loop

4. **packages/web/src/components/PartykitMatchmaking.tsx** (line 109-112):
   - Add timer state to track queue duration
   - Show "Expanding search..." after 8 seconds
   - Keep existing "Finding Opponent..." message

5. **packages/web/src/components/PostMatchScreen.tsx**:
   - Add `isAiMatch: boolean` prop
   - Modify reward display to show "(AI Match - 50%)" when applicable
   - No changes to rank display (already shows +0 for no rank change)

6. **packages/web/src/lib/rewards.ts** (awardMatchRewards function, line 26):
   - Add `isAiMatch: boolean` parameter
   - Multiply coins/XP by 0.5 if isAiMatch
   - Set rankChange to 0 if isAiMatch

7. **packages/game-core/package.json**:
   - Add vitest devDependency
   - Add test script

## Key Files to Reference During Implementation

### Phase 3 Reference Files
- **packages/game-core/src/engine.ts** - All game engine functions
- **packages/game-core/src/types.ts** - Type definitions
- **packages/game-core/src/tetrominos.ts** - Piece shapes and types
- **packages/partykit/src/matchmaking.ts** - Matchmaking flow
- **packages/partykit/src/game.ts** - Game room message handling
- **packages/game-core/src/progression.ts** - Rank/XP/coin values

### AI Implementation Notes
1. AI evaluates moves by simulating each placement and scoring the resulting board
2. Scoring weights are tunable per difficulty (aggregateHeight, holes, bumpiness, completeLines)
3. AI returns MOVES (left/right/rotate/drop), not final board state
4. AI game loop runs on Partykit server, not as a WebSocket client
5. AI personas have `isBot: true` flag but it's not exposed to opponent client

## Test Framework Setup Needed

Add to packages/game-core/package.json:
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui"
  }
}
```

Create vitest.config.ts in packages/game-core:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```
