# Research Summary for Spec 008: Debug Panel

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React client (Vite + TypeScript)
  - `packages/partykit` - WebSocket server
  - `packages/game-core` - Shared game logic
- **Build**: Vite (`pnpm build`)
- **Tests**: Vitest (`pnpm test`)
- **Dev**: `pnpm dev` (starts web client)

## Existing Patterns

### Imports
- Relative imports for local files: `import { Component } from './Component'`
- Package imports with workspace alias: `import { types } from '@tetris-battle/game-core'`
- External packages: `import { motion } from 'framer-motion'`
- No barrel exports pattern observed

### State Management
Uses Zustand for client state. Example from `abilityStore.ts`:
```typescript
export const useAbilityStore = create<AbilityState>((set, get) => ({
  availableAbilities: [],
  setLoadout: (loadout: string[]) => { set({ loadout }) },
}))
```

Pattern:
- Create store with `create<InterfaceType>()`
- Export store hook directly
- State updates via `set()` function
- No actions/reducers pattern - direct state setters

### Components
- Functional components with hooks (no class components)
- TypeScript interfaces for props
- Inline styles using `style={}` prop (no CSS modules)
- Glassmorphism via `glassUtils.ts` helper functions
- Motion effects via `framer-motion`
- Example pattern:
```typescript
interface ComponentProps {
  onAction: () => void;
  theme: Theme;
}

export function Component({ onAction, theme }: ComponentProps) {
  const [state, setState] = useState();
  return <div style={mergeGlass(glassBlue(), { ... })}> ... </div>
}
```

### Styling
- **Primary approach**: Inline styles with TypeScript type safety
- **Glass effects**: Imported from `src/styles/glassUtils.ts`
  - `glassDark()`, `glassBlue()`, `glassSuccess()`, `glassGold()`, `glassPurple()`
  - `mergeGlass(baseGlass, overrides)` for combining styles
- **Animations**: framer-motion with variants
- **Theme system**: `Theme` type with backgroundColor, textColor, etc.
- **No CSS modules or styled-components**

Example from MainMenu.tsx:
```typescript
<div style={mergeGlass(glassSuccess(), {
  padding: '8px 12px',
  borderRadius: '8px',
})}>
  Level {level}
</div>
```

### Server Messages (WebSocket)
**Client → Server format:**
```typescript
{
  type: 'player_input' | 'ability_activation' | 'game_state_update' | ...,
  playerId: string,
  [additional fields based on type]
}
```

**Server → Client format:**
```typescript
{
  type: 'state_update' | 'ability_received' | 'game_start' | ...,
  [data fields based on type]
}
```

**Key message types:**
- `player_input`: Client sends keyboard/touch input
- `state_update`: Server sends game state (60fps in server-auth mode)
- `ability_activation`: Client triggers ability
- `ability_received`: Server notifies ability was applied
- `debug_ping` / `debug_pong`: (will add for RTT measurement)

### WebSocket Client Classes

**ServerAuthGameClient.ts (server-authoritative mode):**
```typescript
class ServerAuthGameClient {
  private socket: PartySocket;

  constructor(roomId, playerId, host, loadout, debugLogger?) {
    this.socket = new PartySocket({ host, party: 'game', room: roomId });
  }

  connect(onStateUpdate, onOpponentDisconnected, onGameFinished, onAbilityReceived) {
    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      // Handle messages...
    });
  }

  sendInput(input: PlayerInputType) {
    this.send({ type: 'player_input', playerId, input, timestamp: Date.now() });
  }

  activateAbility(abilityType, targetPlayerId) {
    this.send({ type: 'ability_activation', ... });
  }
}
```

**PartykitGameSync.ts (legacy client-authoritative):**
Similar pattern but sends `game_state_update` instead of inputs.

