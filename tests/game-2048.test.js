import { describe, expect, it } from 'vitest';

import { createRandom } from '../src/js/core/rng.js';
import { DIRECTIONS, GAME_STATUS } from '../src/js/game2048/core/constants.js';
import { Game2048 } from '../src/js/game2048/core/game-2048.js';

/**
 * Random source that always picks the last free cell in row-major order, which
 * keeps the spawned tile out of the way of the scripted fixtures.
 */
const lastFreeCell = () => 1;

/**
 * @param {readonly number[]} values Values handed out in order; the last one
 *   repeats once the script is exhausted.
 * @returns {() => number}
 */
function scriptedRandom(values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

/**
 * @param {Partial<ConstructorParameters<typeof Game2048>[0]>} [options]
 * @returns {Game2048} A game whose spawner is fully deterministic.
 */
function createGame(options = {}) {
  return new Game2048({ random: lastFreeCell, fourProbability: 0, ...options });
}

describe('Game2048 — initial state', () => {
  it('starts on a 4×4 board with two tiles and no score', () => {
    const game = new Game2048({ random: createRandom(7) });

    expect(game.size).toBe(4);
    expect(game.winTile).toBe(2048);
    expect(game.score).toBe(0);
    expect(game.moveCount).toBe(0);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.hasWon).toBe(false);
    expect(game.isFinished).toBe(false);
    expect(game.tiles).toHaveLength(2);
    expect(game.emptyCellCount).toBe(14);
  });

  it('only ever deals 2s and 4s', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = new Game2048({ random: createRandom(seed) });
      for (const tile of game.tiles) {
        expect([2, 4]).toContain(tile.value);
      }
      expect(game.largestTile).toBe(Math.max(...game.tiles.map((tile) => tile.value)));
    }
  });

  it('honours the four probability at both extremes', () => {
    const onlyTwos = new Game2048({ random: createRandom(3), fourProbability: 0 });
    const onlyFours = new Game2048({ random: createRandom(3), fourProbability: 1 });

    expect(onlyTwos.tiles.map((tile) => tile.value)).toEqual([2, 2]);
    expect(onlyFours.tiles.map((tile) => tile.value)).toEqual([4, 4]);
  });

  it('replays identically for the same seed', () => {
    const first = new Game2048({ random: createRandom(2024) });
    const second = new Game2048({ random: createRandom(2024) });

    for (const direction of ['left', 'up', 'right', 'down', 'left', 'up']) {
      first.move(direction);
      second.move(direction);
    }

    expect(first.toRows()).toEqual(second.toRows());
    expect(first.score).toBe(second.score);
  });

  it('supports a custom board size and win tile', () => {
    const game = createGame({ size: 3, winTile: 8, startTiles: 1 });

    expect(game.size).toBe(3);
    expect(game.winTile).toBe(8);
    expect(game.toRows()).toHaveLength(3);
    expect(game.emptyCellCount).toBe(8);
  });

  it('rejects invalid options', () => {
    expect(() => new Game2048({ size: 1 })).toThrow(RangeError);
    expect(() => new Game2048({ size: 4.5 })).toThrow(RangeError);
    expect(() => new Game2048({ winTile: 2 })).toThrow(RangeError);
    expect(() => new Game2048({ winTile: 3000 })).toThrow(RangeError);
    expect(() => new Game2048({ startTiles: 0 })).toThrow(RangeError);
    expect(() => new Game2048({ startTiles: 16 })).toThrow(RangeError);
    expect(() => new Game2048({ fourProbability: 1.5 })).toThrow(RangeError);
    expect(() => new Game2048({ random: 'nope' })).toThrow(TypeError);
  });
});

describe('Game2048 — sliding', () => {
  it('packs every row towards the chosen edge', () => {
    const game = createGame();
    game.loadBoard([
      [0, 2, 0, 4],
      [8, 0, 0, 0],
      [0, 0, 16, 0],
      [0, 32, 0, 64],
    ]);

    expect(game.move(DIRECTIONS.LEFT).moved).toBe(true);
    expect(game.toRows()).toEqual([
      [2, 4, 0, 0],
      [8, 0, 0, 0],
      [16, 0, 0, 0],
      // The last cell holds the tile spawned by the move.
      [32, 64, 0, 2],
    ]);
  });

  it('packs columns upwards and downwards', () => {
    const upwards = createGame();
    upwards.loadBoard([
      [0, 0, 0, 0],
      [2, 0, 8, 0],
      [0, 4, 0, 0],
      [16, 0, 32, 0],
    ]);
    upwards.move(DIRECTIONS.UP);

    expect(upwards.toRows()).toEqual([
      [2, 4, 8, 0],
      [16, 0, 32, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 2],
    ]);

    const downwards = createGame();
    downwards.loadBoard([
      [2, 0, 8, 0],
      [0, 4, 0, 0],
      [16, 0, 32, 0],
      [0, 0, 0, 0],
    ]);
    downwards.move(DIRECTIONS.DOWN);

    expect(downwards.toRows()).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 8, 0],
      [16, 4, 32, 2],
    ]);
  });

  it('reports a move that changes nothing and neither spawns nor scores', () => {
    const game = createGame();
    game.loadBoard(
      [
        [2, 4, 0, 0],
        [8, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      { score: 12 },
    );

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.moved).toBe(false);
    expect(result.spawned).toBeNull();
    expect(game.score).toBe(12);
    expect(game.moveCount).toBe(0);
    expect(game.toRows()[0]).toEqual([2, 4, 0, 0]);
  });

  it('adds exactly one tile per successful move', () => {
    const game = new Game2048({ random: createRandom(11) });

    for (let move = 0; move < 12; move += 1) {
      const before = game.tiles.length;
      const result = game.move(['left', 'up', 'right', 'down'][move % 4]);
      if (result.moved) {
        expect(result.spawned).not.toBeNull();
        expect(game.tiles.length).toBe(before - result.merges + 1);
      }
    }
  });

  it('rejects an unknown direction', () => {
    expect(() => createGame().move('sideways')).toThrow(RangeError);
  });
});

