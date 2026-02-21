# Tetris Battle - Claude Code Reference

## Project Overview

Tetris Battle is a multiplayer Tetris game with friend challenges, matchmaking, AI opponents, and special abilities.

## Recent Changes: Frontend Refactoring - CSS Modules & Primitives (Feb 2026)

**Implemented**: CSS Modules architecture + primitive component system to replace inline styles and improve performance.

**Problem Solved**: Bundle size was 943KB with 105+ inline style instances creating performance issues (new objects every render).

**New Architecture**: CSS Modules + design token CSS variables + primitive component library.

**Key Changes**:
- Added `styles/variables.css` with all design tokens as CSS custom properties
- Created primitive component library in `components/primitives/`:
  - `Button` - Primary, secondary, ghost, danger variants with framer-motion support
  - `Card` - Default, highlighted, equipped, danger variants
  - `Badge` - Info, success, warning, error, neutral variants
  - `Input` - Standard input with error state
- Migrated UI components to CSS Modules (Panel, Label)
- Added lazy loading for AbilityEffectsDemo and VisualEffectsDemo (~15KB bundle reduction)
- Extended design tokens with spacing, opacity, transition, shadow scales

**Files Created**:
- `packages/web/src/styles/variables.css` - CSS custom properties
- `packages/web/src/components/primitives/Button/*` - Button primitive
- `packages/web/src/components/primitives/Card/*` - Card primitive
- `packages/web/src/components/primitives/Badge/*` - Badge primitive
- `packages/web/src/components/primitives/Input/*` - Input primitive
- `packages/web/src/components/primitives/index.ts` - Barrel export
- `packages/web/src/components/ui/Panel.module.css` - Panel styles
- `packages/web/src/components/ui/Label.module.css` - Label styles

**Files Modified**:
- `packages/web/src/main.tsx` - Import CSS variables
- `packages/web/src/design-tokens.ts` - Added spacing, opacity, transition, shadow scales
- `packages/web/src/components/ui/Panel.tsx` - Migrated to CSS Modules
- `packages/web/src/components/ui/Label.tsx` - Migrated to CSS Modules
- `packages/web/src/components/ui/PrimaryButton.tsx` - Now uses Button primitive (backward compatible)
- `packages/web/src/App.tsx` - Added lazy loading with React.lazy() and Suspense

**Bundle Size Impact**:
- Before: 943KB minified (266KB gzipped)
- After: 929KB minified (263KB gzipped) - ~1.5% reduction
- Code splitting: Separate chunks for AbilityEffectsDemo (7.9KB) and VisualEffectsDemo (8.1KB)

**New Patterns**:

**Using Primitive Components:**
```tsx
import { Button, Card, Badge } from '../primitives';

<Button variant="primary" size="lg" onClick={handleClick}>
  Click me
</Button>

<Card variant="highlighted" padding="default">
  <Badge variant="success">ONLINE</Badge>
  Content here
</Card>
```

**Using CSS Modules:**
```tsx
import styles from './MyComponent.module.css';

export function MyComponent() {
  return <div className={styles.container}>...</div>;
}

// MyComponent.module.css
.container {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}
```

**Using Design Tokens in Code:**
```tsx
import { T } from '../design-tokens';

// For dynamic styles that can't be in CSS modules
<canvas style={{ borderRadius: `${T.radius.md}px` }} />
```

**Future Work** (Phase 2 of refactoring):
- Break down ServerAuthMultiplayerGame.tsx into hooks + components (~3640 lines → ~200 lines)
- Migrate remaining components to CSS Modules
- Further bundle optimization with code splitting
- Increase test coverage

---

## Recent Changes: Friend Challenge System Redesign (Feb 2026)

**Implemented**: Database-first friend challenge architecture replacing dual source-of-truth (PartyKit + Database) with pure Supabase Realtime solution.

**Problem Solved**: Previous system had ~60% challenge success rate due to race conditions from maintaining state in both database and PartyKit memory.

