# Spec 008: Debug Panel for Test Mode

## Status
💡 **FEATURE REQUEST** - Development tool for testing and debugging

## Problem

### Current State
When testing multiplayer features, we have no visibility into:
- Server events and messages
- Network latency and performance
- Ability activation events
- Game state synchronization
- Connection status

**Testing is difficult because:**
- Can't see what the server is doing
- Can't trigger abilities on demand
- Can't measure latency
- Can't inspect state differences
- Can't replay specific scenarios

### Desired State
A debug panel that allows developers to:
- See all server events in real-time
- Trigger any ability instantly (bypass star cost)
- Measure server round-trip time (RTT)
- Inspect current game state
- Test edge cases and failure scenarios

## Requirements

### 1. Debug Panel UI

**Activation:**
- [ ] Accessible via URL parameter: `?debug=true`
- [ ] OR via keyboard shortcut: `Ctrl+Shift+D`
- [ ] Collapsible floating panel (doesn't block gameplay)
- [ ] Draggable to any screen corner
- [ ] Persists position in localStorage

**Panel Sections:**
```
┌─────────────────────────────────────┐
│ 🐛 Debug Panel            [─] [×]  │
├─────────────────────────────────────┤
│ ▼ Events Log (50)                   │
│   [11:23:45.123] ↓ state_update     │
│   [11:23:44.092] ↑ player_input     │
│   [11:23:43.001] ↓ ability_received │
│   [Clear] [Export]                  │
├─────────────────────────────────────┤
│ ▼ Network Stats                     │
│   RTT: 45ms (avg: 52ms)             │
│   State Updates: 60/s               │
│   Input Lag: 23ms                   │
│   Packets Lost: 0                   │
│   [Ping Test]                       │
├─────────────────────────────────────┤
│ ▼ Ability Triggers                  │
│   [Screen Shake] [Earthquake]       │
│   [Speed Up] [Reverse Controls]     │
│   [Death Cross] [Gold Digger]       │
│   Target: [○ Self] [● Opponent]     │
├─────────────────────────────────────┤
│ ▼ Game State Inspector              │
│   Your Board: [View JSON]           │
│   Opponent Board: [View JSON]       │
│   Active Effects: [View]            │
│   [Force Desync] [Force Reconnect]  │
└─────────────────────────────────────┘
```

### 2. Events Log

**Display:**
- [ ] Scrollable log of all WebSocket messages
- [ ] Timestamps with millisecond precision
- [ ] Direction indicators: ↑ (sent) ↓ (received)
- [ ] Color coding: Green (state), Blue (input), Red (error), Yellow (ability)
- [ ] Expandable rows to see full message payload
- [ ] Filter by message type
- [ ] Search by keyword

**Features:**
- [ ] Auto-scroll (toggle)
- [ ] Limit to last 50/100/500 messages
- [ ] Clear log button
- [ ] Export to JSON file
- [ ] Copy individual message to clipboard

**Example Log Entries:**
```
[11:23:45.123] ↓ state_update
  {
    "type": "state_update",
    "yourState": { "score": 120, "stars": 5, ... },
    "opponentState": { "score": 95, "stars": 8, ... }
  }

[11:23:44.092] ↑ player_input
  {
    "type": "player_input",
    "playerId": "user_123",
    "input": "move_left"
  }

[11:23:43.001] ↓ ability_received
  {
    "type": "ability_received",
    "abilityType": "earthquake",
    "fromPlayerId": "user_456"
  }
```

### 3. Network Stats

**Metrics:**
- [ ] **RTT (Round-Trip Time)**: Current ping to server
- [ ] **Average RTT**: Rolling average over 10 seconds
- [ ] **State Update Rate**: Messages per second
- [ ] **Input Lag**: Time from input to state update acknowledgment
- [ ] **Packets Lost**: Dropped WebSocket messages (if detectable)
- [ ] **Connection Status**: Connected / Reconnecting / Disconnected

**Ping Test:**
- [ ] Button to send ping message to server
- [ ] Server echoes back with timestamp
- [ ] Calculate RTT = (now - sent_time)
- [ ] Display in milliseconds
- [ ] Show min/max/avg over last 10 pings

**Implementation:**
```typescript
// Client sends ping
ws.send({ type: 'debug_ping', timestamp: Date.now() });

// Server echoes back
ws.send({ type: 'debug_pong', timestamp: receivedTimestamp });

// Client calculates RTT
const rtt = Date.now() - sentTimestamp;
```

### 4. Ability Triggers

**UI:**
- [ ] Button grid of all abilities in the game (not just loadout)
- [ ] Target selector: Self / Opponent radio buttons
- [ ] Abilities grouped by category (buff/debuff/instant/duration)
- [ ] Shows ability cost and duration next to name
- [ ] Bypasses star cost requirement (debug only!)
- [ ] Works in both legacy and server-auth modes

**Behavior:**
- [ ] Clicking ability button triggers it immediately
- [ ] Shows confirmation toast: "Triggered: Earthquake on Opponent"
- [ ] Logs ability activation to Events Log
- [ ] Visual feedback (button flash)

**Categories:**
```
Self Buffs:
[Piece Preview+] [Bomb Mode] [Cascade] [Deflect Shield]

Opponent Debuffs (Instant):
[Screen Shake] [Earthquake] [Clear Rows] [Death Cross]
[Row Rotate] [Random Spawner] [Gold Digger]

Opponent Debuffs (Duration):
[Speed Up] [Reverse Controls] [Rotation Lock]
[Blind Spot] [Shrink Ceiling]

Target: (○) Self  (●) Opponent
```

### 5. Game State Inspector

**Features:**
- [ ] View Your Board as JSON
- [ ] View Opponent Board as JSON
- [ ] View Active Effects list
- [ ] Compare states for desyncs
- [ ] View connection state
- [ ] View room info

**JSON Viewer:**
```json
{
  "board": {
    "width": 10,
    "height": 20,
    "grid": [[0,0,1,0,...], ...]
  },
  "currentPiece": {
    "type": "I",
    "position": { "x": 3, "y": 0 },
    "rotation": 0
  },
  "nextPieces": ["O", "T", "S"],
  "score": 120,
  "stars": 5,
  "linesCleared": 12,
  "activeEffects": [
    {
      "type": "speed_up_opponent",
      "expiresAt": 1705123456789
    }
  ]
}
```

**Debug Actions:**
- [ ] Force Desync: Send invalid state to test recovery
- [ ] Force Reconnect: Close WebSocket and reconnect
- [ ] Force Game Over: Set isGameOver = true
- [ ] Spawn Specific Piece: Choose next tetromino type

### 6. Implementation Architecture

**Components:**
```
DebugPanel.tsx
├── EventsLog.tsx
├── NetworkStats.tsx
├── AbilityTriggers.tsx
├── GameStateInspector.tsx
└── DebugPanelContext.tsx (state management)
```

**Integration Points:**

**ServerAuthGameClient.ts:**
```typescript
class ServerAuthGameClient {
  private debugLog: DebugLogger | null = null;

  constructor(...args, debugLogger?: DebugLogger) {
    this.debugLog = debugLogger;
  }

  onMessage(event) {
    // Log all incoming messages
    this.debugLog?.logIncoming(event.data);

    // Normal message handling...
  }

  sendInput(input) {
    // Log all outgoing messages
    this.debugLog?.logOutgoing({ type: 'player_input', input });

    // Normal send...
  }
}
```

**DebugLogger:**
```typescript
interface DebugEvent {
  timestamp: number;
  direction: 'in' | 'out';
  type: string;
  data: any;
}

class DebugLogger {
  private events: DebugEvent[] = [];
  private subscribers: ((events: DebugEvent[]) => void)[] = [];

  logIncoming(data: any) {
    this.events.push({
      timestamp: Date.now(),
      direction: 'in',
      type: data.type,
      data,
    });
    this.notify();
  }

  logOutgoing(data: any) {
    this.events.push({
      timestamp: Date.now(),
      direction: 'out',
      type: data.type,
      data,
    });
    this.notify();
  }

  subscribe(callback: (events: DebugEvent[]) => void) {
    this.subscribers.push(callback);
  }

  getEvents() {
    return this.events;
  }

  clear() {
    this.events = [];
    this.notify();
  }

  private notify() {
    this.subscribers.forEach(cb => cb(this.events));
  }
}
```

### 7. Server Support

**Debug Ping/Pong:**
```typescript
// In game.ts or matchmaking.ts
onMessage(message: string, sender: Party.Connection) {
  const data = JSON.parse(message);

  if (data.type === 'debug_ping') {
    sender.send(JSON.stringify({
      type: 'debug_pong',
      timestamp: data.timestamp,
      serverTime: Date.now(),
    }));
    return;
  }

  // Normal message handling...
}
```

**Debug Mode Detection:**
```typescript
// Server logs when debug mode is active
if (data.debugMode) {
  console.log('[DEBUG MODE] Player in debug mode:', playerId);
}
```

## Acceptance Criteria

### Scenario 1: Events Log
```
GIVEN debug panel is open
WHEN player presses arrow key
THEN Events Log shows:
  ↑ player_input { input: 'move_left' }
AND 16ms later:
  ↓ state_update { yourState: { ... } }
```

### Scenario 2: Network Stats
```
GIVEN debug panel is open
WHEN clicking "Ping Test" button
THEN RTT is measured and displayed (e.g., "45ms")
AND average RTT updates
AND graph shows RTT over time
```

### Scenario 3: Ability Triggers
```
GIVEN debug panel is open
WHEN clicking "Earthquake" button with "Opponent" selected
THEN earthquake activates on opponent
AND no stars are deducted
AND Events Log shows:
  ↑ ability_activation { abilityType: 'earthquake' }
AND opponent's board is affected
```

### Scenario 4: State Inspector
```
GIVEN debug panel is open
WHEN clicking "View Your Board"
THEN modal opens with JSON representation
AND board grid is displayed in readable format
AND can copy JSON to clipboard
```

### Scenario 5: Persistence
```
GIVEN debug panel is dragged to top-right corner
WHEN page is refreshed
THEN panel opens in top-right corner (persisted position)
AND all settings are preserved
```

## UI/UX Design

### Panel Styling
```css
.debug-panel {
  position: fixed;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid #00ff00;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  color: #00ff00;
  box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.debug-panel-header {
  background: rgba(0, 255, 0, 0.1);
  padding: 8px 12px;
  cursor: move; /* draggable */
  border-bottom: 1px solid #00ff00;
}

.debug-event {
  font-size: 11px;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(0, 255, 0, 0.2);
}

.debug-event.incoming {
  color: #00aaff; /* blue for incoming */
}

.debug-event.outgoing {
  color: #ffaa00; /* orange for outgoing */
}

.debug-event.error {
  color: #ff0000; /* red for errors */
}
```

### Keyboard Shortcuts
- `Ctrl+Shift+D` - Toggle debug panel
- `Ctrl+Shift+L` - Clear events log
- `Ctrl+Shift+P` - Run ping test
- `Ctrl+Shift+E` - Export events to JSON

## Testing

### Manual Tests
- [ ] Debug panel opens with `?debug=true`
- [ ] Debug panel opens with `Ctrl+Shift+D`
- [ ] Panel is draggable
- [ ] Panel position persists across refresh
- [ ] Events log shows all WebSocket messages
- [ ] Network stats update in real-time
- [ ] Ability triggers work without star cost
- [ ] State inspector shows valid JSON
- [ ] Ping test calculates RTT correctly

### Edge Cases
- [ ] Panel works in both legacy and server-auth modes
- [ ] Panel handles high message volume (100+ messages/sec)
- [ ] Panel handles disconnection gracefully
- [ ] Panel handles reconnection
- [ ] Export works with large logs (1000+ events)

## Success Metrics

- [ ] Debug panel accessible in <2 seconds
- [ ] Events log handles 1000+ messages without lag
- [ ] Ping test completes in <200ms
- [ ] Ability triggers have <50ms activation time
- [ ] Panel uses <50MB memory
- [ ] No impact on game performance when hidden

## Notes

- **Priority**: MEDIUM - Development tool, not user-facing
- **Visibility**: Only accessible with `?debug=true` or keyboard shortcut
- **Production**: Should be disabled in production builds (or hidden)
- **Use Cases**: Testing, debugging, demos, development

## Related Features

- Helps diagnose ability issues (Spec 007)
- Helps test server-authoritative mode (Spec 006)
- Helps debug matchmaking (Spec 004)
- Enables faster development iteration

## Future Enhancements

- [ ] Replay system: Record and replay event sequences
- [ ] Performance profiler: Frame time, render time, etc.
- [ ] Mock server responses: Test edge cases locally
- [ ] Network throttling: Simulate slow connections
- [ ] Auto-testing: Run automated test scenarios
- [ ] Save/load game states: Test specific scenarios
