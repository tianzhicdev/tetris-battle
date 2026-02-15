# Research Summary for Spec 010: Client-Side Prediction

## Project Structure
- **Monorepo**: Yes (pnpm workspaces)
- **Packages**:
  - `packages/web` - React client application (Vite)
  - `packages/partykit` - PartyKit multiplayer server
  - `packages/game-core` - Shared game logic (TypeScript)
- **Build**: Vite for web, `pnpm build:all` for all packages
- **Tests**: Vitest (`pnpm --filter web test`)
- **Dev**: `pnpm dev` (starts web dev server)

## Existing Patterns

### Imports
```typescript
// Absolute imports from workspace packages
import { PlayerInputType, ABILITIES } from '@tetris-battle/game-core';

// Relative imports for local modules
import { ServerAuthGameClient } from '../services/partykit/ServerAuthGameClient';
import { useGameStore } from '../stores/gameStore';

// Type-only imports
import type { GameState, Tetromino } from '@tetris-battle/game-core';
```

### State Management (Zustand)
```typescript
// Pattern from gameStore.ts
export const useGameStore = create<GameStore>((set, get) => ({
  // State fields
  gameState: createInitialGameState(),
  pendingInputs: [],

  // Actions
  movePieceLeft: () => {
    const { gameState } = get();
    // ... validation logic
    set({ gameState: { ...gameState, currentPiece: newPiece } });
  },
}));
```

### Input Types (Already Defined)
```typescript
// packages/game-core/src/inputTypes.ts
export type PlayerInputType =
  | 'move_left'
  | 'move_right'
  | 'rotate_cw'
  | 'rotate_ccw'
  | 'soft_drop'
  | 'hard_drop';

export interface PlayerInput {
  type: 'player_input';
  playerId: string;
  input: PlayerInputType;
  timestamp: number;
}
```

### Prediction Types (Already Defined)
```typescript
// packages/web/src/types/prediction.ts
export interface PendingInput {
  seq: number;
  action: PlayerInputType;
  predictedState: GameState;
  timestamp: number;
}

export const MAX_PENDING_INPUTS = 50;
```

### Server Message Handling
```typescript
// Pattern from ServerAuthGameClient.ts
this.socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'state_update':
      onStateUpdate(data as GameStateUpdate);
      break;
    case 'ability_received':
      onAbilityReceived(data.abilityType, data.fromPlayerId);
      break;
  }
});
```

### Game Core Validation Functions
```typescript
// From packages/game-core/src/engine.ts
export function isValidPosition(board: Board, piece: Tetromino): boolean;
export function movePiece(piece: Tetromino, dx: number, dy: number): Tetromino;
export function rotatePiece(piece: Tetromino, clockwise: boolean): Tetromino;
export function getHardDropPosition(board: Board, piece: Tetromino): Position;
```

### Test Patterns
```typescript
// Pattern from predictionState.test.ts (Vitest)
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/gameStore';

describe('Prediction State Management', () => {
  beforeEach(() => {
    useGameStore.setState({ /* reset state */ });
  });

  it('should enable prediction mode', () => {
    useGameStore.getState().setPredictionMode(true);
    expect(useGameStore.getState().isPredictionMode).toBe(true);
  });
});
```

## Analogous Flow: Server-Auth Input Processing

### Current Flow (Without Prediction)
1. **Client** (ServerAuthMultiplayerGame.tsx): Keyboard event → `gameClient.sendInput('move_left')`
2. **Client** (ServerAuthGameClient.ts): `sendInput()` → WebSocket send `player_input` message
3. **Server** (game.ts): `handlePlayerInput()` → `serverState.processInput()` → update state
4. **Server** (game.ts): `broadcastState()` → send `state_update` to both players
5. **Client** (ServerAuthMultiplayerGame.tsx): Receive `state_update` → `setYourState()` → re-render

**Result**: 100-150ms lag between keypress and visual update

### Key Files in Flow

#### 1. ServerAuthMultiplayerGame.tsx (lines 400-450)
Input handlers send inputs to server:
```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowLeft':
      gameClient.current?.sendInput('move_left');
      break;
    // ... other keys
  }
}, []);
```

#### 2. ServerAuthGameClient.ts (lines 161-168)
Sends input to server:
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

#### 3. game.ts (lines 199-210)
Server processes input:
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

#### 4. game.ts (lines 249-286)
Server broadcasts state to clients:
```typescript
private broadcastState(): void {
  // ... get states for all players

  conn.send(JSON.stringify({
    type: 'state_update',
    timestamp: now,
    yourState,
    opponentState,
  }));
}
```

