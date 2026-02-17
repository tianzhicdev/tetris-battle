# Tetris Battle Architecture

## 1. System Overview

Tetris Battle is a server-authoritative 1v1 Tetris game:

- **Frontend**: `packages/web` (React + Vite)
- **Game Logic Core**: `packages/game-core` (deterministic TypeScript logic)
- **Realtime Backend**: `packages/partykit` (PartyKit parties for game/matchmaking/presence)
- **Persistence**: Supabase (profiles, match history, friends, challenges)

Authoritative gameplay state lives in PartyKit only. Supabase is used for account/progression/social data.

## 2. Runtime Components

### `packages/game-core`

- Pure game logic: board state, piece movement/locking, line clear, stars, abilities.
- Single source of ability metadata: `packages/game-core/src/abilities.json`.
- Ability runtime helpers:
  - `ABILITIES`
  - `ABILITY_IDS`
  - `ABILITY_LIST`
  - `isAbilityType()`
  - `getAbilityById()`

### `packages/partykit`

Parties:

- `matchmaking` (`src/matchmaking.ts`):
  - queue players
  - match human vs human
  - AI fallback after timeout
- `game` (`src/game.ts`):
  - owns match lifecycle and authoritative state broadcast
  - validates inputs
  - validates and applies ability activations
  - disconnect during active match => disconnecting player loses
- `presence` (`src/presence.ts`):
  - lightweight online/in-game presence fanout only
  - no friend-challenge business logic

Per-player authoritative game simulation is implemented by `src/ServerGameState.ts`.

### `packages/web`

Primary app path:

- `App.tsx`
  - auth gate (`AuthWrapper`)
  - menu, matchmaking, multiplayer routing
- `components/PartykitMatchmaking.tsx`
  - PartySocket matchmaking client UI
- `components/ServerAuthMultiplayerGame.tsx`
  - renders local/opponent server state
  - sends player inputs + ability activation requests
  - visual effects and debug panel
- `services/partykit/ServerAuthGameClient.ts`
  - game room socket protocol client
- `services/partykit/presence.ts`
  - presence-only socket client

Removed legacy paths:

- Supabase realtime gameplay sync services (`gameSync`, DB-backed matchmaking)
- legacy matchmaking component
- unused reconnection manager

## 3. Authoritative Match Flow

1. Player joins matchmaking party.
2. Matchmaking returns `roomId` + players.
3. Each player connects to `party=game`, sends `join_game`.
4. Server starts per-player loops when both players join.
5. Client sends:
   - `player_input`
   - `ability_activation`
6. Server validates and applies updates.
7. Server sends `state_update` snapshots and event responses.
8. On top-out or disconnect, server emits `game_finished`.
9. Client computes rewards and persists profile/match result to Supabase.

## 4. Ability Architecture

All ability catalog metadata must come from:

- `packages/game-core/src/abilities.json`

Behavior layers:

- **Catalog/metadata** (name, shortName, description, cost, duration, category)
- **Core board effects** (`abilityEffects.ts`)
- **Server application logic** (`ServerGameState.applyAbility`)
- **Client visuals** (`ServerAuthMultiplayerGame.tsx`, renderer/animation manager)

When adding a new ability:

1. Add definition to `abilities.json`.
2. Implement/adjust effect in `game-core` and server handling.
3. Add client-side visual handling if needed.
4. Add/adjust tests in `game-core` and/or `partykit`.

## 5. Supabase Data Model

Canonical schema is in:

- `supabase/complete-schema.sql`
- `supabase/migrations/001_fresh_start.sql`

Active tables:

- `user_profiles`
- `match_results`
- `friendships`
- `friend_challenges`

Legacy gameplay tables (`game_rooms`, `game_states`, `game_events`, `ability_activations`, `matchmaking_queue`) were removed from canonical schema.

## 6. Friend Challenge Flow

Friend challenges are database-first:

- create challenge row in `friend_challenges`
- accept/decline/cancel via RPC functions:
  - `accept_challenge`
  - `decline_challenge`
  - `cancel_challenge`
- UI subscribes via Supabase realtime (`useIncomingChallenges`, `useOutgoingChallenges`)

Presence socket is only for friend online status indicators.

## 7. Testing

Core commands:

- `pnpm --filter @tetris-battle/game-core test`
- `pnpm --filter @tetris-battle/partykit test`
- `pnpm --filter web test`
- `pnpm --filter web build`

Integration script for deployed PartyKit:

- `npm run test:integration:deployed`

## 8. Implementation Rules

- Keep gameplay server-authoritative (`ServerAuthMultiplayerGame` path).
- Do not reintroduce Supabase realtime gameplay sync.
- Keep ability metadata centralized in `abilities.json`.
- Prefer typed helpers over ad-hoc `Object.values(...).find(...)` lookups.
- Keep DB schema and code field names aligned (camelCase profile/challenge fields).
