# Implementation Plan for Spec 010: Client-Side Prediction

## Overview
- Total steps: 14
- Estimated new files: 3
- Estimated modified files: 6
- Estimated lines of code: ~470

## Steps

### Step 1: Create Prediction Type Definitions

**Files to create:**
- `packages/web/src/types/prediction.ts` — Prediction-specific TypeScript interfaces

**Implementation details:**
Create a new file with the following type definitions:

```typescript
import type { GameState, PlayerInputType } from '@tetris-battle/game-core';

export interface PendingInput {
  seq: number;              // Unique sequence number
  action: PlayerInputType;  // The input action
  predictedState: GameState; // What we predicted the result would be
  timestamp: number;        // When it was sent (Date.now())
}

export interface InputConfirmation {
  type: 'input_confirmed';
  confirmedSeq: number;
  serverState: any; // Public state from server
}

export interface InputRejection {
  type: 'input_rejected';
  rejectedSeq: number;
  reason: 'collision_detected' | 'rotation_blocked' | 'no_active_piece' | 'invalid_action';
  serverState: any; // Current authoritative state
}

export const MAX_PENDING_INPUTS = 50;
```

**Test:**
- Type-check only: `pnpm --filter web build`
- No runtime tests needed for type definitions

**Verify:**
- File exists and type-checks without errors
- Can import types in other files

---

### Step 2: Add Prediction State to gameStore

**Files to modify:**
- `packages/web/src/stores/gameStore.ts`

**Implementation details:**

1. Import new types at top of file (after line 20):
```typescript
import type { PendingInput } from '../types/prediction';
import type { PlayerInputType } from '@tetris-battle/game-core';
```

2. Add new fields to `GameStore` interface (after line 33):
```typescript
  // Client-side prediction (server-auth mode only)
  serverState: GameState | null;    // Last confirmed state from server
  predictedState: GameState | null; // Current optimistic state (rendered)
  pendingInputs: PendingInput[];    // Queue of inputs awaiting confirmation
  inputSequence: number;             // Monotonic counter for input sequencing
  isPredictionMode: boolean;         // Whether prediction is active
```

3. Add new methods to `GameStore` interface (after line 56):
```typescript
  // Prediction methods
  setPredictionMode: (enabled: boolean) => void;
  setServerState: (state: GameState) => void;
  setPredictedState: (state: GameState) => void;
  predictInput: (action: PlayerInputType) => number | null; // Returns seq number
  reconcileWithServer: (confirmedSeq: number, serverState: any) => void;
  handleInputRejection: (rejectedSeq: number, serverState: any) => void;
```

4. Initialize new fields in initial state (after line 70):
```typescript
  serverState: null,
  predictedState: null,
  pendingInputs: [],
  inputSequence: 0,
  isPredictionMode: false,
```

5. Add setter implementations (after line 400):
```typescript
  setPredictionMode: (enabled: boolean) => {
    set({ isPredictionMode: enabled });
  },

  setServerState: (state: GameState) => {
    set({ serverState: state });
  },

  setPredictedState: (state: GameState) => {
    set({ predictedState: state });
  },

  // Placeholder implementations (will be filled in next steps)
  predictInput: (action: PlayerInputType) => {
    return null; // TODO: Implement in Step 3
  },

  reconcileWithServer: (confirmedSeq: number, serverState: any) => {
    // TODO: Implement in Step 4
  },

  handleInputRejection: (rejectedSeq: number, serverState: any) => {
    // TODO: Implement in Step 4
  },
```

**Test:**
- Type-check: `pnpm --filter web build`
- Unit test: Create `packages/web/src/__tests__/predictionState.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/gameStore';

describe('Prediction State Management', () => {
  beforeEach(() => {
    useGameStore.setState({
      serverState: null,
      predictedState: null,
      pendingInputs: [],
      inputSequence: 0,
      isPredictionMode: false,
    });
  });

  it('should initialize with prediction mode disabled', () => {
    const { isPredictionMode } = useGameStore.getState();
    expect(isPredictionMode).toBe(false);
  });

  it('should enable prediction mode', () => {
    useGameStore.getState().setPredictionMode(true);
    expect(useGameStore.getState().isPredictionMode).toBe(true);
  });

  it('should set server state', () => {
    const mockState = { score: 100, stars: 50 } as any;
    useGameStore.getState().setServerState(mockState);
    expect(useGameStore.getState().serverState).toEqual(mockState);
  });
});
```

Run: `pnpm --filter web test predictionState`

**Verify:**
- Tests pass
- Build succeeds
- No TypeScript errors

---

### Step 3: Implement predictInput() Function

**Files to modify:**
- `packages/web/src/stores/gameStore.ts`

**Implementation details:**

1. Add helper function before the store definition (around line 58):

```typescript
/**
 * Apply input action locally using game-core validation.
 * Returns new state if valid, null if invalid.
 */
function applyInputAction(state: GameState, action: PlayerInputType): GameState | null {
  if (!state.currentPiece || state.isGameOver) {
    return null;
  }

  let newPiece = state.currentPiece;

  switch (action) {
    case 'move_left':
      newPiece = movePiece(newPiece, -1, 0);
      if (!isValidPosition(state.board, newPiece)) return null;
      return { ...state, currentPiece: newPiece };

    case 'move_right':
      newPiece = movePiece(newPiece, 1, 0);
      if (!isValidPosition(state.board, newPiece)) return null;
      return { ...state, currentPiece: newPiece };

    case 'rotate_cw':
      newPiece = rotatePiece(newPiece, true);
      if (!isValidPosition(state.board, newPiece)) return null;
      return { ...state, currentPiece: newPiece };

    case 'rotate_ccw':
      newPiece = rotatePiece(newPiece, false);
      if (!isValidPosition(state.board, newPiece)) return null;
      return { ...state, currentPiece: newPiece };

    case 'soft_drop':
      newPiece = movePiece(newPiece, 0, 1);
      if (!isValidPosition(state.board, newPiece)) return null;
      return { ...state, currentPiece: newPiece };

    case 'hard_drop':
      const dropPosition = getHardDropPosition(state.board, newPiece);
      return { ...state, currentPiece: { ...newPiece, position: dropPosition } };

    default:
      return null;
  }
}
```

