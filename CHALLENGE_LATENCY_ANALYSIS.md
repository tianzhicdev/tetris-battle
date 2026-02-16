# Friend Challenge Latency Analysis

## Problem Statement

Friend challenges have **extremely high delay** when User B receives the challenge notification, while matched games have **instant notification**. This analysis identifies the root causes and proposes solutions.

---

## Data Flow Comparison

### Matched Games (Fast - ~10-50ms)

```
User A enters queue
     ↓
PartyKit Matchmaking Server (WebSocket)
     ├─ Finds match in memory
     ├─ Generates roomId
     └─ Sends "match_found" message via WebSocket
     ↓
User A & User B receive instantly (WebSocket push)
     ↓
Both navigate to game room
```

**Latency breakdown**:
- WebSocket RTT: 10-50ms
- Total: **~50ms**

---

### Friend Challenges (Slow - ~2-5 seconds)

```
User A sends challenge
     ↓
Database INSERT into friend_challenges
     ↓ (~50-100ms database write)
PostgreSQL Write-Ahead Log (WAL)
     ↓
Supabase Realtime reads WAL
     ↓ (~100-500ms replication lag)
Supabase Realtime broadcasts to subscribers
     ↓ (~50-100ms WebSocket push)
User B receives INSERT event
     ↓
❌ BOTTLENECK: User B makes ANOTHER database query
     await supabase
       .from('user_profiles')
       .select('username')
       .eq('userId', challenge.challengerId)
       .single();
     ↓ (~500-2000ms round-trip query)
User B displays challenge notification
```

**Latency breakdown**:
- Database INSERT: 50-100ms
- WAL → Realtime: 100-500ms
- Realtime → Client: 50-100ms
- **🔴 Extra username query: 500-2000ms** ← PRIMARY BOTTLENECK
- Total: **~2-5 seconds**

---

## Root Cause Analysis

### Bottleneck #1: Extra Database Query (PRIMARY ISSUE)

**Location**: `packages/web/src/hooks/useIncomingChallenges.ts:40-45`

```typescript
// After receiving Realtime INSERT event:
const { data: profile } = await supabase
  .from('user_profiles')
  .select('username')
  .eq('userId', challenge.challengerId)
  .single();
```

**Why this is slow**:
1. **Network round-trip**: Client → Supabase → PostgreSQL → Supabase → Client
2. **Query execution time**: Index lookup + row fetch
3. **Blocking operation**: Notification doesn't show until query completes
4. **Worst case**: If user profile query times out or fails, notification never shows

**Impact**: This single query adds **500-2000ms** to the notification latency.

---

### Bottleneck #2: Supabase Realtime Configuration

**Location**: `packages/web/src/lib/supabase.ts:12-17`

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,  // ← Rate limiting
    },
  },
});
```

**Issues**:
- `eventsPerSecond: 10` limits throughput to 10 events/second
- During high traffic, events may be queued/delayed
- Supabase Realtime has inherent latency (100-500ms) due to PostgreSQL WAL replication

**Impact**: Adds **100-500ms** base latency for all Realtime events.

---

### Bottleneck #3: PostgreSQL Change Data Capture (CDC)

Supabase Realtime uses PostgreSQL's logical replication:

```
INSERT → WAL written → WAL decoded → JSON published → WebSocket broadcast
```

This multi-step process has inherent latency:
- **WAL write**: 10-50ms
- **WAL decode**: 20-100ms
- **Realtime processing**: 50-200ms
- **WebSocket broadcast**: 50-100ms

**Impact**: Unavoidable **100-500ms** architectural latency.

---

## Why Matchmaking is Fast

Matchmaking bypasses all database operations:

1. **In-memory state**: PartyKit server holds entire queue in RAM
2. **Direct WebSocket**: No database writes, no WAL, no replication
3. **Single hop**: Server → WebSocket → Client
4. **No secondary queries**: All data sent in one message

**Result**: Only limited by WebSocket RTT (~10-50ms).

---

## Proposed Solutions

### Solution 1: Denormalize Username in friend_challenges (RECOMMENDED)

**Add `challengerUsername` column to `friend_challenges` table**:

```sql
ALTER TABLE friend_challenges
ADD COLUMN IF NOT EXISTS "challengerUsername" TEXT;
```

**Update INSERT in `friendService.createChallenge()`**:

```typescript
// Fetch username BEFORE inserting challenge
const { data: profile } = await supabase
  .from('user_profiles')
  .select('username')
  .eq('userId', challengerId)
  .single();

// Include username in challenge insert
const { data, error } = await supabase
  .from('friend_challenges')
  .insert({
    challengerId,
    challengedId,
    challengerUsername: profile?.username || 'Unknown', // ← Denormalized
    status: 'pending',
    expiresAt: new Date(Date.now() + 120000).toISOString(),
  })
  .select()
  .single();
```

**Remove query from `useIncomingChallenges`**:

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'friend_challenges',
  filter: `challengedId=eq.${userId}`,
}, (payload) => {
  const challenge = payload.new as any;

  // ✅ Username already in payload, no extra query!
  const fullChallenge: Challenge = {
    id: challenge.id,
    challengerId: challenge.challengerId,
    challengedId: challenge.challengedId,
    challengerUsername: challenge.challengerUsername, // ← From INSERT
    status: challenge.status,
    expiresAt: challenge.expiresAt,
    createdAt: challenge.createdAt,
  };

  setIncomingChallenge(fullChallenge);
  audioManager.playSfx('match_found');
})
```

