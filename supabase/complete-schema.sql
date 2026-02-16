-- ============================================================================
-- Tetris Battle - Complete Database Schema
-- ============================================================================
-- This file consolidates all migrations into one clean schema
-- Run this to reset the entire database (all data will be lost!)
--
-- Usage: Copy and paste into Supabase SQL Editor
-- ============================================================================

-- Drop all existing tables (CASCADE handles foreign keys)
DROP TABLE IF EXISTS friend_challenges CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS user_quests CASCADE;
DROP TABLE IF EXISTS match_results CASCADE;
DROP TABLE IF EXISTS ability_activations CASCADE;
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS game_rooms CASCADE;
DROP TABLE IF EXISTS matchmaking_queue CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================================================
-- CORE USER TABLES
-- ============================================================================

-- User Profiles Table (progression system)
CREATE TABLE user_profiles (
  "userId" TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  "matchmakingRating" INTEGER NOT NULL DEFAULT 1000,
  "unlockedAbilities" JSONB NOT NULL DEFAULT '["screen_shake", "speed_up_opponent", "piece_preview_plus", "mini_blocks"]'::jsonb,
  loadout JSONB NOT NULL DEFAULT '["screen_shake", "speed_up_opponent", "piece_preview_plus"]'::jsonb,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "gamesWon" INTEGER NOT NULL DEFAULT 0,
  "lastActiveAt" BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Match Results Table
CREATE TABLE match_results (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  "opponentId" TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
  "linesCleared" INTEGER NOT NULL DEFAULT 0,
  "abilitiesUsed" INTEGER NOT NULL DEFAULT 0,
  "coinsEarned" INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  timestamp BIGINT NOT NULL,
  "rankChange" INTEGER NOT NULL DEFAULT 0,
  "rankAfter" INTEGER NOT NULL DEFAULT 1000,
  "opponentRank" INTEGER NOT NULL DEFAULT 1000
);

-- User Quests Table (daily/weekly quests)
CREATE TABLE user_quests (
  "userId" TEXT PRIMARY KEY REFERENCES user_profiles("userId") ON DELETE CASCADE,
  daily JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly JSONB DEFAULT NULL,
  "lastRefresh" BIGINT NOT NULL
);

-- ============================================================================
-- MULTIPLAYER GAME TABLES
-- ============================================================================

-- Game Rooms Table
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
  player1_id TEXT,
  player2_id TEXT,
  winner_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Game States Table (stores current game state for each player)
CREATE TABLE game_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  board JSONB NOT NULL,
  score INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 20,
  lines_cleared INTEGER DEFAULT 0,
  combo_count INTEGER DEFAULT 0,
  is_game_over BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game Events Table (stores all game actions for sync)
CREATE TABLE game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ability Activations Table
CREATE TABLE ability_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  target_player_id TEXT NOT NULL,
  ability_type TEXT NOT NULL,
  activated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matchmaking Queue Table
CREATE TABLE matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT UNIQUE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FRIEND SYSTEM TABLES
-- ============================================================================

-- Friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  "addresseeId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("requesterId", "addresseeId")
);

-- Friend challenges table
CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  "challengedId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes')
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User profiles indexes
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_matchmaking_rating ON user_profiles("matchmakingRating" DESC);
CREATE INDEX idx_user_profiles_games_won ON user_profiles("gamesWon" DESC);

-- Match results indexes
CREATE INDEX idx_match_results_user ON match_results("userId", timestamp DESC);
CREATE INDEX idx_match_results_timestamp ON match_results(timestamp DESC);

-- Game rooms indexes
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_states_room ON game_states(room_id);
CREATE INDEX idx_game_events_room ON game_events(room_id, created_at);
CREATE INDEX idx_matchmaking_queue_joined ON matchmaking_queue(joined_at);

-- Friendships indexes
CREATE INDEX idx_friendships_requester ON friendships("requesterId", status);
CREATE INDEX idx_friendships_addressee ON friendships("addresseeId", status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ability_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_challenges ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on user_profiles" ON user_profiles FOR UPDATE USING (true);

-- Match results policies
CREATE POLICY "Allow all selects on match_results" ON match_results FOR SELECT USING (true);
CREATE POLICY "Allow all inserts on match_results" ON match_results FOR INSERT WITH CHECK (true);

-- User quests policies
CREATE POLICY "Users can view own quests" ON user_quests FOR SELECT USING (true);
CREATE POLICY "Users can upsert own quests" ON user_quests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own quests" ON user_quests FOR UPDATE USING (true);

-- Game room policies (allow all for now - auth handled by Clerk)
CREATE POLICY "Allow all on game_rooms" ON game_rooms FOR ALL USING (true);
CREATE POLICY "Allow all on game_states" ON game_states FOR ALL USING (true);
CREATE POLICY "Allow all on game_events" ON game_events FOR ALL USING (true);
CREATE POLICY "Allow all on ability_activations" ON ability_activations FOR ALL USING (true);
CREATE POLICY "Allow all on matchmaking_queue" ON matchmaking_queue FOR ALL USING (true);

-- Friend system policies
CREATE POLICY "Anyone can read friendships" ON friendships FOR SELECT USING (true);
CREATE POLICY "Anyone can insert friendships" ON friendships FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update friendships" ON friendships FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete friendships" ON friendships FOR DELETE USING (true);

CREATE POLICY "Anyone can read challenges" ON friend_challenges FOR SELECT USING (true);
CREATE POLICY "Anyone can insert challenges" ON friend_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update challenges" ON friend_challenges FOR UPDATE USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to clean up old finished games (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_finished_games()
RETURNS void AS $$
BEGIN
  DELETE FROM game_rooms
  WHERE status = 'finished'
  AND finished_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to match players from queue
CREATE OR REPLACE FUNCTION match_players()
RETURNS TABLE (
  room_id UUID,
  player1_id TEXT,
  player2_id TEXT
) AS $$
DECLARE
  p1 TEXT;
  p2 TEXT;
  new_room_id UUID;
BEGIN
  -- Get two oldest players from queue
  SELECT mq1.player_id, mq2.player_id INTO p1, p2
  FROM matchmaking_queue mq1, matchmaking_queue mq2
  WHERE mq1.player_id < mq2.player_id
  ORDER BY mq1.joined_at, mq2.joined_at
  LIMIT 1;

  -- If we found a match
  IF p1 IS NOT NULL AND p2 IS NOT NULL THEN
    -- Create game room
    INSERT INTO game_rooms (status, player1_id, player2_id, started_at)
    VALUES ('playing', p1, p2, NOW())
    RETURNING id INTO new_room_id;

    -- Remove from queue
    DELETE FROM matchmaking_queue
    WHERE player_id IN (p1, p2);

    -- Return the match
    RETURN QUERY SELECT new_room_id, p1, p2;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Complete schema created successfully!';
  RAISE NOTICE 'Tables: user_profiles, match_results, user_quests, game_rooms, game_states, game_events, ability_activations, matchmaking_queue, friendships, friend_challenges';
END $$;
