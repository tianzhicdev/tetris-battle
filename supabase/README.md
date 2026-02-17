# Supabase Schema

`complete-schema.sql` is the canonical fresh-start schema.

`migrations/001_fresh_start.sql` is the matching migration entrypoint for initializing a new project.

This schema intentionally removes legacy realtime gameplay tables (`game_rooms`, `game_states`, `game_events`, `ability_activations`, `matchmaking_queue`) because active gameplay is server-authoritative in PartyKit.