2. Replace the placeholder `predictInput` implementation (around line 406):

```typescript
  predictInput: (action: PlayerInputType) => {
    const { isPredictionMode, predictedState, pendingInputs, inputSequence } = get();

    // Only predict in prediction mode
    if (!isPredictionMode || !predictedState) {
      return null;
    }

    // Check pending inputs limit
    if (pendingInputs.length >= MAX_PENDING_INPUTS) {
      console.warn('[PREDICTION] Pending inputs queue full, dropping oldest');
      set({ pendingInputs: pendingInputs.slice(1) });
    }

    // Apply action locally
    const newState = applyInputAction(predictedState, action);
    if (!newState) {
      // Invalid move, don't predict
      return null;
    }

    // Generate sequence number
    const seq = inputSequence + 1;

    // Create pending input entry
    const pendingInput: PendingInput = {
      seq,
      action,
      predictedState: newState,
      timestamp: Date.now(),
    };

    // Update state
    set({
      predictedState: newState,
      pendingInputs: [...pendingInputs, pendingInput],
      inputSequence: seq,
    });

    return seq;
  },
```

3. Add import for MAX_PENDING_INPUTS at top:
```typescript
import { MAX_PENDING_INPUTS } from '../types/prediction';
```

**Test:**
- Add to `packages/web/src/__tests__/predictionState.test.ts`:

```typescript
import { createInitialGameState, createTetromino } from '@tetris-battle/game-core';

describe('predictInput()', () => {
  it('should return null when prediction mode disabled', () => {
    const seq = useGameStore.getState().predictInput('move_left');
    expect(seq).toBeNull();
  });

  it('should predict valid move and increment sequence', () => {
    const initialState = createInitialGameState();
    initialState.currentPiece = createTetromino('I', 10);

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: initialState,
      inputSequence: 0,
      pendingInputs: [],
    });

    const seq = useGameStore.getState().predictInput('move_left');
    expect(seq).toBe(1);
    expect(useGameStore.getState().inputSequence).toBe(1);
    expect(useGameStore.getState().pendingInputs).toHaveLength(1);
    expect(useGameStore.getState().pendingInputs[0].action).toBe('move_left');
  });

  it('should not predict invalid move (collision)', () => {
    const initialState = createInitialGameState();
    const piece = createTetromino('I', 10);
    piece.position = { x: 0, y: 0 }; // Already at left edge

    initialState.currentPiece = piece;

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: initialState,
      inputSequence: 0,
      pendingInputs: [],
    });

    const seq = useGameStore.getState().predictInput('move_left');
    expect(seq).toBeNull();
    expect(useGameStore.getState().pendingInputs).toHaveLength(0);
  });

  it('should limit pending inputs queue to MAX_PENDING_INPUTS', () => {
    const initialState = createInitialGameState();
    initialState.currentPiece = createTetromino('I', 10);

    // Fill queue to limit
    const fullQueue = Array.from({ length: 51 }, (_, i) => ({
      seq: i + 1,
      action: 'move_right' as PlayerInputType,
      predictedState: initialState,
      timestamp: Date.now(),
    }));

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: initialState,
      inputSequence: 51,
      pendingInputs: fullQueue,
    });

    const seq = useGameStore.getState().predictInput('move_right');
    expect(seq).toBe(52);
    expect(useGameStore.getState().pendingInputs).toHaveLength(51); // Still at limit
  });
});
```

Run: `pnpm --filter web test predictionState`

**Verify:**
- All tests pass
- Build succeeds
- Console shows no warnings when queue within limit

---

### Step 4: Implement Reconciliation Functions

**Files to modify:**
- `packages/web/src/stores/gameStore.ts`

**Implementation details:**

1. Add state comparison helper function before store definition:

```typescript
/**
 * Compare critical fields of two game states.
 * Returns true if states match (prediction was correct).
 */
function areStatesEqual(predicted: any, server: any): boolean {
  if (!predicted || !server) return false;
  if (!predicted.currentPiece || !server.currentPiece) {
    return predicted.currentPiece === server.currentPiece;
  }

  return (
    predicted.currentPiece.position.x === server.currentPiece.position.x &&
    predicted.currentPiece.position.y === server.currentPiece.position.y &&
    predicted.currentPiece.rotation === server.currentPiece.rotation &&
    predicted.score === server.score &&
    predicted.stars === server.stars
  );
}
```

2. Replace the placeholder `reconcileWithServer` implementation:

```typescript
  reconcileWithServer: (confirmedSeq: number, serverState: any) => {
    const { pendingInputs, predictedState } = get();

    // Remove confirmed inputs from queue
    const remainingInputs = pendingInputs.filter(input => input.seq > confirmedSeq);

    // Update server state
    set({ serverState });

    // Check if prediction matched
    const predictionMatched = areStatesEqual(predictedState, serverState);

    if (predictionMatched) {
      // Perfect prediction! Just update serverState, no visual change
      set({ pendingInputs: remainingInputs });
      console.log(`[PREDICTION] Confirmed seq ${confirmedSeq}, prediction matched`);
    } else {
      // Misprediction: snap to server state and replay remaining inputs
      console.warn(`[PREDICTION] Misprediction at seq ${confirmedSeq}`, {
        predicted: predictedState?.currentPiece,
        actual: serverState.currentPiece,
        remainingInputs: remainingInputs.length,
      });

      // Convert server state to full GameState
      const fullServerState: GameState = {
        board: serverState.board,
        currentPiece: serverState.currentPiece,
        nextPieces: serverState.nextPieces || [],
        score: serverState.score,
        stars: serverState.stars,
        level: 1,
        linesCleared: serverState.linesCleared,
        isGameOver: serverState.isGameOver,
        lastClearTime: Date.now(),
        comboCount: serverState.comboCount,
        bombType: null,
      };

      // Replay remaining inputs
      let reconciledState = fullServerState;
      for (const input of remainingInputs.slice(0, 10)) { // Limit replay to 10
        const newState = applyInputAction(reconciledState, input.action);
        if (newState) {
          reconciledState = newState;
        }
      }

      set({
        predictedState: reconciledState,
        pendingInputs: remainingInputs.slice(0, 10),
        serverState: fullServerState,
      });

      // TODO: Trigger misprediction visual feedback (Step 10)
    }
  },
```

