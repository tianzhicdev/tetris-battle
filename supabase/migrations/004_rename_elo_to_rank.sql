-- Rename elo columns to rank
ALTER TABLE user_profiles
  RENAME COLUMN elo TO rank;

ALTER TABLE match_results
  RENAME COLUMN eloChange TO rankChange;

ALTER TABLE match_results
  RENAME COLUMN eloAfter TO rankAfter;

ALTER TABLE match_results
  RENAME COLUMN opponentElo TO opponentRank;

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration complete - elo columns renamed to rank';
END $$;
