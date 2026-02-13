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

-- Indexes for performance
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_states_room ON game_states(room_id);
CREATE INDEX idx_game_events_room ON game_events(room_id, created_at);
CREATE INDEX idx_matchmaking_queue_joined ON matchmaking_queue(joined_at);

-- Enable Row Level Security
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ability_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now - we'll refine later with auth)
CREATE POLICY "Allow all on game_rooms" ON game_rooms FOR ALL USING (true);
CREATE POLICY "Allow all on game_states" ON game_states FOR ALL USING (true);
CREATE POLICY "Allow all on game_events" ON game_events FOR ALL USING (true);
CREATE POLICY "Allow all on ability_activations" ON ability_activations FOR ALL USING (true);
CREATE POLICY "Allow all on matchmaking_queue" ON matchmaking_queue FOR ALL USING (true);

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
