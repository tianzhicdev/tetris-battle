# Implementation Plan for Spec 010: Client-Side Prediction

## Overview
- Total steps: 10
- Estimated new files: 2
- Estimated modified files: 4
- Key insight: Prediction state already exists, we're implementing the methods

## Steps

### Step 1: Create Prediction Helper Functions

**Files to create:**
- `packages/web/src/utils/predictionHelpers.ts` — Pure functions for state comparison and input application

**Implementation details:**

Create `predictionHelpers.ts` with two functions:

1. `areStatesEqual(predicted: GameState, server: GameState): boolean`
   - Compare only critical fields (not deep equality for performance):
     - `currentPiece.position.x`, `currentPiece.position.y`, `currentPiece.rotation`
     - `score`, `stars`, `linesCleared`, `comboCount`
   - Return `true` if all match, `false` otherwise
   - Handle null currentPiece case

2. `applyInputAction(state: GameState, action: PlayerInputType): GameState | null`
   - Import validation functions from `@tetris-battle/game-core`: `isValidPosition`, `movePiece`, `rotatePiece`, `getHardDropPosition`, `lockPiece`, `clearLines`
   - Use switch statement on `action` type
   - For each action:
     - Validate the action is legal (piece exists, position valid)
     - Apply the action using game-core functions
     - Return new state with immutable update pattern: `{ ...state, currentPiece: newPiece }`
     - Return `null` if action is invalid
   - Actions to implement:
     - `move_left`: `movePiece(currentPiece, -1, 0)` + validate
     - `move_right`: `movePiece(currentPiece, 1, 0)` + validate
     - `rotate_cw`: `rotatePiece(currentPiece, true)` + validate
     - `rotate_ccw`: `rotatePiece(currentPiece, false)` + validate
     - `soft_drop`: `movePiece(currentPiece, 0, 1)` + validate
     - `hard_drop`: Calculate drop position, lock piece, clear lines, update score/stars
   - Reference pattern from `gameStore.ts` lines 175-345 for how each action currently works

**Test:**
- Create `packages/web/src/__tests__/predictionHelpers.test.ts`
- Test cases:
  - `areStatesEqual()` returns true for identical states
  - `areStatesEqual()` returns false when position differs
  - `areStatesEqual()` returns false when score differs
  - `applyInputAction('move_left')` moves piece left
  - `applyInputAction('move_left')` returns null when blocked by wall
  - `applyInputAction('rotate_cw')` rotates piece
  - `applyInputAction('hard_drop')` drops piece to bottom
  - `applyInputAction()` returns null when no current piece
- Run: `pnpm --filter web test predictionHelpers`

**Verify:**
- All tests pass
- No errors from TypeScript compiler
- Functions are exported and importable

---

### Step 2: Implement predictInput() in gameStore

**Files to modify:**
- `packages/web/src/stores/gameStore.ts` — Replace placeholder `predictInput()` at line 442-444

**Implementation details:**

Replace the current placeholder:
```typescript
predictInput: (action: PlayerInputType) => {
  return null; // TODO: Implement in Step 3
},
```

With full implementation:
```typescript
predictInput: (action: PlayerInputType) => {
  const { isPredictionMode, predictedState, pendingInputs, inputSequence, gameState } = get();

  // If prediction mode not enabled, return null
  if (!isPredictionMode) {
    return null;
  }

  // Use predicted state if available, otherwise use game state
  const currentState = predictedState || gameState;

  // Generate next sequence number
  const seq = inputSequence + 1;

  // Apply action using helper (import from ../utils/predictionHelpers)
  const newState = applyInputAction(currentState, action);

  // If action failed validation, don't predict (return null)
  if (!newState) {
    console.warn('[PREDICTION] Action failed validation:', action);
    return null;
  }

  // Create pending input entry
  const pendingInput: PendingInput = {
    seq,
    action,
    predictedState: newState,
    timestamp: Date.now(),
  };

  // Check queue limit
  let newPendingInputs = [...pendingInputs, pendingInput];
  if (newPendingInputs.length > MAX_PENDING_INPUTS) {
    console.warn('[PREDICTION] Queue overflow, dropping oldest input');
    newPendingInputs = newPendingInputs.slice(1);
  }

  // Update store
  set({
    predictedState: newState,
    pendingInputs: newPendingInputs,
    inputSequence: seq,
  });

  return seq;
},
```

