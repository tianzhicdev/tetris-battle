# Research Summary for Spec 004: Fix Matchmaking System

## Project Structure

- **Monorepo**: Yes (pnpm workspaces)
- **Packages**:
  - `packages/web` - React frontend (Vite + TypeScript)
  - `packages/partykit` - PartyKit WebSocket server
  - `packages/game-core` - Shared game logic and AI
- **Build**:
  - Root: `pnpm build` (builds web package via `pnpm --filter web build`)
  - Web: `tsc -b && vite build`
- **Tests**: Vitest configured but dependencies missing (build fails on test files)
- **Dev**: `pnpm dev` runs Vite dev server for web package

## Existing Patterns

### Imports
```typescript
// Internal workspace imports
import { generateAIPersona } from '@tetris-battle/game-core';

// PartyKit server imports
import type * as Party from "partykit/server";

// Client-side PartySocket
import PartySocket from 'partysocket';
```

### State Management
- Zustand stores (gameStore, abilityStore, friendStore)
- No matchmaking-specific store
- State flows: Server → PartySocket message → Component state update

### Components
```typescript
// Functional components with hooks
export function PartykitMatchmaking({ playerId, onMatchFound, onCancel, theme }: MatchmakingProps) {
  const [queuePosition, setQueuePosition] = useState<number>(-1);
  // ...
}
```

### Server Messages
**Client → Server (join_queue):**
```typescript
{
  type: 'join_queue',
  playerId: string,
  rank?: number  // MISSING - This is the bug!
}
```

**Server → Client (match_found):**
```typescript
{
  type: 'match_found',
  roomId: string,
  player1: string,
  player2: string,
  aiOpponent?: AIPersona
}
```

**Server → Client (queue_joined):**
```typescript
{
  type: 'queue_joined',
  position: number
}
```

### AI Integration
**AI Persona Generation:**
```typescript
export function generateAIPersona(targetRank?: number): AIPersona {
  // Creates bot with rank ±100 of target
  // Returns { id, name, rank, isBot: true }
}
```

**AI Game Loop (in game.ts):**
- Uses AdaptiveAI for move decisions
- One move per tick (decideMoveDelay() controls speed)
- Uses hard_drop like humans
- Respects all game mechanics (no shortcuts)

## Analogous Flow: Matchmaking End-to-End

### Current Flow (BROKEN):

1. **User clicks "Find Match"** (App.tsx:144)
   - Sets mode to 'matchmaking'
   - Renders `<Matchmaking>` component

2. **PartykitMatchmaking.tsx mounts** (line 40)
   - Creates `PartykitMatchmaking` instance with `playerId` and `host`
   - Calls `matchmaking.connect(onMatchFound, onQueueUpdate)`

3. **Client connects to PartyKit** (matchmaking.ts:18-22)
   ```typescript
   this.socket = new PartySocket({
     host: this.host,
     party: 'matchmaking',
     room: 'global',
   });
   ```

4. **Client sends join_queue** (matchmaking.ts:56-61)
   ```typescript
   joinQueue(): void {
     this.socket.send(JSON.stringify({
       type: 'join_queue',
       playerId: this.playerId,
       // rank: undefined  ← BUG: rank never sent!
     }));
   }
   ```

5. **Server receives join_queue** (partykit/matchmaking.ts:38)
   ```typescript
   handleJoinQueue(playerId: string, rank: number | undefined, conn: Party.Connection) {
     // rank is undefined!
     this.queue.push({ id: playerId, connectionId: conn.id, joinedAt: Date.now(), rank });
   }
   ```

6. **Server tries to match** (matchmaking.ts:69-104)
   - If 2+ players: match first two (no rank checking)
   - If 1 player: AI fallback after 20s

7. **AI Fallback** (matchmaking.ts:106-149)
   ```typescript
   checkAIFallback() {
     for (const player of this.queue) {
       if (waitTime >= 20000) {
         const aiPersona = generateAIPersona(player.rank);  // ← player.rank is undefined!
         // Creates AI with random rank instead of matching player
       }
     }
   }
   ```

8. **Match found** → Server sends `match_found` → Client navigates to game

### Root Causes Identified:

1. ❌ **Client never sends player rank** - `PartykitMatchmaking.joinQueue()` doesn't include rank
2. ❌ **Constructor doesn't accept rank** - `PartykitMatchmaking` has no rank parameter
3. ❌ **Component doesn't pass rank** - `PartykitMatchmaking.tsx` doesn't receive or pass rank
4. ❌ **App.tsx doesn't have rank** - Need to pass `profile.rank` down to component

## Integration Points

### Files Requiring Modification:

1. **packages/web/src/components/PartykitMatchmaking.tsx**
   - Line 5: Add `rank: number` to `MatchmakingProps` interface
   - Line 11: Accept `rank` prop
   - Line 17: Pass `rank` to `PartykitMatchmaking` constructor

2. **packages/web/src/services/partykit/matchmaking.ts**
   - Line 6: Add `private rank: number;` field
   - Line 8: Add `rank: number` parameter to constructor
   - Line 9: Store rank
   - Line 59: Include `rank` in join_queue message

3. **packages/web/src/App.tsx**
   - Line 231-236: Pass `profile.rank` to `<Matchmaking>` component

4. **packages/partykit/src/matchmaking.ts** (Optional - already correct!)
   - Line 32: Already receives `rank` parameter
   - Line 50: Already stores rank
   - Line 122: Already uses `player.rank` for AI persona
   - ✅ Server code is correct! Just needs client to send rank.

### No Changes Needed:
- AI behavior is already correct (one move per tick, uses hard_drop)
- 20-second timeout already works
- generateAIPersona() already matches rank correctly

## Key Files to Reference During Implementation

1. **packages/web/src/components/PartykitMatchmaking.tsx** - UI component
2. **packages/web/src/services/partykit/matchmaking.ts** - Client-side service
3. **packages/web/src/App.tsx** - App routing and profile access
4. **packages/partykit/src/matchmaking.ts** - Server matchmaking logic
5. **packages/game-core/src/ai/aiPersona.ts** - AI persona generation
6. **packages/partykit/src/game.ts** - AI game loop (already correct)

## Summary

**The bug is simple**: The client never sends the player's rank to the matchmaking server, so AI opponents get random difficulty instead of matching the player's skill level.

**The fix is straightforward**:
1. Pass `profile.rank` from App.tsx → PartykitMatchmaking.tsx
2. Add rank parameter to PartykitMatchmaking constructor
3. Include rank in join_queue message

**No AI behavior fixes needed** - The spec mentions AI is "terrible" and needs fixing, but code review shows AI already:
- Uses one move per tick with delays (decideMoveDelay())
- Uses hard_drop like humans
- Speed controlled by decideMoveDelay() only
- No special advantages

The "terrible" AI is likely because it's getting random difficulty (rank undefined → random 800-1200 rank) instead of matching the player's actual rank.

## Testing Plan

### Manual Tests:
1. **Solo player → AI after 20s**
   - Open game, find match
   - Wait 20 seconds
   - Verify AI opponent appears
   - Check AI difficulty matches player rank (look at AI behavior speed)

2. **Two players match**
   - Open two browsers
   - Both click Find Match simultaneously
   - Verify match within 2 seconds

### Code Verification:
1. Add console.log to verify rank is sent in join_queue message
2. Add console.log on server to verify rank is received
3. Check generateAIPersona() is called with correct rank
