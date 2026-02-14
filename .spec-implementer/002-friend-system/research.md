# Phase 1 Research: Friend System (002)

## Key Architecture Findings

### Database Layer
- **Supabase** with anon key, permissive RLS policies
- Tables use **camelCase quoted columns** (`"userId"`, `"createdAt"`)
- user_profiles primary key: `"userId"` TEXT (Clerk user ID)
- user_profiles has `username TEXT UNIQUE`, `level`, `rank`, `coins`
- Existing migrations: 001-004, next should be **005_friend_system.sql**
- Supabase client at `packages/web/src/lib/supabase.ts` - exports `supabase` client + `progressionService`

### Partykit Server
- 3 parties: `server.ts` (unused), `matchmaking.ts`, `game.ts`
- Config: `packages/partykit/partykit.json`
- Matchmaking uses single global room, in-memory queue
- Game rooms are per-match, identified by `game_TIMESTAMP_RANDOM`
- Message format: JSON `{ type: string, ...data }`
- No existing presence system - need to build from scratch
- Need a new party for presence/challenge relay: could extend matchmaking or create new

### Web App
- React 19, Zustand stores, Framer Motion, inline styles with glassUtils
- Stores: `gameStore.ts`, `abilityStore.ts` - Zustand with `create()`
- MainMenu.tsx: inline styles, mergeGlass(), audio SFX on clicks
- Modal pattern: fixed overlay (z-index 1000), dark bg, glassmorphic container
- Button pattern: mergeGlass(glassPurple/Blue/Gold/Success(), { ...customStyles })
- PartySocket client: `packages/web/src/services/partykit/` (matchmaking.ts, gameSync.ts)
- VITE_PARTYKIT_HOST env var for connection
- No existing test infrastructure in web package (no vitest config)

### Auth Flow
- Clerk provides userId via `useUser()` hook
- AuthWrapper passes profile to GameApp
- Profile fetched from Supabase using Clerk userId
- No JWT integration between Clerk and Supabase (anon key + permissive policies)

## Patterns to Follow
1. Inline styles with glassUtils functions, not CSS-in-JS
2. CamelCase column names in SQL (quoted)
3. Supabase service class pattern (ProgressionService)
4. PartySocket for WS connections
5. Modal overlay: position fixed, rgba(0,0,0,0.92), backdrop blur
6. Button: mergeGlass(), audioManager.playSfx('button_click'), scale transforms
7. State: Zustand stores at `packages/web/src/stores/`
8. Partykit message routing: JSON parse → switch on data.type
