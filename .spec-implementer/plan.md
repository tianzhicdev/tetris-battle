# Implementation Plan for Spec 001: AI Players

## Overview
- Total steps: 12
- Estimated new files: 9
- Estimated modified files: 6

## Steps

### Step 1: Setup Test Framework for game-core

**Files to modify:**
- `packages/game-core/package.json` — Add vitest dependencies and test scripts

**Implementation details:**
Add to devDependencies:
```json
"vitest": "^1.0.0",
"@types/node": "^20.0.0"
```

Add to scripts:
```json
"test": "vitest",
"test:watch": "vitest --watch",
"test:ui": "vitest --ui"
```

**Files to create:**
- `packages/game-core/vitest.config.ts` — Vitest configuration

Content:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Test:**
- Run: `cd packages/game-core && pnpm install`
- Run: `pnpm test --run` (should report 0 tests)

**Verify:**
- `pnpm test --run` executes without errors
- vitest command is available

---

### Step 2: Implement AI Core Logic (aiPlayer.ts)

**Files to create:**
- `packages/game-core/src/ai/aiPlayer.ts` — Core AI decision-making logic

**Implementation details:**

Export these types:
```typescript
export interface AIMove {
  type: 'left' | 'right' | 'rotate_cw' | 'rotate_ccw' | 'hard_drop';
}

export interface AIDecision {
  moves: AIMove[];
  targetPosition: Position;
  targetRotation: number;
  score: number;
}

export interface BoardEvaluation {
  aggregateHeight: number;
  completeLines: number;
  holes: number;
  bumpiness: number;
}
```

Implement these functions:

1. `evaluateBoard(board: Board): BoardEvaluation`
   - Calculate aggregateHeight: sum of column heights
   - Calculate completeLines: count full rows
   - Calculate holes: count empty cells with filled cell above
   - Calculate bumpiness: sum of abs(height[i] - height[i+1])

2. `scoreBoard(eval: BoardEvaluation, weights: AIWeights): number`
   - Return weighted sum: weights.aggregateHeight * eval.aggregateHeight + ...
   - Use negative weights for bad metrics (holes, bumpiness, height)
   - Use positive weight for completeLines

3. `findBestPlacement(board: Board, piece: Tetromino, weights: AIWeights): AIDecision`
   - Iterate all rotations (0-3)
   - For each rotation, iterate all horizontal positions (-2 to board.width+2)
   - For each candidate: use getHardDropPosition to find where it lands
   - Simulate lockPiece + clearLines
   - Score the resulting board
   - Return the placement with best score

4. `generateMoves(currentPiece: Tetromino, targetPosition: Position, targetRotation: number): AIMove[]`
   - Calculate rotation difference → generate 'rotate_cw' moves
   - Calculate horizontal difference → generate 'left'/'right' moves
   - Add 'hard_drop' at end
   - Return ordered array of moves

Reference existing engine functions from research.md (isValidPosition, movePiece, rotatePiece, lockPiece, clearLines, getHardDropPosition).

**Test:**
- Create `packages/game-core/src/ai/__tests__/aiPlayer.test.ts`
- Test cases:
  1. evaluateBoard with known board state returns correct metrics
  2. findBestPlacement on empty board with I-piece chooses flat placement
  3. generateMoves produces correct move sequence
- Run: `pnpm test -- aiPlayer`

**Verify:**
- All tests pass
- Build succeeds: `pnpm build`

---

### Step 3: Implement AI Difficulty Presets (aiDifficulty.ts)

**Files to create:**
- `packages/game-core/src/ai/aiDifficulty.ts` — Difficulty configurations

**Implementation details:**

Export types:
```typescript
export interface AIWeights {
  aggregateHeight: number;
  completeLines: number;
  holes: number;
  bumpiness: number;
}

export type AIDifficultyLevel = 'easy' | 'medium' | 'hard';

export interface AIDifficultyConfig {
  weights: AIWeights;
  moveDelay: number; // milliseconds between moves
  randomMoveChance: number; // 0-1 probability
  useAbilities: 'never' | 'random' | 'strategic';
  abilityThreshold: number; // stars needed to consider using ability
}
```