3. Replace the placeholder `handleInputRejection` implementation:

```typescript
  handleInputRejection: (rejectedSeq: number, serverState: any) => {
    const { pendingInputs } = get();

    console.warn(`[PREDICTION] Input ${rejectedSeq} rejected by server`);

    // Remove rejected input and all subsequent inputs
    const remainingInputs = pendingInputs.filter(input => input.seq < rejectedSeq);

    // Convert server state to full GameState
    const fullServerState: GameState = {
      board: serverState.board,
      currentPiece: serverState.currentPiece,
      nextPieces: serverState.nextPieces || [],
      score: serverState.score,
      stars: serverState.stars,
      level: 1,
      linesCleared: serverState.linesCleared,
      isGameOver: serverState.isGameOver,
      lastClearTime: Date.now(),
      comboCount: serverState.comboCount,
      bombType: null,
    };

    // Snap to server state
    set({
      predictedState: fullServerState,
      serverState: fullServerState,
      pendingInputs: remainingInputs,
    });
  },
```

**Test:**
- Add to `packages/web/src/__tests__/predictionState.test.ts`:

```typescript
describe('reconcileWithServer()', () => {
  it('should remove confirmed inputs when prediction matches', () => {
    const mockState = createInitialGameState();
    mockState.currentPiece = createTetromino('I', 10);

    const pending: PendingInput[] = [
      { seq: 1, action: 'move_left', predictedState: mockState, timestamp: Date.now() },
      { seq: 2, action: 'move_right', predictedState: mockState, timestamp: Date.now() },
    ];

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: mockState,
      pendingInputs: pending,
    });

    const serverState = {
      currentPiece: mockState.currentPiece,
      score: mockState.score,
      stars: mockState.stars,
      // Other fields
    };

    useGameStore.getState().reconcileWithServer(1, serverState);

    expect(useGameStore.getState().pendingInputs).toHaveLength(1);
    expect(useGameStore.getState().pendingInputs[0].seq).toBe(2);
  });

  it('should replay inputs on misprediction', () => {
    const mockState = createInitialGameState();
    mockState.currentPiece = createTetromino('I', 10);
    mockState.currentPiece.position = { x: 5, y: 0 };

    const pending: PendingInput[] = [
      { seq: 1, action: 'move_left', predictedState: mockState, timestamp: Date.now() },
      { seq: 2, action: 'move_left', predictedState: mockState, timestamp: Date.now() },
    ];

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: mockState,
      pendingInputs: pending,
    });

    // Server state differs (piece at different position)
    const serverState = {
      currentPiece: { ...mockState.currentPiece, position: { x: 6, y: 0 } },
      score: mockState.score,
      stars: mockState.stars,
      board: mockState.board,
      linesCleared: 0,
      comboCount: 0,
      isGameOver: false,
    };

    useGameStore.getState().reconcileWithServer(0, serverState);

    // Should have replayed the two pending moves
    const { predictedState } = useGameStore.getState();
    expect(predictedState?.currentPiece?.position.x).toBe(4); // 6 - 2 = 4
  });
});

describe('handleInputRejection()', () => {
  it('should snap to server state and clear rejected input', () => {
    const mockState = createInitialGameState();
    mockState.currentPiece = createTetromino('I', 10);

    const pending: PendingInput[] = [
      { seq: 1, action: 'move_left', predictedState: mockState, timestamp: Date.now() },
      { seq: 2, action: 'rotate_cw', predictedState: mockState, timestamp: Date.now() },
    ];

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: mockState,
      pendingInputs: pending,
    });

    const serverState = {
      currentPiece: mockState.currentPiece,
      score: mockState.score,
      stars: mockState.stars,
      board: mockState.board,
      linesCleared: 0,
      comboCount: 0,
      isGameOver: false,
    };

    useGameStore.getState().handleInputRejection(2, serverState);

    expect(useGameStore.getState().pendingInputs).toHaveLength(1);
    expect(useGameStore.getState().pendingInputs[0].seq).toBe(1);
  });
});
```

Run: `pnpm --filter web test predictionState`

**Verify:**
- All tests pass
- Console shows misprediction warnings when expected

---

### Step 5: Update PlayerInput Message Type

**Files to modify:**
- `packages/game-core/src/inputTypes.ts`

**Implementation details:**

1. Add `seq` field to `PlayerInput` interface (line 17-22):

```typescript
export interface PlayerInput {
  type: 'player_input';
  playerId: string;
  input: PlayerInputType;
  seq?: number;          // NEW: Sequence number for client-side prediction
  timestamp: number;     // Client timestamp for latency measurement
}
```

**Test:**
- Type-check: `pnpm --filter game-core build`

**Verify:**
- Build succeeds
- No TypeScript errors in dependent packages

---

### Step 6: Update ServerAuthGameClient to Send Sequence Numbers

**Files to modify:**
- `packages/web/src/services/partykit/ServerAuthGameClient.ts`

**Implementation details:**

1. Add callback types to class (after line 51):

