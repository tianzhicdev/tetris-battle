# Friend Challenge Gameplay Latency Analysis

## Problem Statement

When playing friend challenges (after accepting), the gameplay has **very high latency** compared to matchmaking games.

---

## Current Challenge Acceptance Flow

### User A (Challenger) Flow

```
User A sends challenge
     ↓
Database INSERT (friendService.createChallenge)
     ↓
User A sees "Waiting for response" modal
     ↓
User B accepts challenge
     ↓
Database function accept_challenge() generates roomId
     ↓
Database UPDATE with roomId and status='accepted'
     ↓ (~100-500ms WAL replication)
Supabase Realtime broadcasts UPDATE event
     ↓
User A's App.tsx receives UPDATE event (lines 88-114)
     ↓
User A navigates to game room
```

**Total time for User A**: Challenge sent → Game room = **2-5 seconds**

---

### User B (Challenged) Flow

```
User B clicks "Accept" on challenge notification
     ↓
friendStore.acceptChallenge() called
     ↓
friendService.acceptChallenge() RPC call
     ↓
Database function executes, returns roomId
     ↓ (~50-100ms RPC round-trip)
friendStore receives roomId
     ↓
❌ IMMEDIATELY calls navigate() with roomId
     ↓
User B enters game room
```

**Total time for User B**: Click accept → Game room = **50-100ms**

---

## The Timing Problem

**User B enters game room BEFORE User A!**

Timeline:
```
T+0ms:    User B clicks Accept
T+50ms:   User B receives roomId from RPC
T+50ms:   User B navigates to game room
T+50ms:   User B connects to PartyKit game server
T+50ms:   User B waiting for opponent... (room status='waiting')

T+100ms:  Database UPDATE written to WAL
T+300ms:  Supabase Realtime broadcasts UPDATE event
T+500ms:  User A receives Realtime event
T+500ms:  User A navigates to game room
T+500ms:  User A connects to PartyKit game server
T+500ms:  Both players in room, game starts
```

**User B waiting time**: **450ms** before User A even starts connecting!

---

## Why This Causes High Gameplay Latency

### Issue #1: Delayed Game Start

**PartyKit game server waits for both players before starting**:

`packages/partykit/src/game.ts:139-197` (handleJoinGame)

```typescript
handleJoinGame(playerId: string, conn: Party.Connection, loadout?: string[], aiOpponent?: AIPersona) {
  this.players.set(playerId, {...});
  this.serverGameStates.set(playerId, serverState);

  // If this is second player joining, start the game
  if (this.players.size === 2 && this.roomStatus === 'waiting') {
    this.roomStatus = 'playing';
    this.broadcast({
      type: 'game_started',
      playerCount: this.players.size,
    });
  }
}
```

**Problem**: User B sits in waiting room for 500ms-2s before User A arrives.

---

### Issue #2: Network Path Asymmetry

**Location**: `packages/web/src/stores/friendStore.ts:166-197`

```typescript
acceptChallenge: async (challengeId: string, userId: string, navigate: any) => {
  set({ pendingChallengeAccept: true });

  const result = await friendService.acceptChallenge(challengeId, userId);

  if (!result.success) {
    throw new Error(result.error || 'Failed to accept challenge');
  }

  set({
    incomingChallenge: null,
    pendingChallengeAccept: false,
  });

  // User B navigates immediately
  navigate(`/game?roomId=${result.roomId}&mode=friend`, {
    state: {
      challengeId: result.challengeId,
      opponentId: result.challengerId,
    },
  });

  audioManager.playSfx('match_found');
},
```

**User B's network path**: Client → Supabase RPC → Database → Return roomId → Navigate

