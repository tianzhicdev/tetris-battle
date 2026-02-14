# Spec 005: Fix Friend Challenge Rapid Tetromino Bug

## Status
🔴 **CRITICAL BUG** - Friend challenges completely unplayable

## Problem

### Current Behavior
When one friend challenges another:
- New tetrominos spawn and replace each other repeatedly
- Happens many times per second (20-30+ times/sec)
- Game board flickers/updates constantly
- Completely unplayable

### Expected Behavior
- Friend challenge creates normal game
- Tetrominos spawn at normal rate (~1 per 3-5 seconds)
- Game plays exactly like random matchmaking
- Smooth, playable experience

## Root Cause Investigation

### Likely Causes
1. **State sync loop**: Both clients updating each other infinitely
2. **Spawn logic duplicate**: Both server and client spawning pieces
3. **Missing piece lock**: No mechanism to prevent rapid respawns
4. **Event broadcast loop**: Events triggering more events
5. **PartyKit room issue**: Friend room vs matchmaking room handling different

### Relevant Files
- `packages/web/src/components/FriendsList.tsx` - Friend challenge UI
- `packages/web/src/services/partykit/gameSync.ts` - Game state sync
- `packages/partykit/src/game.ts` - Server-side game logic
- `packages/partykit/src/matchmaking.ts` - Room creation
- `packages/web/src/components/PartykitMultiplayerGame.tsx` - Game component

### Debug Questions
1. Does random matchmaking work fine? (isolates friend-specific issue)
2. Are both clients sending spawn events?
3. Is server spawning pieces AND clients also spawning?
4. Are there duplicate WebSocket connections?
5. What's the event frequency in logs?

## Requirements

### 1. Friend Challenge Flow
- [ ] Challenger sends challenge to friend
- [ ] Friend accepts challenge
- [ ] PartyKit room created (same as matchmaking)
- [ ] Both players connect to room
- [ ] Game starts with normal spawn rate
- [ ] Only ONE source of truth for piece spawns

### 2. State Synchronization
- [ ] Server is authoritative for piece spawns
- [ ] Clients only send player actions (move, rotate, drop)
- [ ] Server broadcasts state updates
- [ ] No client-to-client direct updates
- [ ] Prevent infinite update loops

### 3. Spawn Logic
**CRITICAL**: Only ONE entity should spawn pieces
- [ ] Option A: Server spawns, clients render
- [ ] Option B: Each client spawns own pieces, server validates
- [ ] NO: Both server AND client spawning same pieces
- [ ] Spawn rate: Normal gravity interval (~1-3 seconds per piece)

## Architecture Decision

### Current Architecture (Needs Verification)
```
Client 1 ←→ PartyKit Server ←→ Client 2
```

**Who spawns pieces?**
- Random match: ?
- Friend challenge: ? (possibly both = bug)

### Expected Architecture
```
SERVER AUTHORITATIVE:
- Server spawns all pieces
- Server validates all moves
- Clients are view-only + input

OR

CLIENT AUTHORITATIVE:
- Each client manages own pieces
- Server only relays opponent state
- No server-side piece spawning
```

## Acceptance Criteria

### Scenario 1: Friend Challenge Playable
```
GIVEN two friends (Alice and Bob)
WHEN Alice challenges Bob and Bob accepts
THEN game starts normally
AND tetrominos spawn every 1-3 seconds per player
AND game is smooth and playable
AND NO rapid flickering or respawning
```

### Scenario 2: Same as Random Match
```
GIVEN friend challenge game
WHEN playing
THEN behavior is identical to random matchmaking
AND no performance difference
AND no visual glitches
```

### Scenario 3: Multiple Challenges
```
GIVEN 3 friend pairs challenging simultaneously
WHEN all games start
THEN all games are playable
AND no crosstalk between games
AND each game isolated in own room
```

## Implementation Plan

### Phase 1: Diagnose Root Cause
1. Add extensive logging to:
   - Piece spawn events
   - State update events
   - WebSocket messages
2. Compare random match vs friend challenge logs
3. Identify duplicate spawn sources
4. Check for event loops

### Phase 2: Fix Spawn Logic
1. Choose architecture (server or client authoritative)
2. Remove duplicate spawn sources
3. Add debouncing/throttling if needed
4. Ensure single source of truth

### Phase 3: Fix State Sync
1. Prevent infinite update loops
2. Add event deduplication
3. Throttle state broadcasts if needed
4. Validate room isolation

### Phase 4: Test Edge Cases
1. Challenge during active game
2. Disconnect/reconnect during challenge
3. Multiple simultaneous challenges
4. Challenge expiry/decline flows

## Testing

### Manual Test Cases
1. **Basic Challenge**: Friend challenges → accept → play full game
2. **Compare to Random**: Verify identical behavior to matchmaking
3. **Rapid Challenge**: Send 5 challenges quickly → all work
4. **Network Test**: Slow connection, packet loss scenarios

### Performance Metrics
- [ ] Piece spawn rate: 1-3 seconds (not 20-30 per second!)
- [ ] State update frequency: <10 per second per player
- [ ] WebSocket message rate: <100 messages/second total
- [ ] Frame rate: Stable 60fps, no flickering

## Success Metrics
- [ ] Friend challenges load and play normally
- [ ] Tetromino spawn rate matches solo/random games
- [ ] No flickering or rapid replacement
- [ ] Performance identical to random matchmaking
- [ ] Zero complaints about unplayability

## Notes
- Priority: CRITICAL - friend challenges are core feature
- Likely easier to fix than matchmaking (isolated to one flow)
- May reveal broader state sync issues
- Could affect random matchmaking too if root cause is shared