Add import at top:
```typescript
import { applyInputAction } from '../utils/predictionHelpers';
```

**Test:**
- Extend `packages/web/src/__tests__/predictionState.test.ts`
- Add test cases:
  - `predictInput()` returns seq number when prediction enabled
  - `predictInput()` returns null when prediction disabled
  - `predictInput()` updates predictedState
  - `predictInput()` adds to pendingInputs queue
  - `predictInput()` increments inputSequence
  - `predictInput()` enforces MAX_PENDING_INPUTS limit
  - `predictInput()` returns null for invalid action
- Run: `pnpm --filter web test predictionState`

**Verify:**
- All new tests pass
- `predictInput()` returns sequence numbers
- `pendingInputs` queue grows as expected

---

### Step 3: Implement reconcileWithServer() in gameStore

**Files to modify:**
- `packages/web/src/stores/gameStore.ts` — Replace placeholder `reconcileWithServer()` at line 446-448

**Implementation details:**

Replace placeholder with:
```typescript
reconcileWithServer: (confirmedSeq: number, serverState: any) => {
  const { pendingInputs, predictedState, onMisprediction } = get();

  // Remove all inputs with seq <= confirmedSeq
  const remainingInputs = pendingInputs.filter(input => input.seq > confirmedSeq);

  // Update server state
  set({ serverState });

  // Compare server state to predicted state
  const statesMatch = predictedState && areStatesEqual(predictedState, serverState);

  if (statesMatch) {
    // Perfect prediction! No visual change needed
    console.log('[PREDICTION] Perfect match for seq', confirmedSeq);
    set({ pendingInputs: remainingInputs });
    return;
  }

  // Misprediction detected
  console.warn('[MISPREDICTION] Server state differs from prediction', {
    seq: confirmedSeq,
    predicted: predictedState?.currentPiece,
    actual: serverState.currentPiece,
    pendingCount: remainingInputs.length,
  });

  // Snap to server state
  let reconciledState = serverState;

  // Replay remaining pending inputs
  for (const input of remainingInputs) {
    const newState = applyInputAction(reconciledState, input.action);
    if (newState) {
      reconciledState = newState;
      // Update the pending input's predicted state
      input.predictedState = newState;
    } else {
      // Input no longer valid, remove it
      console.warn('[PREDICTION] Replay failed for action:', input.action);
    }
  }

  // Update state and trigger misprediction callback
  set({
    predictedState: reconciledState,
    pendingInputs: remainingInputs.filter(input =>
      applyInputAction(reconciledState, input.action) !== null
    ),
  });

  // Trigger visual feedback
  if (onMisprediction) {
    onMisprediction();
  }
},
```

Add import at top (if not already added):
```typescript
import { areStatesEqual } from '../utils/predictionHelpers';
```

**Test:**
- Extend `packages/web/src/__tests__/predictionState.test.ts`
- Test cases:
  - `reconcileWithServer()` removes confirmed inputs from queue
  - `reconcileWithServer()` with matching states: no callback triggered
  - `reconcileWithServer()` with misprediction: callback triggered
  - `reconcileWithServer()` replays remaining pending inputs
  - `reconcileWithServer()` updates serverState
  - `reconcileWithServer()` with replay failure: removes invalid input
- Run: `pnpm --filter web test predictionState`

**Verify:**
- All tests pass
- Misprediction callback fires when states differ
- Pending inputs replayed correctly

---

### Step 4: Implement handleInputRejection() in gameStore

**Files to modify:**
- `packages/web/src/stores/gameStore.ts` — Replace placeholder `handleInputRejection()` at line 450-452

**Implementation details:**

