# Debug Guide: Friend Challenge Gameplay Latency

## Problem
Gameplay during friend challenges has high latency throughout the game, but matchmaking games are smooth.

## Hypothesis: Possible Causes

### 1. PartyKit Server Cold Start
**Theory**: Friend challenge rooms might trigger PartyKit cold starts more frequently than matchmaking rooms.

**Test**:
```javascript
// Add to ServerAuthMultiplayerGame.tsx useEffect line 379
console.log('[GAME] Connecting to PartyKit game room:', roomId);
console.log('[GAME] Connection start time:', Date.now());

// Add to ServerAuthGameClient.ts line 83-86
this.socket.addEventListener('open', () => {
  const connectionTime = Date.now() - startTime; // Need to capture startTime before socket creation
  console.log(`[SERVER-AUTH] Connected to game room: ${this.roomId} in ${connectionTime}ms`);
});
```

**What to look for**:
- Friend challenge connection time: > 500ms = cold start
- Matchmaking connection time: < 100ms = warm server

---

### 2. RoomId Format Causing Routing Issues
**Theory**: Different roomId formats might route to different PartyKit regions/instances.

**Matchmaking roomId**: `game_1739733600000_abc123xyz`
**Friend challenge roomId**: `game_1739733600_a1b2c3d4` (8-char MD5 hash)

**Test**:
Check if PartyKit is routing based on roomId hash. If friend challenge roomIds consistently route to a distant data center, that would add latency.

```bash
# Check PartyKit server location from browser console
console.log('PartyKit host:', import.meta.env.VITE_PARTYKIT_HOST);
```

---

### 3. Game Server Hibernation
**Check**: Is game server configured to hibernate?

**Location**: `packages/partykit/src/game.ts`

If game server has `hibernate: true`, friend challenge rooms might hibernate between player actions, causing lag.

---

### 4. Network Path Differences
**Theory**: Friend challenges might have extra network hops.

**Matchmaking flow**:
```
Client → PartyKit matchmaking → Create game room → Client connects to game room
```

**Friend challenge flow**:
```
Client A → Supabase → Accept → Supabase returns roomId → Client connects to game room
Client B → Supabase Realtime → Get roomId → Client connects to game room
```

**Potential issue**: If clients are connecting to game room from different network states or with different connection properties, PartyKit might handle them differently.

---

### 5. React State Management Overhead
**Theory**: Friend challenge games have more React state subscriptions or re-renders.

**Test**:
```javascript
// Add to ServerAuthMultiplayerGame.tsx line 384 (state update handler)
const updateStart = performance.now();
setYourState(state.yourState);
setOpponentState(state.opponentState);
const updateEnd = performance.now();
console.log('[GAME] State update took:', updateEnd - updateStart, 'ms');
```

**What to look for**:
- If > 16ms consistently = React re-render bottleneck
- Compare friend challenge vs matchmaking

---

### 6. Supabase Realtime Connection Interference
**Theory**: Having Supabase Realtime channel open during gameplay might interfere with WebSocket bandwidth.

**Test**:
Check browser DevTools → Network → WS to see how many WebSocket connections are active:
- PartyKit game connection
- PartyKit presence connection
- Supabase Realtime connection(s)

**Potential issue**: Multiple WebSocket connections competing for bandwidth, causing packet delays.

---

### 7. PartyKit Game Server Load
**Theory**: Friend challenge game rooms might be on a more loaded PartyKit instance.

**Test**:
```bash
# Check PartyKit server logs during both game types
npx partykit tail --party game

# Look for:
# - CPU/memory warnings
# - Message queue delays
# - Connection count
```

---

## Debugging Steps

### Step 1: Add Latency Logging

**In `packages/web/src/services/partykit/ServerAuthGameClient.ts`**, add latency tracking:

