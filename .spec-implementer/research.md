# Research Summary for Spec 010: Client-Side Prediction

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `web` - React + Vite client application
  - `partykit` - Multiplayer server (PartyKit)
  - `game-core` - Shared game logic (TypeScript library)
- **Build**:
  - Web: `pnpm --filter web build` (tsc + vite)
  - All: `pnpm build:all`
- **Tests**: Vitest framework
  - Web tests: `pnpm --filter web test`
  - Game-core tests: `pnpm --filter game-core test`

## Existing Patterns

### Imports
The project uses workspace protocol imports for monorepo packages:
```typescript
import { createInitialGameState, movePiece, rotatePiece } from '@tetris-battle/game-core';
import type { GameState, Tetromino, PlayerInputType } from '@tetris-battle/game-core';
```

Components and services use relative imports:
```typescript
import { useGameStore } from '../stores/gameStore';
import { ServerAuthGameClient } from '../services/partykit/ServerAuthGameClient';
```

### State Management (Zustand)
State stores use Zustand with TypeScript:

**Pattern from gameStore.ts:**
```typescript
interface GameStore {
  gameState: GameState;
  ghostPiece: Tetromino | null;
  // State fields

  // Actions
  initGame: () => void;
  movePieceLeft: () => void;
  // Other actions
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialGameState(),
  ghostPiece: null,

  movePieceLeft: () => {
    const { gameState } = get();
    // Logic that calls set()
  },
}));
```

**Key patterns:**
- Use `get()` to read current state
- Use `set()` to update state
- Actions are methods that encapsulate state transitions
- Stores are exported as hooks (`useGameStore`)

### Components
React functional components with TypeScript:

**Pattern from ServerAuthMultiplayerGame.tsx:**
```typescript
interface ServerAuthMultiplayerGameProps {
  roomId: string;
  playerId: string;
  // Props with types
}

export function ServerAuthMultiplayerGame({
  roomId,
  playerId,
  // Destructured props
}: ServerAuthMultiplayerGameProps) {
  const [yourState, setYourState] = useState<any | null>(null);
  const clientRef = useRef<ServerAuthGameClient | null>(null);

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  return (
    // JSX
  );
}
```

### Server Messages (PartyKit Protocol)

**Client → Server message format:**
```typescript
// From ServerAuthGameClient.ts
this.socket.send(JSON.stringify({
  type: 'player_input',
  playerId: this.playerId,
  input: 'move_left',
  timestamp: Date.now(),
}));
```

**Server → Client message format:**
```typescript
// From game.ts
conn.send(JSON.stringify({
  type: 'state_update',
  timestamp: now,
  yourState: playerStates[playerId],
  opponentState: playerStates[opponentId],
}));
```

**Message handling pattern:**
```typescript
// Client-side (ServerAuthGameClient.ts)
this.socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'state_update':
      onStateUpdate(data);
      break;
    case 'ability_received':
      onAbilityReceived(data.abilityType, data.fromPlayerId);
      break;
    // Other cases
  }
});
```

### Game-Core Functions
All game logic functions are pure and imported from game-core:

**Available functions (from engine.ts):**
- `movePiece(piece, dx, dy)` - Returns new piece with updated position
- `rotatePiece(piece, clockwise)` - Returns new piece with updated rotation
- `isValidPosition(board, piece)` - Returns boolean
- `lockPiece(board, piece)` - Returns new board with piece locked
- `clearLines(board)` - Returns { board, linesCleared }
- `getHardDropPosition(board, piece)` - Returns position
- `calculateStars(linesCleared, comboCount)` - Returns stars earned

**All functions are immutable** - they return new objects, never mutate input.

### Tests
Vitest with describe/it structure:

**Pattern from friendChallengeFlow.test.ts:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useFriendStore } from '../stores/friendStore';

describe('Friend Challenge Flow', () => {
  beforeEach(() => {
    // Setup/reset
  });

  it('should do something', () => {
    // Arrange
    const challenge = { ... };

    // Act
    useFriendStore.getState().setOutgoingChallenge(challenge);

    // Assert
    expect(useFriendStore.getState().outgoingChallenge).toEqual(challenge);
  });
});
```

## Analogous Flow: Server-Authoritative Input Processing

The closest existing flow is the current server-auth mode WITHOUT prediction. Here's the end-to-end trace:

### Current Flow (Without Prediction)

**1. User presses key (ServerAuthMultiplayerGame.tsx)**
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!gameClientRef.current || !yourState) return;

    switch (e.key) {
      case 'ArrowLeft':
        gameClientRef.current.sendInput('move_left');
        break;
      case 'ArrowRight':
        gameClientRef.current.sendInput('move_right');
        break;
      // Other keys
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [yourState]);
```

**2. Client sends input to server (ServerAuthGameClient.ts:161)**
```typescript
sendInput(input: PlayerInputType): void {
  this.send({
    type: 'player_input',
    playerId: this.playerId,
    input,
    timestamp: Date.now(),
  });
}
```

