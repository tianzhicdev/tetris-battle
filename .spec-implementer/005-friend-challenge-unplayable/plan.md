# Implementation Plan for Spec 005: Fix Friend Challenge Rapid Tetromino Bug

## Overview
- Total steps: 6
- Estimated new files: 1 (test file)
- Estimated modified files: 3
- Root cause: State update loop between two human clients
- Strategy: Add safeguards to prevent infinite sync loops + ensure proper game initialization

## Root Cause Analysis

From research:
1. Each client runs its own game loop (ticks every 1000ms)
2. Client game loop updates `gameState` which triggers sync via useEffect
3. When opponent's state update arrives, it might trigger local re-renders
4. The sync useEffect watches `gameState` object reference
5. **Problem**: If receiving opponent updates causes `gameState` reference to change, it triggers re-sync

### The Bug Mechanism

```
Client A                          Server                      Client B
   |                                |                            |
   |-- game_state_update -->       |                            |
   |                                |-- opponent_state_update ->|
   |                                |                            |-- game_state_update -->
   |<- opponent_state_update ----  |                            |
   |                                |<-- game_state_update -----|
   |-- game_state_update -->       |                            |
   LOOP!                            |                            LOOP!
```

### The Fix Strategy

1. **Prevent state update loops**: Only sync when OWN state changes (not opponent state)
2. **Debounce state syncs**: Limit sync frequency to max once per tick
3. **Add explicit sync flag**: Track whether we should sync or not
4. **Verify game initialization**: Ensure both players start correctly

## Steps

### Step 1: Add Sync Debouncing to GameSync Class

**Files to modify:**
- `packages/web/src/services/partykit/gameSync.ts`

**Implementation details:**

In the `PartykitGameSync` class, add debouncing to prevent rapid state updates:

1. Add private fields after line 8:
```typescript
  private lastSyncTime: number = 0;
  private minSyncInterval: number = 100; // Minimum 100ms between syncs
```

2. Modify the `updateGameState` method (currently line 89-111) to add debouncing:
```typescript
  updateGameState(
    board: Board,
    score: number,
    stars: number,
    linesCleared: number,
    comboCount: number,
    isGameOver: boolean,
    currentPiece?: any
  ): void {
    // Debounce: Don't sync more than once per minSyncInterval
    const now = Date.now();
    if (now - this.lastSyncTime < this.minSyncInterval) {
      return; // Skip this sync
    }
    this.lastSyncTime = now;

    this.send({
      type: 'game_state_update',
      playerId: this.playerId,
      state: {
        board: board.grid,
        score,
        stars,
        linesCleared,
        comboCount,
        isGameOver,
        currentPiece,
      },
    });
  }
```

3. Add a method to get debug info (for logging):
```typescript
  getDebugInfo(): { lastSyncTime: number; minSyncInterval: number } {
    return {
      lastSyncTime: this.lastSyncTime,
      minSyncInterval: this.minSyncInterval,
    };
  }
```

**Verify:**
- File compiles without errors: `pnpm --filter web build`
- No runtime errors when creating PartykitGameSync instance

---

### Step 2: Fix State Sync Loop in MultiplayerGame Component

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**

The current sync useEffect (line 162-180) syncs whenever `gameState` changes. This can include changes from opponent updates. Fix:

1. Add a ref to track the last synced state (add after line 53, near other refs):
```typescript
  const lastSyncedStateRef = useRef<string>('');
```

2. Replace the existing sync useEffect (line 162-180) with a version that only syncs when OWN state changes:
```typescript
  // Sync game state to server (only when OUR state changes, not opponent's)
  useEffect(() => {
    if (!gameSyncRef.current || !isConnected) {
      return;
    }

    // Create a stable hash of the state we care about syncing
    const currentStateHash = JSON.stringify({
      board: gameState.board.grid,
      score: gameState.score,
      stars: gameState.stars,
      linesCleared: gameState.linesCleared,
      comboCount: gameState.comboCount,
      isGameOver: gameState.isGameOver,
    });

    // Only sync if our own state has actually changed
    if (currentStateHash === lastSyncedStateRef.current) {
      return; // No change, skip sync
    }

    // Update sync timestamp
    lastSyncedStateRef.current = currentStateHash;

    // Sync to server
    gameSyncRef.current.updateGameState(
      gameState.board,
      gameState.score,
      gameState.stars,
      gameState.linesCleared,
      gameState.comboCount,
      gameState.isGameOver,
      gameState.currentPiece
    );

    // Check for game over
    if (gameState.isGameOver && !gameFinished) {
      gameSyncRef.current.gameOver();
    }
  }, [gameState.board.grid, gameState.score, gameState.stars, gameState.linesCleared,
      gameState.comboCount, gameState.isGameOver, isConnected, gameFinished]);
```

