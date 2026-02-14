-- Friend System Tables

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "addresseeId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("requesterId", "addresseeId")
);

-- Indexes for fast friend list lookups
CREATE INDEX idx_friendships_requester ON friendships("requesterId", status);
CREATE INDEX idx_friendships_addressee ON friendships("addresseeId", status);

-- Friend challenges table
CREATE TABLE IF NOT EXISTS friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "challengerId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  "challengedId" TEXT NOT NULL REFERENCES user_profiles("userId"),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 minutes')
);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_challenges ENABLE ROW LEVEL SECURITY;

-- Permissive policies (matching existing pattern - auth handled by Clerk)
CREATE POLICY "Anyone can read friendships" ON friendships FOR SELECT USING (true);
CREATE POLICY "Anyone can insert friendships" ON friendships FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update friendships" ON friendships FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete friendships" ON friendships FOR DELETE USING (true);

CREATE POLICY "Anyone can read challenges" ON friend_challenges FOR SELECT USING (true);
CREATE POLICY "Anyone can insert challenges" ON friend_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update challenges" ON friend_challenges FOR UPDATE USING (true);
