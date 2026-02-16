# Research Summary for Friend Challenge System Redesign

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React client (Vite + TypeScript)
  - `packages/partykit` - PartyKit server (multiplayer rooms)
  - `packages/game-core` - Shared game logic
- **Build**: Vite for web, TypeScript compiler
  - Command: `pnpm build:all` (all packages) or `pnpm --filter web build`
- **Tests**: Vitest
  - Command: `pnpm --filter web test`
  - Current status: 30+ tests passing

## Existing Patterns

### Imports
The project uses:
- Relative imports for local files: `import { friendService } from '../services/friendService'`
- Workspace imports for packages: `import type { UserProfile } from '@tetris-battle/game-core'`
- No barrel exports, direct file imports
- Type imports use `import type` syntax

### State Management
Zustand store pattern (`packages/web/src/stores/friendStore.ts`):
```typescript
export const useFriendStore = create<FriendStore>((set, get) => ({
  // State
  friends: [],
  incomingChallenge: null,
  outgoingChallenge: null,

  // Actions
  setIncomingChallenge: (challenge) => set({ incomingChallenge: challenge }),

  // Async actions with get()
  loadFriends: async (userId: string) => {
    const friends = await friendService.getFriendList(userId);
    set({ friends });
  },
}));
```

Hooks access store with selectors:
```typescript
const { incomingChallenge, setIncomingChallenge } = useFriendStore();
// OR specific selector:
const friends = useFriendStore(state => state.friends);
```

### Components
Pattern: Functional components with hooks (`packages/web/src/components/ChallengeWaiting.tsx`):
- Uses `framer-motion` for animations (AnimatePresence, motion.div)
- Inline styles using style prop (no CSS modules or styled-components)
- Glass morphism styling via `glassDanger()`, `mergeGlass()` utilities
- Sound effects via `audioManager.playSfx('button_click')`
- Responsive sizing with `clamp()` CSS function

### Supabase Client
Setup in `packages/web/src/lib/supabase.ts`:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

Query patterns:
```typescript
// Insert
const { data, error } = await supabase
  .from('friend_challenges')
  .insert({ challengerId, challengedId, status: 'pending' })
  .select()
  .single();

// Select with filters
const { data, error } = await supabase
  .from('friend_challenges')
  .select('*')
  .eq('challengedId', userId)
  .eq('status', 'pending')
  .gt('expiresAt', new Date().toISOString())
  .order('createdAt', { ascending: true });

// RPC call (for database functions)
const { data, error } = await supabase.rpc('accept_challenge', {
  p_challenge_id: challengeId,
  p_user_id: userId,
});
```

### Database Schema
Current `friend_challenges` table (from `supabase/migrations/005_friend_system.sql`):
```sql
CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "challengedId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes')
);
```

**Missing columns (need to add)**:
- `roomId` TEXT (for game room ID when accepted)
- `acceptedAt` TIMESTAMPTZ
- `resolvedAt` TIMESTAMPTZ
- `cancelled` status in CHECK constraint

### Service Layer Pattern
Service classes as singletons (`packages/web/src/services/friendService.ts`):
```typescript
class FriendService {
  async createChallenge(challengerId: string, challengedId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('friend_challenges')
      .insert({ challengerId, challengedId, status: 'pending' })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating challenge:', error);
      return null;
    }
    return data.id;
  }
}

export const friendService = new FriendService();
```

Error handling: returns `null` or `false` on error, logs to console.

### Tests
Pattern (Vitest with describe/it):
```typescript
describe('Friend Challenge Flow', () => {
  beforeEach(() => {
    useFriendStore.getState().clearChallenges();
  });

  it('should set outgoing challenge when challenge is sent', () => {
    const challenge: Challenge = { ... };
    useFriendStore.getState().setOutgoingChallenge(challenge);
    expect(useFriendStore.getState().outgoingChallenge).toEqual(challenge);
  });
});
```

## Analogous Flow: Current Challenge System (PartyKit-based)

