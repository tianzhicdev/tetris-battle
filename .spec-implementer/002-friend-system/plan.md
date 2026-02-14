# Implementation Plan: Friend System (002)

## Overview
14 implementation steps, ordered by dependency. Each step includes exact file paths, code patterns, and test expectations.

---

## Step 1: Database Migration
**File:** `supabase/migrations/005_friend_system.sql`

Create two new tables following existing patterns (camelCase quoted columns, TEXT foreign keys to user_profiles):

```sql
-- friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "addresseeId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("requesterId", "addresseeId")
);

CREATE INDEX idx_friendships_requester ON friendships("requesterId", status);
CREATE INDEX idx_friendships_addressee ON friendships("addresseeId", status);

-- friend_challenges table
CREATE TABLE IF NOT EXISTS friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "challengedId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes')
);

-- RLS policies (permissive, matching existing pattern)
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read friendships" ON friendships FOR SELECT USING (true);
CREATE POLICY "Anyone can insert friendships" ON friendships FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update friendships" ON friendships FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete friendships" ON friendships FOR DELETE USING (true);

CREATE POLICY "Anyone can read challenges" ON friend_challenges FOR SELECT USING (true);
CREATE POLICY "Anyone can insert challenges" ON friend_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update challenges" ON friend_challenges FOR UPDATE USING (true);
```

---

## Step 2: Friend Service
**File:** `packages/web/src/services/friendService.ts`

Import `supabase` from `../lib/supabase`. Create a service class following ProgressionService pattern.

**Types to define:**
```typescript
interface Friend {
  friendshipId: string;
  odgUserId: string;
  username: string;
  level: number;
  rank: number;
  onlineStatus: 'online' | 'in_game' | 'offline';
}

interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
  level: number;
  rank: number;
  createdAt: string;
}

interface UserSearchResult {
  userId: string;
  username: string;
  level: number;
  rank: number;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
}
```

**Methods:**
1. `sendFriendRequest(requesterId, addresseeUsername)` - lookup by username, check duplicates, check blocks, insert
2. `acceptFriendRequest(friendshipId, userId)` - verify addressee, update to accepted
3. `declineFriendRequest(friendshipId, userId)` - verify addressee, delete row
4. `removeFriend(friendshipId, userId)` - verify membership, delete row
5. `blockUser(blockerId, blockedId)` - upsert blocked, remove reverse accepted
6. `getFriendList(userId)` - join user_profiles, return accepted friends
7. `getPendingRequests(userId)` - return pending where addressee
8. `searchUsers(query, currentUserId)` - ILIKE search, include friendship status

---

## Step 3: Friend Store (Zustand)
**File:** `packages/web/src/stores/friendStore.ts`

Follow abilityStore pattern with `create()`.

**State:**
```typescript
friends: Friend[]
pendingRequests: FriendRequest[]
incomingChallenge: Challenge | null
outgoingChallenge: Challenge | null
searchResults: UserSearchResult[]
searchLoading: boolean
friendsLoading: boolean
```

**Actions:**
- `loadFriends(userId)` - calls friendService.getFriendList
- `loadPendingRequests(userId)` - calls friendService.getPendingRequests
- `sendRequest(requesterId, username)` - calls friendService.sendFriendRequest
- `acceptRequest(friendshipId, userId)` - calls friendService.acceptFriendRequest, reload
- `declineRequest(friendshipId, userId)` - calls friendService.declineFriendRequest, reload
- `removeFriend(friendshipId, userId)` - calls friendService.removeFriend, reload
- `searchUsers(query, userId)` - calls friendService.searchUsers
- `updatePresence(userId, status)` - updates friend online status
- `setIncomingChallenge(challenge)` / `setOutgoingChallenge(challenge)` / `clearChallenges()`

---

## Step 4: Presence Party (Partykit Server)
**File:** `packages/partykit/src/presence.ts`

New PartyKit party for presence tracking and challenge relay. Single global room.

**Server State:**
```typescript
onlineUsers: Map<string, { connectedAt: number, status: 'menu' | 'in_queue' | 'in_game', connectionId: string }>
disconnectTimers: Map<string, ReturnType<typeof setTimeout>>
subscribers: Map<string, Set<string>> // userId -> Set of subscribing connection IDs
```

**Message Types (from client):**
- `presence_connect` - `{ userId }` → register online, clear any disconnect timer
- `presence_subscribe` - `{ friendIds: string[] }` → subscribe to presence updates
- `presence_status_update` - `{ userId, status: 'menu' | 'in_queue' | 'in_game' }` → update status
- `friend_challenge` - `{ challengeId, challengerId, challengedId }` → relay to challenged
- `friend_challenge_accept` - `{ challengeId, challengerId }` → relay to challenger, create room
- `friend_challenge_decline` - `{ challengeId, challengerId }` → relay to challenger

**Message Types (to client):**
- `presence_update` - `{ userId, status: 'online' | 'in_game' | 'offline' }` → sent to subscribers
- `friend_challenge_received` - forwarded challenge details
- `friend_challenge_accepted` - with roomId, match details
- `friend_challenge_declined` - notification
- `friend_challenge_expired` - notification

**onClose:** Start 10-second disconnect timer. If timer fires, mark offline and notify subscribers.

**Update `partykit.json`:** Add `"presence": "src/presence.ts"` to parties.

---

## Step 5: Presence Client Service
**File:** `packages/web/src/services/partykit/presence.ts`

PartySocket client for presence party. Class: `PartykitPresence`.

