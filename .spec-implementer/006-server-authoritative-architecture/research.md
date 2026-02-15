# Research Summary for Spec 006: Server-Authoritative Architecture

## Project Structure

- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React client (Vite + TypeScript)
  - `packages/partykit` - PartyKit server (WebSocket multiplayer)
  - `packages/game-core` - Shared game logic library
- **Build**:
  - Web: `pnpm --filter web build` (uses `tsc -b && vite build`)
  - All: `pnpm build:all` (recursive build)
- **Tests**:
  - Framework: Vitest
  - Run: `pnpm --filter web test`
  - Watch: `pnpm --filter web test:watch`

## Current Architecture: Client-Authoritative

### Client Responsibilities (PartykitMultiplayerGame.tsx)
- **Game loop**: Runs on lines 223-251, base tick rate 1000ms
- **Piece spawning**: Client calls `tick()` which calls `spawnPiece()` from gameStore
- **Movement**: Client validates and executes all moves (gameStore.ts lines 148-177)
- **Scoring**: Client calculates score, line clears, combos (gameStore.ts)
- **State sync**: Client sends full state to server every 100ms (debounced)

### Server Responsibilities (packages/partykit/src/game.ts)
- **State relay**: Receives state from one client, sends to opponent (lines 317-376)
- **AI game loop**: Server runs AI opponent game loop (lines 182-314) - EXCEPTION
- **Ability routing**: Routes ability activations between clients (lines 413-432)
- **Game over detection**: Delegates to clients, announces winner (lines 664-695)
- **Message tracking**: Detects sync loops with frequency counter (lines 71-90)

### Message Protocol (Current)

**Client → Server:**
- `join_game`: { playerId, aiOpponent? }
- `game_state_update`: { playerId, state: { board, score, stars, linesCleared, comboCount, isGameOver, currentPiece } }
- `ability_activation`: { playerId, abilityType, targetPlayerId }
- `game_over`: { playerId }

**Server → Client:**
- `game_start`: { players: [id1, id2] }
- `opponent_state_update`: { state: {...} }
- `ability_received`: { abilityType, fromPlayerId }
- `game_finished`: { winnerId, loserId }

## Existing Patterns

### Imports
```typescript
// Absolute imports from workspace packages
import { createInitialGameState, movePiece } from '@tetris-battle/game-core';
// Relative imports within package
import { PartykitGameSync } from '../services/partykit/gameSync';
```

### State Management (Zustand)
**Pattern**: `packages/web/src/stores/gameStore.ts`
```typescript
export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialGameState(),
  // ... state fields

  initGame: () => {
    set({ gameState: createInitialGameState() });
  },

  movePieceLeft: () => {
    const { gameState } = get();
    const newPiece = movePiece(gameState.currentPiece, -1, 0);
    if (isValidPosition(gameState.board, newPiece)) {
      set({ gameState: { ...gameState, currentPiece: newPiece } });
    }
  },
}));
```

### Components (React)
**Pattern**: Functional components with hooks
```typescript
export function PartykitMultiplayerGame({ roomId, playerId, ... }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opponentState, setOpponentState] = useState<any | null>(null);

  const { gameState, movePieceLeft, tick } = useGameStore();

  useEffect(() => {
    // Initialize, cleanup with return
  }, [dependencies]);

  return (<div>...</div>);
}
```

### Server Messages (PartyKit)
**Pattern**: `packages/partykit/src/game.ts`
```typescript
export default class GameRoomServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();

  constructor(readonly room: Party.Room) {}

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join_game':
        this.handleJoinGame(data.playerId, sender, data.aiOpponent);
        break;
    }
  }

  private handleJoinGame(...) { ... }

  broadcast(data: any) {
    this.room.broadcast(JSON.stringify(data));
  }
}
```

