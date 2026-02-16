-- Run this in Supabase SQL Editor to check if challenge exists
SELECT
  id,
  "challengerId",
  "challengedId",
  status,
  "createdAt",
  "expiresAt",
  "roomId"
FROM friend_challenges
WHERE status = 'pending'
  AND "expiresAt" > NOW()
ORDER BY "createdAt" DESC
LIMIT 5;

-- Also check the user IDs to make sure they match
SELECT userId, username FROM user_profiles
WHERE userId IN (
  'user_39gcJIl7derWHfRNf2VdfX8ytDp',  -- laptop_b (sender)
  'user_39dv3FwdPdmQsdUmjbALiZizAZW'   -- receiver
);
