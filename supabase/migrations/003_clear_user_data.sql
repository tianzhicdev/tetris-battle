-- Clear all user data (use with caution!)
-- This will delete ALL user profiles and match history

TRUNCATE user_profiles CASCADE;
TRUNCATE match_results CASCADE;

-- Verify tables are empty
DO $$
BEGIN
  RAISE NOTICE 'user_profiles count: %', (SELECT COUNT(*) FROM user_profiles);
  RAISE NOTICE 'match_results count: %', (SELECT COUNT(*) FROM match_results);
END $$;
