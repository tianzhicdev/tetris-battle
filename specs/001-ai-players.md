# Spec 001: AI Players

## Goal

Add AI bot opponents so players can always find a match, especially during early growth when the player base is small. AI players should feel like real opponents — they play on a real board using real game logic, have varying difficulty, and are visually indistinguishable from human players in the match UI.

## Context

- Existing codebase: monorepo with `packages/game-core` (engine, abilities, types) and `packages/web` (React frontend)
- Multiplayer runs on Partykit WebSocket server
- Game engine is in `packages/game-core/src/engine.ts` — pure functions for board manipulation
- Matchmaking currently pairs two human players via WebSocket messages

## Requirements

### 1. AI Engine (`packages/game-core/src/ai/`)

Create an AI module in game-core (platform-agnostic, no DOM dependencies).

**`aiPlayer.ts`** — Core AI logic:
- The AI operates on a standard `GameState` and uses existing engine functions (`movePiece`, `rotatePiece`, `lockPiece`, `clearLines`, `isValidPosition`, `getHardDropPosition`)
- Each game tick, the AI evaluates all possible placements for the current piece (all rotations × all horizontal positions) and picks the best one using a scoring heuristic
- Scoring heuristic weights (tunable per difficulty):
  - `aggregateHeight`: sum of column heights (lower is better, negative weight)
  - `completeLines`: number of lines that would be cleared (positive weight)
  - `holes`: number of empty cells with a filled cell above (negative weight)
  - `bumpiness`: sum of absolute height differences between adjacent columns (negative weight)
- The AI should simulate placing the piece at each candidate position and score the resulting board
- The AI returns a sequence of moves (left/right/rotate/drop) to reach the chosen position, NOT the final board state — moves are fed into the normal game loop

**`aiDifficulty.ts`** — Difficulty presets:
- `easy`: High tolerance for holes/bumpiness, slow move execution (300ms between moves), occasionally makes suboptimal choices (30% random move chance), never uses abilities
- `medium`: Balanced weights, moderate speed (150ms between moves), 10% random move chance, uses abilities when stars > 200 (picks randomly from loadout)
- `hard`: Optimized weights, fast execution (80ms between moves), 0% random moves, uses abilities strategically (targets opponent when they have high stacks)

**`aiPersona.ts`** — Bot identity:
- Define a list of 20+ bot names (e.g., "TetrisBot_42", "BlockMaster", "RowClearer", "StackAttack", etc.)
- Each bot has a randomly assigned difficulty and a fake rank appropriate to that difficulty (easy: 200-600, medium: 700-1300, hard: 1400-2200)
- Bots should have a `isBot: true` flag in their player data but this should NOT be exposed in the match UI

### 2. Partykit Server Integration

Modify the Partykit server to support AI matches:

**Matchmaking changes:**
- If a human player has been in the matchmaking queue for more than 10 seconds, automatically create a match with an AI opponent
- The AI difficulty should be selected to roughly match the human player's rank (±300 rank points)
- The server runs the AI game loop server-side — the AI does NOT connect via WebSocket as a client

**AI game loop on server:**
- When an AI match starts, the server creates a `GameState` for the AI and runs a `setInterval` loop
- Each interval tick: the AI decides its next move, the server applies it to the AI's game state, and broadcasts the updated state to the human player (same message format as human opponent updates)
- The AI should also respond to abilities cast on it — apply the effect to its game state and adapt
- The AI game loop should respect the same timing rules as human players (gravity, lock delay, etc.)

**Message format:**
- No new message types needed — the AI's state updates use the existing `game_state` message format
- Ability messages from/to the AI use existing `ability_activated` format
- The human client should not be able to distinguish AI from human based on message format

### 3. Web Frontend Changes

Minimal UI changes — the point is AI players are invisible:
- No "playing against AI" indicator (the match should feel real)
- The post-match screen should work identically for AI matches (show XP, coins, rank change)
- AI matches should award reduced rewards: 50% XP, 50% coins, NO rank change
- In the matchmaking UI, show a subtle "Finding opponent..." message; after 8 seconds show "Expanding search..." (before the 10s AI fallback triggers)

### 4. Progression Integration

- AI match results are saved to `match_history` with `opponent_id` set to the bot's generated ID (prefixed with `bot_`)
- AI matches count toward daily quests (lines cleared, abilities used) but NOT toward win-streak quests
- The `users_profile` table does NOT need changes

## File Changes Summary

New files:
- `packages/game-core/src/ai/aiPlayer.ts`
- `packages/game-core/src/ai/aiDifficulty.ts`
- `packages/game-core/src/ai/aiPersona.ts`
- `packages/game-core/src/ai/index.ts`
- `packages/game-core/src/ai/__tests__/aiPlayer.test.ts`
- `packages/game-core/src/ai/__tests__/aiDifficulty.test.ts`

Modified files:
- `packages/game-core/src/index.ts` (export AI module)
- Partykit server file (matchmaking + AI game loop)
- `packages/web/src/components/PartykitMatchmaking.tsx` (queue timer messaging)
- `packages/web/src/components/PostMatchScreen.tsx` (reduced rewards for AI matches)

## Verification Criteria

All of the following must pass for this spec to be considered complete:

### Unit Tests (`packages/game-core/src/ai/__tests__/`)

1. **AI placement evaluation**: Given a known board state and piece, the AI (hard difficulty) should choose a placement that does not increase holes
2. **AI placement evaluation**: Given an empty board and an I-piece, hard AI should place it flat at the bottom (maximizing line clear potential)
3. **AI move generation**: The returned move sequence, when applied to the game state step by step, should result in the piece at the AI's chosen position
4. **Difficulty presets**: Easy AI should produce measurably worse boards than hard AI over 100 simulated pieces (more holes, higher aggregate height)
5. **Random move chance**: Easy AI with 30% random chance should, over 1000 decisions, make approximately 300 random choices (within ±5% tolerance)
6. **Persona generation**: Generate 100 personas — all names should be unique, ranks should fall within difficulty-appropriate ranges
7. **Ability usage**: Medium AI with >200 stars should attempt to use an ability. Hard AI should use abilities when opponent board state is advantageous

### Integration Tests

8. **Matchmaking timeout**: Simulate a solo player in queue for 11 seconds → should be matched with an AI opponent
9. **AI game loop**: Start an AI match, let it run for 30 seconds → AI's board state should have changed (pieces placed, possibly lines cleared)
10. **Ability interaction**: Cast "Reverse Controls" on AI → AI should continue playing (adapting or ignoring the visual effect, but game state should reflect the ability)
11. **Match completion**: AI match ends → match_history record exists with `bot_` prefixed opponent_id
12. **Reward reduction**: AI match win → XP and coins awarded should be exactly 50% of normal human match rewards
13. **Rank unchanged**: AI match win/loss → player's rank should not change

### Manual Smoke Test (run the dev server and verify)

14. Start a multiplayer game, wait 10+ seconds → should get matched and game should play normally
15. The opponent's board should show active piece movement and line clears
16. Post-match screen should display normally

## Run Command

```bash
# After implementation, run this to verify:
cd packages/game-core && pnpm test -- --grep "ai"
# Then run integration tests (if using vitest/jest):
pnpm test -- --grep "ai-integration"
```