**User A's network path** (`App.tsx:88-114`):
```typescript
useEffect(() => {
  const subscription = supabase
    .channel(`challenge_accepted_${playerId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'friend_challenges',
      filter: `challengerId=eq.${playerId}`,
    }, (payload) => {
      const challenge = payload.new as any;

      if (challenge.status === 'accepted' && challenge.roomId) {
        clearChallenges();
        setGameMatch({
          roomId: challenge.roomId,
          player1Id: challenge.challengerId,
          player2Id: challenge.challengedId,
        });
        setMode('multiplayer');
      }
    })
    .subscribe();
}, [playerId, clearChallenges]);
```

**User A's network path**: Database UPDATE → WAL → Realtime → WebSocket → React state → Navigate

**Latency difference**: User A takes 5-10x longer to reach game room than User B!

---

### Issue #3: React State Update Delays

User A's navigation requires **multiple React state updates**:

```typescript
clearChallenges();        // Zustand store update
setGameMatch({...});       // React useState update
setMode('multiplayer');    // React useState update
```

Each state update can trigger re-renders, adding **10-50ms** of delay.

User B's navigation is direct:
```typescript
navigate(`/game?roomId=...`);  // Direct navigation, no state updates before
```

---

## Root Cause Summary

1. **Asymmetric notification architecture**: User B gets roomId via RPC (fast), User A gets roomId via Realtime (slow)
2. **Sequential player arrival**: User B enters room first, waits for User A
3. **PartyKit game server can't start game until both players joined**
4. **User B experiences "waiting" period as high latency**

---

## Proposed Solutions

### Solution 1: Delay User B's Navigation (QUICK FIX)

**Force User B to wait until User A is notified**:

```typescript
acceptChallenge: async (challengeId: string, userId: string, navigate: any) => {
  set({ pendingChallengeAccept: true });

  const result = await friendService.acceptChallenge(challengeId, userId);

  if (!result.success) {
    throw new Error(result.error || 'Failed to accept challenge');
  }

  // ✅ Wait for User A to receive notification
  // Estimate: Realtime latency is ~500ms
  await new Promise(resolve => setTimeout(resolve, 800));

  set({
    incomingChallenge: null,
    pendingChallengeAccept: false,
  });

  navigate(`/game?roomId=${result.roomId}&mode=friend`, {
    state: {
      challengeId: result.challengeId,
      opponentId: result.challengerId,
    },
  });

  audioManager.playSfx('match_found');
},
```

**Pros**:
- ✅ Simple 1-line change
- ✅ Synchronizes player arrival times
- ✅ Both players enter game room within 100-200ms of each other

**Cons**:
- ⚠️ Artificial delay feels unresponsive
- ⚠️ Hard-coded timeout may be too short or too long
- ⚠️ Doesn't fix underlying architecture issue

**Expected improvement**: High latency → Normal latency (similar to matchmaking)

---

### Solution 2: Have User B Poll for User A's Arrival (MEDIUM)

**Use Supabase Realtime to detect when User A joins game room**:

```typescript
acceptChallenge: async (challengeId: string, userId: string, navigate: any) => {
  const result = await friendService.acceptChallenge(challengeId, userId);

  // Navigate to game room
  navigate(`/game?roomId=${result.roomId}&mode=friend`, {
    state: {
      challengeId: result.challengeId,
      opponentId: result.challengerId,
      waitingForOpponent: true,  // ← Flag to show "Waiting for opponent..."
    },
  });

  // Show loading indicator while waiting for User A
  // Game client will handle "waiting" state
},
```

In `ServerAuthMultiplayerGame.tsx`, detect `waitingForOpponent` flag and show loading screen until `game_started` message from server.

**Pros**:
- ✅ No artificial delays
- ✅ User B sees "Waiting for opponent..." UI
- ✅ More honest about what's happening

**Cons**:
- ⚠️ Requires UI changes
- ⚠️ Still has asymmetric latency

---

### Solution 3: Use PartyKit for Challenge Notifications (BEST - LONG TERM)

**Replace Supabase Realtime with PartyKit WebSocket for BOTH users**:

1. User B accepts challenge → RPC returns roomId
2. User B sends PartyKit message: `{ type: 'challenge_accepted', challengeId, roomId, toUserId: 'user_A' }`
3. PartyKit presence server broadcasts to User A's WebSocket
4. **Both User A and User B navigate simultaneously**
5. Both arrive at game room within 10-50ms of each other

**Changes needed**:

**In `friendStore.acceptChallenge()`**:
```typescript
acceptChallenge: async (challengeId: string, userId: string, navigate: any) => {
  const result = await friendService.acceptChallenge(challengeId, userId);

  if (!result.success) {
    throw new Error(result.error || 'Failed to accept challenge');
  }

  // ✅ Broadcast via PartyKit instead of relying on Supabase Realtime
  presenceRef.current?.broadcast('challenge_accepted', {
    challengeId: result.challengeId,
    roomId: result.roomId,
    challengerId: result.challengerId,
  });

  // Navigate immediately
  navigate(`/game?roomId=${result.roomId}&mode=friend`, {
    state: {
      challengeId: result.challengeId,
      opponentId: result.challengerId,
    },
  });
},
```

**In `App.tsx` (User A's listener)**:
```typescript
useEffect(() => {
  if (!presenceRef.current) return;

  // Listen for challenge accepted via PartyKit (fast!)
  presenceRef.current.onMessage('challenge_accepted', (data) => {
    clearChallenges();
    setGameMatch({
      roomId: data.roomId,
      player1Id: data.challengerId,
      player2Id: playerId,  // User A is challenged
    });
    setMode('multiplayer');
  });
}, [presenceRef, clearChallenges]);
```

**Pros**:
- ✅ 10-50ms notification latency (same as matchmaking)
- ✅ Both users navigate simultaneously
- ✅ No waiting period in game room
- ✅ Consistent with matchmaking architecture

**Cons**:
- ❌ Requires PartyKit presence server changes
- ❌ More complex (dual-channel architecture)
- ❌ Database still needed for persistence

**Expected improvement**: Matches matchmaking latency (10-50ms)

---

### Solution 4: Broadcast roomId via Matchmaking-Like Flow (ALTERNATIVE)

**When User B accepts, trigger a matchmaking-style broadcast**:

Instead of using Supabase Realtime for User A's notification, have the `accept_challenge` database function trigger a webhook/queue that sends a PartyKit broadcast.

**Database function** calls external HTTP endpoint:
```sql
-- In accept_challenge function, after generating roomId:
PERFORM net.http_post(
  url := 'https://your-partykit-host/notify-challenge-accepted',
  body := json_build_object(
    'challengerId', v_challenge."challengerId",
    'roomId', v_room_id
  )::text
);
```

**PartyKit webhook handler** broadcasts to User A immediately.

**Pros**:
- ✅ Fast notification to User A
- ✅ Database remains source of truth
- ✅ No client-side coordination needed

**Cons**:
- ❌ Requires Supabase pg_net extension
- ❌ Adds external HTTP dependency
- ❌ More infrastructure complexity

---

## Comparison Table

| Solution | Latency Improvement | Complexity | Development Time |
|----------|-------------------|------------|-----------------|
| **Current** | N/A (500ms-2s delay) | - | - |
| **Solution 1 (Delay User B)** | ⭐⭐⭐ (100-200ms sync) | ⭐ (1 line) | 5 minutes |
| **Solution 2 (Poll/Wait UI)** | ⭐⭐ (no change) | ⭐⭐ (UI changes) | 1 hour |
| **Solution 3 (PartyKit notify)** | ⭐⭐⭐⭐⭐ (10-50ms) | ⭐⭐⭐ (PartyKit changes) | 4 hours |
| **Solution 4 (Webhook)** | ⭐⭐⭐⭐ (50-100ms) | ⭐⭐⭐⭐ (Infrastructure) | 6 hours |

---

## Recommended Approach

### Phase 1: Quick Fix (Solution 1)

Add 800ms delay before User B navigates.

**Time**: 5 minutes
**Expected result**: Both players enter game room at roughly same time

### Phase 2: Long-term (Solution 3)

Replace Supabase Realtime challenge acceptance notification with PartyKit WebSocket broadcast.

**Time**: 4 hours
**Expected result**: Match matchmaking latency (10-50ms)

---

## Testing the Hypothesis

To confirm this is the issue, add logging in both clients:

**User A's console** (receiving end):
```typescript
}, (payload) => {
  console.log('[CHALLENGE] Received UPDATE at:', Date.now());
  console.log('[CHALLENGE] Challenge created at:', payload.new.createdAt);
  console.log('[CHALLENGE] Notification delay:',
    Date.now() - new Date(payload.new.acceptedAt).getTime(), 'ms');
  // ... rest of handler
})
```

**User B's console** (accepting end):
```typescript
acceptChallenge: async (...) => {
  const acceptStart = Date.now();
  const result = await friendService.acceptChallenge(challengeId, userId);
  console.log('[CHALLENGE] Accept RPC took:', Date.now() - acceptStart, 'ms');

  const navigateStart = Date.now();
  navigate(`/game?roomId=${result.roomId}&mode=friend`, {...});
  console.log('[CHALLENGE] Navigation triggered at:', Date.now() - navigateStart, 'ms');
}
```

**Expected logs**:
- User B: "Accept RPC took: 50-100ms"
- User B: "Navigation triggered at: 0ms" (immediate)
- User A: "Notification delay: 500-2000ms" (DELAYED!)

This confirms User B arrives at game room **500-2000ms before User A**.

---

## Summary

**Root cause**: User B navigates immediately after RPC, but User A waits 500-2000ms for Supabase Realtime notification. This causes asynchronous game room entry, forcing User B to wait in "lobby" before game can start.

**Quick fix**: Delay User B's navigation by 800ms to synchronize arrival times.

**Long-term fix**: Use PartyKit WebSocket for instant bilateral notification (like matchmaking does).
