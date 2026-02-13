import type { Board, Tetromino, CellValue } from './types';
import { TETROMINO_SHAPES } from './tetrominos';

export interface AbilityEffect {
  type: 'buff' | 'debuff';
  execute: (data: any) => any;
}

// BUFF EFFECTS (Self-Enhancement)

export function applySpeedBoost(currentSpeed: number): number {
  // Increase fall speed by 2x
  return currentSpeed * 0.5; // Halve the tick rate = faster
}

export function applyBomb(board: Board, centerX: number, centerY: number): Board {
  // Destroy 4x4 area centered at position (backward compatibility)
  return applyCrossBomb(board, centerX, centerY);
}

export function applyCrossBomb(board: Board, centerX: number, centerY: number): Board {
  // Clear 3 rows and 3 columns in a cross pattern
  const newGrid = board.grid.map(row => [...row]);

  // Clear 3 rows centered at centerY
  for (let dy = -1; dy <= 1; dy++) {
    const y = centerY + dy;
    if (y >= 0 && y < board.height) {
      for (let x = 0; x < board.width; x++) {
        newGrid[y][x] = null;
      }
    }
  }

  // Clear 3 columns centered at centerX
  for (let dx = -1; dx <= 1; dx++) {
    const x = centerX + dx;
    if (x >= 0 && x < board.width) {
      for (let y = 0; y < board.height; y++) {
        newGrid[y][x] = null;
      }
    }
  }

  // Apply gravity - move floating blocks down
  return applyGravity({ ...board, grid: newGrid });
}

export function applyCircleBomb(board: Board, centerX: number, centerY: number, radius: number = 3): Board {
  // Clear all blocks within circular radius
  const newGrid = board.grid.map(row => [...row]);

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      if (distance <= radius) {
        newGrid[y][x] = null;
      }
    }
  }

  // Apply gravity - move floating blocks down
  return applyGravity({ ...board, grid: newGrid });
}

export function applyClearRows(board: Board, numRows: number = 5): { board: Board; rowsCleared: number } {
  // Clear bottom N rows
  const newGrid: CellValue[][] = [];
  let cleared = 0;

  for (let y = board.height - 1; y >= 0; y--) {
    if (cleared < numRows) {
      // Clear this row
      cleared++;
    } else {
      newGrid.unshift(board.grid[y]);
    }
  }

  // Add empty rows at top
  while (newGrid.length < board.height) {
    newGrid.unshift(Array(board.width).fill(null));
  }

  return {
    board: { ...board, grid: newGrid },
    rowsCleared: cleared,
  };
}

// DEBUFF EFFECTS (Opponent Disruption)

export function applyWeirdShapes(piece: Tetromino): Tetromino {
  // Randomly rotate or flip the piece shape
  const rotation = Math.floor(Math.random() * 4);
  const flip = Math.random() > 0.5;

  let shape = TETROMINO_SHAPES[piece.type][rotation];

  if (flip) {
    // Flip horizontally
    shape = shape.map(row => [...row].reverse());
  }

  return {
    ...piece,
    shape,
    rotation,
  };
}

export function applyRandomSpawner(board: Board): Board {
  // Add 1-3 random garbage blocks to EMPTY cells only
  const newGrid = board.grid.map(row => [...row]);
  const numBlocks = Math.floor(Math.random() * 3) + 1;
  const types: CellValue[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];

  // Find all empty cells
  const emptyCells: { x: number; y: number }[] = [];
  for (let y = 5; y < board.height; y++) { // Don't spawn in top 5 rows
    for (let x = 0; x < board.width; x++) {
      if (!newGrid[y][x]) {
        emptyCells.push({ x, y });
      }
    }
  }

  // Randomly select and fill empty cells
  for (let i = 0; i < numBlocks && emptyCells.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    const { x, y } = emptyCells[randomIndex];
    newGrid[y][x] = types[Math.floor(Math.random() * types.length)];
    emptyCells.splice(randomIndex, 1); // Remove from available cells
  }

  return { ...board, grid: newGrid };
}

export function applyEarthquake(board: Board): Board {
  // Create random holes by removing 15-25 blocks from the board
  const newGrid = board.grid.map(row => [...row]);

  // Find all filled cells
  const filledCells: { x: number; y: number }[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (newGrid[y][x]) {
        filledCells.push({ x, y });
      }
    }
  }

  // Remove 15-25 random blocks to create holes
  const numHoles = Math.floor(Math.random() * 11) + 15; // 15-25 holes
  for (let i = 0; i < numHoles && filledCells.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * filledCells.length);
    const { x, y } = filledCells[randomIndex];
    newGrid[y][x] = null;
    filledCells.splice(randomIndex, 1);
  }

  // Apply gravity so blocks fall into the holes
  return applyGravity({ ...board, grid: newGrid });
}

export function applyColumnBomb(board: Board): Board {
  // Drop 8 garbage blocks into a random column
  const newGrid = board.grid.map(row => [...row]);
  const targetColumn = Math.floor(Math.random() * board.width);
  const types: CellValue[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];

  // Find the first 8 empty cells from bottom in the target column
  let blocksAdded = 0;
  for (let y = board.height - 1; y >= 0 && blocksAdded < 8; y--) {
    if (!newGrid[y][targetColumn]) {
      newGrid[y][targetColumn] = types[Math.floor(Math.random() * types.length)];
      blocksAdded++;
    }
  }

  return { ...board, grid: newGrid };
}

// UTILITY FUNCTIONS

function applyGravity(board: Board): Board {
  // Make floating blocks fall down
  const newGrid: CellValue[][] = Array(board.height)
    .fill(null)
    .map(() => Array(board.width).fill(null));

  // Process from bottom to top
  for (let x = 0; x < board.width; x++) {
    let writeY = board.height - 1;

    // Collect all blocks in this column from bottom to top
    for (let y = board.height - 1; y >= 0; y--) {
      if (board.grid[y][x]) {
        newGrid[writeY][x] = board.grid[y][x];
        writeY--;
      }
    }
  }

  return { ...board, grid: newGrid };
}

// ABILITY STATE MANAGEMENT

export interface ActiveAbilityEffect {
  abilityType: string;
  startTime: number;
  endTime: number;
  data?: any;
}

export class AbilityEffectManager {
  private activeEffects: Map<string, ActiveAbilityEffect> = new Map();

  activateEffect(abilityType: string, duration: number, data?: any): void {
    const now = Date.now();
    this.activeEffects.set(abilityType, {
      abilityType,
      startTime: now,
      endTime: now + duration,
      data,
    });
  }

  isEffectActive(abilityType: string): boolean {
    const effect = this.activeEffects.get(abilityType);
    if (!effect) return false;

    const now = Date.now();
    if (now > effect.endTime) {
      this.activeEffects.delete(abilityType);
      return false;
    }

    return true;
  }

  getActiveEffects(): ActiveAbilityEffect[] {
    const now = Date.now();
    const active: ActiveAbilityEffect[] = [];

    for (const [type, effect] of this.activeEffects) {
      if (now <= effect.endTime) {
        active.push(effect);
      } else {
        this.activeEffects.delete(type);
      }
    }

    return active;
  }

  getRemainingTime(abilityType: string): number {
    const effect = this.activeEffects.get(abilityType);
    if (!effect) return 0;

    const now = Date.now();
    return Math.max(0, effect.endTime - now);
  }

  clearEffect(abilityType: string): void {
    this.activeEffects.delete(abilityType);
  }

  clearAllEffects(): void {
    this.activeEffects.clear();
  }
}