### Tests
**Framework**: Vitest
**Pattern** (from `friendChallengeFlow.test.ts`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Reset state
  });

  it('should do something', () => {
    // Arrange
    const data = { ... };

    // Act
    someAction(data);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

**Test location**: `packages/web/src/__tests__/`
**Run tests**: `pnpm --filter web test`

## Analogous Flow: Ability System

The debug panel's ability trigger feature is analogous to how abilities currently work:

### 1. Client initiates ability (ServerAuthMultiplayerGame.tsx ~line 458)
```typescript
const handleAbilityActivate = (abilityType: string) => {
  const ability = ABILITIES[abilityType];
  if (!ability) return;

  // Check stars (in debug mode, we'll bypass this)
  if (yourState.stars < ability.cost) return;

  // Send to server
  gameClientRef.current?.activateAbility(abilityType, opponentId);
};
```

### 2. Server receives and validates (game.ts ~line 137)
```typescript
case 'ability_activation':
  this.handleAbilityActivation(data.playerId, data.abilityType, data.targetPlayerId);
  break;
```

### 3. Server applies ability (ServerGameState.ts)
```typescript
activateAbility(abilityType: string, targetPlayerId: string) {
  const ability = ABILITIES[abilityType];

  // Deduct stars (in debug mode, we'll skip validation)
  this.gameState.stars -= ability.cost;

  // Apply effect
  switch (abilityType) {
    case 'earthquake':
      this.gameState.board = applyEarthquake(this.gameState.board);
      break;
    // ... other abilities
  }

  // Notify opponent
  this.sendAbilityNotification(abilityType, targetPlayerId);
}
```

### 4. Client receives notification
```typescript
case 'ability_received':
  if (onAbilityReceived) {
    onAbilityReceived(data.abilityType, data.fromPlayerId);
  }
  break;
```

## Integration Points

### New Files to Create
1. **`packages/web/src/components/debug/DebugPanel.tsx`** - Main panel component
2. **`packages/web/src/components/debug/EventsLog.tsx`** - Events log section
3. **`packages/web/src/components/debug/NetworkStats.tsx`** - Network metrics section
4. **`packages/web/src/components/debug/AbilityTriggers.tsx`** - Ability buttons section
5. **`packages/web/src/components/debug/GameStateInspector.tsx`** - State viewer section
6. **`packages/web/src/stores/debugStore.ts`** - Debug panel state (Zustand)
7. **`packages/web/src/services/debug/DebugLogger.ts`** - Event logging service
8. **`packages/web/src/__tests__/debugPanel.test.ts`** - Tests for debug panel

### Existing Files to Modify

#### 1. `packages/web/src/services/partykit/ServerAuthGameClient.ts`
- **Line 38**: Add optional `debugLogger?: DebugLogger` parameter to constructor
- **Line 61-86**: Wrap all `addEventListener('message')` callbacks to log via debugLogger
- **Line 127-130**: Wrap `send()` to log outgoing messages
- **Add new method**: `setPingHandler(callback)` for ping/pong support

#### 2. `packages/web/src/services/partykit/gameSync.ts`
- **Line 12**: Add optional `debugLogger?: DebugLogger` parameter to constructor
- **Line 35-75**: Wrap message handler to log via debugLogger
- **Line 149-153**: Wrap `send()` to log outgoing messages

#### 3. `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
- **Line 99**: Import DebugLogger and DebugPanel
- **Line 99**: Check for `?debug=true` URL param
- **Line 99**: Create DebugLogger instance if debug mode
- **Line 99**: Pass debugLogger to ServerAuthGameClient constructor
- **Line ~550** (in JSX): Conditionally render `<DebugPanel>` component

#### 4. `packages/web/src/components/PartykitMultiplayerGame.tsx`
- Similar changes as ServerAuthMultiplayerGame.tsx
- Pass debugLogger to PartykitGameSync constructor

#### 5. `packages/partykit/src/game.ts`
- **Line 122**: Add case for `'debug_ping'` message type
- **New handler**: `handleDebugPing(data, sender)` - Echo back with `debug_pong`

#### 6. `packages/web/src/App.tsx`
- **Line 34-38**: Also check for `?debug=true` param (in addition to `?serverAuth`)
- No other changes needed (debug panel lives inside game components)

## Key Files to Reference During Implementation

**For component structure:**
- `MainMenu.tsx` - Example of complex component with inline styles
- `AbilityInfo.tsx` - Example of modal/panel component
- `FriendList.tsx` - Example of list rendering with glassmorphism

**For state management:**
- `abilityStore.ts` - Simple Zustand store pattern
- `friendStore.ts` - More complex store with multiple actions

**For WebSocket integration:**
- `ServerAuthGameClient.ts` - Clean WebSocket wrapper pattern
- `gameSync.ts` - Alternative WebSocket client pattern

**For styling:**
- `glassUtils.ts` - All glassmorphism helpers
- `MainMenu.tsx` - Examples of mergeGlass usage

**For server integration:**
- `game.ts` - Message routing pattern
- `ServerGameState.ts` - Game state management

**For testing:**
- `friendChallengeFlow.test.ts` - Integration test pattern
- `friendStore.test.ts` - Store testing pattern

## Notes

### Dual Architecture Support
The debug panel must work in BOTH modes:
1. **Server-authoritative** (`?serverAuth=true`): Uses ServerAuthGameClient
2. **Legacy client-authoritative** (default): Uses PartykitGameSync

Solution: DebugLogger is mode-agnostic. Both clients accept optional debugLogger.

### URL Parameters
Current URL params in use:
- `?serverAuth=true` - Enable server-authoritative mode
- `?testMode=true` - Enable all abilities in ability carousel

New URL param:
- `?debug=true` - Enable debug panel

### Keyboard Shortcuts
Will use global keyboard listener:
- `Ctrl+Shift+D` - Toggle debug panel
- `Ctrl+Shift+L` - Clear events log
- `Ctrl+Shift+P` - Run ping test
- `Ctrl+Shift+E` - Export events to JSON

### LocalStorage Keys
For persisting debug panel state:
- `tetris_debug_panel_position` - { x, y }
- `tetris_debug_panel_collapsed` - boolean
- `tetris_debug_panel_settings` - { eventLimit, autoScroll, etc. }

### All 20 Abilities (from abilities.json)
**Buffs (8):**
1. cascade_multiplier - 2X stars (90 cost, 15s)
2. deflect_shield - Block debuff (35 cost, instant)
3. piece_preview_plus - See 5 pieces (30 cost, 15s)
4. cross_firebomb - Cross bomb (45 cost, instant)
5. circle_bomb - Circle bomb (50 cost, instant)
6. clear_rows - Clear 5 rows (60 cost, instant)
7. mini_blocks - 2-cell pieces (40 cost, 5 pieces)
8. fill_holes - Fill gaps (70 cost, instant)

**Debuffs (12):**
1. speed_up_opponent - 3X speed (35 cost, 10s)
2. reverse_controls - Swap L/R (35 cost, 8s)
3. rotation_lock - No rotate (60 cost, 5s)
4. blind_spot - Bottom 4 rows invisible (85 cost, 6s)
5. screen_shake - Shake board (25 cost, 10s)
6. shrink_ceiling - -4 rows height (50 cost, 8s)
7. random_spawner - Spawn junk (50 cost, 20s)
8. gold_digger - Random disappear (55 cost, 20s)
9. earthquake - Shift rows (65 cost, instant)
10. death_cross - Toggle diagonal (75 cost, instant)
11. row_rotate - Rotate rows (60 cost, instant)
12. weird_shapes - 4x4 hollow (80 cost, 1 piece)

## Server Message Support Needed

### New message type: debug_ping / debug_pong
**Client sends:**
```typescript
{
  type: 'debug_ping',
  timestamp: Date.now()
}
```

**Server responds:**
```typescript
{
  type: 'debug_pong',
  timestamp: originalTimestamp,
  serverTime: Date.now()
}
```

**RTT calculation:**
```typescript
const rtt = Date.now() - sentTimestamp;
```

This completes Phase 1 research.
