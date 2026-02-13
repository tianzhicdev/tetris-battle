import type { Board, Tetromino } from '@tetris-battle/game-core';
import type { Theme } from '../themes';
import { DEFAULT_THEME } from '../themes';

export interface RenderOptions {
  theme?: Theme;
  showGrid?: boolean;
  showGhost?: boolean;
  blindSpotRows?: number; // Number of bottom rows to hide (for blind_spot ability)
}

export class TetrisRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private blockSize: number;
  private theme: Theme;

  constructor(canvas: HTMLCanvasElement, blockSize: number = 30, theme?: Theme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.blockSize = blockSize;
    this.theme = theme || DEFAULT_THEME;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  setBlockSize(size: number): void {
    this.blockSize = size;
  }

  clear(): void {
    this.ctx.fillStyle = this.theme.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid(board: Board): void {
    this.ctx.strokeStyle = this.theme.gridColor;
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= board.width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.blockSize, 0);
      this.ctx.lineTo(x * this.blockSize, board.height * this.blockSize);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= board.height; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.blockSize);
      this.ctx.lineTo(board.width * this.blockSize, y * this.blockSize);
      this.ctx.stroke();
    }
  }

  drawBoard(board: Board, blindSpotRows: number = 0): void {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.grid[y][x];
        if (cell) {
          // Check if this row should be hidden (blind spot effect)
          const isBlindSpot = blindSpotRows > 0 && y >= board.height - blindSpotRows;

          if (isBlindSpot) {
            // Draw fog/darkness for blind spot
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.ctx.fillRect(
              x * this.blockSize,
              y * this.blockSize,
              this.blockSize,
              this.blockSize
            );
          } else {
            this.theme.renderBlock(
              this.ctx,
              x * this.blockSize,
              y * this.blockSize,
              this.blockSize,
              cell
            );
          }
        }
      }
    }
  }

  drawPiece(piece: Tetromino, ghost: boolean = false): void {
    const alpha = ghost ? 0.3 : 1.0;
    this.ctx.globalAlpha = alpha;

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardX = piece.position.x + x;
          const boardY = piece.position.y + y;

          if (boardY >= 0) {
            if (ghost) {
              // Ghost piece - just draw outline
              this.ctx.strokeStyle = this.theme.colors[piece.type];
              this.ctx.lineWidth = 2;
              this.ctx.strokeRect(
                boardX * this.blockSize + 2,
                boardY * this.blockSize + 2,
                this.blockSize - 4,
                this.blockSize - 4
              );
            } else {
              this.theme.renderBlock(
                this.ctx,
                boardX * this.blockSize,
                boardY * this.blockSize,
                this.blockSize,
                piece.type
              );
            }
          }
        }
      }
    }

    this.ctx.globalAlpha = 1.0;
  }

  drawNextPiece(piece: Tetromino, x: number, y: number): void {
    const originalBlockSize = this.blockSize;
    this.blockSize = Math.floor(originalBlockSize * 0.75);

    for (let py = 0; py < piece.shape.length; py++) {
      for (let px = 0; px < piece.shape[py].length; px++) {
        if (piece.shape[py][px]) {
          this.theme.renderBlock(
            this.ctx,
            x + px * this.blockSize,
            y + py * this.blockSize,
            this.blockSize,
            piece.type
          );
        }
      }
    }

    this.blockSize = originalBlockSize;
  }

  render(
    board: Board,
    currentPiece: Tetromino | null,
    ghostPiece: Tetromino | null,
    options: RenderOptions = {}
  ): void {
    const { showGrid = true, showGhost = true, blindSpotRows = 0 } = options;

    // Clear canvas
    this.clear();

    // Draw grid
    if (showGrid) {
      this.drawGrid(board);
    }

    // Draw locked blocks
    this.drawBoard(board, blindSpotRows);

    // Draw ghost piece (preview of where piece will land)
    if (showGhost && ghostPiece) {
      this.drawPiece(ghostPiece, true);
    }

    // Draw current piece
    if (currentPiece) {
      this.drawPiece(currentPiece, false);
    }
  }
}
