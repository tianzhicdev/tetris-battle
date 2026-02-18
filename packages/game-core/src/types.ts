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
  nextPieces: TetrominoType[]; // Queue of upcoming pieces (minimum 5)
  score: number;
  stars: number;
  level: number;
  linesCleared: number;
  isGameOver: boolean;
  lastClearTime: number;
  comboCount: number;
  bombType: 'cross' | 'circle' | null; // Track if current piece is a bomb
}

// AI Player Metrics for adaptive difficulty
export interface PlayerMetrics {
  averagePPM: number;         // Pieces per minute
  averageLockTime: number;    // Milliseconds to lock piece
  averageBoardHeight: number; // Average filled rows
  mistakeRate: number;        // 0-1, fraction of suboptimal moves
  pieceCount: number;         // Total pieces locked
  totalLockTime: number;      // Sum of all lock times (for rolling average)
  lastUpdateTime: number;     // Timestamp of last metrics update
}

export function createInitialPlayerMetrics(): PlayerMetrics {
  return {
    averagePPM: 30,           // Default ~1 piece every 2 seconds
    averageLockTime: 2000,    // Default 2 seconds
    averageBoardHeight: 8,    // Default mid-board
    mistakeRate: 0.3,         // Default moderate mistakes
    pieceCount: 0,
    totalLockTime: 0,
    lastUpdateTime: Date.now(),
  };
}

// Abilities
export type AbilityType = string;
export type AbilityCategory =
  // Legacy categories (kept for compatibility with older data/tests)
  | 'buff'
  | 'debuff'
  // V2 categories
  | 'buff_board'
  | 'buff_pieces'
  | 'buff_economy'
  | 'debuff_visual'
  | 'debuff_board'
  | 'debuff_controls'
  | 'debuff_geometry'
  | 'defensive';

export interface Ability {
  id: string;
  type: AbilityType;
  name: string;
  shortName: string; // Short text for UI display (max 8 chars)
  description: string;
  technical_description?: string;
  implementation?: string;
  balance_notes?: string;
  cost: number;
  duration?: number; // in milliseconds; 0 means instant
  category: AbilityCategory;
  unlockLevel?: number;
  unlockTier?: number;
  unlockCost: number; // Coins needed to purchase
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
  triple: 22,
  tetris: 35,
  comboBonus: 3,
  backToBackBonus: 5,
  perfectClearBonus: 50,
  tSpinSingleBonus: 8,
  tSpinDoubleBonus: 20,
  tSpinTripleBonus: 30,
  startingPool: 100,
  maxCapacity: 300,
  passiveRegenPerSecond: 1,
  comboWindow: 3000, // 3 seconds
} as const;