**New Architecture**: Single source of truth (PostgreSQL) with Supabase Realtime subscriptions for instant notifications. Expected >99% success rate.

**Key Files Added**:
- `supabase/migrations/008_friend_challenges_redesign.sql` - Database schema + atomic RPC functions
- `packages/web/src/hooks/useChallenges.ts` - Main integration hook
- `packages/web/src/hooks/useIncomingChallenges.ts` - Realtime subscription for incoming
- `packages/web/src/hooks/useOutgoingChallenges.ts` - Realtime subscription for outgoing
- `packages/web/src/components/ChallengeNotification.tsx` - Incoming challenge UI

**Key Files Modified**:
- `packages/web/src/services/friendService.ts` - New RPC methods (accept/decline/cancel)
- `packages/web/src/stores/friendStore.ts` - New actions with optimistic updates
- `packages/web/src/App.tsx` - Removed PartyKit challenge logic, integrated useChallenges hook

**Testing Status**: TypeScript compiles. Manual testing pending (requires database migration). Unit tests not yet written.

**Stack:**
- Frontend: React + TypeScript + Vite
- Backend: PartyKit (WebSocket-based multiplayer)
- Database: Supabase
- State Management: Zustand
- Testing: Vitest
- Package Manager: pnpm (workspaces)

**Debug Mode:**
- Accessible via URL parameter: `?debug=true`
- Keyboard shortcut: `Ctrl+Shift+D` to toggle panel
- Provides events log, network stats, ability triggers, and state inspector
- Bypasses star cost for ability testing

## Architecture

### Monorepo Structure
```
packages/
├── web/               # React client application
├── partykit/          # PartyKit server (multiplayer rooms)
└── game-core/         # Shared game logic
```

### Game Architecture: SERVER-AUTHORITATIVE (New) / CLIENT-AUTHORITATIVE (Legacy)

