# Spec 010: Client-Side Prediction for Server-Authoritative Mode

## Status
💡 **ENHANCEMENT** - Reduce input lag in server-authoritative gameplay

## Problem

### Current State (Server-Authoritative Without Prediction)
When playing in server-authoritative mode (`?serverAuth=true`):
- User presses a key (rotate, move, etc.)
- Client sends input to server
- **Wait 100-150ms for network round-trip**
- Server validates and responds
- Client updates UI

**Result**: 100-150ms input lag feels sluggish and unresponsive.

**User Experience Issues:**
- Piece movement feels delayed, like "playing through mud"
- Rotation has noticeable lag
- Hard to perform fast maneuvers (T-spins, quick placements)
- Players prefer client-authoritative mode despite it being less fair
- Competitive gameplay suffers

### Desired State (Client-Side Prediction)
- User presses a key
- **Client immediately applies the action locally (0ms perceived lag)**
- Client sends input to server asynchronously
- Server validates 100-150ms later
- **If server agrees**: No visual change (seamless)
- **If server disagrees**: Snap to server state, replay pending inputs (rare, <1% of inputs)

**Result**: Feels instant like single-player, but maintains server authority and fairness.

## Requirements

### 1. Prediction State Management

#### Add Prediction State to gameStore.ts
- [ ] `serverState: GameState | null` - Last confirmed state from server (source of truth)
- [ ] `predictedState: GameState` - Current optimistic state (rendered to user)
- [ ] `pendingInputs: PendingInput[]` - Queue of inputs awaiting server confirmation
- [ ] `inputSequence: number` - Monotonic counter for input sequencing

```typescript
interface PendingInput {
  seq: number;           // Unique sequence number
  action: InputAction;   // The input action
  predictedState: GameState; // What we predicted the result would be
  timestamp: number;     // When it was sent
}
```

#### Prediction Flow
```
1. User input received
   ↓
2. Generate sequence number (seq++)
   ↓
3. Apply action to predictedState immediately
   ↓
4. Store in pendingInputs queue
   ↓
5. Send to server with seq number
   ↓
6. Continue playing with predicted state
   ↓
7. Server confirms (100-150ms later)
   ↓
8. Reconcile:
   - Remove confirmed inputs from queue
   - Compare server state to prediction
   - If matches: No change (perfect!)
   - If differs: Snap to server state, replay remaining pending inputs
```

### 2. Input Prediction

