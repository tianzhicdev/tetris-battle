# Spec 002: Friend System

## Goal

Allow players to add friends and challenge them to direct matches, bypassing the random matchmaking queue. This is essential for retention — players should be able to say "hey, play me" to someone they know.

this document may not be 100% accurate; you need to adapt it to the existing codebase;
you can use ANY tool or api to achieve this. i think you can use supabase cli to interact with the db; if not, implement what you can, use mock for testing and in the end tell me what i need to do to make it work when deployed;

## Context

- Auth is handled by Clerk (provides `userId` and user metadata)
- User data lives in Supabase (`users_profile` table)
- Multiplayer is via Partykit WebSocket
- Current matchmaking is random queue-based pairing
- The web app uses Zustand for state management and Framer Motion for animations

## Requirements

### 1. Database Schema (Supabase)

**New table: `friendships`**
```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL REFERENCES users_profile(user_id),
  addressee_id TEXT NOT NULL REFERENCES users_profile(user_id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Index for fast friend list lookups
CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id, status);
```

**New table: `friend_challenges`**
```sql
CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id TEXT NOT NULL REFERENCES users_profile(user_id),
  challenged_id TEXT NOT NULL REFERENCES users_profile(user_id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes')
);
```

**Migration file:** `supabase/migrations/002_friend_system.sql`

### 2. Friend Management API (Supabase RPC or direct queries)

Implement these operations as a service module in `packages/web/src/services/friendService.ts`:

**`sendFriendRequest(requesterId, addresseeUsername)`**
- Look up addressee by username in `users_profile`
- If not found, return `{ error: 'USER_NOT_FOUND' }`
- If friendship already exists (in either direction), return `{ error: 'ALREADY_EXISTS' }`
- If addressee has blocked requester, return `{ error: 'BLOCKED' }`
- Insert row with status `'pending'`
- Return `{ success: true }`

**`acceptFriendRequest(friendshipId, userId)`**
- Verify the current user is the `addressee_id`
- Update status to `'accepted'`

**`declineFriendRequest(friendshipId, userId)`**
- Verify the current user is the `addressee_id`
- Delete the friendship row

**`removeFriend(friendshipId, userId)`**
- Verify the current user is either `requester_id` or `addressee_id`
- Delete the friendship row

**`blockUser(blockerId, blockedId)`**
- Upsert friendship with status `'blocked'` where requester = blocker
- If a reverse friendship exists and is accepted, delete it

**`getFriendList(userId)`**
- Return all friendships where user is requester OR addressee AND status = `'accepted'`
- Join with `users_profile` to return friend's username, level, rank, and online status
- Sort by username alphabetically

**`getPendingRequests(userId)`**
- Return all friendships where user is `addressee_id` AND status = `'pending'`
- Include requester's username, level, rank

**`searchUsers(query, currentUserId)`**
- Search `users_profile` where username ILIKE `%query%`
- Exclude current user
- Limit 10 results
- Return username, level, rank, and friendship status (none / pending / accepted / blocked)

### 3. Online Presence (Partykit)

**Presence tracking on the Partykit server:**
- When a player connects to the Partykit server (for any reason — matchmaking, active game, or just the main menu with an open WebSocket), register them as "online"
- Maintain an in-memory `Map<userId, { connectedAt: number, status: 'menu' | 'in_queue' | 'in_game' }>`
- When a player disconnects, remove them after a 10-second grace period (handles page refreshes)
- New message type from client: `{ type: 'presence_subscribe', friendIds: string[] }` — server sends presence updates for these user IDs
- Server pushes `{ type: 'presence_update', userId: string, status: 'online' | 'offline' | 'in_game' }` to subscribers

**Web client:**
- On main menu mount, open a persistent WebSocket to Partykit (if not already connected)
- Send `presence_subscribe` with the user's friend list
- Update friend list UI in real-time based on presence updates

### 4. Challenge System (Partykit + Supabase)

**Flow:**
1. Player A opens friend list, sees Player B is online, clicks "Challenge"
2. Client inserts a row in `friend_challenges` (status: pending, expires in 2 min)
3. Client sends Partykit message: `{ type: 'friend_challenge', challengeId, challengerId, challengedId }`
4. Partykit server forwards to Player B (if connected): `{ type: 'friend_challenge_received', challengeId, challengerUsername, challengerRank }`
5. Player B sees a notification/modal with Accept/Decline
6. If accepted: Player B sends `{ type: 'friend_challenge_accept', challengeId }` → server creates a match room and sends `match_found` to both → update `friend_challenges` status to `'accepted'`
7. If declined: `{ type: 'friend_challenge_decline', challengeId }` → server notifies Player A → update status to `'declined'`
8. If no response in 2 minutes: challenge expires → server notifies Player A with `{ type: 'friend_challenge_expired', challengeId }`

**Friend matches use the same game logic as ranked matches but:**
- Award full XP and coins (unlike AI matches)
- Award full rank changes (these are real competitive matches)
- Save to `match_history` normally

### 5. UI Components

**`FriendList.tsx`** — Main friend management panel
- Accessible from the main menu (new button: "Friends")
- Tabs: "Friends" | "Requests" | "Add Friend"
- **Friends tab:**
  - List of accepted friends with: avatar placeholder (first letter of username), username, level badge, rank tier icon, online status indicator (green dot = online, yellow = in game, gray = offline)
  - Each friend row has actions: "Challenge" (if online and not in game), "Remove"
  - "Challenge" button disabled with tooltip "In Game" if friend's status is `in_game`
