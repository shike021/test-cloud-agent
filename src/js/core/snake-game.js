import {
  DEATH_CAUSE,
  DEFAULT_OPTIONS,
  DIRECTIONS,
  FOOD_TYPE,
  GAME_STATUS,
  OPPOSITE_DIRECTION,
} from './constants.js';

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {{ x: number, y: number, type: string }} Food
 * @typedef {Food & { ticksRemaining: number, lifetimeTicks: number }} BonusFood
 * @typedef {import('./constants.js').DirectionName} DirectionName
 */

/**
 * @typedef {object} TickResult
 * @property {boolean} moved            Whether the snake advanced one cell.
 * @property {Food|null} eaten          The food item consumed during the tick.
 * @property {number} gainedPoints      Points awarded during the tick.
 * @property {boolean} levelUp          Whether the level increased.
 * @property {boolean} bonusSpawned     Whether a bonus item appeared.
 * @property {boolean} bonusExpired     Whether a bonus item timed out.
 * @property {boolean} gameOver         Whether the run ended in a collision.
 * @property {boolean} won              Whether the board was completely filled.
 * @property {string} status            The status after the tick.
 */

const REQUIRED_POSITIVE_INTEGERS = [
  'cols',
  'rows',
  'initialLength',
  'pointsPerLevel',
  'bonusFoodInterval',
  'bonusFoodLifetimeTicks',
  'maxQueuedDirections',
];

/**
 * Headless, deterministic snake game.
 *
 * The class owns the complete rule set (movement, growth, collisions, scoring,
 * levelling and food spawning) and exposes it through a small imperative API.
 * It performs no rendering and touches no browser globals, which makes it both
 * unit testable and reusable across renderers.
 */
export class SnakeGame {
  /** @type {Required<typeof DEFAULT_OPTIONS>} */
  #options;
  /** @type {() => number} */
  #random;
  /** @type {Cell[]} Head first, tail last. */
  #snake = [];
  /** @type {Cell[]} Snapshot of {@link SnakeGame#snake} before the last tick. */
  #previousSnake = [];
  /** @type {DirectionName} */
  #direction = 'right';
  /** @type {DirectionName[]} */
  #queuedDirections = [];
  /** @type {Food|null} */
  #food = null;
  /** @type {BonusFood|null} */
  #bonusFood = null;
  #score = 0;
  #normalFoodEaten = 0;
  #ticks = 0;
  /** @type {string} */
  #status = GAME_STATUS.IDLE;
  /** @type {string|null} */
  #deathCause = null;

  /**
   * @param {Partial<typeof DEFAULT_OPTIONS> & { random?: () => number }} [options]
   */
  constructor(options = {}) {
    const { random = Math.random, ...rest } = options;
    this.#options = { ...DEFAULT_OPTIONS, ...rest };
    this.#random = random;
    this.#validateOptions();
    this.reset();
  }

  #validateOptions() {
    const options = this.#options;

