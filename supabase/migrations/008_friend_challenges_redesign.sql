-- Friend Challenge System Redesign Migration
-- Date: 2026-02-16
-- Purpose: Add database-first architecture for friend challenges
-- Spec: FRIEND_CHALLENGE_SPEC.md

-- ============================================================================
-- PART 1: Add New Columns to friend_challenges Table
-- ============================================================================

-- Add roomId for storing game room identifier when challenge is accepted
ALTER TABLE friend_challenges
ADD COLUMN IF NOT EXISTS "roomId" TEXT;

-- Add acceptedAt timestamp for when challenge was accepted
ALTER TABLE friend_challenges
ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMPTZ;

-- Add resolvedAt timestamp for when challenge was closed (any terminal status)
ALTER TABLE friend_challenges
ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ;

-- ============================================================================
-- PART 2: Update Status Constraint to Include 'cancelled'
-- ============================================================================

-- Drop existing constraint
ALTER TABLE friend_challenges
DROP CONSTRAINT IF EXISTS friend_challenges_status_check;

-- Add updated constraint with 'cancelled' status
ALTER TABLE friend_challenges
ADD CONSTRAINT friend_challenges_status_check
CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

-- ============================================================================
-- PART 3: Add Performance Indexes
-- ============================================================================

-- Index for querying challenges by challenged user and status
CREATE INDEX IF NOT EXISTS idx_friend_challenges_challenged
ON friend_challenges("challengedId", status);

-- Index for querying challenges by challenger and status
CREATE INDEX IF NOT EXISTS idx_friend_challenges_challenger
ON friend_challenges("challengerId", status);

-- Index for finding expired challenges (for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_friend_challenges_expires
ON friend_challenges("expiresAt")
WHERE status = 'pending';

-- Index for querying by room ID when challenge is accepted
CREATE INDEX IF NOT EXISTS idx_friend_challenges_room
ON friend_challenges("roomId")
WHERE status = 'accepted';

-- ============================================================================
-- PART 4: Unique Constraint for Pending Challenges
-- ============================================================================

-- Prevent duplicate pending challenges between same two users
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_challenge
ON friend_challenges("challengerId", "challengedId")
WHERE status = 'pending';

-- ============================================================================
-- PART 5: accept_challenge Database Function
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_challenge friend_challenges;
  v_room_id TEXT;
BEGIN
  -- Lock row and validate in one atomic operation
  -- This prevents race conditions when multiple clients try to accept simultaneously
  SELECT * INTO v_challenge
  FROM friend_challenges
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending'
    AND "expiresAt" > NOW()
  FOR UPDATE NOWAIT;  -- Fail fast if row is already locked

  -- Validation: Check if challenge was found and is valid
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND',
      'message', 'Challenge not found, expired, or already processed'
    );
  END IF;

  -- Generate unique room ID
  -- Format: game_<timestamp>_<random_hash>
  v_room_id := 'game_' ||
               extract(epoch from now())::bigint || '_' ||
               substr(md5(random()::text || p_challenge_id::text), 1, 8);

  -- Update challenge atomically
  UPDATE friend_challenges
  SET status = 'accepted',
      "roomId" = v_room_id,
      "acceptedAt" = NOW(),
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id;

  -- Return success with full challenge data for both users
  RETURN json_build_object(
    'success', true,
    'roomId', v_room_id,
    'challengeId', v_challenge.id,
    'challengerId', v_challenge."challengerId",
    'challengedId', v_challenge."challengedId"
  );

EXCEPTION
  WHEN lock_not_available THEN
    -- Another client is already processing this challenge
    RETURN json_build_object(
      'success', false,
      'error', 'CONCURRENT_MODIFICATION',
      'message', 'Challenge is being processed by another request'
    );
  WHEN OTHERS THEN
    -- Catch all other errors
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for both authenticated and anonymous users
-- (Authentication is handled by Clerk on client side)
GRANT EXECUTE ON FUNCTION accept_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION accept_challenge TO anon;

-- ============================================================================
-- PART 6: decline_challenge Database Function
-- ============================================================================

CREATE OR REPLACE FUNCTION decline_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
BEGIN
  -- Update challenge status to declined
  -- Only succeeds if challenge is pending and user is the challengedId
  UPDATE friend_challenges
  SET status = 'declined',
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id
    AND "challengedId" = p_user_id
    AND status = 'pending';

  -- Check if update was successful
  IF FOUND THEN
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND',
      'message', 'Challenge not found or you are not authorized to decline it'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION decline_challenge TO anon;

-- ============================================================================
-- PART 7: cancel_challenge Database Function
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_challenge(
  p_challenge_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
BEGIN
  -- Update challenge status to cancelled
  -- Only succeeds if challenge is pending and user is the challengerId
  UPDATE friend_challenges
  SET status = 'cancelled',
      "resolvedAt" = NOW()
  WHERE id = p_challenge_id
    AND "challengerId" = p_user_id
    AND status = 'pending';

  -- Check if update was successful
  IF FOUND THEN
    RETURN json_build_object('success', true);
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'CHALLENGE_NOT_FOUND',
      'message', 'Challenge not found or you are not authorized to cancel it'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_challenge TO anon;

-- ============================================================================
-- PART 8: expire_old_challenges Database Function (Optional - for cron jobs)
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS TABLE(expired_count INTEGER) AS $$
BEGIN
  -- Mark all expired pending challenges
  UPDATE friend_challenges
  SET status = 'expired',
      "resolvedAt" = NOW()
  WHERE status = 'pending'
    AND "expiresAt" < NOW();

  -- Return count of expired challenges
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To schedule this function, use pg_cron or Supabase Edge Functions
-- Example with pg_cron (if available):
-- SELECT cron.schedule('expire-challenges', '*/10 * * * * *', $$SELECT expire_old_challenges()$$);

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- This migration adds:
-- 1. New columns: roomId, acceptedAt, resolvedAt
-- 2. Updated status constraint with 'cancelled'
-- 3. Performance indexes
-- 4. Unique constraint for pending challenges
-- 5. Three database functions: accept_challenge, decline_challenge, cancel_challenge
-- 6. One utility function: expire_old_challenges (for background jobs)

-- Next steps:
-- 1. Apply migration: supabase db push (or equivalent)
-- 2. Verify in psql: \d friend_challenges
-- 3. Test functions: SELECT accept_challenge('00000000-0000-0000-0000-000000000000'::UUID, 'test-user');