Export const:
```typescript
export const AI_DIFFICULTIES: Record<AIDifficultyLevel, AIDifficultyConfig> = {
  easy: {
    weights: { aggregateHeight: -0.3, completeLines: 5, holes: -3, bumpiness: -0.2 },
    moveDelay: 300,
    randomMoveChance: 0.3,
    useAbilities: 'never',
    abilityThreshold: 999,
  },
  medium: {
    weights: { aggregateHeight: -0.5, completeLines: 8, holes: -7, bumpiness: -0.4 },
    moveDelay: 150,
    randomMoveChance: 0.1,
    useAbilities: 'random',
    abilityThreshold: 200,
  },
  hard: {
    weights: { aggregateHeight: -0.8, completeLines: 10, holes: -10, bumpiness: -0.6 },
    moveDelay: 80,
    randomMoveChance: 0,
    useAbilities: 'strategic',
    abilityThreshold: 150,
  },
};
```

Export helper:
```typescript
export function shouldMakeRandomMove(difficulty: AIDifficultyLevel): boolean {
  return Math.random() < AI_DIFFICULTIES[difficulty].randomMoveChance;
}
```

**Test:**
- Create `packages/game-core/src/ai/__tests__/aiDifficulty.test.ts`
- Test cases:
  1. AI_DIFFICULTIES contains all three levels
  2. Easy has higher randomMoveChance than hard
  3. shouldMakeRandomMove over 1000 trials produces ~30% for easy (within ±5%)
- Run: `pnpm test -- aiDifficulty`

**Verify:**
- Tests pass
- Build succeeds

---

### Step 4: Implement AI Persona Generation (aiPersona.ts)

**Files to create:**
- `packages/game-core/src/ai/aiPersona.ts` — Bot name/identity generation

**Implementation details:**

Export types:
```typescript
export interface AIPersona {
  id: string; // "bot_<name>"
  name: string;
  difficulty: AIDifficultyLevel;
  rank: number;
  isBot: true; // Flag for internal use only
}
```

Export const (array of 20+ bot names):
```typescript
const BOT_NAMES = [
  'TetrisBot_42', 'BlockMaster', 'RowClearer', 'StackAttack',
  'LineBuster', 'PiecePerfect', 'GridWarrior', 'ComboKing',
  'TetrisNinja', 'StackSensei', 'DropZone', 'ClearMachine',
  'BlockBuster', 'RowRanger', 'PiecePlayer', 'GridGuru',
  'LineLeader', 'StackStriker', 'TetrisTrainer', 'ComboChamp',
  'PuzzlePro', 'BlockBrigade', 'RowRuler', 'GridGlider'
];
```

Export function:
```typescript
export function generateAIPersona(targetRank?: number): AIPersona {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

  // If targetRank provided, match difficulty to it
  // Otherwise pick random difficulty
  let difficulty: AIDifficultyLevel;
  let rank: number;

  if (targetRank) {
    // Match difficulty: easy (200-600), medium (700-1300), hard (1400-2200)
    if (targetRank < 700) {
      difficulty = 'easy';
      rank = 200 + Math.floor(Math.random() * 400);
    } else if (targetRank < 1400) {
      difficulty = 'medium';
      rank = 700 + Math.floor(Math.random() * 600);
    } else {
      difficulty = 'hard';
      rank = 1400 + Math.floor(Math.random() * 800);
    }
    // Adjust toward target within range
    rank = Math.floor((rank + targetRank) / 2);
  } else {
    // Random
    difficulty = ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as AIDifficultyLevel;
    rank = difficulty === 'easy' ? 200 + Math.floor(Math.random() * 400)
         : difficulty === 'medium' ? 700 + Math.floor(Math.random() * 600)
         : 1400 + Math.floor(Math.random() * 800);
  }

  return {
    id: `bot_${name}_${Date.now() % 10000}`,
    name,
    difficulty,
    rank,
    isBot: true,
  };
}
```

