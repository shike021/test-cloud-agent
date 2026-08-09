import { PLAYER } from './constants.js';

/**
 * Canvas renderer for {@link import('./gomoku-game.js').GomokuGame}.
 *
 * The renderer is stateless with respect to the rules: it reads the game
 * snapshot plus a little presentation state (hover cursor, display toggles) and
 * draws it. Because a board game only changes on input, frames are drawn on
 * demand instead of from an animation loop.
 */

/** @typedef {{ x: number, y: number }} Cell */

const PALETTE = Object.freeze({
  boardFrom: '#eac48f',
  boardTo: '#cf9a5b',
  boardEdge: 'rgba(58, 34, 12, 0.45)',
  gridLine: 'rgba(58, 34, 12, 0.55)',
  gridBorder: 'rgba(58, 34, 12, 0.8)',
  starPoint: 'rgba(58, 34, 12, 0.85)',
  label: 'rgba(58, 34, 12, 0.72)',
  blackFrom: '#4a5462',
  blackTo: '#080d14',
  whiteFrom: '#ffffff',
  whiteTo: '#c3cddc',
  stoneEdge: 'rgba(20, 12, 4, 0.55)',
  stoneShadow: 'rgba(32, 18, 4, 0.35)',
  lastMove: '#ff5d73',
  winGlow: 'rgba(255, 209, 102, 0.9)',
  winLine: 'rgba(255, 209, 102, 0.75)',
  cursor: 'rgba(58, 34, 12, 0.5)',
});

const MAX_DEVICE_PIXEL_RATIO = 2.5;
/** Board margin as a multiple of the cell size, with and without labels. */
const MARGIN_FACTOR = Object.freeze({ withLabels: 1.15, withoutLabels: 0.75 });
const COLUMN_LABELS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

