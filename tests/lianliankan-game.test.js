import { describe, expect, it } from 'vitest';

import { createRandom } from '../src/js/core/rng.js';
import {
  DIFFICULTIES,
  DIFFICULTY_IDS,
  FAIL_REASONS,
  GAME_STATUS,
  SCORING,
  difficultyIdForStage,
  resolveStageConfig,
  startingStageForDifficulty,
} from '../src/js/lianliankan/core/constants.js';
import { LianliankanGame } from '../src/js/lianliankan/core/lianliankan-game.js';
import { findLinkPath } from '../src/js/lianliankan/core/path-finder.js';

/**
 * @param {Partial<ConstructorParameters<typeof LianliankanGame>[0]>} [options]
 * @returns {LianliankanGame}
 */
function createGame(options = {}) {
  return new LianliankanGame({ random: createRandom(7), ...options });
}

describe('stage configuration', () => {
  it('maps the three named difficulties onto growing boards', () => {
    expect(DIFFICULTIES.easy).toMatchObject({
      rows: 6,
      cols: 8,
      tileTypes: 8,
      timeLimitMs: 0,
      hints: 5,
    });
    expect(DIFFICULTIES.standard).toMatchObject({
      rows: 8,
      cols: 10,
      tileTypes: 12,
      timeLimitMs: 180_000,
      hints: 3,
    });
    expect(DIFFICULTIES.hard).toMatchObject({
      rows: 10,
      cols: 12,
      tileTypes: 16,
      timeLimitMs: 120_000,
      hints: 1,
    });
  });

  it('reuses the hard layout after stage 3 and tightens the clock', () => {
    const stage4 = resolveStageConfig(4);
    const stage7 = resolveStageConfig(7);

    expect(stage4.rows).toBe(10);
    expect(stage4.cols).toBe(12);
    expect(stage4.tileTypes).toBe(16);
    expect(stage4.timeLimitMs).toBe(105_000);
    expect(stage7.timeLimitMs).toBe(60_000);
    expect(resolveStageConfig(20).timeLimitMs).toBe(60_000);
    expect(difficultyIdForStage(1)).toBe(DIFFICULTY_IDS.EASY);
    expect(difficultyIdForStage(2)).toBe(DIFFICULTY_IDS.STANDARD);
    expect(difficultyIdForStage(5)).toBe(DIFFICULTY_IDS.HARD);
    expect(startingStageForDifficulty('hard')).toBe(3);
  });

  it('rejects an invalid stage or difficulty', () => {
    expect(() => resolveStageConfig(0)).toThrow(RangeError);
    expect(() => startingStageForDifficulty('nightmare')).toThrow(RangeError);
  });
});

describe('LianliankanGame — initial state', () => {
  it('starts an easy stage with a full even board and no score', () => {
    const game = createGame();

    expect(game.rows).toBe(6);
    expect(game.cols).toBe(8);
    expect(game.tileTypes).toBe(8);
    expect(game.stage).toBe(1);
    expect(game.difficulty).toBe('easy');
    expect(game.score).toBe(0);
    expect(game.combo).toBe(0);
    expect(game.remainingHints).toBe(5);
    expect(game.timeLimitMs).toBe(0);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.tilesRemaining).toBe(48);
    expect(game.tiles).toHaveLength(48);
    expect(game.findAnyMatch()).not.toBeNull();
  });

  it('honours the requested difficulty and a direct stage number', () => {
    const standard = createGame({ difficulty: 'standard' });
    const hard = createGame({ difficulty: 'hard' });
    const endless = createGame({ stage: 4 });

    expect(standard.rows).toBe(8);
    expect(standard.cols).toBe(10);
    expect(standard.remainingHints).toBe(3);
    expect(standard.timeLimitMs).toBe(180_000);

    expect(hard.rows).toBe(10);
    expect(hard.cols).toBe(12);
    expect(hard.remainingHints).toBe(1);
    expect(hard.timeLimitMs).toBe(120_000);

    expect(endless.stage).toBe(4);
    expect(endless.difficulty).toBe('hard');
    expect(endless.timeLimitMs).toBe(105_000);
  });

  it('replays identically for the same seed', () => {
    const first = new LianliankanGame({ random: createRandom(2024) });
    const second = new LianliankanGame({ random: createRandom(2024) });

    expect(first.toRows()).toEqual(second.toRows());
  });

  it('deals each type an even number of times', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const game = new LianliankanGame({ random: createRandom(seed), difficulty: 'standard' });
      /** @type {Map<number, number>} */
      const counts = new Map();
      for (const tile of game.tiles) {
        counts.set(tile.type, (counts.get(tile.type) ?? 0) + 1);
      }
      expect(game.tilesRemaining % 2).toBe(0);
      for (const count of counts.values()) {
        expect(count % 2).toBe(0);
      }
    }
  });

  it('rejects a non-function random source', () => {
    expect(() => new LianliankanGame({ random: /** @type {never} */ (0.5) })).toThrow(TypeError);
  });
});

