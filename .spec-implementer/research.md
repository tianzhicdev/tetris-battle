# Research Summary for Spec 003: AI Balancing and Ability System

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/game-core` - Core game logic, AI, abilities (TypeScript)
  - `packages/partykit` - Multiplayer server (Partykit)
  - `packages/web` - React frontend (Vite + React + TypeScript)
- **Build**:
  - Core: `pnpm --filter game-core build` (tsc)
  - Web: `pnpm --filter web build` (vite)
  - All: `pnpm build:all`
- **Tests**:
  - Framework: vitest (in game-core)
  - Command: `pnpm --filter game-core test`

## Existing Patterns

### Imports
- Core packages use explicit imports: `import { X } from '@tetris-battle/game-core'`
- Web packages use relative imports for local files: `import { X } from '../services/Y'`
- Barrel exports in `packages/game-core/src/index.ts` expose public API

### AI Architecture (Current)

**File: `packages/game-core/src/ai/aiPlayer.ts`**
- `findBestPlacement()` - Evaluates all possible piece placements using weights
- `evaluateBoard()` - Calculates aggregateHeight, completeLines, holes, bumpiness
- `scoreBoard()` - Applies weights to board evaluation (negative for bad, positive for good)

**File: `packages/game-core/src/ai/aiDifficulty.ts`**
```typescript
export const AI_DIFFICULTIES: Record<AIDifficultyLevel, AIDifficultyConfig> = {
  easy: {
    weights: { aggregateHeight: -0.3, completeLines: 5, holes: -3, bumpiness: -0.2 },
    moveDelay: 300,
    randomMoveChance: 0.3,
  },
  medium: { moveDelay: 150, randomMoveChance: 0.1, ... },
  hard: { moveDelay: 80, randomMoveChance: 0, ... },
};
```

**File: `packages/partykit/src/game.ts`** (lines 129-239)
- AI game loop runs in `setInterval()` every 50ms
- Checks `moveDelay` to throttle moves based on difficulty
- Uses `findBestPlacement()` to queue moves
- Executes queued moves (left/right/rotate/hard_drop)
- Broadcasts AI state to human opponent via `opponent_state_update` message
- State sent includes: `{ board: grid, score, stars, linesCleared, comboCount, isGameOver, currentPiece }`

### Ability System

**File: `packages/game-core/src/abilityEffects.ts`**
- Board modification functions: `applyEarthquake()`, `applyClearRows()`, `applyBomb()`, etc.
- All functions take `board: Board` and return modified `Board`
- Gravity helper: `applyGravity()` makes floating blocks fall after clearing
- No current integration with AI - these only affect player boards

**File: `packages/game-core/src/abilities.json`**
- 18 abilities total (6 buffs, 12 debuffs)
- Each has: `id`, `type`, `name`, `cost`, `duration?`, `category`, `unlockLevel`
- Example: `"earthquake": { cost: 65, category: "debuff", duration: undefined }`

**File: `packages/partykit/src/game.ts`** (lines 274-286)
```typescript
handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
  const targetPlayer = this.players.get(targetPlayerId);
  const targetConn = this.getConnection(targetPlayer.connectionId);
  targetConn.send(JSON.stringify({
    type: 'ability_received',
    abilityType,
    fromPlayerId: playerId,
  }));
}
```
- **Issue**: Ability is sent to client, but AI has `connectionId: 'ai'` (no real connection)
- AI board state is managed server-side, not updated when ability received

### State Management

**File: `packages/game-core/src/types.ts`**
```typescript
export interface GameState {
  board: Board;
  currentPiece: Tetromino | null;
  nextPieces: TetrominoType[];
  score: number;
  stars: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  lastClearTime: number;
  comboCount: number;
  bombType: 'cross' | 'circle' | null;
}

