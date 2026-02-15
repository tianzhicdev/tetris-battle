# Research Summary for Spec 005: Fix Friend Challenge Rapid Tetromino Bug

## Project Structure

- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React frontend (Vite + TypeScript + Vitest)
  - `packages/partykit` - PartyKit server parties
  - `packages/game-core` - Shared game logic
- **Build**: `pnpm build` (vite build for web)
- **Tests**: `pnpm --filter web test` (vitest)

## Existing Patterns

### Project Architecture

```
packages/
├── web/               # React client
│   ├── src/
│   │   ├── components/
│   │   │   ├── FriendList.tsx
│   │   │   ├── PartykitMultiplayerGame.tsx
│   │   │   ├── ChallengeNotification.tsx
│   │   │   └── ChallengeWaiting.tsx
│   │   ├── services/
│   │   │   └── partykit/
│   │   │       ├── gameSync.ts        # Client-side game state sync
│   │   │       ├── matchmaking.ts     # Client-side matchmaking
│   │   │       └── presence.ts        # Client-side presence/challenges
│   │   └── stores/
│   │       ├── gameStore.ts
│   │       └── friendStore.ts
│   └── package.json
├── partykit/          # PartyKit server
│   ├── src/
│   │   ├── matchmaking.ts    # Matchmaking party (random + AI fallback)
│   │   ├── game.ts           # Game room party (handles game state)
│   │   ├── presence.ts       # Presence party (online status + challenges)
│   │   └── server.ts         # Default party (unused)
│   └── partykit.json
└── game-core/         # Shared game logic
    ├── src/
    │   ├── engine.ts
    │   └── types.ts
    └── package.json
```

### PartyKit Server Parties

From `packages/partykit/partykit.json`:
```json
{
  "parties": {
    "matchmaking": "src/matchmaking.ts",  // Queue + AI matching
    "game": "src/game.ts",                // Game room logic
    "presence": "src/presence.ts"         // Online status + friend challenges
  }
}
```

### Imports

- **Relative imports** for local files: `../stores/gameStore`
- **Workspace imports** for packages: `@tetris-battle/game-core`
- **Barrel exports**: No significant barrel patterns observed

### State Management

**Zustand stores** (packages/web/src/stores/):
- `gameStore.ts` - Game state (board, score, current piece, etc.)
- `friendStore.ts` - Friends, challenges, search results

Example from gameStore:
```typescript
export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: initialState,
  initGame: () => set({ gameState: createInitialGameState() }),
  tick: () => { /* game loop logic */ },
  // ...
}))
```

### Component Patterns

- **Functional components** with hooks
- **TypeScript** with explicit interfaces
- **Inline styles** (no CSS modules)
- **Framer Motion** for animations
- **Glass morphism** design (blur, rgba backgrounds)

### Server Messages

**Message format** (JSON over WebSocket):
```typescript
// Client → Server
{
  type: 'join_game' | 'game_state_update' | 'game_event' | 'ability_activation' | 'game_over',
  playerId: string,
  state?: GameState,
  // ... other fields
}

// Server → Client
{
  type: 'room_state' | 'game_start' | 'opponent_state_update' | 'game_finished',
  // ... data
}
```

## Analogous Flow: Random Matchmaking (WORKS CORRECTLY)

### Flow Trace

1. **User joins queue** (`PartykitMatchmaking.tsx`)
   - Connects to `matchmaking` party, room `global`
   - Sends `join_queue` message with `playerId` and `rank`

2. **Server matches players** (`packages/partykit/src/matchmaking.ts`)
   - If 2 players in queue → instant match
   - If waiting >20s → AI fallback (generates AIPersona)
   - Generates unique `roomId`
   - Sends `match_found` to both players with roomId, player1, player2, aiOpponent (if AI)

3. **Game starts** (`PartykitMultiplayerGame.tsx`)
   - Creates `PartykitGameSync` instance with roomId
   - Connects to `game` party with specific room
   - Sends `join_game` message

4. **Server initializes game** (`packages/partykit/src/game.ts`)
   - Waits for 2 players to join
   - If AI opponent: starts `startAIGameLoop()` (server-side AI game loop)
   - Broadcasts `game_start` when ready

5. **Game loop**:
   - **Client (Human)**: Runs local game loop (`useEffect` in PartykitMultiplayerGame.tsx:194-219)
     - Ticks every 1000ms (base tick rate)
     - Updates local game state (board, piece, score)
     - Syncs state to server via `gameSync.updateGameState()` (line 165-179)

   - **Server (AI)**: Runs AI game loop (`startAIGameLoop` in game.ts:151-284)
     - Interval checks every 50ms
     - Executes ONE move per tick (adaptive delay 300-600ms)
     - Updates server-side AI game state
     - Broadcasts AI state to human player

   - **State Sync**: Client sends `game_state_update`, server broadcasts as `opponent_state_update`

