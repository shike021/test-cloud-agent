/**
 * Deterministic pseudo random number generator (mulberry32).
 *
 * The game core accepts any `() => number` producing values in `[0, 1)`.
 * Using a seedable generator keeps unit tests reproducible while the browser
 * build can simply pass `Math.random`.
 *
 * @param {number} seed Any 32 bit integer seed.
 * @returns {() => number} Random function yielding values in `[0, 1)`.
 */
export function createRandom(seed = 1) {
  let state = seed >>> 0;

  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
