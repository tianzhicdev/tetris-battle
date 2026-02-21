import {
  SeededRandom,
  TETROMINO_SHAPES,
  TETROMINO_TYPES,
  type TetrominoType,
} from '@tetris-battle/game-core';

export type DefenseLinePlayer = 'a' | 'b';
export type DefenseLineCell = '0' | 'x' | 'a' | 'b';

export interface DefenseLinePiece {
  type: TetrominoType;
  rotation: number;
  row: number;
  col: number;
}

export interface DefenseLinePlayerState {
  activePiece: DefenseLinePiece | null;
  nextPiece: TetrominoType;
  rowsCleared: number;
  queue: TetrominoType[];
}

export interface DefenseLinePublicState {
  board: DefenseLineCell[][];
  activeRows: number[];
  playerA: DefenseLinePlayerState;
  playerB: DefenseLinePlayerState;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  winner: DefenseLinePlayer | null;
}

interface ResolutionResult {
  clearedRows: number[];
  winner: DefenseLinePlayer | null;
}

interface InputResult extends ResolutionResult {
  changed: boolean;
}

const BOARD_ROWS = 30;
const BOARD_COLS = 5;
const CLEAR_TARGET = 10;

export class DefenseLineGameState {
  board: DefenseLineCell[][];
  activeRows: Set<number>;
  playerA: DefenseLinePlayerState;
  playerB: DefenseLinePlayerState;
  status: 'waiting' | 'countdown' | 'playing' | 'finished' = 'waiting';
  winner: DefenseLinePlayer | null = null;

  private readonly rng: SeededRandom;

  constructor(seed: number = Date.now()) {
    this.rng = new SeededRandom(seed);
    // Initialize board with '0' background (rows 0-14) and 'x' background (rows 15-29)
    this.board = Array.from({ length: BOARD_ROWS }, (_, row) =>
      Array.from({ length: BOARD_COLS }, () => (row < 15 ? '0' : 'x'))
    );
    this.activeRows = new Set<number>();
    this.playerA = this.createPlayerState();
    this.playerB = this.createPlayerState();
  }

  setStatus(status: 'waiting' | 'countdown' | 'playing' | 'finished'): void {
    this.status = status;
  }

  startGame(): void {
    this.status = 'playing';
    if (!this.playerA.activePiece) {
      this.playerA.activePiece = this.createSpawnPiece('a', this.playerA.nextPiece);
      this.playerA.nextPiece = this.drawNextPiece(this.playerA);
    }
    if (!this.playerB.activePiece) {
      this.playerB.activePiece = this.createSpawnPiece('b', this.playerB.nextPiece);
      this.playerB.nextPiece = this.drawNextPiece(this.playerB);
    }
  }

  processInput(player: DefenseLinePlayer, input: 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop'): InputResult {
    if (this.status !== 'playing' || this.winner) {
      return { changed: false, clearedRows: [], winner: this.winner };
    }

    const state = this.getPlayerState(player);
    if (!state.activePiece) {
      return { changed: false, clearedRows: [], winner: this.winner };
    }

    switch (input) {
      case 'move_left':
        return { ...this.tryMove(player, state, 0, -1), winner: this.winner };
      case 'move_right':
        return { ...this.tryMove(player, state, 0, 1), winner: this.winner };
      case 'rotate_cw':
        return { ...this.tryRotate(player, state, 1), winner: this.winner };
      case 'rotate_ccw':
        return { ...this.tryRotate(player, state, -1), winner: this.winner };
      case 'soft_drop':
        return this.softDrop(player);
      case 'hard_drop':
        return this.hardDrop(player);
      default:
        return { changed: false, clearedRows: [], winner: this.winner };
    }
  }

  tick(): { changed: boolean; clearEvents: Array<{ player: DefenseLinePlayer; rows: number[] }>; winner: DefenseLinePlayer | null } {
    if (this.status !== 'playing' || this.winner) {
      return { changed: false, clearEvents: [], winner: this.winner };
    }

    const clearEvents: Array<{ player: DefenseLinePlayer; rows: number[] }> = [];
    let changed = false;

    for (const player of ['a', 'b'] as const) {
      const tickResult = this.softDrop(player);
      if (tickResult.changed) {
        changed = true;
      }
      if (tickResult.clearedRows.length > 0) {
        clearEvents.push({ player, rows: tickResult.clearedRows });
      }
      if (tickResult.winner) {
        break;
      }
    }

    return { changed, clearEvents, winner: this.winner };
  }

  getPublicState(): DefenseLinePublicState {
    return {
      board: this.board.map((row) => [...row]),
      activeRows: Array.from(this.activeRows).sort((a, b) => a - b),
      playerA: {
        activePiece: this.playerA.activePiece ? { ...this.playerA.activePiece } : null,
        nextPiece: this.playerA.nextPiece,
        rowsCleared: this.playerA.rowsCleared,
        queue: [...this.playerA.queue],
      },
      playerB: {
        activePiece: this.playerB.activePiece ? { ...this.playerB.activePiece } : null,
        nextPiece: this.playerB.nextPiece,
        rowsCleared: this.playerB.rowsCleared,
        queue: [...this.playerB.queue],
      },
      status: this.status,
      winner: this.winner,
    };
  }

