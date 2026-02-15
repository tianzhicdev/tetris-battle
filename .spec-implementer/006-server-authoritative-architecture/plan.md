# Implementation Plan for Spec 006: Server-Authoritative Architecture

## Overview
- Total steps: 22
- Estimated new files: 5
- Estimated modified files: 4
- Complexity: HIGH - Complete architectural inversion
- Est. time: 8-12 hours
- Breaking change: YES - requires coordinated client/server deployment

## Strategy

This is a MAJOR refactor. To minimize risk, we'll:
1. Build server-side game logic first (can test in isolation)
2. Create new client component alongside old one (parallel implementation)
3. Add feature flag to switch between client/server authoritative
4. Test thoroughly before removing old code

## Steps

### Step 1: Add Seeded RNG to game-core

**Files to create:**
- `packages/game-core/src/SeededRandom.ts` — Deterministic RNG class for reproducible piece generation

**Implementation details:**
Create a simple LCG (Linear Congruential Generator) for deterministic randomness:
```typescript
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns random float [0, 1)
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2**32;
    return this.seed / 2**32;
  }

  // Returns random int [0, max)
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
```

**Files to modify:**
- `packages/game-core/src/tetrominos.ts`
  - Add optional `rng?: SeededRandom` parameter to `getRandomTetromino()`
  - If provided, use `rng.nextInt(7)` instead of `Math.random()`
  - Export `getRandomTetrominoSeeded(rng: SeededRandom): TetrominoType`

- `packages/game-core/src/index.ts`
  - Export `SeededRandom`

**Test:**
- Create `packages/game-core/src/__tests__/SeededRandom.test.ts`
- Test cases:
  - Same seed produces same sequence
  - Different seeds produce different sequences
  - Generates all 7 tetromino types eventually
- Run: `pnpm --filter game-core test SeededRandom`

**Verify:**
- Build game-core: `pnpm --filter game-core build`
- Tests pass
- Two RNGs with seed 42 produce identical 100-piece sequences

---

### Step 2: Add Input Types to game-core

**Files to create:**
- `packages/game-core/src/inputTypes.ts` — Type definitions for player inputs

**Implementation details:**
```typescript
export type PlayerInputType =
  | 'move_left'
  | 'move_right'
  | 'rotate_cw'
  | 'rotate_ccw'
  | 'soft_drop'
  | 'hard_drop';

export interface PlayerInput {
  type: 'player_input';
  playerId: string;
  input: PlayerInputType;
  timestamp: number; // Client timestamp for latency measurement
}

export interface AbilityInput {
  type: 'ability_activation';
  playerId: string;
  abilityType: string;
  targetPlayerId: string;
  timestamp: number;
}

export type GameInput = PlayerInput | AbilityInput;
```

**Files to modify:**
- `packages/game-core/src/index.ts`
  - Export `PlayerInputType`, `PlayerInput`, `AbilityInput`, `GameInput`

**Test:**
- No test needed (just types)

**Verify:**
- Build succeeds: `pnpm --filter game-core build`

---

### Step 3: Create Server Game State Manager

**Files to create:**
- `packages/partykit/src/ServerGameState.ts` — Class to manage one player's server-side game state

**Implementation details:**
```typescript
import {
  createInitialGameState,
  createTetromino,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  isValidPosition,
  getHardDropPosition,
  calculateStars,
  STAR_VALUES,
  SeededRandom,
  getRandomTetrominoSeeded,
  type GameState,
  type Tetromino,
  type PlayerInputType,
} from '@tetris-battle/game-core';

export class ServerGameState {
  playerId: string;
  gameState: GameState;
  rng: SeededRandom;
  tickRate: number = 1000; // Base tick rate, modified by abilities
  lastTickTime: number = Date.now();
  loadout: string[] = [];

  constructor(playerId: string, seed: number, loadout: string[]) {
    this.playerId = playerId;
    this.rng = new SeededRandom(seed + playerId.charCodeAt(0)); // Unique seed per player
    this.loadout = loadout;
    this.gameState = this.initializeGame();
  }

  private initializeGame(): GameState {
    const state = createInitialGameState();
    // Override nextPieces with seeded generation
    state.nextPieces = [
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
    ];
    // Spawn first piece
    state.currentPiece = createTetromino(state.nextPieces[0], state.board.width);
    return state;
  }

  // Process player input (returns true if state changed)
  processInput(input: PlayerInputType): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    let newPiece = this.gameState.currentPiece;
    let stateChanged = false;

    switch (input) {
      case 'move_left':
        newPiece = movePiece(newPiece, -1, 0);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'move_right':
        newPiece = movePiece(newPiece, 1, 0);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'rotate_cw':
        newPiece = rotatePiece(newPiece, true);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'rotate_ccw':
        newPiece = rotatePiece(newPiece, false);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'soft_drop':
        return this.movePieceDown(); // Might lock piece

      case 'hard_drop':
        return this.hardDrop();
    }

    return stateChanged;
  }

  // Tick: move piece down or lock
  tick(): boolean {
    return this.movePieceDown();
  }

  private movePieceDown(): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    const newPiece = movePiece(this.gameState.currentPiece, 0, 1);

    if (isValidPosition(this.gameState.board, newPiece)) {
      // Move down
      this.gameState.currentPiece = newPiece;
      return true;
    } else {
      // Lock and spawn next
      this.lockAndSpawn();
      return true;
    }
  }

  private hardDrop(): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    // Move to hard drop position
    this.gameState.currentPiece = {
      ...this.gameState.currentPiece,
      position: getHardDropPosition(this.gameState.board, this.gameState.currentPiece),
    };

    // Lock and spawn next
    this.lockAndSpawn();
    return true;
  }

  private lockAndSpawn(): void {
    if (!this.gameState.currentPiece) return;

    // Lock piece to board
    this.gameState.board = lockPiece(this.gameState.board, this.gameState.currentPiece);

    // Clear lines and update score
    const { board, linesCleared } = clearLines(this.gameState.board);
    this.gameState.board = board;
    this.gameState.linesCleared += linesCleared;

    // Calculate score
    this.gameState.score += linesCleared * 100;

    // Award stars
    const now = Date.now();
    if (linesCleared > 0) {
      const comboWindow = STAR_VALUES.comboWindow;
      if (now - this.gameState.lastClearTime < comboWindow) {
        this.gameState.comboCount++;
      } else {
        this.gameState.comboCount = 0;
      }
      this.gameState.lastClearTime = now;

      const starsEarned = calculateStars(linesCleared, this.gameState.comboCount);
      this.gameState.stars = Math.min(
        STAR_VALUES.maxCapacity,
        this.gameState.stars + starsEarned
      );
    }

    // Spawn next piece
    const nextType = this.gameState.nextPieces[0];
    this.gameState.currentPiece = createTetromino(nextType, this.gameState.board.width);
    this.gameState.nextPieces.shift();
    this.gameState.nextPieces.push(getRandomTetrominoSeeded(this.rng));

    // Check game over
    if (!isValidPosition(this.gameState.board, this.gameState.currentPiece)) {
      this.gameState.isGameOver = true;
    }
  }

  // Get state for broadcasting (sanitized for opponent view)
  getPublicState() {
    return {
      board: this.gameState.board.grid,
      currentPiece: this.gameState.currentPiece,
      score: this.gameState.score,
      stars: this.gameState.stars,
      linesCleared: this.gameState.linesCleared,
      comboCount: this.gameState.comboCount,
      isGameOver: this.gameState.isGameOver,
    };
  }
}
```