**Test:**
- In `packages/game-core/src/ai/__tests__/aiPersona.test.ts`:
  1. Generate 100 personas without targetRank → all have unique IDs, ranks in appropriate ranges
  2. Generate persona with targetRank=1000 → difficulty is medium, rank is ±300 from 1000
  3. All personas have isBot: true
- Run: `pnpm test -- aiPersona`

**Verify:**
- Tests pass
- Build succeeds

---

### Step 5: Create AI Module Barrel Export

**Files to create:**
- `packages/game-core/src/ai/index.ts` — Barrel export for AI module

**Implementation details:**
```typescript
export * from './aiPlayer';
export * from './aiDifficulty';
export * from './aiPersona';
```

**Files to modify:**
- `packages/game-core/src/index.ts` (line 8, after existing exports)

Add:
```typescript
export * from './ai';
```

**Test:**
- In `packages/game-core/src/ai/__tests__/aiPlayer.test.ts`, add import test:
  ```typescript
  import { findBestPlacement, AI_DIFFICULTIES, generateAIPersona } from '@tetris-battle/game-core';
  ```
  Verify all exports are accessible from main package

**Verify:**
- Build succeeds
- No TypeScript errors

---

### Step 6: Modify Matchmaking Server for AI Fallback

**Files to modify:**
- `packages/partykit/src/matchmaking.ts`

**Implementation details:**

1. Modify `QueuedPlayer` interface (line 3):
```typescript
interface QueuedPlayer {
  id: string;
  connectionId: string;
  joinedAt: number;
  rank?: number; // ← Add this (already exists per research)
}
```

2. In `handleJoinQueue` method (line 29), store player rank if available:
```typescript
this.queue.push({
  id: playerId,
  connectionId: conn.id,
  joinedAt: Date.now(),
  rank: data.rank, // ← Add this
});
```

3. Add new method `checkAIFallback` after `tryMatch` (line 90):
```typescript
checkAIFallback() {
  const now = Date.now();
  const AI_FALLBACK_TIMEOUT = 10000; // 10 seconds

  for (const player of this.queue) {
    if (now - player.joinedAt >= AI_FALLBACK_TIMEOUT) {
      // Remove from queue
      this.queue = this.queue.filter(p => p.id !== player.id);

      // Generate AI opponent
      const aiPersona = generateAIPersona(player.rank);
      const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`AI fallback: matching ${player.id} vs ${aiPersona.id}`);

      // Send match_found with AI flag
      const conn = [...this.room.getConnections()].find(c => c.id === player.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'match_found',
          roomId,
          player1: player.id,
          player2: aiPersona.id,
          aiOpponent: aiPersona, // ← Include AI persona data
        }));
      }

      break; // Process one at a time
    }
  }
}
```

4. Import at top of file (line 1):
```typescript
import { generateAIPersona } from '@tetris-battle/game-core';
```

5. Modify `tryMatch` to call `checkAIFallback` (line 59):
```typescript
tryMatch() {
  // Need at least 2 players
  if (this.queue.length < 2) {
    // Check for AI fallback
    this.checkAIFallback();
    return;
  }

  // existing matching logic...
}
```

6. Add interval to periodically check AI fallback in constructor (line 13):
```typescript
constructor(readonly room: Party.Room) {
  // Check for AI fallback every 2 seconds
  setInterval(() => this.checkAIFallback(), 2000);
}
```

**Test:**
- Manual test: Start partykit dev server, connect one client, wait 11 seconds
- Verify client receives match_found with aiOpponent field

**Verify:**
- Partykit server builds without errors
- No TypeScript errors
- Console logs show "AI fallback" message after 10s

---

### Step 7: Implement AI Game Loop in Game Room Server

**Files to modify:**
- `packages/partykit/src/game.ts`

**Implementation details:**

1. Import AI modules at top (line 1):
```typescript
import {
  createInitialGameState,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  isValidPosition,
  getHardDropPosition,
  createTetromino,
  getRandomTetromino,
  findBestPlacement,
  AI_DIFFICULTIES,
  type AIPersona,
  type GameState as CoreGameState,
  type Tetromino,
  type Board,
} from '@tetris-battle/game-core';
```

