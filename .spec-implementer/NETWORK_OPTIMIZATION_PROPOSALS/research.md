# Research Summary for Network Optimization Proposals

## Project Structure

- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React client (Vite + TypeScript + Vitest)
  - `packages/partykit` - Server-side parties (PartyKit WebSocket servers)
  - `packages/game-core` - Shared game logic and types
- **Build**:
  - Root: `pnpm build:all` (builds all packages)
  - Web: `pnpm --filter web build` (tsc + vite build)
  - Core: `pnpm --filter game-core build` (tsc)
- **Tests**: Vitest (`pnpm --filter web test`)
- **Database**: Supabase (PostgreSQL)
- **WebSocket**: PartyKit + PartySocket client

## Existing Patterns

### Imports
```typescript
// Workspace dependencies
import { ABILITIES, type PlayerInputType } from '@tetris-battle/game-core';

// Services use class-based singletons
import { audioManager } from './services/audioManager';
import { friendService } from './services/friendService';

// Zustand stores
import { useFriendStore } from './stores/friendStore';
import { useDebugStore } from './stores/debugStore';

// PartyKit services instantiated with host/userId
const presence = new PartykitPresence(userId, host);
const gameClient = new ServerAuthGameClient(roomId, playerId, host, loadout);
```

### State Management (Zustand)
```typescript
// Example from friendStore.ts
export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  pendingRequests: [],
  incomingChallenge: null,
  outgoingChallenge: null,

  setIncomingChallenge: (challenge) => set({ incomingChallenge: challenge }),
  clearChallenges: () => set({ incomingChallenge: null, outgoingChallenge: null }),

  // Async actions
  loadFriends: async (userId: string) => {
    const friends = await friendService.getFriendList(userId);
    set({ friends });
  },
}));
```

### Components (Functional + Hooks)
```typescript
// Example pattern from App.tsx
export function ComponentName({ prop }: { prop: Type }) {
  const [state, setState] = useState<Type>(initialValue);
  const someRef = useRef<Type | null>(null);

  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, [dependencies]);

  const handleEvent = () => {
    // Handler logic
  };

  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Server Messages (PartyKit)

**Client → Server:**
```typescript
socket.send(JSON.stringify({
  type: 'message_type',
  playerId: string,
  ...data
}));
```

**Server → Client:**
```typescript
conn.send(JSON.stringify({
  type: 'message_type',
  ...data
}));
```

**Message Handler Pattern (Server):**
```typescript
// In onMessage(message: string, sender: Party.Connection)
let data: any;
try {
  data = JSON.parse(message);
} catch (error) {
  console.warn('[PREFIX] Ignoring non-JSON message:', message, error);
  return;
}

switch (data.type) {
  case 'message_type':
    this.handleMessageType(data, sender);
    break;
}
```

### Database (Supabase)

**Query Pattern:**
```typescript
// Select
const { data, error } = await supabase
  .from('table_name')
  .select('column1, column2')
  .eq('column', value)
  .single();

// Insert
const { data, error } = await supabase
  .from('table_name')
  .insert({ column1: value1, column2: value2 })
  .select('id')
  .single();

// Update
const { error } = await supabase
  .from('table_name')
  .update({ column: value })
  .eq('id', id);
```

**Existing Tables:**
- `user_profiles` - User data (userId, username, level, rank)
- `friendships` - Friend relationships (requesterId, addresseeId, status: pending/accepted/blocked)
- `friend_challenges` - Challenge records (challengerId, challengedId, status: pending/accepted/declined/expired, expiresAt)

### Tests (Vitest)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Component/Service Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Arrange
    const input = value;

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

## Analogous Flows

### Friend Challenge Flow (Existing)

1. **Send Challenge (Client)**
   - `FriendList.tsx` calls `presenceRef.current.sendChallenge()`
   - Creates record in `friend_challenges` table via `friendService.createChallenge()`
   - Sends WebSocket message `{ type: 'friend_challenge', ... }`

2. **Server Relays Challenge**
   - `presence.ts` receives in `handleFriendChallenge()`
   - Stores challenge in-memory: `this.pendingChallenges.set(challengeId, { ...challenge, timer })`
   - Forwards to target: `conn.send({ type: 'friend_challenge_received', ... })`
   - Sets 2-minute expiry timer

3. **Receive Challenge (Client)**
   - `App.tsx` receives via `onChallengeReceived` callback
   - Stores in Zustand: `setIncomingChallenge(challenge)`
   - Shows challenge modal via `ChallengeWaiting` component

4. **Accept Challenge (Client)**
   - User clicks accept → `presenceRef.current.acceptChallenge(challengeId)`
   - Updates DB: `friendService.updateChallengeStatus(challengeId, 'accepted')`
   - Sends `{ type: 'friend_challenge_accept', challengeId }`

5. **Server Matches Players**
   - `presence.ts` receives in `handleChallengeAccept()`
   - Generates `roomId = 'game_' + timestamp + random`
   - Clears expiry timer: `clearTimeout(challenge.timer)`
   - Sends to both players: `{ type: 'friend_challenge_accepted', roomId, player1, player2 }`

6. **Start Game (Client)**
   - `App.tsx` receives `onChallengeAccepted`
   - Sets `gameMatch = { roomId, player1Id, player2Id }`
   - Sets `mode = 'multiplayer'`
   - Renders `ServerAuthMultiplayerGame` component
   - Component creates `ServerAuthGameClient` and connects to game room

### Ping/Pong Flow (Debug Mode)

**Client sends ping:**
```typescript
// ServerAuthGameClient.ts
sendDebugPing(): void {
  const timestamp = Date.now();
  this.send({ type: 'debug_ping', timestamp });
}
```

**Server responds:**
```typescript
// game.ts onMessage
if (data.type === 'debug_ping') {
  sender.send(JSON.stringify({
    type: 'debug_pong',
    timestamp: data.timestamp,
    serverTime: Date.now(),
  }));
  return;
}
```

**Client calculates RTT:**
```typescript
// In message handler
case 'debug_pong':
  const rtt = Date.now() - data.timestamp;
  updateLatency(rtt);
  break;
