import {
  TETROMINO_SHAPES,
  type TetrominoType,
} from '@tetris-battle/game-core';
import {
  DEFENSE_BOARD_ROWS,
  DEFENSE_BOARD_COLS,
  MIN_CONTIGUOUS_FOR_CLEAR,
  type DefenseLinePlayer,
  type DefenseLineCell,
  type DefenseLinePiece,
} from './DefenseLineGameState';

interface AIPlacement {
  rotation: number;
  col: number;
  score: number;
}

/**
 * Simple AI for Defense Line mode.
 * Evaluates all possible placements and picks the best one
 * (with occasional intentional mistakes for balance).
 */
export class DefenseLineAI {
  private mistakeRate = 0.30; // 30% mistake rate

  /**
   * Decide which input to emit next for the AI player.
   * Returns a sequence of normalized inputs to reach the target placement.
   * If useHold is true, the AI should hold first, then place the resulting piece.
   */
  findBestPlacement(
    board: DefenseLineCell[][],
    player: DefenseLinePlayer,
    piece: DefenseLinePiece,
    holdPiece?: TetrominoType | null,
    holdUsed?: boolean,
  ): { targetRotation: number; targetCol: number; useHold: boolean } {
    const shouldMistake = Math.random() < this.mistakeRate;

    const currentPlacements = this.getAllPlacements(board, player, piece);
    const bestCurrent = this.pickPlacement(currentPlacements, shouldMistake);

    // Evaluate hold option if available and not already used this piece
    if (!holdUsed && holdPiece) {
      const holdShape = TETROMINO_SHAPES[holdPiece][0];
      const holdSpawnPiece: DefenseLinePiece = {
        type: holdPiece,
        rotation: 0,
        row: piece.row,
        col: Math.floor((DEFENSE_BOARD_COLS - holdShape[0].length) / 2),
      };
      const holdPlacements = this.getAllPlacements(board, player, holdSpawnPiece);
      const bestHold = this.pickPlacement(holdPlacements, shouldMistake);

      if (bestHold && (!bestCurrent || bestHold.score > bestCurrent.score + 15)) {
        return { targetRotation: bestHold.rotation, targetCol: bestHold.col, useHold: true };
      }
    }

    if (!bestCurrent) {
      return { targetRotation: piece.rotation, targetCol: piece.col, useHold: false };
    }

    return { targetRotation: bestCurrent.rotation, targetCol: bestCurrent.col, useHold: false };
  }

  private pickPlacement(placements: AIPlacement[], shouldMistake: boolean): AIPlacement | null {
    if (placements.length === 0) return null;

    placements.sort((a, b) => b.score - a.score);

    if (shouldMistake && placements.length > 1) {
      const bottomHalf = placements.slice(Math.floor(placements.length / 2));
      return bottomHalf[Math.floor(Math.random() * bottomHalf.length)];
    }

    if (placements.length >= 2 && Math.random() < 0.3) {
      return placements[1];
    }

    return placements[0];
  }

  private getAllPlacements(
    board: DefenseLineCell[][],
    player: DefenseLinePlayer,
    piece: DefenseLinePiece,
  ): AIPlacement[] {
    const placements: AIPlacement[] = [];
    const shapes = TETROMINO_SHAPES[piece.type];

    for (let rotation = 0; rotation < shapes.length; rotation++) {
      const shape = shapes[rotation];
      const shapeWidth = shape[0].length;

      for (let col = -(shapeWidth - 1); col < DEFENSE_BOARD_COLS; col++) {
        // Check if this rotation+col is valid at spawn row
        const testPiece: DefenseLinePiece = {
          type: piece.type,
          rotation,
          row: piece.row,
          col,
        };

        if (!this.canPlace(board, player, testPiece)) {
          continue;
        }

        // Hard drop: find where piece lands
        const landed = this.hardDropPiece(board, player, testPiece);
        if (!landed) continue;

        // Simulate locking and evaluate
        const score = this.evaluatePlacement(board, player, landed);
        placements.push({ rotation, col, score });
      }
    }

    return placements;
  }

  private hardDropPiece(
    board: DefenseLineCell[][],
    player: DefenseLinePlayer,
    piece: DefenseLinePiece,
  ): DefenseLinePiece | null {
    const step = player === 'a' ? 1 : -1;
    let current = { ...piece };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = { ...current, row: current.row + step };
      if (!this.canPlace(board, player, next)) {
        break;
      }
      current = next;
    }

