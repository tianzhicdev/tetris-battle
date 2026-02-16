import type { Board, Tetromino } from '@tetris-battle/game-core';
import type { Theme } from '../themes';
import { DEFAULT_THEME } from '../themes';
import { BlockAnimationManager } from './BlockAnimationManager';

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
  public animationManager: BlockAnimationManager;

  constructor(canvas: HTMLCanvasElement, blockSize: number = 30, theme?: Theme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.blockSize = blockSize;
    this.theme = theme || DEFAULT_THEME;
    this.animationManager = new BlockAnimationManager();
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

  drawBoard(board: Board): void {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.grid[y][x];
        if (cell) {
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

  drawAnimations(): void {
    const activeAnimations = this.animationManager.getActiveAnimations();

    activeAnimations.forEach(anim => {
      const progress = this.animationManager.getAnimationProgress(anim);
      const px = anim.x * this.blockSize;
      const py = anim.y * this.blockSize;

      this.ctx.save();

      switch (anim.type) {
        case 'fade-out':
        case 'fade-in':
        case 'flash': {
          const alpha = this.animationManager.getFadeAlpha(anim, progress);
          this.ctx.globalAlpha = alpha;

          // Draw colored overlay
          const color = anim.color || '#ffffff';
          this.ctx.fillStyle = color;
          this.ctx.fillRect(px, py, this.blockSize, this.blockSize);
          break;
        }

        case 'explode': {
          const scale = this.animationManager.getExplosionScale(progress);
          const alpha = 1 - progress; // Fade out as it expands

          this.ctx.globalAlpha = alpha;
          this.ctx.fillStyle = anim.color || '#ff4444';

          // Draw expanding circle
          const centerX = px + this.blockSize / 2;
          const centerY = py + this.blockSize / 2;
          const radius = (this.blockSize / 2) * scale;

          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        }

        case 'burn': {
          // Realistic burning fire effect
          const centerX = px + this.blockSize / 2;
          const centerY = py + this.blockSize / 2;

          // Flickering intensity (random flicker)
          const flicker = 0.7 + Math.random() * 0.3;
          const alpha = (1 - progress) * flicker;

          // Multi-layered fire gradient
          const fireGradient = this.ctx.createRadialGradient(
            centerX, centerY + this.blockSize * 0.2, 0,
            centerX, centerY, this.blockSize * 0.7
          );

          // Fire core (white-hot center)
          fireGradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
          // Inner flame (bright yellow)
          fireGradient.addColorStop(0.3, `rgba(255, 220, 0, ${alpha * 0.9})`);
          // Middle flame (orange)
          fireGradient.addColorStop(0.6, `rgba(255, 100, 0, ${alpha * 0.7})`);
          // Outer flame (red)
          fireGradient.addColorStop(0.85, `rgba(255, 50, 0, ${alpha * 0.4})`);
          // Edge (dark red smoke)
          fireGradient.addColorStop(1, `rgba(100, 0, 0, 0)`);

          this.ctx.fillStyle = fireGradient;
          this.ctx.fillRect(px, py, this.blockSize, this.blockSize);

          // Add flickering particles/embers rising up
          if (Math.random() > 0.7) {
            const emberX = centerX + (Math.random() - 0.5) * this.blockSize * 0.6;
            const emberY = py + progress * this.blockSize * 0.5;
            const emberSize = this.blockSize * 0.1;

            this.ctx.globalAlpha = (1 - progress) * 0.8;
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.beginPath();
            this.ctx.arc(emberX, emberY, emberSize, 0, Math.PI * 2);
            this.ctx.fill();
          }

          break;
        }
      }

      this.ctx.restore();
    });
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

  drawShrinkCeiling(board: Board, ceilingRows: number): void {
    // Draw blocked ceiling rows
    this.ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
    this.ctx.fillRect(0, 0, board.width * this.blockSize, ceilingRows * this.blockSize);

    // Draw hazard stripes
    this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
    this.ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const y = (ceilingRows * this.blockSize) - 5;
      this.ctx.beginPath();
      this.ctx.moveTo(i * 40, y - 10);
      this.ctx.lineTo(i * 40 + 20, y + 10);
      this.ctx.stroke();
    }
  }

  drawBlindSpot(board: Board, blindSpotRows: number): void {
    // Draw cloud/fog overlay over bottom rows
    const startY = (board.height - blindSpotRows) * this.blockSize;
    const height = blindSpotRows * this.blockSize;

    // Create gradient fog effect
    const gradient = this.ctx.createLinearGradient(0, startY, 0, startY + height);
    gradient.addColorStop(0, 'rgba(40, 40, 60, 0.7)');
    gradient.addColorStop(0.5, 'rgba(30, 30, 50, 0.9)');
    gradient.addColorStop(1, 'rgba(20, 20, 40, 0.95)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, startY, board.width * this.blockSize, height);

    // Add some cloud texture with circles
    this.ctx.fillStyle = 'rgba(60, 60, 80, 0.3)';
    for (let i = 0; i < 8; i++) {
      const x = (i * 50 + Math.sin(Date.now() / 1000 + i) * 20) % (board.width * this.blockSize);
      const y = startY + (i % 3) * (height / 3) + Math.cos(Date.now() / 1000 + i) * 15;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 30, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawBombBlastRadius(piece: Tetromino, bombType: 'circle_bomb' | 'cross_firebomb'): void {
    if (!piece) return;

    // Calculate center of the piece (where bomb will explode)
    const centerX = piece.position.x + 1; // Assume 2x2 or centered piece
    const centerY = piece.position.y + 1;

    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7; // Pulsing effect
    this.ctx.globalAlpha = 0.2 * pulse;

    if (bombType === 'circle_bomb') {
      // Circle bomb affects 3-cell radius
      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const cellX = centerX + dx;
            const cellY = centerY + dy;
            if (cellX >= 0 && cellY >= 0) {
              this.ctx.fillStyle = '#ff6a00';
              this.ctx.fillRect(
                cellX * this.blockSize,
                cellY * this.blockSize,
                this.blockSize,
                this.blockSize
              );
              // Draw border to make it more visible
              this.ctx.strokeStyle = '#ff4400';
              this.ctx.lineWidth = 2;
              this.ctx.strokeRect(
                cellX * this.blockSize,
                cellY * this.blockSize,
                this.blockSize,
                this.blockSize
              );
            }
          }
        }
      }
    } else if (bombType === 'cross_firebomb') {
      // Cross pattern - horizontal and vertical lines
      const range = 5; // Extend 5 cells in each direction
      this.ctx.fillStyle = '#ff6a00';
      this.ctx.strokeStyle = '#ff4400';
      this.ctx.lineWidth = 2;

      // Horizontal line
      for (let dx = -range; dx <= range; dx++) {
        const cellX = centerX + dx;
        if (cellX >= 0) {
          this.ctx.fillRect(
            cellX * this.blockSize,
            centerY * this.blockSize,
            this.blockSize,
            this.blockSize
          );
          this.ctx.strokeRect(
            cellX * this.blockSize,
            centerY * this.blockSize,
            this.blockSize,
            this.blockSize
          );
        }
      }

      // Vertical line
      for (let dy = -range; dy <= range; dy++) {
        const cellY = centerY + dy;
        if (cellY >= 0) {
          this.ctx.fillRect(
            centerX * this.blockSize,
            cellY * this.blockSize,
            this.blockSize,
            this.blockSize
          );
          this.ctx.strokeRect(
            centerX * this.blockSize,
            cellY * this.blockSize,
            this.blockSize,
            this.blockSize
          );
        }
      }
    }

    this.ctx.globalAlpha = 1.0;
  }

  render(
    board: Board,
    currentPiece: Tetromino | null,
    ghostPiece: Tetromino | null,
    options: RenderOptions & { isBomb?: boolean; bombType?: 'circle_bomb' | 'cross_firebomb' } = {}
  ): void {
    const { showGrid = true, showGhost = true, blindSpotRows = 0, isBomb = false, bombType } = options;

    // Clear canvas
    this.clear();

    // Draw grid
    if (showGrid) {
      this.drawGrid(board);
    }

    // Draw locked blocks
    this.drawBoard(board);

    // Draw animations on top of locked blocks
    this.drawAnimations();

    // Draw bomb blast radius preview (before pieces so it's behind them)
    if (isBomb && bombType && currentPiece) {
      this.drawBombBlastRadius(currentPiece, bombType);
    }

    // Draw ghost piece (preview of where piece will land)
    if (showGhost && ghostPiece) {
      this.drawPiece(ghostPiece, true, isBomb);
    }

    // Draw current piece
    if (currentPiece) {
      this.drawPiece(currentPiece, false, isBomb);
    }

    // Draw blind spot overlay (after pieces so fog is on top)
    if (blindSpotRows > 0) {
      this.drawBlindSpot(board, blindSpotRows);
    }
  }
}