### Game Core (Pure Functions)
**Pattern**: `packages/game-core/src/engine.ts`
```typescript
export function movePiece(piece: Tetromino, dx: number, dy: number): Tetromino {
  return {
    ...piece,
    position: { x: piece.position.x + dx, y: piece.position.y + dy },
  };
}

export function isValidPosition(board: Board, piece: Tetromino): boolean {
  // Collision detection logic
  return true/false;
}
```

### Tests (Vitest)
**Pattern**: `packages/web/src/__tests__/friendChallengeFlow.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Friend Challenge Flow', () => {
  beforeEach(() => {
    // Setup
  });

  it('should create outgoing challenge', () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expected);
  });
});
```

## Analogous Flow: AI Opponent (Server-Side Game Loop)

This is the CLOSEST existing pattern - AI opponents already run server-authoritative:

### Flow:
1. **Client joins** with aiOpponent flag → `game.ts:125`
2. **Server initializes AI state** → `game.ts:203-209`
   - Creates `aiGameState: CoreGameState`
   - Spawns first piece
   - Initializes next pieces queue
3. **Server starts AI game loop** → `game.ts:211-314`
   - Interval runs every 50ms
   - AI decides moves, server validates and executes
   - Server calls `movePiece`, `rotatePiece`, `lockPiece` from game-core
   - Server calculates score, line clears, stars
   - Server spawns next piece when piece locks
4. **Server broadcasts AI state** → `game.ts:534-555`
   - Sends to human player: `opponent_state_update`
   - State includes: board, score, stars, linesCleared, comboCount, isGameOver, currentPiece
5. **Client receives and renders** → `PartykitMultiplayerGame.tsx:342-355`
   - Updates `opponentState`
   - Renders on opponent canvas

### Key Files for AI Pattern:
- `packages/partykit/src/game.ts` lines 182-314 (AI game loop)
- `packages/partykit/src/game.ts` lines 534-555 (AI state broadcast)
- `packages/game-core/src/engine.ts` (all game logic functions)

## Integration Points

### Files to Modify (Client → Input Only)

1. **`packages/web/src/components/PartykitMultiplayerGame.tsx`**
   - REMOVE: Game loop (lines 223-251)
   - REMOVE: State sync useEffect (lines 163-209)
   - ADD: Input event handlers (send to server instead of local execution)
   - CHANGE: Render from server-provided state (not gameStore)
   - CHANGE: Keyboard handlers to send inputs, not call gameStore actions

2. **`packages/web/src/stores/gameStore.ts`**
   - KEEP: For single-player/practice mode
   - NOTE: Multiplayer will NOT use gameStore at all

3. **`packages/web/src/services/partykit/gameSync.ts`**
   - REMOVE: `updateGameState()` (line 91-120)
   - ADD: `sendInput()` method for player inputs
   - CHANGE: Message protocol to match spec

### Files to Modify (Server → Authoritative)

