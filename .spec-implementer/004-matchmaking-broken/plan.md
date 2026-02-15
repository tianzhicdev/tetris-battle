# Implementation Plan for Spec 004: Fix Matchmaking System

## Overview
- Total steps: 4
- Estimated new files: 0
- Estimated modified files: 3
- Core issue: Client doesn't send player rank to matchmaking server
- Fix complexity: Low (simple parameter threading)

## Steps

### Step 1: Add rank parameter to PartykitMatchmaking class

**Files to modify:**
- `packages/web/src/services/partykit/matchmaking.ts`

**Implementation details:**

In `packages/web/src/services/partykit/matchmaking.ts`:

1. Add a new private field after line 6:
   ```typescript
   private rank: number;
   ```

2. Update the constructor signature on line 8 to accept rank:
   ```typescript
   constructor(playerId: string, host: string, rank: number) {
     this.playerId = playerId;
     this.host = host;
     this.rank = rank;
   }
   ```

3. In the `joinQueue()` method (line 55-61), modify the message to include rank:
   ```typescript
   joinQueue(): void {
     if (this.socket && this.socket.readyState === WebSocket.OPEN) {
       this.socket.send(JSON.stringify({
         type: 'join_queue',
         playerId: this.playerId,
         rank: this.rank,
       }));
     }
   }
   ```

**Test:**
- Manual verification: Add console.log in joinQueue to verify rank is included in message
- Check: `console.log('Sending join_queue with rank:', this.rank);`

**Verify:**
- TypeScript compiles without errors
- Constructor signature change will cause compile error in PartykitMatchmaking.tsx (expected - fixed in Step 2)

---

### Step 2: Pass rank prop to PartykitMatchmaking component

**Files to modify:**
- `packages/web/src/components/PartykitMatchmaking.tsx`

**Implementation details:**

In `packages/web/src/components/PartykitMatchmaking.tsx`:

1. Update the `MatchmakingProps` interface (line 4-9) to include rank:
   ```typescript
   interface MatchmakingProps {
     playerId: string;
     rank: number;
     onMatchFound: (roomId: string, player1Id: string, player2Id: string, aiOpponent?: any) => void;
     onCancel: () => void;
     theme: any;
   }
   ```

2. Destructure rank from props in the function signature (line 11):
   ```typescript
   export function Matchmaking({ playerId, rank, onMatchFound, onCancel, theme }: MatchmakingProps) {
   ```

3. Pass rank to PartykitMatchmaking constructor (line 15-17):
   ```typescript
   const [matchmaking] = useState(() => {
     const host = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';
     return new PartykitMatchmaking(playerId, host, rank);
   });
   ```

**Test:**
- Manual verification: Component should accept rank prop
- TypeScript should compile without errors

**Verify:**
- TypeScript compiles without errors
- Will cause compile error in App.tsx (expected - fixed in Step 3)

---

### Step 3: Pass profile.rank from App.tsx to Matchmaking component

**Files to modify:**
- `packages/web/src/App.tsx`

**Implementation details:**

In `packages/web/src/App.tsx`:

Locate the Matchmaking component rendering (line 230-236) and add the `rank` prop:

```typescript
{mode === 'matchmaking' && (
  <Matchmaking
    playerId={playerId}
    rank={profile.rank}
    onMatchFound={handleMatchFound}
    onCancel={handleCancelMatchmaking}
    theme={currentTheme}
  />
)}
```

**Test:**
- Manual verification: Profile rank should be passed to matchmaking
- Open browser console and verify rank is sent to server

**Verify:**
- TypeScript compiles successfully
- Build succeeds: `pnpm build` (may have test file errors but core should build)
- App runs: `pnpm dev`

---

### Step 4: Verification Testing

**Files to test:**
- All modified files

**Implementation details:**

This step verifies the complete flow works:

1. **Add debug logging** to verify data flow:

   In `packages/web/src/services/partykit/matchmaking.ts` joinQueue():
   ```typescript
   console.log('[MATCHMAKING] Sending join_queue with rank:', this.rank);
   ```

   In `packages/partykit/src/matchmaking.ts` handleJoinQueue() after line 50:
   ```typescript
   console.log('[MATCHMAKING SERVER] Player joined with rank:', rank);
   ```

   In `packages/partykit/src/matchmaking.ts` checkAIFallback() before line 122:
   ```typescript
   console.log('[AI FALLBACK] Creating AI for player rank:', player.rank);
   ```

