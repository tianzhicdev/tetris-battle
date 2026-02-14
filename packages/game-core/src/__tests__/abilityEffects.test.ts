import { describe, it, expect } from 'vitest';
import { createBoard } from '../engine';
import {
  applyAddJunkRows,
  applyScrambleBoard,
  applyGravityFlip,
} from '../abilityEffects';

describe('Ability Effects', () => {
  describe('applyAddJunkRows', () => {
    it('adds garbage rows to the bottom of the board', () => {
      const board = createBoard(10, 20);
      const result = applyAddJunkRows(board, 2);

      // Bottom 2 rows should have blocks (with 1 gap each)
      for (let row = 18; row < 20; row++) {
        const filledCount = result.grid[row].filter(cell => cell !== null).length;
        expect(filledCount).toBe(9); // 10 columns - 1 gap = 9 filled
      }

      // Top rows should still be empty
      expect(result.grid[0].every(cell => cell === null)).toBe(true);
    });

    it('pushes existing content up when adding junk rows', () => {
      const board = createBoard(10, 20);
      // Place a block at row 19 (bottom)
      board.grid[19][5] = 'T';

      const result = applyAddJunkRows(board, 2);

      // The T block that was at row 19 should now be at row 17 (pushed up by 2)
      expect(result.grid[17][5]).toBe('T');
    });

    it('each junk row has exactly one gap', () => {
      const board = createBoard(10, 20);
      const result = applyAddJunkRows(board, 3);

      for (let row = 17; row < 20; row++) {
        const nullCount = result.grid[row].filter(cell => cell === null).length;
        expect(nullCount).toBe(1);
      }
    });
  });

  describe('applyScrambleBoard', () => {
    it('preserves the total number of filled cells', () => {
      const board = createBoard(10, 20);
      // Fill some cells
      board.grid[19][0] = 'I';
      board.grid[19][1] = 'T';
      board.grid[19][2] = 'O';
      board.grid[18][0] = 'S';
      board.grid[18][1] = 'Z';

      const originalFilledCount = board.grid.flat().filter(c => c !== null).length;
      const result = applyScrambleBoard(board);
      const newFilledCount = result.grid.flat().filter(c => c !== null).length;

      expect(newFilledCount).toBe(originalFilledCount);
    });

    it('places cells in bottom rows (gravity-settled)', () => {
      const board = createBoard(10, 20);
      // Fill 15 cells
      for (let x = 0; x < 10; x++) {
        board.grid[19][x] = 'I';
      }
      for (let x = 0; x < 5; x++) {
        board.grid[18][x] = 'T';
      }

      const result = applyScrambleBoard(board);

      // All 15 cells should be in the bottom 2 rows
      // Row 19 should be fully filled (10 cells)
      const row19Filled = result.grid[19].filter(c => c !== null).length;
      expect(row19Filled).toBe(10);

      // Row 18 should have the remaining 5 cells
      const row18Filled = result.grid[18].filter(c => c !== null).length;
      expect(row18Filled).toBe(5);

      // Row 17 and above should be empty
      const row17Filled = result.grid[17].filter(c => c !== null).length;
      expect(row17Filled).toBe(0);
    });

    it('returns unchanged board for empty board', () => {
      const board = createBoard(10, 20);
      const result = applyScrambleBoard(board);

      expect(result.grid.flat().every(cell => cell === null)).toBe(true);
    });
  });

  describe('applyGravityFlip', () => {
    it('reverses the board vertically', () => {
      const board = createBoard(10, 20);
      // Place blocks at the bottom
      board.grid[19][0] = 'I';
      board.grid[19][1] = 'T';
      board.grid[18][0] = 'O';

      const result = applyGravityFlip(board);

      // Bottom row becomes top row (row 0)
      expect(result.grid[0][0]).toBe('I');
      expect(result.grid[0][1]).toBe('T');

      // Second-from-bottom becomes second-from-top (row 1)
      expect(result.grid[1][0]).toBe('O');

      // Old top (empty) becomes new bottom
      expect(result.grid[19][0]).toBe(null);
    });

    it('preserves total number of filled cells', () => {
      const board = createBoard(10, 20);
      board.grid[19][0] = 'I';
      board.grid[18][1] = 'T';
      board.grid[17][2] = 'O';

      const originalCount = board.grid.flat().filter(c => c !== null).length;
      const result = applyGravityFlip(board);
      const newCount = result.grid.flat().filter(c => c !== null).length;

      expect(newCount).toBe(originalCount);
    });

    it('double flip restores original board', () => {
      const board = createBoard(10, 20);
      board.grid[19][3] = 'S';
      board.grid[15][7] = 'Z';

      const flipped = applyGravityFlip(board);
      const doubleFlipped = applyGravityFlip(flipped);

      expect(doubleFlipped.grid[19][3]).toBe('S');
      expect(doubleFlipped.grid[15][7]).toBe('Z');
    });
  });
});
