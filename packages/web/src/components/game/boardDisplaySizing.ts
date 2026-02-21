export interface BoardDisplaySizingInput {
  availableWidth: number;
  availableHeight: number;
  boardWidth: number;
  boardHeight: number;
  baseWidthColumns?: number;
  minCellSize?: number;
}

export interface BoardDisplaySizing {
  cellSize: number;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Computes square-cell board size that fully fits available area.
 *
 * Rules:
 * - Cells are always square.
 * - Board always fits available width/height.
 * - For expanded widths (e.g. 12 cols), preserve baseline 10-col board width
 *   by shrinking cells so overall board width does not grow.
 */
export function computeBoardDisplaySize({
  availableWidth,
  availableHeight,
  boardWidth,
  boardHeight,
  baseWidthColumns = 10,
  minCellSize = 4,
}: BoardDisplaySizingInput): BoardDisplaySizing {
  const safeBoardWidth = Math.max(1, boardWidth);
  const safeBoardHeight = Math.max(1, boardHeight);

  const safeAvailWidth = Math.max(0, availableWidth);
  const safeAvailHeight = Math.max(0, availableHeight);

  if (safeAvailWidth <= 0 || safeAvailHeight <= 0) {
    const fallbackCell = minCellSize;
    return {
      cellSize: fallbackCell,
      pixelWidth: safeBoardWidth * fallbackCell,
      pixelHeight: safeBoardHeight * fallbackCell,
    };
  }

  const maxCellByFit = Math.floor(Math.min(safeAvailWidth / safeBoardWidth, safeAvailHeight / safeBoardHeight));
  const baseCellByFit = Math.floor(Math.min(safeAvailWidth / baseWidthColumns, safeAvailHeight / safeBoardHeight));

  let cell = Math.max(minCellSize, maxCellByFit);

  if (safeBoardWidth > baseWidthColumns) {
    const baselineBoardWidth = Math.max(minCellSize * baseWidthColumns, baseCellByFit * baseWidthColumns);
    const fixedWidthCell = Math.floor(baselineBoardWidth / safeBoardWidth);
    cell = Math.max(minCellSize, Math.min(cell, fixedWidthCell));
  }

  const pixelWidth = Math.max(1, safeBoardWidth * cell);
  const pixelHeight = Math.max(1, safeBoardHeight * cell);

  return {
    cellSize: cell,
    pixelWidth,
    pixelHeight,
  };
}
