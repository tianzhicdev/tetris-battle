import type { Board, Tetromino, CellValue, TetrominoType } from './types';
import type { SeededRandom } from './SeededRandom';

export interface AbilityEffect {
  type: 'buff' | 'debuff';
  execute: (data: any) => any;
}

const CELL_TYPES: CellValue[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];

function randomInt(maxExclusive: number, rng?: SeededRandom): number {
  if (maxExclusive <= 0) return 0;
  if (rng) return rng.nextInt(maxExclusive);
  return Math.floor(Math.random() * maxExclusive);
}

function randomCellType(rng?: SeededRandom): CellValue {
  return CELL_TYPES[randomInt(CELL_TYPES.length, rng)];
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

  // Keep unaffected cells in place (no gravity) per technical description.
  return { ...board, grid: newGrid };
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

  // Keep unaffected cells in place (no gravity) per technical description.
  return { ...board, grid: newGrid };
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
  // Predefined hollowed shapes: square, triangle, circle
  const shapes = [
    // Hollowed square
    [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    // Hollowed triangle (pointing up)
    [
      [0, 1, 1, 0],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    // Hollowed circle (diamond shape)
    [
      [0, 1, 1, 0],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [0, 1, 1, 0],
    ],
  ];

  // Randomly select one of the predefined shapes
  const randomShape = shapes[Math.floor(Math.random() * shapes.length)];

  return {
    ...piece,
    shape: randomShape,
    rotation: 0,
    position: { x: 3, y: 0 }, // Centered spawn position for bigger piece
  };
}

export function applyRandomSpawner(board: Board, blockCount: number = 5, rng?: SeededRandom): Board {
  // One-shot: fill up to blockCount empty cells that are at least 2 Manhattan-distance
  // away from every existing filled cell. Skips the top 5 rows.
  const newGrid = board.grid.map(row => [...row]);

  // Collect valid candidate cells
  const candidates: { x: number; y: number }[] = [];

  for (let y = 5; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (newGrid[y][x]) continue; // already filled

      // Check Manhattan distance ≥ 2 from every filled cell
      let tooClose = false;
      outer: for (let fy = 0; fy < board.height; fy++) {
        for (let fx = 0; fx < board.width; fx++) {
          if (newGrid[fy][fx] && Math.abs(fy - y) + Math.abs(fx - x) < 2) {
            tooClose = true;
            break outer;
          }
        }
      }
      if (!tooClose) candidates.push({ x, y });
    }
  }

  // Randomly pick up to blockCount candidates and fill them
  for (let i = 0; i < blockCount && candidates.length > 0; i++) {
    const idx = randomInt(candidates.length, rng);
    const { x, y } = candidates[idx];
    newGrid[y][x] = randomCellType(rng);
    candidates.splice(idx, 1);
  }

  return { ...board, grid: newGrid };
}

export function applyEarthquake(board: Board, rng?: SeededRandom): Board {
  // Shift each row left/right by 1-2 cells without wrap-around, creating gaps.
  const newGrid = board.grid.map(row => [...row]);
  for (let y = 0; y < board.height; y++) {
    const row = newGrid[y];
    const shift = randomInt(2, rng) + 1; // 1..2
    const direction = randomInt(2, rng) === 0 ? -1 : 1;
    const shifted: CellValue[] = Array(board.width).fill(null);

    for (let x = 0; x < board.width; x++) {
      const targetX = x + direction * shift;
      if (targetX >= 0 && targetX < board.width) {
        shifted[targetX] = row[x];
      }
    }

    newGrid[y] = shifted;
  }

  return { ...board, grid: newGrid };
}

export function applyColumnBomb(board: Board): Board {
  // Drop 8 garbage blocks into a random column
  const newGrid = board.grid.map(row => [...row]);
  const targetColumn = Math.floor(Math.random() * board.width);

  // Find the first 8 empty cells from bottom in the target column
  let blocksAdded = 0;
  for (let y = board.height - 1; y >= 0 && blocksAdded < 8; y--) {
    if (!newGrid[y][targetColumn]) {
      newGrid[y][targetColumn] = randomCellType();
      blocksAdded++;
    }
  }

  return { ...board, grid: newGrid };
}

export function applyDeathCross(board: Board): Board {
  // Diagonal lines from bottom corners toggle blocks: filled->empty, empty->filled
  const newGrid = board.grid.map(row => [...row]);

  // Diagonal from bottom-left to top-right
  for (let i = 0; i < Math.min(board.width, board.height); i++) {
    const x = i;
    const y = board.height - 1 - i;
    if (y >= 0) {
      if (newGrid[y][x]) {
        // Filled -> empty
        newGrid[y][x] = null;
      } else {
        // Empty -> filled
        newGrid[y][x] = randomCellType();
      }
    }
  }

  // Diagonal from bottom-right to top-left
  for (let i = 0; i < Math.min(board.width, board.height); i++) {
    const x = board.width - 1 - i;
    const y = board.height - 1 - i;
    if (y >= 0 && x >= 0) {
      if (newGrid[y][x]) {
        // Filled -> empty
        newGrid[y][x] = null;
      } else {
        // Empty -> filled
        newGrid[y][x] = randomCellType();
      }
    }
  }

  return { ...board, grid: newGrid };
}

export function applyGoldDigger(board: Board, blockCount: number = 5, rng?: SeededRandom): Board {
  // One-shot: randomly clear up to blockCount filled cells. Skips the top 5 rows.
  const newGrid = board.grid.map(row => [...row]);

  // Collect all filled cells below the safe zone
  const filledCells: { x: number; y: number }[] = [];
  for (let y = 5; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (newGrid[y][x]) filledCells.push({ x, y });
    }
  }

  // Randomly pick up to blockCount and clear them
  for (let i = 0; i < blockCount && filledCells.length > 0; i++) {
    const idx = randomInt(filledCells.length, rng);
    const { x, y } = filledCells[idx];
    newGrid[y][x] = null;
    filledCells.splice(idx, 1);
  }

  return { ...board, grid: newGrid };
}

