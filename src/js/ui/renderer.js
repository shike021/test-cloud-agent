import { FOOD_TYPE, GAME_STATUS } from '../core/constants.js';

/**
 * Canvas renderer for {@link import('../core/snake-game.js').SnakeGame}.
 *
 * The renderer is stateless with respect to game rules: it only reads the game
 * snapshot and draws it. Movement between two discrete grid states is
 * interpolated with the `alpha` factor supplied by the game loop, which makes
 * the snake glide instead of jumping cell by cell.
 */

const PALETTE = Object.freeze({
  boardA: '#0e1a2b',
  boardB: '#122139',
  boardBorder: 'rgba(148, 197, 255, 0.10)',
  snakeOutline: '#04121f',
  snakeBodyFrom: '#37d67a',
  snakeBodyTo: '#12a8c8',
  snakeHead: '#8affc1',
  snakeEye: '#04121f',
  food: '#ff5d73',
  foodGlow: 'rgba(255, 93, 115, 0.35)',
  foodLeaf: '#4ade80',
  bonus: '#ffd166',
  bonusGlow: 'rgba(255, 209, 102, 0.35)',
  bonusRing: 'rgba(255, 209, 102, 0.85)',
  ripple: 'rgba(255, 255, 255, 0.55)',
});

const RIPPLE_DURATION_MS = 380;
const MAX_DEVICE_PIXEL_RATIO = 2.5;

/** @typedef {{ x: number, y: number, color: string, startedAt: number }} Ripple */