export class GomokuRenderer {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #context;
  /** @type {import('./gomoku-game.js').GomokuGame} */
  #game;
  /** @type {Cell|null} Intersection under the pointer or keyboard cursor. */
  #cursor = null;
  #showCoordinates = true;
  #showLastMove = true;
  #cellSize = 0;
  #margin = 0;
  #boardSize = 0;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./gomoku-game.js').GomokuGame} game
   * @param {{ showCoordinates?: boolean, showLastMove?: boolean }} [options]
   */
  constructor(canvas, game, options = {}) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available in this browser.');
    }
    this.#canvas = canvas;
    this.#context = context;
    this.#game = game;
    this.#showCoordinates = options.showCoordinates ?? true;
    this.#showLastMove = options.showLastMove ?? true;
    this.resize();
  }

  get cellSize() {
    return this.#cellSize;
  }

  /** @param {boolean} value */
  setShowCoordinates(value) {
    this.#showCoordinates = Boolean(value);
    this.resize();
  }

  /** @param {boolean} value */
  setShowLastMove(value) {
    this.#showLastMove = Boolean(value);
  }

  /**
   * Moves the hover/keyboard cursor.
   *
   * @param {Cell|null} cell
   * @returns {boolean} Whether the cursor actually changed.
   */
  setCursor(cell) {
    const next = cell ? { x: cell.x, y: cell.y } : null;
    const current = this.#cursor;
    if (next === null && current === null) {
      return false;
    }
    if (next && current && next.x === current.x && next.y === current.y) {
      return false;
    }
    this.#cursor = next;
    return true;
  }

  /** @returns {Cell|null} */
  get cursor() {
    return this.#cursor;
  }

  /**
   * Synchronises the backing store with the CSS size of the canvas.
   * Must be called whenever the element's layout size changes.
   */
  resize() {
    const rect = this.#canvas.getBoundingClientRect();
    const cssSize = Math.max(1, Math.floor(Math.min(rect.width, rect.height) || rect.width || 1));
    const ratio = Math.min(globalThis.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

    this.#canvas.width = Math.floor(cssSize * ratio);
    this.#canvas.height = Math.floor(cssSize * ratio);
    this.#context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const factor = this.#showCoordinates ? MARGIN_FACTOR.withLabels : MARGIN_FACTOR.withoutLabels;
    this.#boardSize = cssSize;
    this.#cellSize = cssSize / (this.#game.size - 1 + 2 * factor);
    this.#margin = this.#cellSize * factor;
  }

  /**
   * Maps viewport coordinates to the nearest free-standing intersection.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {Cell|null} `null` when the point is too far from any intersection.
   */
  cellFromPoint(clientX, clientY) {
    const rect = this.#canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    // The canvas is square; scale in case CSS sizes it differently from the
    // size measured during the last resize().
    const scale = this.#boardSize / rect.width;
    const localX = (clientX - rect.left) * scale;
    const localY = (clientY - rect.top) * scale;

    const x = Math.round((localX - this.#margin) / this.#cellSize);
    const y = Math.round((localY - this.#margin) / this.#cellSize);
    if (!this.#game.isInside(x, y)) {
      return null;
    }

    const centre = this.#intersection(x, y);
    const distance = Math.hypot(localX - centre.x, localY - centre.y);
    return distance <= this.#cellSize * 0.62 ? { x, y } : null;
  }

  /** Draws a complete frame. */
  render() {
    const context = this.#context;
    context.clearRect(0, 0, this.#boardSize, this.#boardSize);

    this.#drawBoard();
    if (this.#showCoordinates) {
      this.#drawLabels();
    }
    this.#drawStones();
    if (this.#showLastMove) {
      this.#drawLastMoveMarker();
    }
    this.#drawWinningLine();
    this.#drawCursor();
  }

  /* --------------------------------------------------------------- drawing */

  #drawBoard() {
    const context = this.#context;
    const size = this.#boardSize;
    const last = this.#game.size - 1;

    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, PALETTE.boardFrom);
    gradient.addColorStop(1, PALETTE.boardTo);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const lineWidth = Math.max(1, this.#cellSize * 0.04);
    context.strokeStyle = PALETTE.gridLine;
    context.lineWidth = lineWidth;
    context.beginPath();
    for (let index = 0; index <= last; index += 1) {
      const start = this.#intersection(index, 0);
      const end = this.#intersection(index, last);
      context.moveTo(this.#align(start.x, lineWidth), start.y);
      context.lineTo(this.#align(end.x, lineWidth), end.y);

      const rowStart = this.#intersection(0, index);
      const rowEnd = this.#intersection(last, index);
      context.moveTo(rowStart.x, this.#align(rowStart.y, lineWidth));
      context.lineTo(rowEnd.x, this.#align(rowEnd.y, lineWidth));
    }
    context.stroke();

    const topLeft = this.#intersection(0, 0);
    const bottomRight = this.#intersection(last, last);
    context.strokeStyle = PALETTE.gridBorder;
    context.lineWidth = lineWidth * 1.6;
    context.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

    context.fillStyle = PALETTE.starPoint;
    for (const point of this.#starPoints()) {
      const centre = this.#intersection(point.x, point.y);
      context.beginPath();
      context.arc(centre.x, centre.y, Math.max(1.5, this.#cellSize * 0.09), 0, Math.PI * 2);
      context.fill();
    }
  }

  #drawLabels() {
    const context = this.#context;
    const fontSize = Math.max(8, Math.round(this.#cellSize * 0.46));
    context.fillStyle = PALETTE.label;
    context.font = `${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let index = 0; index < this.#game.size; index += 1) {
      const column = this.#intersection(index, 0);
      context.fillText(this.#columnLabel(index), column.x, this.#margin * 0.45);

      const row = this.#intersection(0, index);
      context.fillText(String(index + 1), this.#margin * 0.45, row.y);
    }
  }

  #drawStones() {
    for (let y = 0; y < this.#game.size; y += 1) {
      for (let x = 0; x < this.#game.size; x += 1) {
        const player = this.#game.cellAt(x, y);
        if (player) {
          this.#drawStone(x, y, player, 1);
        }
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {import('./constants.js').PlayerName} player
   * @param {number} alpha
   */
  #drawStone(x, y, player, alpha) {
    const context = this.#context;
    const centre = this.#intersection(x, y);
    const radius = this.#cellSize * 0.44;
    const isBlack = player === PLAYER.BLACK;

    context.save();
    context.globalAlpha = alpha;

    context.shadowColor = PALETTE.stoneShadow;
    context.shadowBlur = radius * 0.5;
    context.shadowOffsetY = radius * 0.18;

    const gradient = context.createRadialGradient(
      centre.x - radius * 0.35,
      centre.y - radius * 0.4,
      radius * 0.15,
      centre.x,
      centre.y,
      radius,
    );
    gradient.addColorStop(0, isBlack ? PALETTE.blackFrom : PALETTE.whiteFrom);
    gradient.addColorStop(1, isBlack ? PALETTE.blackTo : PALETTE.whiteTo);

    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    context.restore();

    context.save();
    context.globalAlpha = alpha;
    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.strokeStyle = PALETTE.stoneEdge;
    context.lineWidth = Math.max(0.6, radius * 0.06);
    context.stroke();
    context.restore();
  }

  #drawLastMoveMarker() {
    const move = this.#game.lastMove;
    if (!move) {
      return;
    }

    const context = this.#context;
    const centre = this.#intersection(move.x, move.y);
    context.beginPath();
    context.arc(centre.x, centre.y, this.#cellSize * 0.16, 0, Math.PI * 2);
    context.strokeStyle = PALETTE.lastMove;
    context.lineWidth = Math.max(1.5, this.#cellSize * 0.07);
    context.stroke();
  }

  #drawWinningLine() {
    const line = this.#game.winningLine;
    if (!line || line.length === 0) {
      return;
    }

    const context = this.#context;
    const first = this.#intersection(line[0].x, line[0].y);
    const last = this.#intersection(line.at(-1).x, line.at(-1).y);

    context.save();
    context.beginPath();
    context.moveTo(first.x, first.y);
    context.lineTo(last.x, last.y);
    context.strokeStyle = PALETTE.winLine;
    context.lineWidth = Math.max(2, this.#cellSize * 0.12);
    context.lineCap = 'round';
    context.stroke();

    context.strokeStyle = PALETTE.winGlow;
    context.lineWidth = Math.max(1.5, this.#cellSize * 0.08);
    for (const cell of line) {
      const centre = this.#intersection(cell.x, cell.y);
      context.beginPath();
      context.arc(centre.x, centre.y, this.#cellSize * 0.48, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  #drawCursor() {
    const cursor = this.#cursor;
    if (!cursor || !this.#game.isLegalMove(cursor.x, cursor.y)) {
      return;
    }

    const context = this.#context;
    const centre = this.#intersection(cursor.x, cursor.y);
    const reach = this.#cellSize * 0.72;

    context.save();
    context.strokeStyle = PALETTE.cursor;
    context.lineWidth = Math.max(1, this.#cellSize * 0.05);
    context.beginPath();
    context.moveTo(centre.x - reach, centre.y);
    context.lineTo(centre.x + reach, centre.y);
    context.moveTo(centre.x, centre.y - reach);
    context.lineTo(centre.x, centre.y + reach);
    context.stroke();
    context.restore();

    this.#drawStone(cursor.x, cursor.y, this.#game.currentPlayer, 0.45);
  }

  /* --------------------------------------------------------------- helpers */

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{ x: number, y: number }} Pixel centre of the intersection.
   */
  #intersection(x, y) {
    return {
      x: this.#margin + x * this.#cellSize,
      y: this.#margin + y * this.#cellSize,
    };
  }

  /**
   * Snaps a coordinate to the pixel grid so thin lines stay crisp.
   *
   * @param {number} value
   * @param {number} lineWidth
   * @returns {number}
   */
  #align(value, lineWidth) {
    return lineWidth < 1.5 ? Math.round(value) + 0.5 : value;
  }

  /** @returns {Cell[]} The traditional handicap dots of the board. */
  #starPoints() {
    const { size } = this.#game;
    if (size < 7) {
      return [];
    }

    const edge = size >= 13 ? 3 : 2;
    const far = size - 1 - edge;
    const middle = (size - 1) / 2;
    /** @type {Cell[]} */
    const points = [
      { x: edge, y: edge },
      { x: far, y: edge },
      { x: edge, y: far },
      { x: far, y: far },
    ];
    if (Number.isInteger(middle)) {
      points.push({ x: middle, y: middle });
    }
    return points;
  }

  /**
   * @param {number} index
   * @returns {string} Column label, following the go convention of skipping "I".
   */
  #columnLabel(index) {
    return COLUMN_LABELS[index % COLUMN_LABELS.length];
  }
}