export function applyFillHoles(board: Board): Board {
  // Fill all empty spaces that are surrounded by blocks
  const newGrid = board.grid.map(row => [...row]);

  // Use flood fill to find enclosed spaces
  const visited = Array(board.height).fill(null).map(() => Array(board.width).fill(false));

  // Check each empty cell to see if it's surrounded
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (!newGrid[y][x] && !visited[y][x]) {
        // Found an empty cell, check if it's enclosed
        const enclosed = isEnclosed(newGrid, x, y, visited);
        if (enclosed.isEnclosed) {
          // Fill all cells in this enclosed region
          enclosed.cells.forEach(({ x: cx, y: cy }) => {
            newGrid[cy][cx] = randomCellType();
          });
        }
      }
    }
  }

  return { ...board, grid: newGrid };
}

function isEnclosed(grid: CellValue[][], startX: number, startY: number, visited: boolean[][]): { isEnclosed: boolean; cells: { x: number; y: number }[] } {
  const height = grid.length;
  const width = grid[0].length;
  const cells: { x: number; y: number }[] = [];
  const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
  let touchesBorder = false;

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;

    // Skip if already visited or out of bounds
    if (x < 0 || x >= width || y < 0 || y >= height) {
      touchesBorder = true;
      continue;
    }

    if (visited[y][x]) continue;

    // If this cell is filled, it's a boundary
    if (grid[y][x]) continue;

    visited[y][x] = true;
    cells.push({ x, y });

    // Check if touching border
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      touchesBorder = true;
    }

    // Add neighbors to queue
    queue.push({ x: x + 1, y });
    queue.push({ x: x - 1, y });
    queue.push({ x, y: y + 1 });
    queue.push({ x, y: y - 1 });
  }

  return { isEnclosed: !touchesBorder && cells.length > 0, cells };
}

// ADDITIONAL ABILITY EFFECTS (for AI and spec 003)

export function applyAddJunkRows(board: Board, numRows: number = 2, rng?: SeededRandom): Board {
  // Add garbage rows to the bottom of the board, pushing existing content up
  const newGrid = board.grid.map(row => [...row]);

  // Remove top rows to make room (content pushed up and lost if at top)
  for (let i = 0; i < numRows; i++) {
    newGrid.shift();
  }

  // Add garbage rows at bottom with 1 random gap per row
  for (let i = 0; i < numRows; i++) {
    const gapColumn = randomInt(board.width, rng);
    const junkRow: CellValue[] = [];
    for (let x = 0; x < board.width; x++) {
      junkRow.push(x === gapColumn ? null : randomCellType(rng));
    }
    newGrid.push(junkRow);
  }

  return { ...board, grid: newGrid };
}

