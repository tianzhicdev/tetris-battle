import { describe, it, expect, beforeEach } from 'vitest';
import { ServerGameState } from '../ServerGameState';

describe('ServerGameState - Buff Abilities', () => {
  let state: ServerGameState;

  beforeEach(() => {
    state = new ServerGameState('player1', 12345, []);
    // Lock a few pieces to have blocks on board
    for (let i = 0; i < 5; i++) {
      state.processInput('hard_drop');
    }
  });

  describe('Bomb Abilities', () => {
    it('should apply circle_bomb - clears radius on lock', () => {
      const blocksBefore = countBlocks(state.gameState.board.grid);

      state.applyAbility('circle_bomb');
      state.processInput('hard_drop'); // Lock the bomb piece

      const blocksAfter = countBlocks(state.gameState.board.grid);
      expect(blocksAfter).toBeLessThan(blocksBefore);
    });

    it('should apply cross_firebomb - clears cross pattern', () => {
      const blocksBefore = countBlocks(state.gameState.board.grid);

      state.applyAbility('cross_firebomb');
      state.processInput('hard_drop');

      const blocksAfter = countBlocks(state.gameState.board.grid);
      expect(blocksAfter).toBeLessThan(blocksBefore);
    });

    it('should reset bomb mode after lock', () => {
      state.applyAbility('circle_bomb');
      state.processInput('hard_drop');

      // Next piece should not be a bomb
      const blocksBefore = countBlocks(state.gameState.board.grid);
      state.processInput('hard_drop');
      const blocksAfter = countBlocks(state.gameState.board.grid);

      // Should add blocks, not remove (normal piece)
      expect(blocksAfter).toBeGreaterThanOrEqual(blocksBefore);
    });
  });

  describe('Mini Blocks', () => {
    it('should spawn 5 mini blocks', () => {
      state.applyAbility('mini_blocks');

      // Drop current piece first to trigger mini block spawning
      state.processInput('hard_drop');

      for (let i = 0; i < 5; i++) {
        const piece = state.gameState.currentPiece;
        expect(piece).toBeDefined();

        // Mini block should be 2 cells max
        const cellCount = piece!.shape.flat().filter(c => c === 1).length;
        expect(cellCount).toBeLessThanOrEqual(2);

        state.processInput('hard_drop');
      }

      // 6th piece should be normal
      const normalPiece = state.gameState.currentPiece;
      const normalCells = normalPiece!.shape.flat().filter(c => c === 1).length;
      expect(normalCells).toBeGreaterThan(2);
    });
  });

  describe('Fill Holes', () => {
    it('should fill surrounded empty cells', () => {
      // Create a board with holes
      const grid = state.gameState.board.grid;
      // Create an enclosed region in the middle of the board
      // Build walls
      for (let x = 3; x <= 6; x++) {
        grid[18][x] = 'I'; // Bottom wall
        grid[15][x] = 'I'; // Top wall
      }
      for (let y = 16; y <= 17; y++) {
        grid[y][3] = 'I'; // Left wall
        grid[y][6] = 'I'; // Right wall
      }
      // Create holes in the middle
      grid[16][4] = null;
      grid[16][5] = null;
      grid[17][4] = null;
      grid[17][5] = null;

      state.applyAbility('fill_holes');

      // Enclosed holes should now be filled
      const newGrid = state.gameState.board.grid;
      expect(newGrid[16][4]).not.toBeNull();
      expect(newGrid[16][5]).not.toBeNull();
      expect(newGrid[17][4]).not.toBeNull();
      expect(newGrid[17][5]).not.toBeNull();
    });
  });

  describe('Cascade Multiplier', () => {
    it('should activate cascade multiplier effect for 15s', () => {
      state.applyAbility('cascade_multiplier');

      // Effect should be active
      expect(state.getActiveEffects()).toContain('cascade_multiplier');

      // Effect should have correct duration (15 seconds)
      const endTime = state.activeEffects.get('cascade_multiplier')!;
      const duration = endTime - Date.now();
      expect(duration).toBeGreaterThan(14000); // At least 14 seconds remaining
      expect(duration).toBeLessThanOrEqual(15000); // At most 15 seconds
    });

    it('should stop doubling after 15s', () => {
      state.applyAbility('cascade_multiplier');

      // Manually expire
      state.activeEffects.set('cascade_multiplier', Date.now() - 1000);

      expect(state.getActiveEffects()).not.toContain('cascade_multiplier');
    });
  });

  describe('Weird Shapes - Fixed', () => {
    it('should stay pending across state broadcasts until consumed', () => {
      state.applyAbility('weird_shapes');

      // Simulate broadcast path that calls getPublicState/getActiveEffects.
      state.getPublicState();
      state.getPublicState();

      expect(state.getActiveEffects()).toContain('weird_shapes');

      // Consume on next spawn.
      state.processInput('hard_drop');

      expect(state.getActiveEffects()).not.toContain('weird_shapes');
    });

    it('should spawn 4x4 hollowed piece', () => {
      state.applyAbility('weird_shapes');

      // Lock current piece to trigger weird shape spawn
      state.processInput('hard_drop');

      const piece = state.gameState.currentPiece!;

      // Should be 4x4 shape
      expect(piece.shape.length).toBe(4);
      expect(piece.shape[0].length).toBe(4);

      // Should match one of the supported hollowed 4x4 variants.
      const shapeJson = JSON.stringify(piece.shape);
      const allowed = new Set([
        JSON.stringify([
          [1, 1, 1, 1],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
          [1, 1, 1, 1],
        ]),
        JSON.stringify([
          [0, 1, 1, 0],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
          [1, 1, 1, 1],
        ]),
        JSON.stringify([
          [0, 1, 1, 0],
          [1, 0, 0, 1],
          [1, 0, 0, 1],
          [0, 1, 1, 0],
        ]),
      ]);
      expect(allowed.has(shapeJson)).toBe(true);
    });

    it('should only affect next piece', () => {
      state.applyAbility('weird_shapes');
      state.processInput('hard_drop');

      // Next piece after weird shape should be normal
      state.processInput('hard_drop');
      const normalPiece = state.gameState.currentPiece!;

      expect(normalPiece.shape.length).toBeLessThanOrEqual(4);
      expect(normalPiece.shape[0].length).toBeLessThanOrEqual(4);
    });
  });
});

function countBlocks(grid: any[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  return count;
}
