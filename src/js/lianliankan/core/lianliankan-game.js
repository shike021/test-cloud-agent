import {
  DIFFICULTIES,
  FAIL_REASONS,
  GAME_STATUS,
  GENERATION_ATTEMPTS,
  SCORING,
  difficultyIdForStage,
  resolveStageConfig,
  startingStageForDifficulty,
} from './constants.js';
import { findLinkPath } from './path-finder.js';

/**
 * @typedef {import('./constants.js').DifficultyId} DifficultyId
 * @typedef {import('./constants.js').DifficultyConfig} DifficultyConfig
 * @typedef {import('./path-finder.js').Cell} Cell
 * @typedef {import('./path-finder.js').LinkPath} LinkPath
 */

/**
 * @typedef {object} Tile
 * @property {number} row
 * @property {number} col
 * @property {number} type
 */

/**
 * @typedef {object} SelectResult
 * @property {'ignored'|'selected'|'deselected'|'matched'|'rejected'} action
 * @property {string} [reason]
 * @property {LinkPath|null} path
 * @property {number} gained
 * @property {number} combo
 * @property {boolean} cleared
 * @property {boolean} failed
 * @property {string} status
 */

/**
 * Headless, deterministic Lianliankan.
 *
 * The class owns the complete rule set — generation, the three-segment
 * connection test, scoring, hints, undo, the clock and stage progression —
 * and exposes it through a small imperative API. It performs no rendering and
 * touches no browser globals, which makes it both unit testable and reusable
 * across renderers.
 *
 * Randomness is injected, so a seeded generator makes a whole run reproducible.
 */
export class LianliankanGame {
  /** @type {() => number} */
  #random;
  /** @type {DifficultyConfig} */
  #config;
  /** Live board size; may differ from `#config` after `loadBoard`. */
  #rows = 0;
  #cols = 0;
  /** @type {number[][]} */
  #board = [];
  #stage = 1;
  #score = 0;
  #scoreAtStageStart = 0;
  #combo = 0;
  #hints = 0;
  #timeLimitMs = 0;
  #remainingTimeMs = 0;
  #clearBonus = 0;
  /** @type {string} */
  #status = GAME_STATUS.PLAYING;
  /** @type {string|null} */
  #failReason = null;
  /** @type {Cell|null} */
  #selected = null;
  /** @type {LinkPath|null} */
  #lastPath = null;
  /** @type {{ a: Cell, b: Cell }|null} */
  #hintPair = null;
  /**
   * @type {{ a: Cell, b: Cell, type: number, gained: number, comboAfter: number }[]}
   */
  #history = [];

  /**
   * @param {object} [options]
   * @param {() => number} [options.random]
   * @param {DifficultyId} [options.difficulty]
   * @param {number} [options.stage]
   */
  constructor({ random, difficulty = 'easy', stage } = {}) {
    this.#random = random ?? Math.random;
    if (typeof this.#random !== 'function') {
      throw new TypeError('Option "random" must be a function returning values in [0, 1).');
    }
    if (stage !== undefined) {
      this.#stage = stage;
    } else {
      this.#stage = startingStageForDifficulty(difficulty);
    }
    this.#applyStage(this.#stage);
    this.#beginStage({ keepScore: false });
  }

  /* ----------------------------------------------------------------- state */

  get rows() {
    return this.#rows;
  }

  get cols() {
    return this.#cols;
  }

  get tileTypes() {
    return this.#config.tileTypes;
  }

  get stage() {
    return this.#stage;
  }

