import type { Board, Tetromino, PlayerMetrics } from '../types';
import type { AIDecision, AIWeights } from './aiPlayer';
import {
  findBestPlacement,
  generateMoves,
  evaluateBoard,
} from './aiPlayer';
import { isValidPosition, getHardDropPosition, rotatePiece } from '../engine';

/**
 * Adaptive AI that mirrors player skill level
 */
export class AdaptiveAI {
  playerMetrics: PlayerMetrics;
  baseMistakeRate: number = 0.15; // 15% base mistake rate for balanced gameplay

  constructor(playerMetrics: PlayerMetrics) {
    this.playerMetrics = playerMetrics;
  }

  /**
   * Update player metrics for adaptation
   */
  updatePlayerMetrics(metrics: PlayerMetrics): void {
    this.playerMetrics = metrics;
  }

  /**
   * Calculate move delay to mirror player speed (±20% variance)
   */
  decideMoveDelay(): number {
    const baseDelay = Math.max(100, this.playerMetrics.averageLockTime);
    const variance = baseDelay * 0.2;
    const delay = baseDelay + (Math.random() * variance * 2 - variance);

    // Make AI slightly faster (10% advantage) to compensate for perfect execution
    return Math.max(80, delay * 0.9);
  }

  /**
   * Decide if AI should make an intentional mistake
   */
  shouldMakeMistake(): boolean {
    // Use base mistake rate (don't stack with player mistakes)
    // Player metrics mainly affect move delay, not mistake rate
    return Math.random() < this.baseMistakeRate;
  }

  /**
   * Find a reasonable (non-optimal) move
   */
  findReasonableMove(board: Board, piece: Tetromino): AIDecision {
    // Use weaker weights than optimal
    const reasonableWeights: AIWeights = {
      aggregateHeight: -0.3,  // Don't care as much about height
      completeLines: 6,       // Still prioritize line clears
      holes: -4,              // Avoid holes but not obsessively
      bumpiness: -0.2,        // Don't care much about smoothness
    };

    return findBestPlacement(board, piece, reasonableWeights);
  }

  /**
   * Make an intentional mistake
   */
  makeIntentionalMistake(board: Board, piece: Tetromino): AIDecision {
    const mistakeType = Math.random();

    if (mistakeType < 0.4) {
      // Random placement (40% of mistakes)
      return this.randomPlacement(board, piece);
    } else if (mistakeType < 0.7) {
      // Off-by-one error (30% of mistakes)
      return this.offByOnePlacement(board, piece);
    } else {
      // Skip rotation (30% of mistakes)
      return this.noRotationPlacement(board, piece);
    }
  }

  private randomPlacement(board: Board, piece: Tetromino): AIDecision {
    // Place piece at a random valid column
    const validColumns: number[] = [];

    for (let x = -2; x < board.width + 2; x++) {
      const movedPiece = { ...piece, position: { x, y: piece.position.y } };
      if (isValidPosition(board, movedPiece)) {
        validColumns.push(x);
      }
    }

    if (validColumns.length === 0) {
      return this.findReasonableMove(board, piece);
    }

    const randomX = validColumns[Math.floor(Math.random() * validColumns.length)];
    const movedPiece = { ...piece, position: { x: randomX, y: piece.position.y } };
    const finalPosition = getHardDropPosition(board, movedPiece);

    return {
      moves: generateMoves(piece, finalPosition, piece.rotation),
      targetPosition: finalPosition,
      targetRotation: piece.rotation,
      score: -1000,
    };
  }

  private offByOnePlacement(board: Board, piece: Tetromino): AIDecision {
    // Find best placement, then shift it 1 column left or right
    const bestDecision = this.findReasonableMove(board, piece);
    const offset = Math.random() < 0.5 ? -1 : 1;
    const newX = bestDecision.targetPosition.x + offset;

    // Validate the offset position
    let offsetPiece = { ...piece, rotation: bestDecision.targetRotation };

    // Apply rotations to match target rotation
    for (let r = 0; r < bestDecision.targetRotation; r++) {
      offsetPiece = rotatePiece(offsetPiece, true);
    }

    offsetPiece = { ...offsetPiece, position: { x: newX, y: offsetPiece.position.y } };

    if (isValidPosition(board, offsetPiece)) {
      const finalPosition = getHardDropPosition(board, offsetPiece);
      return {
        moves: generateMoves(piece, finalPosition, bestDecision.targetRotation),
        targetPosition: finalPosition,
        targetRotation: bestDecision.targetRotation,
        score: -500,
      };
    }

    // If offset invalid, fall back to best move
    return bestDecision;
  }

  private noRotationPlacement(board: Board, piece: Tetromino): AIDecision {
    // Use piece without rotation
    const noRotationWeights: AIWeights = {
      aggregateHeight: -0.3,
      completeLines: 6,
      holes: -4,
      bumpiness: -0.2,
    };

    // Only try rotation 0
    let bestScore = -Infinity;
    let bestPlacement: AIDecision | null = null;

    for (let x = -2; x < board.width + 2; x++) {
      const movedPiece = { ...piece, position: { x, y: piece.position.y } };

      if (!isValidPosition(board, movedPiece)) {
        continue;
      }

      const finalPosition = getHardDropPosition(board, movedPiece);
      const evaluation = evaluateBoard(board);
      const score = evaluation.completeLines * noRotationWeights.completeLines;

      if (score > bestScore) {
        bestScore = score;
        bestPlacement = {
          moves: generateMoves(piece, finalPosition, 0),
          targetPosition: finalPosition,
          targetRotation: 0,
          score,
        };
      }
    }

    return bestPlacement || this.findReasonableMove(board, piece);
  }

  /**
   * Main decision function - decides move quality based on metrics
   */
  findMove(board: Board, piece: Tetromino): AIDecision {
    if (this.shouldMakeMistake()) {
      return this.makeIntentionalMistake(board, piece);
    }
    return this.findReasonableMove(board, piece);
  }
}