  private createPlayerState(): DefenseLinePlayerState {
    const queue: TetrominoType[] = [];
    this.refillQueue(queue);
    const nextPiece = queue.shift();
    if (!nextPiece) {
      throw new Error('Failed to initialize piece queue');
    }

    return {
      activePiece: null,
      nextPiece,
      rowsCleared: 0,
      queue,
    };
  }

  private softDrop(player: DefenseLinePlayer): InputResult {
    const state = this.getPlayerState(player);
    const piece = state.activePiece;
    if (!piece) {
      return { changed: false, clearedRows: [], winner: this.winner };
    }

    const step = player === 'a' ? 1 : -1;
    const candidate = { ...piece, row: piece.row + step };

    if (this.canPlacePiece(player, candidate)) {
      state.activePiece = candidate;
      return { changed: true, clearedRows: [], winner: this.winner };
    }

    this.lockPiece(player, piece);
    const resolution = this.resolveAfterLock(player);
    state.activePiece = this.createSpawnPiece(player, state.nextPiece);
    state.nextPiece = this.drawNextPiece(state);

    return {
      changed: true,
      clearedRows: resolution.clearedRows,
      winner: resolution.winner,
    };
  }

  private hardDrop(player: DefenseLinePlayer): InputResult {
    const state = this.getPlayerState(player);
    const piece = state.activePiece;
    if (!piece) {
      return { changed: false, clearedRows: [], winner: this.winner };
    }

    const step = player === 'a' ? 1 : -1;
    let dropped = { ...piece };

    while (true) {
      const candidate = { ...dropped, row: dropped.row + step };
      if (!this.canPlacePiece(player, candidate)) {
        break;
      }
      dropped = candidate;
    }

    this.lockPiece(player, dropped);
    const resolution = this.resolveAfterLock(player);
    state.activePiece = this.createSpawnPiece(player, state.nextPiece);
    state.nextPiece = this.drawNextPiece(state);

    return {
      changed: true,
      clearedRows: resolution.clearedRows,
      winner: resolution.winner,
    };
  }

  private tryMove(player: DefenseLinePlayer, state: DefenseLinePlayerState, deltaRow: number, deltaCol: number): { changed: boolean; clearedRows: number[] } {
    if (!state.activePiece) {
      return { changed: false, clearedRows: [] };
    }

    const candidate = {
      ...state.activePiece,
      row: state.activePiece.row + deltaRow,
      col: state.activePiece.col + deltaCol,
    };

    if (!this.canPlacePiece(player, candidate)) {
      return { changed: false, clearedRows: [] };
    }

    state.activePiece = candidate;
    return { changed: true, clearedRows: [] };
  }

  private tryRotate(player: DefenseLinePlayer, state: DefenseLinePlayerState, delta: number): { changed: boolean; clearedRows: number[] } {
    if (!state.activePiece) {
      return { changed: false, clearedRows: [] };
    }

    const rotations = TETROMINO_SHAPES[state.activePiece.type].length;
    const candidate = {
      ...state.activePiece,
      rotation: (state.activePiece.rotation + delta + rotations) % rotations,
    };

    if (this.canPlacePiece(player, candidate)) {
      state.activePiece = candidate;
      return { changed: true, clearedRows: [] };
    }

    for (const kick of [-1, 1, -2, 2]) {
      const kicked = { ...candidate, col: candidate.col + kick };
      if (this.canPlacePiece(player, kicked)) {
        state.activePiece = kicked;
        return { changed: true, clearedRows: [] };
      }
    }

    return { changed: false, clearedRows: [] };
  }

  private resolveAfterLock(player: DefenseLinePlayer): ResolutionResult {
    const clearableRows = this.getClearableRows(player);
    if (clearableRows.length === 0) {
      return { clearedRows: [], winner: this.winner };
    }

    for (const row of clearableRows) {
      for (let col = 0; col < BOARD_COLS; col++) {
        // Reset to background ('0' or 'x')
        this.board[row][col] = row < 15 ? '0' : 'x';
      }
      this.activeRows.delete(row);
    }

    this.applyPostClearGravity(player);
    this.rebuildActiveRows();

    const state = this.getPlayerState(player);
    state.rowsCleared += clearableRows.length;

    if (state.rowsCleared >= CLEAR_TARGET) {
      this.status = 'finished';
      this.winner = player;
    }

    return {
      clearedRows: clearableRows,
      winner: this.winner,
    };
  }