#### 5. ServerAuthMultiplayerGame.tsx (lines 250-300)
Client receives state update:
```typescript
const handleStateUpdate = useCallback((stateUpdate: GameStateUpdate) => {
  setYourState(stateUpdate.yourState);
  setOpponentState(stateUpdate.opponentState);
  // ... update UI
}, []);
```

## Integration Points

### Files to Modify

#### 1. `packages/web/src/stores/gameStore.ts`
**Current state**: Has placeholder prediction methods (lines 429-456)
- `predictInput()` returns `null` (line 443)
- `reconcileWithServer()` is empty (line 446-448)
- `handleInputRejection()` is empty (line 450-452)

**Changes needed**:
- Implement `predictInput()` function (apply input locally, queue pending)
- Implement `reconcileWithServer()` (remove confirmed inputs, compare states, replay)
- Implement `handleInputRejection()` (snap to server state)
- Add helper: `applyInputAction(state, action)` - applies input using game-core functions
- Add helper: `areStatesEqual(predicted, server)` - compares critical fields

#### 2. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
**Current state**: `sendInput()` exists but doesn't include seq number (lines 161-168)

**Changes needed**:
- Add `seq` parameter to `sendInput()` method
- Update message payload to include `seq` field
- Add message handlers for `input_confirmed` and `input_rejected` (in `connect()` method around line 93)
- Wire up callbacks to gameStore reconciliation methods

#### 3. `packages/partykit/src/game.ts`
**Current state**: `handlePlayerInput()` processes inputs but doesn't send confirmations (lines 199-210)

**Changes needed**:
- Modify `handlePlayerInput()` to accept `seq` number from client message
- Send `input_confirmed` message with seq and server state on success
- Send `input_rejected` message with seq, reason, and server state on failure
- Add validation logic for each input type (check collision, rotation blocked, etc.)

#### 4. `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
**Current state**: Calls `gameClient.sendInput()` without prediction (around line 400-450)

**Changes needed**:
- Before sending input, call `gameStore.predictInput(action)` to get `seq`
- Pass `seq` to `gameClient.sendInput(input, seq)`
- Update state from `predictedState` instead of server state (for rendering)
- Add misprediction callback to trigger visual feedback

#### 5. `packages/web/src/types/prediction.ts` (Already exists)
**Current state**: Defines `PendingInput`, `InputConfirmation`, `InputRejection` interfaces

**Changes needed**: None (already complete)

### New Files to Create

#### 1. `packages/web/src/utils/predictionHelpers.ts`
State comparison and input application helpers:
```typescript
export function areStatesEqual(predicted: GameState, server: GameState): boolean;
export function applyInputAction(state: GameState, action: PlayerInputType): GameState | null;
```

#### 2. `packages/web/src/styles/predictionFeedback.css`
CSS for misprediction visual feedback:
```css
.tetris-board.prediction-correction { /* shake + red outline */ }
@keyframes shake { /* ... */ }
```

#### 3. `packages/web/src/__tests__/prediction.test.ts`
Unit tests for prediction logic:
- Test `applyInputAction()` for all input types
- Test `areStatesEqual()` comparison
- Test `predictInput()` flow
- Test `reconcileWithServer()` with matching states
- Test `reconcileWithServer()` with misprediction + replay
- Test pending input queue limit

## Key Files to Reference During Implementation

### Phase 2 (Planning)
- Review spec: `specs/010-client-side-prediction.md`
- Reference existing types: `packages/web/src/types/prediction.ts`
- Reference game-core exports: `packages/game-core/src/index.ts`

### Phase 3 (Implementation)
Keep these files open for reference:
1. `packages/game-core/src/engine.ts` - Validation functions (isValidPosition, movePiece, rotatePiece)
2. `packages/web/src/stores/gameStore.ts` - Existing input handlers (movePieceLeft, etc.)
3. `packages/web/src/services/partykit/ServerAuthGameClient.ts` - Message protocol
4. `packages/partykit/src/game.ts` - Server input handling
5. `packages/web/src/__tests__/predictionState.test.ts` - Test patterns

## Critical Observations

### 1. Prediction State Already Initialized
The gameStore already has prediction fields added (lines 37-43):
- `serverState: GameState | null`
- `predictedState: GameState | null`
- `pendingInputs: PendingInput[]`
- `inputSequence: number`
- `isPredictionMode: boolean`
- `onMisprediction: (() => void) | null`

**Implication**: Phase 1 of the spec (Add Prediction State) is already done. We skip to implementing the methods.

