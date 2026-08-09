import { DIRECTIONS, OPPOSITE_DIRECTION } from '../../src/js/core/constants.js';

/**
 * Test helper that steers the snake towards a target cell.
 *
 * It only uses the public game API, so the tests stay independent of internal
 * state. The driver is a greedy walker: on every tick it picks the legal, safe
 * neighbouring cell that gets closest to the target.
 */

/** @typedef {import('../../src/js/core/snake-game.js').SnakeGame} SnakeGame */
/** @typedef {import('../../src/js/core/snake-game.js').TickResult} TickResult */

const DIRECTION_NAMES = Object.freeze(Object.keys(DIRECTIONS));

/**
 * @param {SnakeGame} game
 * @param {string} direction
 * @returns {{ x: number, y: number }}
 */
function neighbourCell(game, direction) {
  const vector = DIRECTIONS[direction];
  return { x: game.head.x + vector.x, y: game.head.y + vector.y };
}

/**
 * A move is safe when it stays on the board and does not run into the body.
 * The tail is excluded because it vacates its cell during the same tick.
 *
 * @param {SnakeGame} game
 * @param {string} direction
 */
function isSafe(game, direction) {
  const cell = neighbourCell(game, direction);
  if (cell.x < 0 || cell.y < 0 || cell.x >= game.cols || cell.y >= game.rows) {
    return false;
  }
  return !game.snake.slice(0, -1).some((segment) => segment.x === cell.x && segment.y === cell.y);
}

/**
 * @param {SnakeGame} game
 * @param {string} direction
 * @param {{ x: number, y: number }} target
 */
function distanceAfterMove(game, direction, target) {
  const cell = neighbourCell(game, direction);
  return Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y);
}

/**
 * Drives the snake towards `target`, ticking the game until it arrives, the run
 * ends, or `maxSteps` is exhausted.
 *
 * @param {SnakeGame} game
 * @param {{ x: number, y: number }} target
 * @param {number} [maxSteps]
 * @returns {{
 *   reached: boolean,
 *   lastResult: TickResult|null,
 *   scoreBeforeLastTick: number,
 *   lengthBeforeLastTick: number,
 * }}
 */
export function driveTo(game, target, maxSteps = 400) {
  /** @type {TickResult|null} */
  let lastResult = null;
  let scoreBeforeLastTick = game.score;
  let lengthBeforeLastTick = game.snake.length;

  for (let step = 0; step < maxSteps; step += 1) {
    if (game.head.x === target.x && game.head.y === target.y) {
      break;
    }

    const forbidden = OPPOSITE_DIRECTION[game.direction];
    const candidates = DIRECTION_NAMES.filter(
      (direction) => direction !== forbidden && isSafe(game, direction),
    ).sort((a, b) => distanceAfterMove(game, a, target) - distanceAfterMove(game, b, target));

    if (candidates.length === 0) {
      break;
    }

    const chosen = candidates[0];
    if (chosen !== game.direction) {
      game.enqueueDirection(chosen);
    }

    scoreBeforeLastTick = game.score;
    lengthBeforeLastTick = game.snake.length;
    lastResult = game.tick();
    if (lastResult.gameOver || lastResult.won) {
      break;
    }
  }

  return {
    reached: game.head.x === target.x && game.head.y === target.y,
    lastResult,
    scoreBeforeLastTick,
    lengthBeforeLastTick,
  };
}
