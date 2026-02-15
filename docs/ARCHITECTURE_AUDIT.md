# Architecture Audit Findings

Date: 2026-02-15
Scope: comparison of `docs/ARCHITECTURE.md` desired behavior vs current implementation in `packages/game-core`, `packages/partykit`, and `packages/web`.

## Implementation Status (2026-02-15)

Resolved in latest code changes:
- P0-1 game-over resolution in server-authoritative mode.
- P0-2 AI fallback wiring from server-auth client to game room.
- P0-3 AI abilities now apply through the authoritative ability path.
- Server-authoritative mode is now default in web app; legacy PartyKit client-authoritative UI path removed.
- Matchmaking client connection lifecycle hardened (host normalization, connection guard, close-code diagnostics, reduced reconnect churn from callback identity changes).
- Ability activation now returns explicit server accept/reject results (with machine-readable reason) instead of silent drops.
- `weird_shapes` is now pending-until-consumed and no longer expires before next spawn during state broadcasts.

## Critical Findings (P0)

### 1) Server-authoritative game over does not resolve for human players
Evidence:
- `packages/partykit/src/game.ts:160` initializes human `player.gameState` to `null`.
- `packages/partykit/src/game.ts:252` calls `handleGameOver(playerId)` when server state reaches game over.
- `packages/partykit/src/game.ts:853` only handles human loss when `player.gameState` exists; otherwise returns early at `packages/partykit/src/game.ts:858`.

Impact:
- In server-authoritative human-vs-human matches, `game_finished` may never be emitted when a player tops out.

Proposed solution:
- Make `handleGameOver` authoritative-only: read loss/win state from `serverGameStates`, not legacy `player.gameState`.
- Remove early return path based on `player.gameState`.

### 2) AI fallback is broken in server-authoritative client
Evidence:
- `packages/web/src/services/partykit/ServerAuthGameClient.ts:41` accepts `_aiOpponent` but never stores/uses it.
- `packages/web/src/services/partykit/ServerAuthGameClient.ts:108` `join_game` payload does not include `aiOpponent`.
- `packages/partykit/src/game.ts:155` expects `aiOpponent` in `handleJoinGame` to create bot player.

Impact:
- Server-authoritative AI matches can stall in `waiting` because the AI opponent is never attached to the room.

Proposed solution:
- Store `aiOpponent` in `ServerAuthGameClient` and include it in `join_game`.
- Add a server-side validation guard for expected AI payload shape.

### 3) AI abilities are not applied to server game state in server-authoritative mode
Evidence:
- `packages/partykit/src/game.ts:834` AI sends only `ability_received` message to human.
- No call to `targetServerState.applyAbility(...)` in `aiConsiderUsingAbility`.

Impact:
- AI debuffs that should modify authoritative state (for example `earthquake`, `row_rotate`) do not affect gameplay.
- Behavior diverges between AI and human opponents.

Proposed solution:
- Reuse `handleAbilityActivation` or a shared server-side ability application path for AI ability usage.
- Keep `ability_received` as a notification, not as the primary effect mechanism.

## High Findings (P1)

### 4) Room seed generation is effectively constant for `game_*` room IDs
Evidence:
- `packages/partykit/src/game.ts:85` uses `parseInt(room.id.substring(0, 8), 36)`.
- Match room IDs are generated with `game_...` prefix, so parsing often stops at `_`, yielding near-constant seed bases.

Impact:
- Violates desired unique-per-game seed behavior and weakens reproducibility quality.

Proposed solution:
- Hash full `room.id` with a stable hash function to generate seed.
- Add a test proving different room IDs produce different seeds.

### 5) Deterministic gameplay contract is violated by unseeded randomness
Evidence:
- `packages/game-core/src/abilityEffects.ts` uses `Math.random()` in many authoritative effects (for example `:132`, `:171`, `:271`, `:396`, `:455`).
- `packages/partykit/src/game.ts:366` uses `getRandomTetromino()` for AI next piece generation.

Impact:
- Same input stream + same seed does not guarantee same outcomes.

Proposed solution:
- Pass `SeededRandom` through all authoritative random paths (ability effects, AI piece generation, AI decision randomness).
- Reserve `Math.random()` for non-authoritative UI-only behavior.