**Test:**
- Create `packages/partykit/src/__tests__/ServerGameState.test.ts`
- Test cases:
  - Initialize game with seed produces deterministic pieces
  - Process move_left validates and updates position
  - Process invalid move_left does not update state
  - Hard drop locks piece and spawns next
  - Clearing 4 lines awards tetris stars
  - Game over detected on piece collision
- Run: `cd packages/partykit && npx vitest run ServerGameState`

**Verify:**
- Build succeeds: `pnpm --filter partykit build` (if build script exists, or just run test)
- All tests pass

---

### Step 4: Update GameRoomServer for Server-Authoritative Mode

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

1. **Add imports** (top of file, after existing imports):
```typescript
import { ServerGameState } from './ServerGameState';
import type { PlayerInputType, GameInput } from '@tetris-battle/game-core';
```

2. **Add new class properties** (after line 67, before `messageCounters`):
```typescript
  // Server-authoritative mode
  serverGameStates: Map<string, ServerGameState> = new Map();
  gameLoops: Map<string, NodeJS.Timeout> = new Map();
  lastBroadcastTime: number = 0;
  broadcastThrottle: number = 16; // 60fps = 16ms
  roomSeed: number = 0; // Deterministic seed for this room
```

3. **Initialize room seed in constructor** (add after line 69):
```typescript
  constructor(readonly room: Party.Room) {
    // Generate deterministic seed from room ID
    this.roomSeed = parseInt(room.id.substring(0, 8), 36) || 12345;
  }
```

4. **Add new message handler in onMessage** (add case before 'game_state_update'):
```typescript
      case 'player_input':
        this.handlePlayerInput(data.playerId, data.input);
        break;
```

5. **Add handlePlayerInput method** (add after handleJoinGame, around line 180):
```typescript
  private handlePlayerInput(playerId: string, input: PlayerInputType): void {
    const serverState = this.serverGameStates.get(playerId);
    if (!serverState) {
      console.warn(`[INPUT] No server state for player ${playerId}`);
      return;
    }

    const stateChanged = serverState.processInput(input);
    if (stateChanged) {
      this.broadcastState();
    }
  }
```

6. **Modify handleJoinGame** (replace existing implementation, around line 125-180):
```typescript
  handleJoinGame(playerId: string, conn: Party.Connection, aiOpponent?: AIPersona) {
    // Create player entry
    this.players.set(playerId, {
      playerId,
      connectionId: conn.id,
      gameState: null, // Not used in server-authoritative mode
      metrics: createInitialPlayerMetrics(),
      lastPieceLockTime: Date.now(),
    });

    // Initialize server-side game state for this player
    const loadout: string[] = []; // TODO: Get from join_game message
    const serverState = new ServerGameState(playerId, this.roomSeed, loadout);
    this.serverGameStates.set(playerId, serverState);

    console.log(`[GAME] Player ${playerId} joined with server-side state`);

    // If AI opponent provided, set it up (keep existing AI logic)
    if (aiOpponent) {
      this.aiPlayer = aiOpponent;
      this.players.set(aiOpponent.id, {
        playerId: aiOpponent.id,
        connectionId: 'ai',
        gameState: null,
        metrics: createInitialPlayerMetrics(),
        lastPieceLockTime: Date.now(),
      });
      console.log(`AI opponent ${aiOpponent.id} added to game`);
    }

    console.log(`Player ${playerId} joined. Total players: ${this.players.size}`);

    // If we have 2 players, start game
    if (this.players.size === 2 && this.roomStatus === 'waiting') {
      this.roomStatus = 'playing';

      console.log(`[GAME] Starting server-authoritative game`, {
        player1: Array.from(this.players.keys())[0],
        player2: Array.from(this.players.keys())[1],
        hasAI: !!this.aiPlayer,
        roomId: this.room.id,
        seed: this.roomSeed,
      });

      this.broadcast({
        type: 'game_start',
        players: Array.from(this.players.keys()),
      });

      // Start game loops for all non-AI players
      for (const [pid, serverState] of this.serverGameStates) {
        this.startGameLoop(pid);
      }

      // Start AI game loop if this is an AI match
      if (this.aiPlayer) {
        this.startAIGameLoop();
      }

      // Initial state broadcast
      this.broadcastState();
    }
  }
```

