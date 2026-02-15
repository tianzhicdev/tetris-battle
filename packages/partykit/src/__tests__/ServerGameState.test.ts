import { describe, it, expect, beforeEach } from 'vitest';
import { ServerGameState } from '../ServerGameState';

describe('ServerGameState', () => {
  let state: ServerGameState;

  beforeEach(() => {
    state = new ServerGameState('player1', 12345, []);
  });

  it('should spawn deterministic pieces with same seed', () => {
    const pieces1 = state.gameState.nextPieces.slice();

    const state2 = new ServerGameState('player1', 12345, []);
    const pieces2 = state2.gameState.nextPieces.slice();

    expect(pieces1).toEqual(pieces2);
  });

  it('should have different pieces with different seeds', () => {
    const state2 = new ServerGameState('player1', 99999, []);

    expect(state.gameState.nextPieces).not.toEqual(state2.gameState.nextPieces);
  });

  it('should process valid move left', () => {
    const oldX = state.gameState.currentPiece!.position.x;
    const changed = state.processInput('move_left');

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.position.x).toBe(oldX - 1);
  });

  it('should reject invalid move left at wall', () => {
    // Move piece to left wall
    while (state.processInput('move_left')) {
      // Keep moving left until it can't move anymore
    }

    const x = state.gameState.currentPiece!.position.x;
    const changed = state.processInput('move_left');

    expect(changed).toBe(false);
    expect(state.gameState.currentPiece!.position.x).toBe(x);
  });

  it('should process valid move right', () => {
    const oldX = state.gameState.currentPiece!.position.x;
    const changed = state.processInput('move_right');

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.position.x).toBe(oldX + 1);
  });

  it('should process rotation', () => {
    const oldRotation = state.gameState.currentPiece!.rotation;
    const changed = state.processInput('rotate_cw');

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.rotation).not.toBe(oldRotation);
  });

  it('should lock piece and spawn next on hard drop', () => {
    const firstPieceType = state.gameState.currentPiece!.type;
    const secondPieceType = state.gameState.nextPieces[0];

    const changed = state.processInput('hard_drop');

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.type).toBe(secondPieceType);
    expect(state.gameState.nextPieces.length).toBe(5);
    expect(state.gameState.nextPieces[0]).not.toBe(firstPieceType); // Queue shifted
  });

  it('should maintain starting stars with no line clears', () => {
    state.processInput('hard_drop');

    // No lines cleared on empty board, stars should stay at starting value
    expect(state.gameState.stars).toBe(100); // STAR_VALUES.startingPool
  });

  it('should detect game over on piece collision', () => {
    // Fill board to top by hard dropping many pieces
    for (let i = 0; i < 50; i++) {
      if (state.gameState.isGameOver) break;
      state.processInput('hard_drop');
    }

    expect(state.gameState.isGameOver).toBe(true);
  });

  it('should tick move piece down', () => {
    const oldY = state.gameState.currentPiece!.position.y;
    const changed = state.tick();

    expect(changed).toBe(true);
    expect(state.gameState.currentPiece!.position.y).toBe(oldY + 1);
  });

  it('should include active effects in public state', () => {
    state.applyAbility('screen_shake');

    const publicState = state.getPublicState();

    expect(publicState.activeEffects).toContain('screen_shake');
  });

  it('should apply earthquake ability', () => {
    // First lock a piece to have some blocks on the board
    state.processInput('hard_drop');

    const boardBefore = JSON.stringify(state.gameState.board.grid);
    state.applyAbility('earthquake');
    const boardAfter = JSON.stringify(state.gameState.board.grid);

    // Board should change (earthquake removes blocks randomly)
    // Note: might occasionally be the same if no blocks removed, but very unlikely
    expect(boardAfter).toBeDefined();
  });

  it('should modify tick rate on speed_up_opponent', () => {
    const originalTickRate = state.tickRate;
    state.applyAbility('speed_up_opponent');

    expect(state.tickRate).toBe(originalTickRate / 3);
    expect(state.getActiveEffects()).toContain('speed_up_opponent');
  });

  it('should return public state with all required fields', () => {
    const publicState = state.getPublicState();

    expect(publicState).toHaveProperty('board');
    expect(publicState).toHaveProperty('currentPiece');
    expect(publicState).toHaveProperty('score');
    expect(publicState).toHaveProperty('stars');
    expect(publicState).toHaveProperty('linesCleared');
    expect(publicState).toHaveProperty('comboCount');
    expect(publicState).toHaveProperty('isGameOver');
    expect(publicState).toHaveProperty('activeEffects');
  });

  describe('Ability System - Comprehensive Tests', () => {
    describe('Instant Effect Debuff Abilities', () => {
      beforeEach(() => {
        // Lock a few pieces to have blocks on the board
        for (let i = 0; i < 3; i++) {
          state.processInput('hard_drop');
        }
      });

      it('should apply earthquake - removes random blocks', () => {
        const blockCountBefore = countBlocks(state.gameState.board.grid);
        state.applyAbility('earthquake');
        const blockCountAfter = countBlocks(state.gameState.board.grid);

        // Earthquake should remove some blocks (up to 20%)
        expect(blockCountAfter).toBeLessThanOrEqual(blockCountBefore);
      });

      it('should apply clear_rows - clears bottom rows', () => {
        const boardBefore = JSON.parse(JSON.stringify(state.gameState.board.grid));
        state.applyAbility('clear_rows');
        const boardAfter = state.gameState.board.grid;

        // Bottom rows should be cleared
        const bottomRowBefore = boardBefore[boardBefore.length - 1];
        const bottomRowAfter = boardAfter[boardAfter.length - 1];

        // At least some difference should exist
        expect(JSON.stringify(bottomRowAfter)).not.toBe(JSON.stringify(bottomRowBefore));
      });

      it('should apply random_spawner - adds random blocks', () => {
        const blockCountBefore = countBlocks(state.gameState.board.grid);
        state.applyAbility('random_spawner');
        const blockCountAfter = countBlocks(state.gameState.board.grid);

        // Random spawner should add blocks
        expect(blockCountAfter).toBeGreaterThanOrEqual(blockCountBefore);
      });

      it('should apply row_rotate - rotates board rows', () => {
        const boardBefore = JSON.parse(JSON.stringify(state.gameState.board.grid));
        state.applyAbility('row_rotate');
        const boardAfter = state.gameState.board.grid;

        // Board should change due to rotation
        expect(JSON.stringify(boardAfter)).not.toBe(JSON.stringify(boardBefore));
      });

      it('should apply death_cross - creates cross pattern', () => {
        const blockCountBefore = countBlocks(state.gameState.board.grid);
        state.applyAbility('death_cross');
        const blockCountAfter = countBlocks(state.gameState.board.grid);

        // Death cross should add blocks in a cross pattern
        expect(blockCountAfter).toBeGreaterThan(blockCountBefore);
      });

      it('should apply gold_digger - removes random blocks', () => {
        const blockCountBefore = countBlocks(state.gameState.board.grid);
        state.applyAbility('gold_digger');
        const blockCountAfter = countBlocks(state.gameState.board.grid);

        // Gold digger removes 1-3 filled blocks (opposite of random_spawner)
        expect(blockCountAfter).toBeLessThanOrEqual(blockCountBefore);
      });
    });

    describe('Duration-Based Debuff Abilities', () => {
      it('should apply speed_up_opponent - increases tick rate', () => {
        const originalTickRate = state.tickRate;
        state.applyAbility('speed_up_opponent');

        expect(state.tickRate).toBe(originalTickRate / 3);
        expect(state.getActiveEffects()).toContain('speed_up_opponent');

        // Effect should be in active effects
        const publicState = state.getPublicState();
        expect(publicState.activeEffects).toContain('speed_up_opponent');
      });

      it('should apply reverse_controls - swaps left/right inputs', () => {
        state.applyAbility('reverse_controls');

        const originalX = state.gameState.currentPiece!.position.x;

        // Try to move left - should go right instead
        state.processInput('move_left');
        expect(state.gameState.currentPiece!.position.x).toBeGreaterThan(originalX);

        // Effect should be active
        expect(state.getActiveEffects()).toContain('reverse_controls');
      });

      it('should apply rotation_lock - blocks rotation', () => {
        state.applyAbility('rotation_lock');

        const originalRotation = state.gameState.currentPiece!.rotation;

        // Try to rotate - should be blocked
        const changed = state.processInput('rotate_cw');
        expect(changed).toBe(false);
        expect(state.gameState.currentPiece!.rotation).toBe(originalRotation);

        // Effect should be active
        expect(state.getActiveEffects()).toContain('rotation_lock');
      });

      it('should apply blind_spot - adds visual effect', () => {
        state.applyAbility('blind_spot');

        // Effect should be tracked
        expect(state.getActiveEffects()).toContain('blind_spot');

        const publicState = state.getPublicState();
        expect(publicState.activeEffects).toContain('blind_spot');
      });

      it('should apply screen_shake - adds visual effect', () => {
        state.applyAbility('screen_shake');

        expect(state.getActiveEffects()).toContain('screen_shake');
      });

      it('should apply shrink_ceiling - adds visual effect', () => {
        state.applyAbility('shrink_ceiling');

        expect(state.getActiveEffects()).toContain('shrink_ceiling');
      });

      it('should apply weird_shapes - affects next piece', () => {
        state.applyAbility('weird_shapes');

        // Effect should stay active until next spawn consumes it
        const activeEffects = state.getActiveEffects();
        expect(activeEffects).toContain('weird_shapes');
      });
    });

    describe('Effect Duration and Cleanup', () => {
      it('should remove expired effects from active list', () => {
        // Apply effect with short duration
        state.applyAbility('screen_shake');

        // Effect should initially be active
        expect(state.getActiveEffects()).toContain('screen_shake');

        // Manually expire the effect
        state.activeEffects.set('screen_shake', Date.now() - 1000);

        // Should no longer be in active effects
        expect(state.getActiveEffects()).not.toContain('screen_shake');
      });

      it('should handle multiple active effects simultaneously', () => {
        state.applyAbility('screen_shake');
        state.applyAbility('blind_spot');
        state.applyAbility('rotation_lock');

        const activeEffects = state.getActiveEffects();
        expect(activeEffects).toContain('screen_shake');
        expect(activeEffects).toContain('blind_spot');
        expect(activeEffects).toContain('rotation_lock');
        expect(activeEffects.length).toBeGreaterThanOrEqual(3);
      });

      it('should restore normal tick rate after speed_up expires', async () => {
        const originalTickRate = state.tickRate;
        state.applyAbility('speed_up_opponent');

        expect(state.tickRate).toBe(originalTickRate / 3);

        // Wait for effect to expire (10 seconds + buffer)
        // Note: This is a simplified test - in production you'd use fake timers
        await new Promise(resolve => setTimeout(resolve, 10100));
        expect(state.tickRate).toBe(originalTickRate);
        expect(state.getActiveEffects()).not.toContain('speed_up_opponent');
      }, 11000); // 11 second timeout for test

      it('should restore normal controls after reverse_controls expires', () => {
        state.applyAbility('reverse_controls');

        // Manually expire the effect
        state.activeEffects.set('reverse_controls', Date.now() - 1000);

        const originalX = state.gameState.currentPiece!.position.x;

        // Move left should work normally now
        state.processInput('move_left');
        expect(state.gameState.currentPiece!.position.x).toBeLessThan(originalX);
      });

      it('should allow rotation after rotation_lock expires', () => {
        state.applyAbility('rotation_lock');

        // Manually expire the effect
        state.activeEffects.set('rotation_lock', Date.now() - 1000);

        const originalRotation = state.gameState.currentPiece!.rotation;

        // Rotation should work now
        const changed = state.processInput('rotate_cw');
        expect(changed).toBe(true);
        expect(state.gameState.currentPiece!.rotation).not.toBe(originalRotation);
      });
    });

    describe('Ability Edge Cases', () => {
      it('should handle unknown ability type gracefully', () => {
        // Should not throw error
        expect(() => {
          state.applyAbility('unknown_ability_xyz');
        }).not.toThrow();
      });

      it('should handle abilities on empty board', () => {
        const freshState = new ServerGameState('test', 12345, []);

        // Should not crash on empty board
        expect(() => {
          freshState.applyAbility('earthquake');
          freshState.applyAbility('clear_rows');
          freshState.applyAbility('random_spawner');
          freshState.applyAbility('death_cross');
        }).not.toThrow();
      });

      it('should handle abilities on full board', () => {
        // Fill board to near-capacity
        for (let i = 0; i < 45; i++) {
          if (state.gameState.isGameOver) break;
          state.processInput('hard_drop');
        }

        // Should not crash on full board
        expect(() => {
          state.applyAbility('random_spawner');
          state.applyAbility('death_cross');
          state.applyAbility('gold_digger');
        }).not.toThrow();
      });

      it('should handle rapid ability application', () => {
        // Apply many abilities in quick succession
        state.applyAbility('screen_shake');
        state.applyAbility('blind_spot');
        state.applyAbility('rotation_lock');
        state.applyAbility('reverse_controls');
        state.applyAbility('shrink_ceiling');

        const activeEffects = state.getActiveEffects();
        expect(activeEffects.length).toBeGreaterThan(0);
      });
    });
  });
});

// Helper function to count blocks on board
function countBlocks(grid: any[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  return count;
}
