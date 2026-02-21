import { describe, expect, it } from 'vitest';
import {
  DefenseLineGameState,
  DEFENSE_BOARD_COLS,
  DEFENSE_BOARD_ROWS,
  MIN_CONTIGUOUS_FOR_CLEAR,
} from '../DefenseLineGameState';

function setEmptyBoardForA(state: DefenseLineGameState): void {
  for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
    for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
      // For player A, '0' is empty and 'x' is solid.
      state.board[row][col] = '0';
    }
  }
  // Recompute active rows after direct board mutation.
  (state as any).rebuildActiveRows();
}

describe('DefenseLineGameState contiguous clear rule', () => {
  it('does not clear rows with a contiguous run shorter than threshold', () => {
    const state = new DefenseLineGameState(1);
    setEmptyBoardForA(state);

    const row = 5;
    const run = MIN_CONTIGUOUS_FOR_CLEAR - 1;
    for (let col = 0; col < run; col++) {
      state.board[row][col] = 'a';
    }

    (state as any).rebuildActiveRows();

    const clearable = (state as any).getClearableRows('a') as number[];
    expect(clearable).toEqual([]);
  });

  it('clears rows with contiguous run equal to threshold (>= 5)', () => {
    const state = new DefenseLineGameState(2);
    setEmptyBoardForA(state);

    const row = 6;
    const run = MIN_CONTIGUOUS_FOR_CLEAR;
    for (let col = 0; col < run; col++) {
      state.board[row][col] = 'a';
    }

    (state as any).rebuildActiveRows();

    const clearable = (state as any).getClearableRows('a') as number[];
    expect(clearable).toEqual([row]);
  });

  it('increments rowsCleared when a clearable row resolves after lock', () => {
    const state = new DefenseLineGameState(3);
    setEmptyBoardForA(state);

    const row = 8;
    for (let col = 0; col < MIN_CONTIGUOUS_FOR_CLEAR; col++) {
      state.board[row][col] = 'a';
    }

    const before = state.playerA.rowsCleared;

    (state as any).rebuildActiveRows();
    const resolution = (state as any).resolveAfterLock('a') as { clearedRows: number[] };

    expect(resolution.clearedRows).toContain(row);
    expect(state.playerA.rowsCleared).toBe(before + 1);
  });
});
