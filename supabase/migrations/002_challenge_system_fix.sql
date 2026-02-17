-- ============================================================================
-- Migration 002: Fix challenge system
-- Adds missing columns, status values, RPC functions, and Realtime publication
-- ============================================================================

-- 1. Add missing columns to friend_challenges
ALTER TABLE friend_challenges
  ADD COLUMN IF NOT EXISTS "roomId" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ;

-- 2. Fix status constraint to include 'cancelled'
ALTER TABLE friend_challenges
  DROP CONSTRAINT IF EXISTS friend_challenges_status_check;

ALTER TABLE friend_challenges
  ADD CONSTRAINT friend_challenges_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

-- 3. Enable Realtime for friend_challenges (critical - without this no events fire)
ALTER PUBLICATION supabase_realtime ADD TABLE friend_challenges;

-- Also ensure friendships table sends Realtime events for friend request notifications
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;

-- 4. Create accept_challenge function
CREATE OR REPLACE FUNCTION accept_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
  v_room_id TEXT;
BEGIN
  -- Lock the row and validate it's still pending and not expired
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
      'error', 'CHALLENGE_NOT_FOUND'
    );
  END IF;

  -- Generate room ID
  v_room_id := 'game_' ||
               extract(epoch from now())::bigint || '_' ||
               substr(md5(random()::text || p_challenge_id::text), 1, 8);

  -- Update challenge status
  UPDATE friend_challenges
  SET
    status = 'accepted',
    "roomId" = v_room_id,
    "acceptedAt" = NOW(),
    "resolvedAt" = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object(
    'success', true,
    'roomId', v_room_id,
    'challengeId', v_challenge.id::text,
    'challengerId', v_challenge."challengerId",
    'challengedId', v_challenge."challengedId"
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CONCURRENT_MODIFICATION'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create decline_challenge function
CREATE OR REPLACE FUNCTION decline_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
BEGIN
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending'
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND'
    );
  END IF;

  UPDATE friend_challenges
  SET
    status = 'declined',
    "resolvedAt" = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CONCURRENT_MODIFICATION'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create cancel_challenge function
CREATE OR REPLACE FUNCTION cancel_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
BEGIN
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND "challengerId" = p_user_id
    AND status = 'pending'
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND'
    );
  END IF;

  UPDATE friend_challenges
  SET
    status = 'cancelled',
    "resolvedAt" = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CONCURRENT_MODIFICATION'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_challenge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION decline_challenge TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cancel_challenge TO authenticated, anon;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_friend_challenges_challenged ON friend_challenges("challengedId", status);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_challenger ON friend_challenges("challengerId", status);
CREATE INDEX IF NOT EXISTS idx_friend_challenges_expires ON friend_challenges("expiresAt") WHERE status = 'pending';
