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
  const numRotations = TETROMINO_SHAPES[piece.type].length;
  const newRotation = clockwise
    ? (piece.rotation + 1) % numRotations
    : (piece.rotation - 1 + numRotations) % numRotations;

  return {
    ...piece,
    rotation: newRotation,
    shape: TETROMINO_SHAPES[piece.type][newRotation],
  };
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
export function calculateStars(linesCleared: number, comboCount: number): number {
  let stars = 0;

  switch (linesCleared) {
    case 1:
      stars = STAR_VALUES.single;
      break;
    case 2:
      stars = STAR_VALUES.double;
      break;
    case 3:
      stars = STAR_VALUES.triple;
      break;
    case 4:
      stars = STAR_VALUES.tetris;
      break;
    default:
      return 0;
  }

  // Add combo bonus
  stars += comboCount * STAR_VALUES.comboBonus;

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
