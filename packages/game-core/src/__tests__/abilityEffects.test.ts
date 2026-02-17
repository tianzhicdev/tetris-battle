import { describe, it, expect } from 'vitest';
import { createBoard } from '../engine';
import { SeededRandom } from '../SeededRandom';
import {
  applyClearRows,
  applyDeathCross,
  applyFillHoles,
  applyGoldDigger,
  applyRandomSpawner,
} from '../abilityEffects';

describe('Ability Effects', () => {
  describe('applyClearRows', () => {
    it('clears bottom rows and preserves board height', () => {
      const board = createBoard(10, 20);
      for (let y = 15; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          board.grid[y][x] = 'I';
        }
      }

      const result = applyClearRows(board, 3);

      expect(result.rowsCleared).toBe(3);
      expect(result.board.grid.length).toBe(20);
      expect(result.board.grid[19].every((cell) => cell === 'I')).toBe(true);
      expect(result.board.grid[0].every((cell) => cell === null)).toBe(true);
    });
  });

  describe('applyRandomSpawner', () => {
    it('adds blocks into valid empty cells', () => {
      const board = createBoard(10, 20);
      board.grid[19][0] = 'T';
      board.grid[18][0] = 'O';
      const beforeCount = board.grid.flat().filter((cell) => cell !== null).length;

      const seeded = new SeededRandom(42);
      const result = applyRandomSpawner(board, 4, seeded);
      const afterCount = result.grid.flat().filter((cell) => cell !== null).length;

      expect(afterCount).toBeGreaterThan(beforeCount);
      expect(afterCount - beforeCount).toBeLessThanOrEqual(4);
    });
  });

  describe('applyGoldDigger', () => {
    it('removes up to N filled cells', () => {
      const board = createBoard(10, 20);
      for (let y = 10; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          board.grid[y][x] = 'L';
        }
      }

      const beforeCount = board.grid.flat().filter((cell) => cell !== null).length;
      const seeded = new SeededRandom(99);
      const result = applyGoldDigger(board, 5, seeded);
      const afterCount = result.grid.flat().filter((cell) => cell !== null).length;

      expect(beforeCount - afterCount).toBe(5);
    });
  });

  describe('applyDeathCross', () => {
    it('toggles both diagonals', () => {
      const board = createBoard(10, 20);
      const maxDiagonal = Math.min(board.width, board.height);

      // Fill both diagonal tracks so death_cross must clear them.
      for (let i = 0; i < maxDiagonal; i++) {
        const y = board.height - 1 - i;
        board.grid[y][i] = 'S';
        board.grid[y][board.width - 1 - i] = 'Z';
      }

      const result = applyDeathCross(board);

      for (let i = 0; i < maxDiagonal; i++) {
        const y = board.height - 1 - i;
        expect(result.grid[y][i]).toBe(null);
        expect(result.grid[y][board.width - 1 - i]).toBe(null);
      }
    });
  });

  describe('applyFillHoles', () => {
    it('fills enclosed empty regions', () => {
      const board = createBoard(10, 20);

      // Build a boxed cavity centered at (5, 15).
      for (let x = 3; x <= 7; x++) {
        board.grid[13][x] = 'J';
        board.grid[17][x] = 'J';
      }
      for (let y = 13; y <= 17; y++) {
        board.grid[y][3] = 'J';
        board.grid[y][7] = 'J';
      }
      board.grid[15][5] = null;

      const result = applyFillHoles(board);
      expect(result.grid[15][5]).not.toBe(null);
    });
  });
});
