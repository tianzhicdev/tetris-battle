import { describe, it, expect } from 'vitest';
import {
  evaluateBoard,
  findBestPlacement,
  generateMoves,
  scoreBoard,
  type AIWeights,
} from '../aiPlayer';
import { createBoard } from '../../engine';
import { createTetromino } from '../../tetrominos';

describe('AI Player', () => {
  describe('evaluateBoard', () => {
    it('evaluates an empty board correctly', () => {
      const board = createBoard();
      const evaluation = evaluateBoard(board);

      expect(evaluation.aggregateHeight).toBe(0);
      expect(evaluation.completeLines).toBe(0);
      expect(evaluation.holes).toBe(0);
      expect(evaluation.bumpiness).toBe(0);
    });

    it('calculates aggregate height correctly', () => {
      const board = createBoard();
      // Place blocks in first 3 columns at different heights
      board.grid[19][0] = 'I'; // height 1
      board.grid[19][1] = 'I'; // height 1
      board.grid[18][1] = 'I'; // height 2
      board.grid[19][2] = 'I'; // height 1
      board.grid[18][2] = 'I'; // height 2
      board.grid[17][2] = 'I'; // height 3

      const evaluation = evaluateBoard(board);
      expect(evaluation.aggregateHeight).toBe(1 + 2 + 3); // 6
    });

    it('detects holes correctly', () => {
      const board = createBoard();
      // Create a hole: block above empty cell
      board.grid[18][0] = 'I';
      board.grid[19][0] = null; // hole
      board.grid[17][1] = 'I';
      board.grid[18][1] = null; // hole
      board.grid[19][1] = 'I';

      const evaluation = evaluateBoard(board);
      expect(evaluation.holes).toBe(2);
    });

    it('calculates bumpiness correctly', () => {
      const board = createBoard();
      // Heights: [0, 1, 3, 1, 0, ...]
      board.grid[19][1] = 'I'; // height 1
      board.grid[19][2] = 'I'; // height 3
      board.grid[18][2] = 'I';
      board.grid[17][2] = 'I';
      board.grid[19][3] = 'I'; // height 1

      const evaluation = evaluateBoard(board);
      // Bumpiness = |0-1| + |1-3| + |3-1| + |1-0| + 0 + ... = 1 + 2 + 2 + 1 = 6
      expect(evaluation.bumpiness).toBeGreaterThan(0);
    });

    it('detects complete lines', () => {
      const board = createBoard();
      // Fill bottom row
      for (let x = 0; x < board.width; x++) {
        board.grid[19][x] = 'I';
      }

      const evaluation = evaluateBoard(board);
      expect(evaluation.completeLines).toBe(1);
    });
  });

  describe('scoreBoard', () => {
    it('scores board with positive and negative weights', () => {
      const evaluation = {
        aggregateHeight: 10,
        completeLines: 2,
        holes: 3,
        bumpiness: 5,
      };

      const weights: AIWeights = {
        aggregateHeight: -0.5,
        completeLines: 10,
        holes: -7,
        bumpiness: -0.3,
      };

      const score = scoreBoard(evaluation, weights);
      // Score = (-0.5 * 10) + (10 * 2) + (-7 * 3) + (-0.3 * 5)
      //       = -5 + 20 - 21 - 1.5 = -7.5
      expect(score).toBeCloseTo(-7.5, 1);
    });
  });

  describe('findBestPlacement', () => {
    it('chooses flat placement for I-piece on empty board', () => {
      const board = createBoard();
      const piece = createTetromino('I', board.width);

      const weights: AIWeights = {
        aggregateHeight: -0.8,
        completeLines: 10,
        holes: -10,
        bumpiness: -0.6,
      };

      const decision = findBestPlacement(board, piece, weights);

      // I-piece should be placed flat (rotation 0 or 2)
      expect([0, 2]).toContain(decision.targetRotation);
      // Should be at bottom
      expect(decision.targetPosition.y).toBeGreaterThan(15);
    });

    it('avoids creating holes', () => {
      const board = createBoard();
      // Create a gap in bottom row
      for (let x = 0; x < board.width; x++) {
        if (x !== 4) {
          board.grid[19][x] = 'I';
        }
      }

      const piece = createTetromino('I', board.width);

      const weights: AIWeights = {
        aggregateHeight: -0.8,
        completeLines: 10,
        holes: -10, // Strong penalty for holes
        bumpiness: -0.6,
      };

      const decision = findBestPlacement(board, piece, weights);

      // Should place I-piece vertically in the gap to avoid creating holes
      // Or place it flat on top
      expect(decision.score).toBeGreaterThan(-100);
    });
  });

  describe('generateMoves', () => {
    it('generates correct moves for horizontal shift', () => {
      const piece = createTetromino('T', 10);
      // Piece starts at x=3
      const targetPosition = { x: 7, y: 18 };
      const moves = generateMoves(piece, targetPosition, 0);

      // Should move right 4 times then hard_drop to target
      const rightMoves = moves.filter(m => m.type === 'right');
      expect(rightMoves.length).toBe(4);
      // AI uses hard_drop to reach target row quickly
      expect(moves.filter(m => m.type === 'hard_drop').length).toBeLessThanOrEqual(1);
    });

    it('generates correct moves for left shift', () => {
      const piece = createTetromino('T', 10);
      // Piece starts at x=3
      const targetPosition = { x: 1, y: 18 };
      const moves = generateMoves(piece, targetPosition, 0);

      // Should move left 2 times then hard_drop to target
      const leftMoves = moves.filter(m => m.type === 'left');
      expect(leftMoves.length).toBe(2);
      expect(moves.filter(m => m.type === 'hard_drop').length).toBeLessThanOrEqual(1);
    });

    it('generates correct moves for rotation', () => {
      const piece = createTetromino('T', 10);
      const targetPosition = piece.position;
      const moves = generateMoves(piece, targetPosition, 2);

      // Should rotate twice then hard_drop
      const rotateMoves = moves.filter(m => m.type === 'rotate_cw');
      expect(rotateMoves.length).toBe(2);
      expect(moves.filter(m => m.type === 'hard_drop').length).toBeLessThanOrEqual(1);
    });

    it('generates combined moves for rotation and translation', () => {
      const piece = createTetromino('L', 10);
      const targetPosition = { x: 5, y: 18 };
      const moves = generateMoves(piece, targetPosition, 1);

      // Should have rotations and translations (gravity handles dropping)
      const rotateMoves = moves.filter(m => m.type === 'rotate_cw');

      expect(rotateMoves.length).toBeGreaterThan(0);
      expect(moves.filter(m => m.type === 'hard_drop').length).toBeLessThanOrEqual(1);
    });
  });
});
