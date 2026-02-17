/**
 * TetriminoBgPreview — LOCAL REVIEW ONLY, not wired into the app.
 *
 * 5 flavours of animated tetrimino backgrounds that reflect the theme's
 * piece colours. Each flavour uses its own physics / rendering style.
 * Pieces bounce off all four walls with elastic reflection.
 *
 * Usage (dev preview only):
 *   <TetriminoBgPreview flavour={0..4} />
 *
 * To view all five, temporarily add to App.tsx or render in isolation.
 */

import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../themes/types';

// ─── Tetrimino shapes ────────────────────────────────────────────────────────

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

const SHAPES: Record<PieceType, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};
const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

function getPieceColor(type: PieceType, theme: Theme): string {
  return theme.colors.pieces[type] ?? '#ffffff';
}

// Rotate a 2D shape matrix 90° clockwise
function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
  );
}

function randomRotation(shape: number[][]): number[][] {
  let s = shape;
  const turns = Math.floor(Math.random() * 4);
  for (let i = 0; i < turns; i++) s = rotateCW(s);
  return s;
}

// ─── Shared piece state ───────────────────────────────────────────────────────

interface Piece {
  type: PieceType;
  shape: number[][];
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;      // radians, current rotation angle
  spinRate: number;  // radians per frame
  alpha: number;
  scale: number;
  cellSize: number;
}

function spawnPiece(w: number, h: number, flavour: number): Piece {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  const shape = randomRotation(SHAPES[type]);
  const speed = flavour === 2 ? 0.4 + Math.random() * 0.3   // slow drift
              : flavour === 3 ? 2.5 + Math.random() * 2      // fast chaos
              : 0.8 + Math.random() * 1.2;                   // normal
  const angle = Math.random() * Math.PI * 2;
  const cellSize = flavour === 0 ? 28
                 : flavour === 1 ? 14 + Math.floor(Math.random() * 20)
                 : flavour === 4 ? 18
                 : 22;
  const scale = flavour === 2 ? 0.6 + Math.random() * 0.8 : 1;

  return {
    type,
    shape,
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: Math.random() * Math.PI * 2,
    spinRate: (Math.random() - 0.5) * (flavour === 3 ? 0.08 : 0.015),
    alpha: flavour === 1 ? 0.08 + Math.random() * 0.12
         : flavour === 2 ? 0.15 + Math.random() * 0.15
         : 0.18 + Math.random() * 0.14,
    scale,
    cellSize,
  };
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  color: string,
  flavour: number,
) {
  const { shape, cellSize, spin, scale, alpha } = piece;
  const rows = shape.length;
  const cols = shape[0].length;
  const pw = cols * cellSize;
  const ph = rows * cellSize;

  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const bx = -pw / 2 + c * cellSize;
      const by = -ph / 2 + r * cellSize;

      if (flavour === 0) {
        // Flavour 0: glass blocks with inner glow
        ctx.fillStyle = color + '33';
        ctx.strokeStyle = color + 'cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx + 1, by + 1, cellSize - 2, cellSize - 2, 4);
        ctx.fill();
        ctx.stroke();
        // inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx + 3, by + 3, cellSize * 0.4, cellSize * 0.3);
      } else if (flavour === 1) {
        // Flavour 1: outline only, varying sizes
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 1, by + 1, cellSize - 2, cellSize - 2);
      } else if (flavour === 2) {
        // Flavour 2: soft gradient blobs
        const cx2 = bx + cellSize / 2;
        const cy2 = by + cellSize / 2;
        const grad = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cellSize * 0.8);
        grad.addColorStop(0, color + 'cc');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx2, cy2, cellSize * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else if (flavour === 3) {
        // Flavour 3: neon thin outlines with glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, cellSize, cellSize);
        ctx.shadowBlur = 0;
      } else {
        // Flavour 4: solid filled, no border radius — retro look
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, cellSize - 1, cellSize - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(bx, by, cellSize - 1, 3);
        ctx.fillRect(bx, by, 3, cellSize - 1);
      }
    }
  }

  ctx.restore();
}

// Bounce piece off walls, using bounding radius approximation
function bounceWalls(piece: Piece, w: number, h: number) {
  const r = piece.cellSize * Math.max(piece.shape.length, piece.shape[0].length) * 0.5 * piece.scale;
  if (piece.x - r < 0)   { piece.x = r;     piece.vx = Math.abs(piece.vx); }
  if (piece.x + r > w)   { piece.x = w - r; piece.vx = -Math.abs(piece.vx); }
  if (piece.y - r < 0)   { piece.y = r;     piece.vy = Math.abs(piece.vy); }
  if (piece.y + r > h)   { piece.y = h - r; piece.vy = -Math.abs(piece.vy); }
}

// ─── Flavour metadata ─────────────────────────────────────────────────────────

export const FLAVOUR_LABELS = [
  'Glass Blocks',    // 0 — rounded glass squares with highlight
  'Ghost Outlines',  // 1 — thin outlines, varying opacity & size
  'Soft Blobs',      // 2 — slow drifting radial gradient blobs
  'Neon Chaos',      // 3 — fast spinning, neon glow outlines
  'Retro Solid',     // 4 — opaque solid blocks, classic look
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  flavour?: 0 | 1 | 2 | 3 | 4;
  pieceCount?: number;
  width?: number;
  height?: number;
}

export function TetriminoBgPreview({
  flavour = 0,
  pieceCount = 18,
  width = 480,
  height = 320,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = ctx; // narrowed non-null reference for use inside closures

    const w = canvas.width;
    const h = canvas.height;
    const pieces: Piece[] = Array.from({ length: pieceCount }, () => spawnPiece(w, h, flavour));

    let raf: number;

    function frame() {
      // Background
      if (flavour === 3) {
        c.fillStyle = '#000010';
        c.fillRect(0, 0, w, h);
      } else {
        c.clearRect(0, 0, w, h);
        c.fillStyle = 'rgba(5, 5, 20, 0.92)';
        c.fillRect(0, 0, w, h);
      }

      for (const p of pieces) {
        const color = getPieceColor(p.type, theme);
        drawPiece(c, p, color, flavour);

        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.spinRate;
        bounceWalls(p, w, h);
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [flavour, pieceCount, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'block',
      }}
    />
  );
}

// ─── All-5 preview page ───────────────────────────────────────────────────────

/**
 * Render all 5 flavours side-by-side for review.
 * Add <TetriminoBgPreviewAll /> temporarily to App.tsx to see them.
 */
export function TetriminoBgPreviewAll() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#020210',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
      gap: '32px',
      fontFamily: 'monospace',
      color: '#fff',
    }}>
      <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '3px', color: '#00d4ff' }}>
        BACKGROUND PREVIEW — 5 FLAVOURS
      </h1>
      <p style={{ margin: 0, color: '#555', fontSize: '12px' }}>
        Local review only · not wired into production
      </p>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        justifyContent: 'center',
        maxWidth: '1100px',
      }}>
        {([0, 1, 2, 3, 4] as const).map((f) => (
          <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <TetriminoBgPreview flavour={f} width={480} height={300} />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(0,212,255,0.15)',
                border: '1px solid rgba(0,212,255,0.3)',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '10px',
                color: '#00d4ff',
                letterSpacing: '1px',
              }}>
                {f}
              </span>
              <span style={{ fontSize: '13px', color: '#aaa' }}>{FLAVOUR_LABELS[f]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
