# Research Summary for Spec 012: Simplify Progression to Coins Only

## Project Structure
- **Monorepo**: Yes, using pnpm workspaces
- **Packages**:
  - `packages/web` - React frontend (Vite)
  - `packages/partykit` - Multiplayer server
  - `packages/game-core` - Shared game logic (TypeScript)
- **Build**:
  - Root: `pnpm build:all`
  - Web: `pnpm --filter web build` (tsc + vite)
- **Tests**:
  - Vitest framework
  - Command: `pnpm --filter web test`

## Existing Patterns

### Imports
```typescript
// Relative imports for local files
import { MainMenu } from './components/MainMenu';
import { progressionService } from './lib/supabase';

// Workspace imports for game-core
import type { UserProfile, MatchResult } from '@tetris-battle/game-core';
import { ABILITIES, STARTER_ABILITIES } from '@tetris-battle/game-core';
```

### Type Definitions

**Current UserProfile** (`packages/game-core/src/progression.ts:4-17`):
```typescript
export interface UserProfile {
  userId: string;
  username: string;
  level: number;          // ❌ TO REMOVE
  xp: number;             // ❌ TO REMOVE
  coins: number;          // ✅ KEEP
  rank: number;           // ❌ TO REPLACE with matchmakingRating
  gamesPlayed: number;
  lastActiveAt: number;
  unlockedAbilities: string[];
  loadout: string[];
  createdAt: number;
  updatedAt: number;
}
```

**Current MatchResult** (`packages/game-core/src/progression.ts:19-33`):
```typescript
export interface MatchResult {
  id: string;
  userId: string;
  opponentId: string;
  outcome: 'win' | 'loss' | 'draw';
  linesCleared: number;
  abilitiesUsed: number;
  coinsEarned: number;
  xpEarned: number;        // ❌ TO REMOVE
  rankChange: number;
  rankAfter: number;
  opponentRank: number;
  duration: number;
  timestamp: number;
}
```

### Database Schema Patterns

**Migration files location**: `supabase/migrations/`
**Naming pattern**: `00X_description.sql`

**Current user_profiles schema** (`supabase/complete-schema.sql:27-40`):
```sql
CREATE TABLE user_profiles (
  "userId" TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,                  -- ❌ REMOVE
  xp INTEGER NOT NULL DEFAULT 0,                     -- ❌ REMOVE
  coins INTEGER NOT NULL DEFAULT 0,                  -- ✅ KEEP
  rank INTEGER NOT NULL DEFAULT 1000,                -- ❌ RENAME to matchmaking_rating
  "unlockedAbilities" JSONB NOT NULL DEFAULT '["screen_shake", "speed_up_opponent", "piece_preview_plus", "mini_blocks"]'::jsonb,
  loadout JSONB NOT NULL DEFAULT '["screen_shake", "speed_up_opponent", "piece_preview_plus"]'::jsonb,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "lastActiveAt" BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);
```

**Note**: Columns use camelCase with quotes (Supabase convention)

### Ability System

**Abilities config**: `packages/game-core/src/abilities.json`

**Current structure**:
```json
{
  "costFactor": 1,
  "abilities": {
    "ability_id": {
      "id": "ability_id",
      "type": "ability_id",
      "name": "Display Name",
      "shortName": "SHORT",
      "description": "...",
      "cost": 50,              // ✅ Star cost (in-game)
      "duration": 10000,
      "category": "buff|debuff",
      "unlockLevel": 1,        // ❌ TO REPLACE with unlockTier
      "unlockCost": 0          // ✅ Coin cost (already exists!)
    }
  }
}
```

**Starter abilities** (`packages/game-core/src/progression.ts:165-167`):
```typescript
export const STARTER_ABILITIES = Object.entries(abilitiesConfig.abilities)
  .filter(([_, ability]) => ability.unlockLevel === 1 && ability.unlockCost === 0)
  .map(([id, _]) => id);
```

Current starters: `weird_shapes`, `death_cross`, `reverse_controls`, `screen_shake`, `mini_blocks`, `cross_firebomb`

**Spec wants**: `earthquake`, `mini_blocks`, `clear_rows`, `fill_holes`

### Progression Service

**Location**: `packages/web/src/lib/supabase.ts:71-294`