2. Add fields to `GameRoomServer` class (line 18):
```typescript
export default class GameRoomServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();
  roomStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winnerId: string | null = null;

  // AI fields
  aiPlayer: AIPersona | null = null;
  aiGameState: CoreGameState | null = null;
  aiInterval: ReturnType<typeof setInterval> | null = null;
  aiMoveQueue: AIMove[] = [];
  aiLastMoveTime: number = 0;
```

3. Modify `handleJoinGame` to detect AI match (line 58):
```typescript
handleJoinGame(playerId: string, conn: Party.Connection, aiOpponent?: AIPersona) {
  this.players.set(playerId, {
    playerId,
    connectionId: conn.id,
    gameState: null,
  });

  // If AI opponent provided, set it up
  if (aiOpponent) {
    this.aiPlayer = aiOpponent;
    this.players.set(aiOpponent.id, {
      playerId: aiOpponent.id,
      connectionId: 'ai', // Fake connection ID
      gameState: null,
    });
  }

  console.log(`Player ${playerId} joined. Total players: ${this.players.size}`);

  // If we have 2 players, start game
  if (this.players.size === 2 && this.roomStatus === 'waiting') {
    this.roomStatus = 'playing';

    this.broadcast({
      type: 'game_start',
      players: Array.from(this.players.keys()),
    });

    // Start AI game loop if AI match
    if (this.aiPlayer) {
      this.startAIGameLoop();
    }
  }

  // ... rest of existing code
}
```

4. Add `startAIGameLoop` method (after handleJoinGame):
```typescript
startAIGameLoop() {
  if (!this.aiPlayer) return;

  // Initialize AI game state
  this.aiGameState = createInitialGameState();
  this.aiGameState.currentPiece = createTetromino(
    this.aiGameState.nextPieces[0],
    this.aiGameState.board.width
  );
  this.aiGameState.nextPieces.shift();
  this.aiGameState.nextPieces.push(getRandomTetromino());

  const config = AI_DIFFICULTIES[this.aiPlayer.difficulty];

  this.aiInterval = setInterval(() => {
    if (!this.aiGameState || !this.aiGameState.currentPiece || this.aiGameState.isGameOver) {
      return;
    }

    const now = Date.now();

    // Rate limit moves based on difficulty
    if (now - this.aiLastMoveTime < config.moveDelay) {
      return;
    }

    // If no moves queued, decide next placement
    if (this.aiMoveQueue.length === 0) {
      const decision = findBestPlacement(
        this.aiGameState.board,
        this.aiGameState.currentPiece,
        config.weights
      );
      this.aiMoveQueue = decision.moves;
    }

    // Execute next move
    const move = this.aiMoveQueue.shift();
    if (!move) return;

    let newPiece = this.aiGameState.currentPiece;

    switch (move.type) {
      case 'left':
        newPiece = movePiece(newPiece, -1, 0);
        break;
      case 'right':
        newPiece = movePiece(newPiece, 1, 0);
        break;
      case 'rotate_cw':
        newPiece = rotatePiece(newPiece, true);
        break;
      case 'rotate_ccw':
        newPiece = rotatePiece(newPiece, false);
        break;
      case 'hard_drop':
        newPiece.position = getHardDropPosition(this.aiGameState.board, newPiece);
        // Lock piece
        this.aiGameState.board = lockPiece(this.aiGameState.board, newPiece);
        const { board, linesCleared } = clearLines(this.aiGameState.board);
        this.aiGameState.board = board;
        this.aiGameState.linesCleared += linesCleared;
        this.aiGameState.score += linesCleared * 100;

        // Spawn next piece
        this.aiGameState.currentPiece = createTetromino(
          this.aiGameState.nextPieces[0],
          this.aiGameState.board.width
        );
        this.aiGameState.nextPieces.shift();
        this.aiGameState.nextPieces.push(getRandomTetromino());

        // Check game over
        if (!isValidPosition(this.aiGameState.board, this.aiGameState.currentPiece)) {
          this.aiGameState.isGameOver = true;
          this.handleGameOver(this.aiPlayer!.id);
        }

        break;
    }

    // Validate and update piece
    if (move.type !== 'hard_drop') {
      if (isValidPosition(this.aiGameState.board, newPiece)) {
        this.aiGameState.currentPiece = newPiece;
      }
    }

    this.aiLastMoveTime = now;

    // Broadcast AI state to human opponent
    const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
    if (humanPlayer) {
      const conn = this.getConnection(humanPlayer.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'opponent_state_update',
          state: this.aiGameState,
        }));
      }
    }
  }, 50); // Check every 50ms, but moveDelay controls actual move rate
}
```