**New Architecture (Server-Authoritative):**
- Server runs game loop for BOTH players
- Server validates all inputs (move, rotate, drop)
- Server calculates score, line clears, combos, abilities
- Server broadcasts authoritative state to clients at 60fps (throttled)
- Clients send inputs only (keyboard/touch events)
- Clients render what server sends (no local game logic)
- Enable with URL flag: `?serverAuth=true`
- Deterministic piece generation using seeded RNG (same seed = same pieces for both players)
- Prevents cheating (client can't manipulate score/stars/pieces)

**Legacy Architecture (Client-Authoritative):**
- Each client runs its own game loop (spawns pieces, applies gravity, handles input)
- Server acts as a RELAY for opponent state (not authoritative)
- AI opponents are the exception: server runs their game loop
- Default mode (no URL flag)

This means:
- Human vs Human (new): Server runs both game loops, validates inputs, broadcasts state
- Human vs Human (legacy): Both clients run independent game loops, sync state via server
- Human vs AI (both modes): Server runs AI loop, client runs human loop (legacy) or sends inputs (new)

### PartyKit Parties

From `packages/partykit/partykit.json`:
- **`matchmaking`** (`src/matchmaking.ts`): Queue management, player matching, AI fallback
- **`game`** (`src/game.ts`): Game room logic, state relay, AI opponent management
- **`presence`** (`src/presence.ts`): Online status, friend challenges

### Message Flow

#### Random Matchmaking (Server-Authoritative Mode):
1. Client → matchmaking party: `join_queue`
2. Server matches players or creates AI opponent
3. Server → clients: `match_found` (with roomId, player IDs, aiOpponent if applicable)
4. Clients connect to game party with roomId
5. Clients → game party: `join_game`
6. Server → clients: `game_start`
7. During game:
   - Client → server: `player_input` (move_left, move_right, rotate_cw, hard_drop, etc.)
   - Server validates input, updates ServerGameState
   - Server → both clients: `state_update` (yourState, opponentState) at 60fps
   - Client → server: `ability_activation` (when player uses ability)
   - Server validates stars, deducts cost, applies ability to opponent's ServerGameState

#### Random Matchmaking (Legacy Client-Authoritative Mode):
1. Client → matchmaking party: `join_queue`
2. Server matches players or creates AI opponent
3. Server → clients: `match_found` (with roomId, player IDs, aiOpponent if applicable)
4. Clients connect to game party with roomId
5. Clients → game party: `join_game`
6. Server → clients: `game_start`
7. During game: Client → server: `game_state_update`, Server → opponent: `opponent_state_update`

#### Friend Challenges:
1. Client A → presence party: `friend_challenge`
2. Server → Client B: `friend_challenge_received`
3. Client B → presence party: `friend_challenge_accept`
4. Server → both clients: `friend_challenge_accepted` (with roomId)
5. Rest of flow identical to matchmaking (connect to game party, etc.)

## Recent Changes: Fix Friend Challenge Rapid Tetromino Bug (Spec 005)

### Problem
Friend challenges caused tetrominos to spawn 20-30+ times per second, making games unplayable.

### Root Cause
State sync loop between two human clients:
- Both clients run game loops
- Game state changes trigger sync useEffect
- useEffect watched entire `gameState` object reference
- Any state change (even unrelated fields) triggered sync
- Receiving opponent updates potentially modified local state
- This created exponential message growth

### Solution
Three-layer fix to prevent sync loops:
1. **Debouncing**: Limit state syncs to max once per 100ms (10/sec cap)
2. **State Hashing**: Only sync when meaningful state actually changes (board, score, etc.)
3. **Precise Dependencies**: useEffect depends on specific fields, not whole object
4. **Safety Guards**: Prevent game loop from starting multiple times

### Files Modified

#### 1. `packages/web/src/services/partykit/gameSync.ts`
- Added `lastSyncTime` and `minSyncInterval` fields
- Modified `updateGameState()` to check debounce before sending
- Added `getDebugInfo()` method for diagnostics

```typescript
// Debouncing logic:
const now = Date.now();
if (now - this.lastSyncTime < this.minSyncInterval) {
  return; // Skip this sync
}
this.lastSyncTime = now;
```

#### 2. `packages/web/src/components/PartykitMultiplayerGame.tsx`
- Added `lastSyncedStateRef` to track last synced state hash
- Replaced state sync useEffect (line 163-209):
  - Creates JSON hash of sync-relevant fields only
  - Compares hash to previous sync
  - Only triggers sync if hash changed
  - Uses specific dependencies instead of whole `gameState`
- Added game loop double-start guard (line 239):
  - Checks `!gameLoopRef.current` before starting loop
  - Adds `[GAME LOOP]` logging for diagnostics

```typescript
// State hashing approach:
const currentStateHash = JSON.stringify({
  board: gameState.board.grid,
  score: gameState.score,
  stars: gameState.stars,
  linesCleared: gameState.linesCleared,
  comboCount: gameState.comboCount,
  isGameOver: gameState.isGameOver,
});

if (currentStateHash === lastSyncedStateRef.current) {
  return; // No change, skip sync
}
```

#### 3. `packages/partykit/src/game.ts`
- Added `messageCounters` Map to track message frequency per player
- Added `trackMessage()` private method (line 71-90):
  - Counts messages per player per second
  - Logs warning if >10 messages/sec (indicates possible loop)
- Added tracking call in `handleGameStateUpdate()` (line 311)
- Added detailed logging on game start (line 153-158)

```typescript
// Message frequency tracking:
private trackMessage(playerId: string, messageType: string): void {
  // Reset counter every second
  if (now - counter.lastReset >= 1000) {
    if (counter.count > 10) {
      console.warn(`[GAME] Player ${playerId} sent ${counter.count} ${messageType} messages in 1 second (possible loop!)`);
    }
    counter.count = 0;
    counter.lastReset = now;
  }
  counter.count++;
}
```

### Files Created

#### 1. `packages/web/src/__tests__/friendChallengeFlow.test.ts`
Integration tests for friend challenge state management:
- Test outgoing challenge creation
- Test incoming challenge reception
- Test challenge clearing

All 3 tests passing.

### New Patterns

**State Sync Pattern:**
When syncing state between clients via server:
1. Use state hashing to detect actual changes
2. Depend on specific state fields, not whole objects
3. Add debouncing to cap sync frequency
4. Add server-side tracking to detect loops

**Debugging Pattern:**
- Client logs: `[SYNC]` prefix for state sync events
- Client logs: `[GAME LOOP]` prefix for game loop lifecycle
- Server logs: `[GAME]` prefix for game room events
- Server warnings for message frequency >10/sec

### Testing

**Run tests:**
```bash
pnpm --filter web test                    # All web tests (30 passing)
pnpm --filter web test friendChallenge    # Friend challenge tests only
```

**Build:**
```bash
pnpm --filter web build                   # Web client build
pnpm build:all                            # All packages (from root)
```

**Dev mode:**
```bash
pnpm dev                                  # Start dev server
```

### Manual Verification Checklist

After deploying changes:
1. Two users challenge each other via friend list
2. Accept challenge and observe:
   - Game starts smoothly (no errors)
   - Pieces spawn at normal rate (~1 per 3-5 seconds)
   - No flickering or rapid respawning
   - Browser console shows ~1 sync per second (use sync counter script)
   - Server logs show no message frequency warnings
3. Compare friend challenge game feel to random matchmaking (should be identical)

**Sync Counter Script** (paste in browser console):
```javascript
let syncCount = 0;
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
  const msg = JSON.parse(data);
  if (msg.type === 'game_state_update') syncCount++;
  return originalSend.call(this, data);
};
setInterval(() => {
  console.log('Syncs in last second:', syncCount);
  if (syncCount > 15) console.error('SYNC LOOP DETECTED!');
  syncCount = 0;
}, 1000);
```

## Key Files

### Game Core
- `packages/game-core/src/engine.ts` - Core Tetris logic (piece movement, line clearing)
- `packages/game-core/src/types.ts` - Type definitions
- `packages/game-core/src/abilities.ts` - Special ability definitions
- `packages/game-core/src/SeededRandom.ts` - **NEW:** Deterministic RNG for server-authoritative mode
- `packages/game-core/src/inputTypes.ts` - **NEW:** Input types for server-authoritative protocol

### Web Client (Legacy Client-Authoritative)
- `packages/web/src/App.tsx` - Main app, routing, challenge orchestration, feature flag
- `packages/web/src/components/PartykitMultiplayerGame.tsx` - **LEGACY:** Client-authoritative multiplayer game component
- `packages/web/src/components/FriendList.tsx` - Friend list UI
- `packages/web/src/services/partykit/gameSync.ts` - **LEGACY:** Game state synchronization (client-auth mode)
- `packages/web/src/services/partykit/matchmaking.ts` - Matchmaking client
- `packages/web/src/services/partykit/presence.ts` - Presence & challenges client
- `packages/web/src/stores/gameStore.ts` - **LEGACY:** Game state (Zustand) - not used in server-auth mode
- `packages/web/src/stores/friendStore.ts` - Friend & challenge state (Zustand)

### Web Client (New Server-Authoritative)
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - **NEW:** Server-authoritative game component
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` - **NEW:** Input handler for server-auth mode

### PartyKit Server
- `packages/partykit/src/matchmaking.ts` - Matchmaking party server
- `packages/partykit/src/game.ts` - Game room party server (supports both modes)
- `packages/partykit/src/ServerGameState.ts` - **NEW:** Server-side game state manager
- `packages/partykit/src/presence.ts` - Presence party server

## Common Tasks

### Ability System Overview

**20 Abilities Total** (as of Spec 007):
- **8 Buffs**: cascade_multiplier, deflect_shield, piece_preview_plus, cross_firebomb, circle_bomb, clear_rows, mini_blocks, fill_holes
- **12 Debuffs**: speed_up_opponent, reverse_controls, rotation_lock, blind_spot, screen_shake, shrink_ceiling, random_spawner, gold_digger, earthquake, death_cross, row_rotate, weird_shapes

**Key Implementations:**
- `cascade_multiplier`: Doubles stars on line clears (gameStore.ts:242)
- `deflect_shield`: Blocks next incoming debuff (PartykitMultiplayerGame.tsx:484)
- `reverse_controls`: Swaps left/right inputs (client: line 803, server: ServerGameState.ts:83)
- `rotation_lock`: Blocks rotation inputs (client: line 834, server: ServerGameState.ts:70)
- `random_spawner`/`gold_digger`: Periodic triggers every 2s (PartykitMultiplayerGame.tsx:774, 786)

**Durations** (updated Spec 007):
- speed_up_opponent: 10s, reverse_controls: 8s, rotation_lock: 5s
- blind_spot: 6s, shrink_ceiling: 8s, cascade_multiplier: 15s

### Adding a New Ability

1. **Define in `packages/game-core/src/abilities.json`:**
```json
{
  "new_ability": {
    "id": "new_ability",
    "type": "new_ability",
    "name": "Ability Name",
    "shortName": "SHORT",
    "description": "What it does",
    "cost": 50,
    "duration": 10000,
    "category": "buff",
    "unlockLevel": 1,
    "unlockCost": 0
  }
}
```

2. **Add to type union in `packages/game-core/src/types.ts`:**
```typescript
export type AbilityType =
  | 'existing_ability'
  | 'new_ability'  // Add here
  | ...;
```

3. **Implement effect in `packages/game-core/src/abilityEffects.ts` (if instant board effect):**
```typescript
export function applyNewAbility(board: Board): Board {
  const newGrid = board.grid.map(row => [...row]);
  // ... modify newGrid
  return { ...board, grid: newGrid };
}
```

4. **Handle in client `PartykitMultiplayerGame.tsx`:**
   - For buffs: Add case in `handleAbilityActivate` (~line 396)
   - For debuffs: Add case in `handleAbilityReceived` (~line 493)

5. **Handle in server `ServerGameState.ts`** (line 203+):
```typescript
case 'new_ability':
  this.gameState.board = applyNewAbility(this.gameState.board);
  break;
```

### Debugging Multiplayer Issues
1. Check browser console for `[SYNC]` and `[GAME LOOP]` logs
2. Check server logs (PartyKit) for `[GAME]` messages and warnings
3. Use sync counter script (above) to measure message frequency
4. Compare behavior between random matchmaking (working) and friend challenges

### Modifying Game Loop

**Legacy Client-Authoritative Mode:**
The game loop is in `PartykitMultiplayerGame.tsx` (line 222-251):
- Base tick rate: 1000ms (1 second)
- Abilities can modify tick rate (e.g., speed_up_opponent)
- Each tick calls `tick()` from gameStore
- State changes trigger sync to server (debounced to 100ms intervals)

**New Server-Authoritative Mode:**
The game loop is in `packages/partykit/src/game.ts` (startGameLoop method):
- Server runs separate game loop for each player
- Base tick rate: 1000ms (1 second)
- Server-side ServerGameState processes tick
- State broadcasted to clients at 60fps (16ms throttle)
- Client has NO game loop (only renders server state)

## Architecture Decisions

### Why Server-Authoritative (New Architecture)?
- **Anti-cheat:** Server validates all inputs, calculates score/stars server-side
- **Fairness:** Deterministic piece generation ensures identical experience
- **Consistency:** Single source of truth prevents desyncs
- **Future-proof:** Enables competitive ranked mode, tournaments
- **Tradeoff:** Slightly higher latency (input must roundtrip to server)

### Why Client-Authoritative (Legacy Architecture)?
- **Low latency:** No need to wait for server for piece movement
- **Simple architecture:** Server just relays state
- **Works offline:** Could add single-player mode easily
- **Tradeoff:** Vulnerable to client manipulation (acceptable for casual play)

### Migration Strategy
Both architectures coexist:
- **Feature flag:** `?serverAuth=true` enables new mode
- **Gradual rollout:** Test server-auth with subset of users
- **Safe fallback:** Legacy mode remains default until server-auth proven stable
- **Future:** Once server-auth validated, make it default (remove flag)

### When to Use Each Mode?
- **Server-Authoritative (new):** Ranked matches, tournaments, competitive play
- **Client-Authoritative (legacy):** Casual play, friend matches, testing

## Debug Panel (Spec 008)

### Overview
Development tool for testing and debugging multiplayer features. Provides visibility into server events, network performance, ability testing, and state inspection.

### Activation
- **URL Parameter:** `?debug=true`
- **Keyboard Shortcut:** `Ctrl+Shift+D` (toggles panel on/off)
- **Persistence:** Panel position saved to localStorage

### Features

**Events Log:**
- Real-time WebSocket message log (incoming ↓ / outgoing ↑)
- Timestamps with millisecond precision
- Color coding by message type
- Expandable rows to view full JSON payload
- Filter by message type
- Export to JSON file
- Keyboard shortcut: `Ctrl+Shift+L` to clear

**Network Stats:**
- RTT (Round-Trip Time) measurement via ping/pong
- Average/min/max RTT tracking
- Connection status indicator
- Ping test button (`Ctrl+Shift+P`)

**Ability Triggers:**
- Instant activation of any ability (bypasses star cost)
- All 20 abilities available (not just loadout)
- Target selector: Self / Opponent
- Works in both server-auth and legacy modes

**Game State Inspector:**
- View your board state as JSON
- View opponent board state as JSON
- Copy to clipboard
- Active effects viewer

**Keyboard Shortcuts:**
- `Ctrl+Shift+D` - Toggle debug panel
- `Ctrl+Shift+L` - Clear events log
- `Ctrl+Shift+P` - Run ping test
- `Ctrl+Shift+E` - Export events to JSON

### Implementation Files

**Services:**
- `packages/web/src/services/debug/DebugLogger.ts` - Event logging service

**State:**
- `packages/web/src/stores/debugStore.ts` - Zustand store for panel state

**Components:**
- `packages/web/src/components/debug/DebugPanel.tsx` - Main panel component
- `packages/web/src/components/debug/EventsLog.tsx` - Events log section
- `packages/web/src/components/debug/NetworkStats.tsx` - Network metrics section
- `packages/web/src/components/debug/AbilityTriggers.tsx` - Ability buttons section
- `packages/web/src/components/debug/GameStateInspector.tsx` - State viewer section

**Integration:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` - Server-auth mode integration
- `packages/web/src/components/PartykitMultiplayerGame.tsx` - Legacy mode integration
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` - Debug logging integration
- `packages/web/src/services/partykit/gameSync.ts` - Debug logging integration
- `packages/partykit/src/game.ts` - Ping/pong message handler

### Usage

**Enable debug mode:**
```
http://localhost:5173/?debug=true
http://localhost:5173/?debug=true&serverAuth=true  (server-auth mode)
```

**Testing abilities:**
1. Open debug panel (`Ctrl+Shift+D`)
2. Expand "Ability Triggers" section
3. Select target (Self/Opponent)
4. Click ability button (no star cost required)
5. Ability activates immediately

**Monitoring network:**
1. Click "Ping Test" button
2. View RTT, avg, min, max values
3. Check connection status

**Viewing events:**
1. Expand "Events Log" section
2. Click on any event to see full JSON
3. Use filter box to search by type
4. Click "Export" to download JSON file

### Testing
- Unit tests: `pnpm --filter web test debugLogger`
- Unit tests: `pnpm --filter web test debugStore`
- All debug tests passing (14 tests)
