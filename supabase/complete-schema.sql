-- ============================================================================
-- Tetris Battle - Complete Database Schema (v2 - snake_case)
-- ============================================================================
-- All columns use standard snake_case (PostgreSQL convention).
-- TypeScript code maps DB rows to camelCase objects in the service layer.
--
-- Usage: Copy and paste into Supabase SQL Editor to reset the database.
-- WARNING: This drops all existing tables. All data will be lost.
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

-- Drop old functions
DROP FUNCTION IF EXISTS match_players() CASCADE;
DROP FUNCTION IF EXISTS cleanup_finished_games() CASCADE;
DROP FUNCTION IF EXISTS accept_challenge(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS decline_challenge(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancel_challenge(UUID, TEXT) CASCADE;

-- ============================================================================
-- CORE USER TABLES
-- ============================================================================

-- User Profiles Table
CREATE TABLE user_profiles (
  id                  TEXT PRIMARY KEY,             -- Clerk user ID
  username            TEXT UNIQUE NOT NULL,
  coins               INTEGER NOT NULL DEFAULT 0,
  rating              INTEGER NOT NULL DEFAULT 1000,  -- Elo-style matchmaking rating
  games_played        INTEGER NOT NULL DEFAULT 0,
  games_won           INTEGER NOT NULL DEFAULT 0,
  unlocked_abilities  JSONB   NOT NULL DEFAULT '["screen_shake","speed_up_opponent","mini_blocks","earthquake"]'::jsonb,
  loadout             JSONB   NOT NULL DEFAULT '["screen_shake","speed_up_opponent","mini_blocks","earthquake"]'::jsonb,
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Match Results Table
CREATE TABLE match_results (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  opponent_id     TEXT NOT NULL,
  outcome         TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
  coins_earned    INTEGER NOT NULL DEFAULT 0,
  duration        INTEGER NOT NULL DEFAULT 0,     -- seconds
  timestamp       BIGINT  NOT NULL,
  rating_before   INTEGER NOT NULL DEFAULT 1000,
  rating_change   INTEGER NOT NULL DEFAULT 0,
  rating_after    INTEGER NOT NULL DEFAULT 1000,
  opponent_rating INTEGER NOT NULL DEFAULT 1000
);

-- ============================================================================
-- FRIEND SYSTEM TABLES
-- ============================================================================

-- Friendships table
CREATE TABLE friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK(requester_id != addressee_id)
);

-- Friend challenges table
CREATE TABLE friend_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenged_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  room_id       TEXT,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  accepted_at   TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(challenger_id != challenged_id)
);

-- ============================================================================
-- MULTIPLAYER GAME TABLES (used by legacy Supabase-based matchmaking, kept
-- for game_rooms compatibility with existing code)
-- ============================================================================

CREATE TABLE game_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status      TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
  player1_id  TEXT,
  player2_id  TEXT,
  winner_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE matchmaking_queue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  TEXT UNIQUE NOT NULL,
  joined_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User profile lookup
CREATE INDEX idx_user_profiles_username    ON user_profiles(username);
CREATE INDEX idx_user_profiles_rating      ON user_profiles(rating DESC);
CREATE INDEX idx_user_profiles_games_won   ON user_profiles(games_won DESC);

-- Match results
CREATE INDEX idx_match_results_user        ON match_results(user_id, timestamp DESC);
CREATE INDEX idx_match_results_timestamp   ON match_results(timestamp DESC);

-- Game rooms
CREATE INDEX idx_game_rooms_status         ON game_rooms(status);
CREATE INDEX idx_matchmaking_joined        ON matchmaking_queue(joined_at);

-- Friendships
CREATE INDEX idx_friendships_requester     ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee     ON friendships(addressee_id, status);

-- Challenges
CREATE INDEX idx_challenges_challenged     ON friend_challenges(challenged_id, status);
CREATE INDEX idx_challenges_challenger     ON friend_challenges(challenger_id, status);
CREATE INDEX idx_challenges_expires        ON friend_challenges(expires_at) WHERE status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- User profiles: public read, self-write
CREATE POLICY "profiles_select_all"  ON user_profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_all"  ON user_profiles FOR UPDATE USING (true);

-- Match results
CREATE POLICY "match_results_select_all"  ON match_results FOR SELECT USING (true);
CREATE POLICY "match_results_insert_all"  ON match_results FOR INSERT WITH CHECK (true);

-- Friendships
CREATE POLICY "friendships_select_all"  ON friendships FOR SELECT USING (true);
CREATE POLICY "friendships_insert_all"  ON friendships FOR INSERT WITH CHECK (true);
CREATE POLICY "friendships_update_all"  ON friendships FOR UPDATE USING (true);
CREATE POLICY "friendships_delete_all"  ON friendships FOR DELETE USING (true);

-- Challenges
CREATE POLICY "challenges_select_all"  ON friend_challenges FOR SELECT USING (true);
CREATE POLICY "challenges_insert_all"  ON friend_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "challenges_update_all"  ON friend_challenges FOR UPDATE USING (true);

-- Game rooms
CREATE POLICY "game_rooms_all"        ON game_rooms        FOR ALL USING (true);
CREATE POLICY "matchmaking_queue_all" ON matchmaking_queue FOR ALL USING (true);

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Accept a friend challenge atomically (prevents race conditions)
CREATE OR REPLACE FUNCTION accept_challenge(
  p_challenge_id UUID,
  p_user_id      TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
  v_room_id   TEXT;
BEGIN
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND challenged_id = p_user_id
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'CHALLENGE_NOT_FOUND');
  END IF;

  v_room_id := 'game_' || extract(epoch from now())::bigint
               || '_' || substr(md5(random()::text || p_challenge_id::text), 1, 8);

  UPDATE friend_challenges
  SET status      = 'accepted',
      room_id     = v_room_id,
      accepted_at = NOW(),
      resolved_at = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object(
    'success',     true,
    'roomId',      v_room_id,
    'challengeId', v_challenge.id::text,
    'challengerId', v_challenge.challenger_id,
    'challengedId', v_challenge.challenged_id
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'error', 'CONCURRENT_MODIFICATION');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decline a challenge
CREATE OR REPLACE FUNCTION decline_challenge(
  p_challenge_id UUID,
  p_user_id      TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
BEGIN
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND challenged_id = p_user_id
    AND status = 'pending'
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'CHALLENGE_NOT_FOUND');
  END IF;

  UPDATE friend_challenges
  SET status      = 'declined',
      resolved_at = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'error', 'CONCURRENT_MODIFICATION');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel a challenge (by challenger)
