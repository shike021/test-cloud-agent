import { AXES, DEFAULT_OPTIONS, GOMOKU_STATUS, OPPONENT, PLAYER, REJECTION } from './constants.js';

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {import('./constants.js').PlayerName} PlayerName
 * @typedef {{ x: number, y: number, player: PlayerName, index: number }} Move
 */

/**
 * @typedef {object} PlaceResult
 * @property {boolean} placed                   Whether a stone was added.
 * @property {Move|null} move                   The move that was played.
 * @property {PlayerName|null} winner           Winner after the move, if any.
 * @property {readonly Cell[]|null} winningLine The stones forming the win.
 * @property {boolean} draw                     Whether the board filled up.
 * @property {string} status                    The status after the move.
 * @property {string|null} rejection            Why the move was refused.
 */

/** Board cell encoding. Numbers keep the board compact and comparisons cheap. */
const EMPTY = 0;
const STONE = Object.freeze({ black: 1, white: 2 });
const STONE_PLAYER = Object.freeze([null, PLAYER.BLACK, PLAYER.WHITE]);

/**
 * Headless, deterministic gomoku (five in a row) game for two players.
 *
 * The class owns the complete rule set — turn order, legality, win and draw
 * detection and the move history including undo — and exposes it through a
 * small imperative API. It performs no rendering and touches no browser
 * globals, which makes it both unit testable and reusable across renderers.
 *
 * The implemented rule set is *freestyle* gomoku: the first player to line up
 * `winLength` or more stones wins, there are no forbidden openings and an
 * overline (six or more) counts as a win.
 */
export class GomokuGame {
  /** @type {Required<typeof DEFAULT_OPTIONS>} */
  #options;
  /** @type {Int8Array} Row-major board, `EMPTY` or a {@link STONE} value. */
  #cells;
  /** @type {PlayerName} */
  #currentPlayer;
  /** @type {Move[]} */
  #moves = [];
  /** @type {string} */
  #status = GOMOKU_STATUS.PLAYING;
  /** @type {PlayerName|null} */
  #winner = null;
  /** @type {Cell[]|null} */
  #winningLine = null;

