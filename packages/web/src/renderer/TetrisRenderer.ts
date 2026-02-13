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

  drawPiece(piece: Tetromino, ghost: boolean = false, isBomb: boolean = false): void {
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
              this.ctx.strokeStyle = isBomb ? '#ff4444' : this.theme.colors[piece.type];
              this.ctx.lineWidth = 2;
              this.ctx.strokeRect(
                boardX * this.blockSize + 2,
                boardY * this.blockSize + 2,
                this.blockSize - 4,
                this.blockSize - 4
              );
            } else {
              if (isBomb) {
                // Draw bomb piece with pulsing red/orange effect
                const px = boardX * this.blockSize;
                const py = boardY * this.blockSize;
                const time = Date.now() / 200;
                const pulse = Math.sin(time) * 0.3 + 0.7;

                // Red/orange gradient
                const gradient = this.ctx.createRadialGradient(
                  px + this.blockSize / 2,
                  py + this.blockSize / 2,
                  0,
                  px + this.blockSize / 2,
                  py + this.blockSize / 2,
                  this.blockSize / 2
                );
                gradient.addColorStop(0, `rgba(255, 100, 0, ${pulse})`);
                gradient.addColorStop(1, `rgba(200, 0, 0, ${pulse})`);

                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(px, py, this.blockSize, this.blockSize);

                // Draw bomb icon (💣)
                this.ctx.fillStyle = '#000';
                this.ctx.font = `${this.blockSize * 0.6}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('💣', px + this.blockSize / 2, py + this.blockSize / 2);
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

  drawExplosion(x: number, y: number, radius: number, progress: number): void {
    // Draw fire/explosion effect
    const centerX = x * this.blockSize + this.blockSize / 2;
    const centerY = y * this.blockSize + this.blockSize / 2;
    const explosionRadius = radius * this.blockSize * progress;

    // Outer fire ring
    const gradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, explosionRadius
    );
    gradient.addColorStop(0, `rgba(255, 255, 100, ${1 - progress})`);
    gradient.addColorStop(0.3, `rgba(255, 100, 0, ${0.8 - progress * 0.8})`);
    gradient.addColorStop(0.6, `rgba(255, 50, 0, ${0.5 - progress * 0.5})`);
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, explosionRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  render(
    board: Board,
    currentPiece: Tetromino | null,
    ghostPiece: Tetromino | null,
    options: RenderOptions & { isBomb?: boolean } = {}
  ): void {
    const { showGrid = true, showGhost = true, blindSpotRows = 0, isBomb = false } = options;

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
      this.drawPiece(ghostPiece, true, isBomb);
    }

    // Draw current piece
    if (currentPiece) {
      this.drawPiece(currentPiece, false, isBomb);
    }
  }
}
