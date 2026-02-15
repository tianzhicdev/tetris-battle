import { describe, it, expect } from 'vitest';
import { areStatesEqual, applyInputAction } from '../utils/predictionHelpers';
import { createInitialGameState, createTetromino, createBoard } from '@tetris-battle/game-core';
import type { GameState } from '@tetris-battle/game-core';

describe('predictionHelpers', () => {
  describe('areStatesEqual', () => {
    it('should return true for identical states', () => {
      const state1: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        score: 100,
        stars: 50,
      };

      const state2: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        score: 100,
        stars: 50,
      };

      expect(areStatesEqual(state1, state2)).toBe(true);
    });

    it('should return false when piece position differs', () => {
      const state1: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const state2: GameState = {
        ...createInitialGameState(),
        currentPiece: {
          ...createTetromino('I', 10),
          position: { x: 5, y: 1 }, // Different position
        },
      };

      expect(areStatesEqual(state1, state2)).toBe(false);
    });

    it('should return false when score differs', () => {
      const state1: GameState = {
        ...createInitialGameState(),
        score: 100,
      };

      const state2: GameState = {
        ...createInitialGameState(),
        score: 200,
      };

      expect(areStatesEqual(state1, state2)).toBe(false);
    });

    it('should return false when stars differ', () => {
      const state1: GameState = {
        ...createInitialGameState(),
        stars: 50,
      };

      const state2: GameState = {
        ...createInitialGameState(),
        stars: 100,
      };

      expect(areStatesEqual(state1, state2)).toBe(false);
    });

    it('should return true when both have null currentPiece', () => {
      const state1: GameState = {
        ...createInitialGameState(),
        currentPiece: null,
        score: 100,
      };

      const state2: GameState = {
        ...createInitialGameState(),
        currentPiece: null,
        score: 100,
      };

      expect(areStatesEqual(state1, state2)).toBe(true);
    });

    it('should return false when one has piece and other does not', () => {
      const state1: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const state2: GameState = {
        ...createInitialGameState(),
        currentPiece: null,
      };

      expect(areStatesEqual(state1, state2)).toBe(false);
    });
  });

  describe('applyInputAction', () => {
    it('should move piece left', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const newState = applyInputAction(state, 'move_left');

      expect(newState).not.toBeNull();
      expect(newState!.currentPiece!.position.x).toBe(state.currentPiece!.position.x - 1);
    });

    it('should move piece right', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const newState = applyInputAction(state, 'move_right');

      expect(newState).not.toBeNull();
      expect(newState!.currentPiece!.position.x).toBe(state.currentPiece!.position.x + 1);
    });

    it('should return null when move left is blocked by wall', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: {
          ...createTetromino('I', 10),
          position: { x: 0, y: 0 }, // At left edge
        },
      };

      const newState = applyInputAction(state, 'move_left');

      expect(newState).toBeNull();
    });

    it('should return null when move right is blocked by wall', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: {
          ...createTetromino('I', 10),
          position: { x: 6, y: 0 }, // I piece is 4 wide, x=6 means right edge at x=9
        },
      };

      const newState = applyInputAction(state, 'move_right');

      expect(newState).toBeNull();
    });

    it('should rotate piece clockwise', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('T', 10),
      };

      const originalRotation = state.currentPiece!.rotation;
      const newState = applyInputAction(state, 'rotate_cw');

      expect(newState).not.toBeNull();
      expect(newState!.currentPiece!.rotation).not.toBe(originalRotation);
    });

    it('should rotate piece counter-clockwise', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('T', 10),
      };

      const originalRotation = state.currentPiece!.rotation;
      const newState = applyInputAction(state, 'rotate_ccw');

      expect(newState).not.toBeNull();
      expect(newState!.currentPiece!.rotation).not.toBe(originalRotation);
    });

    it('should move piece down with soft drop', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const newState = applyInputAction(state, 'soft_drop');

      expect(newState).not.toBeNull();
      expect(newState!.currentPiece!.position.y).toBe(state.currentPiece!.position.y + 1);
    });

    it('should hard drop piece to bottom', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const newState = applyInputAction(state, 'hard_drop');

      expect(newState).not.toBeNull();
      // After hard drop, piece should be locked (currentPiece = null)
      expect(newState!.currentPiece).toBeNull();
      // Y position should be much lower than starting
      expect(state.currentPiece!.position.y).toBeLessThan(10);
    });

    it('should return null when no current piece', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: null,
      };

      const newState = applyInputAction(state, 'move_left');

      expect(newState).toBeNull();
    });

    it('should return null when game is over', () => {
      const state: GameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        isGameOver: true,
      };

      const newState = applyInputAction(state, 'move_left');

      expect(newState).toBeNull();
    });

    it('should update score after hard drop with line clears', () => {
      // Create a board with a nearly full row
      const board = createBoard();
      const bottomRow = board.grid[board.height - 1];
      for (let x = 0; x < board.width - 4; x++) {
        bottomRow[x] = 1; // Fill most of bottom row
      }

      const state: GameState = {
        ...createInitialGameState(),
        board,
        currentPiece: {
          ...createTetromino('I', 10),
          position: { x: board.width - 4, y: 0 }, // Position to complete row
          rotation: 0,
        },
        score: 0,
      };

      const newState = applyInputAction(state, 'hard_drop');

      expect(newState).not.toBeNull();
      // Should have cleared at least one line
      expect(newState!.linesCleared).toBeGreaterThan(0);
      // Score should increase
      expect(newState!.score).toBeGreaterThan(0);
    });
  });
});