```typescript
  private onInputConfirmed?: (confirmedSeq: number, serverState: any) => void;
  private onInputRejected?: (rejectedSeq: number, reason: string, serverState: any) => void;
```

2. Modify `connect()` method signature to accept new callbacks (line 67-73):

```typescript
  connect(
    onStateUpdate: (state: GameStateUpdate) => void,
    onOpponentDisconnected: () => void,
    onGameFinished: (winnerId: string) => void,
    onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void,
    onAbilityActivationResult?: (result: AbilityActivationResult) => void,
    onInputConfirmed?: (confirmedSeq: number, serverState: any) => void,
    onInputRejected?: (rejectedSeq: number, reason: string, serverState: any) => void
  ): void
```

3. Store callbacks in class (after line 76):

```typescript
    this.onInputConfirmed = onInputConfirmed;
    this.onInputRejected = onInputRejected;
```

4. Add message handlers in event listener (after line 140):

```typescript
        case 'input_confirmed':
          if (this.onInputConfirmed) {
            this.onInputConfirmed(data.confirmedSeq, data.serverState);
          }
          if (this.debugLogger) {
            this.debugLogger.logEvent(
              'input_confirmed',
              `Input ${data.confirmedSeq} confirmed`,
              data
            );
          }
          break;

        case 'input_rejected':
          if (this.onInputRejected) {
            this.onInputRejected(data.rejectedSeq, data.reason, data.serverState);
          }
          if (this.debugLogger) {
            this.debugLogger.logEvent(
              'input_rejected',
              `Input ${data.rejectedSeq} rejected: ${data.reason}`,
              data
            );
          }
          break;
```

5. Modify `sendInput()` to accept optional seq parameter (line 161-168):

```typescript
  /**
   * Send player input to server
   */
  sendInput(input: PlayerInputType, seq?: number): void {
    this.send({
      type: 'player_input',
      playerId: this.playerId,
      input,
      seq,
      timestamp: Date.now(),
    });
  }
```

**Test:**
- Type-check: `pnpm --filter web build`
- Manual test: Log messages in browser console

**Verify:**
- Build succeeds
- No TypeScript errors
- Messages have seq field when provided

---

### Step 7: Update Server to Send Input Confirmations

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

1. Modify `handlePlayerInput` method (line 199-210):

```typescript
  private handlePlayerInput(playerId: string, input: PlayerInputType, seq?: number): void {
    const serverState = this.serverGameStates.get(playerId);
    if (!serverState) {
      console.warn(`[INPUT] No server state for player ${playerId}`);
      return;
    }

    const stateChanged = serverState.processInput(input);

    // Send confirmation if seq provided (prediction mode)
    if (seq !== undefined) {
      const player = this.players.get(playerId);
      if (player) {
        const conn = this.getConnection(player.connectionId);
        if (conn) {
          conn.send(JSON.stringify({
            type: 'input_confirmed',
            confirmedSeq: seq,
            serverState: serverState.getPublicState(),
          }));
        }
      }
    }

    if (stateChanged) {
      this.broadcastState();
    }
  }
```

2. Update onMessage handler to extract seq (line 107-109):

```typescript
      case 'player_input':
        this.handlePlayerInput(data.playerId, data.input, data.seq);
        break;
```

**Test:**
- Build: `pnpm --filter partykit build` (if build script exists, otherwise type-check)
- Manual test: Run dev server and check console logs

**Verify:**
- Server logs show input confirmations being sent
- No runtime errors

---

### Step 8: Wire Up Prediction in ServerAuthMultiplayerGame Component

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Import gameStore and prediction types at top (after line 28):

```typescript
import { useGameStore } from '../stores/gameStore';
import type { PlayerInputType } from '@tetris-battle/game-core';
```

2. Get gameStore instance in component (after line 188):

```typescript
  const {
    isPredictionMode,
    setPredictionMode,
    setPredictedState,
    predictInput,
    reconcileWithServer,
    handleInputRejection,
    predictedState: localPredictedState,
  } = useGameStore();
```

3. Initialize prediction mode on mount (add new useEffect after line 200):

```typescript
  // Initialize prediction mode
  useEffect(() => {
    setPredictionMode(true);
    console.log('[PREDICTION] Prediction mode enabled');

    return () => {
      setPredictionMode(false);
    };
  }, [setPredictionMode]);
```

4. Update state handler to update predicted state (modify handleStateUpdate around line 215):

```typescript
  const handleStateUpdate = useCallback((update: GameStateUpdate) => {
    setYourState(update.yourState);
    setOpponentState(update.opponentState);

    // Update predicted state if not already set (initial state)
    if (!localPredictedState && update.yourState) {
      const fullState: GameState = {
        board: update.yourState.board,
        currentPiece: update.yourState.currentPiece,
        nextPieces: [],
        score: update.yourState.score,
        stars: update.yourState.stars,
        level: 1,
        linesCleared: update.yourState.linesCleared,
        isGameOver: update.yourState.isGameOver,
        lastClearTime: Date.now(),
        comboCount: update.yourState.comboCount,
        bombType: null,
      };
      setPredictedState(fullState);
    }
  }, [setPredictedState, localPredictedState]);
```

5. Add confirmation/rejection handlers (after handleStateUpdate):

```typescript
  const handleInputConfirmed = useCallback((confirmedSeq: number, serverState: any) => {
    reconcileWithServer(confirmedSeq, serverState);
  }, [reconcileWithServer]);

  const handleInputRejected = useCallback((rejectedSeq: number, reason: string, serverState: any) => {
    console.error(`[PREDICTION] Input rejected: ${reason}`);
    handleInputRejection(rejectedSeq, serverState);
  }, [handleInputRejection]);
```

6. Pass callbacks to gameClient.connect (modify existing connect call around line 230):

