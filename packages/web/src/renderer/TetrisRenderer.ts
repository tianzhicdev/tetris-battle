import type { Board, Tetromino } from '@tetris-battle/game-core';
import type { Theme } from '../themes';
import { DEFAULT_THEME } from '../themes';
import { BlockAnimationManager } from './BlockAnimationManager';

type SnakeDirection = 'up' | 'right' | 'down' | 'left';
type SnakeCell = { x: number; y: number };
type SnakeOverlay = {
  active: boolean;
  head: { x: number; y: number; direction: SnakeDirection } | null;
  body: SnakeCell[];
  tail: { x: number; y: number; direction: SnakeDirection } | null;
  eggs: SnakeCell[];
};

export interface RenderOptions {
  theme?: Theme;
  showGrid?: boolean;
  showGhost?: boolean;
  blindSpotRows?: number; // Number of bottom rows to hide (for blind_spot ability)
  snakeOverlay?: SnakeOverlay | null;
}

const SNAKE_SVG_BY_KIND = {
  egg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="35" rx="16" ry="20" fill="#f6f1d7"/>
    <ellipse cx="27" cy="30" rx="5" ry="7" fill="#ffffff88"/>
    <ellipse cx="32" cy="35" rx="16" ry="20" fill="none" stroke="#c8bf95" stroke-width="4"/>
  </svg>`,
  body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect x="8" y="8" width="48" height="48" rx="16" fill="#3ddc84"/>
    <circle cx="24" cy="24" r="6" fill="#7df0ae"/>
    <rect x="8" y="8" width="48" height="48" rx="16" fill="none" stroke="#1a7d4a" stroke-width="4"/>
  </svg>`,
  head: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M10 12h28c9 0 16 7 16 16v8c0 9-7 16-16 16H10z" fill="#40e991"/>
    <circle cx="36" cy="24" r="5" fill="#0f1f16"/>
    <circle cx="37" cy="23" r="2" fill="#ffffff"/>
    <path d="M50 32h10" stroke="#173d2b" stroke-width="4" stroke-linecap="round"/>
    <path d="M10 12h28c9 0 16 7 16 16v8c0 9-7 16-16 16H10z" fill="none" stroke="#1a7d4a" stroke-width="4"/>
  </svg>`,
  tail: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M10 32c10-11 20-15 44-16v32c-24-1-34-5-44-16z" fill="#2db56c"/>
    <path d="M10 32c10-11 20-15 44-16v32c-24-1-34-5-44-16z" fill="none" stroke="#1a7d4a" stroke-width="4"/>
  </svg>`,
} as const;

type SnakeSpriteKind = keyof typeof SNAKE_SVG_BY_KIND;

const snakeSpriteCache: Map<SnakeSpriteKind, HTMLImageElement | null> = new Map();

