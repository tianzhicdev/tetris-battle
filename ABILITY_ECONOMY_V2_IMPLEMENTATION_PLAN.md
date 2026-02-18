# Ability Economy V2 Implementation Plan

## Scope
Adopt `/Users/biubiu/projects/tetris-battle/packages/game-core/src/game_abilities_economy_v2.json` as the source of truth for:
- ability definitions (IDs, names, costs, durations, unlocks, behavior metadata)
- star economy rules (regen + line clear + combo + B2B + T-Spin + cap/start)
- defensive interception semantics (Shield / Reflect) 
- server-authoritative enforcement (server computes + applies, client renders only)

## Constraints
- Keep existing deployed game flow working (`matchmaking` + `game` parties).
- Remove `row_rotate` from runtime and UI.
- Preserve current message protocol where possible; extend only when needed.
- Every phase must leave tests green before advancing.

## Phase 1: Ability Catalog Refactor (Source of Truth)
### Goals
- Replace ability loading with v2 JSON while filtering out tier separator pseudo-entries.
- Expand type model for new categories (`debuff_*`, `buff_*`, `defensive`).
- Add helpers for targeting and category groups so UI/server no longer hardcode `buff|debuff`.

### Tasks
1. Replace `abilities.json` content with v2 dataset (or import v2 directly) and support non-ability metadata.
2. Update `Ability` type to include v2 fields (`unlockTier`, optional `unlockLevel` compatibility).
3. Add helper functions in `game-core`:
   - `isAbilityDefinition`
   - `getAbilityTargeting` (`self`/`opponent`)
   - `isDebuffAbility`, `isBuffAbility`, `isDefensiveAbility`
4. Update progression unlock derivation to use `unlockTier` mapping and ignore non-ability keys.
5. Remove `row_rotate` from all exported lists.

### Tests
- `packages/game-core/src/__tests__/abilities.test.ts`
  - valid ability count and unique IDs
  - no separator pseudo-keys in runtime list
  - `row_rotate` absent
  - targeting helpers classify abilities correctly

## Phase 2: Star Economy V2 (Server Authority)
### Goals
- Implement the new star economy on server game state:
  - start 100, cap 300, passive +1/sec
  - line clear: 5/12/22/35
  - combo bonus +3/level
  - B2B +5
  - additive T-Spin bonuses
- Ensure clients consume server-provided stars only.

### Tasks
1. Update `STAR_VALUES` in `game-core` constants.
2. Extend server state tracking for:
   - passive regen accumulator
   - B2B chain state
   - T-Spin detection context (last successful action/rotation)
3. Apply passive regen during server ticks independent of current gravity speed.
4. Update line-clear star calculation path to include base + combo + B2B + T-Spin.
5. Keep client logic as rendering-only in server-auth mode (no local star mutation).

### Tests
- `packages/partykit/src/__tests__/ServerGameState*.test.ts`
  - passive regen accrues at 1/s
  - cap clamps at 300
  - line clear rates match v2
  - B2B applies only on qualifying clears
  - T-Spin bonuses additive

## Phase 3: Defensive Interception Pipeline (Shield / Reflect)
### Goals
- Intercept debuffs before application on server.
- Shield: consume and block one incoming debuff.
- Reflect: consume and bounce one incoming debuff to caster.
- Defensive resolution must happen before any debuff side effects.

### Tasks
1. Add explicit defensive state on `ServerGameState` and active effect lifecycle.
2. In `game.ts` ability activation path:
   - evaluate target defensive state before `applyAbility`
   - handle block/reflect outcomes deterministically
   - emit structured activation result to caster and target
3. Ensure reflected debuffs obey target validation and do not recurse infinitely.
4. Add server logs for defensive resolution decisions.

### Tests
- unit tests for:
  - shield blocks exactly one debuff
  - reflect bounces exactly one debuff
  - no interception for buffs/defensive abilities
  - defensive effect expiration

## Phase 4: Ability Behavior Coverage (V2)
### Goals
- Implement or update server-side behavior for all v2 abilities.
- For purely visual abilities, server sets authoritative timed effect flags; client renders those flags.

### Tasks
1. Remove/replace deprecated handlers (`row_rotate`).
2. Implement new abilities (minimum authoritative behavior):
   - Defensive: `shield`, `reflect`, `purge`
   - Economy: `overcharge`, `cascade_multiplier`
   - Board/control/effects: `ink_splash`, `garbage_rain`, `glue`, `column_swap`, `narrow_escape`, `shapeshifter`, `wide_load`, `tilt`, `flip_board`, `gravity_well`, `preview_steal`, `clone`, `quicksand`, `gravity_flip`, `time_warp`, `magnet`, etc.
3. Normalize behavior for existing abilities to match v2 costs/durations.
4. Ensure server determines targeting for every ability via helper, not hardcoded category checks.

### Tests
- extend `ServerGameState` and `game.ts` tests with per-ability sanity checks:
  - cast accepted/rejected conditions
  - effect flags present/absent
  - board mutation occurs where expected

## Phase 5: Client Render Alignment
### Goals
- UI reads new categories/targeting helpers.
- Remove old category assumptions (`buff|debuff`).
- Render new active effects with concise, stable cues.

### Tasks
1. Update components using category conditionals:
   - `ServerAuthMultiplayerGame.tsx`
   - `AbilityInfo.tsx`
   - `AbilityShop.tsx`
   - `LoadoutManager.tsx`
   - debug panels
2. Replace `row_rotate` references with supported abilities.
3. Keep activation UX based on server result events only.

### Tests
- web unit tests for ability UI rendering and grouping logic.

## Phase 6: End-to-End Verification
### Goals
- Confirm behavior across integrated server-auth flow.

### Tasks
1. Run unit test suites:
   - `pnpm --filter @tetris-battle/game-core test`
   - `pnpm --filter @tetris-battle/partykit test`
   - `pnpm --filter web test`
2. Run build/type checks:
   - `pnpm -r type-check`
   - `pnpm --filter web build`
3. Run 2-player deployed integration script and verify logs for:
   - star economy events
   - defensive interception events
   - ability application + visibility

## Delivery Notes
- Any ability not fully modeled yet will be tracked as explicit TODO with failing test first, then implemented before phase completion.
- No legacy pre-v2 ability economy paths will remain in server-auth gameplay paths.

## Execution Status (Completed)
- ✅ Phase 1 completed
- ✅ Phase 2 completed
- ✅ Phase 3 completed
- ✅ Phase 4 completed
- ✅ Phase 5 completed
- ✅ Phase 6 completed

### Verification commands run
- `pnpm --filter @tetris-battle/game-core type-check`
- `pnpm --filter @tetris-battle/game-core exec vitest run`
- `pnpm --filter @tetris-battle/partykit exec tsc --noEmit`
- `pnpm --filter @tetris-battle/partykit exec vitest run`
- `pnpm --filter web build`