5. Clean up AI interval in `onClose` (line 174):
```typescript
onClose(conn: Party.Connection) {
  // Clear AI interval if exists
  if (this.aiInterval) {
    clearInterval(this.aiInterval);
    this.aiInterval = null;
  }

  // existing cleanup logic...
}
```

**Test:**
- Manual test: Start AI match, observe AI state updates in browser dev tools
- Verify AI pieces move and lock automatically

**Verify:**
- No TypeScript errors in partykit build
- AI game loop runs and broadcasts states
- Human player sees opponent board updating

---

### Step 8: Modify Frontend Matchmaking UI

**Files to modify:**
- `packages/web/src/components/PartykitMatchmaking.tsx`

**Implementation details:**

1. Add state for queue timer (line 12):
```typescript
const [queuePosition, setQueuePosition] = useState<number>(-1);
const [queueDuration, setQueueDuration] = useState<number>(0);
const [dots, setDots] = useState('');
```

2. Add timer effect (after dots effect, line 26):
```typescript
useEffect(() => {
  // Track queue duration
  const start = Date.now();
  const interval = setInterval(() => {
    setQueueDuration(Math.floor((Date.now() - start) / 1000));
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

3. Modify message text (line 109-112):
```typescript
<p style={{ opacity: 0.8, marginBottom: 'clamp(25px, 6.25vw, 30px)', fontSize: 'clamp(14px, 3.5vw, 16px)', color: '#aaa', fontWeight: '600' }}>
  {queueDuration >= 8
    ? 'Expanding search...'
    : queuePosition === 1
    ? "You're next! Waiting for another player..."
    : 'Searching for a worthy opponent...'}