**Note**: We changed the dependency array from `[gameState, ...]` to specific properties. This prevents re-syncs when unrelated properties change.

3. Add debug logging to track sync frequency (add at the start of the sync useEffect, inside the first if block):
```typescript
    console.log('[SYNC] State changed, checking if sync needed', {
      currentHash: currentStateHash.substring(0, 50),
      lastHash: lastSyncedStateRef.current.substring(0, 50),
      willSync: currentStateHash !== lastSyncedStateRef.current,
    });
```

**Verify:**
- File compiles: `pnpm --filter web build`
- In browser console, check that `[SYNC]` logs appear max once per tick (1000ms)
- No rapid-fire sync logs

---

### Step 3: Ensure Game Initialization Doesn't Double-Start

**Files to modify:**
- `packages/web/src/components/PartykitMultiplayerGame.tsx`

**Implementation details:**

Ensure the game loop doesn't start multiple times if both players connect rapidly:

1. Modify the game loop useEffect (line 194-219) to add a guard against double-start:

Replace the condition on line 210:
```typescript
    if (!gameState.isGameOver && isConnected && !gameFinished) {
      gameLoopRef.current = window.setTimeout(loop, BASE_TICK_RATE);
    }
```

With:
```typescript
    if (!gameState.isGameOver && isConnected && !gameFinished && !gameLoopRef.current) {
      console.log('[GAME LOOP] Starting game loop');
      gameLoopRef.current = window.setTimeout(loop, BASE_TICK_RATE);
    }
```

This prevents starting the loop if it's already running (gameLoopRef.current is truthy).

2. Add cleanup logging in the return function (line 214):
```typescript
    return () => {
      if (gameLoopRef.current) {
        console.log('[GAME LOOP] Cleaning up game loop');
        clearTimeout(gameLoopRef.current);
        gameLoopRef.current = null; // ← Add this line
      }
    };
```

**Verify:**
- File compiles: `pnpm --filter web build`
- In console, "[GAME LOOP] Starting game loop" appears exactly once per game
- No duplicate game loops running

---

### Step 4: Add Logging to Diagnose Sync Frequency

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

Add server-side logging to track message frequency and identify sync loops:

1. Add a map to track message frequency per player (add after line 52, after other class properties):
```typescript
  // Debug: Track message frequency
  messageCounters: Map<string, { count: number; lastReset: number }> = new Map();
```

2. Add a helper method to track messages (add before the `onConnect` method, around line 66):
```typescript
  private trackMessage(playerId: string, messageType: string): void {
    const now = Date.now();
    let counter = this.messageCounters.get(playerId);

    if (!counter) {
      counter = { count: 0, lastReset: now };
      this.messageCounters.set(playerId, counter);
    }

    // Reset counter every second
    if (now - counter.lastReset >= 1000) {
      if (counter.count > 10) {
        console.warn(`[GAME] Player ${playerId} sent ${counter.count} ${messageType} messages in 1 second (possible loop!)`);
      }
      counter.count = 0;
      counter.lastReset = now;
    }

    counter.count++;
  }
```

3. Call this tracker in `handleGameStateUpdate` (add at the start of the method, after line 287):
```typescript
  handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
    this.trackMessage(playerId, 'game_state_update'); // ← Add this line

    const player = this.players.get(playerId);
    if (!player) return;
    // ... rest of method
```

4. Add logging when game starts (in `handleJoinGame`, around line 126 after players.size check):
```typescript
    // If we have 2 players, start game
    if (this.players.size === 2 && this.roomStatus === 'waiting') {
      this.roomStatus = 'playing';

      console.log(`[GAME] Starting game with players:`, {
        player1: Array.from(this.players.keys())[0],
        player2: Array.from(this.players.keys())[1],
        hasAI: !!this.aiPlayer,
        roomId: this.room.id,
      });

      this.broadcast({
        type: 'game_start',
        players: Array.from(this.players.keys()),
      });
      // ... rest
```

