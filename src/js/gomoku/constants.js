/**
 * Shared constants for the gomoku core.
 *
 * As with the snake core, this module stays free of DOM/browser APIs so the
 * rules can be unit tested in a plain Node environment.
 */

/** The two stone colours. Black always opens a traditional game. */
export const PLAYER = Object.freeze({
  BLACK: 'black',
  WHITE: 'white',
});

/** @typedef {'black' | 'white'} PlayerName */

export const OPPONENT = Object.freeze({
  black: PLAYER.WHITE,
  white: PLAYER.BLACK,
});

/** Human readable colour names, used by the UI layer for announcements. */
export const PLAYER_LABEL = Object.freeze({
  black: '黑棋',
  white: '白棋',
});

/**
 * Column labels drawn on the board and used in move notation. Unlike go, the
 * gomoku/renju convention keeps the letter "I".
 */
export const COLUMN_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Lifecycle states of a match. */
export const GOMOKU_STATUS = Object.freeze({
  PLAYING: 'playing',
  WON: 'won',
  DRAW: 'draw',
});

/** Reasons a move can be rejected, surfaced to the UI for tailored messaging. */
export const REJECTION = Object.freeze({
  OUT_OF_BOUNDS: 'out-of-bounds',
  OCCUPIED: 'occupied',
  FINISHED: 'finished',
});

/**
 * The four axes a line can run along. Both directions of an axis are walked
 * during win detection, which is why the opposite vectors are not listed.
 */
export const AXES = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: 1, y: -1 }),
]);

/** Tunable defaults; every value can be overridden through the constructor. */
export const DEFAULT_OPTIONS = Object.freeze({
  /** Board edge length in intersections. 15 is the tournament standard. */
  size: 15,
  /** Number of stones in a row required to win. */
  winLength: 5,
  /** Colour that opens the match. */
  firstPlayer: PLAYER.BLACK,
});