**Key methods**:
- `getUserProfile(userId)` - Fetches profile, sanitizes abilities
- `createUserProfile(userId, username)` - Creates with defaults
- `updateUserProfile(userId, updates)` - Updates with timestamp
- `unlockAbility(userId, abilityId, cost)` - Already implemented! (line 185-210)
- `getWinStreak(userId)` - Gets current win streak
- `getTodayStats(userId)` - Gets today's wins/matches
- `saveMatchResult(result)` - Saves to match_results table

### Rewards System

**Location**: `packages/web/src/lib/rewards.ts`

**Current function** (`awardMatchRewards`):
```typescript
async function awardMatchRewards(
  userId: string,
  outcome: 'win' | 'loss' | 'draw',
  linesCleared: number,
  abilitiesUsed: number,
  matchDuration: number,
  opponentId: string,
  isAiMatch: boolean = false
): Promise<MatchRewards | null>
```

**Current reward calculation**:
- Base coins from `COIN_VALUES` (packages/game-core/src/progression.ts:66-80)
- Performance bonuses (lines, abilities)
- Streak bonuses (3/5/10 wins)
- First win of day bonus
- XP calculation
- AI match penalty (50% of rewards)

**Current COIN_VALUES** (game-core):
```typescript
export const COIN_VALUES = {
  win: 50,
  loss: 20,
  draw: 10,
  lines20Plus: 10,
  lines40Plus: 25,
  abilities5Plus: 10,
  noAbilityWin: 30,
  streak3: 15,
  streak5: 30,
  streak10: 60,
  firstWinOfDay: 25,
} as const;
```

**Spec wants different values**:
- Human win: 100 (currently 50)
- Human loss: 30 (currently 20)
- AI wins: 20/40/60 (by difficulty)
- AI loss: 10
- First win of day: +50 bonus (currently 25)
- 5-game streak: +25 (no current 5-streak)

### UI Components

**MainMenu** (`packages/web/src/components/MainMenu.tsx`):
- Line 30: Uses `getLevelStage(profile.level)` - need to remove
- Line 76-78: Shows level display - need to change to games played/win rate
- Line 86-88: Shows coins (keep this)
- Line 23-27: Has shop/loadout/profile modals

**AbilityShop** (`packages/web/src/components/AbilityShop.tsx`):
- Already exists! Uses level-based stages (rookie/contender/etc)
- Need to change to tier-based (starter/bronze/silver/gold/platinum)
- Line 18-23: Stage definitions (need to replace)
- Line 25-37: `handleUnlock` already calls `progressionService.unlockAbility`

**PostMatchScreen** (`packages/web/src/components/PostMatchScreen.tsx`):
- Line 56-74: Level up banner - REMOVE
- Line 88-115: Coins breakdown - KEEP
- Line 117-139: XP breakdown - REMOVE
- Need to add "next unlock" suggestion

**ProfilePage** - Need to check this component

### Test Patterns

**Example** (`packages/web/src/__tests__/friendStore.test.ts`):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external services
vi.mock('../services/friendService', () => ({
  friendService: {
    getFriendList: vi.fn(),
    // ... other methods
  },
}));

import { useFriendStore } from '../stores/friendStore';
import { friendService } from '../services/friendService';

const mockFriendService = vi.mocked(friendService);