4. **`packages/partykit/src/game.ts`**
   - ADD: `playerGameStates: Map<string, CoreGameState>` (store both players' states)
   - ADD: `playerGameLoops: Map<string, NodeJS.Timeout>` (one loop per player)
   - ADD: `startGameLoop(playerId: string)` (similar to AI loop)
   - ADD: `handlePlayerInput(playerId, input)` (validate and execute)
   - ADD: `broadcastState()` (send to both clients at 60fps)
   - CHANGE: `handleJoinGame()` to initialize server-side state for humans
   - REMOVE: `handleGameStateUpdate()` (no longer used)
   - KEEP: `handleAbilityActivation()` (but validate on server)

### New Files to Create

5. **`packages/partykit/src/InputValidator.ts`** (OPTIONAL)
   - Validate input commands
   - Prevent cheating/invalid moves

6. **`packages/web/src/services/partykit/InputClient.ts`** (OPTIONAL)
   - Replace gameSync for server-authoritative mode
   - Handle input sending
   - Client-side prediction (optional phase 5)

## Key Decisions & Patterns to Follow

### 1. RNG Seed
**Decision**: Use room ID as seed for deterministic piece generation
**Pattern**:
```typescript
// In game.ts
private rngSeed: number = parseInt(this.room.id.substring(0, 8), 36);
private rng: SeededRandom = new SeededRandom(this.rngSeed);

// Use this.rng.next() instead of Math.random()
```

### 2. State Broadcasting
**Decision**: Broadcast on every state change, throttle to 60fps (16ms)
**Pattern** (from AI):
```typescript
private lastBroadcastTime: number = 0;
private broadcastThrottle: number = 16; // 60fps

broadcastState() {
  const now = Date.now();
  if (now - this.lastBroadcastTime < this.broadcastThrottle) return;
  this.lastBroadcastTime = now;

  // Send to both players
}
```

### 3. Input Processing
**Decision**: Validate THEN execute (never trust client)
**Pattern**:
```typescript
handlePlayerInput(playerId: string, input: InputType) {
  const state = this.playerGameStates.get(playerId);
  if (!state || !state.currentPiece) return;

  let newPiece = state.currentPiece;
  switch (input) {
    case 'move_left':
      newPiece = movePiece(newPiece, -1, 0);
      break;
  }

  // Validate
  if (isValidPosition(state.board, newPiece)) {
    state.currentPiece = newPiece;
    this.broadcastState();
  } else {
    // Ignore invalid input
  }
}
```

### 4. Ability Validation
**Decision**: Server checks star count before applying
**Pattern**:
```typescript
handleAbilityActivation(playerId, abilityType, targetId) {
  const playerState = this.playerGameStates.get(playerId);
  const abilityCost = this.getAbilityCost(abilityType);

  if (playerState.stars < abilityCost) {
    console.warn(`Player ${playerId} insufficient stars`);
    return; // Reject
  }

  playerState.stars -= abilityCost;
  this.applyAbilityToPlayer(targetId, abilityType);
  this.broadcastState();
}
```

## Testing Strategy

### Unit Tests (game-core)
- Already exist for game logic (engine.ts, abilityEffects.ts)
- No changes needed - pure functions

### Integration Tests (web)
- Create tests for input sending (not game logic)
- Test rendering from server state

### Server Tests (partykit)
- Test input validation
- Test game loop execution
- Test state broadcasting
- Test ability validation

### Manual Testing
- Two browser windows
- Verify inputs are responsive
- Verify state stays in sync
- Verify no desyncs

## Architecture Notes

### Why This Is a Major Refactor
- **Client code**: Remove entire game loop, replace with input sending
- **Server code**: Add game loop for BOTH players (currently only AI)
- **Message protocol**: Complete redesign (inputs instead of state)
- **State flow**: Reverses direction (server → client instead of client → server)

### Migration Risk
- **Breaking change**: Old clients won't work with new server
- **Rollback complexity**: Need feature flag or separate deployment
- **Testing scope**: Every game mechanic must be re-verified

### Benefits
- Single source of truth (server state)
- No client-side cheating possible
- Easier debugging (all logic in one place)
- Enables replays, spectating, tournaments

## Key Files to Reference During Implementation

1. `packages/partykit/src/game.ts` - AI game loop pattern (lines 182-314)
2. `packages/game-core/src/engine.ts` - All game logic functions
3. `packages/game-core/src/types.ts` - Type definitions
4. `packages/web/src/components/PartykitMultiplayerGame.tsx` - Current client flow
5. `packages/web/src/services/partykit/gameSync.ts` - Current message protocol
6. `packages/web/src/stores/gameStore.ts` - Current game state management

## Completion Checklist

✅ Project structure mapped
✅ Build system understood
✅ Current architecture analyzed
✅ Analogous flow traced (AI opponent)
✅ Integration points identified
✅ Patterns documented with examples
✅ Research summary written

**Phase 1 complete. Ready for Phase 2: Planning.**