export class Renderer {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #context;
  /** @type {import('../core/snake-game.js').SnakeGame} */
  #game;
  /** @type {Ripple[]} */
  #ripples = [];
  #cellSize = 0;
  #boardSize = 0;
  #offsetX = 0;
  #offsetY = 0;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/snake-game.js').SnakeGame} game
   */
  constructor(canvas, game) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available in this browser.');
    }
    this.#canvas = canvas;
    this.#context = context;
    this.#game = game;
    this.resize();
  }

  get cellSize() {
    return this.#cellSize;
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

    const { cols, rows } = this.#game;
    this.#cellSize = Math.floor((cssSize / Math.max(cols, rows)) * 100) / 100;
    this.#boardSize = cssSize;
    this.#offsetX = (cssSize - this.#cellSize * cols) / 2;
    this.#offsetY = (cssSize - this.#cellSize * rows) / 2;
  }

  /** Registers an expanding ring at the given grid cell. */
  spawnRipple(x, y, type = FOOD_TYPE.NORMAL) {
    this.#ripples.push({
      x,
      y,
      color: type === FOOD_TYPE.BONUS ? PALETTE.bonusGlow : PALETTE.ripple,
      startedAt: performance.now(),
    });
  }

  /** Removes pending animations, e.g. when a new run starts. */
  clearEffects() {
    this.#ripples.length = 0;
  }

  /**
   * Draws a single frame.
   *
   * @param {{ alpha?: number, timestamp?: number }} [frame]
   *   `alpha` is the progress (0..1) towards the next tick.
   */
  render({ alpha = 1, timestamp = performance.now() } = {}) {
    const context = this.#context;
    context.clearRect(0, 0, this.#boardSize, this.#boardSize);

    this.#drawBoard();

    const interpolation = this.#game.isRunning ? Math.min(Math.max(alpha, 0), 1) : 1;
    const food = this.#game.food;
    if (food) {
      this.#drawFood(food, timestamp);
    }
    const bonus = this.#game.bonusFood;
    if (bonus) {
      this.#drawBonusFood(bonus, timestamp);
    }

    this.#drawSnake(interpolation);
    this.#drawRipples(timestamp);
  }

  /* --------------------------------------------------------------- drawing */

  #drawBoard() {
    const context = this.#context;
    const { cols, rows } = this.#game;
    const cell = this.#cellSize;

    context.fillStyle = PALETTE.boardA;
    context.fillRect(this.#offsetX, this.#offsetY, cell * cols, cell * rows);

    context.fillStyle = PALETTE.boardB;
    for (let y = 0; y < rows; y += 1) {
      for (let x = y % 2 === 0 ? 0 : 1; x < cols; x += 2) {
        context.fillRect(
          this.#offsetX + x * cell,
          this.#offsetY + y * cell,
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }

    context.strokeStyle = PALETTE.boardBorder;
    context.lineWidth = 1;
    context.strokeRect(this.#offsetX + 0.5, this.#offsetY + 0.5, cell * cols - 1, cell * rows - 1);
  }

  /**
   * @param {number} alpha
   */
  #drawSnake(alpha) {
    const context = this.#context;
    const cell = this.#cellSize;
    const segments = this.#interpolatedSegments(alpha);
    if (segments.length === 0) {
      return;
    }

    const paths = this.#splitIntoContinuousPaths(segments);
    const gradient = context.createLinearGradient(
      this.#offsetX,
      this.#offsetY,
      this.#offsetX + this.#cellSize * this.#game.cols,
      this.#offsetY + this.#cellSize * this.#game.rows,
    );
    gradient.addColorStop(0, PALETTE.snakeBodyFrom);
    gradient.addColorStop(1, PALETTE.snakeBodyTo);

    context.lineJoin = 'round';
    context.lineCap = 'round';

    for (const strokeStyle of [PALETTE.snakeOutline, gradient]) {
      context.strokeStyle = strokeStyle;
      context.lineWidth = strokeStyle === gradient ? cell * 0.72 : cell * 0.86;
      for (const path of paths) {
        context.beginPath();
        if (path.length === 1) {
          context.moveTo(path[0].x, path[0].y);
          context.lineTo(path[0].x + 0.01, path[0].y);
        } else {
          context.moveTo(path[0].x, path[0].y);
          for (let index = 1; index < path.length; index += 1) {
            context.lineTo(path[index].x, path[index].y);
          }
        }
        context.stroke();
      }
    }

    this.#drawHead(segments[0]);
  }

  /**
   * @param {{ x: number, y: number }} head Pixel coordinates of the head centre.
   */
  #drawHead(head) {
    const context = this.#context;
    const cell = this.#cellSize;
    const radius = cell * 0.36;

    context.beginPath();
    context.arc(head.x, head.y, radius, 0, Math.PI * 2);
    context.fillStyle = PALETTE.snakeHead;
    context.fill();
    context.lineWidth = Math.max(1, cell * 0.07);
    context.strokeStyle = PALETTE.snakeOutline;
    context.stroke();

    const vector = this.#directionVector();
    const eyeOffset = cell * 0.16;
    const eyeRadius = Math.max(1, cell * 0.075);
    const perpendicular = { x: -vector.y, y: vector.x };

    context.fillStyle = PALETTE.snakeEye;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.arc(
        head.x + vector.x * eyeOffset * 0.6 + perpendicular.x * eyeOffset * side,
        head.y + vector.y * eyeOffset * 0.6 + perpendicular.y * eyeOffset * side,
        eyeRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  /**
   * @param {import('../core/snake-game.js').Food} food
   * @param {number} timestamp
   */
  #drawFood(food, timestamp) {
    const context = this.#context;
    const cell = this.#cellSize;
    const centre = this.#cellCentre(food.x, food.y);
    const pulse = 1 + Math.sin(timestamp / 260) * 0.07;
    const radius = cell * 0.3 * pulse;

    context.save();
    context.shadowColor = PALETTE.foodGlow;
    context.shadowBlur = cell * 0.6;
    context.beginPath();
    context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    context.fillStyle = PALETTE.food;
    context.fill();
    context.restore();

    context.beginPath();
    context.ellipse(
      centre.x + radius * 0.5,
      centre.y - radius * 0.85,
      radius * 0.42,
      radius * 0.2,
      -Math.PI / 5,
      0,
      Math.PI * 2,
    );
    context.fillStyle = PALETTE.foodLeaf;
    context.fill();
  }

  /**
   * @param {import('../core/snake-game.js').BonusFood} bonus
   * @param {number} timestamp
   */
  #drawBonusFood(bonus, timestamp) {
    const context = this.#context;
    const cell = this.#cellSize;
    const centre = this.#cellCentre(bonus.x, bonus.y);
    const radius = cell * 0.3;
    const remaining = Math.max(0, bonus.ticksRemaining) / Math.max(1, bonus.lifetimeTicks);

    context.save();
    context.translate(centre.x, centre.y);
    context.rotate((timestamp / 900) % (Math.PI * 2));
    context.shadowColor = PALETTE.bonusGlow;
    context.shadowBlur = cell * 0.7;
    context.beginPath();
    for (let point = 0; point < 8; point += 1) {
      const angle = (Math.PI / 4) * point;
      const distance = point % 2 === 0 ? radius : radius * 0.48;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance;
      if (point === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    }
    context.closePath();
    context.fillStyle = PALETTE.bonus;
    context.fill();
    context.restore();

    context.beginPath();
    context.arc(
      centre.x,
      centre.y,
      cell * 0.44,
      -Math.PI / 2,
      -Math.PI / 2 + remaining * Math.PI * 2,
    );
    context.strokeStyle = PALETTE.bonusRing;
    context.lineWidth = Math.max(1.5, cell * 0.08);
    context.lineCap = 'round';
    context.stroke();
  }

  /**
   * @param {number} timestamp
   */
  #drawRipples(timestamp) {
    if (this.#ripples.length === 0) {
      return;
    }
    const context = this.#context;
    const cell = this.#cellSize;

    this.#ripples = this.#ripples.filter(
      (ripple) => timestamp - ripple.startedAt < RIPPLE_DURATION_MS,
    );

    for (const ripple of this.#ripples) {
      const progress = (timestamp - ripple.startedAt) / RIPPLE_DURATION_MS;
      const centre = this.#cellCentre(ripple.x, ripple.y);
      context.beginPath();
      context.arc(centre.x, centre.y, cell * (0.3 + progress * 0.85), 0, Math.PI * 2);
      context.strokeStyle = ripple.color;
      context.globalAlpha = 1 - progress;
      context.lineWidth = Math.max(1, cell * 0.1 * (1 - progress));
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  /* --------------------------------------------------------------- helpers */

  #directionVector() {
    switch (this.#game.direction) {
      case 'up':
        return { x: 0, y: -1 };
      case 'down':
        return { x: 0, y: 1 };
      case 'left':
        return { x: -1, y: 0 };
      default:
        return { x: 1, y: 0 };
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{ x: number, y: number }}
   */
  #cellCentre(x, y) {
    return {
      x: this.#offsetX + (x + 0.5) * this.#cellSize,
      y: this.#offsetY + (y + 0.5) * this.#cellSize,
    };
  }

  /**
   * Blends the previous and current body positions.
   *
   * @param {number} alpha
   * @returns {{ x: number, y: number }[]} Pixel centres, head first.
   */
  #interpolatedSegments(alpha) {
    const snake = this.#game.snake;
    const previous = this.#game.previousSnake;
    const finished = this.#game.status === GAME_STATUS.GAME_OVER;

    return snake.map((segment, index) => {
      const target = this.#cellCentre(segment.x, segment.y);
      const before = previous[index] ?? previous.at(-1);
      if (!before || finished) {
        return target;
      }

      const from = this.#cellCentre(before.x, before.y);
      const distance = Math.hypot(target.x - from.x, target.y - from.y);
      // A large jump means the snake wrapped around an edge; interpolating
      // across the whole board would look like teleportation.
      if (distance > this.#cellSize * 1.5) {
        return target;
      }

      return {
        x: from.x + (target.x - from.x) * alpha,
        y: from.y + (target.y - from.y) * alpha,
      };
    });
  }

  /**
   * Splits the body into runs of adjacent segments so that wrap-around jumps do
   * not produce a stroke across the entire board.
   *
   * @param {{ x: number, y: number }[]} segments
   * @returns {{ x: number, y: number }[][]}
   */
  #splitIntoContinuousPaths(segments) {
    /** @type {{ x: number, y: number }[][]} */
    const paths = [[segments[0]]];
    const threshold = this.#cellSize * 1.9;

    for (let index = 1; index < segments.length; index += 1) {
      const previous = segments[index - 1];
      const current = segments[index];
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      if (distance > threshold) {
        paths.push([current]);
      } else {
        paths.at(-1).push(current);
      }
    }

    return paths;
  }
}