  /** @returns {DifficultyId} */
  get difficulty() {
    return difficultyIdForStage(this.#stage);
  }

  get score() {
    return this.#score;
  }

  get combo() {
    return this.#combo;
  }

  get remainingHints() {
    return this.#hints;
  }

  get hintLimit() {
    return this.#config.hints;
  }

  /** `0` when the current stage has no clock. */
  get timeLimitMs() {
    return this.#timeLimitMs;
  }

  get remainingTimeMs() {
    return this.#remainingTimeMs;
  }

  get status() {
    return this.#status;
  }

  get failReason() {
    return this.#failReason;
  }

  get isFinished() {
    return this.#status !== GAME_STATUS.PLAYING;
  }

  /** @returns {Cell|null} */
  get selected() {
    return this.#selected ? { ...this.#selected } : null;
  }

  /** @returns {LinkPath|null} */
  get lastPath() {
    return this.#lastPath ? this.#lastPath.map((cell) => ({ ...cell })) : null;
  }

  /** @returns {{ a: Cell, b: Cell }|null} */
  get hintPair() {
    if (!this.#hintPair) {
      return null;
    }
    return { a: { ...this.#hintPair.a }, b: { ...this.#hintPair.b } };
  }

  get tilesRemaining() {
    let count = 0;
    for (const row of this.#board) {
      for (const type of row) {
        if (type > 0) {
          count += 1;
        }
      }
    }
    return count;
  }

  get canUndo() {
    return this.#history.length > 0 && this.#failReason !== FAIL_REASONS.TIMEOUT;
  }

  get canHint() {
    return this.#status === GAME_STATUS.PLAYING && this.#hints > 0;
  }

  get canAdvance() {
    return this.#status === GAME_STATUS.CLEARED;
  }

  /** @returns {readonly Tile[]} */
  get tiles() {
    /** @type {Tile[]} */
    const tiles = [];
    this.#board.forEach((row, rowIndex) => {
      row.forEach((type, colIndex) => {
        if (type > 0) {
          tiles.push({ row: rowIndex, col: colIndex, type });
        }
      });
    });
    return tiles;
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {Tile|null}
   */
  tileAt(row, col) {
    if (!this.#inBounds(row, col)) {
      return null;
    }
    const type = this.#board[row][col];
    return type > 0 ? { row, col, type } : null;
  }

  /** @returns {number[][]} A detached copy of the grid; `0` is empty. */
  toRows() {
    return this.#board.map((row) => row.slice());
  }

  /**
   * Geometry-only search. Tile types are not compared.
   *
   * @param {Cell} from
   * @param {Cell} to
   * @returns {LinkPath|null}
   */
  findPath(from, to) {
    return findLinkPath(this.#rows, this.#cols, this.#board, from, to);
  }

  /**
   * @returns {{ a: Cell, b: Cell, path: LinkPath }|null}
   */
  findAnyMatch() {
    /** @type {Map<number, Cell[]>} */
    const byType = new Map();
    this.#board.forEach((row, rowIndex) => {
      row.forEach((type, colIndex) => {
        if (type <= 0) {
          return;
        }
        const list = byType.get(type);
        const cell = { row: rowIndex, col: colIndex };
        if (list) {
          list.push(cell);
        } else {
          byType.set(type, [cell]);
        }
      });
    });

    for (const cells of byType.values()) {
      for (let first = 0; first < cells.length; first += 1) {
        for (let second = first + 1; second < cells.length; second += 1) {
          const path = this.findPath(cells[first], cells[second]);
          if (path) {
            return { a: { ...cells[first] }, b: { ...cells[second] }, path };
          }
        }
      }
    }
    return null;
  }

  /* --------------------------------------------------------------- control */

  /**
   * Starts a new run at the given difficulty. Score, combo and history reset.
   *
   * @param {DifficultyId} difficulty
   */
  startRun(difficulty) {
    this.#stage = startingStageForDifficulty(difficulty);
    this.#applyStage(this.#stage);
    this.#beginStage({ keepScore: false });
  }

  /** Regenerates the current stage and restores the score earned before it. */
  restartStage() {
    this.#beginStage({ keepScore: true });
  }

  /**
   * Advances to the next stage after a clear. Score carries over.
   *
   * @returns {boolean}
   */
  advance() {
    if (this.#status !== GAME_STATUS.CLEARED) {
      return false;
    }
    this.#stage += 1;
    this.#applyStage(this.#stage);
    this.#beginStage({ keepScore: true, carryScore: true });
    return true;
  }

  /**
   * Selects a tile or tries to match it with the currently selected one.
   *
   * @param {number} row
   * @param {number} col
   * @returns {SelectResult}
   */
  select(row, col) {
    if (this.#status !== GAME_STATUS.PLAYING) {
      return this.#selectResult('ignored', { reason: 'finished' });
    }
    if (!this.#inBounds(row, col)) {
      return this.#selectResult('ignored', { reason: 'out-of-bounds' });
    }

    const type = this.#board[row][col];
    if (type === 0) {
      return this.#selectResult('ignored', { reason: 'empty' });
    }

    const current = this.#selected;
    if (!current) {
      this.#selected = { row, col };
      return this.#selectResult('selected');
    }

    if (current.row === row && current.col === col) {
      this.#selected = null;
      return this.#selectResult('deselected');
    }

    const currentType = this.#board[current.row][current.col];
    if (currentType !== type) {
      this.#combo = 0;
      this.#selected = { row, col };
      return this.#selectResult('rejected', { reason: 'type-mismatch' });
    }

    const path = this.findPath(current, { row, col });
    if (!path) {
      this.#combo = 0;
      this.#selected = { row, col };
      return this.#selectResult('rejected', { reason: 'blocked' });
    }

    this.#combo += 1;
    const gained = (SCORING.matchBase + (this.#combo - 1) * SCORING.comboBonus) * this.#stage;
    this.#score += gained;
    this.#history.push({
      a: { ...current },
      b: { row, col },
      type,
      gained,
      comboAfter: this.#combo,
    });
    this.#board[current.row][current.col] = 0;
    this.#board[row][col] = 0;
    this.#selected = null;
    this.#hintPair = null;
    this.#lastPath = path;

    if (this.tilesRemaining === 0) {
      const remainingSeconds = this.#timeLimitMs > 0 ? Math.floor(this.#remainingTimeMs / 1000) : 0;
      this.#clearBonus =
        remainingSeconds * SCORING.timeBonusPerSecond * this.#stage +
        SCORING.clearBonus * this.#stage;
      this.#score += this.#clearBonus;
      this.#status = GAME_STATUS.CLEARED;
      this.#failReason = null;
    } else if (!this.findAnyMatch()) {
      this.#status = GAME_STATUS.FAILED;
      this.#failReason = FAIL_REASONS.DEADLOCK;
    }

    return this.#selectResult('matched', { path, gained });
  }

  /** Clears the current selection without touching the board. */
  clearSelection() {
    this.#selected = null;
  }

  /**
   * Highlights one legal pair and spends a hint.
   *
   * @returns {{ a: Cell, b: Cell, path: LinkPath }|null}
   */
  hint() {
    if (!this.canHint) {
      return null;
    }
    const match = this.findAnyMatch();
    if (!match) {
      return null;
    }
    this.#hints -= 1;
    this.#hintPair = { a: match.a, b: match.b };
    this.#lastPath = match.path;
    return match;
  }

  /**
   * Restores the tiles from the most recent match.
   *
   * @returns {boolean}
   */
  undo() {
    if (!this.canUndo) {
      return false;
    }

    const last = this.#history.pop();
    if (!last) {
      return false;
    }

    this.#board[last.a.row][last.a.col] = last.type;
    this.#board[last.b.row][last.b.col] = last.type;
    this.#score -= last.gained;
    if (this.#status === GAME_STATUS.CLEARED) {
      this.#score -= this.#clearBonus;
      this.#clearBonus = 0;
    }
    this.#combo = Math.max(0, last.comboAfter - 1);
    this.#status = GAME_STATUS.PLAYING;
    this.#failReason = null;
    this.#selected = null;
    this.#hintPair = null;
    this.#lastPath = null;
    return true;
  }

  /**
   * Advances the stage clock. The core never reads the wall clock itself.
   *
   * @param {number} deltaMs
   * @returns {string} Status after the tick.
   */
  tick(deltaMs) {
    if (this.#status !== GAME_STATUS.PLAYING || this.#timeLimitMs === 0) {
      return this.#status;
    }
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return this.#status;
    }

    this.#remainingTimeMs = Math.max(0, this.#remainingTimeMs - deltaMs);
    if (this.#remainingTimeMs === 0) {
      this.#status = GAME_STATUS.FAILED;
      this.#failReason = FAIL_REASONS.TIMEOUT;
    }
    return this.#status;
  }

