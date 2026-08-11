/**
 * Shared constants for the 2048 core.
 *
 * As with the other game cores, this module stays free of DOM/browser APIs so
 * the rules can be unit tested in a plain Node environment.
 */

/** The four swipe directions a move can take. */
export const DIRECTIONS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
});

/** @typedef {'up' | 'down' | 'left' | 'right'} DirectionName */

/** Board space vectors: `x` grows to the right, `y` grows downwards. */
export const DIRECTION_VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

/**
 * Lifecycle states of a run.
 *
 * `WON` is entered once when the winning tile appears; the player then either
 * starts over or keeps playing, which returns the run to `PLAYING`.
 */
export const GAME_STATUS = Object.freeze({
  PLAYING: 'playing',
  WON: 'won',
  GAME_OVER: 'game-over',
});

/** Tunable defaults; every value can be overridden through the constructor. */
export const DEFAULT_OPTIONS = Object.freeze({
  /** Board edge length in cells. 4 is the classic layout. */
  size: 4,
  /** Value that ends the run with a win. */
  winTile: 2048,
  /** Tiles placed before the first move. */
  startTiles: 2,
  /** Chance for a spawned tile to be a 4 instead of a 2. */
  fourProbability: 0.1,
});
