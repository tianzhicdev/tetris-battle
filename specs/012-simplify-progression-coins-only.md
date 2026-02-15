# Spec 012: Simplify Game Progression - Coins Only

**Status**: Draft
**Author**: Claude Code
**Date**: 2026-02-15

## Problem Statement

The current progression system is overly complex with multiple metrics (level, XP, rank, stars, coins) that confuse players and dilute the core gameplay loop. Players must track:
- **Level** - Increases with XP
- **XP** - Earned from games
- **Rank** - ELO-based competitive rating
- **Stars** - In-game currency for abilities (per match)
- **Coins** - Persistent currency (unclear purpose)

This complexity:
1. Creates cognitive overload for new players
2. Dilutes the reward experience (too many currencies)
3. Makes progression unclear
4. Requires more UI space and complexity

## Proposed Solution

**Simplify to a single progression currency: Coins**

### New System Design

**Single Currency: Coins**
- Earned from playing games (win or lose)
- Used to unlock new abilities permanently
- Clear, simple progression path

**Remove:**
- ❌ Level system
- ❌ XP system
- ❌ Complex rank calculations (keep simple matchmaking rating)

**Keep:**
- ✅ Coins (primary progression currency)
- ✅ Stars (in-game ability currency, earned during match)
- ✅ Simple matchmaking rating (internal, not prominently displayed)

### Coin Economy

#### Earning Coins

| Event | Coins Earned | Notes |
|-------|--------------|-------|
| **Win vs Human** | 100 | Competitive victory |
| **Loss vs Human** | 30 | Participation reward |
| **Win vs AI (Easy)** | 20 | Practice mode |
| **Win vs AI (Medium)** | 40 | Practice mode |
| **Win vs AI (Hard)** | 60 | Practice mode |
| **Loss vs AI** | 10 | Minimal participation |
| **First win of day** | +50 | Daily bonus |
| **5-game streak** | +25 | Engagement bonus |

**Rationale:**
- Human matches are most rewarding (encourage real competition)
- Losses still give coins (prevent frustration, encourage play)
- AI matches give reduced rewards (prevent farming)
- Daily/streak bonuses encourage regular play

#### Ability Unlock System

**All abilities start locked** (except 4 starter abilities)

**Starter Abilities** (Free, always available):
- `earthquake` (Debuff, 50 stars)
- `mini_blocks` (Buff, 50 stars)
- `clear_rows` (Debuff, 100 stars)
- `fill_holes` (Buff, 100 stars)

**Unlockable Abilities** (Purchase with coins):

| Tier | Cost | Abilities |
|------|------|-----------|
| **Bronze** | 500 coins | `random_spawner`, `row_rotate`, `circle_bomb`, `cross_firebomb` |
| **Silver** | 1000 coins | `death_cross`, `gold_digger`, `cascade_multiplier`, `deflect_shield` |
| **Gold** | 2000 coins | `speed_up_opponent`, `reverse_controls`, `piece_preview_plus`, `weird_shapes` |
| **Platinum** | 3500 coins | `rotation_lock`, `blind_spot`, `screen_shake`, `shrink_ceiling` |

**Progression Timeline (estimated):**
- First Bronze unlock: ~5-10 games
- All Bronze unlocked: ~20-30 games
- All Silver unlocked: ~50-70 games
- All Gold unlocked: ~100-120 games
- All abilities unlocked: ~180-200 games

## Database Schema Changes

### Before (Current Schema)

```sql
-- user_profiles table
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  level INTEGER DEFAULT 1,          -- REMOVE
  xp INTEGER DEFAULT 0,              -- REMOVE
  rank INTEGER DEFAULT 1000,         -- SIMPLIFY to matchmaking_rating
  coins INTEGER DEFAULT 0,
  unlocked_abilities JSONB DEFAULT '[]'::jsonb,
  -- ... other fields
);

-- game_sessions table
CREATE TABLE game_sessions (
  -- ... existing fields
  xp_gained INTEGER,                 -- REMOVE
  level_before INTEGER,              -- REMOVE
  level_after INTEGER,               -- REMOVE
  -- ... other fields
);
```

### After (New Schema)

```sql
-- user_profiles table
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  coins INTEGER DEFAULT 0,                    -- Primary currency
  matchmaking_rating INTEGER DEFAULT 1000,    -- Internal rating (not displayed)
  unlocked_abilities JSONB DEFAULT '["earthquake", "mini_blocks", "clear_rows", "fill_holes"]'::jsonb,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- game_sessions table
CREATE TABLE game_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES user_profiles(user_id),
  opponent_id TEXT,
  opponent_type TEXT CHECK (opponent_type IN ('human', 'ai_easy', 'ai_medium', 'ai_hard')),
  result TEXT CHECK (result IN ('win', 'loss')),
  coins_earned INTEGER NOT NULL,
  stars_earned INTEGER,
  lines_cleared INTEGER,
  abilities_used JSONB,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ability_unlocks table (NEW - track unlock history)
CREATE TABLE ability_unlocks (
  unlock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id),
  ability_type TEXT NOT NULL,
  cost INTEGER NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW()
);
```

