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
}

const BOARD_ROWS = 30;
const BOARD_COLS = 5;

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

export function DefenseLineRenderer({ state, viewAs, ghostPiece }: DefenseLineRendererProps) {
  const aActive = buildPieceLookup(state.playerA.activePiece);
  const bActive = buildPieceLookup(state.playerB.activePiece);
  const ghostCells = buildPieceLookup(ghostPiece ?? null);
  const activeRowSet = new Set(state.activeRows);

  const cells: ReactNode[] = [];

  for (let visualRow = 0; visualRow < BOARD_ROWS; visualRow++) {
    for (let visualCol = 0; visualCol < BOARD_COLS; visualCol++) {
      const [row, col] = mapToActual(visualRow, visualCol, viewAs);
      const key = `${row}:${col}`;

      const onDivider = row === 14;
      const activeRow = activeRowSet.has(row);

      const cell = state.board[row]?.[col];
      const hasA = aActive.has(key);
      const hasB = bActive.has(key);
      const hasGhost = ghostCells.has(key);

      let background = row < 15 ? 'rgba(255, 153, 102, 0.12)' : 'rgba(0, 212, 255, 0.12)';
      let border = '1px solid rgba(255, 255, 255, 0.08)';
      let boxShadow = 'none';

      if (activeRow) {
        background = row < 15 ? 'rgba(255, 153, 102, 0.2)' : 'rgba(0, 212, 255, 0.2)';
      }

      if (cell === 'a' || hasA) {
        background = '#ff8a3c';
        boxShadow = 'inset 0 0 10px rgba(255, 208, 153, 0.35)';
      } else if (cell === 'b' || hasB) {
        background = '#36d6ff';
        boxShadow = 'inset 0 0 10px rgba(173, 238, 255, 0.45)';
      } else if (hasGhost) {
        background = viewAs === 'a' ? 'rgba(255, 138, 60, 0.35)' : 'rgba(54, 214, 255, 0.35)';
      }

      if (onDivider) {
        border = '1px solid rgba(255, 255, 255, 0.08)';
      }

      cells.push(
        <div
          key={`cell-${visualRow}-${visualCol}`}
          style={{
            background,
            border,
            borderBottom: onDivider ? '2px solid rgba(255, 255, 255, 0.45)' : border,
            boxShadow,
            width: '100%',
            aspectRatio: '1 / 1',
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
        gap: '1px',
        width: 'min(160px, 70vw)',
        padding: '6px',
        borderRadius: '8px',
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
