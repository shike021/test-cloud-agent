/**
 * Shared constants for the game core.
 *
 * The core module is intentionally free of DOM/browser APIs so that it can be
 * unit tested in a plain Node environment.
 */

/** Cardinal directions as unit vectors on the grid (y grows downwards). */
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

/** @typedef {keyof typeof DIRECTIONS} DirectionName */

export const OPPOSITE_DIRECTION = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
});

/** Lifecycle states of a game session. */
export const GAME_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
  WON: 'won',
});

/** Food flavours. Bonus food is time limited but worth far more points. */
export const FOOD_TYPE = Object.freeze({
  NORMAL: 'normal',
  BONUS: 'bonus',
});

/** Reasons a run can end, surfaced to the UI for tailored messaging. */
export const DEATH_CAUSE = Object.freeze({
  WALL: 'wall',
  SELF: 'self',
});

/** Tunable defaults; every value can be overridden through the constructor. */
export const DEFAULT_OPTIONS = Object.freeze({
  cols: 24,
  rows: 24,
  initialLength: 4,
  /** Milliseconds between two ticks at level 1. */
  baseTickMs: 140,
  /** Lower bound for the tick interval, i.e. the maximum speed. */
  minTickMs: 65,
  /** Milliseconds shaved off the tick interval per level gained. */
  speedUpPerLevelMs: 7,
  /** Points required to advance one level. */
  pointsPerLevel: 60,
  /** Points awarded for a normal food item. */
  normalFoodPoints: 10,
  /** Points awarded for a bonus food item. */
  bonusFoodPoints: 50,
  /** A bonus item appears after this many normal items have been eaten. */
  bonusFoodInterval: 5,
  /** Number of ticks a bonus item stays on the board. */
  bonusFoodLifetimeTicks: 40,
  /** When false, the snake wraps around the edges instead of dying. */
  wallCollision: true,
  /** Maximum number of buffered direction changes. */
  maxQueuedDirections: 3,
});
