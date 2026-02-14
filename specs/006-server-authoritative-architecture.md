# Spec 006: Server-Authoritative Architecture

## Status
📋 **PLANNED** - Major architectural refactor

## Problem

### Current Architecture (Client-Authoritative)
**Client controls game logic:**
- Each client runs its own game loop (tick every 1000ms)
- Client spawns tetrominos from local RNG
- Client calculates score, line clears, combos
- Client applies ability effects locally
- Client sends "here's my new state" to server
- Server just relays state to opponent

**Issues:**
1. **Cheating possible**: Client can manipulate score, pieces, abilities
2. **Inconsistency**: Race conditions, desyncs between clients
3. **Trust required**: Server trusts whatever client sends
4. **Hard to debug**: State divergence between clients

### Desired Architecture (Server-Authoritative)

**Server controls ALL game logic:**
- Server runs game loop for BOTH players
- Server spawns tetrominos (deterministic seed or server RNG)
- Server validates all moves
- Server calculates score, line clears, combos
- Server applies ability effects
- Server broadcasts state to clients

**Client becomes view + input:**
- Client renders what server sends
- Client sends input events only (move left, rotate, drop, use ability)
- Client displays latency-compensated prediction (optional)
- Client cannot manipulate game state

**Benefits:**
1. **No cheating**: Client has zero authority over game state
2. **Consistency**: Single source of truth (server)
3. **Security**: Server validates everything
4. **Easier debugging**: All logic in one place
5. **Fair gameplay**: Impossible to manipulate

## Requirements

### 1. Server Responsibilities

#### Game State Management
- [ ] Server stores authoritative game state for BOTH players
- [ ] Server owns: board, currentPiece, nextPieces, score, stars, linesCleared, comboCount, isGameOver
- [ ] Server generates nextPieces queue (deterministic seed per game)
- [ ] Server spawns new pieces when current piece locks

#### Game Loop (Tick)
- [ ] Server runs tick loop for BOTH players independently
- [ ] Default: 1000ms per tick
- [ ] On tick: move piece down OR lock piece + spawn next
- [ ] Ability modifiers: `speed_up_opponent` → 333ms tick rate

#### Input Processing
- [ ] Server receives input events from client:
  - `move_left` - Move piece left 1 cell
  - `move_right` - Move piece right 1 cell
  - `rotate_cw` - Rotate clockwise
  - `rotate_ccw` - Rotate counter-clockwise
  - `soft_drop` - Move piece down 1 cell (scores points)
  - `hard_drop` - Instant drop to bottom + lock
  - `use_ability` - Activate ability on opponent
- [ ] Server validates each input (is position valid?)
- [ ] Server executes valid inputs immediately
- [ ] Server ignores invalid inputs

#### Ability System
- [ ] Server stores loadout for each player
- [ ] Server tracks stars (ability currency)
- [ ] Server validates ability activation (enough stars? valid target?)
- [ ] Server applies ability effects to target player's board
- [ ] Server broadcasts ability notification to both players

#### Scoring & Progression
- [ ] Server calculates score from line clears
- [ ] Server tracks combo count
- [ ] Server awards stars for line clears
- [ ] Server detects game over (piece collision on spawn)
- [ ] Server determines winner

#### State Broadcasting
- [ ] After EVERY state change, broadcast to both clients:
  - Player's own state (full detail)
  - Opponent's state (board grid, score, stars, pieces)
- [ ] Broadcast rate: immediately after change (debounced to 60fps max)
- [ ] Message format: `{ type: 'state_update', player1State, player2State }`

### 2. Client Responsibilities

#### Input Generation
- [ ] Client captures keyboard/touch input
- [ ] Client sends input events to server (no validation)
- [ ] Client trusts server to execute or ignore
- [ ] No local game state manipulation

#### Rendering
- [ ] Client renders based on server state ONLY
- [ ] Client displays own board from server state
- [ ] Client displays opponent board from server state
- [ ] Client shows current piece, next pieces from server
- [ ] Client displays score, stars from server

#### UI/UX Only
- [ ] Client handles animations (purely visual)
- [ ] Client plays sounds
- [ ] Client shows ability effects (visual only)
- [ ] Client handles haptics

#### Optional: Client-Side Prediction
- [ ] Client can predict movement for latency compensation
- [ ] On input: apply movement locally + send to server
- [ ] On server state: snap to authoritative state
- [ ] Only for smooth UX - server state is truth

### 3. Message Protocol

#### Client → Server Messages

**Input Events:**
```typescript
{
  type: 'player_input',
  playerId: string,
  input: 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop'
}
```