```typescript
      gameClient.connect(
        handleStateUpdate,
        handleOpponentDisconnected,
        handleGameFinished,
        handleAbilityReceived,
        handleAbilityActivationResult,
        handleInputConfirmed,
        handleInputRejected
      );
```

7. Modify keyboard input handler to use prediction (find existing handleKeyDown around line 300):

Replace the sendInput calls with:

```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (!gameClientRef.current || !yourState) return;

  let action: PlayerInputType | null = null;

  switch (e.key) {
    case 'ArrowLeft':
      action = 'move_left';
      break;
    case 'ArrowRight':
      action = 'move_right';
      break;
    case 'ArrowUp':
    case 'x':
    case 'X':
      action = 'rotate_cw';
      break;
    case 'z':
    case 'Z':
    case 'Control':
      action = 'rotate_ccw';
      break;
    case 'ArrowDown':
      action = 'soft_drop';
      break;
    case ' ':
      action = 'hard_drop';
      e.preventDefault();
      break;
  }

  if (action) {
    // Predict input locally first
    const seq = predictInput(action);

    // Send to server with sequence number
    gameClientRef.current.sendInput(action, seq ?? undefined);
  }
}, [yourState, predictInput]);
```

**Test:**
- Build: `pnpm --filter web build`
- Manual test: Run game in browser with `?serverAuth=true`
- Check browser console for prediction logs

**Verify:**
- No TypeScript errors
- Game runs without crashes
- Console shows "[PREDICTION] Prediction mode enabled"
- Inputs feel instant (no lag)

---

### Step 9: Render Predicted State Instead of Server State

**Files to modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Use predictedState for rendering player's board (find renderer update around line 450):

Change from:
```typescript
if (yourState && rendererRef.current) {
  rendererRef.current.render(yourState.board.grid, yourState.currentPiece, ...);
}
```

To:
```typescript
const renderState = localPredictedState || yourState;
if (renderState && rendererRef.current) {
  rendererRef.current.render(renderState.board.grid, renderState.currentPiece, ...);
}
```

2. Update all references to yourState in rendering code to use renderState:
- Board rendering
- Current piece rendering
- Ghost piece calculation
- Score/stars display

**Test:**
- Manual test: Play game with `?serverAuth=true&debug=true`
- Use debug panel to verify:
  - Predicted state updates immediately on input
  - Server state updates 100-150ms later
  - No visual jank

**Verify:**
- Piece movement feels instant
- No visual lag on key press
- Score/stars update correctly

---

### Step 10: Add Visual Feedback for Mispredictions

**Files to create:**
- `packages/web/src/styles/prediction.css`

**Files to modify:**
- `packages/web/src/stores/gameStore.ts`
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx`

**Implementation details:**

1. Create CSS file with correction styles:

```css
.tetris-board.prediction-correction {
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

.prediction-correction-flash {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 0, 0, 0.1);
  pointer-events: none;
  animation: flash 0.3s ease-out;
}

@keyframes flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
```

2. Import CSS in ServerAuthMultiplayerGame component:

```typescript
import '../styles/prediction.css';
```

3. Add state for misprediction feedback (after line 186):

```typescript
  const [showMispredictionFeedback, setShowMispredictionFeedback] = useState(false);
```

4. Add misprediction trigger to gameStore reconciliation:

In `packages/web/src/stores/gameStore.ts`, add callback field:

```typescript
  onMisprediction: (() => void) | null;
  setOnMisprediction: (callback: () => void) => void;
```

Initialize:
```typescript
  onMisprediction: null,

  setOnMisprediction: (callback: () => void) => {
    set({ onMisprediction: callback });
  },
```

In `reconcileWithServer`, after misprediction detection:

```typescript
      // Trigger misprediction visual feedback
      if (get().onMisprediction) {
        get().onMisprediction!();
      }
```

5. Wire up feedback in component (new useEffect):

```typescript
  useEffect(() => {
    useGameStore.getState().setOnMisprediction(() => {
      setShowMispredictionFeedback(true);
      audioManager.playSfx('error'); // Use existing error sound
      setTimeout(() => setShowMispredictionFeedback(false), 300);
    });

    return () => {
      useGameStore.getState().setOnMisprediction(() => {});
    };
  }, []);
```

6. Apply CSS class to board container:

```typescript
<div
  className={`tetris-board ${showMispredictionFeedback ? 'prediction-correction' : ''}`}
>
  {/* Board content */}
</div>

{showMispredictionFeedback && <div className="prediction-correction-flash" />}
```

**Test:**
- Manual test: Force misprediction by modifying client prediction logic
- Verify red flash appears
- Verify shake animation plays

**Verify:**
- Visual feedback shows on misprediction
- Animation is subtle, not jarring
- Feedback disappears after 300ms

---

### Step 11: Add Debug Panel Integration

**Files to modify:**
- `packages/web/src/components/debug/GameStateInspector.tsx`
- `packages/web/src/stores/debugStore.ts`

**Implementation details:**

1. Add prediction metrics to debugStore (packages/web/src/stores/debugStore.ts):

```typescript
interface DebugStore {
  // Existing fields...

  // Prediction metrics
  totalInputs: number;
  mispredictions: number;

  // Actions
  incrementInputs: () => void;
  incrementMispredictions: () => void;
  resetPredictionMetrics: () => void;
}

// In implementation:
  totalInputs: 0,
  mispredictions: 0,

  incrementInputs: () => {
    set(state => ({ totalInputs: state.totalInputs + 1 }));
  },

  incrementMispredictions: () => {
    set(state => ({ mispredictions: state.mispredictions + 1 }));
  },

  resetPredictionMetrics: () => {
    set({ totalInputs: 0, mispredictions: 0 });
  },
```

2. Call debug methods from gameStore:

In `predictInput`:
```typescript
  // Track metric
  if (window.location.search.includes('debug=true')) {
    import('../stores/debugStore').then(({ useDebugStore }) => {
      useDebugStore.getState().incrementInputs();
    });
  }