CREATE OR REPLACE FUNCTION cancel_challenge(
  p_challenge_id UUID,
  p_user_id      TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
BEGIN
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND challenger_id = p_user_id
    AND status = 'pending'
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'CHALLENGE_NOT_FOUND');
  END IF;

  UPDATE friend_challenges
  SET status      = 'cancelled',
      resolved_at = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'error', 'CONCURRENT_MODIFICATION');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Match players from queue (for Supabase-based matchmaking fallback)
CREATE OR REPLACE FUNCTION match_players()
RETURNS TABLE (room_id UUID, player1_id TEXT, player2_id TEXT) AS $$
DECLARE
  p1 TEXT;
  p2 TEXT;
  new_room_id UUID;
BEGIN
  SELECT mq1.player_id, mq2.player_id INTO p1, p2
  FROM matchmaking_queue mq1, matchmaking_queue mq2
  WHERE mq1.player_id < mq2.player_id
  ORDER BY mq1.joined_at, mq2.joined_at
  LIMIT 1;

  IF p1 IS NOT NULL AND p2 IS NOT NULL THEN
    INSERT INTO game_rooms (status, player1_id, player2_id, started_at)
    VALUES ('playing', p1, p2, NOW())
    RETURNING id INTO new_room_id;

    DELETE FROM matchmaking_queue WHERE player_id IN (p1, p2);
    RETURN QUERY SELECT new_room_id, p1, p2;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_challenge  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION decline_challenge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cancel_challenge  TO authenticated, anon;

-- ============================================================================
-- REALTIME PUBLICATIONS
-- ============================================================================

-- Ensure tables emit Realtime events (required for challenge/friend notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE friend_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Tetris Battle schema v2 created successfully (snake_case columns)!';
  RAISE NOTICE 'Tables: user_profiles, match_results, friendships, friend_challenges, game_rooms, matchmaking_queue';
END $$;