describe('connection rules', () => {
  it('joins two identical tiles on a clear straight line (zero turns)', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 0, 0, 1],
        [0, 0, 0, 0],
      ],
      { evaluate: false },
    );

    const path = game.findPath({ row: 0, col: 0 }, { row: 0, col: 3 });
    expect(path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
    ]);

    const result = game.select(0, 0);
    expect(result.action).toBe('selected');
    const matched = game.select(0, 3);
    expect(matched.action).toBe('matched');
    expect(matched.cleared).toBe(true);
    expect(game.tilesRemaining).toBe(0);
    expect(game.status).toBe(GAME_STATUS.CLEARED);
  });

  it('joins two identical tiles with a single corner (one turn)', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 0, 0, 0],
        [0, 2, 2, 1],
      ],
      { evaluate: false },
    );

    const path = game.findPath({ row: 0, col: 0 }, { row: 1, col: 3 });
    expect(path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 1, col: 3 },
    ]);
    expect(path?.length).toBe(3);

    expect(game.select(0, 0).action).toBe('selected');
    expect(game.select(1, 3).action).toBe('matched');
    expect(game.tileAt(0, 0)).toBeNull();
    expect(game.tileAt(1, 3)).toBeNull();
    expect(game.tileAt(1, 1)?.type).toBe(2);
  });

  it('joins two identical tiles with a three-segment polyline (two turns)', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 2, 2, 2],
        [3, 3, 3, 2],
        [0, 0, 0, 1],
      ],
      { evaluate: false },
    );

    const path = game.findPath({ row: 0, col: 0 }, { row: 2, col: 3 });
    expect(path).not.toBeNull();
    expect(path?.length).toBeGreaterThanOrEqual(3);
    expect(path?.length).toBeLessThanOrEqual(4);

    expect(game.select(0, 0).action).toBe('selected');
    const matched = game.select(2, 3);
    expect(matched.action).toBe('matched');
    expect(matched.path).toEqual(path);
  });

  it('refuses a pair whose only routes are blocked by other tiles', () => {
    const game = createGame();
    game.loadBoard(
      [
        [2, 2, 2, 2, 2],
        [2, 1, 2, 1, 2],
        [2, 2, 2, 2, 2],
      ],
      { evaluate: false },
    );

    expect(game.findPath({ row: 1, col: 1 }, { row: 1, col: 3 })).toBeNull();
    expect(game.select(1, 1).action).toBe('selected');
    const rejected = game.select(1, 3);
    expect(rejected.action).toBe('rejected');
    expect(rejected.reason).toBe('blocked');
    expect(game.tileAt(1, 1)?.type).toBe(1);
    expect(game.tileAt(1, 3)?.type).toBe(1);
    expect(game.combo).toBe(0);
  });

  it('refuses tiles that do not share a pattern even when a path exists', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 0, 2],
        [0, 0, 0],
      ],
      { evaluate: false },
    );

    expect(game.findPath({ row: 0, col: 0 }, { row: 0, col: 2 })).not.toBeNull();
    expect(game.select(0, 0).action).toBe('selected');
    const rejected = game.select(0, 2);
    expect(rejected.action).toBe('rejected');
    expect(rejected.reason).toBe('type-mismatch');
    expect(game.selected).toEqual({ row: 0, col: 2 });
  });

  it('lets a path wrap through the empty padding around the board', () => {
    const board = [
      [1, 2, 1],
      [3, 4, 5],
    ];
    const path = findLinkPath(2, 3, board, { row: 0, col: 0 }, { row: 0, col: 2 });

    expect(path).not.toBeNull();
    expect(
      path?.some((cell) => cell.row < 0 || cell.col < 0 || cell.row >= 2 || cell.col >= 3),
    ).toBe(true);
  });

  it('ignores empty cells, out-of-bounds clicks and a finished stage', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1],
        [0, 0],
      ],
      { evaluate: false },
    );

    expect(game.select(1, 0).action).toBe('ignored');
    expect(game.select(-1, 0).action).toBe('ignored');
    expect(game.select(0, 0).action).toBe('selected');
    expect(game.select(0, 0).action).toBe('deselected');
    expect(game.select(0, 0).action).toBe('selected');
    expect(game.select(0, 1).cleared).toBe(true);
    expect(game.select(0, 0).action).toBe('ignored');
    expect(game.select(0, 0).reason).toBe('finished');
  });
});