```

In `reconcileWithServer` (misprediction branch):
```typescript
  // Track misprediction
  if (window.location.search.includes('debug=true')) {
    import('../stores/debugStore').then(({ useDebugStore }) => {
      useDebugStore.getState().incrementMispredictions();
    });
  }
```

3. Add prediction stats to GameStateInspector component:

```typescript
import { useDebugStore } from '../../stores/debugStore';
import { useGameStore } from '../../stores/gameStore';

// In component:
const { totalInputs, mispredictions } = useDebugStore();
const { pendingInputs } = useGameStore();

const mispredictionRate = totalInputs > 0
  ? ((mispredictions / totalInputs) * 100).toFixed(2)
  : '0.00';

// In JSX:
<div className="debug-section">
  <h3>Prediction Stats</h3>
  <div className="stats-grid">
    <div>
      <label>Total Inputs:</label>
      <span>{totalInputs}</span>
    </div>
    <div>
      <label>Mispredictions:</label>
      <span>{mispredictions}</span>
    </div>
    <div>
      <label>Misprediction Rate:</label>
      <span>{mispredictionRate}%</span>
    </div>
    <div>
      <label>Pending Inputs:</label>
      <span>{pendingInputs.length}</span>
    </div>
  </div>
</div>
```

**Test:**
- Manual test: Play game with `?serverAuth=true&debug=true`
- Open debug panel
- Verify prediction stats update

**Verify:**
- Stats display correctly
- Misprediction rate calculates correctly
- Pending inputs count updates in real-time

---

### Step 12: Add Unit Tests for All Prediction Logic

**Files to create:**
- `packages/web/src/__tests__/prediction.test.ts`

**Implementation details:**

Create comprehensive test file:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createInitialGameState, createTetromino } from '@tetris-battle/game-core';
import type { GameState, PlayerInputType } from '@tetris-battle/game-core';
import type { PendingInput } from '../types/prediction';

describe('Client-Side Prediction', () => {
  beforeEach(() => {
    useGameStore.setState({
      serverState: null,
      predictedState: null,
      pendingInputs: [],
      inputSequence: 0,
      isPredictionMode: false,
      onMisprediction: null,
    });
  });

  describe('applyInputAction', () => {
    // Test all 6 input types
    it('should apply move_left', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      state.currentPiece.position = { x: 5, y: 0 };

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
      });

      const seq = useGameStore.getState().predictInput('move_left');
      expect(seq).toBe(1);

      const newState = useGameStore.getState().predictedState;
      expect(newState?.currentPiece?.position.x).toBe(4);
    });

    it('should apply move_right', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      state.currentPiece.position = { x: 3, y: 0 };

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
      });

      useGameStore.getState().predictInput('move_right');
      expect(useGameStore.getState().predictedState?.currentPiece?.position.x).toBe(4);
    });

    it('should apply rotate_cw', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('T', 10);
      const initialRotation = state.currentPiece.rotation;

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
      });

      useGameStore.getState().predictInput('rotate_cw');
      const newRotation = useGameStore.getState().predictedState?.currentPiece?.rotation;
      expect(newRotation).not.toBe(initialRotation);
    });

    it('should apply rotate_ccw', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('T', 10);

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
      });

      useGameStore.getState().predictInput('rotate_ccw');
      expect(useGameStore.getState().predictedState?.currentPiece?.rotation).toBeDefined();
    });

    it('should apply soft_drop', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      const initialY = state.currentPiece.position.y;

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
      });

      useGameStore.getState().predictInput('soft_drop');
      expect(useGameStore.getState().predictedState?.currentPiece?.position.y).toBe(initialY + 1);
    });

    it('should apply hard_drop', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      state.currentPiece.position = { x: 3, y: 0 };

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
      });

      useGameStore.getState().predictInput('hard_drop');
      const droppedY = useGameStore.getState().predictedState?.currentPiece?.position.y;
      expect(droppedY).toBeGreaterThan(0); // Should be at bottom
    });

    it('should reject invalid moves (collision)', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      state.currentPiece.position = { x: 0, y: 0 };

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
        inputSequence: 0,
      });

      const seq = useGameStore.getState().predictInput('move_left');
      expect(seq).toBeNull();
      expect(useGameStore.getState().inputSequence).toBe(0); // No increment
    });
  });

  describe('Reconciliation', () => {
    it('should handle perfect prediction', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      state.currentPiece.position = { x: 5, y: 0 };

      const pending: PendingInput[] = [
        {
          seq: 1,
          action: 'move_left',
          predictedState: { ...state, currentPiece: { ...state.currentPiece, position: { x: 4, y: 0 } } },
          timestamp: Date.now(),
        },
      ];

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: pending[0].predictedState,
        pendingInputs: pending,
      });

      const serverState = {
        currentPiece: { ...state.currentPiece, position: { x: 4, y: 0 } },
        score: 0,
        stars: 100,
        board: state.board,
        linesCleared: 0,
        comboCount: 0,
        isGameOver: false,
      };

      useGameStore.getState().reconcileWithServer(1, serverState);

      expect(useGameStore.getState().pendingInputs).toHaveLength(0);
    });

    it('should handle misprediction and replay', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);
      state.currentPiece.position = { x: 5, y: 0 };

      const pending: PendingInput[] = [
        { seq: 1, action: 'move_left', predictedState: state, timestamp: Date.now() },
        { seq: 2, action: 'move_left', predictedState: state, timestamp: Date.now() },
      ];

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: { ...state, currentPiece: { ...state.currentPiece, position: { x: 3, y: 0 } } },
        pendingInputs: pending,
      });

      // Server says we're at x=4, not x=3
      const serverState = {
        currentPiece: { ...state.currentPiece, position: { x: 4, y: 0 } },
        score: 0,
        stars: 100,
        board: state.board,
        linesCleared: 0,
        comboCount: 0,
        isGameOver: false,
      };

      let mispredictionCalled = false;
      useGameStore.setState({
        onMisprediction: () => { mispredictionCalled = true; },
      });

      useGameStore.getState().reconcileWithServer(1, serverState);

      expect(mispredictionCalled).toBe(true);
      expect(useGameStore.getState().pendingInputs).toHaveLength(1);
    });

    it('should limit replay to 10 inputs', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);

      const pending: PendingInput[] = Array.from({ length: 15 }, (_, i) => ({
        seq: i + 1,
        action: 'move_right' as PlayerInputType,
        predictedState: state,
        timestamp: Date.now(),
      }));

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
        pendingInputs: pending,
      });

      const serverState = {
        currentPiece: state.currentPiece,
        score: 0,
        stars: 100,
        board: state.board,
        linesCleared: 0,
        comboCount: 0,
        isGameOver: false,
      };

      useGameStore.getState().reconcileWithServer(0, serverState);

      expect(useGameStore.getState().pendingInputs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Queue Management', () => {
    it('should enforce MAX_PENDING_INPUTS limit', () => {
      const state = createInitialGameState();
      state.currentPiece = createTetromino('I', 10);

      useGameStore.setState({
        isPredictionMode: true,
        predictedState: state,
        inputSequence: 0,
        pendingInputs: [],
      });

      // Spam 55 inputs
      for (let i = 0; i < 55; i++) {
        useGameStore.getState().predictInput('move_right');
      }

      expect(useGameStore.getState().pendingInputs.length).toBeLessThanOrEqual(50);
    });
  });
});
```