2. **Manual test - Solo player AI fallback:**
   - Start dev server: `pnpm dev`
   - Open game, click "Find Match"
   - Wait 20 seconds
   - Check console logs:
     - Should see: `[MATCHMAKING] Sending join_queue with rank: <player_rank>`
     - Should see: `[MATCHMAKING SERVER] Player joined with rank: <player_rank>`
     - After 20s: `[AI FALLBACK] Creating AI for player rank: <player_rank>`
   - Verify AI opponent's difficulty seems appropriate (fast AI for high rank, slow for low rank)

3. **Manual test - Two players match:**
   - Open two browser windows/incognito
   - Sign in as different users (or use two different devices)
   - Both click "Find Match"
   - Verify match within 2 seconds
   - Check console for both players joining queue with their ranks

4. **Verify AI behavior:**
   - Match with AI opponent (wait 20s)
   - Observe AI plays piece by piece (not instantly)
   - Verify AI uses hard drops (pieces lock immediately when placed)
   - AI should not have unfair advantages

**Test commands:**
```bash
# Start dev server
pnpm dev

# In another terminal, check PartyKit server logs if running separately
# (or check browser console for client logs)
```

**Verify:**
- [ ] Client sends rank in join_queue message (console log confirms)
- [ ] Server receives rank correctly (console log confirms)
- [ ] AI opponent gets correct rank-based difficulty (console log shows matching rank)
- [ ] Solo player gets AI after 20 seconds
- [ ] Two players can match each other
- [ ] AI plays with same mechanics as humans (one move per tick, hard drop)
- [ ] No stuck matchmaking states

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) | Status |
|---------------|-------------------|--------|
| **Human-to-Human Matching** | | |
| Players in queue can discover each other | Step 4 (testing) | ✅ Already works |
| Match closest rank players (±200) | N/A | ⚠️ Not implemented (spec says current is FIFO) |
| Remove matched players from queue | N/A | ✅ Already works |
| Notify both players of match | N/A | ✅ Already works |
| **AI Fallback** | | |
| Start timer when player joins queue | N/A | ✅ Already works |
| After 20s create AI opponent | N/A | ✅ Already works |
| AI difficulty matches player rank | Steps 1-3 | 🔧 FIXED |
| Player cannot distinguish AI from human | N/A | ✅ Already works |
| **AI Behavior** | | |
| Uses same move execution (one move per tick) | N/A | ✅ Already works |
| Uses hard_drop like humans | N/A | ✅ Already works |
| Speed controlled by decideMoveDelay() | N/A | ✅ Already works |
| No special advantages | N/A | ✅ Already works |
| **Acceptance Criteria** | | |
| Two players match within 2s | Step 4 | ✅ Test manually |
| AI fallback after 20s | Step 4 | ✅ Test manually |
| Rank-based matching (±200) | N/A | ⚠️ Not in scope (FIFO is acceptable per spec comments) |

## Build/Test Commands

```bash
# Build entire project
pnpm build

# Build will fail on test files (vitest not installed) but core app should build
# This is OK - test infrastructure issue, not code issue

# Run dev server
pnpm dev

# Manual testing:
# 1. Open http://localhost:5173 (or configured port)
# 2. Sign in
# 3. Click "Find Match"
# 4. Observe console logs
# 5. Wait 20s or open second browser for testing
```

## Notes

### What This Fix Does:
- ✅ Fixes AI difficulty matching player rank
- ✅ Ensures `generateAIPersona(targetRank)` receives correct rank
- ✅ No changes to AI behavior (already correct)
- ✅ Minimal code changes (3 files, ~10 lines total)

### What This Fix Does NOT Do:
- ❌ Implement rank-based human matchmaking (±200 range)
  - Current: FIFO (first two players match regardless of rank)
  - Spec says this is acceptable for low-population games
  - Future enhancement when player base grows
- ❌ Fix test infrastructure (vitest dependencies)
  - Not related to matchmaking bug
  - Separate issue

### Implementation Risk: LOW
- Simple parameter threading
- No algorithm changes
- No database changes
- Server already handles rank correctly
- Only client was missing the data

### Expected Outcome:
After this fix, solo players will get AI opponents that match their skill level instead of random difficulty.