  /**
   * Replaces the board with an explicit position. Intended for tests.
   *
   * @param {readonly (readonly number[])[]} rows
   * @param {object} [state]
   * @param {number} [state.score]
   * @param {number} [state.combo]
   * @param {number} [state.remainingHints]
   * @param {number} [state.remainingTimeMs]
   * @param {boolean} [state.evaluate] When `false`, status is left at playing.
   */
  loadBoard(rows, { score = 0, combo = 0, remainingHints, remainingTimeMs, evaluate = true } = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new RangeError('loadBoard expects a non-empty list of rows.');
    }
    const width = rows[0]?.length;
    if (!Number.isInteger(width) || width < 2) {
      throw new RangeError('loadBoard expects at least two columns.');
    }
    rows.forEach((row, index) => {
      if (!Array.isArray(row) || row.length !== width) {
        throw new RangeError(
          `loadBoard expects ${width} values in row ${index}, received: ${row?.length}`,
        );
      }
      for (const value of row) {
        if (!Number.isInteger(value) || value < 0) {
          throw new RangeError(`loadBoard expects non-negative integers, received: ${value}`);
        }
      }
    });
    if (!Number.isInteger(score) || score < 0) {
      throw new RangeError(`loadBoard expects a non-negative integer score, received: ${score}`);
    }
    if (!Number.isInteger(combo) || combo < 0) {
      throw new RangeError(`loadBoard expects a non-negative integer combo, received: ${combo}`);
    }