**Ability Activation:**
```typescript
{
  type: 'ability_activation',
  playerId: string,
  abilityType: string,
  targetPlayerId: string
}
```

**Join Game:**
```typescript
{
  type: 'join_game',
  playerId: string,
  loadout: string[], // e.g., ['earthquake', 'screen_shake']
}
```

#### Server → Client Messages

**State Update (60fps max):**
```typescript
{
  type: 'state_update',
  timestamp: number,
  yourState: {
    board: number[][], // 10x20 grid
    currentPiece: Tetromino | null,
    nextPieces: TetrominoType[], // ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
    ghostPiece: Tetromino | null,
    score: number,
    stars: number,
    linesCleared: number,
    comboCount: number,
    isGameOver: boolean,
    activeEffects: string[], // ['speed_up', 'frozen']
  },
  opponentState: {
    board: number[][],
    currentPiece: Tetromino | null,
    score: number,
    stars: number,
    linesCleared: number,
    comboCount: number,
    isGameOver: boolean,
  }
}
```

**Ability Notification:**
```typescript
{
  type: 'ability_used',
  fromPlayerId: string,
  targetPlayerId: string,
  abilityType: string,
}
```

**Game Over:**
```typescript
{
  type: 'game_over',
  winnerId: string,
  reason: 'opponent_topped_out' | 'opponent_disconnected'
}
```

## Architecture Design

### Server-Side Components

#### GameRoom Class (game.ts)
```typescript
class GameRoom {
  roomId: string;
  player1: PlayerState;
  player2: PlayerState;
  gameLoops: Map<string, NodeJS.Timeout>; // playerId → interval
  rngSeed: number; // Deterministic piece generation

  // Core methods
  onPlayerJoin(playerId: string, loadout: string[]): void;
  onPlayerInput(playerId: string, input: InputType): void;
  onAbilityActivation(playerId: string, abilityType: string, targetId: string): void;

  // Game loop
  startGameLoop(playerId: string): void;
  tick(playerId: string): void; // Move piece down OR lock + spawn

  // Movement validation & execution
  executeMove(playerId: string, input: InputType): boolean;
  validatePosition(board: Board, piece: Tetromino): boolean;

  // Piece management
  spawnPiece(playerId: string): void;
  lockPiece(playerId: string): void;
  generateNextPieces(): TetrominoType[]; // Deterministic from seed

  // Scoring
  clearLines(playerId: string): void;
  calculateScore(linesCleared: number, combo: number): number;
  awardStars(linesCleared: number): number;

  // Abilities
  applyAbility(targetId: string, abilityType: string): void;

  // State broadcasting
  broadcastState(): void; // Send to both clients at 60fps max
}
```

#### PlayerState
```typescript
interface PlayerState {
  playerId: string;
  connectionId: string;
  loadout: string[];

  // Game state
  board: Board;
  currentPiece: Tetromino | null;
  nextPieces: TetrominoType[];
  score: number;
  stars: number;
  linesCleared: number;
  comboCount: number;
  isGameOver: boolean;

  // Effects
  activeEffects: Map<string, EffectState>; // 'speed_up' → { until: timestamp }

  // Tick timing
  tickRate: number; // ms, default 1000, modified by abilities
  lastTickTime: number;
}
```

### Client-Side Components

#### GameClient (replaces game loop)
```typescript
class GameClient {
  socket: PartySocket;
  playerId: string;

  // State (received from server, read-only)
  myState: GameState | null;
  opponentState: OpponentState | null;

  // Input handling
  sendInput(input: InputType): void;
  sendAbilityActivation(abilityType: string): void;

  // State updates
  onStateUpdate(yourState: GameState, opponentState: OpponentState): void;
  onAbilityUsed(abilityType: string, fromPlayerId: string): void;
  onGameOver(winnerId: string): void;

  // Rendering (delegates to TetrisRenderer)
  render(): void;
}
```

#### Input Handler
```typescript
// Keyboard/touch → send to server immediately
function handleKeyDown(key: string) {
  switch(key) {
    case 'ArrowLeft': client.sendInput('move_left'); break;
    case 'ArrowRight': client.sendInput('move_right'); break;
    case 'ArrowUp': client.sendInput('rotate_cw'); break;
    case 'ArrowDown': client.sendInput('soft_drop'); break;
    case ' ': client.sendInput('hard_drop'); break;
  }
}
```

## Implementation Plan

### Phase 1: Server Game Loop
- [ ] Move tick loop to server (game.ts)
- [ ] Server spawns pieces for both players
- [ ] Server tracks state for both players
- [ ] Remove client-side game loop

