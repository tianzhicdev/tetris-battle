# Tetris Battle — Redesign Proposal
> First-principles architecture review + methodical refactoring plan
> Status: DRAFT — for review before any code changes

---

## 1. Honest Assessment of What We Have

### What's Actually Good

The core architecture choices are sound and should be kept:

- **3-package monorepo** (`game-core` / `partykit` / `web`) — correct separation of concerns
- **`game-core` is pure TypeScript** — no browser/server deps, easily testable, shared between server and client
- **Server-authoritative PartyKit** — correct for competitive games; clients can't cheat board state
- **Supabase for persistence** — correct for profile data, match history, friend system
- **PartyKit for real-time** — correct for low-latency game state; Supabase Realtime only for meta-events (friend requests, challenge notifications)
- **Seeded RNG** (`SeededRandom`) — makes game deterministic and testable
- **Ability JSON config** — data-driven ability system is the right pattern

### What's Messy (Honest)

These accumulated during fast iteration and would bite us at scale:

| Problem | Where | Impact |
|---------|-------|--------|
| Schema drift | 9 migrations vs `complete-schema.sql` diverging | New devs can't trust the schema file |
| Duplicate matchmaking | Supabase polling + PartyKit queue both exist | Confusion, dead code |
| Ability validation in 4 places | abilityStore, friendService, supabase.ts, server | Easy to miss when adding abilities |
| `ProgressionService` inside `supabase.ts` | `lib/supabase.ts` | Mixes client config with business logic |
| 5 unused themes | `themes/` directory | Dead code |
| Challenge hooks: 3 overlapping hooks | `useChallenges`, `useIncomingChallenges`, `useOutgoingChallenges` | Subscription duplication |
| Column naming inconsistency | DB uses both snake_case and camelCase | Caused PGRST204 errors |
| `level` and `xp` columns that do nothing | `user_profiles` | False promise to users |
| Client-side prediction but 1-second tick | `predictionHelpers.ts` | Prediction is worthless at 1000ms ticks |


---

## 2. First-Principles Design

If we were building this fresh, knowing what we know now, here's the design:

### 2.1 The Three Pillars

```
┌─────────────────────────────────────────────────────────┐
│  PILLAR 1: Game Engine (game-core package)              │
│  Pure TS. No deps. Testable in Node/browser/worker.     │
│  Abilities defined in JSON. Engine reads config.        │
└─────────────────────────────────────────────────────────┘
              ↓ imported by both ↓
┌────────────────────────┐   ┌───────────────────────────┐
│  PILLAR 2: Game Server │   │  PILLAR 3: Persistence    │
│  PartyKit (edge)       │   │  Supabase (Postgres)      │
│  One room per game     │   │  Profiles, matches,       │
│  Server-authoritative  │   │  friends, economy         │
│  60fps tick, 16ms RTT  │   │  Realtime for meta-events │
└────────────────────────┘   └───────────────────────────┘
              ↑ WebSocket         ↑ Supabase JS client
┌─────────────────────────────────────────────────────────┐
│  PILLAR 4: Client (web package)                         │
│  React. Zustand. Renders what server says.              │
│  Zero game logic — just input → display.                │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Data Model (Clean Slate)

All columns use **snake_case** (Postgres standard). TypeScript types use camelCase via the Supabase JS type generator. Never again hand-write quoted `"camelCase"` column names.

```sql
-- Single source of truth for user state
CREATE TABLE profiles (
  id          TEXT PRIMARY KEY,          -- Clerk user ID
  username    TEXT UNIQUE NOT NULL,
  coins       INTEGER NOT NULL DEFAULT 0,
  rating      INTEGER NOT NULL DEFAULT 1000,  -- Elo
  wins        INTEGER NOT NULL DEFAULT 0,
  losses      INTEGER NOT NULL DEFAULT 0,
  loadout     TEXT[]  NOT NULL DEFAULT '{}',  -- ability IDs, max 6
  unlocked    TEXT[]  NOT NULL DEFAULT '{"screen_shake","speed_up_opponent","piece_preview_plus","mini_blocks"}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Match history (written by server with service_role key, never client)
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id  TEXT NOT NULL REFERENCES profiles(id),
  player2_id  TEXT NOT NULL REFERENCES profiles(id),
  winner_id   TEXT REFERENCES profiles(id),
  seed        BIGINT NOT NULL,           -- for deterministic replay
  room_id     TEXT NOT NULL,
  duration_s  INTEGER,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-player stats for a match (two rows per match)
CREATE TABLE match_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES matches(id),
  player_id       TEXT NOT NULL REFERENCES profiles(id),
  result          TEXT NOT NULL CHECK (result IN ('win', 'loss')),
  score           INTEGER NOT NULL DEFAULT 0,
  lines_cleared   INTEGER NOT NULL DEFAULT 0,
  abilities_used  JSONB   NOT NULL DEFAULT '[]',
  rating_before   INTEGER NOT NULL,
  rating_change   INTEGER NOT NULL,
  coins_earned    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(match_id, player_id)
);