</p>
```

**Test:**
- Manual test: Enter matchmaking, verify message changes after 8 seconds

**Verify:**
- "Expanding search..." appears after 8 seconds
- UI functions normally

---

### Step 9: Modify Post-Match Screen for AI Match Rewards

**Files to modify:**
- `packages/web/src/components/PostMatchScreen.tsx`

**Implementation details:**

1. Add `isAiMatch` prop to interface (line 4):
```typescript
interface PostMatchScreenProps {
  outcome: 'win' | 'loss' | 'draw';
  rewards: MatchRewards;
  onContinue: () => void;
  isAiMatch?: boolean; // ← Add this
}
```

2. Update function signature (line 10):
```typescript
export function PostMatchScreen({ outcome, rewards, onContinue, isAiMatch = false }: PostMatchScreenProps) {
```

3. Modify coin display (line 86-95):
```typescript
<div style={{
  fontSize: '20px',
  color: '#ffaa00',
  marginBottom: '10px',
}}>
  🪙 +{rewards.coins} Coins{isAiMatch ? ' (AI Match - 50%)' : ''}
</div>
```

4. Modify XP display (line 116-125):
```typescript
<div style={{
  fontSize: '20px',
  color: '#00ffff',
  marginBottom: '10px',
}}>
  ⭐ +{rewards.xp} XP{isAiMatch ? ' (AI Match - 50%)' : ''}
</div>
```

**Test:**
- Manual test: Complete AI match, verify reward text shows "(AI Match - 50%)"

**Verify:**
- Post-match screen displays correctly for both human and AI matches
- No TypeScript errors

---

### Step 10: Modify Rewards System for AI Matches

**Files to modify:**
- `packages/web/src/lib/rewards.ts`

**Implementation details:**

1. Add `isAiMatch` parameter to function signature (line 19):
```typescript
export async function awardMatchRewards(
  userId: string,
  outcome: 'win' | 'loss' | 'draw',
  linesCleared: number,
  abilitiesUsed: number,
  matchDuration: number,
  opponentId: string,
  isAiMatch: boolean = false // ← Add this
): Promise<MatchRewards | null> {
```

2. Apply AI match penalty to rewards (after totalCoins calculation, line 70):
```typescript
let totalCoins = baseCoins + performanceBonus + streakBonus + firstWinBonus;
let totalXp = baseXp + winBonus;

// Apply AI match penalty
if (isAiMatch) {
  totalCoins = Math.floor(totalCoins * 0.5);
  totalXp = Math.floor(totalXp * 0.5);
}
```

3. Set rankChange to 0 for AI matches (line 91):
```typescript
await progressionService.saveMatchResult({
  id: crypto.randomUUID(),
  userId,
  opponentId,
  outcome,
  linesCleared,
  abilitiesUsed,
  coinsEarned: totalCoins,
  xpEarned: totalXp,
  rankChange: isAiMatch ? 0 : 0, // ← Already 0, but make explicit
  rankAfter: profile.rank,
  opponentRank: 1000,
  duration: matchDuration,
  timestamp: Date.now(),
});
```

**Test:**
- Unit test: Call awardMatchRewards with isAiMatch=true, verify coins/XP are 50%
- Compare with isAiMatch=false for same outcome

**Verify:**
- AI matches award 50% rewards
- rankChange is 0 for AI matches
- Match history records correct opponentId (starts with "bot_")

---

### Step 11: Write AI Unit Tests

**Files to create:**
- `packages/game-core/src/ai/__tests__/aiPlayer.test.ts`
- `packages/game-core/src/ai/__tests__/aiDifficulty.test.ts`
- `packages/game-core/src/ai/__tests__/aiPersona.test.ts`

**Implementation details:**

Create comprehensive tests covering all spec verification criteria:

**aiPlayer.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import {
  evaluateBoard,
  findBestPlacement,
  generateMoves,
  createBoard,
  createTetromino,
  movePiece,
  lockPiece,
} from '@tetris-battle/game-core';

describe('AI Player', () => {
  it('evaluates board metrics correctly', () => {
    const board = createBoard();
    // Place some blocks to create known state
    // ... test aggregateHeight, holes, bumpiness
  });

  it('chooses placement that does not increase holes (hard difficulty)', () => {
    // Create board with potential hole
    // Run AI decision
    // Verify chosen placement doesn't create hole
  });

  it('places I-piece flat on empty board (hard difficulty)', () => {
    const board = createBoard();
    const piece = createTetromino('I', 10);
    const decision = findBestPlacement(board, piece, AI_DIFFICULTIES.hard.weights);

    // Verify rotation 0 or 2 (flat)
    expect([0, 2]).toContain(decision.targetRotation);
  });

  it('generates correct move sequence', () => {
    const piece = createTetromino('T', 10);
    const target = { x: 7, y: 18 };
    const moves = generateMoves(piece, target, 1);

    // Verify moves lead to target
    // ... apply moves and check final position
  });
});
```

**aiDifficulty.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import { AI_DIFFICULTIES, shouldMakeRandomMove } from '@tetris-battle/game-core';

describe('AI Difficulty', () => {
  it('easy AI produces worse boards than hard AI', () => {
    // Simulate 100 pieces with each difficulty
    // Measure final board quality
    // Verify easy has more holes/height than hard
  });

  it('random move chance matches configuration', () => {
    let randomCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldMakeRandomMove('easy')) randomCount++;
    }

    // Easy has 30% random chance
    expect(randomCount).toBeGreaterThan(250);
    expect(randomCount).toBeLessThan(350);
  });
});
```

**aiPersona.test.ts:**
```typescript
import { describe, it, expect } from 'vitest';
import { generateAIPersona } from '@tetris-battle/game-core';