**3. Server receives and processes (game.ts:199)**
```typescript
private handlePlayerInput(playerId: string, input: PlayerInputType): void {
  const serverState = this.serverGameStates.get(playerId);
  if (!serverState) return;

  const stateChanged = serverState.processInput(input);
  if (stateChanged) {
    this.broadcastState();
  }
}
```

**4. Server validates input (ServerGameState.ts:75)**
```typescript
processInput(input: PlayerInputType): boolean {
  if (!this.gameState.currentPiece || this.gameState.isGameOver) {
    return false;
  }

  let newPiece = this.gameState.currentPiece;
  let stateChanged = false;

  switch (input) {
    case 'move_left':
      newPiece = movePiece(newPiece, -1, 0);
      if (isValidPosition(this.gameState.board, newPiece)) {
        this.gameState.currentPiece = newPiece;
        stateChanged = true;
      }
      break;
    // Other cases
  }

  return stateChanged;
}
```

**5. Server broadcasts state (game.ts:249)**
```typescript
private broadcastState(): void {
  // Throttled to 60fps (16ms)
  const now = Date.now();
  if (now - this.lastBroadcastTime < this.broadcastThrottle) {
    return;
  }

  // Send to each player
  for (const [playerId, playerState] of this.players) {
    const yourState = playerStates[playerId];
    const opponentState = playerStates[opponentId];

    conn.send(JSON.stringify({
      type: 'state_update',
      timestamp: now,
      yourState,
      opponentState,
    }));
  }
}
```

**6. Client receives and renders (ServerAuthMultiplayerGame.tsx)**
```typescript
const handleStateUpdate = useCallback((update: GameStateUpdate) => {
  setYourState(update.yourState);
  setOpponentState(update.opponentState);
}, []);

// Later, in useEffect:
gameClient.connect(
  handleStateUpdate,
  // Other callbacks
);
```

### Where Prediction Will Fit

The prediction layer will intercept between step 1 and 2:

