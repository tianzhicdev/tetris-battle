/**
 * Input Types for Server-Authoritative Game Mode
 *
 * These types define the messages clients send to the server.
 * The server validates and executes these inputs, then broadcasts
 * the resulting state changes.
 */

export type PlayerInputType =
  | 'move_left'
  | 'move_right'
  | 'rotate_cw'
  | 'rotate_ccw'
  | 'soft_drop'
  | 'hard_drop';

export interface PlayerInput {
  type: 'player_input';
  playerId: string;
  input: PlayerInputType;
  timestamp: number; // Client timestamp for latency measurement
}

export interface AbilityInput {
  type: 'ability_activation';
  playerId: string;
  abilityType: string;
  targetPlayerId: string;
  requestId?: string;
  timestamp: number;
}

export type GameInput = PlayerInput | AbilityInput;
