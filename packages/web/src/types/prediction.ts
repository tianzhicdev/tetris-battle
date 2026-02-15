import type { GameState, PlayerInputType } from '@tetris-battle/game-core';

export interface PendingInput {
  seq: number;              // Unique sequence number
  action: PlayerInputType;  // The input action
  predictedState: GameState; // What we predicted the result would be
  timestamp: number;        // When it was sent (Date.now())
}

export interface InputConfirmation {
  type: 'input_confirmed';
  confirmedSeq: number;
  serverState: any; // Public state from server
}

export interface InputRejection {
  type: 'input_rejected';
  rejectedSeq: number;
  reason: 'collision_detected' | 'rotation_blocked' | 'no_active_piece' | 'invalid_action';
  serverState: any; // Current authoritative state
}

export const MAX_PENDING_INPUTS = 50;