7. **Add startGameLoop method** (add after handleJoinGame):
```typescript
  private startGameLoop(playerId: string): void {
    const serverState = this.serverGameStates.get(playerId);
    if (!serverState) return;

    const loop = () => {
      // Tick the game
      const stateChanged = serverState.tick();

      if (stateChanged) {
        // Check for game over
        if (serverState.gameState.isGameOver) {
          this.handleGameOver(playerId);
          this.stopGameLoop(playerId);
          return;
        }

        this.broadcastState();
      }

      // Schedule next tick (using current tick rate)
      this.gameLoops.set(playerId, setTimeout(loop, serverState.tickRate));
    };

    // Start the loop
    console.log(`[GAME LOOP] Starting for player ${playerId}`);
    this.gameLoops.set(playerId, setTimeout(loop, serverState.tickRate));
  }

  private stopGameLoop(playerId: string): void {
    const loop = this.gameLoops.get(playerId);
    if (loop) {
      clearTimeout(loop);
      this.gameLoops.delete(playerId);
      console.log(`[GAME LOOP] Stopped for player ${playerId}`);
    }
  }
```

8. **Add broadcastState method** (add after stopGameLoop):
```typescript
  private broadcastState(): void {
    // Throttle to 60fps
    const now = Date.now();
    if (now - this.lastBroadcastTime < this.broadcastThrottle) {
      return;
    }
    this.lastBroadcastTime = now;

    // Get all player states
    const playerStates: Record<string, any> = {};
    for (const [playerId, serverState] of this.serverGameStates) {
      playerStates[playerId] = serverState.getPublicState();
    }

    // Include AI state if present
    if (this.aiPlayer && this.aiGameState) {
      playerStates[this.aiPlayer.id] = {
        board: this.aiGameState.board.grid,
        currentPiece: this.aiGameState.currentPiece,
        score: this.aiGameState.score,
        stars: this.aiGameState.stars,
        linesCleared: this.aiGameState.linesCleared,
        comboCount: this.aiGameState.comboCount,
        isGameOver: this.aiGameState.isGameOver,
      };
    }

    // Send to each player: their state + opponent state
    for (const [playerId, playerState] of this.players) {
      if (playerId === this.aiPlayer?.id) continue; // Skip AI

      const conn = this.getConnection(playerState.connectionId);
      if (!conn) continue;

      // Find opponent
      const opponentId = this.getOpponentId(playerId);
      if (!opponentId) continue;

      const yourState = playerStates[playerId];
      const opponentState = playerStates[opponentId];

      if (!yourState || !opponentState) continue;

      conn.send(JSON.stringify({
        type: 'state_update',
        timestamp: now,
        yourState,
        opponentState,
      }));
    }
  }

  private getOpponentId(playerId: string): string | null {
    for (const id of this.players.keys()) {
      if (id !== playerId) return id;
    }
    return null;
  }
```

9. **Modify onClose** (add cleanup for server game states, after AI cleanup around line 726):
```typescript
    // Clean up server game states
    for (const [playerId, player] of this.players) {
      if (player.connectionId === conn.id) {
        this.stopGameLoop(playerId);
        this.serverGameStates.delete(playerId);
        // ... rest of existing cleanup
      }
    }
```

**Test:**
- Manual test: Cannot easily unit test PartyKit server in isolation
- Will verify in Step 7 with integration test

**Verify:**
- File compiles: `cd packages/partykit && npx tsc --noEmit`

---

### Step 5: Modify handleAbilityActivation for Server Validation

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

In `handleAbilityActivation` method (around line 413), add validation BEFORE applying ability:

```typescript
  handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
    // Validate: does player have enough stars?
    const playerState = this.serverGameStates.get(playerId);
    if (playerState) {
      // Server-authoritative mode: validate stars
      const abilityCost = this.getAbilityCost(abilityType);

      if (playerState.gameState.stars < abilityCost) {
        console.warn(`[ABILITY] Player ${playerId} has insufficient stars (${playerState.gameState.stars}/${abilityCost})`);
        return; // Reject
      }

      // Deduct stars
      playerState.gameState.stars -= abilityCost;
      console.log(`[ABILITY] Player ${playerId} used ${abilityType}, stars: ${playerState.gameState.stars}`);
    }

    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer) return;

    // Rest of existing logic (apply to AI or send to human)
    // ... keep existing code
  }
```

**Test:**
- Will verify in integration test (Step 7)

**Verify:**
- File compiles: `cd packages/partykit && npx tsc --noEmit`

---

### Step 6: Create New Client Input Handler

**Files to create:**
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` — New client for server-authoritative mode

**Implementation details:**
```typescript
import PartySocket from 'partysocket';
import type { PlayerInputType } from '@tetris-battle/game-core';

export interface GameStateUpdate {
  timestamp: number;
  yourState: {
    board: any[][];
    currentPiece: any;
    score: number;
    stars: number;
    linesCleared: number;
    comboCount: number;
    isGameOver: boolean;
  };
  opponentState: {
    board: any[][];
    currentPiece: any;
    score: number;
    stars: number;
    linesCleared: number;
    comboCount: number;
    isGameOver: boolean;
  };
}

export class ServerAuthGameClient {
  private socket: PartySocket;
  private playerId: string;
  private roomId: string;