function getSnakeSprite(kind: SnakeSpriteKind): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (snakeSpriteCache.has(kind)) {
    return snakeSpriteCache.get(kind) ?? null;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = `data:image/svg+xml;utf8,${encodeURIComponent(SNAKE_SVG_BY_KIND[kind])}`;
  snakeSpriteCache.set(kind, image);
  return image;
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

  private getSnakeDirectionAngle(direction: SnakeDirection): number {
    switch (direction) {
      case 'up':
        return -Math.PI / 2;
      case 'down':
        return Math.PI / 2;
      case 'left':
        return Math.PI;
      case 'right':
      default:
        return 0;
    }
  }

  private drawSnakeFallbackCell(kind: SnakeSpriteKind, x: number, y: number, rotation: number): void {
    const px = x * this.blockSize;
    const py = y * this.blockSize;
    const cx = px + this.blockSize / 2;
    const cy = py + this.blockSize / 2;
    const radius = this.blockSize * 0.32;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);

    if (kind === 'egg') {
      this.ctx.fillStyle = '#f6f1d7';
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, radius * 0.85, radius, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#c8bf95';
      this.ctx.lineWidth = Math.max(1, this.blockSize * 0.08);
      this.ctx.stroke();
    } else if (kind === 'body') {
      const size = this.blockSize * 0.62;
      this.ctx.fillStyle = '#3ddc84';
      this.ctx.fillRect(-size / 2, -size / 2, size, size);
      this.ctx.strokeStyle = '#1a7d4a';
      this.ctx.lineWidth = Math.max(1, this.blockSize * 0.08);
      this.ctx.strokeRect(-size / 2, -size / 2, size, size);
    } else if (kind === 'head') {
      this.ctx.fillStyle = '#40e991';
      this.ctx.beginPath();
      this.ctx.moveTo(radius * 0.9, 0);
      this.ctx.lineTo(-radius * 0.8, -radius * 0.7);
      this.ctx.lineTo(-radius * 0.8, radius * 0.7);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = '#1a7d4a';
      this.ctx.lineWidth = Math.max(1, this.blockSize * 0.08);
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = '#2db56c';
      this.ctx.beginPath();
      this.ctx.moveTo(radius * 0.8, 0);
      this.ctx.lineTo(-radius * 0.9, -radius * 0.6);
      this.ctx.lineTo(-radius * 0.9, radius * 0.6);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = '#1a7d4a';
      this.ctx.lineWidth = Math.max(1, this.blockSize * 0.08);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawSnakeCellSprite(
    kind: SnakeSpriteKind,
    x: number,
    y: number,
    direction: SnakeDirection | null = null
  ): void {
    const rotation = direction ? this.getSnakeDirectionAngle(direction) : 0;
    const image = getSnakeSprite(kind);

    if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      this.drawSnakeFallbackCell(kind, x, y, rotation);
      return;
    }

    const px = x * this.blockSize;
    const py = y * this.blockSize;
    const cx = px + this.blockSize / 2;
    const cy = py + this.blockSize / 2;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(rotation);
    this.ctx.drawImage(image, -this.blockSize / 2, -this.blockSize / 2, this.blockSize, this.blockSize);
    this.ctx.restore();
  }

  private drawSnakeOverlay(board: Board, overlay: SnakeOverlay): void {
    if (!overlay?.active) return;

    for (const egg of overlay.eggs) {
      if (egg.x < 0 || egg.x >= board.width || egg.y < 0 || egg.y >= board.height) continue;
      this.drawSnakeCellSprite('egg', egg.x, egg.y);
    }

    for (const segment of overlay.body) {
      if (segment.x < 0 || segment.x >= board.width || segment.y < 0 || segment.y >= board.height) continue;
      this.drawSnakeCellSprite('body', segment.x, segment.y);
    }

    if (overlay.tail) {
      const { x, y, direction } = overlay.tail;
      if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
        this.drawSnakeCellSprite('tail', x, y, direction);
      }
    }

    if (overlay.head) {
      const { x, y, direction } = overlay.head;
      if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
        this.drawSnakeCellSprite('head', x, y, direction);
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
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardX = piece.position.x + x;
          const boardY = piece.position.y + y;

          if (boardY >= 0) {
            if (ghost) {
              // Shadow-style landing preview for hard drop.
              const px = boardX * this.blockSize;
              const py = boardY * this.blockSize;
              this.ctx.globalAlpha = 1;
              this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
              this.ctx.fillRect(
                px + 1,
                py + 1,
                this.blockSize - 2,
                this.blockSize - 2
              );

              this.ctx.globalAlpha = 0.85;
              this.ctx.strokeStyle = isBomb ? '#ff4444' : this.theme.colors[piece.type];
              this.ctx.lineWidth = 1.5;
              this.ctx.strokeRect(
                px + 2,
                py + 2,
                this.blockSize - 4,
                this.blockSize - 4
              );
              this.ctx.globalAlpha = 1;
            } else {
              // Draw normal block
              this.theme.renderBlock(
                this.ctx,
                boardX * this.blockSize,
                boardY * this.blockSize,
                this.blockSize,
                piece.type
              );

              // If it's a bomb, add blinking overlay
              if (isBomb) {
                const px = boardX * this.blockSize;
                const py = boardY * this.blockSize;
                const time = Date.now() / 300;
                const blink = Math.sin(time) * 0.5 + 0.5; // 0 to 1 pulsing

                this.ctx.fillStyle = `rgba(255, 255, 255, ${blink * 0.6})`;
                this.ctx.fillRect(px, py, this.blockSize, this.blockSize);
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

    // Create gradient fog effect (fully opaque)
    const gradient = this.ctx.createLinearGradient(0, startY, 0, startY + height);
    gradient.addColorStop(0, 'rgba(40, 40, 60, 1.0)');
    gradient.addColorStop(0.5, 'rgba(30, 30, 50, 1.0)');
    gradient.addColorStop(1, 'rgba(20, 20, 40, 1.0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, startY, board.width * this.blockSize, height);

    // Add some cloud texture with circles (fully opaque)
    this.ctx.fillStyle = 'rgba(60, 60, 80, 1.0)';
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
    const {
      showGrid = true,
      showGhost = true,
      blindSpotRows = 0,
      isBomb = false,
      bombType,
      snakeOverlay = null,
    } = options;

    // Clear canvas
    this.clear();

    // Draw grid
    if (showGrid) {
      this.drawGrid(board);
    }

    if (snakeOverlay?.active) {
      this.drawSnakeOverlay(board, snakeOverlay);
    } else {
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
    }

    // Draw blind spot overlay (after pieces so fog is on top)
    if (blindSpotRows > 0) {
      this.drawBlindSpot(board, blindSpotRows);
    }
  }
}
