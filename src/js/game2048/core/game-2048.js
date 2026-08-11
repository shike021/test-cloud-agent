import { DEFAULT_OPTIONS, DIRECTION_VECTORS, GAME_STATUS } from './constants.js';

/**
 * @typedef {import('./constants.js').DirectionName} DirectionName
 */

/**
 * A tile on the board.
 *
 * `previous`, `isNew` and `isMerged` describe what the last move did to the
 * tile, which is all a renderer needs to animate it.
 *
 * @typedef {object} Tile
 * @property {number} id                              Stable across moves.
 * @property {number} value
 * @property {number} x                               Column, 0-based.
 * @property {number} y                               Row, 0-based.
 * @property {{ x: number, y: number }|null} previous Position before the move.
 * @property {boolean} isNew                          Spawned by the last move.
 * @property {boolean} isMerged                       Created by a merge.
 */

/**
 * @typedef {object} MoveResult
 * @property {boolean} moved             Whether anything slid or merged.
 * @property {DirectionName} direction
 * @property {number} gained             Points scored by this move.
 * @property {number} score              Total score after the move.
 * @property {number} merges             Number of merges in this move.
 * @property {number} largestMerge       Biggest tile created, `0` without merges.
 * @property {Tile|null} spawned         The tile added after the move.
 * @property {readonly Tile[]} removed   Tiles consumed by merges.
 * @property {boolean} won               Whether this move reached the win tile.
 * @property {boolean} gameOver          Whether the board ran out of moves.
 * @property {string} status             The status after the move.
 */

/** Order in which cells are visited, per axis, for a given movement vector. */
const ASCENDING = 1;

/**
 * Headless, deterministic 2048.
 *
 * The class owns the complete rule set — sliding, the "one merge per tile per
 * move" rule, scoring, spawning, the win condition and game over detection —
 * and exposes it through a small imperative API. It performs no rendering and
 * touches no browser globals, which makes it both unit testable and reusable
 * across renderers.
 *
 * Randomness is injected, so a seeded generator makes a whole run reproducible.
 */
export class Game2048 {
  /** @type {{ size: number, winTile: number, startTiles: number, fourProbability: number }} */
  #options;
  /** @type {() => number} */
  #random;
  /** @type {(Tile|null)[]} Row-major board. */
  #cells;
  #score = 0;
  #moveCount = 0;
  /** @type {string} */
  #status = GAME_STATUS.PLAYING;
  #hasWon = false;
  /** Ids are never reused, so a renderer can key its DOM nodes by them. */
  #nextTileId = 1;
  /** @type {Tile[]} Tiles the last move merged away, kept for animations. */
  #removed = [];