Run: `pnpm --filter web test prediction`

**Verify:**
- All tests pass
- Coverage includes all input types
- Edge cases tested (collisions, limits, mispredictions)

---

### Step 13: Add Integration Tests

**Files to create:**
- `packages/web/src/__tests__/predictionIntegration.test.ts`

**Implementation details:**

```typescript
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createInitialGameState, createTetromino } from '@tetris-battle/game-core';

describe('Prediction Integration Tests', () => {
  it('should handle rapid input sequence', () => {
    const state = createInitialGameState();
    state.currentPiece = createTetromino('I', 10);
    state.currentPiece.position = { x: 5, y: 0 };

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: state,
      inputSequence: 0,
      pendingInputs: [],
    });

    // Rapid inputs: left, left, rotate, down
    const seq1 = useGameStore.getState().predictInput('move_left');
    const seq2 = useGameStore.getState().predictInput('move_left');
    const seq3 = useGameStore.getState().predictInput('rotate_cw');
    const seq4 = useGameStore.getState().predictInput('soft_drop');

    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(seq3).toBe(3);
    expect(seq4).toBe(4);
    expect(useGameStore.getState().pendingInputs).toHaveLength(4);

    // Confirm first two
    const serverState = {
      currentPiece: { ...state.currentPiece, position: { x: 3, y: 0 } },
      score: 0,
      stars: 100,
      board: state.board,
      linesCleared: 0,
      comboCount: 0,
      isGameOver: false,
    };

    useGameStore.getState().reconcileWithServer(2, serverState);

    expect(useGameStore.getState().pendingInputs).toHaveLength(2);
    expect(useGameStore.getState().pendingInputs[0].seq).toBe(3);
  });

  it('should handle interleaved confirmations', () => {
    const state = createInitialGameState();
    state.currentPiece = createTetromino('I', 10);

    useGameStore.setState({
      isPredictionMode: true,
      predictedState: state,
      inputSequence: 0,
      pendingInputs: [],
    });

    // Send 3 inputs
    useGameStore.getState().predictInput('move_left');
    useGameStore.getState().predictInput('move_right');
    useGameStore.getState().predictInput('rotate_cw');

    // Confirm out of order (should work since we use > comparison)
    useGameStore.getState().reconcileWithServer(1, {
      currentPiece: state.currentPiece,
      score: 0,
      stars: 100,
      board: state.board,
      linesCleared: 0,
      comboCount: 0,
      isGameOver: false,
    });

    expect(useGameStore.getState().pendingInputs).toHaveLength(2);

    useGameStore.getState().reconcileWithServer(3, {
      currentPiece: state.currentPiece,
      score: 0,
      stars: 100,
      board: state.board,
      linesCleared: 0,
      comboCount: 0,
      isGameOver: false,
    });

    expect(useGameStore.getState().pendingInputs).toHaveLength(0);
  });
});
```

Run: `pnpm --filter web test predictionIntegration`

**Verify:**
- All integration tests pass
- Rapid input sequences work correctly
- Out-of-order confirmations handled

---

### Step 14: Manual Testing and Verification

**Implementation details:**

1. **Build all packages:**
```bash
pnpm build:all
```

2. **Run all tests:**
```bash
pnpm --filter web test
pnpm --filter game-core test
```

3. **Start dev server:**
```bash
pnpm dev
```

4. **Manual test checklist:**

Open browser to `http://localhost:5173/?serverAuth=true&debug=true`

- [ ] Start a game (matchmaking or friend challenge)
- [ ] Verify debug panel shows "Prediction mode enabled" in console
- [ ] Press arrow keys and verify piece moves instantly (<10ms perceived lag)
- [ ] Check debug panel: Pending inputs count should fluctuate 0-5
- [ ] Check debug panel: Misprediction rate should be <1%
- [ ] Spam keys rapidly and verify no visual glitches
- [ ] Verify ghost piece updates instantly
- [ ] Test all input types:
  - [ ] Left/right movement
  - [ ] CW/CCW rotation
  - [ ] Soft drop
  - [ ] Hard drop
- [ ] Trigger ability effects (reverse controls, rotation lock) and verify server authority maintained
- [ ] Check browser console: No errors or warnings
- [ ] Verify game feels responsive ("like single-player")

5. **Simulated latency test:**