export function applyScrambleBoard(board: Board): Board {
  // Collect all filled cells, then redistribute them randomly
  const filledCells: CellValue[] = [];

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.grid[y][x] !== null) {
        filledCells.push(board.grid[y][x]);
      }
    }
  }

  // Create empty grid
  const newGrid: CellValue[][] = Array(board.height)
    .fill(null)
    .map(() => Array(board.width).fill(null));

  // Shuffle the filled cells
  for (let i = filledCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filledCells[i], filledCells[j]] = [filledCells[j], filledCells[i]];
  }

  // Place cells in bottom rows (gravity-settled)
  let cellIndex = 0;
  for (let y = board.height - 1; y >= 0 && cellIndex < filledCells.length; y--) {
    for (let x = 0; x < board.width && cellIndex < filledCells.length; x++) {
      newGrid[y][x] = filledCells[cellIndex++];
    }
  }

  return { ...board, grid: newGrid };
}

export function applyGravityFlip(board: Board): Board {
  // Reverse the board vertically (top becomes bottom)
  const newGrid = [...board.grid].reverse().map(row => [...row]);
  return { ...board, grid: newGrid };
}

// ABILITY STATE MANAGEMENT

export interface ActiveAbilityEffect {
  abilityType: string;
  startTime: number;
  endTime: number;
  data?: any;
  // For periodic abilities (random_spawner, gold_digger)
  intervalMs?: number;  // How often to trigger (e.g., 2000 for every 2 seconds)
  lastTriggerTime?: number;  // When it last triggered
}

export function createMiniBlock(boardWidth: number = 10): Tetromino {
  // Create a 2-cell domino piece (horizontal or vertical)
  const isHorizontal = Math.random() > 0.5;
  const type: TetrominoType = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'][Math.floor(Math.random() * 7)] as TetrominoType;

  return {
    type,
    shape: isHorizontal ? [[1, 1]] : [[1], [1]],
    position: { x: Math.floor(boardWidth / 2) - 1, y: 0 },
    rotation: 0,
  };
}

export function createWeirdShape(boardWidth: number = 10, rng?: SeededRandom): Tetromino {
  // Create 4x4 hollowed shape (square/triangle/circle).
  const shapes = [
    [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    [
      [0, 1, 1, 0],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    [
      [0, 1, 1, 0],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [0, 1, 1, 0],
    ],
  ];
  const shape = shapes[randomInt(shapes.length, rng)];
  return {
    type: 'O' as TetrominoType,
    position: { x: Math.floor(boardWidth / 2) - 2, y: 0 },
    rotation: 0,
    shape,
  };
}

export class AbilityEffectManager {
  private activeEffects: Map<string, ActiveAbilityEffect> = new Map();
  public miniBlocksRemaining: number = 0;

  activateEffect(abilityType: string, duration: number, data?: any, intervalMs?: number): void {
    const now = Date.now();
    this.activeEffects.set(abilityType, {
      abilityType,
      startTime: now,
      endTime: now + duration,
      data,
      intervalMs,
      lastTriggerTime: intervalMs ? now : undefined,
    });

    // Special handling for mini_blocks (duration is number of pieces, not time)
    if (abilityType === 'mini_blocks') {
      this.miniBlocksRemaining = duration; // duration is 5 pieces
    }
  }

  useMiniBlock(): void {
    if (this.miniBlocksRemaining > 0) {
      this.miniBlocksRemaining--;
      if (this.miniBlocksRemaining === 0) {
        this.clearEffect('mini_blocks');
      }
    }
  }

  shouldUseMiniBlock(): boolean {
    return this.miniBlocksRemaining > 0;
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

  shouldTriggerPeriodic(abilityType: string): boolean {
    const effect = this.activeEffects.get(abilityType);
    if (!effect || !effect.intervalMs) return false;

    const now = Date.now();

    // Check if effect is still active
    if (now > effect.endTime) {
      this.activeEffects.delete(abilityType);
      return false;
    }

    // Check if enough time has passed since last trigger
    const timeSinceLastTrigger = now - (effect.lastTriggerTime || effect.startTime);
    if (timeSinceLastTrigger >= effect.intervalMs) {
      effect.lastTriggerTime = now;
      return true;
    }

    return false;
  }
}
