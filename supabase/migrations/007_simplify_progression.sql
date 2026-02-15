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
UPDATE user_profiles
SET matchmaking_rating = rank
WHERE matchmaking_rating IS NULL;

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
