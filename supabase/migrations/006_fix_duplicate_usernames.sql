-- Migration: Fix duplicate usernames
-- 1. Delete duplicate usernames (keep the oldest one)
-- 2. Add UNIQUE constraint on username

-- Delete duplicates, keeping only the row with the oldest createdAt
DELETE FROM user_profiles a
USING user_profiles b
WHERE a."userId" > b."userId"
  AND a.username = b.username;

-- Add UNIQUE constraint on username
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_username_unique UNIQUE (username);

-- Add index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