describe('scoring, hints, undo and the clock', () => {
  it('awards match points, combo bonuses and a clear bonus', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1, 2, 2],
        [0, 0, 0, 0],
      ],
      { evaluate: false },
    );

    game.select(0, 0);
    const first = game.select(0, 1);
    expect(first.gained).toBe(SCORING.matchBase * game.stage);
    expect(game.combo).toBe(1);

    game.select(0, 2);
    const second = game.select(0, 3);
    expect(second.gained).toBe((SCORING.matchBase + SCORING.comboBonus) * game.stage);
    expect(second.cleared).toBe(true);
    expect(game.score).toBe(first.gained + second.gained + SCORING.clearBonus * game.stage);
  });

  it('resets the combo when a pair is rejected', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1, 2, 3],
        [2, 3, 0, 0],
      ],
      { evaluate: false },
    );

    game.select(0, 0);
    game.select(0, 1);
    expect(game.combo).toBe(1);

    game.select(0, 2);
    game.select(0, 3);
    expect(game.combo).toBe(0);
  });

  it('spends a hint to expose a legal pair and refuses when none remain', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 0, 0, 1],
        [2, 2, 0, 0],
      ],
      { remainingHints: 1, evaluate: false },
    );

    const hinted = game.hint();
    expect(hinted).not.toBeNull();
    expect(game.remainingHints).toBe(0);
    expect(game.hintPair).toEqual({ a: hinted?.a, b: hinted?.b });
    expect(game.hint()).toBeNull();
  });

  it('undoes the last match, including a just-cleared board', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1],
        [0, 0],
      ],
      { evaluate: false },
    );

    game.select(0, 0);
    game.select(0, 1);
    expect(game.status).toBe(GAME_STATUS.CLEARED);
    expect(game.canUndo).toBe(true);

    expect(game.undo()).toBe(true);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.tileAt(0, 0)?.type).toBe(1);
    expect(game.tileAt(0, 1)?.type).toBe(1);
    expect(game.score).toBe(0);
    expect(game.combo).toBe(0);
    expect(game.undo()).toBe(false);
  });

  it('fails a timed stage when the injected clock runs out', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1],
        [2, 2],
      ],
      { remainingTimeMs: 1_000, evaluate: false },
    );

    expect(game.tick(400)).toBe(GAME_STATUS.PLAYING);
    expect(game.remainingTimeMs).toBe(600);
    expect(game.tick(600)).toBe(GAME_STATUS.FAILED);
    expect(game.failReason).toBe(FAIL_REASONS.TIMEOUT);
    expect(game.canUndo).toBe(false);
    expect(game.select(0, 0).action).toBe('ignored');
  });

  it('marks a boxed-in leftover pair as a deadlock', () => {
    const game = createGame();
    game.loadBoard([
      [3, 4, 5, 6, 7],
      [8, 1, 9, 1, 10],
      [11, 12, 13, 14, 15],
    ]);

    expect(game.status).toBe(GAME_STATUS.FAILED);
    expect(game.failReason).toBe(FAIL_REASONS.DEADLOCK);
  });
});

describe('stage progression', () => {
  it('carries the score into the next difficulty after a clear', () => {
    const game = createGame({ difficulty: 'easy' });
    game.loadBoard(
      [
        [1, 1],
        [0, 0],
      ],
      { evaluate: false },
    );
    game.select(0, 0);
    game.select(0, 1);

    expect(game.canAdvance).toBe(true);
    const scoreAfterClear = game.score;
    expect(game.advance()).toBe(true);
    expect(game.stage).toBe(2);
    expect(game.difficulty).toBe('standard');
    expect(game.rows).toBe(8);
    expect(game.cols).toBe(10);
    expect(game.remainingHints).toBe(3);
    expect(game.timeLimitMs).toBe(180_000);
    expect(game.score).toBe(scoreAfterClear);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.tilesRemaining).toBe(80);
  });

  it('restarts the current stage without keeping its in-progress score', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1, 2, 2],
        [0, 0, 0, 0],
      ],
      { score: 40, evaluate: false },
    );
    game.select(0, 0);
    game.select(0, 1);
    expect(game.score).toBeGreaterThan(40);

    game.restartStage();
    expect(game.score).toBe(40);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.tilesRemaining).toBe(48);
    expect(game.stage).toBe(1);
  });

  it('starts a fresh run when the difficulty is changed', () => {
    const game = createGame({ difficulty: 'easy' });
    game.loadBoard(
      [
        [1, 1],
        [0, 0],
      ],
      { score: 99, evaluate: false },
    );

    game.startRun('hard');
    expect(game.stage).toBe(3);
    expect(game.score).toBe(0);
    expect(game.rows).toBe(10);
    expect(game.cols).toBe(12);
    expect(game.remainingHints).toBe(1);
  });

  it('does not advance before the board is cleared', () => {
    const game = createGame();
    expect(game.advance()).toBe(false);
    expect(game.stage).toBe(1);
  });
});

describe('loadBoard validation', () => {
  it('rejects malformed grids and negative counters', () => {
    const game = createGame();
    expect(() => game.loadBoard([])).toThrow(RangeError);
    expect(() => game.loadBoard([[1], [1, 0]])).toThrow(RangeError);
    expect(() => game.loadBoard([[-1, 1]])).toThrow(RangeError);
    expect(() =>
      game.loadBoard(
        [
          [1, 1],
          [0, 0],
        ],
        { score: -1 },
      ),
    ).toThrow(RangeError);
  });

  it('exposes detached snapshots so callers cannot mutate the board', () => {
    const game = createGame();
    game.loadBoard(
      [
        [1, 1],
        [2, 2],
      ],
      { evaluate: false },
    );

    const rows = game.toRows();
    rows[0][0] = 9;
    expect(game.tileAt(0, 0)?.type).toBe(1);

    const selected = game.selected;
    game.select(0, 0);
    if (selected) {
      selected.row = 9;
    }
    expect(game.selected).toEqual({ row: 0, col: 0 });
  });
});