  constructor(roomId: string, playerId: string, host: string, aiOpponent?: any) {
    this.roomId = roomId;
    this.playerId = playerId;

    this.socket = new PartySocket({
      host,
      party: 'game',
      room: roomId,
    });
  }

  connect(
    onStateUpdate: (state: GameStateUpdate) => void,
    onOpponentDisconnected: () => void,
    onGameFinished: (winnerId: string) => void,
    onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void
  ): void {
    this.socket.addEventListener('open', () => {
      console.log(`[SERVER-AUTH] Connected to game room: ${this.roomId}`);
      this.joinGame();
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'game_start':
          console.log('[SERVER-AUTH] Game started:', data);
          break;

        case 'state_update':
          onStateUpdate(data as GameStateUpdate);
          break;

        case 'ability_received':
          if (onAbilityReceived) {
            onAbilityReceived(data.abilityType, data.fromPlayerId);
          }
          break;

        case 'opponent_disconnected':
          onOpponentDisconnected();
          break;

        case 'game_finished':
          onGameFinished(data.winnerId);
          break;
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[SERVER-AUTH] Error:', error);
    });
  }

  private joinGame(): void {
    this.send({
      type: 'join_game',
      playerId: this.playerId,
    });
  }

  // Send player input to server
  sendInput(input: PlayerInputType): void {
    this.send({
      type: 'player_input',
      playerId: this.playerId,
      input,
      timestamp: Date.now(),
    });
  }

  // Send ability activation to server
  activateAbility(abilityType: string, targetPlayerId: string): void {
    this.send({
      type: 'ability_activation',
      playerId: this.playerId,
      abilityType,
      targetPlayerId,
      timestamp: Date.now(),
    });
  }

  private send(data: any): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.socket.close();
  }
}
```

**Test:**
- No unit test needed (will test in integration)

**Verify:**
- Build succeeds: `pnpm --filter web build`

---

### Step 7: Create New Server-Authoritative Game Component

**Files to create:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` — New component that renders server state

**Implementation details:**
This is a SIMPLIFIED version of PartykitMultiplayerGame.tsx:
- NO game loop
- NO gameStore usage
- ONLY renders from server state
- Sends inputs on keyboard/touch events

Copy the structure from PartykitMultiplayerGame.tsx but:
1. Remove gameStore usage (lines 84-104)
2. Remove game loop useEffect (lines 222-251)
3. Remove state sync useEffect (lines 163-209)
4. Replace with ServerAuthGameClient
5. Store yourState and opponentState in local useState
6. Keyboard handlers send inputs instead of calling gameStore methods
7. Render from yourState/opponentState instead of gameState/opponentState

Key changes:
```typescript
// Instead of:
const { gameState, movePieceLeft, tick } = useGameStore();

// Use:
const [yourState, setYourState] = useState<any>(null);
const [opponentState, setOpponentState] = useState<any>(null);
const clientRef = useRef<ServerAuthGameClient | null>(null);

// Initialize client
useEffect(() => {
  const client = new ServerAuthGameClient(roomId, playerId, host, aiOpponent);
  clientRef.current = client;

  client.connect(
    (stateUpdate) => {
      setYourState(stateUpdate.yourState);
      setOpponentState(stateUpdate.opponentState);
    },
    onOpponentDisconnected,
    onGameFinished,
    onAbilityReceived
  );

  return () => client.disconnect();
}, [roomId, playerId]);

// Keyboard handler
const handleKeyDown = (e: KeyboardEvent) => {
  if (!clientRef.current) return;

  switch (e.key) {
    case 'ArrowLeft':
      clientRef.current.sendInput('move_left');
      break;
    case 'ArrowRight':
      clientRef.current.sendInput('move_right');
      break;
    // etc.
  }
};
```

**Test:**
- Manual testing in Step 10

**Verify:**
- Component compiles: `pnpm --filter web build`

---

### Step 8: Add Feature Flag to App.tsx

**Files to modify:**
- `packages/web/src/App.tsx`

**Implementation details:**

1. Add state for server-auth mode (top of App component):
```typescript
const [useServerAuth, setUseServerAuth] = useState(() => {
  // Check URL parameter: ?serverAuth=true
  const params = new URLSearchParams(window.location.search);
  return params.get('serverAuth') === 'true';
});
```

2. Modify game component rendering (find where PartykitMultiplayerGame is rendered):
```typescript
{matchState.status === 'in_game' && matchState.roomId && (
  useServerAuth ? (
    <ServerAuthMultiplayerGame
      roomId={matchState.roomId}
      playerId={profile.userId}
      opponentId={matchState.opponentId || ''}
      theme={currentTheme}
      profile={profile}
      onExit={handleMatchExit}
      aiOpponent={matchState.aiOpponent}
    />
  ) : (
    <PartykitMultiplayerGame
      roomId={matchState.roomId}
      playerId={profile.userId}
      opponentId={matchState.opponentId || ''}
      theme={currentTheme}
      profile={profile}
      onExit={handleMatchExit}
      aiOpponent={matchState.aiOpponent}
    />
  )
)}
```

3. Add import at top:
```typescript
import { ServerAuthMultiplayerGame } from './components/ServerAuthMultiplayerGame';
```

**Test:**
- Manual test: Load with `?serverAuth=true` vs without

**Verify:**
- Build succeeds: `pnpm --filter web build`
- App loads without flag (old mode)
- App loads with `?serverAuth=true` flag (new mode)

---

### Step 9: Test Server Game Loop in Isolation

**Files to create:**
- `packages/partykit/src/__tests__/integration-game-loop.test.ts` — Integration test for server game loop

