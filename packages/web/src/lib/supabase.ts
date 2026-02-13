import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types
export interface GameRoom {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface GameState {
  id: string;
  room_id: string;
  player_id: string;
  board: any;
  score: number;
  stars: number;
  lines_cleared: number;
  combo_count: number;
  is_game_over: boolean;
  updated_at: string;
}

export interface GameEvent {
  id: string;
  room_id: string;
  player_id: string;
  event_type: 'move' | 'rotate' | 'drop' | 'ability' | 'piece_locked' | 'lines_cleared';
  event_data: any;
  created_at: string;
}

export interface AbilityActivation {
  id: string;
  room_id: string;
  player_id: string;
  target_player_id: string;
  ability_type: string;
  activated_at: string;
}