  /**
   * @param {Partial<typeof DEFAULT_OPTIONS> & { random?: () => number }} [options]
   */
  constructor({ random, ...options } = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options };
    this.#random = random ?? Math.random;
    this.#validateOptions();
    this.#cells = new Array(this.#options.size * this.#options.size).fill(null);
    this.reset();
  }

  #validateOptions() {
    const { size, winTile, startTiles, fourProbability } = this.#options;

    if (!Number.isInteger(size) || size < 2) {
      throw new RangeError(`Option "size" must be an integer >= 2, received: ${size}`);
    }
    if (!Number.isInteger(winTile) || winTile < 4 || (winTile & (winTile - 1)) !== 0) {
      throw new RangeError(`Option "winTile" must be a power of two >= 4, received: ${winTile}`);
    }
    if (!Number.isInteger(startTiles) || startTiles < 1 || startTiles >= size * size) {
      throw new RangeError(
        `Option "startTiles" must be an integer between 1 and ${size * size - 1}, ` +
          `received: ${startTiles}`,
      );
    }
    if (!Number.isFinite(fourProbability) || fourProbability < 0 || fourProbability > 1) {
      throw new RangeError(
        `Option "fourProbability" must be a number in [0, 1], received: ${fourProbability}`,
      );
    }
    if (typeof this.#random !== 'function') {
      throw new TypeError('Option "random" must be a function returning values in [0, 1).');
    }
  }

  /* ----------------------------------------------------------------- state */

  get size() {
    return this.#options.size;
  }

  get winTile() {
    return this.#options.winTile;
  }

  get score() {
    return this.#score;
  }

  get moveCount() {
    return this.#moveCount;
  }

  get status() {
    return this.#status;
  }

  /** @returns {boolean} Whether the win tile has appeared at any point. */
  get hasWon() {
    return this.#hasWon;
  }

  /** @returns {boolean} Whether {@link Game2048#move} would refuse every move. */
  get isFinished() {
    return this.#status !== GAME_STATUS.PLAYING;
  }

  /** @returns {readonly Tile[]} The live tiles, in row-major order. */
  get tiles() {
    /** @type {Tile[]} */
    const tiles = [];
    for (const tile of this.#cells) {
      if (tile) {
        tiles.push(snapshot(tile));
      }
    }
    return tiles;
  }

  /**
   * The tiles that disappeared into merges during the last move, carrying the
   * position they slid to so a renderer can animate them out.
   *
   * @returns {readonly Tile[]}
   */
  get removedTiles() {
    return this.#removed.map(snapshot);
  }

  get emptyCellCount() {
    let count = 0;
    for (const tile of this.#cells) {
      if (!tile) {
        count += 1;
      }
    }
    return count;
  }

  /** @returns {number} Value of the biggest tile, `0` on an empty board. */
  get largestTile() {
    let largest = 0;
    for (const tile of this.#cells) {
      if (tile && tile.value > largest) {
        largest = tile.value;
      }
    }
    return largest;
  }

  /** @returns {boolean} Whether at least one direction would change the board. */
  get hasMoves() {
    if (this.emptyCellCount > 0) {
      return true;
    }
    const { size } = this.#options;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const value = this.#at(x, y)?.value;
        if (value === this.#at(x + 1, y)?.value || value === this.#at(x, y + 1)?.value) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Tile|null} The tile on the cell, if any.
   */
  tileAt(x, y) {
    const tile = this.#at(x, y);
    return tile ? snapshot(tile) : null;
  }

  /** @returns {number[][]} The board values as rows, `0` for empty cells. */
  toRows() {
    const { size } = this.#options;
    return Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (__, x) => this.#at(x, y)?.value ?? 0),
    );
  }

  /* --------------------------------------------------------------- control */

  /** Clears the board, resets the score and deals the opening tiles. */
  reset() {
    this.#cells.fill(null);
    this.#score = 0;
    this.#moveCount = 0;
    this.#status = GAME_STATUS.PLAYING;
    this.#hasWon = false;
    this.#removed = [];

    for (let i = 0; i < this.#options.startTiles; i += 1) {
      this.#spawnTile();
    }
  }

  /**
   * Replaces the board with an explicit position.
   *
   * Intended for tests and for restoring a saved run: it bypasses the random
   * spawner so a scenario can be set up exactly.
   *
   * @param {readonly (readonly number[])[]} rows Values per row, `0` for empty.
   * @param {{ score?: number }} [state] Score that belongs to the position.
   */
  loadBoard(rows, { score = 0 } = {}) {
    const { size } = this.#options;

    if (!Array.isArray(rows) || rows.length !== size) {
      throw new RangeError(`loadBoard expects ${size} rows, received: ${rows?.length}`);
    }
    if (!Number.isInteger(score) || score < 0) {
      throw new RangeError(`loadBoard expects a non-negative integer score, received: ${score}`);
    }

    rows.forEach((row, y) => {
      if (!Array.isArray(row) || row.length !== size) {
        throw new RangeError(`loadBoard expects ${size} values in row ${y}, received: ${row}`);
      }
      for (const value of row) {
        if (value !== 0 && !isTileValue(value)) {
          throw new RangeError(`loadBoard expects 0 or a power of two >= 2, received: ${value}`);
        }
      }
    });

    this.#cells.fill(null);
    this.#removed = [];
    this.#score = score;
    this.#moveCount = 0;

    rows.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          this.#cells[this.#index(x, y)] = this.#createTile(x, y, value);
        }
      });
    });

    // A position that already contains the win tile counts as "won and
    // continued", so loading it does not immediately raise the win overlay.
    this.#hasWon = this.largestTile >= this.#options.winTile;
    this.#status = this.hasMoves ? GAME_STATUS.PLAYING : GAME_STATUS.GAME_OVER;
  }

  /**
   * Slides and merges every tile one step in `direction`.
   *
   * Each tile merges at most once per move, and merges resolve from the far
   * edge inwards, exactly like the original game: `[2, 2, 4]` moved left
   * becomes `[4, 4]` rather than `[8]`.
   *
   * @param {DirectionName} direction
   * @returns {MoveResult}
   */
  move(direction) {
    const vector = Object.hasOwn(DIRECTION_VECTORS, direction)
      ? DIRECTION_VECTORS[direction]
      : null;
    if (!vector) {
      throw new RangeError(`Unknown direction: ${direction}`);
    }
    if (this.isFinished) {
      return this.#result(direction, { moved: false });
    }

    this.#prepareTiles();

    let moved = false;
    let gained = 0;
    let merges = 0;
    let largestMerge = 0;

    for (const y of this.#traversal(vector.y)) {
      for (const x of this.#traversal(vector.x)) {
        const tile = this.#at(x, y);
        if (!tile) {
          continue;
        }

        const { farthest, next } = this.#findFarthest(x, y, vector);

        if (next && next.value === tile.value && !next.isMerged) {
          const value = tile.value * 2;
          const merged = this.#createTile(next.x, next.y, value);
          merged.isMerged = true;

          this.#cells[this.#index(next.x, next.y)] = merged;
          this.#cells[this.#index(x, y)] = null;
          // The consumed tile keeps its `previous` cell so it can be animated
          // sliding into the merge before it is dropped.
          tile.x = next.x;
          tile.y = next.y;
          this.#removed.push(tile, next);

          this.#score += value;
          gained += value;
          merges += 1;
          largestMerge = Math.max(largestMerge, value);
          moved = true;
        } else if (farthest.x !== x || farthest.y !== y) {
          this.#cells[this.#index(x, y)] = null;
          this.#cells[this.#index(farthest.x, farthest.y)] = tile;
          tile.x = farthest.x;
          tile.y = farthest.y;
          moved = true;
        }
      }
    }

    if (!moved) {
      return this.#result(direction, { moved: false });
    }

    this.#moveCount += 1;
    const spawned = this.#spawnTile();
    const won = !this.#hasWon && largestMerge >= this.#options.winTile;

    if (won) {
      this.#hasWon = true;
      this.#status = GAME_STATUS.WON;
    } else if (!this.hasMoves) {
      this.#status = GAME_STATUS.GAME_OVER;
    }

    return this.#result(direction, {
      moved: true,
      gained,
      merges,
      largestMerge,
      spawned,
      won,
    });
  }

  /**
   * Dismisses the win overlay and keeps the run going.
   *
   * @returns {boolean} `false` when the run is not waiting on that decision.
   */
  continueAfterWin() {
    if (this.#status !== GAME_STATUS.WON) {
      return false;
    }
    // Winning with a full board is possible, so the run can be over already.
    this.#status = this.hasMoves ? GAME_STATUS.PLAYING : GAME_STATUS.GAME_OVER;
    return true;
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
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  #isInside(x, y) {
    const { size } = this.#options;
    return x >= 0 && y >= 0 && x < size && y < size;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Tile|null}
   */
  #at(x, y) {
    return this.#isInside(x, y) ? this.#cells[this.#index(x, y)] : null;
  }

  /**
   * Cell indices along one axis, visited from the edge the tiles move towards
   * so that the leading tiles are packed first.
   *
   * @param {number} component Vector component of the axis.
   * @returns {number[]}
   */
  #traversal(component) {
    const indices = Array.from({ length: this.#options.size }, (_, index) => index);
    return component === ASCENDING ? indices.reverse() : indices;
  }

  /** Clears the per-move bookkeeping before a new move is applied. */
  #prepareTiles() {
    this.#removed = [];
    for (const tile of this.#cells) {
      if (tile) {
        tile.previous = { x: tile.x, y: tile.y };
        tile.isNew = false;
        tile.isMerged = false;
      }
    }
  }

  /**
   * Walks from a cell until the next cell is occupied or off the board.
   *
   * @param {number} x
   * @param {number} y
   * @param {{ x: number, y: number }} vector
   * @returns {{ farthest: { x: number, y: number }, next: Tile|null }}
   */
  #findFarthest(x, y, vector) {
    let currentX = x;
    let currentY = y;
    let nextX = x + vector.x;
    let nextY = y + vector.y;

    while (this.#isInside(nextX, nextY) && !this.#cells[this.#index(nextX, nextY)]) {
      currentX = nextX;
      currentY = nextY;
      nextX += vector.x;
      nextY += vector.y;
    }

    return { farthest: { x: currentX, y: currentY }, next: this.#at(nextX, nextY) };
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @returns {Tile}
   */
  #createTile(x, y, value) {
    const id = this.#nextTileId;
    this.#nextTileId += 1;
    return { id, value, x, y, previous: null, isNew: false, isMerged: false };
  }

  /**
   * Places a 2 or a 4 on a random free cell.
   *
   * @returns {Tile|null} `null` when the board is full.
   */
  #spawnTile() {
    /** @type {number[]} */
    const free = [];
    for (let index = 0; index < this.#cells.length; index += 1) {
      if (!this.#cells[index]) {
        free.push(index);
      }
    }
    if (free.length === 0) {
      return null;
    }

    const index = free[Math.floor(this.#randomUnit() * free.length)];
    const value = this.#randomUnit() < this.#options.fourProbability ? 4 : 2;
    const { size } = this.#options;
    const tile = this.#createTile(index % size, Math.floor(index / size), value);
    tile.isNew = true;
    this.#cells[index] = tile;
    return tile;
  }

  /**
   * @returns {number} A value in `[0, 1)`, even if the injected generator
   *   misbehaves — an out of range value would otherwise index past the board.
   */
  #randomUnit() {
    const value = this.#random();
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return Math.min(value, 1 - Number.EPSILON);
  }

  /**
   * @param {DirectionName} direction
   * @param {Partial<MoveResult>} outcome
   * @returns {MoveResult}
   */
  #result(direction, outcome) {
    return {
      moved: false,
      direction,
      gained: 0,
      merges: 0,
      largestMerge: 0,
      spawned: null,
      won: false,
      ...outcome,
      score: this.#score,
      removed: this.removedTiles,
      gameOver: this.#status === GAME_STATUS.GAME_OVER,
      status: this.#status,
    };
  }
}

/**
 * @param {Tile} tile
 * @returns {Tile} A detached copy, so callers cannot mutate the board.
 */
function snapshot(tile) {
  return {
    id: tile.id,
    value: tile.value,
    x: tile.x,
    y: tile.y,
    previous: tile.previous ? { x: tile.previous.x, y: tile.previous.y } : null,
    isNew: tile.isNew,
    isMerged: tile.isMerged,
  };
}

/**
 * @param {number} value
 * @returns {boolean}
 */
function isTileValue(value) {
  return Number.isInteger(value) && value >= 2 && (value & (value - 1)) === 0;
}