Replace placeholder with:
```typescript
handleInputRejection: (rejectedSeq: number, serverState: any) => {
  const { pendingInputs, onMisprediction } = get();

  console.error('[INPUT REJECTED] Seq:', rejectedSeq, 'Reason:', serverState.reason || 'unknown');

  // Remove the rejected input and all older inputs
  const remainingInputs = pendingInputs.filter(input => input.seq > rejectedSeq);

  // Snap to server state (same as misprediction)
  let reconciledState = serverState;

  // Replay remaining inputs
  for (const input of remainingInputs) {
    const newState = applyInputAction(reconciledState, input.action);
    if (newState) {
      reconciledState = newState;
      input.predictedState = newState;
    }
  }

  set({
    serverState,
    predictedState: reconciledState,
    pendingInputs: remainingInputs,
  });

  // Trigger visual feedback
  if (onMisprediction) {
    onMisprediction();
  }
},
```

**Test:**
- Extend `packages/web/src/__tests__/predictionState.test.ts`
- Test cases:
  - `handleInputRejection()` removes rejected input from queue
  - `handleInputRejection()` snaps to server state
  - `handleInputRejection()` replays remaining inputs
  - `handleInputRejection()` triggers misprediction callback
- Run: `pnpm --filter web test predictionState`

**Verify:**
- All tests pass
- Rejected inputs removed correctly
- State reconciles properly after rejection

---

### Step 5: Update ServerAuthGameClient to Send Sequence Numbers

**Files to modify:**
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` — Modify `sendInput()` method at line 161-168

**Implementation details:**

Change the `sendInput()` method signature and implementation:

**Before:**
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

**After:**
```typescript
sendInput(input: PlayerInputType, seq: number | null = null): void {
  const payload: any = {
    type: 'player_input',
    playerId: this.playerId,
    input,
    timestamp: Date.now(),
  };

  // Include seq number if provided (prediction mode)
  if (seq !== null) {
    payload.seq = seq;
  }

  this.send(payload);
}
```

**Test:**
- No unit test needed (integration tested in Step 8)

**Verify:**
- TypeScript compiles without errors
- Method signature updated correctly

---

### Step 6: Add Message Handlers for input_confirmed and input_rejected

**Files to modify:**
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` — Add cases in `connect()` method around line 93-141

**Implementation details:**

In the `connect()` method, add two new parameters to the function signature:
```typescript
connect(
  onStateUpdate: (state: GameStateUpdate) => void,
  onOpponentDisconnected: () => void,
  onGameFinished: (winnerId: string) => void,
  onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void,
  onAbilityActivationResult?: (result: AbilityActivationResult) => void,
  onInputConfirmed?: (confirmedSeq: number, serverState: any) => void,  // NEW
  onInputRejected?: (rejectedSeq: number, reason: string, serverState: any) => void  // NEW
): void {
```

In the `switch (data.type)` statement (around line 93), add these cases before the `default`:

```typescript
case 'input_confirmed':
  if (onInputConfirmed) {
    onInputConfirmed(data.confirmedSeq, data.serverState);
  }
  this.debugLogger?.logEvent(
    'input_confirmed',
    `Input seq ${data.confirmedSeq} confirmed`,
    data
  );
  break;

case 'input_rejected':
  if (onInputRejected) {
    onInputRejected(data.rejectedSeq, data.reason, data.serverState);
  }
  this.debugLogger?.logEvent(
    'input_rejected',
    `Input seq ${data.rejectedSeq} rejected: ${data.reason}`,
    data
  );
  break;
```

**Test:**
- No unit test needed (integration tested in Step 8)

**Verify:**
- TypeScript compiles
- Callbacks are optional (use `?` operator)

---

### Step 7: Update Server to Send input_confirmed and input_rejected

**Files to modify:**
- `packages/partykit/src/game.ts` — Modify `handlePlayerInput()` method at lines 199-210

**Implementation details:**

Replace the entire `handlePlayerInput()` method:

**Before:**
```typescript
private handlePlayerInput(playerId: string, input: PlayerInputType): void {
  const serverState = this.serverGameStates.get(playerId);
  if (!serverState) {
    console.warn(`[INPUT] No server state for player ${playerId}`);
    return;
  }

  const stateChanged = serverState.processInput(input);
  if (stateChanged) {
    this.broadcastState();
  }
}
```

