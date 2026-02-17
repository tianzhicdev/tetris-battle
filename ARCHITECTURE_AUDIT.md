# Architecture Audit

## Scope

Full code-quality cleanup pass across:

- `packages/game-core`
- `packages/partykit`
- `packages/web`
- `supabase`
- repository documentation/artifacts

## Findings and Changes

### 1. Ability metadata drift and duplicated lookups

Issue:

- Ability labels/costs/descriptions were repeatedly mapped with ad-hoc `Object.values(...).find(...)`.
- `AbilityType` was manually maintained in `types.ts`, risking mismatch with `abilities.json`.

Fixes:

- `AbilityType` now derives from `abilities.json`.
- Added shared helpers in `packages/game-core/src/abilities.ts`:
  - `ABILITY_IDS`
  - `ABILITY_LIST`
  - `isAbilityType`
  - `getAbilityById`
- Replaced duplicated lookup logic across web/server where safe.
- Added dedicated catalog tests in `packages/game-core/src/__tests__/abilities.test.ts`.

### 2. Legacy/unused gameplay sync paths

Issue:

- Repo still contained Supabase-era realtime gameplay code paths not used by server-authoritative architecture.

Fixes:

- Removed unused legacy files:
  - `packages/web/src/components/Matchmaking.tsx`
  - `packages/web/src/services/matchmaking.ts`
  - `packages/web/src/services/gameSync.ts`
  - `packages/web/src/services/ReconnectionManager.ts`

### 3. Presence system carried unused challenge logic

Issue:

- Presence server/client still contained stale challenge transport logic despite DB-first challenge flow.

Fixes:

- Simplified PartyKit presence to presence-only (online/in-game/offline fanout + heartbeat).
- Removed challenge handling from:
  - `packages/partykit/src/presence.ts`
  - `packages/web/src/services/partykit/presence.ts`
- Updated `packages/web/src/App.tsx` to use simplified presence callbacks.

### 4. Friend/profile schema-field mismatch

Issue:

- Friend service queried legacy `level/rank` fields while runtime profile model uses `matchmakingRating/games*`.

Fixes:

- Updated friend service/profile mapping:
  - `matchmakingRating`
  - `gamesPlayed`
- Updated UI and tests accordingly:
  - `packages/web/src/components/FriendList.tsx`
  - friend service/store/flow tests.

### 5. Theme profile persistence mismatch

Issue:

- Theme service used snake_case column names not aligned with active profile shape.

Fixes:

- Updated to canonical fields:
  - `userId`
  - `themePreference`

### 6. Dead/legacy game-core ability code

Issue:

- `abilityEffects.ts` included unused legacy functions not referenced by active abilities.

Fixes:

- Removed unused exports and replaced tests with active-effect coverage.
- Added deterministic RNG support for additional effects (`row_rotate`, `death_cross`, `createMiniBlock`) and server-side usage.

### 7. SQL migration drift and obsolete tables

Issue:

- Migration chain had conflicting column naming/history and included obsolete gameplay tables.

Fixes:

- Replaced with canonical fresh-start schema:
  - `supabase/complete-schema.sql`
  - `supabase/migrations/001_fresh_start.sql`
- Removed old migration files `001`-`009`.
- Added `supabase/README.md`.
- Removed obsolete root `supabase-schema.sql`.

Canonical active tables now:

- `user_profiles`
- `match_results`
- `friendships`
- `friend_challenges`

### 8. Documentation sprawl and stale artifacts

Issue:

- Repo contained large amounts of historical analysis/spec artifacts and outdated onboarding docs.

Fixes:

- Rewrote:
  - `CLAUDE.md` (current architecture source)
  - `README.md`
  - `docs/ARCHITECTURE.md`
- Removed obsolete analysis/spec docs and archived spec-implementer artifacts from version control.

### 9. Test/tooling quality

Fixes:

- `packages/game-core` tests now run non-watch by default (`vitest run`).
- Added missing `type-check` scripts for:
  - `packages/web`
  - `packages/partykit`
- Updated tests to align with current models and behavior.

## Verification

Validated in this cleanup pass:

- `pnpm -r type-check`
- `pnpm --filter @tetris-battle/game-core test`
- `pnpm --filter @tetris-battle/partykit test`
- `pnpm --filter web test`
- `pnpm --filter web build`

All succeeded.

## Recommended Next Refactors

1. Split `ServerAuthMultiplayerGame.tsx` into smaller modules (network, effects, rendering adapters).
2. Add integration tests for Supabase challenge RPC functions (`accept/decline/cancel` contract).
3. Add a CI workflow that runs `type-check`, all package tests, and web build on every PR.