### Key Discovery: CLIENT-AUTHORITATIVE Architecture

**Critical finding**: Each client runs its OWN game loop and manages its OWN pieces!

- Client controls its own tetromino spawning, movement, gravity
- Server is NOT authoritative for piece spawning (except for AI)
- Server only RELAYS opponent state updates
- Each player's client is the source of truth for their own board

From `packages/web/src/components/PartykitMultiplayerGame.tsx`:
```typescript
// Line 194-219: Client game loop
useEffect(() => {
  const BASE_TICK_RATE = 1000;
  const loop = () => {
    tick();  // ← Client calls local game loop!
    gameLoopRef.current = window.setTimeout(loop, tickRate);
  };
  if (!gameState.isGameOver && isConnected && !gameFinished) {
    gameLoopRef.current = window.setTimeout(loop, BASE_TICK_RATE);
  }
  // ...
}, [tick, gameState.isGameOver, isConnected, gameFinished]);
```

From `packages/partykit/src/game.ts`:
```typescript
// Line 286-343: Server only relays state updates
handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
  const player = this.players.get(playerId);
  if (!player) return;

  player.gameState = state;  // ← Just stores it

  // Broadcast to opponent
  const opponent = this.getOpponent(playerId);
  if (opponent) {
    const opponentConn = this.getConnection(opponent.connectionId);
    if (opponentConn) {
      opponentConn.send(JSON.stringify({
        type: 'opponent_state_update',
        state,  // ← Just relays it
      }));
    }
  }
}
```

## Analogous Flow: Friend Challenge (BROKEN)

### Flow Trace

1. **User sends challenge** (`FriendList.tsx` line 308)
   - Clicks "Challenge" button on friend
   - Calls `onChallenge(friend.userId, friend.username)`

2. **Challenge handler** (`App.tsx` line 163-186)
   - Creates challenge record in database (Supabase)
   - Sends challenge via presence WebSocket: `presenceRef.current.sendChallenge(...)`
   - Sets `outgoingChallenge` in store (shows waiting UI)

3. **Challenge delivery** (`packages/partykit/src/presence.ts` line 127-163)
   - Presence server receives `friend_challenge` message
   - Stores in `pendingChallenges` map
   - Sets 2-minute expiry timer
   - Forwards to challenged user via `friend_challenge_received` message

4. **Challenge acceptance** (App.tsx line 188-192 + presence.ts line 165-199)
   - Challenged user clicks "Accept"
   - Sends `friend_challenge_accept` to presence server
   - Presence server:
     - Clears expiry timer
     - **Generates game roomId** (line 175)
     - Sends `friend_challenge_accepted` to BOTH players with roomId

5. **Game starts** (App.tsx line 65-68)
   - Both clients receive `friend_challenge_accepted` message
   - Set `gameMatch` state with roomId
   - Switch to `multiplayer` mode
   - This renders `<PartykitMultiplayerGame>` component

6. **From here, flow SHOULD be identical to random matchmaking**
   - Both clients create PartykitGameSync
   - Connect to same game room
   - Server waits for 2 players
   - Game loop starts

### THE BUG: Why Friend Challenges Break

**Root Cause Hypothesis**: Friend challenges use the SAME game room architecture as random matchmaking, BUT something causes rapid piece spawning.

**Likely causes**:

#### 1. Missing `aiOpponent` Parameter ❌
In random matchmaking:
```typescript
// matchmaking.ts sends:
{ type: 'match_found', roomId, player1, player2, aiOpponent: persona }

// PartykitMultiplayerGame receives aiOpponent prop
const sync = new PartykitGameSync(roomId, playerId, host, aiOpponent);
```

In friend challenges:
```typescript
// presence.ts sends:
{ type: 'friend_challenge_accepted', roomId, player1, player2 }
// ← NO aiOpponent field!

// App.tsx line 65-68:
onChallengeAccepted: (data) => {
  setGameMatch({ roomId: data.roomId, player1Id: data.player1, player2Id: data.player2 });
  setMode('multiplayer');
}
// ← Where does aiOpponent come from?
```

**Problem**: The `aiOpponent` prop is passed to `PartykitGameSync` constructor, which then passes it to `join_game` message. If this is undefined for friend challenges, the server might behave differently.