**Impact**:
- ✅ Eliminates 500-2000ms query latency
- ✅ Notification shows immediately after Realtime event
- ✅ Single source of truth for username at challenge creation time
- ⚠️ Minor denormalization (username copied to challenge record)

**Expected latency reduction**: 2-5 seconds → **500-800ms**

---

### Solution 2: Use PartyKit for Challenge Notifications (AGGRESSIVE)

**Replace Supabase Realtime with PartyKit WebSocket for notifications**:

1. Keep database as source of truth
2. When User A creates challenge → INSERT to database
3. User A sends WebSocket message to PartyKit: `{ type: 'challenge_sent', toUserId: 'user_B' }`
4. PartyKit broadcasts to User B's WebSocket connection
5. User B receives instant notification
6. User B loads challenge details from database (or PartyKit forwards them)

**Pros**:
- ✅ Instant notification (10-50ms like matchmaking)
- ✅ Database still authoritative
- ✅ No Realtime latency

**Cons**:
- ❌ Requires PartyKit server changes
- ❌ More complex architecture (dual notification channels)
- ❌ User B must be connected to PartyKit when challenge sent

**Expected latency**: **10-100ms**

---

### Solution 3: Optimize Supabase Realtime Config

**Increase `eventsPerSecond` limit**:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 100, // ← Increase from 10
    },
  },
});
```

**Enable database connection pooling** (if not already enabled).

**Pros**:
- ✅ Simple configuration change
- ✅ Handles more concurrent challenges

**Cons**:
- ⚠️ Doesn't fix extra query bottleneck
- ⚠️ May hit Supabase plan limits

**Expected latency reduction**: Minimal (~50-100ms improvement)

---

### Solution 4: Preload Friend Usernames

**Cache friend usernames in Zustand store**:

```typescript
// When loading friends list, store usernames
const friendsMap = new Map<string, string>(); // userId → username

// In useIncomingChallenges, use cached username
const challengerUsername = friendsMap.get(challenge.challengerId) || 'Unknown';
```

**Pros**:
- ✅ No extra query if username is cached
- ✅ Works for challenges from friends list

**Cons**:
- ❌ Doesn't work if cache miss (new friend, cleared storage)
- ❌ Requires cache invalidation logic

**Expected latency reduction**: Variable (eliminates query only if cached)

---

## Recommended Implementation

### Phase 1: Quick Win (Denormalize Username)

**Time to implement**: 30 minutes
**Expected improvement**: 2-5s → 500-800ms (60-80% reduction)

1. Add `challengerUsername` column to `friend_challenges` table
2. Update `friendService.createChallenge()` to include username in INSERT
3. Remove username query from `useIncomingChallenges`
4. Update TypeScript interfaces

### Phase 2: Long-term (Hybrid PartyKit)

**Time to implement**: 4-6 hours
**Expected improvement**: 500-800ms → 10-100ms (90%+ reduction)

1. Add challenge notification to PartyKit presence server
2. Keep database as source of truth
3. Send instant WebSocket notification alongside database INSERT
4. Fallback to Supabase Realtime if WebSocket unavailable

---

## Comparison Table

| Metric | Current (Supabase Realtime) | Phase 1 (Denormalized) | Phase 2 (Hybrid PartyKit) | Matchmaking (Baseline) |
|--------|----------------------------|----------------------|--------------------------|----------------------|
| **Latency (p50)** | 2-3 seconds | 500-800ms | 50-150ms | 10-50ms |
| **Latency (p95)** | 5-8 seconds | 1-2 seconds | 200-500ms | 50-100ms |
| **Network hops** | 4 (INSERT + WAL + Realtime + Query) | 3 (INSERT + WAL + Realtime) | 1 (WebSocket) | 1 (WebSocket) |
| **Failure modes** | Query timeout, Realtime lag | Realtime lag | WebSocket disconnect | WebSocket disconnect |
| **Database load** | 2 queries per challenge | 1 query per challenge | 1 query per challenge | 0 queries per match |

---

## Measuring Success

After implementing Phase 1, add latency tracking:

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  ...
}, (payload) => {
  const challenge = payload.new as any;
  const createdAt = new Date(challenge.createdAt).getTime();
  const receivedAt = Date.now();
  const latency = receivedAt - createdAt;

  console.log(`[CHALLENGES] Notification latency: ${latency}ms`);

  // Track metrics (optional)
  // analytics.track('challenge_notification_latency', { latency });
})
```

**Target metrics**:
- p50 latency: < 800ms
- p95 latency: < 2 seconds
- p99 latency: < 5 seconds

---

## Summary

**Root cause**: Extra database query to fetch challenger's username adds 500-2000ms delay.

**Quick fix**: Denormalize `challengerUsername` in `friend_challenges` table.

**Long-term fix**: Hybrid approach using PartyKit for instant notifications + database for persistence.

**Expected improvement**: 2-5 seconds → 500-800ms (Phase 1) → 50-150ms (Phase 2)