    return current;
  }

  private evaluatePlacement(
    board: DefenseLineCell[][],
    player: DefenseLinePlayer,
    piece: DefenseLinePiece,
  ): number {
    // Simulate locking the piece on a copy of the board
    const boardCopy = board.map(row => [...row]);
    const cells = this.getPieceCells(piece);

    for (const [row, col] of cells) {
      if (row >= 0 && row < DEFENSE_BOARD_ROWS && col >= 0 && col < DEFENSE_BOARD_COLS) {
        boardCopy[row][col] = player;
      }
    }

    let score = 0;

    // 1. Count clearable rows (highest priority)
    const clearableCount = this.countClearableRows(boardCopy, player);
    score += clearableCount * 100;

    // 2. Penalize height (how far from spawn side)
    // For A (spawns at top, drops down): lower rows are riskier
    // For B (spawns at bottom, drops up): higher rows are riskier
    const pieceCenterRow = cells.reduce((sum, [r]) => sum + r, 0) / cells.length;
    if (player === 'a') {
      // A wants to place deeper into board (toward higher row index)
      score += pieceCenterRow * 2;
    } else {
      // B wants to place closer to row 0
      score += (DEFENSE_BOARD_ROWS - 1 - pieceCenterRow) * 2;
    }

    // 3. Penalize holes (empty passable cells with solid above/below)
    const holes = this.countHoles(boardCopy, player);
    score -= holes * 15;

    // 4. Reward filling columns evenly (low bumpiness)
    const bumpiness = this.getBumpiness(boardCopy, player);
    score -= bumpiness * 3;

    // 5. Penalize blocking own side near spawn
    if (player === 'a') {
      for (const [row] of cells) {
        if (row < 3) score -= 20; // Don't stack near spawn
      }
    } else {
      for (const [row] of cells) {
        if (row > DEFENSE_BOARD_ROWS - 4) score -= 20;
      }
    }

    return score;
  }

  private countClearableRows(board: DefenseLineCell[][], player: DefenseLinePlayer): number {
    let count = 0;
    for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
      let maxRun = 0;
      let currentRun = 0;
      let hasPlayerPiece = false;

      for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
        const cell = board[row][col];

        if (cell === player) hasPlayerPiece = true;

        const filled = player === 'a'
          ? (cell === 'a' || cell === 'x')
          : (cell === 'b' || cell === '0');

        if (filled) {
          currentRun++;
          if (currentRun > maxRun) maxRun = currentRun;
        } else {
          currentRun = 0;
        }
      }

      if (hasPlayerPiece && maxRun >= MIN_CONTIGUOUS_FOR_CLEAR) {
        count++;
      }
    }
    return count;
  }

  private countHoles(board: DefenseLineCell[][], player: DefenseLinePlayer): number {
    let holes = 0;

    if (player === 'a') {
      // A drops downward: scan from top, count empty-for-A cells below solid-for-A cells
      for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
        let solidFound = false;
        for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
          const cell = board[row][col];
          const isSolid = cell === 'a' || cell === 'x';
          if (isSolid) {
            solidFound = true;
          } else if (solidFound) {
            holes++;
          }
        }
      }
    } else {
      // B drops upward: scan from bottom
      for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
        let solidFound = false;
        for (let row = DEFENSE_BOARD_ROWS - 1; row >= 0; row--) {
          const cell = board[row][col];
          const isSolid = cell === 'b' || cell === '0';
          if (isSolid) {
            solidFound = true;
          } else if (solidFound) {
            holes++;
          }
        }
      }
    }

    return holes;
  }

  private getBumpiness(board: DefenseLineCell[][], player: DefenseLinePlayer): number {
    const heights: number[] = [];

    for (let col = 0; col < DEFENSE_BOARD_COLS; col++) {
      let height = 0;

      if (player === 'a') {
        // Height from top: first solid-for-A cell
        for (let row = 0; row < DEFENSE_BOARD_ROWS; row++) {
          const cell = board[row][col];
          if (cell === 'a') {
            height = DEFENSE_BOARD_ROWS - row;
            break;
          }
        }
      } else {
        // Height from bottom: first solid-for-B cell
        for (let row = DEFENSE_BOARD_ROWS - 1; row >= 0; row--) {
          const cell = board[row][col];
          if (cell === 'b') {
            height = row + 1;
            break;
          }
        }
      }

      heights.push(height);
    }

    let bumpiness = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }

    return bumpiness;
  }

  private canPlace(
    board: DefenseLineCell[][],
    player: DefenseLinePlayer,
    piece: DefenseLinePiece,
  ): boolean {
    const cells = this.getPieceCells(piece);

    for (const [row, col] of cells) {
      if (col < 0 || col >= DEFENSE_BOARD_COLS || row < 0 || row >= DEFENSE_BOARD_ROWS) {
        return false;
      }
      const cell = board[row][col];
      if (player === 'a') {
        if (cell === 'a' || cell === 'x') return false;
      } else {
        if (cell === 'b' || cell === '0') return false;
      }
    }

    return true;
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
}