- **Requests tab:**
  - Incoming pending requests with Accept/Decline buttons
  - Show requester's username, level, rank
  - Badge count on the tab header showing number of pending requests
- **Add Friend tab:**
  - Search input field (debounced, 300ms)
  - Results show username, level, rank, and contextual button:
    - "Add Friend" if no relationship
    - "Pending" (disabled) if request already sent
    - "Accept" if they sent you a request
    - "Friends ✓" (disabled) if already friends
    - "Blocked" if blocked

**`ChallengeNotification.tsx`** — Incoming challenge popup
- Appears as a modal overlay (Framer Motion slide-in from top)
- Shows: challenger's username, rank, level
- Two buttons: "Accept" and "Decline"
- Auto-declines after 2 minutes with a visible countdown timer
- If the user is currently in a game, queue the notification and show it after the game ends

**`ChallengeWaiting.tsx`** — Waiting for response
- Shown after sending a challenge
- Shows: "Waiting for {username} to respond..."
- Cancel button to withdraw the challenge
- Countdown timer showing time remaining

**Style:** All new components should use the existing glassmorphism style (use utilities from `styles/glassUtils.ts`). Match the visual language of existing components like `AbilityShop.tsx` and `MainMenu.tsx`.

### 6. State Management

**New Zustand store: `packages/web/src/stores/friendStore.ts`**
```typescript
interface FriendStore {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  incomingChallenge: Challenge | null;
  outgoingChallenge: Challenge | null;

  // Actions
  loadFriends(): Promise<void>;
  loadPendingRequests(): Promise<void>;
  sendRequest(username: string): Promise<Result>;
  acceptRequest(friendshipId: string): Promise<void>;
  declineRequest(friendshipId: string): Promise<void>;
  removeFriend(friendshipId: string): Promise<void>;
  sendChallenge(friendId: string): Promise<void>;
  acceptChallenge(challengeId: string): Promise<void>;
  declineChallenge(challengeId: string): Promise<void>;
  updatePresence(userId: string, status: string): void;
}
```

## File Changes Summary

New files:
- `supabase/migrations/002_friend_system.sql`
- `packages/web/src/services/friendService.ts`
- `packages/web/src/stores/friendStore.ts`
- `packages/web/src/components/FriendList.tsx`
- `packages/web/src/components/ChallengeNotification.tsx`
- `packages/web/src/components/ChallengeWaiting.tsx`
- `packages/web/src/components/__tests__/friendService.test.ts`
- `packages/web/src/components/__tests__/friendStore.test.ts`

Modified files:
- Partykit server (presence tracking + challenge relay)
- `packages/web/src/components/MainMenu.tsx` (add Friends button)
- `packages/web/src/App.tsx` (mount ChallengeNotification globally)

## Verification Criteria

### Unit Tests

1. **sendFriendRequest**: With valid username → creates pending friendship row
2. **sendFriendRequest**: With nonexistent username → returns `USER_NOT_FOUND`
3. **sendFriendRequest**: Duplicate request → returns `ALREADY_EXISTS`
4. **sendFriendRequest**: Blocked user → returns `BLOCKED`
5. **acceptFriendRequest**: Valid pending request → status becomes `'accepted'`
6. **acceptFriendRequest**: Wrong user (not addressee) → rejected
7. **declineFriendRequest**: Deletes the friendship row
8. **removeFriend**: Either party can remove → row deleted
9. **blockUser**: Creates blocked status, removes reverse accepted friendship
10. **getFriendList**: Returns only accepted friendships with profile data
11. **getPendingRequests**: Returns only pending where user is addressee
12. **searchUsers**: ILIKE search works, excludes self, limits to 10, includes friendship status

### Integration Tests

13. **Challenge flow happy path**: Player A challenges Player B → B accepts → both receive `match_found` → game starts → match_history records the game
14. **Challenge decline**: A challenges B → B declines → A receives decline notification → `friend_challenges` status is `'declined'`
15. **Challenge expiry**: A challenges B → 2 minutes pass → A receives expired notification → status is `'expired'`
16. **Presence**: Player connects → friends see them as online. Player starts a game → friends see `in_game`. Player disconnects → after 10s grace, friends see offline
17. **Full friend lifecycle**: Search user → send request → accept → appear in friend list → remove → no longer in friend list

### UI Verification (run dev server)

18. Main menu shows "Friends" button
19. Friend list opens with three tabs, all functional
20. Search finds users and shows correct relationship buttons
21. Online friends show green indicator
22. Challenge button sends challenge, shows waiting screen
23. Incoming challenge shows modal with countdown
24. After accepting challenge, game starts normally
25. Post-match screen works identically to random matches

### Database Verification

26. Run migration → both tables created with correct constraints
27. Unique constraint prevents duplicate friendship rows
28. Foreign keys reference `users_profile` correctly
29. Check constraint on status fields works (insert invalid status → fails)

## Run Command

```bash
# Apply migration
supabase db push

# Run tests
cd packages/web && pnpm test -- --grep "friend"

# Run full test suite to make sure nothing broke
pnpm test
pnpm build:all
```