**After:**
```typescript
private handlePlayerInput(playerId: string, input: PlayerInputType, seq?: number): void {
  const serverState = this.serverGameStates.get(playerId);
  if (!serverState) {
    console.warn(`[INPUT] No server state for player ${playerId}`);
    this.sendToPlayer(playerId, {
      type: 'input_rejected',
      rejectedSeq: seq || 0,
      reason: 'no_server_state',
      serverState: null,
    });
    return;
  }

  const stateChanged = serverState.processInput(input);

  if (stateChanged) {
    // Input was successful
    if (seq !== undefined) {
      this.sendToPlayer(playerId, {
        type: 'input_confirmed',
        confirmedSeq: seq,
        serverState: serverState.getPublicState(),
      });
    }
    this.broadcastState();
  } else {
    // Input failed validation (collision, etc.)
    if (seq !== undefined) {
      this.sendToPlayer(playerId, {
        type: 'input_rejected',
        rejectedSeq: seq,
        reason: 'invalid_action',
        serverState: serverState.getPublicState(),
      });
    }
  }
}
```

Update the `onMessage` switch case to pass `seq`:
```typescript
case 'player_input':
  this.handlePlayerInput(data.playerId, data.input, data.seq);
  break;
```

Add helper method `sendToPlayer()` if it doesn't exist:
```typescript
private sendToPlayer(playerId: string, message: any): void {
  const playerState = this.players.get(playerId);
  if (!playerState) return;

  const conn = this.getConnection(playerState.connectionId);
  if (conn) {
    conn.send(JSON.stringify(message));
  }
}
```

**Test:**
- No unit test needed (PartyKit server, integration tested)

**Verify:**
- TypeScript compiles
- Server logs show input confirmations

---

### Step 8: Wire Up Prediction in ServerAuthMultiplayerGame

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` — Multiple changes for prediction integration

**Implementation details:**

**Change 1: Enable prediction mode on mount**

Add near the top of the component (after state declarations, around line 200):
```typescript
const gameStore = useGameStore();

useEffect(() => {
  // Enable prediction mode
  gameStore.setPredictionMode(true);

  return () => {
    gameStore.setPredictionMode(false);
  };
}, []);
```

**Change 2: Add misprediction visual feedback**

Add state for visual feedback:
```typescript
const [showMispredictionFeedback, setShowMispredictionFeedback] = useState(false);
```

Add misprediction callback setup:
```typescript
useEffect(() => {
  gameStore.setOnMisprediction(() => {
    setShowMispredictionFeedback(true);
    haptics.impact('light');
    setTimeout(() => setShowMispredictionFeedback(false), 200);
  });
}, []);
```

**Change 3: Update gameClient.connect() call**

Find the `gameClient.current.connect()` call (around line 250-280) and add the new callback parameters:
```typescript
gameClient.current.connect(
  handleStateUpdate,
  handleOpponentDisconnected,
  handleGameFinished,
  handleAbilityReceived,
  handleAbilityActivationResult,
  // NEW: Input confirmation handler
  (confirmedSeq, serverState) => {
    gameStore.reconcileWithServer(confirmedSeq, serverState);
  },
  // NEW: Input rejection handler
  (rejectedSeq, reason, serverState) => {
    console.error('[INPUT REJECTED]', reason);
    gameStore.handleInputRejection(rejectedSeq, serverState);
  }
);
```

**Change 4: Update input handlers to predict**

Find the `handleKeyDown` function (around line 400-450) and update each case:

**Before (example):**
```typescript
case 'ArrowLeft':
  gameClient.current?.sendInput('move_left');
  break;
```

**After:**
```typescript
case 'ArrowLeft':
  const seq = gameStore.predictInput('move_left');
  gameClient.current?.sendInput('move_left', seq);
  break;
```

Apply this pattern to all input types:
- `ArrowLeft` → `move_left`
- `ArrowRight` → `move_right`
- `ArrowDown` → `soft_drop`
- `ArrowUp` (or `w`, `x`) → `rotate_cw`
- `z` → `rotate_ccw`
- `' '` (space) → `hard_drop`

**Change 5: Render from predictedState instead of yourState**

Find where the component renders the Tetris board (around line 600-700). Replace state references:

**Before:**
```typescript
<TetrisRenderer
  board={yourState.board}
  currentPiece={yourState.currentPiece}
  // ...
