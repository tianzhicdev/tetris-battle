# Tetris Battle - System Architecture Documentation

> **For Future Developers**: This document explains how the Tetris Battle multiplayer system works, including server-authoritative design, matchmaking, abilities, and debugging tools.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Component Map](#component-map)
4. [Server-Authoritative Game Loop](#server-authoritative-game-loop)
5. [Matchmaking System](#matchmaking-system)
6. [Ability System](#ability-system)
7. [Debug Mode](#debug-mode)
8. [Data Flow](#data-flow)
9. [Development Workflow](#development-workflow)

---

## System Overview

### Desired Behavior

Tetris Battle is a **competitive 1v1 multiplayer Tetris game** where:

- **Fair Gameplay**: All game logic runs on the server to prevent cheating
- **Real-time Multiplayer**: Two players compete simultaneously in separate game instances
- **Ability System**: Players earn stars by clearing lines and use them to activate offensive/defensive abilities
- **Automatic Matchmaking**: Players are matched automatically based on skill rank
- **Deterministic Gameplay**: Games use seeded RNG for reproducibility and debugging

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React + Vite | Game UI and rendering |
| **Backend** | PartyKit | WebSocket server for real-time multiplayer |
| **Database** | Supabase (PostgreSQL) | User authentication, player stats, match history |
| **Game Engine** | TypeScript (game-core package) | Pure game logic (deterministic, testable) |
| **Deployment** | Vercel (frontend) + PartyKit Cloud (backend) | Hosting |

---

## Architecture Principles

### 1. Server-Authoritative Design

**Principle**: The server is the single source of truth for all game state.

**Why**: Prevents cheating, ensures fair play, enables replays/spectating.

**How**:
- Client sends **inputs** (move left, rotate, drop)
- Server processes inputs and calculates new state
- Server broadcasts **state updates** to both players
- Client renders the state it receives

```
Client                Server                Client
  |                     |                     |
  |--[input: rotate]--->|                     |
  |                     |--[process]          |
  |                     |                     |
  |<--[state update]----|--[state update]---->|
  |                     |                     |
```

### 2. Deterministic Game Logic

**Principle**: Same inputs + same seed = same game outcome

**Why**: Enables testing, debugging, and future replay features

**How**:
- All RNG uses seeded random (`SeededRandom` class)
- Each game receives a unique seed at start
- Piece spawning is deterministic based on seed
- Tests can reproduce exact game scenarios

### 3. Monorepo Package Structure

**Principle**: Shared code is centralized, domain logic is isolated

```
packages/
├── game-core/          # Pure game logic (no networking, no UI)
│   ├── engine.ts       # Core Tetris mechanics
│   ├── abilities.ts    # Ability definitions
│   └── abilityEffects.ts  # Ability implementations
├── partykit/           # Server-side multiplayer
│   ├── server.ts       # PartyKit WebSocket server
│   ├── ServerGameState.ts  # Authoritative game state
│   └── MatchmakingRoom.ts  # Matchmaking queue
└── web/                # Client-side React app
    ├── components/     # UI components
    └── services/       # Client-side game client
```

---

## Component Map

### All System Components

#### 🎮 **Game Engine (game-core package)**

**Purpose**: Pure, deterministic Tetris logic

**Key Files**:
- `engine.ts` - Core mechanics (move, rotate, lock, clear lines)
- `tetrominos.ts` - Piece definitions and spawning
- `abilities.ts` - Ability metadata (cost, duration, category)
- `abilityEffects.ts` - Ability effect implementations
- `progression.ts` - Star earning calculations
- `SeededRandom.ts` - Deterministic random number generator

**Desired Behavior**:
- **No side effects**: Pure functions only
- **Fully testable**: All logic has unit tests
- **Framework agnostic**: Can run in Node, browser, or Deno

#### 🌐 **PartyKit Server (partykit package)**

**Purpose**: WebSocket server for real-time multiplayer

**Key Files**:
- `server.ts` - Main PartyKit server entry point
- `GameRoom.ts` - Manages one 1v1 game session
- `ServerGameState.ts` - Authoritative game state for one player
- `MatchmakingRoom.ts` - Global matchmaking queue

**Desired Behavior**:
- **Single source of truth**: All game state lives here
- **Input validation**: Reject invalid moves/abilities
- **State broadcasting**: Send updates to both players every tick
- **Game lifecycle**: Handle join, start, disconnect, finish

#### 🖥️ **Web Client (web package)**

**Purpose**: React UI for game rendering and user interaction

**Key Files**:
- `components/ServerAuthMultiplayerGame.tsx` - Main game component
- `services/partykit/ServerAuthGameClient.ts` - WebSocket client
- `services/partykit/matchmaking.ts` - Matchmaking client
- `components/debug/DebugPanel.tsx` - Debug overlay

**Desired Behavior**:
- **Render only**: Display state received from server
- **Input only**: Send user inputs to server, don't predict state
- **Optimistic UI**: Can show ghost pieces/animations client-side
- **Debug support**: Debug mode provides visibility into networking

#### 🗄️ **Supabase Database**

**Purpose**: User accounts, stats, match history

**Tables**:
- `auth.users` - User authentication (Supabase managed)
- `profiles` - Player profiles, ranks, stats
- `matches` - Match history, results
- `player_stats` - Aggregated statistics

**Desired Behavior**:
- **Authentication only**: Don't validate gameplay (server does this)
- **Post-game writes**: Update stats after match ends
- **Read on demand**: Load profile/stats when needed

---

## Server-Authoritative Game Loop

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      PartyKit Server                         │
│                                                               │
│  ┌───────────────┐         ┌───────────────┐                │
│  │ Player 1      │         │ Player 2      │                │
│  │ ServerGameState│         │ ServerGameState│                │
│  │               │         │               │                │
│  │ - board       │         │ - board       │                │
│  │ - currentPiece│         │ - currentPiece│                │
│  │ - score       │         │ - score       │                │
│  │ - stars       │         │ - stars       │                │
│  │ - activeEffects│        │ - activeEffects│                │
│  └───────┬───────┘         └───────┬───────┘                │
│          │                         │                         │
│          │    Game Loop (1000ms)   │                         │
│          │  ┌──────────────────┐   │                         │
│          └──┤ tick() both      │───┘                         │
│             │ players          │                             │
│             └──────┬───────────┘                             │
│                    │                                         │
│                    ▼                                         │
│             ┌──────────────────┐                             │
│             │ Broadcast update │                             │
│             │ to both clients  │                             │
│             └──────────────────┘                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│ Client 1      │           │ Client 2      │
│               │           │               │
│ Renders state │           │ Renders state │
│ Sends inputs  │           │ Sends inputs  │
└───────────────┘           └───────────────┘
```

### Server Game State (`ServerGameState.ts`)

**Responsibilities**:
1. **Process Inputs**: `processInput(input: PlayerInputType)`
2. **Run Game Loop**: `tick()` - Move piece down every tick
3. **Apply Abilities**: `applyAbility(abilityType: string)`
4. **Track Effects**: `activeEffects: Map<string, number>`
5. **Provide State**: `getPublicState()` for broadcasting

**Key Implementation Details**:

```typescript
class ServerGameState {
  // Core game state (from game-core)
  gameState: GameState;

  // Server-specific state
  tickRate: number = 1000;           // Modified by speed_up_opponent
  bombMode: { type: 'circle' | 'cross' } | null = null;
  miniBlocksRemaining: number = 0;
  shieldActive: boolean = false;
  activeEffects: Map<string, number>; // abilityType → endTime

  // Deterministic RNG
  rng: SeededRandom;

  // Methods
  processInput(input: PlayerInputType): boolean
  tick(): boolean
  applyAbility(abilityType: string): void
  getActiveEffects(): string[]
  getPublicState(): GameStateUpdate
}
```

**Input Processing Flow**:

```typescript
// Client sends:
{ type: 'player_input', input: 'rotate_cw', timestamp: 1234567890 }

// Server processes:
1. Check for rotation_lock effect → if active, reject
2. Check for reverse_controls effect → swap left/right
3. Apply input to current piece
4. Validate new position
5. Update state if valid
6. Return true/false for state change
```

**Tick Processing**:

```typescript
// Every 1000ms (or modified by abilities):
1. Move current piece down
2. If can't move down:
   a. Lock piece to board
   b. Check for bomb mode → apply bomb effect
   c. Clear completed lines
   d. Award stars (check cascade_multiplier)
   e. Spawn next piece (check weird_shapes, mini_blocks)
   f. Check game over
3. Broadcast state update
```

---

## Matchmaking System

### Desired Behavior

1. **Player joins queue** → Sent to waiting room
2. **Server finds match** → Two players with similar rank
3. **Game room created** → Both players redirected to game
4. **Match starts** → Server-authoritative game begins

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Matchmaking Room (Global)                   │
│                   party: "matchmaking"                       │
│                                                               │
│  Queue Structure (per rank tier):                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Rank 1-499:    [player1, player2, player3, ...]     │   │
│  │ Rank 500-999:  [player4, player5, ...]              │   │
│  │ Rank 1000-1499:[player6, ...]                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Match Logic:                                                │
│  1. Player joins → Add to queue for their rank tier         │
│  2. Every 100ms → Check each tier for 2+ players            │
│  3. If match found:                                          │
│     - Generate unique gameRoomId                             │
│     - Send both players redirect message                    │
│     - Remove from queue                                      │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Files

**Server**: `packages/partykit/src/MatchmakingRoom.ts`
```typescript
export class MatchmakingRoom implements Party.Server {
  // Queue: { [rankTier: string]: PlayerInQueue[] }
  private queue: Map<string, PlayerInQueue[]>;

  async onRequest(req: Party.Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/join') {
      // Add player to queue
      const { playerId, rank, loadout } = await req.json();
      this.addToQueue(playerId, rank, loadout);
      return new Response(JSON.stringify({ status: 'queued' }));
    }

    if (url.pathname === '/leave') {
      // Remove player from queue
      const { playerId } = await req.json();
      this.removeFromQueue(playerId);
      return new Response(JSON.stringify({ status: 'left' }));
    }
  }

  private tryMatchPlayers(): void {
    for (const [tier, players] of this.queue) {
      if (players.length >= 2) {
        const [p1, p2] = players.splice(0, 2);
        const gameRoomId = this.generateRoomId();

        // Send redirect to both players
        p1.connection.send(JSON.stringify({
          type: 'match_found',
          gameRoomId,
          opponentId: p2.playerId,
          seed: this.generateSeed()
        }));

        p2.connection.send(JSON.stringify({
          type: 'match_found',
          gameRoomId,
          opponentId: p1.playerId,
          seed: this.generateSeed()
        }));
      }
    }
  }
}
```

**Client**: `packages/web/src/services/partykit/matchmaking.ts`
```typescript
export class MatchmakingClient {
  async joinQueue(playerId: string, rank: number, loadout: string[]): Promise<void> {
    await fetch(`${this.host}/parties/matchmaking/lobby/join`, {
      method: 'POST',
      body: JSON.stringify({ playerId, rank, loadout })
    });

    // Listen for match_found message
    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'match_found') {
        // Redirect to game room
        window.location.href = `/game/${data.gameRoomId}`;
      }
    });
  }
}
```

### Rank Tiers

Players are grouped into tiers for faster matching:

```typescript
function getRankTier(rank: number): string {
  return Math.floor(rank / 500).toString(); // 0-499, 500-999, 1000-1499, etc.
}
```

**Trade-off**: Wider tiers = faster matches, but less precise skill matching

---

## Ability System

### Design Philosophy

**Abilities are the core competitive mechanic** that differentiates Tetris Battle from standard Tetris.

**Design Goals**:
1. **Strategic depth**: Players must decide when to save vs. spend stars
2. **Counterplay**: Defensive abilities (shield) counter offensive ones
3. **Skill expression**: Timing and ability selection matter
4. **Spectacle**: Visual effects make abilities exciting

### Ability Categories

| Category | Targets | Purpose | Examples |
|----------|---------|---------|----------|
| **Buff** | Self | Enhance your gameplay | Circle Bomb, Mini Blocks, Shield |
| **Debuff** | Opponent | Disrupt opponent | Earthquake, Speed Up, Reverse Controls |

### Ability Metadata (`abilities.ts`)

Every ability has standardized metadata:

```typescript
export const ABILITIES = {
  circle_bomb: {
    id: 'circle_bomb',
    type: 'circle_bomb',
    name: 'Circle Bomb',
    shortName: 'O BOMB',
    description: 'Your next piece becomes a bomb that clears a radius of 3 cells when locked',
    cost: 30,              // Star cost to activate
    category: 'buff',      // buff or debuff
    duration: 0,           // Instant effect (0) or duration in ms
    icon: '💣',
    color: '#ff6b00',
  },
  // ... all other abilities
};
```

### How Abilities Work

#### 1. Earning Stars

**Star Sources**:
- Single line clear: +5 stars
- Double: +10 stars
- Triple: +15 stars
- Tetris (4 lines): +25 stars
- Combo multiplier: +5 per consecutive clear

**Implementation**:
```typescript
// In ServerGameState.lockAndSpawn()
const starsEarned = calculateStars(linesCleared, this.gameState.comboCount);

// Check for cascade_multiplier buff
if (this.activeEffects.has('cascade_multiplier')) {
  starsEarned *= 2; // Double stars!
}

this.gameState.stars = Math.min(STAR_VALUES.maxCapacity, stars + starsEarned);
```

#### 2. Activating Abilities

**Client Flow**:
```typescript
// User clicks ability button
function handleAbilityClick(abilityType: string) {
  const ability = ABILITIES[abilityType];

  // Check if player has enough stars
  if (yourState.stars < ability.cost) {
    return; // Not enough stars
  }

  // Determine target
  const targetId = ability.category === 'buff' ? yourPlayerId : opponentId;

  // Send to server
  gameClient.activateAbility(abilityType, targetId);
}
```

**Server Processing**:
```typescript
// In GameRoom.onMessage()
case 'ability_activation':
  const { playerId, abilityType, targetPlayerId } = data;

  // Get ability metadata
  const ability = ABILITIES[abilityType];

  // Validate cost
  const playerState = this.playerStates.get(playerId);
  if (playerState.gameState.stars < ability.cost) {
    return; // Reject: not enough stars
  }

  // Deduct stars
  playerState.gameState.stars -= ability.cost;

  // Apply ability to target
  const targetState = this.playerStates.get(targetPlayerId);
  targetState.applyAbility(abilityType);

  // Notify opponent
  this.sendToPlayer(targetPlayerId, {
    type: 'ability_received',
    abilityType,
    fromPlayerId: playerId
  });

  // Broadcast state update
  this.broadcastState();
```

#### 3. Ability Implementation Patterns

**Pattern A: Instant Board Effects**

Used for abilities that modify the board immediately.

```typescript
// Example: earthquake
case 'earthquake':
  this.gameState.board = applyEarthquake(this.gameState.board);
  break;

// Implementation in abilityEffects.ts
export function applyEarthquake(board: Board): Board {
  // Find all filled cells
  const filledCells = /* ... */;

  // Remove 15-25 random blocks
  const numHoles = Math.floor(Math.random() * 11) + 15;
  for (let i = 0; i < numHoles; i++) {
    // Remove random block
  }

  // Apply gravity so blocks fall
  return applyGravity(board);
}
```

**Pattern B: Duration-Based Effects**

Used for abilities that last a certain time.

```typescript
// Example: reverse_controls (8 seconds)
case 'reverse_controls':
  this.activeEffects.set('reverse_controls', Date.now() + 8000);
  break;

// Check in processInput()
if (this.activeEffects.has('reverse_controls')) {
  const endTime = this.activeEffects.get('reverse_controls')!;
  if (Date.now() < endTime) {
    // Swap left/right inputs
    if (input === 'move_left') input = 'move_right';
    else if (input === 'move_right') input = 'move_left';
  } else {
    // Expired, remove effect
    this.activeEffects.delete('reverse_controls');
  }
}
```

**Pattern C: Bomb Abilities (Delayed Effect)**

Used for abilities that trigger on piece lock.

```typescript
// Store bomb mode when ability activated
case 'circle_bomb':
  this.bombMode = { type: 'circle' };
  break;

// Check in lockAndSpawn() after piece locks
if (this.bombMode) {
  const centerX = this.gameState.currentPiece.position.x + 1;
  const centerY = this.gameState.currentPiece.position.y + 1;

  if (this.bombMode.type === 'circle') {
    this.gameState.board = applyCircleBomb(board, centerX, centerY, 3);
  }

  this.bombMode = null; // Consume bomb
}
```

**Pattern D: Piece Modifiers**

Used for abilities that change piece spawning.

```typescript
// Store counter when ability activated
case 'mini_blocks':
  this.miniBlocksRemaining = 5;
  break;

// Check in lockAndSpawn() when spawning next piece
if (this.miniBlocksRemaining > 0) {
  // Spawn mini 2-cell domino instead of normal piece
  this.gameState.currentPiece = createMiniBlock(this.gameState.board.width);
  this.miniBlocksRemaining--;
} else {
  // Normal piece spawning
  const nextType = this.gameState.nextPieces[0];
  this.gameState.currentPiece = createTetromino(nextType, boardWidth);
}
```

**Pattern E: Shield (Pre-Check)**

Used for deflect_shield which blocks incoming debuffs.

```typescript
// Set shield flag when activated
case 'deflect_shield':
  this.shieldActive = true;
  break;

// Check at START of applyAbility()
applyAbility(abilityType: string): void {
  // Check if shield blocks this debuff
  if (this.shieldActive && this.isDebuff(abilityType)) {
    console.log(`Shield blocked ${abilityType}`);
    this.shieldActive = false; // Consume shield
    return; // Don't apply the debuff
  }

  // ... normal ability processing
}
```

### All Abilities Reference

| Ability | Type | Cost | Duration | Effect |
|---------|------|------|----------|--------|
| **Earthquake** | Debuff | 25 | Instant | Remove 15-25 random blocks |
| **Clear Rows** | Debuff | 30 | Instant | Clear bottom 5 rows |
| **Random Spawner** | Debuff | 20 | Instant | Add 1-3 random blocks |
| **Row Rotate** | Debuff | 25 | Instant | Rotate each row 1-8 positions |
| **Death Cross** | Debuff | 35 | Instant | Create diagonal cross pattern |
| **Gold Digger** | Debuff | 15 | Instant | Remove 1-3 filled blocks |
| **Speed Up** | Debuff | 40 | 10s | Triple opponent's fall speed |
| **Reverse Controls** | Debuff | 30 | 8s | Swap left/right inputs |
| **Rotation Lock** | Debuff | 25 | 6s | Disable rotation |
| **Blind Spot** | Debuff | 35 | 10s | Visual obstruction (client-side) |
| **Screen Shake** | Debuff | 20 | 12s | Screen shake effect (client-side) |
| **Shrink Ceiling** | Debuff | 30 | 8s | Visual ceiling shrink (client-side) |
| **Weird Shapes** | Debuff | 40 | Next piece | Next piece is 4x4 hollowed square |
| **Circle Bomb** | Buff | 30 | Next piece | Piece clears radius of 3 |
| **Mini Blocks** | Buff | 25 | 5 pieces | Next 5 pieces are 2-cell dominoes |
| **Cross Firebomb** | Buff | 40 | Next piece | Piece clears 3 rows + 3 columns |
| **Fill Holes** | Buff | 35 | Instant | Fill all enclosed empty cells |
| **Cascade Multiplier** | Buff | 50 | 15s | Double star earnings |
| **Deflect Shield** | Buff | 45 | Next debuff | Block next incoming debuff |
| **Piece Preview+** | Buff | 20 | 15s | Show 5 pieces instead of 3 |

---

## Debug Mode

### Purpose

Debug mode provides **full visibility into the multiplayer networking layer** for development and troubleshooting.

### Activation

```
http://localhost:5173/game/room123?debug=true
```

### Features

#### 1. **Debug Panel Overlay**

**Location**: Bottom-right corner (draggable)

**Keyboard Shortcuts**:
- `Ctrl+Shift+D` - Toggle panel
- `Ctrl+Shift+L` - Clear event log
- `Ctrl+Shift+P` - Ping test
- `Ctrl+Shift+E` - Export events to JSON

#### 2. **Event Log**

Tracks all WebSocket traffic:

```
[22:04:50.123] ↓ state_update
[22:04:50.456] ↑ player_input
[22:04:51.789] ★ Opponent used Death Cross on you
```

**Event Types**:
- `↓` - Incoming messages (server → client)
- `↑` - Outgoing messages (client → server)
- `★` - Custom events (ability usage, line clears, etc.)

**Filtering**:
```
Filter by type... [earthquake]
```
Shows only events containing "earthquake"

#### 3. **Network Stats**

**Real-time Metrics**:
- WebSocket status: `connected` / `connecting` / `disconnected`
- Round-trip time (RTT): Ping/pong latency
- Ping history graph: Last 20 ping results

**Ping Test**:
```typescript
// Client sends
{ type: 'debug_ping', timestamp: 1234567890 }

// Server responds
{ type: 'debug_pong', timestamp: 1234567890 }

// Client calculates RTT
const rtt = Date.now() - timestamp; // e.g., 45ms
```

#### 4. **Ability Triggers**

**Manual Ability Testing**:
- Bypasses star cost checking
- Auto-targets based on ability category
- Instant activation for testing effects

**Usage**:
```
Self Buffs:          Opponent Debuffs:
[O BOMB] [MINI]      [QUAKE] [SPEED+]
[SHIELD] [FILL]      [REVERSE] [SHAKE]
```

Click any button → Ability activates immediately

#### 5. **Game State Inspector**

**Your State**:
```json
{
  "board": [[null, null, ...], ...],
  "currentPiece": { "type": "T", "position": { "x": 4, "y": 2 } },
  "score": 1250,
  "stars": 45,
  "linesCleared": 12,
  "comboCount": 3,
  "activeEffects": ["cascade_multiplier"]
}
```

**Opponent State**:
```json
{
  "board": [[null, "I", ...], ...],
  "currentPiece": { "type": "O", "position": { "x": 5, "y": 3 } },
  "score": 980,
  "stars": 30,
  "linesCleared": 9,
  "comboCount": 0,
  "activeEffects": ["speed_up_opponent", "reverse_controls"]
}
```

### Implementation

**Debug Logger** (`packages/web/src/services/debug/DebugLogger.ts`):

```typescript
export class DebugLogger {
  private events: DebugEvent[] = [];

  logIncoming(data: any): void {
    this.addEvent({
      timestamp: Date.now(),
      direction: 'in',
      type: data.type,
      data
    });
  }

  logOutgoing(data: any): void {
    this.addEvent({
      timestamp: Date.now(),
      direction: 'out',
      type: data.type,
      data
    });
  }

  logEvent(type: string, description: string, data?: any): void {
    this.addEvent({
      timestamp: Date.now(),
      direction: 'event',
      type,
      data: data || {},
      humanReadable: description
    });
  }
}
```

**Integration Points**:

```typescript
// In ServerAuthGameClient.ts
this.socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  this.debugLogger?.logIncoming(data); // Log all incoming

  switch (data.type) {
    case 'state_update':
      onStateUpdate(data);
      break;
    case 'ability_received':
      // Custom event logging
      const ability = ABILITIES[data.abilityType];
      this.debugLogger?.logEvent(
        'ability_received',
        `Received ${ability.name} from opponent`,
        { abilityType: data.abilityType }
      );
      break;
  }
});

// Send with logging
private send(data: any): void {
  this.debugLogger?.logOutgoing(data);
  this.socket.send(JSON.stringify(data));
}
```

---

## Data Flow

### Complete Message Flow Example

**Scenario**: Player 1 uses Earthquake ability on Player 2

```
┌──────────────┐                                              ┌──────────────┐
│   Player 1   │                                              │   Player 2   │
│   (Client)   │                                              │   (Client)   │
└──────┬───────┘                                              └──────┬───────┘
       │                                                              │
       │ 1. Click "Earthquake" button                                │
       │    (45 stars, costs 25)                                     │
       │                                                              │
       ▼                                                              │
   ┌────────────────────────────────────────────┐                   │
   │ handleAbilityClick('earthquake')           │                   │
   │ - Check stars: 45 >= 25 ✓                  │                   │
   │ - Target: opponent (debuff)                │                   │
   └────────────────────────────────────────────┘                   │
       │                                                              │
       │ 2. Send WebSocket message                                   │
       │                                                              │
       ▼                                                              │
   {                                                                  │
     type: 'ability_activation',                                     │
     playerId: 'player1-id',                                         │
     abilityType: 'earthquake',                                      │
     targetPlayerId: 'player2-id',                                   │
     timestamp: 1234567890                                           │
   }                                                                  │
       │                                                              │
       └──────────────────────────────┐                             │
                                      │                             │
                                      ▼                             │
                           ┌─────────────────────────────────────┐ │
                           │     PartyKit Server (GameRoom)      │ │
                           │                                     │ │
                           │ 3. Process ability activation       │ │
                           │    a. Get player1 state: 45 stars  │ │
                           │    b. Validate cost: 45 >= 25 ✓    │ │
                           │    c. Deduct stars: 45 - 25 = 20   │ │
                           │    d. Get player2 state             │ │
                           │    e. Apply earthquake to player2   │ │
                           │       board                         │ │
                           │    f. Generate state updates        │ │
                           └─────────────────────────────────────┘ │
                                      │                             │
                    ┌─────────────────┴──────────────────┐          │
                    │                                    │          │
                    ▼                                    ▼          │
   ┌────────────────────────────────┐   ┌────────────────────────────────┐
   │ 4a. Broadcast to Player 1      │   │ 4b. Broadcast to Player 2      │
   │                                │   │                                │
   │ {                              │   │ {                              │
   │   type: 'state_update',        │   │   type: 'state_update',        │
   │   yourState: {                 │   │   yourState: {                 │
   │     stars: 20,  (deducted!)    │   │     board: [...],  (damaged!)  │
   │     ...                        │   │     ...                        │
   │   },                           │   │   },                           │
   │   opponentState: {             │   │   opponentState: {             │
   │     board: [...], (damaged)    │   │     stars: 20,  (deducted)    │
   │     ...                        │   │     ...                        │
   │   }                            │   │   }                            │
   │ }                              │   │ }                              │
   └────────────────────────────────┘   └────────────────────────────────┘
                    │                                    │
                    │                                    │
                    ▼                                    ▼
              ┌─────────┐                          ┌─────────┐
              │ 5. Render│                         │ 5. Render│
              │ new state│                         │ new state│
              │          │                         │          │
              │ - Stars: │                         │ - Board: │
              │   45→20  │                         │   damaged│
              │ - Opp    │                         │ - Opp    │
              │   board  │                         │   stars  │
              │   shows  │                         │   reduced│
              │   holes  │                         │          │
              └─────────┘                          └─────────┘
```

### Message Types Reference

| Type | Direction | Purpose |
|------|-----------|---------|
| `join_game` | Client → Server | Player joins game room |
| `game_start` | Server → Clients | Game begins (both players ready) |
| `player_input` | Client → Server | Movement/rotation/drop input |
| `ability_activation` | Client → Server | Player uses ability |
| `state_update` | Server → Clients | Broadcast game state (every tick) |
| `ability_received` | Server → Client | Notify target of ability used on them |
| `opponent_disconnected` | Server → Client | Opponent left/disconnected |
| `game_finished` | Server → Clients | Game over (winner determined) |
| `debug_ping` | Client → Server | RTT measurement request |
| `debug_pong` | Server → Client | RTT measurement response |

---

## Development Workflow

### Running Locally

```bash
# 1. Install dependencies
pnpm install

# 2. Start dev servers (run in separate terminals)

# Terminal 1: PartyKit server
cd packages/partykit
pnpm dev

# Terminal 2: Web client
cd packages/web
pnpm dev

# Terminal 3: Run tests
cd packages/partykit
pnpm test --watch
```

### Testing Abilities

**Option 1: Debug Panel (Fast)**
1. Open game: `http://localhost:5173/game/test?debug=true`
2. Open debug panel (Ctrl+Shift+D)
3. Click ability buttons to test instantly

**Option 2: Unit Tests (Thorough)**
```bash
cd packages/partykit
pnpm test
```

**Example Test**:
```typescript
it('should apply circle_bomb - clears radius on lock', () => {
  const state = new ServerGameState('player1', 12345, []);

  // Lock some pieces to have blocks on board
  for (let i = 0; i < 5; i++) {
    state.processInput('hard_drop');
  }

  const blocksBefore = countBlocks(state.gameState.board.grid);

  state.applyAbility('circle_bomb');
  state.processInput('hard_drop'); // Lock the bomb piece

  const blocksAfter = countBlocks(state.gameState.board.grid);
  expect(blocksAfter).toBeLessThan(blocksBefore);
});
```

### Adding New Abilities

1. **Define metadata** (`packages/game-core/src/abilities.ts`):
```typescript
export const ABILITIES = {
  my_new_ability: {
    id: 'my_new_ability',
    type: 'my_new_ability',
    name: 'My New Ability',
    shortName: 'NEW',
    description: 'Does something cool',
    cost: 30,
    category: 'buff', // or 'debuff'
    duration: 5000, // 5 seconds, or 0 for instant
    icon: '🎯',
    color: '#00ff00',
  },
};
```

2. **Implement effect** (`packages/game-core/src/abilityEffects.ts`):
```typescript
export function applyMyNewAbility(board: Board): Board {
  // Modify board and return new state
  const newGrid = board.grid.map(row => [...row]);
  // ... your logic ...
  return { ...board, grid: newGrid };
}
```

3. **Add server handler** (`packages/partykit/src/ServerGameState.ts`):
```typescript
applyAbility(abilityType: string): void {
  switch (abilityType) {
    // ... existing abilities ...

    case 'my_new_ability':
      this.gameState.board = applyMyNewAbility(this.gameState.board);
      break;
  }
}
```

4. **Write tests** (`packages/partykit/src/__tests__/ServerGameState.test.ts`):
```typescript
it('should apply my_new_ability', () => {
  state.applyAbility('my_new_ability');
  // Assert expected behavior
  expect(/* ... */).toBe(/* ... */);
});
```

5. **Export from game-core** (`packages/game-core/src/index.ts`):
```typescript
export { applyMyNewAbility } from './abilityEffects';
```

6. **Rebuild game-core**:
```bash
cd packages/game-core
pnpm build
```

### Debugging Issues

**Issue: "Ability doesn't work"**
1. Check debug panel event log - Is message sent?
2. Check server logs - Is ability received?
3. Check player stars - Enough to activate?
4. Check unit tests - Does effect work in isolation?

**Issue: "Desynced state between players"**
1. Check if inputs are deterministic
2. Verify both players receive state updates
3. Check for client-side prediction bugs
3. Review server tick logic

**Issue: "Matchmaking stuck"**
1. Check PartyKit logs for queue status
2. Verify rank tier calculation
3. Check if multiple players in same tier
4. Test with 2+ concurrent users

---

## Architecture Decision Records

### Why Server-Authoritative?

**Decision**: All game logic runs on server, clients only render state

**Reasons**:
1. **Anti-cheat**: Client can't forge inputs or modify state
2. **Fairness**: Both players see same game state
3. **Spectating**: Easy to add spectator mode later
4. **Replays**: Server can record full game state

**Trade-offs**:
- ✅ Fair, cheat-proof gameplay
- ✅ Easier to debug (single source of truth)
- ❌ Higher server costs (stateful servers)
- ❌ Input latency (round-trip to server)

### Why PartyKit?

**Decision**: Use PartyKit for multiplayer instead of custom WebSocket server

**Reasons**:
1. **Stateful rooms**: Built-in support for game sessions
2. **Scaling**: Automatic room distribution
3. **Developer experience**: Simple API, fast deployment
4. **Hibernation**: Rooms auto-cleanup when empty

**Trade-offs**:
- ✅ Fast development (days vs weeks)
- ✅ Built-in scaling and room management
- ❌ Vendor lock-in
- ❌ Less control over networking layer

### Why Monorepo?

**Decision**: Use pnpm workspaces instead of separate repos

**Reasons**:
1. **Shared code**: game-core used by both client and server
2. **Type safety**: TypeScript types shared across packages
3. **Atomic changes**: Update game logic and tests together
4. **Simplified deployment**: Single build pipeline

**Trade-offs**:
- ✅ Code reuse between packages
- ✅ Easier refactoring across boundaries
- ❌ More complex build setup
- ❌ Larger repo size

---

## Future Considerations

### Planned Features

1. **Spectator Mode**: Watch live games (easy with server-auth)
2. **Replays**: Download and replay matches (deterministic RNG helps)
3. **Ranked Matchmaking**: MMR-based matching (refine rank tiers)
4. **Custom Loadouts**: Players choose 5 abilities before match
5. **Mobile Support**: Touch controls + Capacitor integration
6. **Tournament Mode**: Bracket system for competitive play

### Scalability

**Current Limits**:
- ~1000 concurrent games per PartyKit instance
- WebSocket connections per game: 2
- State broadcast frequency: 1Hz (1000ms tick)

**Scaling Strategy**:
- **Horizontal**: More PartyKit instances auto-scale
- **Vertical**: Optimize tick rate (reduce to 500ms if needed)
- **Sharding**: Multiple matchmaking rooms for different regions

### Technical Debt

1. **Client-side prediction**: Add optimistic rendering for inputs (reduce perceived latency)
2. **Ability balancing**: Need playtesting data to tune costs/durations
3. **Error handling**: Improve WebSocket reconnection logic
4. **Mobile optimization**: Add haptic feedback and adaptive controls

---

## Glossary

| Term | Definition |
|------|------------|
| **Server-Authoritative** | Server owns game state; clients send inputs only |
| **Deterministic** | Same inputs always produce same outputs |
| **Tick** | Server game loop iteration (1000ms default) |
| **Buff** | Ability that enhances your own gameplay |
| **Debuff** | Ability that disrupts opponent's gameplay |
| **Star** | Currency earned by clearing lines, spent on abilities |
| **Seed** | Initial value for deterministic random number generation |
| **Room** | PartyKit instance managing one game session |
| **RTT** | Round-trip time (ping latency) |
| **State Update** | Server broadcast of current game state |

---

## Contributing

When modifying the codebase:

1. **Run tests**: `pnpm test` before committing
2. **Update docs**: Keep this file in sync with changes
3. **Test locally**: Use debug mode to verify networking
4. **Follow patterns**: Use established ability patterns
5. **Document decisions**: Add notes for future developers

---

## Support

**Questions?** Check these resources:
- PartyKit docs: https://docs.partykit.io
- Supabase docs: https://supabase.com/docs
- Debug mode: Add `?debug=true` to any game URL

**Found a bug?** Include:
- Debug panel event log (export to JSON)
- Steps to reproduce
- Expected vs actual behavior

---

*Last updated: 2025 - Spec 011 implementation complete*