    for (const key of REQUIRED_POSITIVE_INTEGERS) {
      const value = options[key];
      if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`Option "${key}" must be a positive integer, received: ${value}`);
      }
    }

    if (options.cols < options.initialLength + 1) {
      throw new RangeError(
        `Option "cols" (${options.cols}) must leave room for the initial snake ` +
          `(initialLength ${options.initialLength} + 1).`,
      );
    }

    if (options.minTickMs <= 0 || options.baseTickMs < options.minTickMs) {
      throw new RangeError('Option "baseTickMs" must be greater than or equal to "minTickMs".');
    }
  }

  /* ----------------------------------------------------------------- state */

  get cols() {
    return this.#options.cols;
  }

  get rows() {
    return this.#options.rows;
  }

  /** @returns {readonly Cell[]} Live snake body, head first. */
  get snake() {
    return this.#snake;
  }

  /**
   * Snake body as it was before the most recent tick. Renderers use it to
   * interpolate between two discrete grid states for smooth motion.
   *
   * @returns {readonly Cell[]}
   */
  get previousSnake() {
    return this.#previousSnake;
  }

  get head() {
    return this.#snake[0];
  }

  /** @returns {Food|null} */
  get food() {
    return this.#food;
  }

  /** @returns {BonusFood|null} */
  get bonusFood() {
    return this.#bonusFood;
  }

  get score() {
    return this.#score;
  }

  get ticks() {
    return this.#ticks;
  }

  get status() {
    return this.#status;
  }

  get deathCause() {
    return this.#deathCause;
  }

  get direction() {
    return this.#direction;
  }

  get isRunning() {
    return this.#status === GAME_STATUS.RUNNING;
  }

  get isFinished() {
    return this.#status === GAME_STATUS.GAME_OVER || this.#status === GAME_STATUS.WON;
  }

  /** Levels start at 1 and increase every `pointsPerLevel` points. */
  get level() {
    return 1 + Math.floor(this.#score / this.#options.pointsPerLevel);
  }

  /** Current delay between two ticks, derived from the level. */
  get tickIntervalMs() {
    const { baseTickMs, minTickMs, speedUpPerLevelMs } = this.#options;
    return Math.max(minTickMs, baseTickMs - (this.level - 1) * speedUpPerLevelMs);
  }

  /* --------------------------------------------------------------- control */

  /** Rebuilds the initial board and returns the game to the idle state. */
  reset() {
    const { cols, rows, initialLength } = this.#options;
    const startY = Math.floor(rows / 2);
    const startX = Math.floor(cols / 2);

    this.#snake = Array.from({ length: initialLength }, (_, index) => ({
      x: Math.max(0, startX - index),
      y: startY,
    }));
    this.#previousSnake = this.#cloneSnake();
    this.#direction = 'right';
    this.#queuedDirections = [];
    this.#score = 0;
    this.#normalFoodEaten = 0;
    this.#ticks = 0;
    this.#bonusFood = null;
    this.#deathCause = null;
    this.#status = GAME_STATUS.IDLE;
    this.#food = this.#spawnFood(FOOD_TYPE.NORMAL);
  }

  /** Starts an idle game. Finished games are reset first. */
  start() {
    if (this.isFinished) {
      this.reset();
    }
    if (this.#status === GAME_STATUS.IDLE || this.#status === GAME_STATUS.PAUSED) {
      this.#status = GAME_STATUS.RUNNING;
    }
    return this.#status;
  }

  /** Restarts from scratch and immediately runs. */
  restart() {
    this.reset();
    return this.start();
  }

  pause() {
    if (this.#status === GAME_STATUS.RUNNING) {
      this.#status = GAME_STATUS.PAUSED;
    }
    return this.#status;
  }

  resume() {
    if (this.#status === GAME_STATUS.PAUSED) {
      this.#status = GAME_STATUS.RUNNING;
    }
    return this.#status;
  }

  /** Toggles between running and paused; starts an idle game. */
  togglePause() {
    if (this.#status === GAME_STATUS.RUNNING) {
      return this.pause();
    }
    if (this.#status === GAME_STATUS.PAUSED || this.#status === GAME_STATUS.IDLE) {
      return this.start();
    }
    return this.#status;
  }

  /**
   * Buffers a direction change.
   *
   * Buffering (instead of overwriting the current direction) makes fast
   * successive inputs such as "up then left" behave as the player expects even
   * when both keys are pressed within a single tick.
   *
   * @param {DirectionName} name
   * @returns {boolean} `true` when the input was accepted.
   */
  enqueueDirection(name) {
    if (!Object.hasOwn(DIRECTIONS, name)) {
      return false;
    }
    if (this.isFinished) {
      return false;
    }

    const reference = this.#queuedDirections.at(-1) ?? this.#direction;
    if (name === reference || name === OPPOSITE_DIRECTION[reference]) {
      return false;
    }
    if (this.#queuedDirections.length >= this.#options.maxQueuedDirections) {
      return false;
    }

    this.#queuedDirections.push(name);
    return true;
  }

  /* ------------------------------------------------------------------ tick */

  /**
   * Advances the simulation by exactly one step.
   *
   * @returns {TickResult}
   */
  tick() {
    /** @type {TickResult} */
    const result = {
      moved: false,
      eaten: null,
      gainedPoints: 0,
      levelUp: false,
      bonusSpawned: false,
      bonusExpired: false,
      gameOver: false,
      won: false,
      status: this.#status,
    };

    if (!this.isRunning) {
      return result;
    }

    const levelBefore = this.level;
    this.#previousSnake = this.#cloneSnake();

    const nextDirection = this.#queuedDirections.shift();
    if (nextDirection) {
      this.#direction = nextDirection;
    }

    const target = this.#nextHeadCell();
    if (target === null) {
      return this.#finish(result, DEATH_CAUSE.WALL);
    }

    const eatenFood = this.#foodAt(target);
    const willGrow = eatenFood !== null && eatenFood.type === FOOD_TYPE.NORMAL;

    if (this.#collidesWithBody(target, { tailMoves: !willGrow })) {
      return this.#finish(result, DEATH_CAUSE.SELF);
    }

    this.#snake.unshift(target);
    if (!willGrow) {
      this.#snake.pop();
    }

    this.#ticks += 1;
    result.moved = true;

    if (eatenFood !== null) {
      result.eaten = eatenFood;
      result.gainedPoints = this.#consume(eatenFood);
      this.#score += result.gainedPoints;
    }

    if (this.#bonusFood !== null && eatenFood?.type !== FOOD_TYPE.BONUS) {
      this.#bonusFood.ticksRemaining -= 1;
      if (this.#bonusFood.ticksRemaining <= 0) {
        this.#bonusFood = null;
        result.bonusExpired = true;
      }
    }

    if (eatenFood?.type === FOOD_TYPE.NORMAL) {
      this.#food = this.#spawnFood(FOOD_TYPE.NORMAL);
      if (this.#food === null) {
        result.won = true;
        this.#status = GAME_STATUS.WON;
        result.status = this.#status;
        return result;
      }
      if (this.#shouldSpawnBonus()) {
        this.#bonusFood = /** @type {BonusFood|null} */ (this.#spawnFood(FOOD_TYPE.BONUS));
        result.bonusSpawned = this.#bonusFood !== null;
      }
    }

    result.levelUp = this.level > levelBefore;
    result.status = this.#status;
    return result;
  }

  /* --------------------------------------------------------------- helpers */

  /** @returns {boolean} Whether any snake segment occupies the given cell. */
  occupiesCell(x, y) {
    return this.#snake.some((segment) => segment.x === x && segment.y === y);
  }

  #cloneSnake() {
    return this.#snake.map((segment) => ({ x: segment.x, y: segment.y }));
  }

  /**
   * @returns {Cell|null} The next head cell, or `null` when the snake ran into
   *   a wall while wall collisions are enabled.
   */
  #nextHeadCell() {
    const { cols, rows, wallCollision } = this.#options;
    const vector = DIRECTIONS[this.#direction];
    const head = this.#snake[0];
    let x = head.x + vector.x;
    let y = head.y + vector.y;

    if (x < 0 || y < 0 || x >= cols || y >= rows) {
      if (wallCollision) {
        return null;
      }
      x = (x + cols) % cols;
      y = (y + rows) % rows;
    }

    return { x, y };
  }

  /**
   * @param {Cell} cell
   * @param {{ tailMoves: boolean }} options When the tail moves away during the
   *   same tick, its cell is a legal target.
   */
  #collidesWithBody(cell, { tailMoves }) {
    const lastIndex = this.#snake.length - 1;
    for (let index = 0; index <= lastIndex; index += 1) {
      if (tailMoves && index === lastIndex) {
        continue;
      }
      const segment = this.#snake[index];
      if (segment.x === cell.x && segment.y === cell.y) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {Cell} cell
   * @returns {Food|null}
   */
  #foodAt(cell) {
    if (this.#bonusFood && this.#bonusFood.x === cell.x && this.#bonusFood.y === cell.y) {
      return this.#bonusFood;
    }
    if (this.#food && this.#food.x === cell.x && this.#food.y === cell.y) {
      return this.#food;
    }
    return null;
  }

  /**
   * Applies the side effects of eating and returns the awarded points.
   *
   * @param {Food} food
   * @returns {number}
   */
  #consume(food) {
    if (food.type === FOOD_TYPE.BONUS) {
      this.#bonusFood = null;
      return this.#options.bonusFoodPoints;
    }
    this.#normalFoodEaten += 1;
    return this.#options.normalFoodPoints;
  }

  #shouldSpawnBonus() {
    return (
      this.#bonusFood === null &&
      this.#normalFoodEaten > 0 &&
      this.#normalFoodEaten % this.#options.bonusFoodInterval === 0
    );
  }

  /**
   * Picks a uniformly random free cell.
   *
   * @param {string} type
   * @returns {Food|BonusFood|null} `null` when the board is completely full.
   */
  #spawnFood(type) {
    const freeCells = this.#collectFreeCells();
    if (freeCells.length === 0) {
      return null;
    }

    const index = Math.min(freeCells.length - 1, Math.floor(this.#random() * freeCells.length));
    const cell = freeCells[index];

    if (type === FOOD_TYPE.BONUS) {
      return {
        ...cell,
        type,
        ticksRemaining: this.#options.bonusFoodLifetimeTicks,
        lifetimeTicks: this.#options.bonusFoodLifetimeTicks,
      };
    }

    return { ...cell, type };
  }

  /** @returns {Cell[]} Every cell not occupied by the snake or existing food. */
  #collectFreeCells() {
    const { cols, rows } = this.#options;
    const occupied = new Set(this.#snake.map((segment) => `${segment.x},${segment.y}`));
    if (this.#food) {
      occupied.add(`${this.#food.x},${this.#food.y}`);
    }
    if (this.#bonusFood) {
      occupied.add(`${this.#bonusFood.x},${this.#bonusFood.y}`);
    }

    /** @type {Cell[]} */
    const free = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (!occupied.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }
    return free;
  }

  /**
   * @param {TickResult} result
   * @param {string} cause
   * @returns {TickResult}
   */
  #finish(result, cause) {
    this.#status = GAME_STATUS.GAME_OVER;
    this.#deathCause = cause;
    this.#queuedDirections = [];
    result.gameOver = true;
    result.status = this.#status;
    return result;
  }
}
