# Implementation Plan for Spec 012: Simplify Progression to Coins Only

## Overview
- Total steps: 15
- Estimated new files: 2
- Estimated modified files: 8
- Migration strategy: Option A (fresh start - reset all users to 4 starter abilities)

## Steps

### Step 1: Update Ability Metadata (abilities.json)

**Files to modify:**
- `packages/game-core/src/abilities.json`

**Implementation details:**
Update all 20 abilities with new unlock tiers and costs according to spec:

**Starter Tier (unlockLevel: 1, unlockCost: 0):**
- `earthquake` - Set unlockLevel: 1, unlockCost: 0
- `mini_blocks` - Already unlockLevel: 1, unlockCost: 0
- `clear_rows` - Change from unlockLevel: 11, unlockCost: 550 → unlockLevel: 1, unlockCost: 0
- `fill_holes` - Change from unlockLevel: 9, unlockCost: 450 → unlockLevel: 1, unlockCost: 0

**Bronze Tier (unlockLevel: 2, unlockCost: 500):**
- `random_spawner` - Change from unlockLevel: 3, unlockCost: 150 → unlockLevel: 2, unlockCost: 500
- `row_rotate` - Change from unlockLevel: 10, unlockCost: 500 → unlockLevel: 2, unlockCost: 500
- `circle_bomb` - Change from unlockLevel: 6, unlockCost: 300 → unlockLevel: 2, unlockCost: 500
- `cross_firebomb` - Already unlockLevel: 1, unlockCost: 0 → change to unlockLevel: 2, unlockCost: 500

**Silver Tier (unlockLevel: 3, unlockCost: 1000):**
- `death_cross` - Change from unlockLevel: 1, unlockCost: 0 → unlockLevel: 3, unlockCost: 1000
- `gold_digger` - Change from unlockLevel: 5, unlockCost: 250 → unlockLevel: 3, unlockCost: 1000
- `cascade_multiplier` - Change from unlockLevel: 13, unlockCost: 650 → unlockLevel: 3, unlockCost: 1000
- `deflect_shield` - Need to add (not in current JSON) → unlockLevel: 3, unlockCost: 1000

**Gold Tier (unlockLevel: 4, unlockCost: 2000):**
- `speed_up_opponent` - Change from unlockLevel: 2, unlockCost: 100 → unlockLevel: 4, unlockCost: 2000
- `reverse_controls` - Change from unlockLevel: 1, unlockCost: 0 → unlockLevel: 4, unlockCost: 2000
- `piece_preview_plus` - Need to add (not in current JSON) → unlockLevel: 4, unlockCost: 2000
- `weird_shapes` - Change from unlockLevel: 1, unlockCost: 0 → unlockLevel: 4, unlockCost: 2000

**Platinum Tier (unlockLevel: 5, unlockCost: 3500):**
- `rotation_lock` - Change from unlockLevel: 7, unlockCost: 350 → unlockLevel: 5, unlockCost: 3500
- `blind_spot` - Change from unlockLevel: 4, unlockCost: 200 → unlockLevel: 5, unlockCost: 3500
- `screen_shake` - Change from unlockLevel: 1, unlockCost: 0 → unlockLevel: 5, unlockCost: 3500
- `shrink_ceiling` - Change from unlockLevel: 8, unlockCost: 400 → unlockLevel: 5, unlockCost: 3500

**Note**: `unlockLevel` now represents tier (1=starter, 2=bronze, 3=silver, 4=gold, 5=platinum), not player level.

**Test:**
- Build game-core: `pnpm --filter game-core build`
- Verify no TypeScript errors

**Verify:**
- Run `node -e "console.log(JSON.stringify(require('./packages/game-core/dist/abilities.json').abilities.earthquake, null, 2))"`
- Confirm earthquake has unlockLevel: 1, unlockCost: 0

---

### Step 2: Update UserProfile Type Definition

**Files to modify:**
- `packages/game-core/src/progression.ts`

**Implementation details:**
1. Update `UserProfile` interface (line 4-17):
   - Remove `level: number;`
   - Remove `xp: number;`
   - Keep `coins: number;`
   - Replace `rank: number;` with `matchmakingRating: number;`
   - Add `gamesWon: number;` (after gamesPlayed)

2. Update `MatchResult` interface (line 19-33):
   - Remove `xpEarned: number;`
   - Keep all other fields