describe('Game2048 — merging', () => {
  it('merges a pair and adds the new value to the score', () => {
    const game = createGame();
    game.loadBoard([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.merges).toBe(1);
    expect(result.gained).toBe(4);
    expect(result.largestMerge).toBe(4);
    expect(game.score).toBe(4);
    expect(game.toRows()[0]).toEqual([4, 0, 0, 0]);
  });

  it('merges each tile at most once per move', () => {
    const game = createGame();
    game.loadBoard([
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.merges).toBe(2);
    expect(result.gained).toBe(8);
    expect(game.toRows()[0]).toEqual([4, 4, 0, 0]);
  });

  it('resolves merges from the edge the tiles move towards', () => {
    const leftwards = createGame();
    leftwards.loadBoard([
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    leftwards.move(DIRECTIONS.LEFT);
    expect(leftwards.toRows()[0]).toEqual([4, 2, 0, 0]);

    const rightwards = createGame();
    rightwards.loadBoard([
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    rightwards.move(DIRECTIONS.RIGHT);
    expect(rightwards.toRows()[0]).toEqual([0, 0, 2, 4]);
  });

  it('does not chain a freshly merged tile into another merge', () => {
    const game = createGame();
    game.loadBoard([
      [4, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.merges).toBe(1);
    expect(game.toRows()[0]).toEqual([4, 4, 0, 0]);
    expect(game.score).toBe(4);
  });

  it('merges columns as well and accumulates the score across moves', () => {
    const game = createGame();
    game.loadBoard([
      [8, 0, 0, 0],
      [8, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0],
    ]);

    const first = game.move(DIRECTIONS.UP);
    expect(first.gained).toBe(24);
    expect(first.merges).toBe(2);
    expect(game.toRows().map((row) => row[0])).toEqual([16, 8, 0, 0]);

    const second = game.move(DIRECTIONS.DOWN);
    expect(second.moved).toBe(true);
    expect(game.score).toBe(24 + second.gained);
  });

  it('never merges tiles of different values', () => {
    const game = createGame();
    game.loadBoard([
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.moved).toBe(false);
    expect(game.score).toBe(0);
  });
});

describe('Game2048 — winning', () => {
  /** A position that reaches the win tile with a single move to the left. */
  const winningPosition = Object.freeze([
    Object.freeze([1024, 1024, 4, 8]),
    Object.freeze([2, 8, 2, 4]),
    Object.freeze([4, 2, 4, 2]),
    Object.freeze([2, 4, 2, 4]),
  ]);

  it('ends the move that creates the win tile', () => {
    const game = createGame();
    game.loadBoard([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.won).toBe(true);
    expect(result.largestMerge).toBe(2048);
    expect(game.status).toBe(GAME_STATUS.WON);
    expect(game.hasWon).toBe(true);
    expect(game.isFinished).toBe(true);
    expect(game.largestTile).toBe(2048);
  });

  it('refuses moves until the player decides how to go on', () => {
    const game = createGame();
    game.loadBoard([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move(DIRECTIONS.LEFT);

    const blocked = game.move(DIRECTIONS.DOWN);
    expect(blocked.moved).toBe(false);

    expect(game.continueAfterWin()).toBe(true);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.move(DIRECTIONS.DOWN).moved).toBe(true);
  });

  it('announces the win only once', () => {
    const game = createGame();
    game.loadBoard([
      [1024, 1024, 0, 0],
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    expect(game.move(DIRECTIONS.LEFT).won).toBe(true);
    game.continueAfterWin();

    const second = game.move(DIRECTIONS.DOWN);
    expect(second.merges).toBe(1);
    expect(second.won).toBe(false);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.largestTile).toBe(4096);
  });

  it('treats a loaded position that already holds the win tile as continued', () => {
    const game = createGame();
    game.loadBoard([
      [2048, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    expect(game.hasWon).toBe(true);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.continueAfterWin()).toBe(false);
  });

  it('ends the run when the winning move also fills the board', () => {
    const game = createGame();
    game.loadBoard(winningPosition);

    const result = game.move(DIRECTIONS.LEFT);

    expect(result.won).toBe(true);
    expect(game.status).toBe(GAME_STATUS.WON);
    expect(game.emptyCellCount).toBe(0);

    game.continueAfterWin();

    expect(game.status).toBe(GAME_STATUS.GAME_OVER);
  });
});

describe('Game2048 — game over', () => {
  it('reports a full board without equal neighbours as finished', () => {
    const game = createGame();
    game.loadBoard([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);

    expect(game.status).toBe(GAME_STATUS.GAME_OVER);
    expect(game.hasMoves).toBe(false);
    expect(game.isFinished).toBe(true);
    for (const direction of Object.values(DIRECTIONS)) {
      expect(game.move(direction).moved).toBe(false);
    }
  });

  it('keeps playing while a merge is still available on a full board', () => {
    const game = createGame();
    game.loadBoard([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 4],
    ]);

    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.hasMoves).toBe(true);
    expect(game.move(DIRECTIONS.RIGHT).merges).toBe(1);
  });

  it('ends the run when the tile spawned after a move leaves no options', () => {
    const game = createGame();
    game.loadBoard([
      [4, 2, 4, 0],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);

    const result = game.move(DIRECTIONS.RIGHT);

    expect(result.moved).toBe(true);
    expect(result.gameOver).toBe(true);
    expect(game.status).toBe(GAME_STATUS.GAME_OVER);
    expect(game.toRows()).toEqual([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
  });
});

describe('Game2048 — tiles exposed to the renderer', () => {
  it('keeps the identity of a sliding tile and records where it came from', () => {
    const game = createGame();
    game.loadBoard([
      [0, 0, 0, 8],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const before = game.tileAt(3, 0);

    game.move(DIRECTIONS.LEFT);
    const after = game.tiles.find((tile) => tile.id === before.id);

    expect(after).toMatchObject({ value: 8, x: 0, y: 0, isNew: false, isMerged: false });
    expect(after.previous).toEqual({ x: 3, y: 0 });
  });

  it('describes a merge with a fresh tile and the two it consumed', () => {
    const game = createGame();
    game.loadBoard([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const sources = [game.tileAt(0, 0).id, game.tileAt(3, 0).id];

    const result = game.move(DIRECTIONS.RIGHT);

    const merged = game.tiles.find((tile) => tile.value === 4);
    expect(merged.isMerged).toBe(true);
    expect(merged.previous).toBeNull();
    expect(sources).not.toContain(merged.id);

    expect(result.removed.map((tile) => tile.id).sort()).toEqual([...sources].sort());
    // Both consumed tiles end up on the cell they merged into.
    for (const tile of result.removed) {
      expect({ x: tile.x, y: tile.y }).toEqual({ x: 3, y: 0 });
    }
    expect(result.removed.map((tile) => tile.previous)).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ]),
    );
  });

  it('marks the spawned tile as new and clears the flag on the next move', () => {
    const game = createGame();
    game.loadBoard([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const spawned = game.move(DIRECTIONS.LEFT).spawned;
    expect(spawned.isNew).toBe(true);
    expect(game.tiles.filter((tile) => tile.isNew)).toHaveLength(1);

    game.move(DIRECTIONS.DOWN);
    expect(game.tiles.find((tile) => tile.id === spawned.id).isNew).toBe(false);
  });

  it('hands out copies, so a renderer cannot corrupt the board', () => {
    const game = createGame();
    game.loadBoard([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    const [tile] = game.tiles;
    tile.value = 4096;
    tile.x = 3;

    expect(game.toRows()[0]).toEqual([2, 0, 0, 0]);
    expect(game.tileAt(0, 0).value).toBe(2);
    expect(game.tileAt(3, 0)).toBeNull();
  });
});

describe('Game2048 — loading and resetting', () => {
  it('rejects positions that do not fit the board', () => {
    const game = createGame();

    expect(() => game.loadBoard([[2, 2, 2, 2]])).toThrow(RangeError);
    expect(() =>
      game.loadBoard([
        [2, 2, 2],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
    ).toThrow(RangeError);
    expect(() =>
      game.loadBoard([
        [3, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
    ).toThrow(RangeError);
    expect(() =>
      game.loadBoard(
        [
          [2, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        { score: -1 },
      ),
    ).toThrow(RangeError);
  });

  it('deals a fresh board on reset', () => {
    const game = new Game2048({ random: scriptedRandom([0, 0.99]) });
    game.loadBoard(
      [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      { score: 5000 },
    );
    game.move(DIRECTIONS.LEFT);

    expect(game.status).toBe(GAME_STATUS.WON);

    game.reset();

    expect(game.score).toBe(0);
    expect(game.moveCount).toBe(0);
    expect(game.status).toBe(GAME_STATUS.PLAYING);
    expect(game.hasWon).toBe(false);
    expect(game.tiles).toHaveLength(2);
    expect(game.largestTile).toBeLessThanOrEqual(4);
  });

  it('counts the moves that actually changed the board', () => {
    const game = createGame();
    game.loadBoard([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    game.move(DIRECTIONS.LEFT);
    expect(game.moveCount).toBe(0);

    game.move(DIRECTIONS.RIGHT);
    expect(game.moveCount).toBe(1);
  });
});
