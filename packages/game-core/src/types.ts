// Core game types - platform-agnostic

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';

export interface Position {
  x: number;
  y: number;
}

export interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  position: Position;
  rotation: number; // 0, 1, 2, 3
}

export type CellValue = TetrominoType | null;

export interface Board {
  grid: CellValue[][];
  width: number;
  height: number;
}

export interface GameState {
  board: Board;
  currentPiece: Tetromino | null;
  nextPiece: TetrominoType;
  score: number;
  stars: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  lastClearTime: number;
  comboCount: number;
}

// Abilities
export type AbilityType =
  // Buffs (8)
  | 'cross_firebomb'
  | 'circle_bomb'
  | 'clear_rows'
  | 'cascade_multiplier'
  | 'piece_preview_plus'
  | 'mini_blocks'
  | 'row_eraser'
  | 'time_freeze'
  // Debuffs (12)
  | 'speed_up_opponent'
  | 'weird_shapes'
  | 'random_spawner'
  | 'rotation_lock'
  | 'blind_spot'
  | 'reverse_controls'
  | 'earthquake'
  | 'column_bomb'
  | 'screen_shake'
  | 'color_scramble'
  | 'shrink_ceiling'
  | 'mirror_blocks'
  // Defense (1)
  | 'deflect_shield'
  // Ultra (4)
  | 'board_swap'
  | 'piece_thief'
  | 'gravity_invert'
  | 'mirror_match';

export interface Ability {
  id: string;
  type: AbilityType;
  name: string;
  description: string;
  cost: number;
  duration?: number; // in milliseconds, undefined for instant
  cooldown: number;
  powerRating: number;
  category: 'buff' | 'debuff' | 'defense' | 'ultra';
}

export interface ActiveAbility {
  ability: Ability;
  startTime: number;
  endTime: number;
}

export interface PlayerState {
  id: string;
  gameState: GameState;
  activeAbilities: ActiveAbility[];
  availableAbilities: Ability[];
  lastAbilityUse: Map<string, number>; // ability id -> timestamp
}

// Multiplayer
export interface GameRoom {
  id: string;
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  createdAt: number;
}

export interface GameAction {
  type: 'move' | 'rotate' | 'drop' | 'ability';
  playerId: string;
  timestamp: number;
  data?: any;
}

// Star economy (from design doc)
export const STAR_VALUES = {
  single: 5,
  double: 12,
  triple: 25,
  tetris: 50,
  comboBonus: 1,
  startingPool: 20,
  maxCapacity: 500,
  comboWindow: 3000, // 3 seconds
} as const;