    this.#rows = rows.length;
    this.#cols = width;
    this.#board = rows.map((row) => row.slice());
    this.#score = score;
    this.#scoreAtStageStart = score;
    this.#combo = combo;
    this.#clearBonus = 0;
    this.#history = [];
    this.#selected = null;
    this.#lastPath = null;
    this.#hintPair = null;
    this.#status = GAME_STATUS.PLAYING;
    this.#failReason = null;

    if (remainingHints !== undefined) {
      if (!Number.isInteger(remainingHints) || remainingHints < 0) {
        throw new RangeError(
          `loadBoard expects a non-negative hint count, received: ${remainingHints}`,
        );
      }
      this.#hints = remainingHints;
    }
    if (remainingTimeMs !== undefined) {
      if (!Number.isFinite(remainingTimeMs) || remainingTimeMs < 0) {
        throw new RangeError(
          `loadBoard expects a non-negative remaining time, received: ${remainingTimeMs}`,
        );
      }
      this.#remainingTimeMs = remainingTimeMs;
      this.#timeLimitMs = remainingTimeMs > 0 ? remainingTimeMs : this.#timeLimitMs;
    }

    if (!evaluate) {
      return;
    }
    if (this.tilesRemaining === 0) {
      this.#status = GAME_STATUS.CLEARED;
    } else if (!this.findAnyMatch()) {
      this.#status = GAME_STATUS.FAILED;
      this.#failReason = FAIL_REASONS.DEADLOCK;
    }
  }

  /* --------------------------------------------------------------- helpers */

  /**
   * @param {number} stage
   */
  #applyStage(stage) {
    this.#config = resolveStageConfig(stage);
    this.#rows = this.#config.rows;
    this.#cols = this.#config.cols;
    this.#timeLimitMs = this.#config.timeLimitMs;
  }

  /**
   * @param {{ keepScore: boolean, carryScore?: boolean }} options
   */
  #beginStage({ keepScore, carryScore = false }) {
    if (!keepScore) {
      this.#score = 0;
      this.#scoreAtStageStart = 0;
    } else if (carryScore) {
      this.#scoreAtStageStart = this.#score;
    } else {
      this.#score = this.#scoreAtStageStart;
    }

    this.#combo = 0;
    this.#clearBonus = 0;
    this.#history = [];
    this.#selected = null;
    this.#lastPath = null;
    this.#hintPair = null;
    this.#status = GAME_STATUS.PLAYING;
    this.#failReason = null;
    this.#hints = this.#config.hints;
    this.#remainingTimeMs = this.#timeLimitMs;
    this.#generateBoard();
  }

  #generateBoard() {
    const { rows, cols, tileTypes } = this.#config;
    const total = rows * cols;
    if (total % 2 !== 0) {
      throw new RangeError(`Board ${rows}×${cols} has an odd number of cells.`);
    }
    if (!Number.isInteger(tileTypes) || tileTypes < 1) {
      throw new RangeError(`Option "tileTypes" must be an integer >= 1, received: ${tileTypes}`);
    }

    const pairTypes = Array.from({ length: total / 2 }, (_, index) => (index % tileTypes) + 1);

    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
      this.#shuffle(pairTypes);
      const placed = this.#placePairs(rows, cols, pairTypes);
      if (placed) {
        this.#board = placed;
        this.#rows = rows;
        this.#cols = cols;
        return;
      }
    }

    this.#board = this.#scatterPairs(rows, cols, pairTypes);
    this.#rows = rows;
    this.#cols = cols;
  }

  /**
   * Reverse-generation: each newly placed pair is connectable on the board
   * as it stands, so removing pairs in reverse order is a valid solution.
   *
   * @param {number} rows
   * @param {number} cols
   * @param {readonly number[]} pairTypes
   * @returns {number[][]|null}
   */
  #placePairs(rows, cols, pairTypes) {
    const board = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    /** @type {Cell[]} */
    const empty = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        empty.push({ row, col });
      }
    }

    for (const type of pairTypes) {
      this.#shuffle(empty);
      let placed = false;
      for (let first = 0; first < empty.length && !placed; first += 1) {
        for (let second = first + 1; second < empty.length; second += 1) {
          const origin = empty[first];
          const target = empty[second];
          if (!findLinkPath(rows, cols, board, origin, target)) {
            continue;
          }
          board[origin.row][origin.col] = type;
          board[target.row][target.col] = type;
          empty.splice(second, 1);
          empty.splice(first, 1);
          placed = true;
          break;
        }
      }
      if (!placed) {
        return null;
      }
    }
    return board;
  }

  /**
   * Last-resort fill that does not guarantee solvability. A deadlocked board
   * is reported as a failed stage so the player can restart.
   *
   * @param {number} rows
   * @param {number} cols
   * @param {readonly number[]} pairTypes
   * @returns {number[][]}
   */
  #scatterPairs(rows, cols, pairTypes) {
    const values = pairTypes.flatMap((type) => [type, type]);
    this.#shuffle(values);
    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (__, col) => values[row * cols + col]),
    );
  }

  /**
   * @template T
   * @param {T[]} items
   */
  #shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(this.#randomUnit() * (index + 1));
      const current = items[index];
      items[index] = items[swapWith];
      items[swapWith] = current;
    }
  }

  /**
   * @returns {number} A value in `[0, 1)`.
   */
  #randomUnit() {
    const value = this.#random();
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return Math.min(value, 1 - Number.EPSILON);
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  #inBounds(row, col) {
    return (
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      row >= 0 &&
      row < this.rows &&
      col >= 0 &&
      col < this.cols
    );
  }

  /**
   * @param {SelectResult['action']} action
   * @param {Partial<SelectResult>} [extra]
   * @returns {SelectResult}
   */
  #selectResult(action, extra = {}) {
    return {
      action,
      path: null,
      gained: 0,
      combo: this.#combo,
      cleared: this.#status === GAME_STATUS.CLEARED,
      failed: this.#status === GAME_STATUS.FAILED,
      status: this.#status,
      ...extra,
    };
  }
}

export { DIFFICULTIES, GAME_STATUS };