## UI/UX Changes

### Main Menu Changes

**Before:**
```
┌─────────────────────────────────┐
│  Level 23                       │
│  XP: 4,560 / 5,000              │
│  Rank: 1,245                    │
│  Coins: 350                     │
└─────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────┐
│  💰 Coins: 1,250                │
│  🎮 Games Played: 156           │
│  🏆 Win Rate: 68%               │
└─────────────────────────────────┘
```

### Ability Shop (New Screen)

```
┌─────────────────────────────────────────────┐
│  🛒 Ability Shop          💰 Coins: 1,250  │
├─────────────────────────────────────────────┤
│                                             │
│  STARTER ABILITIES (Owned)                  │
│  ✓ Earthquake    ✓ Mini Blocks             │
│  ✓ Clear Rows    ✓ Fill Holes              │
│                                             │
│  BRONZE TIER (500 coins each)               │
│  🔒 Random Spawner  [UNLOCK 500💰]         │
│  🔒 Row Rotate      [UNLOCK 500💰]         │
│  ✓ Circle Bomb                              │
│  🔒 Cross Firebomb  [UNLOCK 500💰]         │
│                                             │
│  SILVER TIER (1000 coins each)              │
│  🔒 Death Cross     [UNLOCK 1000💰]        │
│  🔒 Gold Digger     [UNLOCK 1000💰]        │
│  ... (collapsed)                            │
│                                             │
└─────────────────────────────────────────────┘
```

### Post-Game Summary

**Before:**
```
┌─────────────────────────────────┐
│  Victory!                       │
│  +250 XP                        │
│  +50 Coins                      │
│  Rank: 1,245 → 1,260            │
│  Level 23 (92% to next level)   │
└─────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────┐
│  🏆 Victory!                    │
│                                 │
│  +100 💰 Coins                  │
│  +50  🎁 Daily Bonus            │
│                                 │
│  Total: 150 coins earned!       │
│  Balance: 1,400 coins           │
│                                 │
│  🎯 Next unlock: Row Rotate     │
│     (350 coins away)            │
└─────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Database Migration

**Files to change:**
- `packages/web/src/lib/supabase.ts`
- Database migration scripts

**Tasks:**
1. Create new `ability_unlocks` table
2. Add `matchmaking_rating` column to `user_profiles`
3. Set default unlocked abilities for all users
4. Migrate existing `rank` to `matchmaking_rating`
5. Drop `level`, `xp` columns (after backup)
6. Update `game_sessions` schema

**Migration SQL:**
```sql
-- 1. Add new columns
ALTER TABLE user_profiles
  ADD COLUMN matchmaking_rating INTEGER DEFAULT 1000,
  ADD COLUMN games_played INTEGER DEFAULT 0,
  ADD COLUMN games_won INTEGER DEFAULT 0;

-- 2. Migrate existing rank to matchmaking_rating
UPDATE user_profiles SET matchmaking_rating = rank;

-- 3. Set starter abilities for all users
UPDATE user_profiles
SET unlocked_abilities = '["earthquake", "mini_blocks", "clear_rows", "fill_holes"]'::jsonb
WHERE unlocked_abilities IS NULL OR unlocked_abilities = '[]'::jsonb;

-- 4. Create ability_unlocks table
CREATE TABLE ability_unlocks (
  unlock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id),
  ability_type TEXT NOT NULL,
  cost INTEGER NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW()
);

-- 5. Drop old columns (AFTER backing up data)
-- ALTER TABLE user_profiles DROP COLUMN level;
-- ALTER TABLE user_profiles DROP COLUMN xp;
-- ALTER TABLE user_profiles DROP COLUMN rank;
```

### Phase 2: Game Logic Updates

**Files to change:**
- `packages/web/src/lib/supabase.ts` - Update progression functions
- `packages/game-core/src/abilities.json` - Add unlock tier and cost metadata
- `packages/game-core/src/types.ts` - Update UserProfile type

**New functions needed:**

```typescript
// supabase.ts
interface CoinReward {
  baseCoins: number;
  dailyBonus: number;
  streakBonus: number;
  total: number;
}

async function calculateCoinReward(
  userId: string,
  result: 'win' | 'loss',
  opponentType: 'human' | 'ai_easy' | 'ai_medium' | 'ai_hard'
): Promise<CoinReward>;

async function unlockAbility(
  userId: string,
  abilityType: string
): Promise<{ success: boolean; newBalance: number }>;

async function getUnlockedAbilities(userId: string): Promise<string[]>;