Add this to ServerAuthGameClient.ts for testing:

```typescript
// TESTING ONLY: Simulate network latency
const SIMULATE_LATENCY = 0; // Set to 150 for testing

private send(data: any): boolean {
  if (this.socket.readyState === WebSocket.OPEN) {
    if (SIMULATE_LATENCY > 0) {
      setTimeout(() => {
        this.socket.send(JSON.stringify(data));
      }, SIMULATE_LATENCY);
    } else {
      this.socket.send(JSON.stringify(data));
    }
    return true;
  }
  return false;
}
```

Test with 50ms, 100ms, 150ms latency:
- [ ] Game still feels responsive
- [ ] No visual desyncs
- [ ] Misprediction rate remains <1%

6. **Performance metrics:**

Check in debug panel:
- [ ] Pending inputs: Average 2-5, max 10
- [ ] Misprediction rate: <1% (ideally <0.5%)
- [ ] FPS: Steady 60fps (no drops)
- [ ] Memory: Stable (no leaks from pending inputs queue)

**Verify:**
- All manual tests pass
- Game feels instant and responsive
- No visual glitches or desyncs
- Performance metrics within targets
- User experience: "Feels like single-player"

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) | Status |
|---------------|-------------------|--------|
| **Scenario 1: Normal Input** | Steps 8, 9, 14 | Instant piece rotation, zero perceived lag |
| **Scenario 2: Misprediction** | Steps 4, 10, 14 | Snap + shake + sound feedback |
| **Scenario 3: Rapid Input** | Steps 3, 13, 14 | All 5 actions render instantly, smooth controls |
| **Scenario 4: Network Lag** | Steps 3, 4, 14 | Queue grows, reconciliation works, no glitches |
| **Scenario 5: Hard Drop** | Steps 3, 8, 14 | Instant drop + lock, score updates, matches server |
| **Unit test: applyInputAction all types** | Step 12 | 6 input types tested |
| **Unit test: areStatesEqual** | Step 4, 12 | Comparison logic tested |
| **Unit test: reconciliation matching** | Step 4, 12 | Perfect prediction path tested |
| **Unit test: reconciliation misprediction** | Step 4, 12 | Snap + replay tested |
| **Unit test: pending input limit** | Step 3, 12 | MAX_PENDING_INPUTS enforced |
| **Integration: client + server match** | Steps 7, 13 | Validation uses same game-core functions |
| **Performance: <10ms perceived lag** | Steps 8, 9, 14 | Instant local application |
| **Performance: <1% misprediction rate** | Steps 4, 14 | Monitored in debug panel |
| **Performance: <5ms reconciliation** | Step 4, 12 | Replay limited to 10 inputs |
| **Performance: 0 FPS impact** | Step 14 | Measured in debug panel |
| **Performance: <1MB memory** | Step 3, 14 | Queue capped at 50 entries |
| **Edge case: Server rejects all inputs** | Step 4, 12 | handleInputRejection tested |
| **Edge case: Queue exceeds 50** | Step 3, 12 | Drop oldest, logged |
| **Edge case: Out-of-order confirmations** | Step 13 | Filter by seq > confirmedSeq |
| **Edge case: Game over during pending** | Step 14 | Manual test |
| **Debug panel: Show misprediction rate** | Step 11 | Live stats displayed |
| **Debug panel: Show pending inputs count** | Step 11 | Live count displayed |
| **Message: player_input with seq** | Steps 5, 6 | Seq field added |
| **Message: input_confirmed** | Steps 6, 7 | Server sends confirmation |
| **Message: input_rejected** | Steps 6, 7 | Server sends rejection |
| **Visual: Red outline on correction** | Step 10 | CSS + animation |
| **Visual: Shake animation** | Step 10 | Keyframe animation |
| **Audio: Correction sound** | Step 10 | Error SFX played |

## Build/Test Commands

**Build:**
- All packages: `pnpm build:all`
- Web only: `pnpm --filter web build`
- Game-core only: `pnpm --filter game-core build`

**Test:**
- All web tests: `pnpm --filter web test`
- Prediction tests only: `pnpm --filter web test prediction`
- Integration tests: `pnpm --filter web test predictionIntegration`
- Single test file: `pnpm --filter web test predictionState`

**Dev:**
- Start dev server: `pnpm dev`
- With server-auth: Navigate to `http://localhost:5173/?serverAuth=true`
- With debug panel: Add `&debug=true`

**Type checking:**
- All packages: `pnpm type-check`

## Success Criteria Checklist

Before marking Phase 3 complete:

- [ ] All 14 steps completed
- [ ] All unit tests pass (predictionState, prediction, predictionIntegration)
- [ ] Build succeeds with no TypeScript errors
- [ ] Manual tests pass (all 7 input types)
- [ ] Performance metrics within targets:
  - [ ] <10ms perceived lag
  - [ ] <1% misprediction rate
  - [ ] <5ms reconciliation time
  - [ ] 60fps maintained
  - [ ] <1MB memory usage
- [ ] Visual feedback works (red flash, shake)
- [ ] Debug panel shows prediction stats
- [ ] Game feels "like single-player" to user

## Rollback Plan

If issues occur during implementation:

1. Each step is independent - can rollback to previous step
2. Prediction mode is opt-in (`isPredictionMode` flag)
3. Can disable by setting `setPredictionMode(false)`
4. Legacy client-auth mode unaffected
5. Server-auth without prediction still works (server validates, broadcasts state)

## Notes

- Prediction only applies to `?serverAuth=true` mode
- Legacy client-auth mode (`PartykitMultiplayerGame.tsx`) unchanged
- All game logic shared via game-core package ensures validation consistency
- Ability effects (reverse_controls, rotation_lock) remain server-authoritative
- Mispredictions expected to be rare (<1%) in normal conditions
- Debug panel essential for tuning and monitoring