```

## Integration Points

### Proposal 1.1: Persistent Challenge System

**Files to Modify:**
1. `packages/web/src/services/friendService.ts`
   - Add `getPendingChallenges(userId: string)` to query DB for active challenges
   - Modify `createChallenge()` to set initial status

2. `packages/web/src/services/partykit/presence.ts`
   - Add ACK message type: `challenge_ack`
   - Add method `acknowledgeChallenge(challengeId: string)`

3. `packages/partykit/src/presence.ts`
   - Add `handleChallengeAck()` method
   - On reconnect, query DB and send pending challenges
   - Add message tracking to detect lost messages

4. `packages/web/src/App.tsx`
   - On presence connect, call `friendService.getPendingChallenges()` and restore state
   - Poll DB every 30s for pending challenges as fallback

**Files to Create:**
- None (uses existing DB table `friend_challenges`)

### Proposal 1.2: Connection Quality Monitoring

**Files to Create:**
1. `packages/web/src/services/ConnectionMonitor.ts`
   - Class with ping/pong tracking
   - Latency history (last 10 pings)
   - Quality calculation
   - Event emitter for quality changes

**Files to Modify:**
1. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
   - Integrate ConnectionMonitor
   - Expose `getConnectionQuality()` method
   - Send ping every 2s

2. `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
   - Display connection indicator UI
   - Subscribe to quality changes

3. `packages/partykit/src/game.ts`
   - Already handles `debug_ping` → just ensure pong response works for all pings

4. `packages/web/src/stores/debugStore.ts` (if needed)
   - Store connection quality state

### Proposal 1.3: Smart Reconnection

**Files to Create:**
1. `packages/web/src/services/ReconnectionManager.ts`
   - Exponential backoff logic
   - Jitter calculation
   - State restoration on reconnect
   - UI feedback hooks

**Files to Modify:**
1. `packages/web/src/services/partykit/presence.ts`
   - Wrap PartySocket with reconnection manager
   - Configure `maxRetries`, `minReconnectionDelay`, `maxReconnectionDelay`
   - On reconnect, call `restoreState()`

2. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
   - Same wrapper pattern
   - On reconnect, send `{ type: 'request_state_sync' }`

3. `packages/partykit/src/presence.ts`
   - Add `handleStateSync()` handler
   - Query DB for pending challenges and send to client

4. `packages/partykit/src/game.ts`
   - Add `handleStateSync()` handler
   - Send current game state to reconnecting player

### Proposal 2.1: Adaptive Update Rate

**Files to Modify:**
1. `packages/partykit/src/game.ts`
   - Replace fixed `broadcastThrottle = 16` with per-player throttle
   - Add `playerLatencies: Map<string, number>`
   - Add `determineUpdateRate(playerId: string): number` method
   - Track latency from ping/pong
   - Modify `broadcastState()` to use adaptive throttling

### Proposal 2.2: Delta Compression

**Files to Create:**
1. `packages/partykit/src/DeltaCompressor.ts`
   - `createDelta(playerId, newState)` method
   - `compareBoardGrids(oldGrid, newGrid)` method
   - Track last sent state per player
   - Send full state every 60 updates (checkpoint)

2. `packages/web/src/services/DeltaReconstructor.ts`
   - `applyDelta(delta)` method
   - Maintain current state
   - Apply board diffs, piece updates, stat changes

**Files to Modify:**
1. `packages/partykit/src/game.ts`
   - Integrate DeltaCompressor in `broadcastState()`
   - Send `{ type: 'state_delta', ... }` or `{ type: 'state_full', ... }`

2. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
   - Integrate DeltaReconstructor
   - Handle `state_delta` and `state_full` message types
   - Convert reconstructed state to existing `GameStateUpdate` format

### Proposal 2.3: Hibernation API