#### 2. Both Clients Running Full Game Loops ⚠️
Each client runs its own game loop (tick() every 1000ms) which:
- Spawns new pieces
- Applies gravity
- Updates board
- Syncs state to server

If BOTH clients are doing this AND there's a sync feedback loop, pieces could spawn rapidly.

#### 3. Possible Infinite State Update Loop ⚠️
Scenario:
1. Client A spawns piece → syncs state to server
2. Server broadcasts state to Client B as "opponent_state_update"
3. Client B receives update → ???
4. If Client B's state update triggers another sync → infinite loop

**Need to verify**: Does receiving `opponent_state_update` trigger a re-sync?

From PartykitMultiplayerGame.tsx line 162-180:
```typescript
// Sync game state to server
useEffect(() => {
  if (gameSyncRef.current && isConnected) {
    gameSyncRef.current.updateGameState(...);
  }
}, [gameState, isConnected, gameFinished]);
```

This `useEffect` depends on `gameState`. If receiving opponent updates somehow modifies `gameState`, this could trigger re-syncs.

#### 4. Race Condition in Game Initialization
Both players connect to the game room simultaneously (within milliseconds). Possible issues:
- Server sends `game_start` before both are ready?
- Both clients think they're "player1"?
- Game loop starts on both before connection stabilizes?

## Integration Points

### Files Requiring Modification

1. **`packages/partykit/src/presence.ts`** (line 165-199)
   - `handleChallengeAccept()` - Need to ensure friend challenge match data matches matchmaking format
   - May need to add `aiOpponent: null` or similar to distinguish human vs AI matches

2. **`packages/web/src/App.tsx`** (line 65-68)
   - `onChallengeAccepted` callback - Need to properly handle match data
   - Ensure gameMatch state includes all necessary fields

3. **`packages/web/src/components/PartykitMultiplayerGame.tsx`**
   - Verify game loop logic (line 194-219)
   - Check state sync useEffect (line 162-180)
   - Ensure no double-spawning of pieces

4. **`packages/partykit/src/game.ts`**
   - Verify `handleJoinGame` logic (line 101-149)
   - Check if AI vs human matching is handled correctly
   - Ensure room initialization works for both match types

### Debugging Approach

**Add extensive logging** to trace the exact spawn sequence:

1. Client-side logging in `gameStore.ts`:
   - Log when new piece spawns
   - Log when tick() is called
   - Log when state sync occurs

2. Server-side logging in `game.ts`:
   - Log when `join_game` received (with aiOpponent value)
   - Log when `game_state_update` received
   - Log when broadcasting opponent updates

3. Network logging:
   - Count WebSocket messages per second
   - Track message types

## Key Files to Reference During Implementation

### Must Read
- `packages/partykit/src/game.ts` - Server game logic, AI loop
- `packages/web/src/components/PartykitMultiplayerGame.tsx` - Client game component
- `packages/web/src/services/partykit/gameSync.ts` - State sync logic
- `packages/partykit/src/presence.ts` - Challenge handling
- `packages/web/src/App.tsx` - Match flow coordination

### Supporting Files
- `packages/web/src/stores/gameStore.ts` - Game state management
- `packages/partykit/src/matchmaking.ts` - Working reference for match creation
- `packages/web/src/components/PartykitMatchmaking.tsx` - Working matchmaking flow

## Test Infrastructure

- **Framework**: Vitest
- **Location**: `packages/web/src/__tests__/`
- **Run**: `pnpm --filter web test`
- **Patterns**: Standard vitest (describe/it/expect)

Example test structure:
```typescript
import { describe, it, expect } from 'vitest';
import { useFriendStore } from '../stores/friendStore';

describe('FriendStore', () => {
  it('should handle incoming challenge', () => {
    useFriendStore.getState().setIncomingChallenge(challenge);
    expect(useFriendStore.getState().incomingChallenge).toEqual(challenge);
  });
});
```

## Next Steps for Phase 2

1. **Compare message formats** between random matchmaking and friend challenges
2. **Identify missing fields** in friend challenge flow
3. **Plan fix strategy**:
   - Option A: Make friend challenge data match matchmaking format exactly
   - Option B: Add explicit "human vs human" flag/check in game room
   - Option C: Prevent state update loops with debouncing/deduplication
4. **Add comprehensive logging** to diagnose exact spawn frequency
5. **Test with real friend challenge** to confirm diagnosis

## Open Questions

1. Does `aiOpponent: undefined` vs `aiOpponent: null` cause different server behavior?
2. Is there any code path where receiving opponent state triggers own state sync?
3. Do both players' game loops start simultaneously or is there a race?
4. What's the actual message frequency during a broken friend challenge?