describe('AI Persona', () => {
  it('generates unique personas', () => {
    const personas = Array.from({ length: 100 }, () => generateAIPersona());
    const ids = personas.map(p => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(100);
  });

  it('ranks fall within difficulty ranges', () => {
    const personas = Array.from({ length: 100 }, () => generateAIPersona());

    personas.forEach(p => {
      if (p.difficulty === 'easy') {
        expect(p.rank).toBeGreaterThanOrEqual(200);
        expect(p.rank).toBeLessThanOrEqual(600);
      } else if (p.difficulty === 'medium') {
        expect(p.rank).toBeGreaterThanOrEqual(700);
        expect(p.rank).toBeLessThanOrEqual(1300);
      } else {
        expect(p.rank).toBeGreaterThanOrEqual(1400);
        expect(p.rank).toBeLessThanOrEqual(2200);
      }
    });
  });

  it('all personas have isBot flag', () => {
    const personas = Array.from({ length: 50 }, () => generateAIPersona());
    expect(personas.every(p => p.isBot === true)).toBe(true);
  });

  it('matches difficulty to target rank', () => {
    const persona = generateAIPersona(1000);
    expect(persona.difficulty).toBe('medium');
    expect(Math.abs(persona.rank - 1000)).toBeLessThanOrEqual(300);
  });
});
```

**Test:**
- Run: `cd packages/game-core && pnpm test`
- All tests should pass

**Verify:**
- Test coverage includes all spec criteria
- Build succeeds after tests

---

### Step 12: Integration Testing and Manual Verification

**Files to verify:**
- All modified files build without errors
- Both game-core and partykit packages build
- Frontend builds

**Implementation details:**

Run build commands:
```bash
# Build game-core
cd packages/game-core && pnpm build

# Build web (which uses game-core)
cd ../web && pnpm build

# Test partykit (TypeScript check)
cd ../partykit && npx tsc --noEmit
```

Manual smoke tests:
1. Start dev server: `pnpm dev` (from root)
2. Start Partykit: `cd packages/partykit && pnpm dev`
3. Open browser, join matchmaking
4. Wait 11+ seconds → should match with AI
5. Observe AI opponent board updating
6. Complete match → verify rewards show "AI Match - 50%"
7. Check match history has opponentId starting with "bot_"

**Test:**
- Run all unit tests: `cd packages/game-core && pnpm test --run`
- Verify all pass

**Verify:**
- All 13 spec verification criteria are met (see Verification Mapping below)
- No TypeScript errors
- No console errors during manual testing
- AI matches function identically to human matches from UI perspective

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| 1. AI placement evaluation (no holes) | Step 2, Step 11 |
| 2. AI placement (I-piece flat on empty board) | Step 2, Step 11 |
| 3. AI move generation (correct sequence) | Step 2, Step 11 |
| 4. Difficulty presets (easy vs hard board quality) | Step 3, Step 11 |
| 5. Random move chance (30% for easy) | Step 3, Step 11 |
| 6. Persona generation (unique names, rank ranges) | Step 4, Step 11 |
| 7. Ability usage (medium/hard AI) | Step 7 (AI game loop) |
| 8. Matchmaking timeout (11s → AI match) | Step 6, Step 12 |
| 9. AI game loop (30s test) | Step 7, Step 12 |
| 10. Ability interaction (AI receives ability) | Step 7 (handleAbilityActivation) |
| 11. Match completion (bot_ prefix in history) | Step 10, Step 12 |
| 12. Reward reduction (50% coins/XP) | Step 10, Step 12 |
| 13. Rank unchanged (AI matches) | Step 10, Step 12 |
| 14-16. Manual smoke tests | Step 12 |

---

## Build/Test Commands

**Build all:**
```bash
pnpm build:all
```

**Test game-core:**
```bash
cd packages/game-core
pnpm test          # Watch mode
pnpm test --run    # Run once
pnpm test -- ai    # Run AI tests only
```

**Type check partykit:**
```bash
cd packages/partykit
npx tsc --noEmit
```

**Run dev servers:**
```bash
# Terminal 1: Frontend
pnpm dev

# Terminal 2: Partykit
cd packages/partykit && pnpm dev
```
