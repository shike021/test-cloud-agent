/**
 * Lianliankan connection search.
 *
 * Two tiles may be removed when a polyline of at most three axis-aligned
 * segments joins them without crossing any other tile. The one-cell ring
 * around the board is treated as empty so a path can wrap around the edge.
 *
 * The functions here only inspect a numeric grid. They never touch the DOM.
 */

/**
 * @typedef {object} Cell
 * @property {number} row
 * @property {number} col
 */

/** @typedef {readonly Cell[]} LinkPath */

/**
 * @param {Cell} left
 * @param {Cell} right
 * @returns {boolean}
 */
export function cellsEqual(left, right) {
  return left.row === right.row && left.col === right.col;
}

/**
 * @param {Cell} cell
 * @returns {Cell}
 */
function copyCell(cell) {
  return { row: cell.row, col: cell.col };
}

/**
 * @param {readonly Cell[]} points
 * @returns {Cell[]}
 */
function normalizePath(points) {
  /** @type {Cell[]} */
  const compact = [];
  for (const point of points) {
    const previous = compact[compact.length - 1];
    if (!previous || !cellsEqual(previous, point)) {
      compact.push(copyCell(point));
    }
  }
  return compact;
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} cell
 * @returns {boolean}
 */
function isOnBoard(rows, cols, cell) {
  return cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols;
}

/**
 * Inclusive padded rectangle: rows `[-1, rows]`, columns `[-1, cols]`.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
function isInsidePadding(rows, cols, row, col) {
  return row >= -1 && row <= rows && col >= -1 && col <= cols;
}

/**
 * @param {readonly (readonly number[])[]} board
 * @param {number} rows
 * @param {number} cols
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
function isEmptyAt(board, rows, cols, row, col) {
  if (!isInsidePadding(rows, cols, row, col)) {
    return false;
  }
  if (row === -1 || row === rows || col === -1 || col === cols) {
    return true;
  }
  return board[row][col] === 0;
}

/**
 * True when every cell strictly between `from` and `to` is empty.
 * The endpoints themselves are not inspected; they may hold the tiles
 * being joined. The two cells must share a row or a column.
 *
 * @param {readonly (readonly number[])[]} board
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} from
 * @param {Cell} to
 * @returns {boolean}
 */
function lineClear(board, rows, cols, from, to) {
  if (from.row !== to.row && from.col !== to.col) {
    return false;
  }
  if (cellsEqual(from, to)) {
    return true;
  }

  if (from.row === to.row) {
    const step = to.col > from.col ? 1 : -1;
    for (let col = from.col + step; col !== to.col; col += step) {
      if (!isEmptyAt(board, rows, cols, from.row, col)) {
        return false;
      }
    }
    return true;
  }

  const step = to.row > from.row ? 1 : -1;
  for (let row = from.row + step; row !== to.row; row += step) {
    if (!isEmptyAt(board, rows, cols, row, from.col)) {
      return false;
    }
  }
  return true;
}

/**
 * A corner is usable when it is empty, or when it coincides with an endpoint.
 *
 * @param {readonly (readonly number[])[]} board
 * @param {number} rows
 * @param {number} cols
 * @param {Cell} cell
 * @param {Cell} from
 * @param {Cell} to
 * @returns {boolean}
 */
function isUsableCorner(board, rows, cols, cell, from, to) {
  if (cellsEqual(cell, from) || cellsEqual(cell, to)) {
    return true;
  }
  return isEmptyAt(board, rows, cols, cell.row, cell.col);
}

/**
 * Finds a connecting polyline of at most three straight segments.
 *
 * The search is deterministic: zero turns, then one, then two, scanning
 * corridors from the left/top padding toward the opposite edge. Callers that
 * also require matching tile types must check that themselves.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {readonly (readonly number[])[]} board Row-major grid; `0` is empty.
 * @param {Cell} from
 * @param {Cell} to
 * @returns {LinkPath|null}
 */
export function findLinkPath(rows, cols, board, from, to) {
  if (!isOnBoard(rows, cols, from) || !isOnBoard(rows, cols, to) || cellsEqual(from, to)) {
    return null;
  }

  if (lineClear(board, rows, cols, from, to)) {
    return normalizePath([from, to]);
  }

  const oneTurnCorners = [
    { row: from.row, col: to.col },
    { row: to.row, col: from.col },
  ];
  for (const corner of oneTurnCorners) {
    if (cellsEqual(corner, from) || cellsEqual(corner, to)) {
      continue;
    }
    if (!isEmptyAt(board, rows, cols, corner.row, corner.col)) {
      continue;
    }
    if (lineClear(board, rows, cols, from, corner) && lineClear(board, rows, cols, corner, to)) {
      return normalizePath([from, corner, to]);
    }
  }

  for (let col = -1; col <= cols; col += 1) {
    const first = { row: from.row, col };
    const second = { row: to.row, col };
    if (!isUsableCorner(board, rows, cols, first, from, to)) {
      continue;
    }
    if (!isUsableCorner(board, rows, cols, second, from, to)) {
      continue;
    }
    if (
      lineClear(board, rows, cols, from, first) &&
      lineClear(board, rows, cols, first, second) &&
      lineClear(board, rows, cols, second, to)
    ) {
      const path = normalizePath([from, first, second, to]);
      if (path.length >= 2 && path.length <= 4) {
        return path;
      }
    }
  }

  for (let row = -1; row <= rows; row += 1) {
    const first = { row, col: from.col };
    const second = { row, col: to.col };
    if (!isUsableCorner(board, rows, cols, first, from, to)) {
      continue;
    }
    if (!isUsableCorner(board, rows, cols, second, from, to)) {
      continue;
    }
    if (
      lineClear(board, rows, cols, from, first) &&
      lineClear(board, rows, cols, first, second) &&
      lineClear(board, rows, cols, second, to)
    ) {
      const path = normalizePath([from, first, second, to]);
      if (path.length >= 2 && path.length <= 4) {
        return path;
      }
    }
  }

  return null;
}
