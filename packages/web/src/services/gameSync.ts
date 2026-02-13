import { supabase } from '../lib/supabase';
import type { GameRoom, GameState, GameEvent } from '../lib/supabase';
import type { Board } from '@tetris-battle/game-core';

export class GameSyncService {
  private roomId: string;
  private playerId: string;
  private channel: any;

  constructor(roomId: string, playerId: string) {
    this.roomId = roomId;
    this.playerId = playerId;
  }

  /**
   * Initialize game state for this player
   */
  async initializeGameState(board: Board, stars: number): Promise<void> {
    const { error } = await supabase!.from('game_states').insert({
      room_id: this.roomId,
      player_id: this.playerId,
      board: board.grid,
      score: 0,
      stars: stars,
      lines_cleared: 0,
      combo_count: 0,
      is_game_over: false,
    });

    if (error) throw error;
  }

  /**
   * Update game state
   */
  async updateGameState(
    board: Board,
    score: number,
    stars: number,
    linesCleared: number,
    comboCount: number,
    isGameOver: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('game_states')
      .update({
        board: board.grid,
        score,
        stars,
        lines_cleared: linesCleared,
        combo_count: comboCount,
        is_game_over: isGameOver,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', this.roomId)
      .eq('player_id', this.playerId);

    if (error) throw error;
  }

  /**
   * Send a game event
   */
  async sendEvent(
    eventType: GameEvent['event_type'],
    eventData?: any
  ): Promise<void> {
    const { error } = await supabase!.from('game_events').insert({
      room_id: this.roomId,
      player_id: this.playerId,
      event_type: eventType,
      event_data: eventData || {},
    });

    if (error) throw error;
  }

  /**
   * Activate an ability on opponent
   */
  async activateAbility(abilityType: string, targetPlayerId: string): Promise<void> {
    const { error } = await supabase!.from('ability_activations').insert({
      room_id: this.roomId,
      player_id: this.playerId,
      target_player_id: targetPlayerId,
      ability_type: abilityType,
    });

    if (error) throw error;
  }

  /**
   * Subscribe to opponent's game state
   */
  subscribeToOpponent(
    opponentId: string,
    onStateUpdate: (state: GameState) => void
  ): void {
    this.channel = supabase
      .channel(`game_${this.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_states',
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload) => {
          const state = payload.new as GameState;
          if (state.player_id === opponentId) {
            onStateUpdate(state);
          }
        }
      )
      .subscribe();
  }

  /**
   * Subscribe to abilities used on you
   */
  subscribeToAbilities(
    onAbility: (ability: { type: string; fromPlayerId: string }) => void
  ): void {
    const abilityChannel = supabase
      .channel(`abilities_${this.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ability_activations',
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload) => {
          const activation = payload.new as any;
          if (activation.target_player_id === this.playerId) {
            onAbility({
              type: activation.ability_type,
              fromPlayerId: activation.player_id,
            });
          }
        }
      )
      .subscribe();

    // Store reference to unsubscribe later
    if (!this.channel) {
      this.channel = abilityChannel;
    }
  }

  /**
   * Update room status (e.g., when game finishes)
   */
  async updateRoomStatus(
    status: GameRoom['status'],
    winnerId?: string
  ): Promise<void> {
    const updates: any = { status };
    if (status === 'finished') {
      updates.finished_at = new Date().toISOString();
      if (winnerId) {
        updates.winner_id = winnerId;
      }
    }

    await supabase
      .from('game_rooms')
      .update(updates)
      .eq('id', this.roomId);
  }

  /**
   * Get opponent's game state
   */
  async getOpponentState(opponentId: string): Promise<GameState | null> {
    const { data } = await supabase
      .from('game_states')
      .select('*')
      .eq('room_id', this.roomId)
      .eq('player_id', opponentId)
      .single();

    return data;
  }

  /**
   * Cleanup - unsubscribe from channels
   */
  cleanup(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }
  }
}
