/**
 * Shared constants for the Lianliankan (Link Match) core.
 *
 * This module stays free of DOM/browser APIs so the rules can be unit tested
 * in a plain Node environment.
 */

export const DIFFICULTY_IDS = Object.freeze({
  EASY: 'easy',
  STANDARD: 'standard',
  HARD: 'hard',
});

/** @typedef {'easy' | 'standard' | 'hard'} DifficultyId */

/**
 * Lifecycle of a single stage.
 *
 * `CLEARED` means every tile is gone; the run then either advances or stops.
 * `FAILED` is a timeout or a board with remaining tiles but no legal pair.
 */
export const GAME_STATUS = Object.freeze({
  PLAYING: 'playing',
  CLEARED: 'cleared',
  FAILED: 'failed',
});

/** @typedef {'playing' | 'cleared' | 'failed'} GameStatus */

export const FAIL_REASONS = Object.freeze({
  TIMEOUT: 'timeout',
  DEADLOCK: 'deadlock',
});

/**
 * @typedef {object} DifficultyConfig
 * @property {DifficultyId} id
 * @property {number} rows
 * @property {number} cols
 * @property {number} tileTypes
 * @property {number} timeLimitMs  `0` means the stage is untimed.
 * @property {number} hints
 * @property {number} stage        First stage that uses this profile.
 */

/** Three built-in profiles. Later stages reuse `hard` with a tighter clock. */
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: DIFFICULTY_IDS.EASY,
    rows: 6,
    cols: 8,
    tileTypes: 8,
    timeLimitMs: 0,
    hints: 5,
    stage: 1,
  }),
  standard: Object.freeze({
    id: DIFFICULTY_IDS.STANDARD,
    rows: 8,
    cols: 10,
    tileTypes: 12,
    timeLimitMs: 180_000,
    hints: 3,
    stage: 2,
  }),
  hard: Object.freeze({
    id: DIFFICULTY_IDS.HARD,
    rows: 10,
    cols: 12,
    tileTypes: 16,
    timeLimitMs: 120_000,
    hints: 1,
    stage: 3,
  }),
});

export const MIN_ENDLESS_TIME_MS = 60_000;
export const ENDLESS_TIME_STEP_MS = 15_000;
export const GENERATION_ATTEMPTS = 24;

export const SCORING = Object.freeze({
  /** Points for a match before combo and stage multipliers. */
  matchBase: 10,
  /** Extra points per consecutive successful match after the first. */
  comboBonus: 5,
  /** Awarded per whole remaining second when a timed stage is cleared. */
  timeBonusPerSecond: 2,
  /** Flat bonus for emptying the board, multiplied by the stage number. */
  clearBonus: 80,
});

/**
 * Visual identity of each tile type. The core only stores integer type ids;
 * the renderer looks glyphs up from this table.
 */
export const TILE_GLYPHS = Object.freeze([
  Object.freeze({ type: 1, glyph: '●', label: '圆点', hue: 168 }),
  Object.freeze({ type: 2, glyph: '◆', label: '菱形', hue: 42 }),
  Object.freeze({ type: 3, glyph: '■', label: '方块', hue: 210 }),
  Object.freeze({ type: 4, glyph: '▲', label: '三角', hue: 12 }),
  Object.freeze({ type: 5, glyph: '★', label: '星星', hue: 48 }),
  Object.freeze({ type: 6, glyph: '♥', label: '爱心', hue: 340 }),
  Object.freeze({ type: 7, glyph: '✚', label: '十字', hue: 262 }),
  Object.freeze({ type: 8, glyph: '☀', label: '太阳', hue: 28 }),
  Object.freeze({ type: 9, glyph: '☾', label: '月亮', hue: 226 }),
  Object.freeze({ type: 10, glyph: '♣', label: '梅花', hue: 142 }),
  Object.freeze({ type: 11, glyph: '♠', label: '黑桃', hue: 252 }),
  Object.freeze({ type: 12, glyph: '♦', label: '方片', hue: 354 }),
  Object.freeze({ type: 13, glyph: '❄', label: '雪花', hue: 196 }),
  Object.freeze({ type: 14, glyph: '♪', label: '音符', hue: 288 }),
  Object.freeze({ type: 15, glyph: '⬡', label: '六边', hue: 88 }),
  Object.freeze({ type: 16, glyph: '◉', label: '靶心', hue: 18 }),
]);

/**
 * @param {number} type
 * @returns {(typeof TILE_GLYPHS)[number]}
 */
export function glyphForType(type) {
  const index =
    (((Math.trunc(type) - 1) % TILE_GLYPHS.length) + TILE_GLYPHS.length) % TILE_GLYPHS.length;
  return TILE_GLYPHS[index];
}

/**
 * Resolves the board profile for a 1-based stage number.
 *
 * Stages 1–3 map to easy / standard / hard. Stage 4 and beyond keep the hard
 * layout but shrink the timer by {@link ENDLESS_TIME_STEP_MS} each time, down
 * to {@link MIN_ENDLESS_TIME_MS}.
 *
 * @param {number} stage
 * @returns {DifficultyConfig}
 */
export function resolveStageConfig(stage) {
  if (!Number.isInteger(stage) || stage < 1) {
    throw new RangeError(`Stage must be an integer >= 1, received: ${stage}`);
  }
  if (stage === 1) {
    return { ...DIFFICULTIES.easy };
  }
  if (stage === 2) {
    return { ...DIFFICULTIES.standard };
  }

  const extra = stage - 3;
  return {
    ...DIFFICULTIES.hard,
    stage,
    timeLimitMs: Math.max(
      MIN_ENDLESS_TIME_MS,
      DIFFICULTIES.hard.timeLimitMs - extra * ENDLESS_TIME_STEP_MS,
    ),
    hints: DIFFICULTIES.hard.hints,
  };
}

/**
 * @param {number} stage
 * @returns {DifficultyId}
 */
export function difficultyIdForStage(stage) {
  if (stage <= 1) {
    return DIFFICULTY_IDS.EASY;
  }
  if (stage === 2) {
    return DIFFICULTY_IDS.STANDARD;
  }
  return DIFFICULTY_IDS.HARD;
}

/**
 * @param {string} difficultyId
 * @returns {number}
 */
export function startingStageForDifficulty(difficultyId) {
  const config = Object.hasOwn(DIFFICULTIES, difficultyId) ? DIFFICULTIES[difficultyId] : null;
  if (!config) {
    throw new RangeError(`Unknown difficulty: ${difficultyId}`);
  }
  return config.stage;
}
