-- Fix naming convention mismatch from migration 007
-- Migration 007 used snake_case (games_won, matchmaking_rating)
-- But TypeScript code expects camelCase (gamesWon, matchmakingRating)

-- If games_won exists (from migration 007), migrate data to gamesWon
DO $$
BEGIN
  -- Add gamesWon column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'gamesWon') THEN
    ALTER TABLE user_profiles ADD COLUMN "gamesWon" INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- If games_won exists, migrate data and drop it
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_profiles' AND column_name = 'games_won') THEN
    UPDATE user_profiles SET "gamesWon" = games_won;
    ALTER TABLE user_profiles DROP COLUMN games_won;
  END IF;

  -- Add matchmakingRating column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'matchmakingRating') THEN
    ALTER TABLE user_profiles ADD COLUMN "matchmakingRating" INTEGER NOT NULL DEFAULT 1000;
  END IF;

  -- If matchmaking_rating exists, migrate data and drop it
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_profiles' AND column_name = 'matchmaking_rating') THEN
    UPDATE user_profiles SET "matchmakingRating" = matchmaking_rating;
    ALTER TABLE user_profiles DROP COLUMN matchmaking_rating;
  END IF;

  -- Drop old rank column if it still exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_profiles' AND column_name = 'rank') THEN
    -- Migrate rank to matchmakingRating if matchmakingRating is still default
    UPDATE user_profiles SET "matchmakingRating" = rank WHERE "matchmakingRating" = 1000;
    ALTER TABLE user_profiles DROP COLUMN rank;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_matchmaking_rating
  ON user_profiles("matchmakingRating" DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_games_won
  ON user_profiles("gamesWon" DESC);

-- Add comments
COMMENT ON COLUMN user_profiles."gamesWon" IS 'Total number of games won by the user';
COMMENT ON COLUMN user_profiles."matchmakingRating" IS 'Matchmaking rating (formerly rank/elo)';