**Implementation details:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ServerGameState } from '../ServerGameState';

describe('Server Game Loop Integration', () => {
  let state: ServerGameState;

  beforeEach(() => {
    state = new ServerGameState('player1', 12345, []);
  });

  it('should spawn deterministic pieces', () => {
    const pieces1 = state.gameState.nextPieces.slice();

    const state2 = new ServerGameState('player1', 12345, []);
    const pieces2 = state2.gameState.nextPieces.slice();

    expect(pieces1).toEqual(pieces2);
  });

  it('should process valid move left', () => {
    const oldX = state.gameState.currentPiece!.position.x;
    const changed = state.processInput('move_left');

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.position.x).toBe(oldX - 1);
  });

  it('should reject invalid move left at wall', () => {
    // Move piece to left wall
    while (state.processInput('move_left')) {}

    const x = state.gameState.currentPiece!.position.x;
    const changed = state.processInput('move_left');

    expect(changed).toBe(false);
    expect(state.gameState.currentPiece!.position.x).toBe(x);
  });

  it('should lock piece and spawn next on hard drop', () => {
    const firstPiece = state.gameState.currentPiece!.type;
    const secondPiece = state.gameState.nextPieces[0];

    state.processInput('hard_drop');

    expect(state.gameState.currentPiece!.type).toBe(secondPiece);
    expect(state.gameState.nextPieces.length).toBe(5);
  });

  it('should award stars for line clears', () => {
    // Hard drop a piece (won't clear lines with empty board, but tests scoring logic)
    state.processInput('hard_drop');

    // Stars should still be at starting pool (no lines cleared)
    expect(state.gameState.stars).toBe(100);
  });

  it('should detect game over on piece collision', () => {
    // Fill board to top by hard dropping many pieces
    for (let i = 0; i < 50; i++) {
      if (state.gameState.isGameOver) break;
      state.processInput('hard_drop');
    }

    expect(state.gameState.isGameOver).toBe(true);
  });

  it('should tick move piece down', () => {
    const oldY = state.gameState.currentPiece!.position.y;
    const changed = state.tick();

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.position.y).toBe(oldY + 1);
  });
});
```

**Test:**
- Run: `cd packages/partykit && npx vitest run integration-game-loop`

**Verify:**
- All tests pass

---

### Step 10: Manual End-to-End Test

**Test plan:**

1. Start PartyKit server:
   ```bash
   cd packages/partykit && pnpm dev
   ```

2. Start web client:
   ```bash
   cd packages/web && pnpm dev
   ```

3. Open two browser windows:
   - Window 1: `http://localhost:5173?serverAuth=true`
   - Window 2: `http://localhost:5173?serverAuth=true`

4. Test flow:
   - Both players join matchmaking
   - Verify match starts
   - Verify both players see initial pieces
   - Press arrow keys in Window 1, verify piece moves
   - Press arrow keys in Window 2, verify piece moves
   - Hard drop pieces, verify they lock
   - Verify opponent boards update in real-time
   - Verify scores increase on line clears
   - Use ability, verify it applies to opponent
   - Verify ability cost is deducted
   - Play until game over
   - Verify winner is declared

**Verify:**
- ✅ No console errors
- ✅ Pieces move smoothly
- ✅ Opponent state updates in real-time
- ✅ Scores/stars match between clients
- ✅ No desyncs
- ✅ Game over detection works

---

### Step 11: Add Client-Side Prediction (Optional - Phase 5)

**Status:** SKIP for initial implementation
**Reason:** Spec lists this as Phase 5 (optional). Get basic server-authoritative working first.

---

### Step 12: Update CLAUDE.md with Architecture Change

**Files to modify:**
- `CLAUDE.md`

**Implementation details:**

Replace section "### Game Architecture: CLIENT-AUTHORITATIVE" (lines 25-36) with:

```markdown
### Game Architecture: SERVER-AUTHORITATIVE (New) / CLIENT-AUTHORITATIVE (Legacy)

**New Architecture (Server-Authoritative):**
- Server runs game loop for BOTH players
- Server validates all inputs (move, rotate, drop)
- Server calculates score, line clears, combos, abilities
- Server broadcasts authoritative state to clients at 60fps
- Clients send inputs only (keyboard/touch events)
- Clients render what server sends (no local game logic)
- Enable with URL flag: `?serverAuth=true`

**Legacy Architecture (Client-Authoritative):**
- Each client runs its own game loop
- Server acts as a RELAY for opponent state (not authoritative)
- AI opponents are the exception: server runs their game loop
- Default mode (no URL flag)

This means:
- Human vs Human (new): Server runs both game loops, clients send inputs
- Human vs Human (legacy): Both clients run independent game loops, sync state via server
- Human vs AI (both modes): Server runs AI loop

**Migration:** The legacy client-authoritative mode will be removed in a future release once server-authoritative is proven stable.
```

Add new section after "### PartyKit Parties":

```markdown
### Server-Authoritative Game Flow

#### Input Processing:
1. Client presses key → sends `player_input` to server
2. Server validates input (is move valid?)
3. Server updates player's game state
4. Server broadcasts updated state to both clients
5. Clients render new state

#### Game Loop:
1. Server runs tick loop for EACH player (1000ms default)
2. On tick: server moves piece down OR locks + spawns next
3. Server calculates score, stars, line clears
4. Server broadcasts state update
5. Clients render immediately

#### State Broadcast:
- Server sends `state_update` message to both players
- Throttled to 60fps (16ms minimum interval)
- Format: `{ type: 'state_update', yourState: {...}, opponentState: {...} }`
- Includes: board, currentPiece, score, stars, linesCleared, comboCount, isGameOver
```

Update "### Message Flow" to include server-authoritative flow.

