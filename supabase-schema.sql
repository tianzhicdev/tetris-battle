-- Tetris Battle Progression System Schema
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  "userId" TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  elo INTEGER NOT NULL DEFAULT 1000,
  "unlockedAbilities" JSONB NOT NULL DEFAULT '["screen_shake", "speed_up_opponent", "piece_preview_plus", "mini_blocks"]'::jsonb,
  loadout JSONB NOT NULL DEFAULT '["screen_shake", "speed_up_opponent", "piece_preview_plus"]'::jsonb,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);

-- Match Results Table
CREATE TABLE IF NOT EXISTS match_results (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "opponentId" TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
  "linesCleared" INTEGER NOT NULL DEFAULT 0,
  "abilitiesUsed" INTEGER NOT NULL DEFAULT 0,
  "coinsEarned" INTEGER NOT NULL DEFAULT 0,
  "xpEarned" INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  timestamp BIGINT NOT NULL
);

-- User Quests Table (for daily/weekly quests)
CREATE TABLE IF NOT EXISTS user_quests (
  "userId" TEXT PRIMARY KEY REFERENCES user_profiles("userId"),
  daily JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly JSONB DEFAULT NULL,
  "lastRefresh" BIGINT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_results_user ON match_results("userId", timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_match_results_timestamp ON match_results(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can read all profiles but only update their own
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies: Users can only see their own match results
CREATE POLICY "Users can view own match results"
  ON match_results FOR SELECT
  USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own match results"
  ON match_results FOR INSERT
  WITH CHECK ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies: Users can only see/update their own quests
CREATE POLICY "Users can view own quests"
  ON user_quests FOR SELECT
  USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can upsert own quests"
  ON user_quests FOR INSERT
  WITH CHECK ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own quests"
  ON user_quests FOR UPDATE
  USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');