```typescript
// After line 69 (constructor)
private inputStartTimes: Map<number, number> = new Map();
private stateUpdateLatencies: number[] = [];

// In sendInput method (around line 200)
sendInput(input: PlayerInputType, seq: number): void {
  this.inputStartTimes.set(seq, Date.now());
  this.send({
    type: 'player_input',
    playerId: this.playerId,
    input,
    seq,
  });
}

// In onMessage handler (around line 102)
if (data.type === 'state_update') {
  const latency = Date.now() - data.timestamp;
  this.stateUpdateLatencies.push(latency);

  // Log every 10 updates
  if (this.stateUpdateLatencies.length === 10) {
    const avg = this.stateUpdateLatencies.reduce((a, b) => a + b) / 10;
    console.log('[LATENCY] Avg state update latency (last 10):', avg, 'ms');
    this.stateUpdateLatencies = [];
  }

  onStateUpdate(data);
}

// For input confirmation
if (data.type === 'input_confirmed') {
  const seq = data.seq;
  const startTime = this.inputStartTimes.get(seq);
  if (startTime) {
    const roundTripTime = Date.now() - startTime;
    console.log('[LATENCY] Input round-trip time:', roundTripTime, 'ms');
    this.inputStartTimes.delete(seq);
  }
}
```

### Step 2: Compare Logs

**Test both game modes**:
1. Play matched game → Record latency logs
2. Play friend challenge → Record latency logs
3. Compare:
   - Average state update latency
   - Input round-trip time
   - Connection time

### Step 3: Check Browser DevTools

**Network tab → WS**:
- Count active WebSocket connections
- Check frame sizes
- Look for connection errors/reconnects

**Performance tab**:
- Record during gameplay
- Check for long tasks (> 50ms)
- Check React render times

### Step 4: Test with Single WebSocket

**Temporarily close Supabase Realtime** during friend challenge game:

```typescript
// In App.tsx, add cleanup before game starts
useEffect(() => {
  if (mode === 'multiplayer') {
    // Unsubscribe from Supabase Realtime during game
    supabase.removeAllChannels();
  }
}, [mode]);
```

**Test if latency improves** → Confirms WebSocket interference.

---

## Expected Results

### If Matchmaking is 50ms and Friend Challenge is 500ms:

| Symptom | Likely Cause |
|---------|--------------|
| Connection time > 500ms | PartyKit cold start |
| State update latency 10x higher | Network routing issue or server load |
| Input round-trip > 200ms | WebSocket interference or bandwidth issue |
| Consistent 100-200ms overhead | Extra Supabase Realtime connection |
| Spiky latency (varies 50-1000ms) | Server hibernation or cold start |

---

## Quick Tests to Run Now

### Test 1: Log Connection Time
```javascript
// Browser console during friend challenge
const connectStart = Date.now();
// (wait for game to load)
// Check console for "[SERVER-AUTH] Connected to game room"
// Calculate: connection time = logged time - connectStart
```

### Test 2: Check Active WebSockets
```javascript
// Browser DevTools → Network → WS tab
// Count connections during:
// - Matchmaking game: Should see 1-2 connections
// - Friend challenge: Should see 1-2 connections (if more = problem)
```

### Test 3: Measure Input Lag
```javascript
// During gameplay, press a key and count milliseconds until piece moves
// Do this 10 times for each game mode
// Average and compare
```

---

## Most Likely Causes (Ranked)

1. **Supabase Realtime connection staying open during gameplay** (90% probability)
   - Extra WebSocket competing for bandwidth
   - Browser WebSocket connection limits

2. **PartyKit game server cold start for friend challenge rooms** (70% probability)
   - Fresh room = cold start
   - Matchmaking reuses warm rooms more frequently

3. **Different network path/routing for friend challenge roomIds** (40% probability)
   - RoomId hash might route to different region
   - Less likely but possible

4. **React state management overhead** (20% probability)
   - More re-renders during friend challenges
   - Less likely to cause consistent latency

Run the tests above and report the latency numbers for both game modes!
