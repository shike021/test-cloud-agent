/**
 * Test helper that replays a scripted sequence of gomoku moves.
 *
 * It only uses the public game API and asserts nothing itself, so the suites
 * stay in control of the expectations. Rejected moves are surfaced as an error
 * because a scripted sequence that gets refused means the fixture is wrong.
 */

/** @typedef {import('../../src/js/gomoku/gomoku-game.js').GomokuGame} GomokuGame */
/** @typedef {import('../../src/js/gomoku/gomoku-game.js').PlaceResult} PlaceResult */

/**
 * Plays the given coordinates in order, alternating colours as the game
 * dictates, and stops early once the match is decided.
 *
 * @param {GomokuGame} game
 * @param {readonly [number, number][]} coordinates
 * @returns {PlaceResult} The result of the last move that was played.
 */
export function playMoves(game, coordinates) {
  /** @type {PlaceResult|null} */
  let lastResult = null;

  for (const [x, y] of coordinates) {
    if (game.isFinished) {
      break;
    }
    lastResult = game.place(x, y);
    if (!lastResult.placed) {
      throw new Error(
        `Scripted move (${x}, ${y}) was rejected: ${lastResult.rejection}. ` +
          'The test fixture does not match the rules.',
      );
    }
  }

  if (lastResult === null) {
    throw new Error('playMoves requires at least one playable move.');
  }
  return lastResult;
}