### 2. Input Types Already Defined
`packages/game-core/src/inputTypes.ts` already defines `PlayerInputType` and `PlayerInput`.

**Implication**: No need to create these types. Just add `seq` field to the message payload.

### 3. Validation Functions Available
`game-core/engine.ts` exports all needed validation functions:
- `isValidPosition(board, piece)` - Checks collision
- `movePiece(piece, dx, dy)` - Returns new piece position
- `rotatePiece(piece, clockwise)` - Returns rotated piece
- `getHardDropPosition(board, piece)` - Calculates hard drop target

**Implication**: We can use these directly in `applyInputAction()`. No need to reimplement.

### 4. Server Already Has ServerGameState
`packages/partykit/src/game.ts` uses `ServerGameState` class to manage server-side state.
The `ServerGameState.processInput()` method already validates and applies inputs.

**Implication**: We need to modify `handlePlayerInput()` to send confirmations, but the validation logic already exists.

### 5. Message Protocol Already Structured
`ServerAuthGameClient.ts` already has a clean message handling pattern with type switching.

**Implication**: We just add new cases for `input_confirmed` and `input_rejected`.

## Potential Issues to Watch For

### 1. State Sync During Prediction
When prediction is enabled, we need to ensure:
- Rendering uses `predictedState` (NOT `gameState` or server state directly)
- Server state updates only reconcile, don't directly replace predicted state
- Ghost piece updates based on predicted piece position

### 2. Race Conditions
Multiple rapid inputs could cause:
- Out-of-order confirmations from server
- Reconciliation while new inputs are being predicted
- Need to handle seq numbers carefully

### 3. Ability Effects During Prediction
Abilities like "reverse controls" are server-applied effects. During prediction:
- Client may not know about reverse controls until server confirms
- This could cause mispredictions
- Solution: Don't predict during active effects, or accept higher misprediction rate

### 4. Hard Drop Special Case
Hard drop is instant (line 329-345 in gameStore.ts):
- Drops piece to bottom
- Locks immediately
- Spawns next piece
This is more complex to predict than simple moves. Need to ensure we predict:
- Drop position
- Lock action
- Line clears
- Score update
- Next piece spawn

### 5. Queue Overflow
If network lags severely (>2.5 seconds), queue could exceed 50 items.
Need to handle gracefully:
- Drop oldest inputs
- Log warning
- Possibly disable prediction temporarily

## Implementation Strategy

Based on research, the implementation order should be:

### Step 1: Create Helper Functions
Create `packages/web/src/utils/predictionHelpers.ts` with:
- `applyInputAction()` - Applies input using game-core functions
- `areStatesEqual()` - Compares critical state fields

### Step 2: Implement gameStore Prediction Methods
Implement in `packages/web/src/stores/gameStore.ts`:
- `predictInput()` - Apply locally, queue, send to server
- `reconcileWithServer()` - Remove confirmed, compare, replay
- `handleInputRejection()` - Snap to server state

### Step 3: Update ServerAuthGameClient
Modify `packages/web/src/services/partykit/ServerAuthGameClient.ts`:
- Add `seq` parameter to `sendInput()`
- Add handlers for `input_confirmed` and `input_rejected`

### Step 4: Update Server Input Handler
Modify `packages/partykit/src/game.ts`:
- Extract `seq` from `player_input` message
- Send `input_confirmed` on success
- Send `input_rejected` on validation failure

### Step 5: Update Client Input Handlers
Modify `packages/web/src/components/ServerAuthMultiplayerGame.tsx`:
- Call `predictInput()` before `sendInput()`
- Render from `predictedState`
- Add misprediction visual feedback

### Step 6: Add Visual Feedback
Create `packages/web/src/styles/predictionFeedback.css`:
- Shake animation
- Red outline
- Fade transition

### Step 7: Write Tests
Create `packages/web/src/__tests__/prediction.test.ts`:
- Test all input types
- Test reconciliation scenarios
- Test queue limits

### Step 8: Manual Testing
Test with simulated latency, rapid inputs, ability effects, etc.

## Dependencies Between Changes

**Sequential dependencies**:
1. Helper functions MUST be created before gameStore methods (gameStore uses helpers)
2. gameStore methods MUST be done before client component (component calls gameStore)
3. Server changes can be done in parallel with client changes (independent)
4. Tests can be written after gameStore methods are implemented

**Parallel opportunities**:
- Server `handlePlayerInput()` changes (Step 4) can be done in parallel with client changes (Steps 2-3)
- Visual feedback (Step 6) can be done in parallel with implementation steps
- Tests (Step 7) can be written incrementally as each method is implemented