**Test:**
- Build docs: (just verify markdown is valid)

**Verify:**
- CLAUDE.md is updated and readable

---

### Step 13: Write Integration Test for Human vs Human

**Files to create:**
- `packages/web/src/__tests__/serverAuthMultiplayer.test.ts`

**Implementation details:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// TODO: Import ServerAuthMultiplayerGame and create mock PartySocket

describe('Server-Authoritative Multiplayer', () => {
  it('should render game board from server state', () => {
    // TODO: Mock ServerAuthGameClient
    // TODO: Render component
    // TODO: Simulate state_update from server
    // TODO: Verify board is rendered
  });

  it('should send input on keyboard press', () => {
    // TODO: Render component
    // TODO: Press arrow key
    // TODO: Verify sendInput was called
  });
});
```

**Note:** Full testing requires mocking PartySocket which is complex. Focus on manual E2E testing for now.

**Test:**
- Skip this step (manual testing sufficient for now)

**Verify:**
- N/A

---

### Step 14: Add Loadout Support to Server

**Files to modify:**
- `packages/web/src/services/partykit/ServerAuthGameClient.ts`
- `packages/partykit/src/game.ts`

**Implementation details:**

1. In ServerAuthGameClient.ts, modify joinGame():
```typescript
  private joinGame(loadout: string[]): void {
    this.send({
      type: 'join_game',
      playerId: this.playerId,
      loadout, // Pass loadout from profile
    });
  }
```

2. In ServerAuthGameClient constructor, accept loadout:
```typescript
  constructor(roomId: string, playerId: string, host: string, loadout: string[], aiOpponent?: any) {
    // ... existing code
    this.loadout = loadout;
  }