3. Remove XP/Level constants and functions:
   - Delete `XP_VALUES` constant (line 82-87)
   - Delete `LEVEL_THRESHOLDS` constant (line 89-126)
   - Delete `Stage` type (line 128)
   - Delete `getLevelStage()` function (line 130-137)
   - Delete `getLoadoutSlots()` function (line 139-142)
   - Delete `getXpForNextLevel()` function (line 144-150)
   - Delete `calculateLevel()` function (line 152-162)

4. Update `COIN_VALUES` constant (line 66-80) to match spec:
```typescript
export const COIN_VALUES = {
  // Base rewards
  humanWin: 100,
  humanLoss: 30,
  draw: 10,
  aiEasyWin: 20,
  aiMediumWin: 40,
  aiHardWin: 60,
  aiLoss: 10,
  // Bonuses
  firstWinOfDay: 50,
  streak5: 25,
  // Remove old values: lines20Plus, lines40Plus, abilities5Plus, noAbilityWin, streak3, streak10
} as const;
```

**Test:**
- Build game-core: `pnpm --filter game-core build`
- Check for TypeScript errors in dependent files

**Verify:**
- Run `pnpm --filter web build` (will fail initially, that's expected)
- Note which files need UserProfile updates

---

### Step 3: Update STARTER_ABILITIES Logic

**Files to modify:**
- `packages/game-core/src/progression.ts`

**Implementation details:**
The `STARTER_ABILITIES` constant (line 165-167) already works correctly - it filters for `unlockLevel === 1 && unlockCost === 0`. After Step 1, this will automatically include the 4 new starters.

Verify the export statement exists:
```typescript
export const STARTER_ABILITIES = Object.entries(abilitiesConfig.abilities)
  .filter(([_, ability]) => ability.unlockLevel === 1 && ability.unlockCost === 0)
  .map(([id, _]) => id);
```

**Test:**
- Build game-core: `pnpm --filter game-core build`
- Run: `node -e "const { STARTER_ABILITIES } = require('./packages/game-core/dist/progression.js'); console.log(STARTER_ABILITIES);"`

**Verify:**
- Output should be: `['earthquake', 'mini_blocks', 'clear_rows', 'fill_holes']`

---

### Step 4: Create Database Migration

**Files to create:**
- `supabase/migrations/007_simplify_progression.sql`

**Implementation details:**
Create migration with following steps:

```sql
-- ============================================================================
-- Migration 007: Simplify Progression to Coins Only
-- ============================================================================
-- Removes level/XP system, keeps coins as primary progression currency
-- Resets all users to 4 starter abilities (fresh start approach)
-- ============================================================================

-- 1. Add new columns
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS matchmaking_rating INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS games_won INTEGER DEFAULT 0;

-- 2. Migrate existing rank to matchmaking_rating (preserve existing rating)
UPDATE user_profiles SET matchmaking_rating = rank WHERE matchmaking_rating IS NULL;

-- 3. Reset all users to 4 starter abilities (Option A: Fresh Start)
UPDATE user_profiles
SET "unlockedAbilities" = '["earthquake", "mini_blocks", "clear_rows", "fill_holes"]'::jsonb,
    loadout = '["earthquake", "mini_blocks", "clear_rows", "fill_holes"]'::jsonb;

-- 4. Calculate games_won from match history
UPDATE user_profiles up
SET games_won = (
  SELECT COUNT(*)
  FROM match_results mr
  WHERE mr."userId" = up."userId" AND mr.outcome = 'win'
);

-- 5. Drop old columns (level, xp, rank)
-- NOTE: This is destructive. Consider backing up data first.
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS xp,
  DROP COLUMN IF EXISTS rank;

-- 6. Update match_results table - drop xpEarned column
ALTER TABLE match_results
  DROP COLUMN IF EXISTS "xpEarned";

-- 7. Create index on matchmaking_rating for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_matchmaking_rating
  ON user_profiles(matchmaking_rating DESC);

-- 8. Create index on games_won for leaderboards
CREATE INDEX IF NOT EXISTS idx_user_profiles_games_won
  ON user_profiles(games_won DESC);
```

**Test:**
- Apply migration in local Supabase instance
- Check table structure: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles';`

**Verify:**
- Columns exist: matchmaking_rating, games_won
- Columns removed: level, xp, rank
- All users have 4 abilities in unlockedAbilities

---

### Step 5: Update ProgressionService

**Files to modify:**
- `packages/web/src/lib/supabase.ts`

**Implementation details:**
1. Update `createUserProfile` method (line 134-165):
   - Remove `level: 1,`
   - Remove `xp: 0,`
   - Replace `rank: 1000,` with `matchmakingRating: 1000,`
   - Add `gamesWon: 0,`
   - Update `unlockedAbilities` default to new 4 starters:
     ```typescript
     unlockedAbilities: ['earthquake', 'mini_blocks', 'clear_rows', 'fill_holes'],
     loadout: ['earthquake', 'mini_blocks', 'clear_rows', 'fill_holes'],
     ```

2. Update `getUserProfile` method (line 73-132):
   - Line 98-102: Update fallback starter abilities to new 4
   - Line 114-115: Update the empty loadout default to new starters

No changes needed to `unlockAbility`, `updateLoadout`, or match-related methods.

**Test:**
- Build: `pnpm --filter web build`
- Check for TypeScript errors

**Verify:**
- TypeScript compiles without errors
- Review the updated UserProfile creation code

---

### Step 6: Update Rewards System - Interface

**Files to modify:**
- `packages/web/src/lib/rewards.ts`

**Implementation details:**
1. Update `MatchRewards` interface (line 4-17):
```typescript
export interface MatchRewards {
  coins: number;
  newCoins: number;        // New total
  breakdown: {
    baseCoins: number;
    firstWinBonus: number;
    streakBonus: number;
  };
  nextUnlock?: {          // NEW - suggest next ability to unlock
    abilityId: string;
    abilityName: string;
    coinsNeeded: number;
  };
}
```

Remove fields: `xp`, `newLevel`, `leveledUp`, `breakdown.baseXp`, `breakdown.winBonus`, `breakdown.performanceBonus`

**Test:**
- Build: `pnpm --filter web build` (will fail - reward calculation not updated yet)

**Verify:**
- TypeScript shows errors in `awardMatchRewards` function (expected)

---

### Step 7: Update Rewards System - Calculation Logic

**Files to modify:**
- `packages/web/src/lib/rewards.ts`

**Implementation details:**
1. Update `awardMatchRewards` function signature (line 19-27):
```typescript
export async function awardMatchRewards(
  userId: string,
  outcome: 'win' | 'loss',
  opponentType: 'human' | 'ai_easy' | 'ai_medium' | 'ai_hard',
  matchDuration: number,
  opponentId: string
): Promise<MatchRewards | null>
```
Remove parameters: `linesCleared`, `abilitiesUsed`
Replace `isAiMatch` with `opponentType`

2. Rewrite reward calculation (line 28-130):
```typescript
try {
  const profile = await progressionService.getUserProfile(userId);
  if (!profile) return null;

  // Calculate base coins based on opponent type
  let baseCoins = 0;
  const isAiMatch = opponentType !== 'human';

  if (outcome === 'win') {
    if (opponentType === 'human') {
      baseCoins = COIN_VALUES.humanWin;
    } else if (opponentType === 'ai_easy') {
      baseCoins = COIN_VALUES.aiEasyWin;
    } else if (opponentType === 'ai_medium') {
      baseCoins = COIN_VALUES.aiMediumWin;
    } else if (opponentType === 'ai_hard') {
      baseCoins = COIN_VALUES.aiHardWin;
    }
  } else {
    // Loss
    if (opponentType === 'human') {
      baseCoins = COIN_VALUES.humanLoss;
    } else {
      baseCoins = COIN_VALUES.aiLoss;
    }
  }

  let firstWinBonus = 0;
  let streakBonus = 0;

  // Check first win of day (only for wins)
  if (outcome === 'win') {
    const todayStats = await progressionService.getTodayStats(userId);
    if (todayStats.wins === 0) {
      firstWinBonus = COIN_VALUES.firstWinOfDay;
    }

    // Check 5-game streak
    const streak = await progressionService.getWinStreak(userId);
    if (streak > 0 && streak % 5 === 0) {
      streakBonus = COIN_VALUES.streak5;
    }
  }

  const totalCoins = baseCoins + firstWinBonus + streakBonus;

  // Save match result
  await progressionService.saveMatchResult({
    id: crypto.randomUUID(),
    userId,
    opponentId,
    outcome,
    linesCleared: 0,  // No longer tracked for rewards
    abilitiesUsed: 0, // No longer tracked for rewards
    coinsEarned: totalCoins,
    rankChange: 0,
    rankAfter: profile.matchmakingRating,
    opponentRank: 1000,
    duration: matchDuration,
    timestamp: Date.now(),
  });

  // Update user profile
  const newCoins = Math.min(profile.coins + totalCoins, 999999);
  const newGamesWon = outcome === 'win' ? profile.gamesWon + 1 : profile.gamesWon;

  await progressionService.updateUserProfile(userId, {
    coins: newCoins,
    gamesWon: newGamesWon,
  });

  // Find next unlock suggestion
  const availableAbilities = Object.values(ABILITIES)
    .filter(a => !profile.unlockedAbilities.includes(a.id))
    .sort((a, b) => a.unlockCost - b.unlockCost);

  const nextUnlock = availableAbilities.length > 0 ? {
    abilityId: availableAbilities[0].id,
    abilityName: availableAbilities[0].name,
    coinsNeeded: availableAbilities[0].unlockCost - newCoins,
  } : undefined;

  return {
    coins: totalCoins,
    newCoins,
    breakdown: {
      baseCoins,
      firstWinBonus,
      streakBonus,
    },
    nextUnlock,
  };
} catch (error) {
  console.error('Error awarding match rewards:', error);
  return null;
}
```

3. Add import for ABILITIES:
```typescript
import { ABILITIES, COIN_VALUES } from '@tetris-battle/game-core';
```

**Test:**
- Build: `pnpm --filter web build`
- Check for TypeScript errors

**Verify:**
- No compilation errors
- Reward logic follows new coin economy from spec

---

### Step 8: Update MainMenu Component

**Files to modify:**
- `packages/web/src/components/MainMenu.tsx`

**Implementation details:**
1. Remove import (line 3):
   - Delete: `import { getLevelStage } from '@tetris-battle/game-core';`

2. Remove stage variable (line 30):
   - Delete: `const stage = getLevelStage(profile.level);`

3. Replace progression HUD (line 68-89):
```typescript
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  {/* Coins */}
  <div style={mergeGlass(glassGold(), {
    padding: '8px 12px',
    borderRadius: '8px',
    minWidth: 'fit-content',
  })}>
    <div style={{ fontSize: '18px', color: '#ffd700', fontWeight: 'bold', textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
      💰 {profile.coins}
    </div>
  </div>

  {/* Games Played */}
  <div style={mergeGlass(glassBlue(), {
    padding: '8px 12px',
    borderRadius: '8px',
    minWidth: 'fit-content',
  })}>
    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>
      GAMES
    </div>
    <div style={{ fontSize: '16px', color: '#00ccff', fontWeight: 'bold', textShadow: '0 0 10px rgba(0, 204, 255, 0.5)' }}>
      {profile.gamesPlayed}
    </div>
  </div>

  {/* Win Rate */}
  <div style={mergeGlass(glassSuccess(), {
    padding: '8px 12px',
    borderRadius: '8px',
    minWidth: 'fit-content',
  })}>
    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>
      WIN RATE
    </div>
    <div style={{ fontSize: '16px', color: '#00ff9d', fontWeight: 'bold', textShadow: '0 0 10px rgba(0, 255, 157, 0.5)' }}>
      {profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0}%
    </div>
  </div>
</div>
```

**Test:**
- Build: `pnpm --filter web build`
- Run: `pnpm --filter web dev`
- Check UI renders without errors

**Verify:**
- Main menu shows: Coins, Games Played, Win Rate
- No level/XP display
- No runtime errors in console

---

### Step 9: Update AbilityShop Component

**Files to modify:**
- `packages/web/src/components/AbilityShop.tsx`

**Implementation details:**
1. Replace stages array (line 17-23) with tiers:
```typescript
const tiers = [
  { name: 'Starter', tier: 1, cost: 0, description: 'Free for all players' },
  { name: 'Bronze', tier: 2, cost: 500, description: '500 coins each' },
  { name: 'Silver', tier: 3, cost: 1000, description: '1,000 coins each' },
  { name: 'Gold', tier: 4, cost: 2000, description: '2,000 coins each' },
  { name: 'Platinum', tier: 5, cost: 3500, description: '3,500 coins each' },
];
```

2. Update ability grouping logic (find the section that groups abilities by stage):
Replace level-based filtering with tier-based filtering:
```typescript
const abilitiesByTier = tiers.map(tier => {
  const tierAbilities = ABILITY_UNLOCKS.filter(unlock => {
    const ability = ABILITIES[unlock.abilityId];
    return ability && ability.unlockLevel === tier.tier;
  });

  return {
    ...tier,
    abilities: tierAbilities,
  };
});
```

3. Update the rendering logic to use `tier.name` instead of `stage.name` and remove level requirements.

4. Update can-unlock logic to only check coins (not level):
```typescript
const canUnlock = profile.coins >= unlock.cost && !profile.unlockedAbilities.includes(unlock.abilityId);
```

**Test:**
- Build: `pnpm --filter web build`
- Run: `pnpm --filter web dev`
- Navigate to shop

**Verify:**
- Shop shows 5 tiers (Starter, Bronze, Silver, Gold, Platinum)
- Each tier shows correct abilities
- Unlock buttons show coin cost
- No level requirements displayed

---

### Step 10: Update PostMatchScreen Component

**Files to modify:**
- `packages/web/src/components/PostMatchScreen.tsx`

**Implementation details:**
1. Update props interface (line 4-9):
```typescript
interface PostMatchScreenProps {
  outcome: 'win' | 'loss';
  rewards: MatchRewards;
  onContinue: () => void;
}
```
Remove `isAiMatch` (no longer needed - not used for display anymore)

2. Remove level-up banner (line 56-74):
   - Delete entire `{rewards.leveledUp && ...}` block

3. Remove XP section (line 117-139):
   - Delete the entire XP rewards section

4. Update coins display (line 88-115) to use new breakdown:
```typescript
<div style={{ marginBottom: '25px' }}>
  <div style={{
    fontSize: '20px',
    color: '#ffaa00',
    marginBottom: '10px',
  }}>
    💰 +{rewards.coins} Coins
  </div>

  <div style={{
    fontSize: '14px',
    color: '#888',
    paddingLeft: '20px',
  }}>
    <div>Base reward: +{rewards.breakdown.baseCoins}</div>
    {rewards.breakdown.firstWinBonus > 0 && (
      <div>First win of day: +{rewards.breakdown.firstWinBonus}</div>
    )}
    {rewards.breakdown.streakBonus > 0 && (
      <div>Win streak bonus: +{rewards.breakdown.streakBonus}</div>
    )}
  </div>

  <div style={{
    fontSize: '18px',
    color: '#ffd700',
    marginTop: '15px',
    fontWeight: 'bold',
  }}>
    Total Balance: {rewards.newCoins} 💰
  </div>
</div>
```

5. Add next unlock suggestion section (after coins, before button):
```typescript
{rewards.nextUnlock && rewards.nextUnlock.coinsNeeded > 0 && (
  <div style={{
    background: 'rgba(0, 255, 136, 0.1)',
    border: '1px solid rgba(0, 255, 136, 0.3)',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px',
  }}>
    <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '5px' }}>
      NEXT UNLOCK
    </div>
    <div style={{ fontSize: '18px', color: '#00ff88', fontWeight: 'bold' }}>
      {rewards.nextUnlock.abilityName}
    </div>
    <div style={{ fontSize: '14px', color: '#888', marginTop: '5px' }}>
      {rewards.nextUnlock.coinsNeeded} more coins needed
    </div>
  </div>
)}
```

**Test:**
- Build: `pnpm --filter web build`
- Play a match and check post-game screen

**Verify:**
- No level-up banner
- Shows coins earned with breakdown
- Shows total balance
- Shows next unlock suggestion (if applicable)
- No XP display

---

### Step 11: Update ProfilePage Component

**Files to modify:**
- `packages/web/src/components/ProfilePage.tsx`

**Implementation details:**
1. Read the file first to see current implementation
2. Remove any level/XP displays
3. Replace `rank` references with `matchmakingRating`
4. Add win rate display if not present
5. Update any UI that shows progression to focus on coins and games

**Note**: Need to read file first to see exact changes needed.

**Test:**
- Build: `pnpm --filter web build`
- Open profile page

**Verify:**
- Profile shows coins, games played, win rate
- No level/XP/rank display (matchmaking rating can be internal only)

---

### Step 12: Update Game Components to Use New Reward System

**Files to modify:**
- Search for calls to `awardMatchRewards` in:
  - `packages/web/src/components/ServerAuthMultiplayerGame.tsx`
  - `packages/web/src/components/PartykitMultiplayerGame.tsx`
  - `packages/web/src/components/TetrisGame.tsx`

**Implementation details:**
For each file calling `awardMatchRewards`:
1. Update function call to use new signature:
```typescript
const rewards = await awardMatchRewards(
  userId,
  outcome,
  opponentType,  // 'human' | 'ai_easy' | 'ai_medium' | 'ai_hard'
  matchDuration,
  opponentId
);
```

2. Remove `linesCleared` and `abilitiesUsed` parameters
3. Update `isAiMatch` to `opponentType` with difficulty

**Test:**
- Build: `pnpm --filter web build`
- Play matches against human and AI
- Check rewards are calculated correctly

**Verify:**
- Matches complete successfully
- Rewards appear on post-game screen
- Database updates correctly

---

### Step 13: Create Unit Tests for Progression

**Files to create:**
- `packages/web/src/__tests__/progression.test.ts`

**Implementation details:**
Create tests for coin reward calculation:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COIN_VALUES } from '@tetris-battle/game-core';

