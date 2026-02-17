# Tetris Battle

Server-authoritative 1v1 Tetris with matchmaking, friend challenges, abilities, and progression.

## Workspace

- `packages/game-core` - deterministic game logic + ability catalog
- `packages/partykit` - realtime backend (`game`, `matchmaking`, `presence`)
- `packages/web` - React frontend
- `supabase` - canonical fresh-start schema + migration

## Quick Start

```bash
pnpm install
pnpm --filter @tetris-battle/game-core build
pnpm --filter web dev
```

Required env vars are loaded by the web app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PARTYKIT_HOST`

## Scripts

```bash
pnpm --filter @tetris-battle/game-core test
pnpm --filter @tetris-battle/partykit test
pnpm --filter web test
pnpm --filter web build
npm run test:integration:deployed
```

## Database

Canonical schema:

- `supabase/complete-schema.sql`
- `supabase/migrations/001_fresh_start.sql`

Active tables:

- `user_profiles`
- `match_results`
- `friendships`
- `friend_challenges`

## Ability System

Ability metadata is centralized in:

- `packages/game-core/src/abilities.json`

All UI labels/costs/descriptions and server validation should derive from that file.

## Architecture Doc

See:

- `CLAUDE.md`