-- Friend relationships
CREATE TABLE friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL REFERENCES profiles(id),
  addressee_id TEXT NOT NULL REFERENCES profiles(id),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK(requester_id != addressee_id)
);

-- Friend game challenges
CREATE TABLE challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id TEXT NOT NULL REFERENCES profiles(id),
  challenged_id TEXT NOT NULL REFERENCES profiles(id),
  status        TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  room_id       TEXT,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  accepted_at   TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(challenger_id != challenged_id)
);

-- Ability economy: what's unlockable, at what price
-- This IS the source of truth for ability config in the DB
CREATE TABLE ability_catalog (
  id           TEXT PRIMARY KEY,   -- matches abilities.json key
  unlock_coins INTEGER NOT NULL DEFAULT 0,
  is_starter   BOOLEAN NOT NULL DEFAULT FALSE
);
```

### 2.3 Ability System (Single Source of Truth)

The problem: ability metadata lives in `abilities.json`, but pricing/unlock lives scattered in `progression.ts`. They should both live in one place.

```
packages/game-core/src/abilities/
├── catalog.json        ← ALL ability config (behavior, cost, unlock, visuals)
├── schema.ts           ← Zod schema that validates catalog.json at build time
├── effects/
│   ├── buffs.ts        ← Self-enhancement effects
│   ├── debuffs.ts      ← Opponent-targeting effects
│   └── index.ts        ← Handler dispatch table (no switch/case)
└── index.ts            ← Public API
```

Handler dispatch (replaces 200-line `switch` statement):

```typescript
// effects/index.ts
import type { AbilityEffect } from '../types';
import * as Buffs from './buffs';
import * as Debuffs from './debuffs';

export const ABILITY_EFFECTS: Record<string, AbilityEffect> = {
  cross_firebomb:       Buffs.crossFirebomb,
  circle_bomb:          Buffs.circleBomb,
  clear_rows:           Buffs.clearRows,
  // ... one line per ability
  speed_up_opponent:    Debuffs.speedUp,
  reverse_controls:     Debuffs.reverseControls,
  // ...
};

// TypeScript ensures every ability in catalog.json has a handler
type KnownAbilityId = keyof typeof CATALOG;
type _Exhaustive = { [K in KnownAbilityId]: AbilityEffect }; // compile-time check
```

### 2.4 Multiplayer Protocol (Clean)

Six message types, server-authoritative, no ambiguity:

```typescript
// Client → Server
type ClientMessage =
  | { type: 'join';    payload: { player_id: string; loadout: string[]; seed?: number } }
  | { type: 'input';   payload: { action: Action; seq: number } }
  | { type: 'ability'; payload: { ability_id: string; target_id: string } }
  | { type: 'resign' }

// Server → Client
type ServerMessage =
  | { type: 'start';       payload: { room_id: string; seed: number; your_side: 'left'|'right'; tick_ms: number } }
  | { type: 'tick';        payload: { seq: number; you: PlayerSnap; opponent: PlayerSnap } }
  | { type: 'ability_ok';  payload: { ability_id: string; stars_remaining: number } }
  | { type: 'ability_err'; payload: { ability_id: string; reason: string } }
  | { type: 'over';        payload: { winner_id: string | null; reason: 'board_full'|'resign'|'disconnect'|'timeout' } }
  | { type: 'opponent_left' }