async function getAvailableAbilities(userId: string): Promise<{
  owned: Ability[];
  availableToPurchase: Ability[];
}>;
```

**Update abilities.json:**
```json
{
  "earthquake": {
    "id": "earthquake",
    "name": "Earthquake",
    "unlockTier": "starter",
    "unlockCost": 0,
    "starCost": 50,
    "category": "debuff"
  },
  "random_spawner": {
    "id": "random_spawner",
    "name": "Random Spawner",
    "unlockTier": "bronze",
    "unlockCost": 500,
    "starCost": 60,
    "category": "debuff"
  }
}
```

### Phase 3: UI Implementation

**New components needed:**
- `AbilityShop.tsx` - Main shop interface
- `AbilityCard.tsx` - Individual ability display with unlock button
- `CoinRewardDisplay.tsx` - Post-game coin summary

**Files to modify:**
- `MainMenu.tsx` - Remove level/XP display, add coins prominently
- `GameOverScreen.tsx` - Show coin rewards instead of XP/level
- `UserProfileDisplay.tsx` - Simplify to show coins, games, win rate

**Loadout Selection Changes:**
- Only show unlocked abilities in loadout selector
- Add "🔒 Unlock more in Shop" button for locked abilities
- Visual indicator for starter vs unlocked abilities

### Phase 4: Testing

**Unit Tests:**
- [ ] `calculateCoinReward()` - All scenarios
- [ ] `unlockAbility()` - Success and failure cases
- [ ] Insufficient coins handling
- [ ] Already unlocked ability handling

**Integration Tests:**
- [ ] Full game flow with coin rewards
- [ ] Ability unlock flow
- [ ] Loadout changes with unlocked abilities
- [ ] Migration script on test database

**Manual Testing:**
- [ ] New user experience (only starter abilities)
- [ ] Unlock first ability
- [ ] Post-game coin display
- [ ] Ability shop UI/UX
- [ ] Daily bonus tracking
- [ ] Streak bonus tracking

## Migration Strategy for Existing Users

### Option A: Fresh Start (Recommended)
- All users start with 0 coins and 4 starter abilities
- Old level/XP/rank data archived but not converted
- Clean slate for simplified system

**Pros:**
- Simplest implementation
- Fair for all players
- Encourages re-engagement

**Cons:**
- Loses existing progression
- May upset veteran players

### Option B: Coin Grant Based on Level
- Grant coins based on old level: `coins = level * 100`
- Unlock proportional abilities automatically
- Preserve some progression

**Pros:**
- Respects existing progress
- Veteran players start ahead

**Cons:**
- More complex migration
- May create imbalance

### Recommendation
Use **Option A** if user base is small (<1000 active users).
Use **Option B** if user base is larger or has paying customers.

## Rollout Plan

1. **Development** (2-3 days)
   - Implement database migration
   - Update game logic
   - Build UI components

2. **Testing** (1-2 days)
   - Run all tests
   - Manual QA
   - Beta test with 5-10 users

3. **Deployment** (Staged)
   - Deploy database changes (non-breaking)
   - Deploy backend changes
   - Deploy frontend changes
   - Monitor for issues

4. **Communication**
   - In-app message explaining new system
   - Highlight simpler progression
   - Encourage ability shop exploration

## Success Metrics

Track these metrics post-launch:

- **Engagement**: Games per user per week
- **Retention**: 7-day and 30-day retention
- **Progression**: Average coins earned per day
- **Monetization**: Time to unlock all abilities
- **Satisfaction**: User feedback on simplified system

**Target Goals:**
- ≥15% increase in games per user per week
- ≥10% increase in 7-day retention
- Average 200 coins earned per day (active users)
- 90% of users unlock all abilities within 60 days

## Future Enhancements

Once simplified system is stable:

1. **Cosmetic Shop** - Spend coins on themes, piece skins
2. **Battle Pass** - Seasonal progression with exclusive rewards
3. **Coin Bundles** - Optional coin purchases (monetization)
4. **Daily Challenges** - Extra coin rewards for specific goals
5. **Tournaments** - High coin rewards for competitive events

## Open Questions

1. Should we allow refunds for unlocked abilities? **Recommendation: No**
2. Should there be a coin cap? **Recommendation: No cap**
3. Should matchmaking rating ever be shown? **Recommendation: Only in ranked mode (future)**
4. What happens to user_profiles.rank data? **Recommendation: Archive in separate table**

## Appendix: Full Ability Pricing

| Ability | Tier | Cost | Star Cost |
|---------|------|------|-----------|
| earthquake | Starter | 0 | 50 |
| mini_blocks | Starter | 0 | 50 |
| clear_rows | Starter | 0 | 100 |
| fill_holes | Starter | 0 | 100 |
| random_spawner | Bronze | 500 | 60 |
| row_rotate | Bronze | 500 | 70 |
| circle_bomb | Bronze | 500 | 75 |
| cross_firebomb | Bronze | 500 | 100 |
| death_cross | Silver | 1000 | 80 |
| gold_digger | Silver | 1000 | 90 |
| cascade_multiplier | Silver | 1000 | 75 |
| deflect_shield | Silver | 1000 | 60 |
| speed_up_opponent | Gold | 2000 | 70 |
| reverse_controls | Gold | 2000 | 80 |
| piece_preview_plus | Gold | 2000 | 50 |
| weird_shapes | Gold | 2000 | 100 |
| rotation_lock | Platinum | 3500 | 90 |
| blind_spot | Platinum | 3500 | 100 |
| screen_shake | Platinum | 3500 | 60 |
| shrink_ceiling | Platinum | 3500 | 120 |
