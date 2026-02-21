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

export interface DefenseLineClearSegment {
  row: number;
  startCol: number;
  endCol: number;
}

export interface DefenseLineClearCell {
  row: number;
  col: number;
}

interface ResolutionResult {
  clearedRows: number[];
  clearedSegments: DefenseLineClearSegment[];
  clearedCells: DefenseLineClearCell[];
  winner: DefenseLinePlayer | null;
}

interface InputResult extends ResolutionResult {
  changed: boolean;
}

export const DEFENSE_BOARD_ROWS = 20;
export const DEFENSE_BOARD_COLS = 10;
// Backward-compatible aliases (kept to avoid breaking older imports).
export const DEFENSE_DEFENSE_BOARD_ROWS = DEFENSE_BOARD_ROWS;
export const DEFENSE_DEFENSE_BOARD_COLS = DEFENSE_BOARD_COLS;
const DIVIDER_ROW = 10; // rows 0-9 = '0' zone, rows 10-19 = 'x' zone
export const MIN_CONTIGUOUS_FOR_CLEAR = 5; // 5+ contiguous filled cells clears that segment

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
    // Initialize board: rows 0-9 = '0', rows 10-19 = 'x'
    this.board = Array.from({ length: DEFENSE_BOARD_ROWS }, (_, row) =>
      Array.from({ length: DEFENSE_BOARD_COLS }, () => (row < DIVIDER_ROW ? '0' : 'x'))
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
      if (!this.canPlacePiece('a', this.playerA.activePiece)) {
        this.playerA.activePiece = null;
        this.winner = 'b';
        this.status = 'finished';
        return;
      }
      this.playerA.nextPiece = this.drawNextPiece(this.playerA);
    }
    if (!this.playerB.activePiece) {
      this.playerB.activePiece = this.createSpawnPiece('b', this.playerB.nextPiece);
      if (!this.canPlacePiece('b', this.playerB.activePiece)) {
        this.playerB.activePiece = null;
        this.winner = 'a';
        this.status = 'finished';
        return;
      }
      this.playerB.nextPiece = this.drawNextPiece(this.playerB);
    }
  }

  processInput(player: DefenseLinePlayer, input: 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop'): InputResult {
    if (this.status !== 'playing' || this.winner) {
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
    }

    const state = this.getPlayerState(player);
    if (!state.activePiece) {
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
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
        return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
    }
  }

  tick(): { changed: boolean; clearEvents: Array<{ player: DefenseLinePlayer; rows: number[]; segments: DefenseLineClearSegment[]; cells: DefenseLineClearCell[] }>; winner: DefenseLinePlayer | null } {
    if (this.status !== 'playing' || this.winner) {
      return { changed: false, clearEvents: [], winner: this.winner };
    }

    const clearEvents: Array<{ player: DefenseLinePlayer; rows: number[]; segments: DefenseLineClearSegment[]; cells: DefenseLineClearCell[] }> = [];
    let changed = false;

    for (const player of ['a', 'b'] as const) {
      const tickResult = this.softDrop(player);
      if (tickResult.changed) {
        changed = true;
      }
      if (tickResult.clearedRows.length > 0) {
        clearEvents.push({
          player,
          rows: tickResult.clearedRows,
          segments: tickResult.clearedSegments,
          cells: tickResult.clearedCells,
        });
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
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
    }

    const step = player === 'a' ? 1 : -1;
    const candidate = { ...piece, row: piece.row + step };

    if (this.canPlacePiece(player, candidate)) {
      state.activePiece = candidate;
      return { changed: true, clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
    }

    this.lockPiece(player, piece);
    const resolution = this.resolveAfterLock(player);
    if (!resolution.winner) {
      this.spawnNextPiece(player, state);
    }

    return {
      changed: true,
      clearedRows: resolution.clearedRows,
      clearedSegments: resolution.clearedSegments,
      clearedCells: resolution.clearedCells,
      winner: this.winner,
    };
  }

  private hardDrop(player: DefenseLinePlayer): InputResult {
    const state = this.getPlayerState(player);
    const piece = state.activePiece;
    if (!piece) {
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
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
    if (!resolution.winner) {
      this.spawnNextPiece(player, state);
    }

    return {
      changed: true,
      clearedRows: resolution.clearedRows,
      clearedSegments: resolution.clearedSegments,
      clearedCells: resolution.clearedCells,
      winner: this.winner,
    };
  }

  private tryMove(player: DefenseLinePlayer, state: DefenseLinePlayerState, deltaRow: number, deltaCol: number): { changed: boolean; clearedRows: number[]; clearedSegments: DefenseLineClearSegment[]; clearedCells: DefenseLineClearCell[] } {
    if (!state.activePiece) {
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [] };
    }

    const candidate = {
      ...state.activePiece,
      row: state.activePiece.row + deltaRow,
      col: state.activePiece.col + deltaCol,
    };

    if (!this.canPlacePiece(player, candidate)) {
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [] };
    }

    state.activePiece = candidate;
    return { changed: true, clearedRows: [], clearedSegments: [], clearedCells: [] };
  }

  private tryRotate(player: DefenseLinePlayer, state: DefenseLinePlayerState, delta: number): { changed: boolean; clearedRows: number[]; clearedSegments: DefenseLineClearSegment[]; clearedCells: DefenseLineClearCell[] } {
    if (!state.activePiece) {
      return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [] };
    }

    const rotations = TETROMINO_SHAPES[state.activePiece.type].length;
    const candidate = {
      ...state.activePiece,
      rotation: (state.activePiece.rotation + delta + rotations) % rotations,
    };

    if (this.canPlacePiece(player, candidate)) {
      state.activePiece = candidate;
      return { changed: true, clearedRows: [], clearedSegments: [], clearedCells: [] };
    }

    for (const kick of [-1, 1, -2, 2]) {
      const kicked = { ...candidate, col: candidate.col + kick };
      if (this.canPlacePiece(player, kicked)) {
        state.activePiece = kicked;
        return { changed: true, clearedRows: [], clearedSegments: [], clearedCells: [] };
      }
    }

    return { changed: false, clearedRows: [], clearedSegments: [], clearedCells: [] };
  }

  private resolveAfterLock(player: DefenseLinePlayer): ResolutionResult {
    const clearableSegments = this.getClearableSegments(player);
    if (clearableSegments.length === 0) {
      return { clearedRows: [], clearedSegments: [], clearedCells: [], winner: this.winner };
    }

    // Apply segment clears per-column so only the cleared segment columns shift.
    const clearedRowsByColumn = new Map<number, Set<number>>();
    for (const segment of clearableSegments) {
      for (let col = segment.startCol; col <= segment.endCol; col++) {
        let rows = clearedRowsByColumn.get(col);
        if (!rows) {
          rows = new Set<number>();
          clearedRowsByColumn.set(col, rows);
        }
        rows.add(segment.row);
      }
    }

    for (const [col, clearedRows] of clearedRowsByColumn.entries()) {
      if (clearedRows.size === 0) continue;

      const survivors: DefenseLineCell[] = [];
      for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
        if (!clearedRows.has(row)) {
          survivors.push(this.board[row][col]);
        }
      }

      const clearedCount = clearedRows.size;
      const fillerCell: DefenseLineCell = player === 'a' ? '0' : 'x';
      const nextColumn: DefenseLineCell[] = player === 'a'
        ? [...Array.from({ length: clearedCount }, () => fillerCell), ...survivors]
        : [...survivors, ...Array.from({ length: clearedCount }, () => fillerCell)];

      for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
        this.board[row][col] = nextColumn[row];
      }
    }

    this.rebuildActiveRows();

    const state = this.getPlayerState(player);
    state.rowsCleared += clearableSegments.length;

    const clearedRows = Array.from(new Set(clearableSegments.map((segment) => segment.row))).sort((a, b) => a - b);
    const clearedCells: DefenseLineClearCell[] = [];
    for (const segment of clearableSegments) {
      for (let col = segment.startCol; col <= segment.endCol; col++) {
        clearedCells.push({ row: segment.row, col });
      }
    }

    return {
      clearedRows,
      clearedSegments: clearableSegments,
      clearedCells,
      winner: this.winner,
    };
  }

  private lockPiece(player: DefenseLinePlayer, piece: DefenseLinePiece): void {
    const cells = this.getPieceCells(piece);
    for (const [row, col] of cells) {
      if (row < 0 || row >= DEFENSE_BOARD_ROWS || col < 0 || col >= DEFENSE_BOARD_COLS) {
        continue;
      }
      this.board[row][col] = player;
      this.activeRows.add(row);
    }
  }

  /**
   * A segment is clearable if it has at least MIN_CONTIGUOUS_FOR_CLEAR contiguous
   * "filled" cells for the given player. The row must also contain at least one
   * placed piece for that player ('a' for A, 'b' for B) — pure background rows don't clear.
   */
  private getClearableSegments(player: DefenseLinePlayer): DefenseLineClearSegment[] {
    const rows = Array.from(this.activeRows).sort((a, b) => a - b);
    const segments: DefenseLineClearSegment[] = [];

    for (const row of rows) {
      const hasPlayerPiece = this.board[row].some((cell) => cell === player);
      if (!hasPlayerPiece) {
        continue;
      }

      let runStart: number | null = null;

      for (let col = 0; col <= DEFENSE_BOARD_COLS; col++) {
        const inBounds = col < DEFENSE_BOARD_COLS;
        const cell = inBounds ? this.board[row][col] : null;

        const filled = inBounds
          ? player === 'a'
            ? (cell === 'a' || cell === 'x')
            : (cell === 'b' || cell === '0')
          : false;

        if (filled) {
          if (runStart === null) {
            runStart = col;
          }
          continue;
        }

        if (runStart === null) {
          continue;
        }

        const runEnd = col - 1;
        if (hasPlayerPiece && runEnd - runStart + 1 >= MIN_CONTIGUOUS_FOR_CLEAR) {
          segments.push({ row, startCol: runStart, endCol: runEnd });
        }
        runStart = null;
      }
    }

    return segments;
  }

  private canPlacePiece(player: DefenseLinePlayer, piece: DefenseLinePiece): boolean {
    const cells = this.getPieceCells(piece);

    for (const [row, col] of cells) {
      if (col < 0 || col >= DEFENSE_BOARD_COLS || row < 0 || row >= DEFENSE_BOARD_ROWS) {
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
    const spawnCol = Math.floor((DEFENSE_BOARD_COLS - shape[0].length) / 2);
    const spawnRow = player === 'a' ? 0 : DEFENSE_BOARD_ROWS - shape.length;

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
    for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
      for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
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

  private spawnNextPiece(player: DefenseLinePlayer, state: DefenseLinePlayerState): void {
    const spawnPiece = this.createSpawnPiece(player, state.nextPiece);
    if (!this.canPlacePiece(player, spawnPiece)) {
      state.activePiece = null;
      this.winner = this.getOpponent(player);
      this.status = 'finished';
      return;
    }

    state.activePiece = spawnPiece;
    state.nextPiece = this.drawNextPiece(state);
  }

  private getOpponent(player: DefenseLinePlayer): DefenseLinePlayer {
    return player === 'a' ? 'b' : 'a';
  }
}