  private applyPostClearGravity(player: DefenseLinePlayer): void {
    let changed = false;

    do {
      changed = false;

      if (player === 'a') {
        // Only apply gravity to A's pieces (falling down)
        for (let row = BOARD_ROWS - 2; row >= 0; row--) {
          for (let col = 0; col < BOARD_COLS; col++) {
            if (this.board[row][col] !== 'a') {
              continue;
            }

            const targetRow = row + 1;
            if (targetRow >= BOARD_ROWS) {
              continue;
            }

            if (this.isSolidForPlayer('a', targetRow, col)) {
              continue;
            }

            this.board[targetRow][col] = 'a';
            this.board[row][col] = row < 15 ? '0' : 'x'; // Reset to background
            changed = true;
          }
        }
      } else {
        // Only apply gravity to B's pieces (rising up)
        for (let row = 1; row < BOARD_ROWS; row++) {
          for (let col = 0; col < BOARD_COLS; col++) {
            if (this.board[row][col] !== 'b') {
              continue;
            }

            const targetRow = row - 1;
            if (targetRow < 0) {
              continue;
            }

            if (this.isSolidForPlayer('b', targetRow, col)) {
              continue;
            }

            this.board[targetRow][col] = 'b';
            this.board[row][col] = row < 15 ? '0' : 'x'; // Reset to background
            changed = true;
          }
        }
      }
    } while (changed);
  }

  private lockPiece(player: DefenseLinePlayer, piece: DefenseLinePiece): void {
    const cells = this.getPieceCells(piece);
    for (const [row, col] of cells) {
      if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
        continue;
      }
      this.board[row][col] = player;
      this.activeRows.add(row);
    }
  }

  private getClearableRows(player: DefenseLinePlayer): number[] {
    const rows = Array.from(this.activeRows).sort((a, b) => a - b);

    return rows.filter((row) => {
      for (let col = 0; col < BOARD_COLS; col++) {
        const cell = this.board[row][col];

        if (player === 'a') {
          // For A: row is filled if all cells are 'a' or 'x'
          if (cell === 'a' || cell === 'x') continue;
          return false; // any 'b' or '0' = not filled
        } else {
          // For B: row is filled if all cells are 'b' or '0'
          if (cell === 'b' || cell === '0') continue;
          return false; // any 'a' or 'x' = not filled
        }
      }
      return true;
    });
  }

  private canPlacePiece(player: DefenseLinePlayer, piece: DefenseLinePiece): boolean {
    const cells = this.getPieceCells(piece);

    for (const [row, col] of cells) {
      if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
        return false;
      }
      if (this.isSolidForPlayer(player, row, col)) {
        return false;
      }
    }

    return true;
  }

  private isSolidForPlayer(player: DefenseLinePlayer, row: number, col: number): boolean {
    const cell = this.board[row][col];

    if (player === 'a') {
      // For A: 'a' and 'x' are solid (filled)
      return cell === 'a' || cell === 'x';
    } else {
      // For B: 'b' and '0' are solid (filled)
      return cell === 'b' || cell === '0';
    }
  }

  private getPieceCells(piece: DefenseLinePiece): Array<[number, number]> {
    const shapes = TETROMINO_SHAPES[piece.type];
    const rotation = ((piece.rotation % shapes.length) + shapes.length) % shapes.length;
    const shape = shapes[rotation];
    const cells: Array<[number, number]> = [];

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] === 1) {
          cells.push([piece.row + r, piece.col + c]);
        }
      }
    }

    return cells;
  }

  private createSpawnPiece(player: DefenseLinePlayer, type: TetrominoType): DefenseLinePiece {
    const shape = TETROMINO_SHAPES[type][0];
    const spawnCol = Math.floor((BOARD_COLS - shape[0].length) / 2);
    const spawnRow = player === 'a' ? 0 : BOARD_ROWS - shape.length;

    return {
      type,
      rotation: 0,
      row: spawnRow,
      col: spawnCol,
    };
  }

  private drawNextPiece(state: DefenseLinePlayerState): TetrominoType {
    if (state.queue.length < TETROMINO_TYPES.length) {
      this.refillQueue(state.queue);
    }

    const next = state.queue.shift();
    if (!next) {
      throw new Error('Piece queue underflow');
    }

    return next;
  }

  private refillQueue(queue: TetrominoType[]): void {
    const bag = [...TETROMINO_TYPES];

    for (let i = bag.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(i + 1);
      const temp = bag[i];
      bag[i] = bag[j];
      bag[j] = temp;
    }

    queue.push(...bag);
  }

  private rebuildActiveRows(): void {
    this.activeRows.clear();
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const cell = this.board[row][col];
        // Row is active if it has any 'a' or 'b' piece
        if (cell === 'a' || cell === 'b') {
          this.activeRows.add(row);
          break;
        }
      }
    }
  }

  private getPlayerState(player: DefenseLinePlayer): DefenseLinePlayerState {
    return player === 'a' ? this.playerA : this.playerB;
  }
}