describe('ProgressionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test description', async () => {
    // Arrange
    mockFriendService.getFriendList.mockResolvedValue([]);

    // Act
    const result = await useFriendStore.getState().loadFriends('u1');

    // Assert
    expect(mockFriendService.getFriendList).toHaveBeenCalledWith('u1');
  });
});
```

## Analogous Flow: Ability Unlocking

The ability unlock system is **already implemented**! Here's the flow:

1. **AbilityShop component** (`packages/web/src/components/AbilityShop.tsx:25-37`)
   - User clicks "Unlock" button
   - Calls `progressionService.unlockAbility(userId, abilityId, cost)`

2. **ProgressionService.unlockAbility** (`packages/web/src/lib/supabase.ts:185-210`)
   - Validates ability ID
   - Gets current profile
   - Checks if already unlocked
   - Checks sufficient coins
   - Adds to `unlockedAbilities` array
   - Deducts coins
   - Updates profile in database

3. **Database update** (Supabase)
   - Updates `user_profiles` table
   - Sets new `unlockedAbilities` JSONB
   - Sets new `coins` value

4. **UI update** (`AbilityShop.tsx:32-34`)
   - Calls `onProfileUpdate(newProfile)`
   - Parent component (MainMenu) updates state
   - Shop re-renders with new unlocked status

## Integration Points

### Files to Modify

1. **Type Definitions**:
   - `packages/game-core/src/progression.ts`
     - Line 4-17: Update `UserProfile` interface
     - Line 19-33: Update `MatchResult` interface
     - Line 66-80: Update `COIN_VALUES` constants
     - Remove XP/level related functions (line 82-162)

2. **Abilities Config**:
   - `packages/game-core/src/abilities.json`
     - Update `unlockLevel` and `unlockCost` for all 20 abilities
     - Set 4 starter abilities (earthquake, mini_blocks, clear_rows, fill_holes)

3. **Database**:
   - Create `supabase/migrations/007_simplify_progression.sql`
     - Add `matchmaking_rating` column
     - Add `games_won` column
     - Migrate `rank` to `matchmaking_rating`
     - Update default `unlockedAbilities`
     - Drop `level` and `xp` columns (after migration period)
     - Update `match_results` table (drop xpEarned column)

4. **Supabase Service**:
   - `packages/web/src/lib/supabase.ts`
     - Line 138-151: Update `createUserProfile` defaults
     - No other changes needed (unlockAbility already works!)

5. **Rewards System**:
   - `packages/web/src/lib/rewards.ts`
     - Update `COIN_VALUES` usage (import new values)
     - Remove XP calculation (line 73-80)
     - Add AI difficulty-based rewards
     - Remove level calculation (line 106-114)
     - Update `MatchRewards` interface (remove xp, leveledUp, newLevel)

6. **UI Components**:
   - `packages/web/src/components/MainMenu.tsx`
     - Line 30: Remove `getLevelStage` call
     - Line 68-79: Replace level display with games/win rate

   - `packages/web/src/components/AbilityShop.tsx`
     - Line 17-23: Replace stage system with tiers
     - Update ability grouping logic

   - `packages/web/src/components/PostMatchScreen.tsx`
     - Line 56-74: Remove level up banner
     - Line 117-139: Remove XP section
     - Add "next unlock" suggestion

   - `packages/web/src/components/ProfilePage.tsx` (need to check)

### New Files to Create

1. `supabase/migrations/007_simplify_progression.sql` - Database migration
2. `packages/web/src/__tests__/progression.test.ts` - Tests for coin rewards
3. Possibly update existing tests that reference level/xp

## Key Files to Reference During Implementation

1. `packages/game-core/src/progression.ts` - Constants and types
2. `packages/game-core/src/abilities.json` - Ability metadata
3. `packages/web/src/lib/supabase.ts` - Database service
4. `packages/web/src/lib/rewards.ts` - Reward calculation
5. `packages/web/src/components/AbilityShop.tsx` - Shop UI
6. `packages/web/src/components/PostMatchScreen.tsx` - Post-game rewards
7. `supabase/complete-schema.sql` - Current schema reference
8. `packages/web/src/__tests__/friendStore.test.ts` - Test pattern reference

## Critical Findings

### What Already Works ✅
- Coin system exists and functional
- Ability unlocking fully implemented
- AbilityShop component exists
- Supabase service has all needed methods
- Migration pattern established

### Main Work Required 🔨
1. Update ability unlock costs/tiers in abilities.json
2. Create database migration
3. Simplify reward calculation (remove XP, update coin values)
4. Update UI to remove level/XP displays
5. Replace level-based shop tiers with coin-based tiers
6. Add games_won tracking
7. Write tests for new reward system

### Migration Strategy
The spec suggests two options:
- **Option A**: Fresh start (all users get 4 starters, 0 coins)
- **Option B**: Grant coins based on old level

For small user base, **Option A** is simpler. Implementation:
1. Create migration that updates all profiles:
   ```sql
   UPDATE user_profiles
   SET "unlockedAbilities" = '["earthquake", "mini_blocks", "clear_rows", "fill_holes"]'::jsonb,
       loadout = '["earthquake", "mini_blocks", "clear_rows"]'::jsonb;
   ```
2. Drop level/xp columns (keep data in backup table first)
3. Frontend gracefully handles missing level/xp fields