### 1. Challenge Creation
**Client** (`packages/web/src/App.tsx` line 180+):
```typescript
// In FriendList.tsx, user clicks "Challenge" button
const handleChallenge = async (friendUserId: string) => {
  // 1. Create challenge in database
  const challengeId = await friendService.createChallenge(playerId, friendUserId);

  // 2. Set outgoing challenge in store (optimistic)
  setOutgoingChallenge({
    challengeId,
    challengerId: playerId,
    challengedId: friendUserId,
    // ... other fields
  });

  // 3. Send via PartyKit WebSocket
  presenceRef.current?.sendChallenge(challengeId, friendUserId, ...);
};
```

**Server** (`packages/partykit/src/presence.ts` line 210):
```typescript
handleFriendChallenge(data: any, sender: Party.Connection) {
  const { challengeId, challengerId, challengedId, ... } = data;

  // Store in memory with 2-minute timer
  this.pendingChallenges.set(challengeId, {
    ...data,
    expiresAt: Date.now() + 120000,
    timer: setTimeout(() => this.handleChallengeExpiry(challengeId), 120000),
  });

  // Forward to challenged user if online
  const challengedUser = this.onlineUsers.get(challengedId);
  if (challengedUser) {
    conn.send(JSON.stringify({ type: 'friend_challenge_received', ...data }));
  }
}
```

### 2. Challenge Reception
**Client** (`packages/web/src/App.tsx` line 90):
```typescript
presence.connect({
  onChallengeReceived: (challenge) => {
    setIncomingChallenge({
      challengeId: challenge.challengeId,
      challengerId: challenge.challengerId,
      // ...
    });
  },
});
```

UI renders `ChallengeNotification` component (not in codebase yet - need to create).

### 3. Challenge Accept
**Client** (hypothetical, based on patterns):
```typescript
const handleAccept = async () => {
  // Send accept via WebSocket
  presenceRef.current?.acceptChallenge(challengeId);

  // Wait for `onChallengeAccepted` callback
};
```

**Server** (`packages/partykit/src/presence.ts` line 273):
```typescript
async handleChallengeAccept(data: any, sender: Party.Connection) {
  const challenge = this.pendingChallenges.get(challengeId);

  // Generate room ID
  const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Notify both players
  challengerConn.send(JSON.stringify({
    type: 'friend_challenge_accepted',
    challengeId,
    roomId,
    player1: challenge.challengerId,
    player2: challenge.challengedId,
  }));

  challengedConn.send(JSON.stringify({ same message }));
}
```

**Client** (`packages/web/src/App.tsx` line 101):
```typescript
onChallengeAccepted: (data) => {
  clearChallenges();
  setGameMatch({ roomId: data.roomId, player1Id: data.player1, player2Id: data.player2 });
  setMode('multiplayer');  // Navigate to game
}
```

## Current Architecture Issues

The spec identifies these problems with the current system:
1. **Dual source of truth**: Database + PartyKit memory
2. **Volatile state**: PartyKit restarts lose challenge state
3. **Reliability**: ~60% success rate due to race conditions
4. **Complexity**: Two systems (DB + WebSocket) for one feature

Evidence in codebase:
- `packages/partykit/src/presence.ts` line 277-295: Falls back to DB query if challenge not in memory
- `packages/web/src/App.tsx` line 133-149: Polls database every 2 seconds to restore lost challenges
- No database update on challenge accept (only in PartyKit memory)

## Integration Points

### Files That Need Modification

1. **Database Migration** (NEW FILE)
   - `supabase/migrations/008_friend_challenges_redesign.sql`
   - Add `roomId`, `acceptedAt`, `resolvedAt` columns
   - Add `cancelled` to status CHECK constraint
   - Create database functions: `accept_challenge()`, `decline_challenge()`, `cancel_challenge()`
   - Create indexes for performance

2. **Service Layer** (`packages/web/src/services/friendService.ts`)
   - **Line 385-416**: Replace `createChallenge()` and `updateChallengeStatus()`
   - **Add new methods**: `acceptChallenge()`, `declineChallenge()`, `cancelChallenge()`
   - **Update return types** to match spec's error handling pattern