```

`PlayerSnap` is a compact state snapshot:
```typescript
interface PlayerSnap {
  board:        Uint8Array;   // 10*20 = 200 bytes, not JSON
  current:      PieceSnap;
  next:         TetrominoType[];
  score:        number;
  stars:        number;
  combo:        number;
  active_fx:    ActiveEffect[]; // debuffs currently applied
}
```

### 2.5 Testing Architecture

The key insight: **test each layer in isolation, use real infrastructure locally for integration**.

```
Unit tests          → game-core (no network, no DB)
Integration tests   → game-core + PartyKit dev server (ws://)
                    → web hooks + Supabase CLI (localhost:54321)
E2E tests           → Full stack (Playwright, two browser contexts)
```

---

## 3. Methodical Refactoring Plan

### The Golden Rule

> **Never refactor more than one layer at a time.**
> The "massive refactor in one shot" failed because it changed DB schema + client code + server code simultaneously. When something breaks, you can't isolate where.

### Phase 0: Test Foundation (Before Any Code Changes)

Before touching anything, build a test harness that proves the current behavior. These become regression tests.

**0.1 — Local infrastructure setup**

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase (Postgres + Realtime + Auth + Studio)
supabase start

# Verify it works
supabase status
# → API URL:         http://localhost:54321
# → Studio URL:      http://localhost:54323
# → anon key:        eyJ...
```

**0.2 — Integration test helpers**

```typescript
// packages/web/src/test-helpers/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const testSupabase = createClient(
  process.env.SUPABASE_URL ?? 'http://localhost:54321',
  process.env.SUPABASE_ANON_KEY ?? '<local anon key>'
);

// Wait for Realtime subscription to be ready
export async function waitForSubscription(channel: RealtimeChannel): Promise<void> {
  return new Promise((res) => channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') res();
  }));
}

// Wait for condition with timeout
export async function waitFor(fn: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise(r => setTimeout(r, 50));
  }
}
```

**0.3 — Mock Clerk auth**

```typescript
// packages/web/src/test-helpers/auth.ts
// Generates a JWT that looks like Clerk's format for tests
import { SignJWT, generateKeyPair } from 'jose';

let keys: Awaited<ReturnType<typeof generateKeyPair>> | null = null;

export async function createTestToken(userId: string): Promise<string> {
  if (!keys) keys = await generateKeyPair('RS256');
  return new SignJWT({ sub: userId, role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(keys.privateKey);
}

// For game logic tests, just use a plain string - no JWT needed
export const TEST_USER_A = 'user_test_aaa';
export const TEST_USER_B = 'user_test_bbb';
```

**0.4 — PartyKit local server helper**

```typescript
// packages/partykit/src/test-helpers/localServer.ts
import { spawn, ChildProcess } from 'child_process';

let server: ChildProcess | null = null;

export async function startLocalPartyKit(): Promise<string> {
  server = spawn('npx', ['partykit', 'dev', '--port', '1999'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });
  // Wait for server ready signal
  await new Promise<void>((res) => {
    server!.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('Ready')) res();
    });
  });
  return 'ws://localhost:1999';
}

export function stopLocalPartyKit(): void {
  server?.kill();
}
```

### Phase 1: Database Cleanup (No Client Code Changes)

**Goal**: Single source of truth for schema. All columns in snake_case.

**1.1 — Write integration tests FIRST for current DB behavior**

```typescript
// packages/web/src/__tests__/integration/profiles.test.ts
describe('profiles table', () => {
  it('can create a profile', async () => {
    const { error } = await testSupabase.from('profiles').insert({
      id: TEST_USER_A,
      username: 'test_player_a',
    });
    expect(error).toBeNull();
  });

  it('enforces unique usernames', async () => {
    await testSupabase.from('profiles').insert({ id: 'user_x', username: 'dup' });
    const { error } = await testSupabase.from('profiles').insert({ id: 'user_y', username: 'dup' });
    expect(error?.code).toBe('23505'); // unique violation
  });
});
```

**1.2 — Migrate to clean schema** (all snake_case, types generated)

```bash
supabase gen types typescript --local > packages/game-core/src/database.types.ts
```

This generates exact TypeScript types from the live schema — no more hand-written types that drift.

**1.3 — Update TypeScript types to match generated types**

The `UserProfile` interface in `game-core/src/progression.ts` should derive from the generated DB types, not be hand-written separately.

**Tests pass → commit → move to Phase 2.**

### Phase 2: Ability System Consolidation

**Goal**: `catalog.json` is the single source of truth. Validated at build time. No scattered config.

**2.1 — Tests first**

```typescript
// packages/game-core/src/__tests__/abilities.test.ts
import { CATALOG } from '../abilities/catalog.json';
import { ABILITY_EFFECTS } from '../abilities/effects';

describe('ability system integrity', () => {
  const catalogIds = Object.keys(CATALOG);
  const handlerIds = Object.keys(ABILITY_EFFECTS);

  it('every ability in catalog has an effect handler', () => {
    const missing = catalogIds.filter(id => !handlerIds.includes(id));
    expect(missing).toHaveLength(0);
  });

  it('no orphaned handlers (handler exists but not in catalog)', () => {
    const orphans = handlerIds.filter(id => !catalogIds.includes(id));
    expect(orphans).toHaveLength(0);
  });

  it('all abilities have valid star costs', () => {
    Object.values(CATALOG).forEach(a => {
      expect(a.star_cost).toBeGreaterThan(0);
      expect(a.star_cost).toBeLessThanOrEqual(500);
    });
  });

  it('starter abilities have 0 unlock cost', () => {
    Object.values(CATALOG)
      .filter(a => a.is_starter)
      .forEach(a => expect(a.unlock_coins).toBe(0));
  });
});
```

**2.2 — Consolidate ability config**

Merge `abilities.json` + unlock logic from `progression.ts` into single `catalog.json` in `game-core`. Add Zod validation at build time.

**2.3 — Replace switch/case with dispatch table**

```typescript
// Before (in ServerGameState.ts):
switch (abilityType) {
  case 'earthquake': { /* 20 lines */ break; }
  case 'reverse_controls': { /* 15 lines */ break; }
  // ... 16 more cases
}

// After:
import { ABILITY_EFFECTS } from '@tetris/game-core/abilities';
const handler = ABILITY_EFFECTS[abilityType];
if (!handler) throw new AbilityError(`Unknown ability: ${abilityType}`);
handler.apply(this);
```

**Tests pass → commit → move to Phase 3.**

### Phase 3: Server Layer Cleanup

**Goal**: Remove duplicate matchmaking. Reduce tick to 100ms. Single clear protocol.

**3.1 — Tests first (WebSocket integration)**

```typescript
// packages/partykit/src/__tests__/integration/game.test.ts
import { WebSocket } from 'ws';
import { startLocalPartyKit, stopLocalPartyKit } from '../test-helpers/localServer';

let baseUrl: string;
beforeAll(async () => { baseUrl = await startLocalPartyKit(); });
afterAll(() => stopLocalPartyKit());

describe('game room', () => {
  it('two players get game_start', async () => {
    const p1Messages: any[] = [];
    const p2Messages: any[] = [];

    const p1 = new WebSocket(`${baseUrl}/parties/game/test-room-1`);
    const p2 = new WebSocket(`${baseUrl}/parties/game/test-room-1`);

    p1.on('message', d => p1Messages.push(JSON.parse(d.toString())));
    p2.on('message', d => p2Messages.push(JSON.parse(d.toString())));

    await Promise.all([waitForOpen(p1), waitForOpen(p2)]);

    p1.send(JSON.stringify({ type: 'join', payload: { player_id: 'user_a', loadout: [] } }));
    p2.send(JSON.stringify({ type: 'join', payload: { player_id: 'user_b', loadout: [] } }));

    await waitFor(() => p1Messages.some(m => m.type === 'start'), 3000);
    await waitFor(() => p2Messages.some(m => m.type === 'start'), 3000);

    expect(p1Messages.find(m => m.type === 'start').payload.seed)
      .toBe(p2Messages.find(m => m.type === 'start').payload.seed);

    p1.close(); p2.close();
  });
});
```

**3.2 — Delete dead code**

```
DELETE: packages/web/src/services/matchmaking.ts   (Supabase polling, replaced by PartyKit)
DELETE: packages/web/src/services/gameSync.ts       (legacy sync service)
DELETE: packages/web/src/themes/neonCyberpunk.ts    (unused theme)
DELETE: packages/web/src/themes/isometric3d.ts      (unused theme)
DELETE: packages/web/src/themes/liquidMorphing.ts   (unused theme)
DELETE: packages/web/src/themes/retro8bit.ts        (unused theme)
```

**3.3 — Reduce tick rate from 1000ms to 100ms**

This is the single biggest UX improvement. At 1000ms, even a "fast drop" feels sluggish. At 100ms, the game feels instantaneous.

**Tests pass → commit → move to Phase 4.**

### Phase 4: Client Layer Cleanup

**Goal**: React components only handle display. All business logic in services or stores.

**4.1 — Collapse challenge hooks into one**

Currently: `useChallenges.ts` + `useIncomingChallenges.ts` + `useOutgoingChallenges.ts` + `useFriendRequests.ts` = 4 overlapping subscriptions.

Target: `useSocialSubscriptions.ts` — one hook, one channel, handles all social Realtime events.

```typescript
// packages/web/src/hooks/useSocialSubscriptions.ts
export function useSocialSubscriptions(userId: string) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`social:${userId}`)
      // Incoming friend requests
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships',
          filter: `addressee_id=eq.${userId}` }, handleIncomingFriendRequest)
      // Friend request accepted
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships',
          filter: `requester_id=eq.${userId}` }, handleFriendRequestUpdate)
      // Incoming challenge
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'challenges',
          filter: `challenged_id=eq.${userId}` }, handleIncomingChallenge)
      // My challenge was accepted
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenges',
          filter: `challenger_id=eq.${userId}` }, handleChallengeUpdate)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);
}
```

**4.2 — Remove client-side prediction code** (until tick rate is fixed)

Client prediction at 1000ms tick rate is harmful — the client and server diverge for a full second, causing jarring corrections. Delete `predictionHelpers.ts` and `prediction/` types. Add back proper prediction only after tick rate is at 100ms.

**4.3 — Integration test: friend challenge end-to-end**

```typescript
// packages/web/src/__tests__/integration/challenges.test.ts
describe('friend challenge flow', () => {
  beforeEach(async () => {
    // Reset DB state
    await testSupabase.from('challenges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testSupabase.from('friendships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Create test profiles
    await upsertTestProfile(TEST_USER_A, 'player_a');
    await upsertTestProfile(TEST_USER_B, 'player_b');
  });

  it('challenger sees accepted notification and room ID', async () => {
    const challengerEvents: any[] = [];

    // Challenger subscribes first
    const channel = testSupabase
      .channel(`challenges_out:${TEST_USER_A}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public',
          table: 'challenges', filter: `challenger_id=eq.${TEST_USER_A}` },
        (payload) => challengerEvents.push(payload.new))
      .subscribe();
    await waitForSubscription(channel);

    // Challenger sends challenge
    const { data: challenge } = await testSupabase.from('challenges').insert({
      challenger_id: TEST_USER_A,
      challenged_id: TEST_USER_B,
      status: 'pending',
    }).select().single();

    // Challenged accepts via RPC
    await testSupabase.rpc('accept_challenge', {
      p_challenge_id: challenge.id,
      p_user_id: TEST_USER_B,
    });

    // Challenger should receive Realtime event with room_id
    await waitFor(() => challengerEvents.length > 0, 5000);
    expect(challengerEvents[0].status).toBe('accepted');
    expect(challengerEvents[0].room_id).toBeTruthy();

    await testSupabase.removeChannel(channel);
  });
});
```

**Tests pass → commit → move to Phase 5.**

### Phase 5: Feature Completeness

skip: do not add new feature
---

## 4. What NOT to Do
  DO NOT ADD NEW FEATURES 
Lessons from the failed big-bang refactor:

| Don't | Do Instead |
|-------|-----------|
| Rename DB columns in same PR as client changes | Rename DB → verify working → rename client |
| Delete migrations mid-flight | Only delete after `complete-schema.sql` is proven |
| Change server protocol and client in same PR | Change server, update client, test, then move on |
| Add unused features "for future" | Build only what has tests |
| Mix theme changes with logic changes | Theme is purely visual — separate PR |

---

## 5. Decision Points (Need Your Input Before Starting)

Before beginning Phase 0, these need decisions:

**D1 — Supabase types approach**
Option A: Run `supabase gen types` and use generated types everywhere (recommended — no drift)
Option B: Keep hand-written `UserProfile` interface, just fix column names

author: Option A

**D2 — Column naming convention**
Option A: All snake_case in DB (standard Postgres), TypeScript transformers handle camelCase
Option B: Keep quoted `"camelCase"` columns in DB (what we have now)
Recommendation: **A** — standard Postgres, stops PGRST204 class of errors permanently

author: Option A

**D3 — Client prediction**
Option A: Delete prediction code, let server-authoritative feel snappy via 100ms tick
Option B: Keep prediction but fix tick rate first
Recommendation: **A** — prediction adds complexity without benefit at current player count

author: Option A

**D4 — Unused themes**
Option A: Delete 4 unused themes (neon, retro, 3D, morphing), keep glassmorphism only
Option B: Keep all for future
Recommendation: **A** — dead code has negative value (ADR 0010)

author: option A

**D5 — Quest system**
Option A: Implement daily quests in Phase 5 (table exists, needs logic)
Option B: Drop quest system for now, focus on core game loop

author: option B

---

## 6. Estimated Effort

| Phase | Work | Risk |
|-------|------|------|
| 0: Test Foundation | 2-3 days | Low — additive only |
| 1: DB Cleanup | 1-2 days | Medium — migration needed |
| 2: Ability Consolidation | 1-2 days | Low — game-core isolated |
| 3: Server Cleanup | 2-3 days | Medium — tick rate change |
| 4: Client Cleanup | 2-3 days | Medium — hook consolidation |
| 5: Features | Ongoing | Low — foundation is solid |

Each phase ends with: tests green + deploy to staging + manual smoke test.

---

## 7. File Structure After Refactoring

```
tetris-battle/
├── packages/
│   ├── game-core/
│   │   └── src/
│   │       ├── abilities/
│   │       │   ├── catalog.json      ← SINGLE SOURCE OF TRUTH
│   │       │   ├── schema.ts         ← Zod validation
│   │       │   ├── effects/
│   │       │   │   ├── buffs.ts
│   │       │   │   ├── debuffs.ts
│   │       │   │   └── index.ts      ← Dispatch table
│   │       │   └── index.ts
│   │       ├── engine.ts
│   │       ├── tetrominos.ts
│   │       ├── progression.ts
│   │       ├── SeededRandom.ts
│   │       ├── database.types.ts     ← Generated by Supabase CLI
│   │       └── ai/
│   ├── partykit/
│   │   └── src/
│   │       ├── game.ts              ← Room server (clean protocol)
│   │       ├── ServerGameState.ts   ← Per-player state
│   │       ├── matchmaking.ts       ← Queue only (no Supabase polling)
│   │       ├── presence.ts
│   │       └── __tests__/
│   │           └── integration/     ← WebSocket integration tests
│   └── web/
│       └── src/
│           ├── components/          ← UI only, no game logic
│           ├── stores/              ← Zustand (gameStore, friendStore, abilityStore)
│           ├── hooks/
│           │   ├── useSocialSubscriptions.ts  ← One hook for all Realtime
│           │   └── useGameClient.ts           ← PartyKit connection
│           ├── services/
│           │   ├── progressionService.ts      ← Separated from supabase.ts
│           │   ├── friendService.ts
│           │   └── audioManager.ts
│           ├── lib/
│           │   └── supabase.ts      ← Client config only (not progression logic)
│           └── __tests__/
│               └── integration/     ← Supabase Realtime integration tests
├── supabase/
│   ├── migrations/
│   │   └── 001_initial.sql          ← Start fresh, one migration
│   └── complete-schema.sql          ← Always in sync with migrations
└── playwright/
    └── tests/
        ├── matchmaking.spec.ts      ← Two-context multiplayer E2E
        └── friends.spec.ts          ← Friend challenge E2E
```

---

*Written by Claude Code — review before any implementation begins.*