export interface Board {
  grid: CellValue[][];
  width: number;
  height: number;
}
```

**Star earning** (from types.ts lines 106-115):
```typescript
export const STAR_VALUES = {
  single: 5,
  double: 12,
  triple: 25,
  tetris: 50,
  comboBonus: 1,
};
```

### Server Message Patterns

**Message Types** (from game.ts):
- Client → Server: `'join_game'`, `'game_state_update'`, `'ability_activation'`, `'game_over'`
- Server → Client: `'game_start'`, `'opponent_state_update'`, `'ability_received'`, `'game_finished'`

**Example: game.ts:220-236** (Broadcasting AI state)
```typescript
conn.send(JSON.stringify({
  type: 'opponent_state_update',
  state: {
    board: this.aiGameState.board.grid,
    score: this.aiGameState.score,
    stars: this.aiGameState.stars,
    ...
  },
}));
```

### Tests

**File: `packages/game-core/src/ai/__tests__/aiPlayer.test.ts`**
- Uses vitest: `describe()`, `it()`, `expect()`
- Tests `findBestPlacement()`, `evaluateBoard()`, `scoreBoard()`
- Pattern: Create mock board → call function → assert result

## Analogous Flow: Current AI Match

1. **Matchmaking** (`packages/partykit/src/matchmaking.ts`)
   - If queue time > 18s, server generates AI opponent via `generateAIPersona(playerRank)`
   - Sends `match_found` with `aiOpponent: AIPersona` to client

2. **Join Game** (`packages/partykit/src/game.ts:83-116`)
   - Player calls `join_game` with `aiOpponent` parameter
   - Server adds AI to `players` map with fake `connectionId: 'ai'`
   - Calls `startAIGameLoop()` to begin AI simulation

3. **AI Game Loop** (`packages/partykit/src/game.ts:129-239`)
   - Every 50ms, checks if `moveDelay` elapsed
   - If no moves queued, calls `findBestPlacement()` to calculate best move
   - Executes queued moves on `aiGameState.board`
   - Broadcasts updated state to human player via `opponent_state_update`

4. **Ability Handling** (BROKEN)
   - Player activates ability → server calls `handleAbilityActivation()`
   - Server tries to send `ability_received` to AI connection (doesn't exist)
   - AI board never modified, ability has no effect

## Integration Points

### Files to Modify
1. **`packages/game-core/src/ai/aiDifficulty.ts`**
   - Remove difficulty tiers
   - Add `PlayerMetrics` interface
   - Add `AdaptiveAIConfig` with mirroring logic

2. **`packages/game-core/src/ai/aiPlayer.ts`**
   - Add `findReasonableMo ve()` (non-optimal placement)
   - Add `makeIntentionalMistake()` (random/suboptimal placement)
   - Add `shouldMakeMistake()` based on player metrics

3. **`packages/partykit/src/game.ts`** (critical changes)
   - Track player metrics (PPM, lock time, board height, mistake rate)
   - Update AI move delay based on player speed
   - **Handle ability effects on AI board** (lines 274-286)
     - For AI target, apply ability to `this.aiGameState.board` directly
     - Clear `aiMoveQueue` to force re-calculation
     - Broadcast updated AI state immediately
   - **AI ability usage**
     - Track AI stars (earn from line clears)
     - Decide when to use abilities (offensive vs defensive)
     - Send `ability_received` to human player

4. **`packages/game-core/src/abilityEffects.ts`**
   - No changes needed (functions already work on Board objects)

5. **`packages/game-core/src/ai/aiPersona.ts`**
   - Remove difficulty field (or make it always 'adaptive')
   - Keep rank for matchmaking purposes

### New Files to Create
1. **`packages/game-core/src/ai/adaptiveAI.ts`**
   - `PlayerMetrics` interface
   - `AdaptiveAI` class with mirroring logic
   - `decideMoveDelay()`, `shouldMakeMistake()`, `findAdaptiveMove()`

2. **`packages/game-core/src/ai/__tests__/adaptiveAI.test.ts`**
   - Test player metrics tracking
   - Test mistake rate calculation
   - Test move delay adaptation

3. **`packages/partykit/src/aiAbilityDecision.ts`** (or inline in game.ts)
   - Logic for AI to decide when to use abilities
   - Track board states, decide offensive vs defensive

## Key Files to Reference During Implementation

### Phase 1: Player Metrics Tracking
- `packages/partykit/src/game.ts:241-258` (handleGameStateUpdate) - track player metrics here
- `packages/game-core/src/types.ts` - add PlayerMetrics type

### Phase 2: AI Mirroring Logic
- `packages/game-core/src/ai/aiPlayer.ts:112-174` (findBestPlacement) - reference for move finding
- `packages/game-core/src/ai/aiDifficulty.ts` - replace with adaptive config
- `packages/partykit/src/game.ts:142-163` (AI decision logic) - replace with adaptive

### Phase 3: Ability Effects on AI
- `packages/game-core/src/abilityEffects.ts` - all ability functions
- `packages/partykit/src/game.ts:274-286` (handleAbilityActivation) - modify this
- `packages/partykit/src/game.ts:218-237` (broadcastAIState) - ensure called after ability

### Phase 4: AI Ability Usage
- `packages/partykit/src/game.ts:183-200` (AI line clear / star earning) - track stars
- `packages/game-core/src/abilities.json` - AI ability loadout
- `packages/partykit/src/game.ts:260-272` (handleGameEvent) - send AI ability to player

## Current Issues Identified

1. **AI uses optimal move calculation** (aiPlayer.ts:112-174)
   - Uses weighted board evaluation (height, holes, bumpiness)
   - Always picks best scoring placement
   - Too skilled for average players

2. **Abilities don't affect AI** (game.ts:274-286)
   - `handleAbilityActivation()` sends message to AI connection (which doesn't exist)
   - Should directly modify `this.aiGameState.board` instead
   - Need to clear `aiMoveQueue` to force re-planning

3. **AI doesn't use abilities** (game.ts:129-239)
   - AI loop has no ability decision logic
   - AI doesn't track stars (needs to earn from line clears)
   - No `ability_activation` calls from AI to player

4. **Difficulty tiers** (aiDifficulty.ts:13-35)
   - Hardcoded easy/medium/hard
   - Doesn't adapt to player skill
   - Spec wants single adaptive AI

## Next Steps (Phase 2: Planning)

Based on this research, Phase 2 should:
1. Create prescriptive steps for removing difficulty system
2. Design PlayerMetrics tracking (where to store, how to calculate rolling averages)
3. Design AdaptiveAI class (mistake rate, delay mirroring, move quality)
4. Map each ability type to its board modification function
5. Design AI ability decision logic (when to use offensive vs defensive)
6. Define test cases for each phase
