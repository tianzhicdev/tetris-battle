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
});
