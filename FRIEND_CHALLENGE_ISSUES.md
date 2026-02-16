# Friend Challenge System - Critical Issues & Solutions

**Date:** 2026-02-15
**Status:** 🔴 Multiple Critical Bugs Found

---

## 🐛 Critical Issues Identified

### Issue 1: Both Sender AND Receiver See Notification ⚠️

**Location:** `App.tsx:123-140`

**The Bug:**
```typescript
const restorePendingChallenges = async () => {
  const pending = await friendService.getPendingChallenges(playerId);
  for (const challenge of pending) {
    if (challenge.challengedId === playerId) {
      setIncomingChallenge(challenge);  // ← Correct
    } else if (challenge.challengerId === playerId) {
      setOutgoingChallenge(challenge);  // ← ALSO shows notification!
    }
  }
};
```

**The Problem:**
`getPendingChallenges()` returns challenges where **EITHER** `challengerId` OR `challengedId` matches the user:

```typescript
// friendService.ts:423
.or(`challengerId.eq.${userId},challengedId.eq.${userId}`)
```

This means:
- **User A sends challenge** → Database has record with `challengerId = A`
- **User A calls `getPendingChallenges(A)`** → Gets their own outgoing challenge
- **App shows notification to User A** ← WRONG! Sender shouldn't see their own challenge

**Why This Happens:**
The notification component (`<Notification visible={!!incomingChallenge}`) is designed to show incoming challenges, but the code is also setting `setIncomingChallenge()` for challenges where the current user is the SENDER.

**Root Cause:**
```typescript
// Line 448-452 in friendService.ts
return {
  challengeId: c.id,
  challengerId: c.challengerId,
  challengedId: c.challengedId,
  challengerUsername: profile.username,  // ← WRONG!
  challengerRank: profile.rank,
  challengerLevel: profile.level,
  expiresAt: new Date(c.expiresAt).getTime(),
};
```

When User A queries their pending challenges, for challenges they SENT:
- `otherUserId = c.challengedId` (the receiver)
- `profile = receiver's profile`
- But the object says `challengerUsername = profile.username`

This is backwards! It's showing the RECEIVER's username as the challenger.

---

### Issue 2: Accept Challenge Always Fails ❌

**Location:** `presence.ts:207-244`

**The Bug:**
```typescript
handleChallengeAccept(data: any, sender: Party.Connection) {
  const { challengeId } = data;
  const challenge = this.pendingChallenges.get(challengeId);
  if (!challenge) return;  // ← Returns undefined, no feedback!

  // ... rest of code never runs
}
```

**The Problem:**
1. User clicks "Accept"
2. Client calls `presenceRef.current?.acceptChallenge(challengeId)`
3. WebSocket sends `{ type: 'friend_challenge_accept', challengeId: '...' }`
4. Server checks `this.pendingChallenges.get(challengeId)`
5. **Challenge not found** → Function returns early
6. **No error sent back** → Client doesn't know it failed
7. User sees nothing happening

**Why Challenge Not Found:**
The PartyKit presence server stores challenges in memory:
```typescript
pendingChallenges: Map<string, PendingChallenge> = new Map();
```

This map is **lost** when:
- Server restarts
- Room hibernates
- User reconnects

**Sequence of Failure:**
```
1. User A sends challenge → Stored in DB + PartyKit memory
2. PartyKit server restarts (or hibernates)
3. Memory cleared → pendingChallenges = empty Map
4. User B sees challenge (from DB polling)
5. User B clicks accept → sends challengeId
6. Server: pendingChallenges.get(challengeId) = undefined
7. Server returns early, no response
8. User B: Nothing happens 😡
```

---

### Issue 3: Notification Only Shows on Landing Page

**Location:** `App.tsx:270-294`

**The Bug:**
```typescript
<Notification
  visible={!!incomingChallenge}
  ...
/>
```

**The Problem:**
- The `<Notification>` component is rendered in `GameApp` component
- `GameApp` is only rendered when `mode === 'menu'`
- When user is in a game (`mode === 'solo'` or `mode === 'multiplayer'`), different components render
- **Challenge notifications don't show in-game!**

**User Flow:**
```
User A: In game
User B: Sends challenge to A
User A: Doesn't see notification (in game, Notification component not mounted)
User A: Finishes game, returns to menu
User A: Still doesn't see notification (challenge expired or polling hasn't run)
```

---

### Issue 4: Database vs WebSocket State Mismatch

**The Conflict:**
- **Database (Supabase):** Persistent, survives restarts
- **WebSocket (PartyKit):** In-memory, lost on restart/disconnect
- **Current implementation:** Both are used, not synchronized

