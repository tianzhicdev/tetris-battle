import type { Board, Tetromino, GameState, CellValue, Position } from './types';
import { TETROMINO_SHAPES, getRandomTetromino } from './tetrominos';
import { STAR_VALUES } from './types';

export function createBoard(width: number = 10, height: number = 20): Board {
  return {
    grid: Array(height).fill(null).map(() => Array(width).fill(null)),
    width,
    height,
  };
}

export function createInitialGameState(): GameState {
  return {
    board: createBoard(),
    currentPiece: null,
    nextPieces: [
      getRandomTetromino(),
      getRandomTetromino(),
      getRandomTetromino(),
      getRandomTetromino(),
      getRandomTetromino(),
    ],
    score: 0,
    stars: STAR_VALUES.startingPool,
    level: 1,
    linesCleared: 0,
    isGameOver: false,
    lastClearTime: 0,
    comboCount: 0,
    bombType: null,
  };
}

// Collision detection
export function isValidPosition(board: Board, piece: Tetromino): boolean {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardX = piece.position.x + x;
        const boardY = piece.position.y + y;

        // Check boundaries
        if (boardX < 0 || boardX >= board.width || boardY >= board.height) {
          return false;
        }

        // Check collision with existing blocks (allow negative Y for spawn)
        if (boardY >= 0 && board.grid[boardY][boardX]) {
          return false;
        }
      }
    }
  }
  return true;
}

// Move piece
export function movePiece(piece: Tetromino, dx: number, dy: number): Tetromino {
  return {
    ...piece,
    position: {
      x: piece.position.x + dx,
      y: piece.position.y + dy,
    },
  };
}

// Rotate piece
export function rotatePiece(piece: Tetromino, clockwise: boolean = true): Tetromino {
  // Check if this is a custom shape (mini block or weird shape)
  // Custom shapes won't match any standard tetromino rotation
  const standardShapes = TETROMINO_SHAPES[piece.type];
  const isCustomShape = !standardShapes.some(stdShape =>
    JSON.stringify(stdShape) === JSON.stringify(piece.shape)
  );

  // If custom shape, rotate the matrix itself
  if (isCustomShape) {
    const rotatedShape = clockwise ? rotateMatrixCW(piece.shape) : rotateMatrixCCW(piece.shape);
    return {
      ...piece,
      shape: rotatedShape,
    };
  }

  // Standard tetromino - use lookup table
  const numRotations = standardShapes.length;
  const newRotation = clockwise
    ? (piece.rotation + 1) % numRotations
    : (piece.rotation - 1 + numRotations) % numRotations;

  return {
    ...piece,
    rotation: newRotation,
    shape: standardShapes[newRotation],
  };
}

// Rotate a matrix 90 degrees clockwise
function rotateMatrixCW(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: number[][] = [];

  for (let col = 0; col < cols; col++) {
    const newRow: number[] = [];
    for (let row = rows - 1; row >= 0; row--) {
      newRow.push(matrix[row][col]);
    }
    rotated.push(newRow);
  }

  return rotated;
}

// Rotate a matrix 90 degrees counter-clockwise
function rotateMatrixCCW(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: number[][] = [];

  for (let col = cols - 1; col >= 0; col--) {
    const newRow: number[] = [];
    for (let row = 0; row < rows; row++) {
      newRow.push(matrix[row][col]);
    }
    rotated.push(newRow);
  }

  return rotated;
}

// Lock piece to board
export function lockPiece(board: Board, piece: Tetromino): Board {
  const newGrid = board.grid.map(row => [...row]);

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardY = piece.position.y + y;
        const boardX = piece.position.x + x;
        if (boardY >= 0 && boardY < board.height) {
          newGrid[boardY][boardX] = piece.type;
        }
      }
    }
  }

  return { ...board, grid: newGrid };
}

// Clear completed lines and return number of lines cleared
export function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newGrid: CellValue[][] = [];
  let linesCleared = 0;

  for (let y = board.height - 1; y >= 0; y--) {
    if (board.grid[y].every(cell => cell !== null)) {
      linesCleared++;
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
    linesCleared,
  };
}

// Calculate stars earned from line clears
export interface StarCalculationOptions {
  comboCount?: number;
  includeComboBonus?: boolean;
  backToBack?: boolean;
  tSpin?: boolean | 'single' | 'double' | 'triple';
  perfectClear?: boolean;
}

export function calculateLineClearBaseStars(linesCleared: number): number {
  switch (linesCleared) {
    case 1:
      return STAR_VALUES.single;
    case 2:
      return STAR_VALUES.double;
    case 3:
      return STAR_VALUES.triple;
    case 4:
      return STAR_VALUES.tetris;
    default:
      return 0;
  }
}

function resolveTSpinType(
  tSpin: StarCalculationOptions['tSpin'],
  linesCleared: number
): 'single' | 'double' | 'triple' | null {
  if (!tSpin) return null;
  if (tSpin === 'single' || tSpin === 'double' || tSpin === 'triple') return tSpin;
  if (linesCleared === 1) return 'single';
  if (linesCleared === 2) return 'double';
  if (linesCleared === 3) return 'triple';
  return null;
}

export function calculateStars(
  linesCleared: number,
  comboCountOrOptions: number | StarCalculationOptions = 0,
  maybeOptions: StarCalculationOptions = {}
): number {
  const options: StarCalculationOptions =
    typeof comboCountOrOptions === 'number'
      ? { ...maybeOptions, comboCount: comboCountOrOptions }
      : comboCountOrOptions;

  const comboCount = options.comboCount ?? 0;
  const includeComboBonus = options.includeComboBonus ?? true;

  let stars = calculateLineClearBaseStars(linesCleared);
  if (stars <= 0) return 0;

  if (includeComboBonus) {
    stars += comboCount * STAR_VALUES.comboBonus;
  }

  const tSpinType = resolveTSpinType(options.tSpin, linesCleared);
  if (tSpinType === 'single') stars += STAR_VALUES.tSpinSingleBonus;
  if (tSpinType === 'double') stars += STAR_VALUES.tSpinDoubleBonus;
  if (tSpinType === 'triple') stars += STAR_VALUES.tSpinTripleBonus;

  if (options.backToBack) {
    stars += STAR_VALUES.backToBackBonus;
  }

  if (options.perfectClear) {
    stars += STAR_VALUES.perfectClearBonus;
  }

  return stars;
}

// Check if game is over (piece spawns in occupied space)
export function isGameOver(board: Board, piece: Tetromino): boolean {
  return !isValidPosition(board, piece);
}

// Get hard drop position
export function getHardDropPosition(board: Board, piece: Tetromino): Position {
  let dropPiece = { ...piece };
  while (isValidPosition(board, movePiece(dropPiece, 0, 1))) {
    dropPiece = movePiece(dropPiece, 0, 1);
  }
  return dropPiece.position;
}
