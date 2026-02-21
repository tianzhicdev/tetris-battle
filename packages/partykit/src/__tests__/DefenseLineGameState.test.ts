import { describe, expect, it } from 'vitest';
import {
  DefenseLineGameState,
  DEFENSE_BOARD_COLS,
  DEFENSE_BOARD_ROWS,
  MIN_CONTIGUOUS_FOR_CLEAR,
  type DefenseLineCell,
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

function setEmptyBoardForB(state: DefenseLineGameState): void {
  for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
    for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
      // For player B, 'x' is empty and '0' is solid.
      state.board[row][col] = 'x';
    }
  }
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

    const clearable = (state as any).getClearableSegments('a') as Array<{ row: number; startCol: number; endCol: number }>;
    expect(clearable).toEqual([]);
  });

  it('finds a clearable segment when contiguous run reaches threshold', () => {
    const state = new DefenseLineGameState(2);
    setEmptyBoardForA(state);

    const row = 6;
    const startCol = 2;
    const run = MIN_CONTIGUOUS_FOR_CLEAR;
    for (let col = startCol; col < startCol + run; col++) {
      state.board[row][col] = 'a';
    }

    (state as any).rebuildActiveRows();

    const clearable = (state as any).getClearableSegments('a') as Array<{ row: number; startCol: number; endCol: number }>;
    expect(clearable).toEqual([{ row, startCol, endCol: startCol + run - 1 }]);
  });

  it('clears only segment columns and leaves non-segment columns untouched', () => {
    const state = new DefenseLineGameState(3);
    setEmptyBoardForA(state);

    const row = 8;
    // A non-segment block in the same row should remain untouched.
    state.board[row][0] = 'a';

    // Clearable run is cols 2..6.
    for (let col = 2; col < 2 + MIN_CONTIGUOUS_FOR_CLEAR; col++) {
      state.board[row][col] = 'a';
    }

    // Distinct markers one row above the clear segment.
    state.board[row - 1][2] = 'b';
    state.board[row - 1][3] = 'a';
    state.board[row - 1][4] = 'b';
    state.board[row - 1][5] = '0';
    state.board[row - 1][6] = 'b';

    const beforeRowsCleared = state.playerA.rowsCleared;

    (state as any).rebuildActiveRows();
    const resolution = (state as any).resolveAfterLock('a') as {
      clearedRows: number[];
      clearedSegments: Array<{ row: number; startCol: number; endCol: number }>;
    };

    expect(resolution.clearedRows).toEqual([row]);
    expect(resolution.clearedSegments).toEqual([{ row, startCol: 2, endCol: 6 }]);
    expect(state.playerA.rowsCleared).toBe(beforeRowsCleared + 1);

    // Non-cleared column stays as-is.
    expect(state.board[row][0]).toBe('a');
    // Cleared segment columns shifted from row above.
    expect(state.board[row][2]).toBe('b');
    expect(state.board[row][3]).toBe('a');
    expect(state.board[row][4]).toBe('b');
    expect(state.board[row][5]).toBe('0');
    expect(state.board[row][6]).toBe('b');
  });

  it('for player A, only segment columns in rows 0..clearRow shift down', () => {
    const state = new DefenseLineGameState(31);
    setEmptyBoardForA(state);

    const clearRow = 10;
    const startCol = 1;
    const endCol = 6;
    const unaffectedCol = 7;

    // Distinct patterns in affected and unaffected columns from rows 0..10.
    const beforeAffected: DefenseLineCell[] = [];
    const beforeUnaffected: DefenseLineCell[] = [];
    for (let row = 0; row <= clearRow; row++) {
      const affectedCell: DefenseLineCell = row % 2 === 0 ? 'a' : 'b';
      const unaffectedCell: DefenseLineCell = row % 3 === 0 ? 'a' : '0';
      state.board[row][startCol] = affectedCell;
      state.board[row][unaffectedCol] = unaffectedCell;
      beforeAffected.push(affectedCell);
      beforeUnaffected.push(unaffectedCell);
    }

    // Make row 10 clearable only on cols 1..6.
    for (let col = startCol; col <= endCol; col++) {
      state.board[clearRow][col] = 'a';
    }

    // Row below clear row should not move.
    state.board[clearRow + 1][startCol] = 'b';
    state.board[clearRow + 1][unaffectedCol] = 'a';

    (state as any).rebuildActiveRows();
    (state as any).resolveAfterLock('a');

    // Affected column: row 0 becomes filler, rows 1..10 shift from old rows 0..9.
    expect(state.board[0][startCol]).toBe('0');
    for (let row = 1; row <= clearRow; row++) {
      expect(state.board[row][startCol]).toBe(beforeAffected[row - 1]);
    }

    // Unaffected column should be unchanged.
    for (let row = 0; row <= clearRow; row++) {
      expect(state.board[row][unaffectedCol]).toBe(beforeUnaffected[row]);
    }
    expect(state.board[clearRow + 1][startCol]).toBe('b');
    expect(state.board[clearRow + 1][unaffectedCol]).toBe('a');
  });

  it('for player B, only segment columns in rows clearRow..last shift up', () => {
    const state = new DefenseLineGameState(32);
    setEmptyBoardForB(state);

    const clearRow = 9;
    const startCol = 2;
    const endCol = 6;
    const unaffectedCol = 1;

    const beforeAffected: DefenseLineCell[] = [];
    const beforeUnaffected: DefenseLineCell[] = [];
    for (let row = clearRow; row < DEFENSE_BOARD_ROWS; row++) {
      const affectedCell: DefenseLineCell = row % 2 === 0 ? 'b' : 'a';
      const unaffectedCell: DefenseLineCell = row % 3 === 0 ? 'b' : 'x';
      state.board[row][startCol] = affectedCell;
      state.board[row][unaffectedCol] = unaffectedCell;
      beforeAffected.push(affectedCell);
      beforeUnaffected.push(unaffectedCell);
    }

    for (let col = startCol; col <= endCol; col++) {
      state.board[clearRow][col] = 'b';
    }
    // Keep unaffected column outside the clear run at clearRow.
    state.board[clearRow][unaffectedCol] = 'x';
    beforeUnaffected[0] = 'x';

    state.board[clearRow - 1][startCol] = 'a';
    state.board[clearRow - 1][unaffectedCol] = 'b';

    (state as any).rebuildActiveRows();
    (state as any).resolveAfterLock('b');

    // Affected column: rows clearRow..last-1 shift from old clearRow+1..last, last becomes filler.
    for (let row = clearRow; row < DEFENSE_BOARD_ROWS - 1; row++) {
      expect(state.board[row][startCol]).toBe(beforeAffected[row - clearRow + 1]);
    }
    expect(state.board[DEFENSE_BOARD_ROWS - 1][startCol]).toBe('x');

    // Unaffected column should be unchanged.
    for (let row = clearRow; row < DEFENSE_BOARD_ROWS; row++) {
      expect(state.board[row][unaffectedCol]).toBe(beforeUnaffected[row - clearRow]);
    }
    expect(state.board[clearRow - 1][startCol]).toBe('a');
    expect(state.board[clearRow - 1][unaffectedCol]).toBe('b');
  });

  it('allows clearing on the bottom row', () => {
    const state = new DefenseLineGameState(4);
    setEmptyBoardForA(state);

    const bottomRow = DEFENSE_BOARD_ROWS - 1;
    for (let col = 0; col < MIN_CONTIGUOUS_FOR_CLEAR; col++) {
      state.board[bottomRow][col] = 'a';
    }
    state.board[bottomRow - 1][0] = 'b';

    (state as any).rebuildActiveRows();
    const resolution = (state as any).resolveAfterLock('a') as { clearedRows: number[] };

    expect(resolution.clearedRows).toContain(bottomRow);
    // Bottom-row cleared columns shift from above.
    expect(state.board[bottomRow][0]).toBe('b');
  });

  it('declares opponent winner when player cannot spawn next piece', () => {
    const state = new DefenseLineGameState(5);
    state.setStatus('playing');

    // Force next spawn to O at default A spawn location (row 0/1, col 4/5).
    state.playerA.nextPiece = 'O';
    state.board[0][4] = 'a';
    state.board[0][5] = 'a';
    state.board[1][4] = 'a';
    state.board[1][5] = 'a';

    // Place a piece that can lock immediately against A-solid x-zone at row 10.
    state.playerA.activePiece = {
      type: 'O',
      rotation: 0,
      row: 8,
      col: 0,
    };

    const result = state.processInput('a', 'hard_drop');

    expect(result.changed).toBe(true);
    expect(result.winner).toBe('b');
    expect(state.winner).toBe('b');
    expect(state.status).toBe('finished');
    expect(state.playerA.activePiece).toBeNull();
  });

  it('ends immediately when spawn is blocked at game start', () => {
    const state = new DefenseLineGameState(6);
    state.playerA.nextPiece = 'O';
    state.playerB.nextPiece = 'O';

    // Block A spawn footprint.
    state.board[0][4] = 'a';
    state.board[0][5] = 'a';
    state.board[1][4] = 'a';
    state.board[1][5] = 'a';

    state.startGame();

    expect(state.winner).toBe('b');
    expect(state.status).toBe('finished');
    expect(state.playerA.activePiece).toBeNull();
  });
});