```

3. In game.ts, modify handleJoinGame to extract loadout from message:
```typescript
  handleJoinGame(playerId: string, conn: Party.Connection, data: any) {
    const loadout: string[] = data.loadout || [];
    const aiOpponent = data.aiOpponent;

    // ... rest of existing code, pass loadout to ServerGameState
    const serverState = new ServerGameState(playerId, this.roomSeed, loadout);
```

4. In ServerAuthMultiplayerGame.tsx, pass loadout when creating client:
```typescript
  const client = new ServerAuthGameClient(roomId, playerId, host, profile.loadout, aiOpponent);
```

**Test:**
- Manual test: Set loadout in profile, verify it's passed to server

**Verify:**
- Server logs show loadout for each player
- Abilities can be used (validated against loadout)

---

### Step 15: Implement Ability Effects on Server

**Files to modify:**
- `packages/partykit/src/ServerGameState.ts`

**Implementation details:**

Add method to apply ability effects:
```typescript
  applyAbility(abilityType: string): void {
    switch (abilityType) {
      case 'earthquake':
        this.gameState.board = applyEarthquake(this.gameState.board);
        break;

      case 'clear_rows': {
        const { board: clearedBoard } = applyClearRows(this.gameState.board, 5);
        this.gameState.board = clearedBoard;
        break;
      }

      case 'random_spawner':
        this.gameState.board = applyRandomSpawner(this.gameState.board);
        break;

      case 'row_rotate':
        this.gameState.board = applyRowRotate(this.gameState.board);
        break;

      case 'death_cross':
        this.gameState.board = applyDeathCross(this.gameState.board);
        break;

      case 'gold_digger':
        this.gameState.board = applyGoldDigger(this.gameState.board);
        break;

      // Speed modifiers
      case 'speed_up_opponent':
        this.tickRate = 1000 / 3; // 3x faster
        setTimeout(() => { this.tickRate = 1000; }, 10000); // Reset after 10s
        break;

      // Visual/control effects (client-side, server just tracks)
      case 'reverse_controls':
      case 'rotation_lock':
      case 'blind_spot':
      case 'screen_shake':
      case 'shrink_ceiling':
      case 'weird_shapes':
        // These are handled client-side, server doesn't need to do anything
        // But we should track active effects to send to client
        break;

      default:
        console.warn(`Unknown ability type: ${abilityType}`);
    }
  }
```

**Files to modify:**
- `packages/partykit/src/game.ts`

In handleAbilityActivation, apply ability to target's server state:
```typescript
  // After validating and deducting stars...

  // Apply to target player
  const targetServerState = this.serverGameStates.get(targetPlayerId);
  if (targetServerState) {
    targetServerState.applyAbility(abilityType);
    this.broadcastState();
  } else if (this.aiPlayer && targetPlayerId === this.aiPlayer.id) {
    // Apply to AI (existing logic)
    this.applyAbilityToAI(abilityType);
  }

  // Notify clients about ability usage
  this.broadcast({
    type: 'ability_used',
    fromPlayerId: playerId,
    targetPlayerId,
    abilityType,
  });
```

**Test:**
- Manual test: Use abilities, verify they affect opponent board

**Verify:**
- Earthquake removes blocks from opponent
- Speed up makes opponent pieces fall faster
- Clear rows removes bottom rows

---

### Step 16: Handle Active Effects Broadcast

**Files to modify:**
- `packages/partykit/src/ServerGameState.ts`

**Implementation details:**

1. Add activeEffects tracking:
```typescript
  activeEffects: Map<string, number> = new Map(); // abilityType → endTime

  applyAbility(abilityType: string): void {
    // ... existing switch cases

    // For duration-based effects, track them
    const EFFECT_DURATIONS: Record<string, number> = {
      'speed_up_opponent': 10000,
      'reverse_controls': 8000,
      'rotation_lock': 6000,
      'blind_spot': 10000,
      'screen_shake': 12000,
      'shrink_ceiling': 8000,
      'weird_shapes': 0, // Affects next piece only
    };

    const duration = EFFECT_DURATIONS[abilityType];
    if (duration !== undefined) {
      const endTime = Date.now() + duration;
      this.activeEffects.set(abilityType, endTime);
    }

    // ... rest of ability logic
  }

  getActiveEffects(): string[] {
    const now = Date.now();
    const active: string[] = [];

    for (const [ability, endTime] of this.activeEffects) {
      if (endTime > now) {
        active.push(ability);
      } else {
        this.activeEffects.delete(ability);
      }
    }

    return active;
  }
```

2. Include activeEffects in getPublicState():
```typescript
  getPublicState() {
    return {
      // ... existing fields
      activeEffects: this.getActiveEffects(),
    };
  }
```

3. In ServerAuthMultiplayerGame.tsx, apply visual effects based on activeEffects:
```typescript
  // In state update handler
  client.connect(
    (stateUpdate) => {
      setYourState(stateUpdate.yourState);
      setOpponentState(stateUpdate.opponentState);

      // Apply visual effects based on active effects
      const effects = stateUpdate.yourState.activeEffects || [];
      // Update AbilityEffectManager, screen shake, etc.
    },
    // ...
  );
```

**Test:**
- Manual test: Use duration-based abilities, verify they show in activeEffects

**Verify:**
- Screen shake ability triggers visual shake
- Reverse controls reverses input
- Blind spot hides top rows

---

### Step 17: Add Reconnection Handling

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

Add player reconnection logic in onConnect:
```typescript
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connecting to game room ${this.room.id}: ${conn.id}`);

    // Check if this is a reconnection
    for (const [playerId, player] of this.players) {
      if (player.playerId === playerId && player.connectionId !== conn.id) {
        // Reconnecting player
        console.log(`Player ${playerId} reconnecting with new connection ${conn.id}`);
        player.connectionId = conn.id;

        // Resend current state
        this.broadcastState();
        return;
      }
    }

    // New connection - send current room state
    conn.send(JSON.stringify({
      type: 'room_state',
      status: this.roomStatus,
      playerCount: this.players.size,
    }));
  }
```

**Test:**
- Manual test: Disconnect one player (close tab), reconnect

**Verify:**
- Reconnecting player sees current game state
- Game continues without interruption

---

### Step 18: Add Performance Metrics Logging

**Files to create:**
- `packages/partykit/src/PerformanceMonitor.ts`

**Implementation details:**
```typescript
export class PerformanceMonitor {
  private metrics: {
    tickDurations: number[];
    broadcastCounts: number;
    inputCounts: number;
    startTime: number;
  };

  constructor() {
    this.metrics = {
      tickDurations: [],
      broadcastCounts: 0,
      inputCounts: 0,
      startTime: Date.now(),
    };
  }

  recordTick(duration: number): void {
    this.metrics.tickDurations.push(duration);
    if (this.metrics.tickDurations.length > 100) {
      this.metrics.tickDurations.shift(); // Keep last 100
    }
  }

  recordBroadcast(): void {
    this.metrics.broadcastCounts++;
  }

  recordInput(): void {
    this.metrics.inputCounts++;
  }

  getReport(): string {
    const avgTick = this.metrics.tickDurations.reduce((a, b) => a + b, 0) / this.metrics.tickDurations.length;
    const uptime = (Date.now() - this.metrics.startTime) / 1000;

    return `[PERF] Uptime: ${uptime.toFixed(0)}s | Avg Tick: ${avgTick.toFixed(2)}ms | Broadcasts: ${this.metrics.broadcastCounts} | Inputs: ${this.metrics.inputCounts}`;
  }
}
```

**Files to modify:**
- `packages/partykit/src/game.ts`

Add performance monitoring:
```typescript
  perfMonitor: PerformanceMonitor = new PerformanceMonitor();

  // In startGameLoop:
  const tickStart = Date.now();
  const stateChanged = serverState.tick();
  this.perfMonitor.recordTick(Date.now() - tickStart);

  // In broadcastState:
  this.perfMonitor.recordBroadcast();

  // In handlePlayerInput:
  this.perfMonitor.recordInput();

  // Log every 30 seconds:
  setInterval(() => {
    console.log(this.perfMonitor.getReport());
  }, 30000);
```

**Test:**
- Manual test: Play game, check server logs for performance reports

**Verify:**
- Performance metrics logged every 30s
- Average tick duration <5ms
- Broadcast rate ~60/sec during active play

---

### Step 19: Add Delta Compression (Optional - Future Optimization)

**Status:** SKIP for initial implementation
**Reason:** Spec lists this as Phase 5. Implement if network traffic becomes an issue.

---

### Step 20: Remove Old Client-Authoritative Code

**Status:** DO NOT DO YET
**Reason:** Keep legacy mode until server-authoritative is proven in production. Remove in separate PR after monitoring period.

**Future steps:**
1. Remove `?serverAuth` flag
2. Delete PartykitMultiplayerGame.tsx
3. Rename ServerAuthMultiplayerGame.tsx → PartykitMultiplayerGame.tsx
4. Delete PartykitGameSync.ts
5. Remove handleGameStateUpdate from game.ts
6. Update all tests

---

### Step 21: Deploy to Staging and Monitor

**Deployment plan:**

1. Deploy PartyKit server:
   ```bash
   cd packages/partykit && pnpm deploy
   ```

2. Deploy web client with flag enabled for 10% of users:
   - Add A/B test logic to randomly assign `serverAuth=true`
   - Monitor metrics

3. Monitor for 1 week:
   - Desync rate (should be 0%)
   - Input latency (P95 <100ms)
   - Server CPU usage
   - Error rate
   - User reports of lag/issues

**Metrics to track:**
- Matches completed without desync
- Average input latency (client → server → broadcast)
- Server tick performance (avg/P95/P99)
- Broadcast rate (should be ~60fps)
- Ability validation rejections (indicates attempted cheating)

**Verify:**
- 0 desyncs reported
- P95 input latency <100ms
- No server performance degradation
- No increase in error rate

---

### Step 22: Final Verification Against Spec Criteria

**Test all acceptance criteria from spec:**

1. **Scenario 1: No Cheating Possible**
   - Modify client code to send fake high score
   - Verify server ignores it
   - Verify real score is maintained

2. **Scenario 2: Consistent State**
   - Two players in match
   - Verify both see identical opponent board
   - Take screenshots, compare pixel-perfect

3. **Scenario 3: Fair Ability Effects**
   - Player A uses earthquake on Player B
   - Verify server applies effect
   - Verify both clients see same result
   - Verify Player A can't manipulate effect strength

4. **Scenario 4: Server Validates Everything**
   - Send move_left when piece at left wall
   - Verify server rejects
   - Verify piece does not move

5. **Scenario 5: Deterministic Piece Generation**
   - Record seed for game
   - Play game, record piece sequence
   - Restart server with same seed
   - Verify piece sequence is identical

**Success Metrics:**
- ✅ Zero client-side game logic (100% server-authoritative)
- ✅ Zero desyncs between clients (measured over 1000 games)
- ✅ Input lag <100ms for 95% of players
- ✅ Server handles 500+ concurrent games
- ✅ No cheating possible (verified by security audit)

**Verify:**
- All scenarios pass
- All metrics met
- Ready for production rollout

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|----------------|-------------------|
| **Requirements** |
| Server stores authoritative game state for BOTH players | Step 3, 4 |
| Server owns: board, currentPiece, nextPieces, score, stars, linesCleared, comboCount, isGameOver | Step 3 |
| Server generates nextPieces queue (deterministic seed per game) | Step 1, 3 |
| Server spawns new pieces when current piece locks | Step 3 |
| Server runs tick loop for BOTH players independently | Step 4 |
| Default: 1000ms per tick | Step 3 |
| On tick: move piece down OR lock piece + spawn next | Step 3 |
| Ability modifiers: speed_up_opponent → 333ms tick rate | Step 15 |
| Server receives input events from client | Step 4, 6 |
| Server validates each input (is position valid?) | Step 3 |
| Server executes valid inputs immediately | Step 3 |
| Server ignores invalid inputs | Step 3 |
| Server stores loadout for each player | Step 14 |
| Server tracks stars (ability currency) | Step 3 |
| Server validates ability activation (enough stars? valid target?) | Step 5, 15 |
| Server applies ability effects to target player's board | Step 15 |
| Server broadcasts ability notification to both players | Step 15 |
| Server calculates score from line clears | Step 3 |
| Server tracks combo count | Step 3 |
| Server awards stars for line clears | Step 3 |
| Server detects game over (piece collision on spawn) | Step 3 |
| Server determines winner | Step 4 |
| After EVERY state change, broadcast to both clients | Step 4 |
| Broadcast rate: immediately after change (debounced to 60fps max) | Step 4 |
| Client captures keyboard/touch input | Step 7 |
| Client sends input events to server (no validation) | Step 6, 7 |
| Client trusts server to execute or ignore | Step 7 |
| No local game state manipulation | Step 7 |
| Client renders based on server state ONLY | Step 7 |
| Client displays own board from server state | Step 7 |
| Client displays opponent board from server state | Step 7 |
| Client shows current piece, next pieces from server | Step 7 |
| Client displays score, stars from server | Step 7 |
| Client handles animations (purely visual) | Step 7 |
| Client plays sounds | Step 7 (existing code) |
| Client shows ability effects (visual only) | Step 16 |
| **Acceptance Criteria** |
| Scenario 1: No Cheating Possible | Step 22 |
| Scenario 2: Consistent State | Step 22 |
| Scenario 3: Fair Ability Effects | Step 22 |
| Scenario 4: Server Validates Everything | Step 22 |
| Scenario 5: Deterministic Piece Generation | Step 22 |
| **Success Metrics** |
| Zero client-side game logic (100% server-authoritative) | Step 7 |
| Zero desyncs between clients (measured over 1000 games) | Step 21, 22 |
| Input lag <100ms for 95% of players | Step 21 |
| Server handles 500+ concurrent games | Step 18, 21 |
| No cheating possible (verified by security audit) | Step 22 |

## Build/Test Commands

**Build:**
- `pnpm --filter game-core build` - Build shared game logic
- `pnpm --filter partykit build` - Build PartyKit server (if applicable)
- `pnpm --filter web build` - Build web client
- `pnpm build:all` - Build all packages

**Test:**
- `pnpm --filter game-core test` - Run game-core unit tests
- `pnpm --filter web test` - Run web client tests
- `cd packages/partykit && npx vitest run` - Run PartyKit tests
- `pnpm --filter web test serverAuth` - Run server-auth specific tests

**Dev:**
- `cd packages/partykit && pnpm dev` - Start PartyKit server (localhost:1999)
- `cd packages/web && pnpm dev` - Start web client (localhost:5173)

**Manual Test:**
- Open `http://localhost:5173?serverAuth=true` in two windows
- Join matchmaking in both
- Verify game works end-to-end

## Notes

- This is a HIGH-RISK change: Complete architectural inversion
- Keep old code during transition period for rollback safety
- Use feature flag (`?serverAuth=true`) to A/B test
- Monitor performance metrics closely after deployment
- Plan for gradual rollout (10% → 50% → 100%)
- Remove legacy code only after 2+ weeks of stable production usage
