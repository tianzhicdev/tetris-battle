import { supabase } from '../lib/supabase';
import type { GameRoom } from '../lib/supabase';

export class MatchmakingService {
  /**
   * Join the matchmaking queue
   */
  static async joinQueue(playerId: string): Promise<void> {
    const { error } = await supabase
      .from('matchmaking_queue')
      .insert({ player_id: playerId });

    if (error && error.code !== '23505') {
      // Ignore duplicate key error (already in queue)
      throw error;
    }
  }

  /**
   * Leave the matchmaking queue
   */
  static async leaveQueue(playerId: string): Promise<void> {
    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('player_id', playerId);
  }

  /**
   * Poll for a match (called periodically)
   */
  static async checkForMatch(playerId: string): Promise<GameRoom | null> {
    // Call the match_players function
    const { data, error } = await supabase!.rpc('match_players');

    if (error) {
      console.error('Match check error:', error);
      return null;
    }

    if (data && data.length > 0) {
      const match = data[0];
      // Check if we're in this match
      if (match.player1_id === playerId || match.player2_id === playerId) {
        // Get the full room details
        const { data: room } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', match.room_id)
          .single();

        return room;
      }
    }

    return null;
  }

  /**
   * Subscribe to matchmaking updates
   */
  static subscribeToQueue(
    playerId: string,
    onMatch: (room: GameRoom) => void
  ): () => void {
    const channel = supabase
      .channel('matchmaking')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_rooms',
        },
        async (payload) => {
          const room = payload.new as GameRoom;
          if (room.player1_id === playerId || room.player2_id === playerId) {
            onMatch(room);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Get queue position (approximate)
   */
  static async getQueuePosition(playerId: string): Promise<number> {
    const { data } = await supabase
      .from('matchmaking_queue')
      .select('player_id, joined_at')
      .order('joined_at', { ascending: true });

    if (!data) return -1;

    const index = data.findIndex(p => p.player_id === playerId);
    return index >= 0 ? index + 1 : -1;
  }
}
