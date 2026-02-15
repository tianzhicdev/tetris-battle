import type { GameState, PlayerInputType, Tetromino } from '@tetris-battle/game-core';
import {
  isValidPosition,
  movePiece,
  rotatePiece,
  getHardDropPosition,
  lockPiece,
  clearLines,
  calculateStars,
  STAR_VALUES,
} from '@tetris-battle/game-core';

/**
 * Compares two game states for equality (prediction reconciliation).
 * Only compares critical fields that affect gameplay, not deep equality.
 */
export function areStatesEqual(predicted: GameState, server: GameState): boolean {
  // Handle null current piece case
  if (!predicted.currentPiece && !server.currentPiece) {
    // Both null, compare other fields
    return (
      predicted.score === server.score &&
      predicted.stars === server.stars &&
      predicted.linesCleared === server.linesCleared &&
      predicted.comboCount === server.comboCount
    );
  }

  // One has piece, other doesn't
  if (!predicted.currentPiece || !server.currentPiece) {
    return false;
  }

  // Both have pieces, compare all critical fields
  return (
    predicted.currentPiece.position.x === server.currentPiece.position.x &&
    predicted.currentPiece.position.y === server.currentPiece.position.y &&
    predicted.currentPiece.rotation === server.currentPiece.rotation &&
    predicted.score === server.score &&
    predicted.stars === server.stars &&
    predicted.linesCleared === server.linesCleared &&
    predicted.comboCount === server.comboCount
  );
}

/**
 * Applies a player input action to a game state.
 * Returns new state if action is valid, null if invalid.
 * Uses game-core validation functions to ensure consistency with server.
 */
export function applyInputAction(
  state: GameState,
  action: PlayerInputType
): GameState | null {
  // Check if piece exists
  if (!state.currentPiece) {
    return null;
  }

  // Check for game over
  if (state.isGameOver) {
    return null;
  }

  const currentPiece = state.currentPiece;

  switch (action) {
    case 'move_left': {
      const newPiece = movePiece(currentPiece, -1, 0);
      if (!isValidPosition(state.board, newPiece)) {
        return null; // Blocked by wall or blocks
      }
      return {
        ...state,
        currentPiece: newPiece,
      };
    }

    case 'move_right': {
      const newPiece = movePiece(currentPiece, 1, 0);
      if (!isValidPosition(state.board, newPiece)) {
        return null; // Blocked by wall or blocks
      }
      return {
        ...state,
        currentPiece: newPiece,
      };
    }

    case 'rotate_cw': {
      const newPiece = rotatePiece(currentPiece, true);
      if (!isValidPosition(state.board, newPiece)) {
        return null; // Rotation blocked
      }
      return {
        ...state,
        currentPiece: newPiece,
      };
    }

    case 'rotate_ccw': {
      const newPiece = rotatePiece(currentPiece, false);
      if (!isValidPosition(state.board, newPiece)) {
        return null; // Rotation blocked
      }
      return {
        ...state,
        currentPiece: newPiece,
      };
    }

    case 'soft_drop': {
      const newPiece = movePiece(currentPiece, 0, 1);
      if (!isValidPosition(state.board, newPiece)) {
        return null; // Can't move down (piece will lock next tick)
      }
      return {
        ...state,
        currentPiece: newPiece,
      };
    }

    case 'hard_drop': {
      // Calculate drop position
      const dropPosition = getHardDropPosition(state.board, currentPiece);
      const droppedPiece: Tetromino = {
        ...currentPiece,
        position: dropPosition,
      };

      // Lock the piece
      const boardAfterLock = lockPiece(state.board, droppedPiece);

      // Clear lines
      const { board: clearedBoard, linesCleared } = clearLines(boardAfterLock);

      // Calculate stars (simplified - doesn't account for cascade multiplier or bomb effects)
      const now = Date.now();
      const isCombo = now - state.lastClearTime < STAR_VALUES.comboWindow;
      const comboCount = linesCleared > 0 && isCombo ? state.comboCount + 1 : 0;
      const starsEarned = calculateStars(linesCleared, comboCount);
      const newStars = Math.min(
        state.stars + starsEarned,
        STAR_VALUES.maxCapacity
      );

      return {
        ...state,
        board: clearedBoard,
        currentPiece: null, // Piece locked, will spawn new piece server-side
        score: state.score + linesCleared * 100,
        stars: newStars,
        linesCleared: state.linesCleared + linesCleared,
        lastClearTime: linesCleared > 0 ? now : state.lastClearTime,
        comboCount,
      };
    }

    default:
      return null;
  }
}