#### predictInput() Function
- [ ] Accept `InputAction` parameter
- [ ] Generate next sequence number
- [ ] Apply action to current `predictedState` using game-core logic
- [ ] Store predicted result in `pendingInputs` queue
- [ ] Update `predictedState` for immediate rendering
- [ ] Send to server asynchronously (don't wait)

**Actions to Predict:**
- `move_left` - Move piece left 1 cell
- `move_right` - Move piece right 1 cell
- `rotate_cw` - Rotate clockwise
- `rotate_ccw` - Rotate counter-clockwise
- `soft_drop` - Move piece down 1 cell
- `hard_drop` - Drop to bottom instantly
- `hold` - Swap with hold piece

**Non-Predicted Actions:**
- Gravity tick (server-controlled)
- Ability effects (server-validated)
- Opponent actions (server-broadcasted)

#### Apply Input Locally
Use existing game-core functions:
```typescript
function applyInputAction(state: GameState, action: InputAction): GameState {
  switch (action.type) {
    case 'move_left':
      return applyMoveLeft(state); // Use game-core logic
    case 'rotate_cw':
      return applyRotateCW(state);
    // ... other actions
  }
}
```

**Must validate locally** (same validation as server):
- Is position valid? (collision check)
- Is piece rotation blocked?
- Is action allowed in current state?

### 3. Server Reconciliation

#### reconcileWithServer() Function
Called when server confirms an input.

**Parameters:**
- `confirmedSeq: number` - Which input was confirmed
- `serverState: GameState` - Authoritative state from server

**Algorithm:**
```typescript
1. Remove all inputs with seq <= confirmedSeq from pendingInputs
2. Compare serverState to predictedState
3. If identical:
   - Perfect prediction! Update serverState, no visual change
4. If different (misprediction):
   - Log misprediction event
   - Set predictedState = serverState (snap to server truth)
   - Replay all remaining pendingInputs on top of serverState
   - Update UI (may cause brief visual snap)
   - Show subtle correction feedback (optional red flash)
```

**State Comparison:**
Compare critical fields only (not deep equality):
- `currentPiece.position.x`
- `currentPiece.position.y`
- `currentPiece.rotation`
- `score`
- `stars`

**Replay Pending Inputs:**
```typescript
let reconciledState = serverState; // Start from truth

for (const input of remainingInputs) {
  reconciledState = applyInputAction(reconciledState, input.action);
}

predictedState = reconciledState;
```

### 4. Message Protocol Updates

#### Client → Server Messages

**Input Message (New):**
```typescript
{
  type: 'player_input',
  playerId: string,
  action: InputAction,
  seq: number,        // NEW: Sequence number for reconciliation
  timestamp: number,
}
```

**Replace**: Old `game_state_update` messages (client no longer sends full state)

#### Server → Client Messages

**Input Confirmed (New):**
```typescript
{
  type: 'input_confirmed',
  confirmedSeq: number,    // Which input was processed
  serverState: GameState,  // Authoritative state after input
}
```

**Input Rejected (New):**
```typescript
{
  type: 'input_rejected',
  rejectedSeq: number,
  reason: string,          // Why it was rejected
  serverState: GameState,  // Current authoritative state
}
```

**Reasons for rejection:**
- `collision_detected` - Piece would overlap with board/blocks
- `rotation_blocked` - No valid rotation position
- `no_active_piece` - Tried to move when no piece exists
- `invalid_action` - Action not recognized

### 5. Server-Side Input Validation

#### handlePlayerInput() in game.ts
- [ ] Receive `player_input` message with seq number
- [ ] Validate action against current server state
- [ ] Apply action if valid, update server state
- [ ] Send `input_confirmed` with seq and new state
- [ ] OR send `input_rejected` with reason if invalid
- [ ] Broadcast updated state to opponent

**Validation Functions:**
```typescript
validateMoveLeft(state: GameState): ValidationResult {
  if (!state.currentPiece) {
    return { valid: false, error: 'No active piece' };
  }

  const newPiece = movePiece(state.currentPiece, -1, 0);

  if (!isValidPosition(state.board, newPiece)) {
    return { valid: false, error: 'Collision detected' };
  }

  return {
    valid: true,
    newState: { ...state, currentPiece: newPiece },
  };
}
```

**Must use same validation logic as client** (use shared game-core functions).

### 6. Visual Feedback for Corrections

#### Misprediction Feedback
When server state differs from prediction:

**Visual:**
- [ ] Brief red outline on tetris board (200ms)
- [ ] Subtle shake animation
- [ ] Fade transition to new piece position (not instant snap)

**Audio:**
- [ ] Soft "correction beep" sound
- [ ] Different from normal move sound
- [ ] Subtle, not jarring

**When to show:**
- Only on actual mispredictions (<1% of inputs)
- Not on normal confirmations
- Helps user understand why piece "jumped"

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

### 7. Performance Optimizations

#### Limit Pending Inputs Queue
- [ ] Max 50 pending inputs (~2.5 seconds at 20 inputs/sec)
- [ ] Drop oldest if queue exceeds limit (network lag)
- [ ] Log warning if queue grows too large

**Reason**: Prevent memory leak during network issues.

#### Debounce Reconciliation
- [ ] Batch reconciliations within 5ms window
- [ ] Avoid reconciling on every server message
- [ ] Improves performance when server sends rapid updates

#### Fast State Comparison
- [ ] Compare only critical fields (not deep equality)
- [ ] Deep comparison is too slow for 60fps
- [ ] Fields to compare: position, rotation, score, stars

#### Optimize Replay Algorithm
- [ ] Limit replays to max 10 inputs
- [ ] If more than 10 pending, drop oldest and warn user
- [ ] Edge case: severe network lag

## Implementation Plan

### Phase 1: Add Prediction State (1 day)
- [ ] Update `GameStore` interface with prediction fields
- [ ] Initialize `serverState`, `predictedState`, `pendingInputs`, `inputSequence`
- [ ] Create `PendingInput` interface
- [ ] Add state to initial values

### Phase 2: Implement Prediction Logic (1 day)
- [ ] Write `applyInputAction()` function using game-core
- [ ] Implement `predictInput()` function
- [ ] Add `areStatesEqual()` comparison function
- [ ] Add `MAX_PENDING_INPUTS` limit check

### Phase 3: Implement Reconciliation (1 day)
- [ ] Write `reconcileWithServer()` function
- [ ] Implement replay algorithm for pending inputs
- [ ] Add misprediction detection logic
- [ ] Add correction feedback (CSS + sound)

### Phase 4: Update Input Handlers (0.5 days)
- [ ] Replace all input handlers to call `predictInput()`
- [ ] Remove old state mutation code
- [ ] Test all 7 input actions

### Phase 5: Update gameSync.ts (0.5 days)
- [ ] Add `sendInput()` method with seq parameter
- [ ] Remove/deprecate old `updateGameState()` method
- [ ] Add handlers for `input_confirmed` and `input_rejected`
- [ ] Wire up reconciliation calls

### Phase 6: Update Server (1 day)
- [ ] Add `handlePlayerInput()` handler in game.ts
- [ ] Implement validation for all 7 input actions
- [ ] Send `input_confirmed` on success
- [ ] Send `input_rejected` on failure
- [ ] Test server-side validation

### Phase 7: Update Rendering (0.5 days)
- [ ] Change components to render `predictedState` (not `gameState`)
- [ ] Verify all components use correct state
- [ ] Test visual correctness

### Phase 8: Testing & Tuning (1 day)
- [ ] Add simulated latency (150ms) for testing
- [ ] Log misprediction rate
- [ ] Test rapid inputs (spam keys)
- [ ] Test during ability effects
- [ ] Test with poor network conditions
- [ ] Tune state comparison thresholds

**Total: ~6 days**

## Acceptance Criteria

### Scenario 1: Normal Input (99% of cases)
```
GIVEN user is playing in server-auth mode
WHEN user presses rotate button
THEN piece rotates INSTANTLY on screen (<10ms perceived lag)
AND input is sent to server
AND 100ms later server confirms
AND no visual change occurs (prediction was correct)
AND user experiences zero lag
```

### Scenario 2: Misprediction (<1% of cases)
```
GIVEN user rotates piece
AND opponent simultaneously sends garbage
WHEN client predicts rotation (doesn't know about garbage yet)
THEN client shows rotated piece
AND 100ms later server responds "rotation blocked by new garbage"
THEN client snaps piece back to un-rotated position
AND shows brief red outline + shake
AND plays subtle correction sound
AND user understands why correction occurred
```

### Scenario 3: Rapid Input Sequence
```
GIVEN user spams left-left-left-rotate-down rapidly
WHEN all 5 inputs are sent within 200ms
THEN all 5 actions render instantly
AND pendingInputs queue contains 5 entries
AND server confirms them one by one over next 300ms
AND all predictions match (no corrections)
AND user experiences smooth, responsive controls
```

### Scenario 4: Network Lag
```
GIVEN network latency spikes to 500ms
WHEN user continues playing
THEN pendingInputs queue grows to 10-20 entries
AND user still sees instant feedback
AND 500ms later confirmations arrive in batch
AND reconciliation replays correctly
AND no visual glitches occur
```

### Scenario 5: Hard Drop Prediction
```
GIVEN user presses spacebar (hard drop)
WHEN prediction is applied
THEN piece instantly drops to bottom
AND locks in place
AND new piece spawns
AND score updates
AND 100ms later server confirms
AND predicted state matches perfectly
```

## Testing

### Manual Tests
- [ ] Test all 7 input types (left, right, rotate_cw, rotate_ccw, soft_drop, hard_drop, hold)
- [ ] Spam keys rapidly, verify no desyncs
- [ ] Test during ability effects (speed up, reverse controls)
- [ ] Test with simulated 50ms, 100ms, 200ms latency
- [ ] Trigger misprediction intentionally (modify client to predict incorrectly)
- [ ] Test with packet loss simulation
- [ ] Play full game start-to-finish, verify smooth experience

### Automated Tests
- [ ] Unit test `applyInputAction()` for all action types
- [ ] Unit test `areStatesEqual()` comparison
- [ ] Unit test `reconcileWithServer()` with matching states
- [ ] Unit test `reconcileWithServer()` with misprediction + replay
- [ ] Unit test pending input queue limit
- [ ] Integration test: client prediction + server validation match

### Performance Metrics
- [ ] **Perceived lag**: <10ms (instant)
- [ ] **Misprediction rate**: <1% with good network
- [ ] **Reconciliation time**: <5ms for replay of 10 inputs
- [ ] **FPS impact**: 0 (should not affect frame rate)
- [ ] **Memory usage**: <1MB for pending inputs queue

### Edge Cases
- [ ] Server rejects all inputs (firewall/lag)
- [ ] pendingInputs queue exceeds 50 entries
- [ ] Server sends out-of-order confirmations
- [ ] Rapid theme during reconciliation
- [ ] Game over during pending inputs
- [ ] Opponent disconnects during reconciliation

## Success Metrics

- [ ] Perceived input lag reduced from 100-150ms to <10ms
- [ ] Misprediction rate <1% under normal network conditions
- [ ] User testing: "Feels like single-player" feedback
- [ ] No increase in client-side CPU/memory usage
- [ ] Works smoothly with 50-200ms network latency
- [ ] Zero desyncs between client and server
- [ ] Players prefer server-auth mode with prediction over client-auth mode

## Monitoring & Debugging

### Metrics to Track
```typescript
interface PredictionMetrics {
  totalInputs: number;
  mispredictions: number;
  mispredictionRate: number; // percentage
  avgPendingInputs: number;
  maxPendingInputs: number;
  avgReconciliationTime: number; // ms
}
```

### Debug Logging
```typescript
// Log mispredictions
if (misprediction) {
  console.warn('[MISPREDICTION]', {
    seq: confirmedSeq,
    predicted: predictedState.currentPiece,
    actual: serverState.currentPiece,
    pendingCount: pendingInputs.length,
  });
}

// Log prediction stats every 100 inputs
if (totalInputs % 100 === 0) {
  console.log('[PREDICTION STATS]', {
    rate: (mispredictionCount / totalInputs * 100).toFixed(2) + '%',
    avgPending: avgPendingInputs,
  });
}
```

### Debug Panel Integration
When Spec 008 (Debug Panel) is implemented:
- [ ] Show live misprediction rate
- [ ] Show pending inputs count
- [ ] Show predicted vs server state comparison
- [ ] Button to force misprediction (for testing)
- [ ] Graph of input lag over time

## Notes

- **Priority**: HIGH - Critical for server-auth mode to feel good
- **Complexity**: MEDIUM - Well-established pattern, clear implementation
- **Dependency**: Requires Spec 006 (Server-Authoritative Architecture) to be deployed
- **Compatibility**: Only applies to `?serverAuth=true` mode, legacy mode unchanged

## Related Features

- Builds on Spec 006 (Server-Authoritative Architecture)
- Essential for competitive gameplay viability
- Enables future features: replays, spectating (all based on server state)
- Makes server-auth mode the preferred default

## Future Enhancements

- [ ] **Lag compensation**: Render opponent slightly behind to smooth out network jitter
- [ ] **Input buffering**: Queue inputs during network drops, send when reconnected
- [ ] **Adaptive prediction**: Learn from mispredictions, adjust prediction confidence
- [ ] **Visual interpolation**: Smooth transitions between predicted and corrected states
- [ ] **Network quality indicator**: Show ping, packet loss to user
- [ ] **Rollback netcode**: Advanced technique for fighting games (overkill for Tetris)

## References

- [Valve Source Engine Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)
- [Gabriel Gambetta: Client-Side Prediction](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
- [Overwatch Gameplay Architecture](https://www.youtube.com/watch?v=W3aieHjyNvw)
- [Fast-Paced Multiplayer (Gabriel Gambetta)](https://www.gabrielgambetta.com/client-server-game-architecture.html)

## Comparison: Before vs After

### Before (Server-Auth Without Prediction)
```
User presses rotate
  ↓
Send to server
  ↓
⏱️ WAIT 150ms ⏱️
  ↓
Server responds
  ↓
Update UI ← USER SEES LAG HERE
```

**Result**: "Feels sluggish, like playing through mud"

### After (Server-Auth With Prediction)
```
User presses rotate
  ↓
Apply locally ← INSTANT FEEDBACK (0ms)
  ↓
Send to server (async, don't wait)
  ↓
Keep playing with predicted state
  ↓
⏱️ 150ms later ⏱️
  ↓
Server confirms (usually matches)
  ↓
No visual change (seamless)
```

**Result**: "Feels native, like single-player"

## Implementation Checklist

### Code Changes Required

**gameStore.ts:**
- [ ] Add `serverState`, `predictedState`, `pendingInputs`, `inputSequence`
- [ ] Implement `predictInput()` function
- [ ] Implement `reconcileWithServer()` function
- [ ] Implement `applyInputAction()` helper
- [ ] Implement `areStatesEqual()` helper
- [ ] Add pending inputs queue limit

**Input Handlers (gameStore.ts):**
- [ ] `movePieceLeft()` → calls `predictInput()`
- [ ] `movePieceRight()` → calls `predictInput()`
- [ ] `rotatePieceClockwise()` → calls `predictInput()`
- [ ] `rotatePieceCounterClockwise()` → calls `predictInput()`
- [ ] `softDrop()` → calls `predictInput()`
- [ ] `hardDrop()` → calls `predictInput()`
- [ ] `holdPiece()` → calls `predictInput()`

**gameSync.ts:**
- [ ] Add `sendInput(action, seq)` method
- [ ] Add handler for `input_confirmed` message
- [ ] Add handler for `input_rejected` message
- [ ] Remove/deprecate `updateGameState()` method

**game.ts (Server):**
- [ ] Add `handlePlayerInput()` handler
- [ ] Implement validation for all 7 input types
- [ ] Send `input_confirmed` on valid input
- [ ] Send `input_rejected` on invalid input

**Components:**
- [ ] Update TetrisBoard to render `predictedState`
- [ ] Update CurrentPiece to render from `predictedState`
- [ ] Update Score/Stars to show `predictedState` values

**CSS:**
- [ ] Add `.prediction-correction` class
- [ ] Add shake animation
- [ ] Add red outline effect

**Audio:**
- [ ] Add correction beep sound

**Types:**
- [ ] Add `PendingInput` interface
- [ ] Add `InputAction` type union
- [ ] Add `ValidationResult` interface

### Files to Modify
1. `packages/web/src/stores/gameStore.ts` - Core prediction logic
2. `packages/web/src/services/partykit/gameSync.ts` - Send inputs, handle confirmations
3. `packages/partykit/src/game.ts` - Server input validation
4. `packages/web/src/components/TetrisBoard.tsx` - Render predicted state
5. `packages/web/src/components/CurrentPiece.tsx` - Render predicted piece
6. `packages/web/src/styles/prediction.css` - Correction feedback styles
7. `packages/web/src/types/prediction.ts` - Type definitions

### Estimated Lines of Code
- gameStore.ts: +200 lines
- gameSync.ts: +50 lines
- game.ts: +150 lines
- Components: +20 lines
- CSS: +20 lines
- Types: +30 lines

**Total: ~470 lines of code**

## Rollout Strategy

### Development
1. Implement on feature branch
2. Test with simulated latency (50ms, 100ms, 200ms)
3. Manual testing: full gameplay session
4. Verify misprediction rate <1%

### Staging
1. Deploy to staging environment
2. Internal testing for 1 week
3. Monitor misprediction metrics
4. Collect feedback on "feel"

### Production
1. Enable for users with `?serverAuth=true&prediction=true`
2. A/B test: 50% with prediction, 50% without
3. Compare metrics: input lag perception, game completion rate
4. If metrics positive: Enable by default for all server-auth users
5. After 1 month: Make server-auth with prediction the default mode

### Rollback Plan
If issues occur:
- Disable prediction via feature flag
- Fall back to server-auth without prediction
- Fix issues, redeploy
- Re-enable gradually
