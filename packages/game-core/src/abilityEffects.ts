import type { Board, Tetromino, CellValue, TetrominoType } from './types';
import type { SeededRandom } from './SeededRandom';

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

export function applyWeirdShapes(piece: Tetromino, rng?: SeededRandom): Tetromino {
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
  const randomShape = shapes[randomInt(shapes.length, rng)];

  return {
    ...piece,
    shape: randomShape,
    rotation: 0,
    position: { x: 3, y: 0 }, // Centered spawn position for bigger piece
  };
}

export function applyRandomSpawner(board: Board, blockCount: number = 1, rng?: SeededRandom): Board {
  // Add random garbage blocks to EMPTY cells only.
  // Technical behavior: one random empty cell per trigger by default.
  // Spawn only at bottom row OR next to existing filled cells.
  const newGrid = board.grid.map(row => [...row]);

  // Find all valid empty cells (bottom row or adjacent to filled cells)
  const validEmptyCells: { x: number; y: number }[] = [];

  for (let y = 5; y < board.height; y++) { // Don't spawn in top 5 rows
    for (let x = 0; x < board.width; x++) {
      if (!newGrid[y][x]) {
        // Check if it's at the bottom row
        const isBottom = y === board.height - 1;

        // Check if it's adjacent to a filled cell
        const hasAdjacentFilled =
          (y > 0 && newGrid[y - 1][x]) ||  // Above
          (y < board.height - 1 && newGrid[y + 1][x]) ||  // Below
          (x > 0 && newGrid[y][x - 1]) ||  // Left
          (x < board.width - 1 && newGrid[y][x + 1]);  // Right

        if (isBottom || hasAdjacentFilled) {
          validEmptyCells.push({ x, y });
        }
      }
    }
  }

  // Randomly select and fill valid empty cells
  for (let i = 0; i < blockCount && validEmptyCells.length > 0; i++) {
    const randomIndex = randomInt(validEmptyCells.length, rng);
    const { x, y } = validEmptyCells[randomIndex];
    newGrid[y][x] = randomCellType(rng);
    validEmptyCells.splice(randomIndex, 1); // Remove from available cells
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

export function applyDeathCross(board: Board, rng?: SeededRandom): Board {
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
        newGrid[y][x] = randomCellType(rng);
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
        newGrid[y][x] = randomCellType(rng);
      }
    }
  }

  return { ...board, grid: newGrid };
}

export function applyGoldDigger(board: Board, blockCount: number = 1, rng?: SeededRandom): Board {
  // Remove random blocks from FILLED cells only.
  // Technical behavior: one random filled cell per trigger by default.
  const newGrid = board.grid.map(row => [...row]);

  // Find all filled cells
  const filledCells: { x: number; y: number }[] = [];
  for (let y = 5; y < board.height; y++) { // Don't affect top 5 rows
    for (let x = 0; x < board.width; x++) {
      if (newGrid[y][x]) {
        filledCells.push({ x, y });
      }
    }
  }

  // Randomly remove blocks
  for (let i = 0; i < blockCount && filledCells.length > 0; i++) {
    const randomIndex = randomInt(filledCells.length, rng);
    const { x, y } = filledCells[randomIndex];
    newGrid[y][x] = null;
    filledCells.splice(randomIndex, 1);
  }

  return { ...board, grid: newGrid };
}

export function applyRowRotate(board: Board, rng?: SeededRandom): Board {
  // Each row rotates 1-8 positions randomly left or right
  const newGrid = board.grid.map(row => [...row]);
  const maxShift = Math.min(8, board.width);

  for (let y = 0; y < board.height; y++) {
    const positions = randomInt(maxShift, rng) + 1; // 1..maxShift positions
    const direction = randomInt(2, rng) === 0 ? 1 : -1; // 1 = right, -1 = left
    const rotatedRow: CellValue[] = Array(board.width).fill(null);

    for (let x = 0; x < board.width; x++) {
      const newX = (x + direction * positions + board.width) % board.width;
      rotatedRow[newX] = newGrid[y][x];
    }

    newGrid[y] = rotatedRow;
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

export function createMiniBlock(boardWidth: number = 10, rng?: SeededRandom): Tetromino {
  // Create a 2-cell domino piece (horizontal or vertical)
  const isHorizontal = randomInt(2, rng) === 1;
  const type: TetrominoType = CELL_TYPES[randomInt(CELL_TYPES.length, rng)] as TetrominoType;

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