/>
```

**After:**
```typescript
<TetrisRenderer
  board={gameStore.predictedState?.board || yourState.board}
  currentPiece={gameStore.predictedState?.currentPiece || yourState.currentPiece}
  score={gameStore.predictedState?.score || yourState.score}
  stars={gameStore.predictedState?.stars || yourState.stars}
  // ...
/>
```

**Change 6: Add misprediction visual feedback CSS**

In the JSX, add a className conditional to the board wrapper:
```typescript
<div className={`board-container ${showMispredictionFeedback ? 'prediction-correction' : ''}`}>
```

**Test:**
- Manual testing in Step 10

**Verify:**
- Component compiles
- No TypeScript errors
- Component renders

---

### Step 9: Add Prediction Feedback Styles

**Files to create:**
- `packages/web/src/styles/predictionFeedback.css` — Visual feedback for mispredictions

**Implementation details:**

Create CSS file with:
```css
.prediction-correction {
  outline: 2px solid rgba(255, 0, 0, 0.3);
  animation: shake 0.2s ease-in-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
}

/* Smooth transition for piece position corrections */
.tetris-board canvas {
  transition: transform 0.05s ease-out;
}
```

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` — Import the CSS

Add import at the top:
```typescript
import '../styles/predictionFeedback.css';
```

**Test:**
- Visual inspection during manual testing

**Verify:**
- CSS file created
- Import added to component
- No build errors

---

### Step 10: Run Build and Tests

**Implementation details:**

1. Run TypeScript build:
   ```bash
   pnpm --filter web build
   ```

2. Run all tests:
   ```bash
   pnpm --filter web test
   ```

3. Run specific prediction tests:
   ```bash
   pnpm --filter web test predictionHelpers
   pnpm --filter web test predictionState
   ```

4. Start dev server and test manually:
   ```bash
   pnpm dev
   ```

   Open: `http://localhost:5173/?serverAuth=true&debug=true`

**Manual test scenarios:**
- Press arrow keys rapidly - should feel instant (no lag)
- Open debug panel - check for `input_confirmed` messages
- Force misprediction - modify client to predict wrong position
- Check prediction stats in debug panel

**Verify:**
- Build succeeds with no errors
- All tests pass
- Manual testing shows instant feedback
- Misprediction rate <1% under normal conditions

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|----------------|-------------------|
| Scenario 1: Normal Input (instant feedback) | Steps 2, 5, 8 |
| Scenario 2: Misprediction (visual feedback) | Steps 3, 8, 9 |
| Scenario 3: Rapid Input Sequence | Steps 2, 3 (queue management) |
| Scenario 4: Network Lag | Step 2 (queue limit), Step 3 (replay) |
| Scenario 5: Hard Drop Prediction | Step 1 (applyInputAction for hard_drop) |
| Unit test: applyInputAction() for all actions | Step 1 |
| Unit test: areStatesEqual() comparison | Step 1 |
| Unit test: reconcileWithServer() with matching states | Step 3 |
| Unit test: reconcileWithServer() with misprediction | Step 3 |
| Unit test: pending input queue limit | Step 2 |
| Manual test: all 7 input types work | Step 10 |
| Manual test: spam keys rapidly | Step 10 |
| Manual test: simulated latency | Step 10 |
| Perceived lag <10ms | Steps 2, 8 (instant prediction) |
| Misprediction rate <1% | Steps 3, 10 (verify metrics) |

## Build/Test Commands

- **Build all**: `pnpm build:all`
- **Build web only**: `pnpm --filter web build`
- **Test all web**: `pnpm --filter web test`
- **Test specific**: `pnpm --filter web test <pattern>`
- **Test watch mode**: `pnpm --filter web test:watch`
- **Dev server**: `pnpm dev`

## Notes

- Steps 1-4 are pure implementation (helper functions + gameStore methods)
- Steps 5-7 are integration (client-server message protocol)
- Step 8 is UI wiring (React component)
- Step 9 is styling (visual feedback)
- Step 10 is verification (build + test)

- Dependencies are strictly ordered: each step builds on previous steps
- No circular dependencies
- Can pause after any step and resume later
