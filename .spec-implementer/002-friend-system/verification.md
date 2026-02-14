# Phase 4: Verification — Friend System (002)

## Unit Tests (Criteria 1-12)

### 1. sendFriendRequest: Valid username → creates pending friendship
- **Status: PASS** — Test: `friendService.test.ts` > "creates pending friendship with valid username"
- Service looks up user, checks existing, inserts with status='pending'

### 2. sendFriendRequest: Nonexistent username → USER_NOT_FOUND
- **Status: PASS** — Test: `friendService.test.ts` > "returns USER_NOT_FOUND for nonexistent username"

### 3. sendFriendRequest: Duplicate request → ALREADY_EXISTS
- **Status: PASS** — Test: `friendService.test.ts` > "returns ALREADY_EXISTS for duplicate request"

### 4. sendFriendRequest: Blocked user → BLOCKED
- **Status: PASS** — Test: `friendService.test.ts` > "returns BLOCKED when addressee has blocked requester"

### 5. acceptFriendRequest: Valid pending → status becomes 'accepted'
- **Status: PASS** — Test: `friendService.test.ts` > "accepts valid pending request when user is addressee"
- Verifies addressee_id match and updates status

### 6. acceptFriendRequest: Wrong user (not addressee) → rejected
- **Status: PASS** — Test: `friendService.test.ts` > "rejects when user is not the addressee"

### 7. declineFriendRequest: Deletes the friendship row
- **Status: PASS** — Test: `friendService.test.ts` > "deletes the friendship row"

### 8. removeFriend: Either party can remove → row deleted
- **Status: PASS** — Test: `friendService.test.ts` > "allows either party to remove friendship"
- Also tested: "rejects removal by non-member"

### 9. blockUser: Creates blocked status, removes reverse accepted
- **Status: PASS** — Test: `friendService.test.ts` > "creates blocked status and removes reverse accepted friendship"

### 10. getFriendList: Returns only accepted with profile data
- **Status: PASS** — Test: `friendService.test.ts` > "returns only accepted friendships with profile data"
- Returns sorted alphabetically with username, level, rank, onlineStatus

### 11. getPendingRequests: Returns only pending where user is addressee
- **Status: PASS** — Test: `friendService.test.ts` > "returns only pending where user is addressee"

### 12. searchUsers: ILIKE search, excludes self, limits to 10, includes friendship status
- **Status: PASS** — Tests: "returns search results with friendship status", "returns empty array for short queries"
- Uses ILIKE with %, excludes self via .neq(), .limit(10), includes friendship status

## Integration Tests (Criteria 13-17)

### 13. Challenge flow happy path
- **Status: IMPLEMENTED** (needs manual/e2e testing)
- Flow: sendChallenge → presence server → friend_challenge_received → acceptChallenge → friend_challenge_accepted with roomId → both enter multiplayer mode
- Game uses same logic as ranked matches (full XP, coins, rank changes)

### 14. Challenge decline
- **Status: IMPLEMENTED** (needs manual/e2e testing)
- Flow: sendChallenge → declineChallenge → friend_challenge_declined → outgoing cleared

### 15. Challenge expiry
- **Status: IMPLEMENTED** (needs manual/e2e testing)
- Server sets 2-minute timer, sends friend_challenge_expired to both players
- Client has visual countdown timer

### 16. Presence
- **Status: IMPLEMENTED** (needs manual/e2e testing)
- Connect → online. Status updates → in_game. Disconnect → 10s grace → offline.
- Subscribers receive presence_update messages

### 17. Full friend lifecycle
- **Status: IMPLEMENTED** (needs manual/e2e testing)
- searchUsers → sendFriendRequest → acceptFriendRequest → getFriendList → removeFriend
- Store actions tested in friendStore.test.ts (12 tests passing)

## UI Verification (Criteria 18-25) — Manual testing required

### 18. Main menu shows "Friends" button
- **Status: IMPLEMENTED** — Added to MainMenu.tsx in secondary button group with glassBlue styling
- Badge count shows pending request count

### 19. Friend list opens with three tabs, all functional
- **Status: IMPLEMENTED** — FriendList.tsx with tabs: "Friends" | "Requests" | "Add Friend"

### 20. Search finds users and shows correct relationship buttons
- **Status: IMPLEMENTED** — Add Friend tab with debounced search
- Contextual buttons: Add Friend / Pending / Accept / Friends / Blocked

### 21. Online friends show green indicator
- **Status: IMPLEMENTED** — Status indicators: green (online), yellow (in_game), gray (offline)
- Status text also displayed

### 22. Challenge button sends challenge, shows waiting screen
- **Status: IMPLEMENTED** — ChallengeWaiting.tsx with spinner, countdown, cancel button

### 23. Incoming challenge shows modal with countdown
- **Status: IMPLEMENTED** — ChallengeNotification.tsx with Framer Motion slide-in from top
- Shows challenger info, countdown timer, Accept/Decline buttons

### 24. After accepting challenge, game starts normally
- **Status: IMPLEMENTED** — Challenge accept → friend_challenge_accepted → setMode('multiplayer')
- Uses same game room and match logic as random matches

### 25. Post-match screen works identically to random matches
- **Status: IMPLEMENTED** — Friend matches use the same game room server and MultiplayerGame component
- Full XP, coins, and rank changes (same as ranked)

## Database Verification (Criteria 26-29)

### 26. Migration → both tables created with correct constraints
- **Status: IMPLEMENTED** — `supabase/migrations/005_friend_system.sql`
- friendships table: UUID PK, TEXT FKs to user_profiles, status CHECK constraint, UNIQUE constraint
- friend_challenges table: UUID PK, TEXT FKs, status CHECK constraint, expires_at default

### 27. Unique constraint prevents duplicate friendship rows
- **Status: IMPLEMENTED** — `UNIQUE("requesterId", "addresseeId")` on friendships table
- Also checked in application layer before insert

### 28. Foreign keys reference user_profiles correctly
- **Status: IMPLEMENTED** — Both tables reference `user_profiles("userId")`

### 29. Check constraint on status fields works
- **Status: IMPLEMENTED** — `CHECK (status IN ('pending', 'accepted', 'blocked'))` for friendships
- `CHECK (status IN ('pending', 'accepted', 'declined', 'expired'))` for friend_challenges

## Summary

- **Unit tests**: 15/15 passing (friendService) + 12/12 passing (friendStore) = **27/27**
- **Build**: Clean (all packages build successfully)
- **All 12 unit test criteria**: PASS
- **All 5 integration test criteria**: IMPLEMENTED (need e2e testing with live server)
- **All 8 UI criteria**: IMPLEMENTED (need manual testing with dev server)
- **All 4 database criteria**: IMPLEMENTED (need Supabase migration push)

## Manual Steps Required for Full Deployment

1. **Apply database migration**: `supabase db push` (or run SQL manually in Supabase dashboard)
2. **Deploy PartyKit**: `pnpm --filter partykit deploy` (to register the new presence party)
3. **Smoke test**: Run dev server and test friend flow manually
