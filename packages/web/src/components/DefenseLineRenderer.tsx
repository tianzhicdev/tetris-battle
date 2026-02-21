import type { ReactNode } from 'react';
import { TETROMINO_SHAPES, type TetrominoType } from '@tetris-battle/game-core';

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

export interface DefenseLineGameState {
  board: DefenseLineCell[][];
  activeRows: number[];
  playerA: DefenseLinePlayerState;
  playerB: DefenseLinePlayerState;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  winner: DefenseLinePlayer | null;
}

interface DefenseLineRendererProps {
  state: DefenseLineGameState;
  viewAs: DefenseLinePlayer;
  ghostPiece?: DefenseLinePiece | null;
  clearedRows?: { player: DefenseLinePlayer; rows: number[] } | null;
}

const BOARD_ROWS = 30;
const BOARD_COLS = 10;

function getPieceCells(piece: DefenseLinePiece): Array<[number, number]> {
  const shapes = TETROMINO_SHAPES[piece.type];
  const rotation = ((piece.rotation % shapes.length) + shapes.length) % shapes.length;
  const shape = shapes[rotation];
  const cells: Array<[number, number]> = [];

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] === 1) {
        cells.push([piece.row + row, piece.col + col]);
      }
    }
  }

  return cells;
}

function buildPieceLookup(piece: DefenseLinePiece | null): Set<string> {
  const set = new Set<string>();
  if (!piece) {
    return set;
  }

  for (const [row, col] of getPieceCells(piece)) {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
      continue;
    }
    set.add(`${row}:${col}`);
  }

  return set;
}

function mapToActual(visualRow: number, visualCol: number, viewAs: DefenseLinePlayer): [number, number] {
  if (viewAs === 'a') {
    return [visualRow, visualCol];
  }
  return [BOARD_ROWS - 1 - visualRow, BOARD_COLS - 1 - visualCol];
}

export function DefenseLineRenderer({ state, viewAs }: DefenseLineRendererProps) {
  const aActive = buildPieceLookup(state.playerA.activePiece);
  const bActive = buildPieceLookup(state.playerB.activePiece);

  // Calculate board size to fit screen
  // Available height: viewport - header (~100px) - buttons (~60px)
  const availableHeight = typeof window !== 'undefined' ? window.innerHeight - 160 : 600;
  const cellSize = Math.floor(availableHeight / BOARD_ROWS);
  const boardWidth = cellSize * BOARD_COLS;

  const cells: ReactNode[] = [];

  for (let visualRow = 0; visualRow < BOARD_ROWS; visualRow++) {
    for (let visualCol = 0; visualCol < BOARD_COLS; visualCol++) {
      const [row, col] = mapToActual(visualRow, visualCol, viewAs);
      const key = `${row}:${col}`;

      const onDivider = row === 14;

      const cell = state.board[row]?.[col] || (row < 15 ? '0' : 'x');
      const hasA = aActive.has(key);
      const hasB = bActive.has(key);

      // Determine actual cell value (active piece overrides board)
      let displayCell = cell;
      if (hasA) displayCell = 'a';
      if (hasB) displayCell = 'b';

      // Color scheme: a/x = blue, b/0 = red
      let background = '#000';
      if (displayCell === 'a' || displayCell === 'x') {
        background = 'rgba(54, 162, 235, 0.8)'; // Blue
      } else if (displayCell === 'b' || displayCell === '0') {
        background = 'rgba(255, 99, 132, 0.8)'; // Red
      }

      cells.push(
        <div
          key={`cell-${visualRow}-${visualCol}`}
          style={{
            background,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: onDivider ? '2px solid rgba(255, 255, 255, 0.6)' : undefined,
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${Math.max(6, cellSize * 0.4)}px`,
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#fff',
          }}
        >
          {displayCell}
        </div>,
      );
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
        gap: '0px',
        width: `${boardWidth}px`,
        padding: '0px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        background: 'rgba(0, 0, 0, 0.45)',
      }}
    >
      {cells}
    </div>
  );
}

export function canPlaceDefenseLinePiece(
  state: DefenseLineGameState,
  player: DefenseLinePlayer,
  piece: DefenseLinePiece,
): boolean {
  const cells = getPieceCells(piece);

  for (const [row, col] of cells) {
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
      return false;
    }

    const boardCell = state.board[row][col];

    if (player === 'a') {
      // For A: 'a' and 'x' are solid
      if (boardCell === 'a' || boardCell === 'x') {
        return false;
      }
    } else {
      // For B: 'b' and '0' are solid
      if (boardCell === 'b' || boardCell === '0') {
        return false;
      }
    }
  }

  return true;
}