// Mock progressionService
vi.mock('../lib/supabase', () => ({
  progressionService: {
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    saveMatchResult: vi.fn(),
    getTodayStats: vi.fn(),
    getWinStreak: vi.fn(),
  },
}));

import { awardMatchRewards } from '../lib/rewards';
import { progressionService } from '../lib/supabase';

const mockProgressionService = vi.mocked(progressionService);

describe('Coin Reward System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('awards correct coins for human win', async () => {
    mockProgressionService.getUserProfile.mockResolvedValue({
      userId: 'u1',
      username: 'player',
      coins: 100,
      matchmakingRating: 1000,
      gamesPlayed: 5,
      gamesWon: 2,
      lastActiveAt: Date.now(),
      unlockedAbilities: ['earthquake'],
      loadout: ['earthquake'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockProgressionService.getTodayStats.mockResolvedValue({ wins: 1, matches: 2 });
    mockProgressionService.getWinStreak.mockResolvedValue(1);

    const rewards = await awardMatchRewards('u1', 'win', 'human', 120, 'u2');

    expect(rewards).not.toBeNull();
    expect(rewards?.breakdown.baseCoins).toBe(COIN_VALUES.humanWin);
    expect(rewards?.coins).toBe(100); // No bonuses
  });

  it('awards first win of day bonus', async () => {
    mockProgressionService.getUserProfile.mockResolvedValue({
      userId: 'u1',
      username: 'player',
      coins: 100,
      matchmakingRating: 1000,
      gamesPlayed: 5,
      gamesWon: 2,
      lastActiveAt: Date.now(),
      unlockedAbilities: ['earthquake'],
      loadout: ['earthquake'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockProgressionService.getTodayStats.mockResolvedValue({ wins: 0, matches: 0 });
    mockProgressionService.getWinStreak.mockResolvedValue(1);

    const rewards = await awardMatchRewards('u1', 'win', 'human', 120, 'u2');

    expect(rewards?.breakdown.firstWinBonus).toBe(COIN_VALUES.firstWinOfDay);
    expect(rewards?.coins).toBe(COIN_VALUES.humanWin + COIN_VALUES.firstWinOfDay);
  });

  it('awards 5-game streak bonus', async () => {
    mockProgressionService.getUserProfile.mockResolvedValue({
      userId: 'u1',
      username: 'player',
      coins: 100,
      matchmakingRating: 1000,
      gamesPlayed: 5,
      gamesWon: 5,
      lastActiveAt: Date.now(),
      unlockedAbilities: ['earthquake'],
      loadout: ['earthquake'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockProgressionService.getTodayStats.mockResolvedValue({ wins: 1, matches: 1 });
    mockProgressionService.getWinStreak.mockResolvedValue(5);

    const rewards = await awardMatchRewards('u1', 'win', 'human', 120, 'u2');

    expect(rewards?.breakdown.streakBonus).toBe(COIN_VALUES.streak5);
  });

  it('awards reduced coins for AI win', async () => {
    mockProgressionService.getUserProfile.mockResolvedValue({
      userId: 'u1',
      username: 'player',
      coins: 100,
      matchmakingRating: 1000,
      gamesPlayed: 5,
      gamesWon: 2,
      lastActiveAt: Date.now(),
      unlockedAbilities: ['earthquake'],
      loadout: ['earthquake'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockProgressionService.getTodayStats.mockResolvedValue({ wins: 1, matches: 2 });
    mockProgressionService.getWinStreak.mockResolvedValue(1);

    const rewards = await awardMatchRewards('u1', 'win', 'ai_easy', 120, 'ai');

    expect(rewards?.breakdown.baseCoins).toBe(COIN_VALUES.aiEasyWin);
  });

  it('awards minimal coins for AI loss', async () => {
    mockProgressionService.getUserProfile.mockResolvedValue({
      userId: 'u1',
      username: 'player',
      coins: 100,
      matchmakingRating: 1000,
      gamesPlayed: 5,
      gamesWon: 2,
      lastActiveAt: Date.now(),
      unlockedAbilities: ['earthquake'],
      loadout: ['earthquake'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const rewards = await awardMatchRewards('u1', 'loss', 'ai_easy', 120, 'ai');

    expect(rewards?.breakdown.baseCoins).toBe(COIN_VALUES.aiLoss);
  });
});
```

**Test:**
- Run: `pnpm --filter web test progression`

**Verify:**
- All tests pass
- Coverage includes all reward scenarios

---

### Step 14: Update Existing Tests

**Files to modify:**
- Any test files that reference `UserProfile` with `level` or `xp` fields

**Implementation details:**
1. Find all test files:
```bash
grep -r "level:" packages/web/src/__tests__/*.test.ts
grep -r "xp:" packages/web/src/__tests__/*.test.ts
```

2. For each file found:
   - Remove `level` and `xp` from mock UserProfile objects
   - Add `matchmakingRating` and `gamesWon` instead
   - Update expectations if tests check level/xp values

**Test:**
- Run: `pnpm --filter web test`

**Verify:**
- All existing tests pass
- No TypeScript errors related to UserProfile

---

### Step 15: Build and Final Integration Test

**Files to modify:**
- None (final verification step)

**Implementation details:**
1. Build all packages: `pnpm build:all`
2. Run all tests: `pnpm --filter web test`
3. Start dev server: `pnpm dev`
4. Manual testing checklist:
   - Create new account → should have 4 starter abilities
   - Play AI match → check coin rewards
   - Play human match → check coin rewards
   - Check first win of day bonus
   - Win 5 in a row → check streak bonus
   - Open ability shop → check tier-based display
   - Unlock a Bronze ability → verify coin deduction
   - Check post-match screen → no XP/level display
   - Check main menu → shows coins/games/win rate
   - Check profile page → updated displays

**Test:**
- All manual tests above

**Verify:**
- No console errors
- Progression system works end-to-end
- Database updates correctly
- UI displays correctly

---

## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| Database schema changes (add matchmaking_rating, games_won) | Step 4 |
| Database schema changes (remove level, xp, rank) | Step 4 |
| Database schema changes (update default unlocked_abilities) | Step 4 |
| Ability unlock costs updated | Step 1 |
| UserProfile type updated | Step 2 |
| MatchResult type updated | Step 2 |
| COIN_VALUES updated to spec | Step 2 |
| Coin reward calculation (human win: 100) | Step 7 |
| Coin reward calculation (human loss: 30) | Step 7 |
| Coin reward calculation (AI wins: 20/40/60) | Step 7 |
| Coin reward calculation (AI loss: 10) | Step 7 |
| First win of day: +50 | Step 7 |
| 5-game streak: +25 | Step 7 |
| Starter abilities: earthquake, mini_blocks, clear_rows, fill_holes | Step 1, Step 3 |
| Bronze tier: 500 coins each | Step 1, Step 9 |
| Silver tier: 1000 coins each | Step 1, Step 9 |
| Gold tier: 2000 coins each | Step 1, Step 9 |
| Platinum tier: 3500 coins each | Step 1, Step 9 |
| Main menu shows coins/games/win rate | Step 8 |
| Main menu removes level/XP display | Step 8 |
| Ability shop uses tier system | Step 9 |
| Post-game shows coin rewards | Step 10 |
| Post-game removes XP/level displays | Step 10 |
| Post-game suggests next unlock | Step 10 |
| Profile page updated | Step 11 |
| Unit tests for coin rewards | Step 13 |
| All tests pass | Step 14, Step 15 |
| Build succeeds | Step 15 |
| Manual testing complete | Step 15 |

---

## Build/Test Commands

- **Build all**: `pnpm build:all`
- **Build web only**: `pnpm --filter web build`
- **Build game-core only**: `pnpm --filter game-core build`
- **Test all**: `pnpm --filter web test`
- **Test specific file**: `pnpm --filter web test progression`
- **Dev server**: `pnpm dev`
- **Type check**: `pnpm type-check`