### 6) Ability metadata drift causes incorrect costs/durations and category behavior
Evidence:
- `packages/partykit/src/game.ts:739` hardcodes costs; missing `deflect_shield` and `piece_preview_plus` so they default to `50`.
- `packages/partykit/src/ServerGameState.ts:320`/`:324`/`:328` hardcode durations that differ from `packages/game-core/src/abilities.json` (for example `rotation_lock`, `blind_spot`, `screen_shake`).
- `packages/partykit/src/ServerGameState.ts:415` classifies `clear_rows` as debuff, while `packages/game-core/src/abilities.json:186` sets it as buff.

Impact:
- Client and server disagree about activation requirements and duration.
- Shield can incorrectly block self-buff behavior (`clear_rows`).

Proposed solution:
- Use `ABILITIES` metadata as single source of truth for cost, duration, and category.
- Remove hardcoded cost/duration/category tables from server logic.

### 7) Server-authoritative mode is not the default path
Evidence:
- `packages/web/src/App.tsx:33` enables server-authoritative mode only when URL has `?serverAuth=true`.
- `packages/web/src/App.tsx:261` otherwise routes to legacy client-authoritative multiplayer component.

Impact:
- Default multiplayer path does not satisfy architecture principle “server is single source of truth.”

Proposed solution:
- Default to server-authoritative mode.
- Keep legacy mode behind an explicit opt-in dev flag if still needed.

## Medium Findings (P2)

### 8) Matchmaking ignores rank-based matching policy
Evidence:
- `packages/partykit/src/matchmaking.ts:131` explicitly matches first two queued players regardless of rank.

Impact:
- Does not meet architecture’s “similar rank” matchmaking behavior.

Proposed solution:
- Implement rank buckets/tiered search window expansion.
- Or update architecture doc if speed-first matchmaking is intentional.

### 9) Missing server-side ability authorization and target validation
Evidence:
- `packages/partykit/src/game.ts:570` validates stars only.
- No enforcement of loadout membership, ability existence in metadata, or category-consistent target selection before applying.

Impact:
- Clients can request unsupported ability-target combinations.
- Server behavior becomes inconsistent and harder to secure.

Proposed solution:
- Validate `abilityType` against shared metadata and player loadout.
- Enforce target rules: buffs only self, debuffs only opponent.
- Reject invalid target before star deduction.

### 10) Game loops are not comprehensively stopped at match finish
Evidence:
- `packages/partykit/src/game.ts:254` stops only the loop for the player that triggered `game_over`.
- No global loop/AI interval shutdown in `handleGameOver`.

Impact:
- Winner-side loop can continue ticking after match completion, wasting resources and mutating hidden state.

Proposed solution:
- Add centralized `endMatch()` cleanup to stop all loops and AI timers exactly once.

### 11) PartyKit TypeScript compilation is currently broken
Evidence (from `pnpm --filter @tetris-battle/partykit exec tsc --noEmit`):
- `packages/partykit/src/matchmaking.ts:193` references `aiPersona.difficulty` which does not exist.
- `packages/partykit/src/__tests__/ServerGameState.test.ts:320` uses callback style incompatible with current typing.

Impact:
- Static type safety for PartyKit package is degraded.

Proposed solution:
- Remove/replace `aiPersona.difficulty` log usage.
- Refactor callback-style test to async/promise or proper typed timers.

### 12) `game-core` tests currently fail due AI move contract mismatch
Evidence:
- `packages/game-core/src/ai/aiPlayer.ts:205` always appends `hard_drop`.
- `packages/game-core/src/ai/__tests__/aiPlayer.test.ts:157`/`:169`/`:180`/`:192` expect no `hard_drop`.
- `pnpm --filter @tetris-battle/game-core test -- --run` reports 4 failures in these assertions.

Impact:
- CI confidence is reduced; behavior contract for AI move generation is unclear.

Proposed solution:
- Decide canonical behavior:
- If hard drop is intended, update tests.
- If gravity-only is intended, remove hard drop from `generateMoves` and adjust AI loop accordingly.

## Recommended Remediation Order

1. Fix game-over resolution and AI match startup in server-authoritative path.
2. Unify ability metadata usage server-side (cost/duration/category/loadout validation).
3. Make deterministic RNG truly seeded for all authoritative randomness.
4. Switch default multiplayer path to server-authoritative mode.
5. Align matchmaking policy with architecture or update architecture to current intent.
6. Repair TypeScript and test-suite contract drift.