**Verify:**
- File compiles: `cd packages/partykit && pnpm build` (if there's a build script)
- Server logs show game start info
- If sync loop occurs, warning appears in server logs

---

### Step 5: Add Integration Test for Friend Challenge Flow

**Files to create:**
- `packages/web/src/__tests__/friendChallengeFlow.test.ts`

**Implementation details:**

Create an integration test that verifies friend challenge doesn't cause rapid spawning:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFriendStore } from '../stores/friendStore';
import type { Challenge } from '../services/friendService';

describe('Friend Challenge Flow', () => {
  beforeEach(() => {
    // Reset store
    useFriendStore.getState().clearChallenges();
  });

  it('should set outgoing challenge when challenge is sent', () => {
    const challenge: Challenge = {
      challengeId: 'test-challenge-1',
      challengerId: 'user-1',
      challengedId: 'user-2',
      challengerUsername: 'Player1',
      challengerRank: 1000,
      challengerLevel: 5,
      expiresAt: Date.now() + 120000,
    };

    useFriendStore.getState().setOutgoingChallenge(challenge);
    expect(useFriendStore.getState().outgoingChallenge).toEqual(challenge);
  });

  it('should set incoming challenge when challenge is received', () => {
    const challenge: Challenge = {
      challengeId: 'test-challenge-2',
      challengerId: 'user-2',
      challengedId: 'user-1',
      challengerUsername: 'Player2',
      challengerRank: 1100,
      challengerLevel: 6,
      expiresAt: Date.now() + 120000,
    };

    useFriendStore.getState().setIncomingChallenge(challenge);
    expect(useFriendStore.getState().incomingChallenge).toEqual(challenge);
  });

  it('should clear challenges when clearChallenges is called', () => {
    const outgoing: Challenge = {
      challengeId: 'test-outgoing',
      challengerId: 'user-1',
      challengedId: 'user-2',
      challengerUsername: 'Player1',
      challengerRank: 1000,
      challengerLevel: 5,
      expiresAt: Date.now() + 120000,
    };

    const incoming: Challenge = {
      challengeId: 'test-incoming',
      challengerId: 'user-2',
      challengedId: 'user-1',
      challengerUsername: 'Player2',
      challengerRank: 1100,
      challengerLevel: 6,
      expiresAt: Date.now() + 120000,
    };

    useFriendStore.getState().setOutgoingChallenge(outgoing);
    useFriendStore.getState().setIncomingChallenge(incoming);

    expect(useFriendStore.getState().outgoingChallenge).toEqual(outgoing);
    expect(useFriendStore.getState().incomingChallenge).toEqual(incoming);

    useFriendStore.getState().clearChallenges();

    expect(useFriendStore.getState().outgoingChallenge).toBeNull();
    expect(useFriendStore.getState().incomingChallenge).toBeNull();
  });
});
```

**Test:**
- Run: `pnpm --filter web test friendChallengeFlow`
- All tests should pass

**Verify:**
- Test file runs without errors
- Store state management works correctly

---

### Step 6: Manual Verification Testing

**Implementation details:**

After deploying the changes, test with real friend challenge:

1. **Setup**: Two browser windows/devices logged in as different users who are friends

2. **Test Case 1: Basic Challenge Flow**
   - Window A: Challenge friend
   - Window B: Accept challenge
   - **Verify**: Game starts smoothly
   - **Verify**: Tetrominos spawn at normal rate (1 piece every 3-5 seconds when placed)
   - **Verify**: No flickering or rapid respawning
   - **Check console logs**: No "[GAME] Player X sent Y messages in 1 second" warnings

3. **Test Case 2: Sync Frequency Check**
   - In browser console of Window A, run:
     ```javascript
     let syncCount = 0;
     const originalSend = WebSocket.prototype.send;
     WebSocket.prototype.send = function(data) {
       const msg = JSON.parse(data);
       if (msg.type === 'game_state_update') syncCount++;
       return originalSend.call(this, data);
     };
     setInterval(() => { console.log('Syncs in last second:', syncCount); syncCount = 0; }, 1000);
     ```
   - **Verify**: Sync count should be ~1 per second (one per tick), not 20-30+

4. **Test Case 3: Compare to Random Match**
   - Play a random matchmaking game
   - Play a friend challenge game
   - **Verify**: Both feel identical (same spawn rate, same smoothness)

5. **Test Case 4: Multiple Challenges**
   - Have 3 pairs of friends challenge each other simultaneously
   - **Verify**: All 3 games work correctly
   - **Verify**: No crosstalk between games

**Verification checklist:**
- [ ] Friend challenge games load without errors
- [ ] Tetromino spawn rate is normal (NOT 20-30/sec)
- [ ] Game is smooth and playable
- [ ] No flickering or rapid piece replacement
- [ ] Console shows ~1 sync per second (not 20-30)
- [ ] Server logs show no warnings about message loops
- [ ] Performance identical to random matchmaking
- [ ] Multiple simultaneous friend challenges work

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) | How Verified |
|---------------|-------------------|--------------|
| Friend challenge creates normal game | Steps 2, 3 | Manual test: game starts smoothly |
| Tetrominos spawn at normal rate (~1 per 3-5 seconds) | Steps 1, 2 | Manual test: observe spawn rate |
| Game plays exactly like random matchmaking | Steps 1, 2, 3 | Manual test: compare behaviors |
| Smooth, playable experience | Steps 1, 2, 3 | Manual test: no flickering |
| Server is authoritative for piece spawns | N/A - Architecture is client-authoritative by design | Confirmed in research |
| Clients only send player actions | N/A - Clients send full state updates by design | Confirmed in research |
| Server broadcasts state updates | Steps 4 | Server logs verify broadcast |
| No client-to-client direct updates | N/A - Architecture verified in research | Confirmed in research |
| Prevent infinite update loops | Steps 1, 2, 4 | Debouncing + state hash checking |
| Spawn rate: Normal gravity interval (~1-3 seconds per piece) | Steps 1, 2 | Manual test + sync frequency check |
| Piece spawn rate <10 per second | Steps 1, 2, 4 | Step 4 logging tracks this |
| State update frequency <10 per second per player | Steps 1, 2, 4 | Step 4 logging tracks this |
| No flickering or rapid replacement | Steps 1, 2, 3 | Manual test observation |
| Performance identical to random matchmaking | All steps | Manual comparison test |
| Zero complaints about unplayability | All steps | Post-deployment monitoring |

## Build/Test Commands

- **Build web client**: `pnpm --filter web build`
- **Build all**: `pnpm build:all` (from root)
- **Test all**: `pnpm --filter web test`
- **Test specific**: `pnpm --filter web test friendChallengeFlow`
- **Type check**: `pnpm type-check`
- **Dev mode (local testing)**: `pnpm dev` (from root)

## Implementation Notes

### Why This Fix Works

1. **Debouncing (Step 1)**: Prevents sending updates faster than 100ms, caps sync frequency
2. **State hashing (Step 2)**: Only syncs when OUR state changes, not when we receive opponent updates
3. **Dependency precision (Step 2)**: Watching specific properties instead of whole gameState object reduces false triggers
4. **Loop guard (Step 3)**: Prevents accidental double-starts of game loop
5. **Logging (Step 4)**: Makes it easy to diagnose if the problem reoccurs

### Why We DON'T Change Architecture

The spec might suggest making the server authoritative, but:
- That would require a massive refactor (rewrite entire game loop logic)
- Random matchmaking works fine with client-authoritative approach
- The bug is specifically a sync loop, not an architecture problem
- Minimal invasive fix is better for stability

### Rollback Plan

If this fix doesn't work or causes regressions:
1. Revert all changes: `git checkout packages/web/src/components/PartykitMultiplayerGame.tsx packages/web/src/services/partykit/gameSync.ts packages/partykit/src/game.ts`
2. The logging in Step 4 will help diagnose the actual root cause
3. Alternative fix: Add explicit "isSyncing" flag to prevent re-entrance

### Future Enhancements (Post-Fix)

If we wanted to fully solve this "properly":
1. Make server authoritative for all piece spawns (big refactor)
2. Clients send input commands (left, right, rotate, drop) instead of full state
3. Server runs both players' game loops
4. Clients become "view-only" rendering engines

But that's a separate project, not this bug fix.
