-- ============================================================================
-- Tetris Battle - Canonical Fresh-Start Schema
-- ============================================================================
-- This schema is intentionally destructive and represents the current runtime
-- model. It removes legacy Supabase-realtime game tables that are no longer
-- used after the PartyKit server-authoritative migration.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop legacy functions first (if they exist).
DROP FUNCTION IF EXISTS accept_challenge(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS decline_challenge(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancel_challenge(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS expire_old_challenges() CASCADE;
DROP FUNCTION IF EXISTS cleanup_finished_games() CASCADE;
DROP FUNCTION IF EXISTS match_players() CASCADE;

-- Drop all known tables from previous iterations.
DROP TABLE IF EXISTS friend_challenges CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS match_results CASCADE;
DROP TABLE IF EXISTS user_quests CASCADE;
DROP TABLE IF EXISTS ability_activations CASCADE;
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS game_rooms CASCADE;
DROP TABLE IF EXISTS matchmaking_queue CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================================================
-- USER PROFILES
-- ============================================================================

CREATE TABLE user_profiles (
  "userId" TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  coins INTEGER NOT NULL DEFAULT 0,
  "matchmakingRating" INTEGER NOT NULL DEFAULT 1000,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "gamesWon" INTEGER NOT NULL DEFAULT 0,
  "lastActiveAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  "unlockedAbilities" JSONB NOT NULL DEFAULT '["mini_blocks", "fill_holes", "clear_rows", "earthquake"]'::jsonb,
  loadout JSONB NOT NULL DEFAULT '["mini_blocks", "fill_holes", "clear_rows", "earthquake"]'::jsonb,
  "themePreference" TEXT DEFAULT 'glassmorphism',
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL,
  CHECK ("gamesPlayed" >= 0),
  CHECK ("gamesWon" >= 0),
  CHECK ("gamesWon" <= "gamesPlayed"),
  CHECK (jsonb_typeof("unlockedAbilities") = 'array'),
  CHECK (jsonb_typeof(loadout) = 'array')
);

CREATE INDEX idx_user_profiles_matchmaking_rating
  ON user_profiles ("matchmakingRating" DESC);
CREATE INDEX idx_user_profiles_games_won
  ON user_profiles ("gamesWon" DESC);

-- ============================================================================
-- MATCH HISTORY
-- ============================================================================

CREATE TABLE match_results (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  "opponentId" TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
  "linesCleared" INTEGER NOT NULL DEFAULT 0,
  "abilitiesUsed" INTEGER NOT NULL DEFAULT 0,
  "coinsEarned" INTEGER NOT NULL DEFAULT 0,
  "rankChange" INTEGER NOT NULL DEFAULT 0,
  "rankAfter" INTEGER NOT NULL DEFAULT 1000,
  "opponentRank" INTEGER NOT NULL DEFAULT 1000,
  duration INTEGER NOT NULL DEFAULT 0,
  timestamp BIGINT NOT NULL
);

CREATE INDEX idx_match_results_user_timestamp
  ON match_results ("userId", timestamp DESC);
CREATE INDEX idx_match_results_timestamp
  ON match_results (timestamp DESC);

-- ============================================================================
-- FRIEND SYSTEM
-- ============================================================================

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  "addresseeId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("requesterId", "addresseeId"),
  CHECK ("requesterId" <> "addresseeId")
);

CREATE INDEX idx_friendships_requester_status
  ON friendships ("requesterId", status);
CREATE INDEX idx_friendships_addressee_status
  ON friendships ("addresseeId", status);

CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  "challengedId" TEXT NOT NULL REFERENCES user_profiles("userId") ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  "roomId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  "acceptedAt" TIMESTAMPTZ,
  "resolvedAt" TIMESTAMPTZ,
  CHECK ("challengerId" <> "challengedId")
);

CREATE INDEX idx_friend_challenges_challenged_status
  ON friend_challenges ("challengedId", status);
CREATE INDEX idx_friend_challenges_challenger_status
  ON friend_challenges ("challengerId", status);
CREATE INDEX idx_friend_challenges_expires_pending
  ON friend_challenges ("expiresAt")
  WHERE status = 'pending';
CREATE INDEX idx_friend_challenges_room_accepted
  ON friend_challenges ("roomId")
  WHERE status = 'accepted';

CREATE UNIQUE INDEX idx_unique_pending_challenge
  ON friend_challenges ("challengerId", "challengedId")
  WHERE status = 'pending';

-- ============================================================================
-- CHALLENGE RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
  v_room_id TEXT;
BEGIN
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending'
    AND "expiresAt" > NOW()
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND',
      'message', 'Challenge not found, expired, or already processed'
    );
  END IF;

  v_room_id := 'game_' ||
               extract(epoch from now())::bigint || '_' ||
               substr(md5(random()::text || p_challenge_id::text), 1, 8);

  UPDATE friend_challenges
  SET status = 'accepted',
      "roomId" = v_room_id,
      "acceptedAt" = NOW(),
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object(
    'success', true,
    'roomId', v_room_id,
    'challengeId', v_challenge.id,
    'challengerId', v_challenge."challengerId",
    'challengedId', v_challenge."challengedId"
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CONCURRENT_MODIFICATION',
      'message', 'Challenge is being processed by another request'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decline_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
BEGIN
  UPDATE friend_challenges
  SET status = 'declined',
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', true);
  END IF;

  RETURN json_build_object(
    'success', false,
    'error', 'CHALLENGE_NOT_FOUND',
    'message', 'Challenge not found or already processed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
BEGIN
  UPDATE friend_challenges
  SET status = 'cancelled',
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id
    AND "challengerId" = p_user_id
    AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', true);
  END IF;

  RETURN json_build_object(
    'success', false,
    'error', 'CHALLENGE_NOT_FOUND',
    'message', 'Challenge not found or already processed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS TABLE(expired_count INTEGER) AS $$
BEGIN
  UPDATE friend_challenges
  SET status = 'expired',
      "resolvedAt" = NOW()
  WHERE status = 'pending'
    AND "expiresAt" < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN QUERY SELECT expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION accept_challenge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION decline_challenge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cancel_challenge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION expire_old_challenges TO authenticated, anon;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on user_profiles"
  ON user_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on match_results"
  ON match_results FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on friendships"
  ON friendships FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on friend_challenges"
  ON friend_challenges FOR ALL
  USING (true)
  WITH CHECK (true);

COMMIT;
