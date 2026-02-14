import type { Board, Tetromino, Position } from '../types';
import {
  isValidPosition,
  rotatePiece,
  lockPiece,
  clearLines,
  getHardDropPosition,
} from '../engine';

export interface AIMove {
  type: 'left' | 'right' | 'rotate_cw' | 'rotate_ccw' | 'hard_drop';
}

export interface AIDecision {
  moves: AIMove[];
  targetPosition: Position;
  targetRotation: number;
  score: number;
}

export interface BoardEvaluation {
  aggregateHeight: number;
  completeLines: number;
  holes: number;
  bumpiness: number;
}

export interface AIWeights {
  aggregateHeight: number;
  completeLines: number;
  holes: number;
  bumpiness: number;
}

/**
 * Calculate column heights for a board
 */
function getColumnHeights(board: Board): number[] {
  const heights: number[] = new Array(board.width).fill(0);

  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      if (board.grid[y][x] !== null) {
        heights[x] = board.height - y;
        break;
      }
    }
  }

  return heights;
}

/**
 * Evaluate a board state and return metrics
 */
export function evaluateBoard(board: Board): BoardEvaluation {
  const heights = getColumnHeights(board);

  // Aggregate height: sum of all column heights
  const aggregateHeight = heights.reduce((sum, h) => sum + h, 0);

  // Complete lines: count full rows
  let completeLines = 0;
  for (let y = 0; y < board.height; y++) {
    if (board.grid[y].every(cell => cell !== null)) {
      completeLines++;
    }
  }

  // Holes: count empty cells with a filled cell above
  let holes = 0;
  for (let x = 0; x < board.width; x++) {
    let blockFound = false;
    for (let y = 0; y < board.height; y++) {
      if (board.grid[y][x] !== null) {
        blockFound = true;
      } else if (blockFound) {
        holes++;
      }
    }
  }

  // Bumpiness: sum of absolute height differences between adjacent columns
  let bumpiness = 0;
  for (let x = 0; x < board.width - 1; x++) {
    bumpiness += Math.abs(heights[x] - heights[x + 1]);
  }

  return {
    aggregateHeight,
    completeLines,
    holes,
    bumpiness,
  };
}

/**
 * Score a board evaluation using weights
 */
export function scoreBoard(evaluation: BoardEvaluation, weights: AIWeights): number {
  return (
    weights.aggregateHeight * evaluation.aggregateHeight +
    weights.completeLines * evaluation.completeLines +
    weights.holes * evaluation.holes +
    weights.bumpiness * evaluation.bumpiness
  );
}

/**
 * Find the best placement for a piece on a board
 */
export function findBestPlacement(
  board: Board,
  piece: Tetromino,
  weights: AIWeights
): AIDecision {
  let bestScore = -Infinity;
  let bestPlacement: AIDecision | null = null;

  // Try all rotations
  for (let rotation = 0; rotation < 4; rotation++) {
    let testPiece = { ...piece };

    // Rotate to target rotation
    for (let r = 0; r < rotation; r++) {
      testPiece = rotatePiece(testPiece, true);
    }

    // Try all horizontal positions
    for (let x = -2; x < board.width + 2; x++) {
      const movedPiece = { ...testPiece, position: { x, y: testPiece.position.y } };

      // Skip invalid positions
      if (!isValidPosition(board, movedPiece)) {
        continue;
      }

      // Drop to bottom
      const finalPosition = getHardDropPosition(board, movedPiece);
      const droppedPiece = { ...movedPiece, position: finalPosition };

      // Simulate locking the piece
      const newBoard = lockPiece(board, droppedPiece);
      const { board: clearedBoard } = clearLines(newBoard);

      // Evaluate the resulting board
      const evaluation = evaluateBoard(clearedBoard);
      const score = scoreBoard(evaluation, weights);

      if (score > bestScore) {
        bestScore = score;
        bestPlacement = {
          moves: generateMoves(piece, finalPosition, rotation),
          targetPosition: finalPosition,
          targetRotation: rotation,
          score,
        };
      }
    }
  }

  // If no valid placement found, return a simple drop
  if (!bestPlacement) {
    const finalPosition = getHardDropPosition(board, piece);
    return {
      moves: [{ type: 'hard_drop' }],
      targetPosition: finalPosition,
      targetRotation: 0,
      score: -Infinity,
    };
  }

  return bestPlacement;
}

/**
 * Generate a sequence of moves to reach a target position and rotation
 */
export function generateMoves(
  currentPiece: Tetromino,
  targetPosition: Position,
  targetRotation: number
): AIMove[] {
  const moves: AIMove[] = [];

  // Add rotations
  const rotationDiff = (targetRotation - currentPiece.rotation + 4) % 4;
  for (let i = 0; i < rotationDiff; i++) {
    moves.push({ type: 'rotate_cw' });
  }

  // Add horizontal moves
  const horizontalDiff = targetPosition.x - currentPiece.position.x;
  if (horizontalDiff > 0) {
    for (let i = 0; i < horizontalDiff; i++) {
      moves.push({ type: 'right' });
    }
  } else if (horizontalDiff < 0) {
    for (let i = 0; i < Math.abs(horizontalDiff); i++) {
      moves.push({ type: 'left' });
    }
  }

  // No hard drop - gravity will handle piece falling naturally

  return moves;
}