**Example Failure:**
```
1. User A sends challenge
   - DB: status = 'pending'
   - PartyKit: pendingChallenges.set(id, {...})

2. PartyKit server restarts
   - DB: status = 'pending' (still there)
   - PartyKit: pendingChallenges.clear() (memory lost)

3. User B accepts challenge
   - Client: calls updateChallengeStatus(id, 'accepted') ← Updates DB
   - Client: calls acceptChallenge(id) → WebSocket
   - Server: pendingChallenges.get(id) = undefined
   - Server: Returns early, no match created
   - Result: DB says "accepted", but no game starts!
```

---

## 🎯 Proposed Solutions

### Solution 1: Fix getPendingChallenges Logic

**Current:**
```typescript
// Returns ALL challenges where user is either party
return challenges.map(c => {
  const otherUserId = c.challengerId === userId ? c.challengedId : c.challengerId;
  const profile = profiles.find(p => p.userId === otherUserId);

  return {
    challengerId: c.challengerId,  // ← Always from DB
    challengedId: c.challengedId,  // ← Always from DB
    challengerUsername: profile.username,  // ← WRONG when user is challenger
    ...
  };
});
```

**Fixed:**
```typescript
// Only return challenges where user is CHALLENGED (incoming)
return challenges
  .filter(c => c.challengedId === userId)  // ← ONLY incoming challenges
  .map(c => {
    const challengerProfile = profiles.find(p => p.userId === c.challengerId);

    return {
      challengeId: c.id,
      challengerId: c.challengerId,
      challengedId: c.challengedId,
      challengerUsername: challengerProfile.username,  // ← Correct: challenger's name
      challengerRank: challengerProfile.rank,
      challengerLevel: challengerProfile.level,
      expiresAt: new Date(c.expiresAt).getTime(),
    };
  });
```

**Create separate function for outgoing challenges:**
```typescript
async getOutgoingChallenges(userId: string): Promise<Challenge[]> {
  const { data: challenges, error } = await supabase
    .from('friend_challenges')
    .select('id, "challengerId", "challengedId", "createdAt", "expiresAt"')
    .eq('status', 'pending')
    .eq('challengerId', userId)  // ← ONLY where user is challenger
    .gt('expiresAt', new Date().toISOString());

  // ... map to get challenged user's profile
}
```

---

### Solution 2: Database-First Architecture

**Current (Broken):**
```
WebSocket is source of truth
    ↓ (lost on restart)
No fallback → Accept fails
```

**Proposed:**
```
Database is source of truth
    ↓
WebSocket is notification layer only
    ↓ (lost on restart?)
Fallback to DB query → Accept works!
```

**Implementation:**
```typescript
// presence.ts
handleChallengeAccept(data: any, sender: Party.Connection) {
  const { challengeId } = data;

  // Try memory first (fast path)
  let challenge = this.pendingChallenges.get(challengeId);

  if (!challenge) {
    // Fallback to database query
    console.warn('[PRESENCE] Challenge not in memory, querying database...');
    challenge = await this.queryChallengeFromDB(challengeId);
    if (!challenge) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Challenge not found or expired'
      }));
      return;
    }
  }

  // Rest of logic...
}

async queryChallengeFromDB(challengeId: string) {
  // Query Supabase for challenge details
  // If found and status='pending', return challenge object
  // Else return null
}
```

---

### Solution 3: Global Notification System

**Problem:** Notifications don't show in-game

**Solution:** Move notification to top-level, outside game mode routing

**Current Structure:**
```
<GameApp>
  <Notification />  ← Only when mode='menu'
  {mode === 'menu' && <MainMenu />}
  {mode === 'solo' && <TetrisGame />}
  {mode === 'multiplayer' && <MultiplayerGame />}
</GameApp>
```

**Fixed Structure:**
```
<GameApp>
  <GlobalNotificationLayer>
    <Notification />  ← Always rendered, positioned fixed
  </GlobalNotificationLayer>

  {mode === 'menu' && <MainMenu />}
  {mode === 'solo' && <TetrisGame />}
  {mode === 'multiplayer' && <MultiplayerGame />}
</GameApp>
```

**CSS:**
```css
.global-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;  /* Above everything */
}
```

---

### Solution 4: Persistent Challenge Queue

**Problem:** Challenges lost on disconnect/restart

**Solution:** Poll database + WebSocket notifications

**Current:**
```typescript
// App.tsx:123-140
// Polls every 30s, but overwrites state
```