**Files to Modify:**
1. `packages/partykit/src/presence.ts`
   - Implement `onRequest(req: Party.Request)` for WebSocket upgrades
   - Replace in-memory Maps with `this.room.storage.get/put`
   - Remove instance variables for user state
   - **Note**: May not be worth it - presence needs low-latency for real-time updates

### Proposal 3.1: Network Transition Handling

**Files to Create:**
1. `packages/web/src/services/NetworkMonitor.ts`
   - Use Network Information API (`navigator.connection`)
   - Listen for `change` events
   - Listen for `online`/`offline` events
   - Emit transition events

**Files to Modify:**
1. `packages/web/src/App.tsx`
   - Initialize NetworkMonitor on mount
   - On transition, pause game, show "Reconnecting" overlay
   - Trigger reconnection

2. `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
   - Subscribe to network transitions
   - Pause game loop when offline
   - Resume when back online

### Proposal 3.2: Offline Queue

**Files to Create:**
1. `packages/web/src/services/OfflineQueue.ts`
   - Queue messages when offline/socket closed
   - Persist to localStorage
   - Flush on reconnect
   - Remove expired messages (> 5 minutes)

**Files to Modify:**
1. `packages/web/src/services/partykit/presence.ts`
   - Wrap all `socket.send()` calls with `offlineQueue.send()`

2. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
   - Same wrapper for game inputs (though less critical - game pauses anyway)

## Key Files to Reference During Implementation

### Server Files
- `packages/partykit/src/presence.ts` - Presence/challenge server
- `packages/partykit/src/game.ts` - Game room server
- `packages/partykit/src/ServerGameState.ts` - Server-side game state

### Client Services
- `packages/web/src/services/partykit/presence.ts` - Presence client
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` - Game client
- `packages/web/src/services/friendService.ts` - Database operations
- `packages/web/src/services/debug/DebugLogger.ts` - Debug event logging

### Client Components
- `packages/web/src/App.tsx` - Main orchestration
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - Game UI
- `packages/web/src/components/FriendList.tsx` - Friend/challenge UI
- `packages/web/src/components/ChallengeWaiting.tsx` - Challenge modal

### Stores
- `packages/web/src/stores/friendStore.ts` - Friend/challenge state
- `packages/web/src/stores/debugStore.ts` - Debug panel state
- `packages/web/src/stores/gameStore.ts` - Legacy game state (not used in server-auth)

### Database
- `supabase/migrations/005_friend_system.sql` - Schema for challenges

### Type Definitions
- `packages/game-core/src/inputTypes.ts` - Input types
- `packages/game-core/src/types.ts` - Game state types

## Notes & Observations

1. **Challenge persistence already partially implemented**: The `friend_challenges` table exists and is used, but:
   - Challenges are ONLY stored in server memory (`pendingChallenges` Map)
   - DB is written on create but never queried on reconnect
   - If server restarts, all pending challenges are lost

2. **Debug ping/pong already works**: The `debug_ping`/`debug_pong` flow exists, just need to:
   - Make it continuous (every 2s)
   - Track latency history
   - Calculate connection quality

3. **PartySocket has built-in reconnection**: Using `partysocket` package which auto-reconnects:
   - Default maxRetries = 3 (need to increase)
   - Can configure delays via constructor options
   - No state restoration on reconnect (need to add)

4. **Server-authoritative mode is default**: Based on code, `ServerAuthMultiplayerGame` is the primary component used in `App.tsx` line 298. The spec mentions a `?serverAuth=true` flag but I don't see it in current code - appears server-auth is always on now.

5. **Throttling is already adaptive for AI**: In `game.ts` lines 365-368, AI delay adapts to debuffs. Can extend this pattern for network-based throttling.

6. **Test coverage is good**: 30 tests passing in web package, good patterns to follow for new tests.

7. **Delta compression will be complex**: Need to handle:
   - Nested arrays (board grid)
   - Object updates (piece, effects)
   - Checkpoints every 60 updates
   - Graceful degradation if delta lost

8. **Hibernation API may not suit presence server**: Presence needs low-latency real-time updates, hibernation adds cold-start latency. Better suited for matchmaking party.

## Implementation Priority Recommendation

Based on spec and code analysis:

**Phase 1 (Week 1) - Critical Fixes:**
1. Proposal 1.1 - Persistent challenges (DB polling + ACK)
2. Proposal 1.2 - Connection monitoring (ping/pong + UI)
3. Proposal 1.3 - Smart reconnection (exponential backoff + state restore)

**Phase 2 (Week 2) - Performance:**
1. Proposal 2.1 - Adaptive update rate (easy win, low risk)
2. Proposal 2.2 - Delta compression (complex, needs thorough testing)
3. Skip Proposal 2.3 - Hibernation (not worth tradeoffs for presence)

**Phase 3 (Week 3) - Mobile:**
1. Proposal 3.1 - Network transitions (iOS/Android specific)
2. Proposal 3.2 - Offline queue (complements Phase 1)