**Constructor:** Takes `userId`, `host` string.
**connect():** Opens PartySocket to party=presence, room=global. Sends `presence_connect`.
**subscribeFriends(friendIds):** Sends `presence_subscribe`.
**updateStatus(status):** Sends `presence_status_update`.
**sendChallenge(challengeId, challengedId):** Sends `friend_challenge`.
**acceptChallenge(challengeId, challengerId):** Sends `friend_challenge_accept`.
**declineChallenge(challengeId, challengerId):** Sends `friend_challenge_decline`.
**disconnect():** Close socket.

**Message handlers (via callbacks):**
- `onPresenceUpdate(userId, status)` → update friend store
- `onChallengeReceived(challenge)` → set incoming challenge
- `onChallengeAccepted(matchData)` → trigger match start
- `onChallengeDeclined(challengeId)` → clear outgoing challenge
- `onChallengeExpired(challengeId)` → clear outgoing challenge

---

## Step 6: FriendList Component
**File:** `packages/web/src/components/FriendList.tsx`

Full-screen modal overlay matching AbilityShop pattern. Three tabs.

**Props:** `{ profile, onClose, onStartMatch }`
**State:** `activeTab: 'friends' | 'requests' | 'add'`, `searchQuery`, local UI states

**Friends Tab:**
- List of friends from friendStore
- Each row: avatar (first letter), username, level badge, rank, online status dot
- Actions: "Challenge" (if online, not in_game), "Remove"

**Requests Tab:**
- Pending requests from friendStore
- Each row: username, level, rank, Accept/Decline buttons
- Badge count on tab header

**Add Friend Tab:**
- Search input (debounced 300ms)
- Results with contextual button (Add/Pending/Accept/Friends/Blocked)

**Styles:** Use mergeGlass, glassBlue, glassPurple, glassSuccess, glassDanger patterns.

---

## Step 7: ChallengeNotification Component
**File:** `packages/web/src/components/ChallengeNotification.tsx`

Framer Motion slide-in from top. Shows when `friendStore.incomingChallenge` is set.

**Props:** `{ onAccept, onDecline }`
**Features:**
- Challenger username, rank, level display
- Accept / Decline buttons
- 2-minute countdown timer
- Auto-decline on expiry

---

## Step 8: ChallengeWaiting Component
**File:** `packages/web/src/components/ChallengeWaiting.tsx`

Shown when `friendStore.outgoingChallenge` is set.

**Props:** `{ onCancel }`
**Features:**
- "Waiting for {username}..." text
- Cancel button
- Countdown timer

---

## Step 9: Integrate into MainMenu
**File:** `packages/web/src/components/MainMenu.tsx`

**Changes:**
1. Add `showFriends` state
2. Add "Friends" button in the secondary button group (use glassBlue style)
3. Import and render FriendList modal when showFriends is true
4. Add pending request badge count on the button

---

## Step 10: Integrate into App.tsx
**File:** `packages/web/src/App.tsx`

**Changes:**
1. Mount ChallengeNotification globally (outside mode routing)
2. Initialize presence connection on mount (when profile is available)
3. Handle challenge accept → create match (same as handleMatchFound)
4. Clean up presence on unmount

---

## Step 11: Challenge Flow Integration
**Where:** friendStore actions + presence client

**sendChallenge flow:**
1. Insert row in `friend_challenges` via Supabase
2. Send `friend_challenge` via presence WebSocket
3. Set outgoingChallenge in store

**acceptChallenge flow:**
1. Send `friend_challenge_accept` via presence WebSocket
2. Presence server creates room, sends `friend_challenge_accepted` with roomId to both
3. Both clients trigger handleMatchFound with roomId

**Challenge expiry:**
- Server-side: Timer on challenge, sends `friend_challenge_expired` after 2 min
- Client-side: Visual countdown timer

---

## Step 12: Tests (Friend Service)
**File:** `packages/web/src/__tests__/friendService.test.ts`

Mock Supabase client. Test all 8 service methods against spec verification criteria 1-12.
Need to add vitest to web package or use existing game-core vitest setup.

Actually, since web package has no test setup, create tests in game-core style:
**File:** `packages/web/src/__tests__/friendService.test.ts`

Will need to add vitest config to web package.

---

## Step 13: Tests (Friend Store)
**File:** `packages/web/src/__tests__/friendStore.test.ts`

Test store actions, state updates, challenge flow state management.

---

## Step 14: Build & Verify
1. Run `pnpm build:all` and fix any TypeScript errors
2. Run tests
3. Verify all 29 criteria from spec
4. Update CLAUDE.md if it exists (currently doesn't)

---

## File Change Summary

### New Files:
1. `supabase/migrations/005_friend_system.sql`
2. `packages/web/src/services/friendService.ts`
3. `packages/web/src/stores/friendStore.ts`
4. `packages/partykit/src/presence.ts`
5. `packages/web/src/services/partykit/presence.ts`
6. `packages/web/src/components/FriendList.tsx`
7. `packages/web/src/components/ChallengeNotification.tsx`
8. `packages/web/src/components/ChallengeWaiting.tsx`
9. `packages/web/src/__tests__/friendService.test.ts`
10. `packages/web/src/__tests__/friendStore.test.ts`

### Modified Files:
1. `packages/partykit/partykit.json` - add presence party
2. `packages/web/src/components/MainMenu.tsx` - add Friends button
3. `packages/web/src/App.tsx` - mount ChallengeNotification, init presence