3. **Zustand Store** (`packages/web/src/stores/friendStore.ts`)
   - **Line 98-108**: Keep `setIncomingChallenge`, `setOutgoingChallenge`, `clearChallenges`
   - **Add new actions**: `sendChallenge()`, `acceptChallenge()`, `declineChallenge()`, `cancelChallenge()`
   - **Add optimistic update fields**: `pendingChallengeCreate`, `pendingChallengeAccept`

4. **New Hooks** (CREATE FILES)
   - `packages/web/src/hooks/useIncomingChallenges.ts` - Supabase Realtime subscription for incoming
   - `packages/web/src/hooks/useOutgoingChallenges.ts` - Supabase Realtime subscription for outgoing
   - `packages/web/src/hooks/useChallenges.ts` - Combined hook + initial load

5. **UI Components** (CREATE FILE)
   - `packages/web/src/components/ChallengeNotification.tsx` - Incoming challenge popup
   - **Existing**: `packages/web/src/components/ChallengeWaiting.tsx` - Already exists, may need updates

6. **App.tsx Integration** (`packages/web/src/App.tsx`)
   - **Line 82-124**: Remove PartyKit presence challenge logic
   - **Line 133-165**: Remove database polling logic
   - **Add**: Import and use `useChallenges(playerId)` hook
   - **Keep**: Challenge UI rendering (ChallengeNotification, ChallengeWaiting)

7. **FriendList.tsx** (assumed file, need to locate)
   - Update "Challenge" button handler to call `useFriendStore().sendChallenge()`

8. **PartyKit Presence** (`packages/partykit/src/presence.ts`)
   - **Keep**: Online presence tracking
   - **Remove**: All challenge handling (lines 210-461)
   - **Note**: This will be a later cleanup step, can coexist during rollout

## Key Files to Reference During Implementation

### Database Patterns
- `supabase/migrations/005_friend_system.sql` - Existing table structure
- `supabase/complete-schema.sql` - Full schema reference

### Service Patterns
- `packages/web/src/services/friendService.ts` - Service class structure
- `packages/web/src/lib/supabase.ts` - Supabase client setup

### Component Patterns
- `packages/web/src/components/ChallengeWaiting.tsx` - Styling, animations, timer
- `packages/web/src/components/MainMenu.tsx` - Button patterns, glass styling

### Store Patterns
- `packages/web/src/stores/friendStore.ts` - Zustand store structure
- `packages/web/src/stores/gameStore.ts` - Async action patterns

### Hook Patterns
- Look for `use*.ts` files in `packages/web/src/hooks/` for custom hook patterns

### Test Patterns
- `packages/web/src/__tests__/friendChallengeFlow.test.ts` - Store testing
- `packages/web/src/__tests__/friendService.test.ts` - Service testing with mocks

## Notes on Supabase Realtime

From `packages/web/src/lib/supabase.ts` line 12-18:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,  // Rate limit
    },
  },
});
```

Subscription pattern (from spec, not yet in codebase):
```typescript
const subscription = supabase
  .channel(`incoming_challenges_${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',  // or 'UPDATE'
    schema: 'public',
    table: 'friend_challenges',
    filter: `challengedId=eq.${userId}`,
  }, (payload) => {
    const challenge = payload.new as Challenge;
    // Handle new challenge
  })
  .subscribe();

// Cleanup:
return () => subscription.unsubscribe();
```

## Implementation Order

Based on dependencies:
1. **Database migration** - Foundation for everything
2. **Service layer** - API for interacting with database
3. **Hooks** - Realtime subscriptions
4. **Zustand store** - Integrate service + hooks
5. **UI components** - ChallengeNotification
6. **App.tsx** - Wire everything together
7. **Tests** - Verify behavior
8. **Cleanup** - Remove PartyKit challenge code (future)

## Completion Criteria

Phase 1 complete when:
- ✅ Read all relevant existing files
- ✅ Traced current challenge flow end-to-end (PartyKit-based)
- ✅ Documented patterns with concrete code examples
- ✅ Identified all integration points with specific files/lines
- ✅ Created this research summary

**Next**: Move to Phase 2 - Create detailed implementation plan
