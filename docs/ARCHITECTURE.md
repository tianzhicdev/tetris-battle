# Architecture Overview

This project is a server-authoritative multiplayer Tetris system.

## Runtime Layout

- `packages/game-core`: deterministic logic + ability definitions
- `packages/partykit`: realtime backend
  - `matchmaking` party
  - `game` party
  - `presence` party
- `packages/web`: React client
- `supabase`: persistence for profiles, match history, friends, challenges

## Core Principles

- Gameplay state is authoritative on PartyKit (`game` party).
- Client sends input/intents only and renders server snapshots.
- Ability metadata is centralized in `packages/game-core/src/abilities.json`.
- Supabase is not used for realtime gameplay state sync.

## Active Data Tables

- `user_profiles`
- `match_results`
- `friendships`
- `friend_challenges`

Canonical SQL:

- `supabase/complete-schema.sql`

## Detailed Reference

For implementation-level architecture and invariants, see `CLAUDE.md`.