  /**
   * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
   */
  constructor(options = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options };
    this.#validateOptions();
    this.#cells = new Int8Array(this.#options.size * this.#options.size);
    this.#currentPlayer = this.#options.firstPlayer;
    this.reset();
  }

  #validateOptions() {
    const { size, winLength, firstPlayer } = this.#options;

    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(`Option "size" must be a positive integer, received: ${size}`);
    }
    if (!Number.isInteger(winLength) || winLength < 2) {
      throw new RangeError(`Option "winLength" must be an integer >= 2, received: ${winLength}`);
    }
    if (winLength > size) {
      throw new RangeError(
        `Option "winLength" (${winLength}) must not exceed "size" (${size}); ` +
          'the match could never be won.',
      );
    }
    if (firstPlayer !== PLAYER.BLACK && firstPlayer !== PLAYER.WHITE) {
      throw new RangeError(
        `Option "firstPlayer" must be a player colour, received: ${firstPlayer}`,
      );
    }
  }

  /* ----------------------------------------------------------------- state */

  get size() {
    return this.#options.size;
  }

  get winLength() {
    return this.#options.winLength;
  }

  /** @returns {PlayerName} Colour that opened the current match. */
  get firstPlayer() {
    return this.#options.firstPlayer;
  }

  /** @returns {PlayerName} Colour to move next. */
  get currentPlayer() {
    return this.#currentPlayer;
  }

  get status() {
    return this.#status;
  }

  /** @returns {PlayerName|null} */
  get winner() {
    return this.#winner;
  }

  /**
   * The stones that ended the match, ordered along their axis.
   *
   * @returns {readonly Cell[]|null}
   */
  get winningLine() {
    return this.#winningLine;
  }

  /** @returns {readonly Move[]} Move history, oldest first. */
  get moves() {
    return this.#moves;
  }

  get moveCount() {
    return this.#moves.length;
  }

  /** @returns {Move|null} */
  get lastMove() {
    return this.#moves.at(-1) ?? null;
  }

  get isFinished() {
    return this.#status === GOMOKU_STATUS.WON || this.#status === GOMOKU_STATUS.DRAW;
  }

  get freeCellCount() {
    return this.#cells.length - this.#moves.length;
  }

  /**
   * @param {number} x Column index, 0-based.
   * @param {number} y Row index, 0-based.
   * @returns {PlayerName|null} The stone on the intersection, if any.
   */
  cellAt(x, y) {
    if (!this.isInside(x, y)) {
      return null;
    }
    return STONE_PLAYER[this.#cells[this.#index(x, y)]];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isInside(x, y) {
    const { size } = this.#options;
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean} Whether {@link GomokuGame#place} would accept the move.
   */
  isLegalMove(x, y) {
    return !this.isFinished && this.isInside(x, y) && this.#cells[this.#index(x, y)] === EMPTY;
  }

  /* --------------------------------------------------------------- control */

  /**
   * Clears the board and starts a new match.
   *
   * @param {{ firstPlayer?: PlayerName }} [options] Overrides the opening
   *   colour, which lets callers alternate it between matches.
   */
  reset({ firstPlayer } = {}) {
    if (firstPlayer !== undefined) {
      this.#options = { ...this.#options, firstPlayer };
      this.#validateOptions();
    }

    this.#cells.fill(EMPTY);
    this.#moves = [];
    this.#status = GOMOKU_STATUS.PLAYING;
    this.#winner = null;
    this.#winningLine = null;
    this.#currentPlayer = this.#options.firstPlayer;
  }

  /**
   * Plays a stone for the current player.
   *
   * @param {number} x
   * @param {number} y
   * @returns {PlaceResult}
   */
  place(x, y) {
    if (this.isFinished) {
      return this.#rejected(REJECTION.FINISHED);
    }
    if (!this.isInside(x, y)) {
      return this.#rejected(REJECTION.OUT_OF_BOUNDS);
    }
    if (this.#cells[this.#index(x, y)] !== EMPTY) {
      return this.#rejected(REJECTION.OCCUPIED);
    }

    const player = this.#currentPlayer;
    this.#cells[this.#index(x, y)] = STONE[player];

    /** @type {Move} */
    const move = { x, y, player, index: this.#moves.length };
    this.#moves.push(move);

    const line = this.#findWinningLine(x, y, player);
    if (line) {
      this.#status = GOMOKU_STATUS.WON;
      this.#winner = player;
      this.#winningLine = line;
    } else if (this.freeCellCount === 0) {
      this.#status = GOMOKU_STATUS.DRAW;
    } else {
      this.#currentPlayer = OPPONENT[player];
    }

    return {
      placed: true,
      move,
      winner: this.#winner,
      winningLine: this.#winningLine,
      draw: this.#status === GOMOKU_STATUS.DRAW,
      status: this.#status,
      rejection: null,
    };
  }

  /**
   * Takes back the most recent move, including a winning one.
   *
   * @returns {Move|null} The move that was removed, or `null` when the board
   *   was already empty.
   */
  undo() {
    const move = this.#moves.pop();
    if (!move) {
      return null;
    }

    this.#cells[this.#index(move.x, move.y)] = EMPTY;
    this.#status = GOMOKU_STATUS.PLAYING;
    this.#winner = null;
    this.#winningLine = null;
    this.#currentPlayer = move.player;
    return move;
  }

  /* --------------------------------------------------------------- helpers */

  /**
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  #index(x, y) {
    return y * this.#options.size + x;
  }

  /**
   * @param {string} rejection
   * @returns {PlaceResult}
   */
  #rejected(rejection) {
    return {
      placed: false,
      move: null,
      winner: this.#winner,
      winningLine: this.#winningLine,
      draw: this.#status === GOMOKU_STATUS.DRAW,
      status: this.#status,
      rejection,
    };
  }

  /**
   * Looks for a completed line through the stone that was just played.
   *
   * Only lines crossing that intersection can be new, so the search is limited
   * to the four axes around it instead of scanning the whole board.
   *
   * @param {number} x
   * @param {number} y
   * @param {PlayerName} player
   * @returns {Cell[]|null} The stones of the line, ordered along the axis.
   */
  #findWinningLine(x, y, player) {
    const stone = STONE[player];

    for (const axis of AXES) {
      const backwards = this.#walk(x, y, -axis.x, -axis.y, stone);
      const forwards = this.#walk(x, y, axis.x, axis.y, stone);

      if (backwards.length + forwards.length + 1 < this.#options.winLength) {
        continue;
      }
      return [...backwards.reverse(), { x, y }, ...forwards];
    }

    return null;
  }

  /**
   * Collects the consecutive stones of one colour in a single direction,
   * excluding the starting intersection.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} stepX
   * @param {number} stepY
   * @param {number} stone
   * @returns {Cell[]} Cells ordered by increasing distance from the start.
   */
  #walk(x, y, stepX, stepY, stone) {
    /** @type {Cell[]} */
    const cells = [];
    let currentX = x + stepX;
    let currentY = y + stepY;

    while (
      this.isInside(currentX, currentY) &&
      this.#cells[this.#index(currentX, currentY)] === stone
    ) {
      cells.push({ x: currentX, y: currentY });
      currentX += stepX;
      currentY += stepY;
    }

    return cells;
  }
}