### Phase 2: Input Processing
- [ ] Client sends input events (not state changes)
- [ ] Server validates and executes inputs
- [ ] Server broadcasts updated state
- [ ] Client renders server state

### Phase 3: Ability System
- [ ] Server validates ability activation
- [ ] Server applies effects to boards
- [ ] Server tracks effect timers
- [ ] Remove client-side ability logic

### Phase 4: Scoring & Game Over
- [ ] Server calculates all scores
- [ ] Server detects game over
- [ ] Server determines winner
- [ ] Remove client-side scoring

### Phase 5: State Sync Optimization
- [ ] Implement delta compression (only send changes)
- [ ] Throttle broadcasts to 60fps
- [ ] Add input buffering on server
- [ ] Optional: client-side prediction for smoothness

## Migration Strategy

### Backward Compatibility
- [ ] Keep old client-authoritative code in separate branch
- [ ] Create new `server-authoritative` branch
- [ ] Implement server-side logic alongside client
- [ ] Feature flag to switch architectures
- [ ] Test both in parallel

### Testing Plan
- [ ] Unit tests for server game loop
- [ ] Unit tests for input validation
- [ ] Unit tests for ability effects
- [ ] Integration tests: two clients + server
- [ ] Load tests: 100 concurrent games
- [ ] Latency tests: 100ms, 200ms, 500ms ping

### Rollout
1. **Development**: Implement on staging server
2. **Testing**: Internal testing with synthetic latency
3. **Beta**: Roll out to 10% of users
4. **Monitor**: Check for desyncs, lag, errors
5. **Full rollout**: If metrics look good, 100% rollout

## Performance Considerations

### Server Load
- **Before**: Server relays messages only (~1KB/s per game)
- **After**: Server runs game logic for all games
  - 100 concurrent games = 100 game loops at 1000ms
  - Estimate: ~2ms per tick (validation + scoring)
  - Total: 200ms CPU per second (manageable)

### Network Traffic
- **Before**: Client sends full state (2KB) every 100ms = 20KB/s
- **After**: Server sends state (2KB) every 16ms (60fps) = 125KB/s
  - Optimization: Delta compression → ~30KB/s
  - Optimization: Only send on change → ~10KB/s

### Latency
- **Before**: No input lag (client-side instant)
- **After**: Input lag = round-trip time (RTT)
  - 50ms RTT = 50ms input lag (acceptable)
  - 200ms RTT = 200ms lag (noticeable)
  - Mitigation: Client-side prediction

## Acceptance Criteria

### Scenario 1: No Cheating Possible
```
GIVEN a player tries to manipulate client code
WHEN they send fake state/score to server
THEN server ignores it and maintains authoritative state
AND player cannot gain unfair advantage
```

### Scenario 2: Consistent State
```
GIVEN two players in a match
WHEN they both see the opponent's board
THEN both clients show IDENTICAL state
AND no desyncs occur
```

### Scenario 3: Fair Ability Effects
```
GIVEN Player A uses 'earthquake' on Player B
WHEN server applies the effect
THEN Player B's board is modified by server
AND Player A cannot manipulate the effect strength
AND both clients see the same result
```

### Scenario 4: Server Validates Everything
```
GIVEN a player sends 'move_left' input
WHEN piece is at left wall
THEN server rejects the move
AND piece does not move
AND client shows correct position
```

### Scenario 5: Deterministic Piece Generation
```
GIVEN two players start a game with seed 12345
WHEN server generates next pieces
THEN both players get same sequence
AND game is reproducible from seed
```

## Success Metrics

- [ ] Zero client-side game logic (100% server-authoritative)
- [ ] Zero desyncs between clients (measured over 1000 games)
- [ ] Input lag <100ms for 95% of players
- [ ] Server handles 500+ concurrent games
- [ ] No cheating possible (verified by security audit)

## Notes

- **Priority**: MEDIUM - This is a major refactor but not blocking
- **Complexity**: HIGH - Requires rewriting core game loop
- **Benefits**: Long-term stability, fairness, anti-cheat
- **Risks**: Latency issues, server load, migration complexity

## Related Issues

- Fixes: Client-side cheating vulnerabilities
- Fixes: State desync bugs (like spec 005 rapid spawning)
- Improves: Multiplayer reliability
- Enables: Future features like replays, spectating, tournaments

## References

- [Valve's Source Engine Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)
- [Gabriel Gambetta: Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Overwatch Gameplay Architecture](https://www.youtube.com/watch?v=W3aieHjyNvw)