1. User presses key
2. **NEW: Apply input locally to predictedState (instant visual feedback)**
3. **NEW: Store input in pendingInputs queue with sequence number**
4. Send input to server (async, don't wait)
5. Server validates (100-150ms later)
6. **NEW: Server sends confirmation with sequence number**
7. **NEW: Client reconciles: remove confirmed inputs, check if prediction was correct**

## Integration Points

### Files That Need Modification

#### 1. `packages/web/src/stores/gameStore.ts`
**What to add:**
- New state fields: `serverState`, `predictedState`, `pendingInputs`, `inputSequence`
- New interface: `PendingInput`
- New functions: `predictInput()`, `reconcileWithServer()`, `applyInputAction()`
- Modify existing input actions to call `predictInput()` instead of directly mutating state

**Specific locations:**
- Line 22-33: Add new state fields to `GameStore` interface
- Line 59-70: Add new state fields to initial state
- Line 148-162: Replace `movePieceLeft` implementation
- Line 164-178: Replace `movePieceRight` implementation
- Line 270-284: Replace `rotatePieceClockwise` implementation
- Line 286-300: Replace `rotatePieceCounterClockwise` implementation
- Line 302-318: Replace `hardDrop` implementation

#### 2. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
**What to add:**
- Modify `sendInput()` to include sequence number
- Add handler for `input_confirmed` message type
- Add handler for `input_rejected` message type
- Add callbacks for confirmation/rejection in `connect()` method

**Specific locations:**
- Line 161-168: Modify `sendInput()` to accept seq parameter
- Line 93-142: Add new message type cases in event listener

#### 3. `packages/partykit/src/game.ts`
**What to add:**
- Modify `handlePlayerInput()` to send confirmations
- Add logic to send `input_confirmed` on success
- Add logic to send `input_rejected` on failure

**Specific locations:**
- Line 199-210: Modify `handlePlayerInput()` to send confirmations

#### 4. `packages/partykit/src/ServerGameState.ts`
**No changes needed** - validation logic already exists and works correctly

#### 5. `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
**What to add:**
- Render `predictedState` instead of `yourState` for player's own board
- Add visual feedback for mispredictions
- Wire up confirmation/rejection callbacks

**Specific locations:**
- Line 157: Change to render from `predictedState`
- Add CSS classes for correction feedback
- Add handlers for input confirmation/rejection

#### 6. `packages/game-core/src/inputTypes.ts`
**What to add:**
- Add `seq` field to `PlayerInput` interface

**Specific locations:**
- Line 17-22: Add seq field

### New Files to Create

#### 1. `packages/web/src/types/prediction.ts`
New file for prediction-specific types:
```typescript
export interface PendingInput {
  seq: number;
  action: PlayerInputType;
  predictedState: GameState;
  timestamp: number;
}

export interface InputConfirmation {
  type: 'input_confirmed';
  confirmedSeq: number;
  serverState: GameState;
}

export interface InputRejection {
  type: 'input_rejected';
  rejectedSeq: number;
  reason: string;
  serverState: GameState;
}
```

#### 2. `packages/web/src/styles/prediction.css`
CSS for misprediction visual feedback:
```css
.tetris-board.prediction-correction {
  outline: 2px solid rgba(255, 0, 0, 0.3);
  animation: shake 0.2s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
```

## Key Files to Reference During Implementation

### Core Game Logic
- `packages/game-core/src/engine.ts` - Movement/rotation/validation functions
- `packages/game-core/src/types.ts` - GameState, Tetromino, Board types
- `packages/game-core/src/inputTypes.ts` - Input type definitions

### Current Server-Auth Implementation
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - Client rendering
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` - Client network
- `packages/partykit/src/game.ts` - Server message handling
- `packages/partykit/src/ServerGameState.ts` - Server game state logic

### State Management
- `packages/web/src/stores/gameStore.ts` - Client state (legacy mode reference)
- Use patterns from gameStore.ts for prediction state management

### Testing References
- `packages/web/src/__tests__/friendChallengeFlow.test.ts` - Test structure example
- `packages/game-core/src/__tests__/SeededRandom.test.ts` - Unit test patterns

## Important Constraints

### Server-Auth Mode Only
- Prediction ONLY applies when `?serverAuth=true` URL flag is present
- Legacy client-auth mode remains unchanged
- Detection: Check URL params in ServerAuthMultiplayerGame component

### Immutability
- All game-core functions are immutable (return new objects)
- Must clone state before applying predictions
- Never mutate serverState or pendingInputs in place

### State Comparison
- Deep equality is too slow for 60fps
- Compare only critical fields:
  - `currentPiece.position.x`
  - `currentPiece.position.y`
  - `currentPiece.rotation`
  - `score`
  - `stars`

### Input Sequence Numbers
- Must be monotonically increasing
- Client maintains counter, increments on each input
- Server echoes seq number in confirmations
- Used to match confirmations with pending inputs

### Performance Considerations
- Max 50 pending inputs (queue limit)
- Reconciliation should complete in <5ms
- State broadcasts already throttled to 60fps (16ms)
- Don't add additional throttling to input sending

## Current State vs. Predicted State

### Current (Without Prediction)
- Client has `yourState` from server
- Client renders `yourState` directly
- Input → Server → Wait → Render (100-150ms lag)

### With Prediction
- Client has two states:
  - `serverState`: Last confirmed state from server (source of truth)
  - `predictedState`: Optimistic state (what we think it is)
- Client renders `predictedState` (instant)
- Input → Apply locally → Render immediately → Server confirms later
- If prediction wrong: Snap to `serverState` + replay pending inputs

## Message Flow Changes

### Old Flow
```
Client: { type: 'player_input', input: 'move_left' }
Server: [processes, broadcasts state_update]
Client: Receives state_update, renders new state
```

### New Flow
```
Client: Apply to predictedState FIRST (instant)
Client: { type: 'player_input', input: 'move_left', seq: 42 }
Server: [validates, processes]
Server: { type: 'input_confirmed', confirmedSeq: 42, serverState: {...} }
Client: Remove seq 42 from pendingInputs, check if prediction matched
```

## Validation Must Match

**Critical**: Client and server must use identical validation logic.

Both use the same game-core functions:
- `movePiece()` - Returns new piece position
- `isValidPosition()` - Checks collision
- `rotatePiece()` - Returns new rotation

**Why this matters:**
- If client predicts "move left is valid" but server says "no", misprediction occurs
- Both MUST call `isValidPosition()` with same board state
- Board state might differ due to:
  - Opponent abilities affecting board (garbage lines, earthquake, etc.)
  - Timing of server updates (client doesn't know about board change yet)

**Misprediction is rare (<1%) because:**
- Most inputs are simple moves with no collision
- Client and server use same validation code
- State updates are fast (60fps)

## Notes on Existing Code

### Debug Panel Integration
The debug panel (Spec 008) is already implemented. We should:
- Log prediction events to debug logger
- Show misprediction count in debug panel
- Add pending inputs count to debug panel
- This will help with testing and tuning

### Audio System
Audio manager (packages/web/src/services/audioManager.ts) is available:
- Use `audioManager.playSfx('correction')` for misprediction sound
- Need to add new sound file for correction beep
- Keep it subtle, not jarring

### Ability Effects
Abilities can affect input processing:
- `reverse_controls` - Server already handles this (ServerGameState.ts:93)
- `rotation_lock` - Server already handles this (ServerGameState.ts:81)
- Client predictions must NOT try to predict these effects
- Server is authoritative for ability effects

### Testing Strategy
1. Unit tests for prediction logic (gameStore.ts functions)
2. Unit tests for state comparison (areStatesEqual)
3. Unit tests for reconciliation (with mocked pending inputs)
4. Manual testing with simulated latency
5. Monitor misprediction rate in debug panel

## Next Steps (Phase 2)

Phase 2 will create a detailed implementation plan with:
- Exact order of changes (avoid breaking builds)
- Test-first approach (write tests before implementation)
- Incremental integration (one input type at a time)
- Verification at each step