**Improved:**
```typescript
useEffect(() => {
  // Initial load
  const loadChallenges = async () => {
    const incoming = await friendService.getPendingChallenges(playerId);
    const outgoing = await friendService.getOutgoingChallenges(playerId);

    // Set first incoming challenge (if any)
    if (incoming.length > 0 && !incomingChallenge) {
      setIncomingChallenge(incoming[0]);
    }

    // Set first outgoing challenge (if any)
    if (outgoing.length > 0 && !outgoingChallenge) {
      setOutgoingChallenge(outgoing[0]);
    }
  };

  loadChallenges();

  // Poll every 10 seconds (more frequent)
  const interval = setInterval(loadChallenges, 10000);

  return () => clearInterval(interval);
}, [playerId]);
```

---

### Solution 5: Add Error Feedback

**Problem:** Accept fails silently

**Solution:** Add error responses from server

**Server:**
```typescript
handleChallengeAccept(data: any, sender: Party.Connection) {
  const { challengeId } = data;
  const challenge = this.pendingChallenges.get(challengeId);

  if (!challenge) {
    sender.send(JSON.stringify({
      type: 'challenge_accept_failed',
      challengeId,
      error: 'Challenge not found. It may have expired or been cancelled.',
    }));
    return;
  }

  // ... rest of logic
}
```

**Client:**
```typescript
// presence.ts client
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'challenge_accept_failed':
      callbacks.onChallengeAcceptFailed(data.error);
      break;
    // ...
  }
});
```

**UI:**
```typescript
// App.tsx
const handleAcceptChallenge = useCallback(async (challengeId: string) => {
  try {
    await friendService.updateChallengeStatus(challengeId, 'accepted');
    presenceRef.current?.acceptChallenge(challengeId);
    setIncomingChallenge(null);
  } catch (error) {
    // Show error toast
    showError('Failed to accept challenge. Please try again.');
    // Reload challenges from DB
    restorePendingChallenges();
  }
}, []);
```

---

## 📋 Recommended Implementation Order

### Phase 1: Critical Fixes (Day 1)
1. ✅ Fix `getPendingChallenges()` to only return incoming challenges
2. ✅ Add `getOutgoingChallenges()` for sent challenges
3. ✅ Update App.tsx to use correct functions
4. ✅ Move Notification to global layer (always visible)

### Phase 2: Reliability (Day 2)
5. ✅ Add database fallback to `handleChallengeAccept`
6. ✅ Add error responses from server
7. ✅ Add error handling in client
8. ✅ Increase polling frequency to 10s

### Phase 3: UX Polish (Day 3)
9. ✅ Add visual feedback for failed accept
10. ✅ Add reconnection logic for challenge restoration
11. ✅ Add challenge history/notifications log

---

## 🧪 Testing Checklist

### Test Case 1: Basic Challenge Flow
- [ ] User A sends challenge to User B
- [ ] User B sees notification (not User A)
- [ ] User B accepts
- [ ] Both users enter game

### Test Case 2: Server Restart
- [ ] User A sends challenge
- [ ] Restart PartyKit server
- [ ] User B accepts challenge
- [ ] Game still starts (database fallback works)

### Test Case 3: In-Game Notifications
- [ ] User A is playing solo game
- [ ] User B sends challenge
- [ ] User A sees notification overlay (doesn't interrupt game)
- [ ] User A can accept/decline without leaving game

### Test Case 4: Connection Drop
- [ ] User A sends challenge
- [ ] User B's connection drops
- [ ] User B reconnects
- [ ] User B sees challenge (restored from DB)

### Test Case 5: Expiry
- [ ] User A sends challenge
- [ ] Wait 2 minutes
- [ ] Challenge expires
- [ ] Both users notified of expiry

---

## 🔍 Database Schema Verification

**Required fields in `friend_challenges` table:**
```sql
CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL,
  "challengedId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "expiresAt" TIMESTAMP DEFAULT NOW() + INTERVAL '2 minutes',
  CONSTRAINT status_check CHECK (status IN ('pending', 'accepted', 'declined', 'expired'))
);
```

**Indexes needed:**
```sql
CREATE INDEX idx_challenges_challenged ON friend_challenges("challengedId", status);
CREATE INDEX idx_challenges_challenger ON friend_challenges("challengerId", status);
CREATE INDEX idx_challenges_expiry ON friend_challenges("expiresAt") WHERE status = 'pending';
```

---

## 💡 Quick Win

**Fastest fix (30 minutes):**
```typescript
// friendService.ts - Change line 423
.or(`challengerId.eq.${userId},challengedId.eq.${userId}`)
// ↓ Change to:
.eq('challengedId', userId)  // ONLY incoming challenges
```

This alone will fix Issue #1 (both users seeing notification).

---

**Summary:**
- 🐛 4 critical bugs found
- 🎯 5 solutions proposed
- ⏱️ 3-day implementation plan
- ✅ Quick fix available now

The fundamental issue is **WebSocket memory vs Database persistence mismatch**. Solution: Make database the source of truth, use WebSocket only for instant notifications with database fallback.
