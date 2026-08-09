import { describe, expect, it } from 'vitest';

import { DEATH_CAUSE, FOOD_TYPE, GAME_STATUS } from '../src/js/core/constants.js';
import { createRandom } from '../src/js/core/rng.js';
import { SnakeGame } from '../src/js/core/snake-game.js';
import { driveTo } from './helpers/drive.js';

/**
 * Deterministic factory. `random: () => 0` always picks the first free cell in
 * row-major order, which makes food placement predictable in the tests.
 *
 * @param {Partial<ConstructorParameters<typeof SnakeGame>[0]>} [options]
 */
function createGame(options = {}) {
  return new SnakeGame({
    cols: 10,
    rows: 10,
    initialLength: 3,
    random: () => 0,
    ...options,
  });
}

describe('SnakeGame — initial state', () => {
  it('places a horizontal snake in the middle of the board facing right', () => {
    const game = createGame();

    expect(game.status).toBe(GAME_STATUS.IDLE);
    expect(game.snake).toHaveLength(3);
    expect(game.head).toEqual({ x: 5, y: 5 });
    expect(game.snake.at(-1)).toEqual({ x: 3, y: 5 });
    expect(game.direction).toBe('right');
    expect(game.score).toBe(0);
    expect(game.level).toBe(1);
  });

  it('spawns food on a free cell', () => {
    const game = createGame();

    expect(game.food).not.toBeNull();
    expect(game.food.type).toBe(FOOD_TYPE.NORMAL);
    expect(game.occupiesCell(game.food.x, game.food.y)).toBe(false);
  });

  it('never spawns food on the snake for any seed', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = createGame({ random: createRandom(seed) });
      expect(game.occupiesCell(game.food.x, game.food.y)).toBe(false);
    }
  });

  it('rejects invalid options', () => {
    expect(() => createGame({ cols: 0 })).toThrow(RangeError);
    expect(() => createGame({ rows: 2.5 })).toThrow(RangeError);
    expect(() => createGame({ cols: 3, initialLength: 3 })).toThrow(RangeError);
    expect(() => createGame({ baseTickMs: 10, minTickMs: 50 })).toThrow(RangeError);
  });
});

describe('SnakeGame — lifecycle', () => {
  it('ignores ticks while idle', () => {
    const game = createGame();
    const result = game.tick();

    expect(result.moved).toBe(false);
    expect(game.head).toEqual({ x: 5, y: 5 });
    expect(game.ticks).toBe(0);
  });

  it('moves one cell per tick without changing the length', () => {
    const game = createGame();
    game.start();

    expect(game.tick().moved).toBe(true);

    expect(game.head).toEqual({ x: 6, y: 5 });
    expect(game.snake).toHaveLength(3);
    expect(game.previousSnake[0]).toEqual({ x: 5, y: 5 });
  });

  it('pauses and resumes without losing progress', () => {
    const game = createGame();
    game.start();
    game.tick();

    expect(game.pause()).toBe(GAME_STATUS.PAUSED);
    expect(game.tick().moved).toBe(false);
    expect(game.head).toEqual({ x: 6, y: 5 });

    expect(game.resume()).toBe(GAME_STATUS.RUNNING);
    game.tick();
    expect(game.head).toEqual({ x: 7, y: 5 });
  });

  it('toggles between running and paused, and starts from idle', () => {
    const game = createGame();

    expect(game.togglePause()).toBe(GAME_STATUS.RUNNING);
    expect(game.togglePause()).toBe(GAME_STATUS.PAUSED);
    expect(game.togglePause()).toBe(GAME_STATUS.RUNNING);
  });

  it('restarts a finished game from a clean state', () => {
    const game = createGame({ cols: 8, rows: 8 });
    game.start();
    for (let tick = 0; tick < 10; tick += 1) {
      game.tick();
    }

    expect(game.status).toBe(GAME_STATUS.GAME_OVER);

    game.restart();
    expect(game.status).toBe(GAME_STATUS.RUNNING);
    expect(game.score).toBe(0);
    expect(game.snake).toHaveLength(3);
    expect(game.deathCause).toBeNull();
  });
});

describe('SnakeGame — steering', () => {
  it('rejects reversals and repeated directions', () => {
    const game = createGame();
    game.start();

    expect(game.enqueueDirection('left')).toBe(false);
    expect(game.enqueueDirection('right')).toBe(false);
    expect(game.enqueueDirection('up')).toBe(true);
  });

  it('rejects unknown directions', () => {
    const game = createGame();
    game.start();

    expect(game.enqueueDirection('diagonal')).toBe(false);
    expect(game.enqueueDirection(undefined)).toBe(false);
  });

  it('applies buffered turns in order, one per tick', () => {
    const game = createGame();
    game.start();

    expect(game.enqueueDirection('up')).toBe(true);
    expect(game.enqueueDirection('left')).toBe(true);

    game.tick();
    expect(game.direction).toBe('up');
    expect(game.head).toEqual({ x: 5, y: 4 });

    game.tick();
    expect(game.direction).toBe('left');
    expect(game.head).toEqual({ x: 4, y: 4 });
  });

  it('validates buffered turns against the last queued direction', () => {
    const game = createGame();
    game.start();

    expect(game.enqueueDirection('up')).toBe(true);
    expect(game.enqueueDirection('down')).toBe(false);
    expect(game.enqueueDirection('left')).toBe(true);
  });

  it('caps the direction buffer', () => {
    const game = createGame({ maxQueuedDirections: 2 });
    game.start();

    expect(game.enqueueDirection('up')).toBe(true);
    expect(game.enqueueDirection('left')).toBe(true);
    expect(game.enqueueDirection('down')).toBe(false);
  });

  it('ignores input once the run is over', () => {
    const game = createGame({ cols: 8, rows: 8 });
    game.start();
    for (let tick = 0; tick < 10; tick += 1) {
      game.tick();
    }

    expect(game.status).toBe(GAME_STATUS.GAME_OVER);
    expect(game.enqueueDirection('up')).toBe(false);
  });
});

describe('SnakeGame — collisions', () => {
  it('ends the run when the snake hits a wall', () => {
    const game = createGame({ cols: 8, rows: 8 });
    game.start();

    /** @type {import('../src/js/core/snake-game.js').TickResult} */
    let result;
    do {
      result = game.tick();
    } while (!result.gameOver && game.ticks < 20);

    expect(result.gameOver).toBe(true);
    expect(game.status).toBe(GAME_STATUS.GAME_OVER);
    expect(game.deathCause).toBe(DEATH_CAUSE.WALL);
    expect(game.head).toEqual({ x: 7, y: 4 });
  });

  it('wraps around the edges when wall collision is disabled', () => {
    const game = createGame({ cols: 8, rows: 8, wallCollision: false });
    game.start();

    for (let tick = 0; tick < 4; tick += 1) {
      expect(game.tick().gameOver).toBe(false);
    }

    expect(game.head).toEqual({ x: 0, y: 4 });
    expect(game.status).toBe(GAME_STATUS.RUNNING);
  });

  it('ends the run when the snake bites its own body', () => {
    const game = createGame({ initialLength: 5 });
    game.start();

    game.enqueueDirection('down');
    game.tick();
    game.enqueueDirection('left');
    game.tick();
    game.enqueueDirection('up');
    const result = game.tick();

    expect(result.gameOver).toBe(true);
    expect(game.deathCause).toBe(DEATH_CAUSE.SELF);
  });

  it('allows moving into the cell the tail vacates in the same tick', () => {
    const game = createGame({ initialLength: 4 });
    game.start();

    game.enqueueDirection('down');
    game.tick();
    game.enqueueDirection('left');
    game.tick();
    game.enqueueDirection('up');
    const result = game.tick();

    expect(result.gameOver).toBe(false);
    expect(game.head).toEqual({ x: 4, y: 5 });
  });
});

describe('SnakeGame — food, scoring and levels', () => {
  it('grows the snake and awards points for normal food', () => {
    const game = createGame();
    game.start();
    const target = { ...game.food };

    const { reached, lastResult, lengthBeforeLastTick } = driveTo(game, target);

    expect(reached).toBe(true);
    expect(lastResult.eaten.type).toBe(FOOD_TYPE.NORMAL);
    expect(lastResult.gainedPoints).toBe(10);
    expect(game.score).toBe(10);
    expect(game.snake).toHaveLength(lengthBeforeLastTick + 1);
    expect(game.food).not.toEqual(target);
    expect(game.occupiesCell(game.food.x, game.food.y)).toBe(false);
  });

  it('raises the level and shortens the tick interval', () => {
    const game = createGame({ pointsPerLevel: 10, baseTickMs: 140, speedUpPerLevelMs: 20 });
    game.start();

    expect(game.tickIntervalMs).toBe(140);

    const { lastResult } = driveTo(game, { ...game.food });

    expect(lastResult.levelUp).toBe(true);
    expect(game.level).toBe(2);
    expect(game.tickIntervalMs).toBe(120);
  });

  it('never drops below the minimum tick interval', () => {
    const game = createGame({ pointsPerLevel: 1, minTickMs: 60, baseTickMs: 140 });
    game.start();
    driveTo(game, { ...game.food });

    expect(game.tickIntervalMs).toBeGreaterThanOrEqual(60);
  });

  it('spawns bonus food after the configured number of normal items', () => {
    const game = createGame({ bonusFoodInterval: 1 });
    game.start();

    expect(game.bonusFood).toBeNull();
    const { lastResult } = driveTo(game, { ...game.food });

    expect(lastResult.bonusSpawned).toBe(true);
    expect(game.bonusFood.type).toBe(FOOD_TYPE.BONUS);
    expect(game.bonusFood.ticksRemaining).toBeGreaterThan(0);
    expect(game.occupiesCell(game.bonusFood.x, game.bonusFood.y)).toBe(false);
  });

  it('awards bonus points without growing the snake', () => {
    const game = createGame({ bonusFoodInterval: 1, bonusFoodLifetimeTicks: 200 });
    game.start();
    driveTo(game, { ...game.food });

    const bonus = { ...game.bonusFood };
    const { reached, lastResult, scoreBeforeLastTick, lengthBeforeLastTick } = driveTo(game, bonus);

    expect(reached).toBe(true);
    expect(lastResult.eaten.type).toBe(FOOD_TYPE.BONUS);
    expect(game.score).toBe(scoreBeforeLastTick + 50);
    expect(game.snake).toHaveLength(lengthBeforeLastTick);
    expect(game.bonusFood).toBeNull();
  });

  it('removes bonus food once its lifetime expires', () => {
    const game = createGame({
      wallCollision: false,
      bonusFoodInterval: 1,
      bonusFoodLifetimeTicks: 3,
    });
    game.start();
    driveTo(game, { ...game.food });

    expect(game.bonusFood).not.toBeNull();

    const results = Array.from({ length: 3 }, () => game.tick());

    expect(results.some((result) => result.bonusExpired)).toBe(true);
    expect(game.bonusFood).toBeNull();
  });

  it('marks the game as won once the board is completely filled', () => {
    const game = new SnakeGame({ cols: 3, rows: 1, initialLength: 2, random: () => 0 });
    game.start();

    const result = game.tick();

    expect(result.won).toBe(true);
    expect(game.status).toBe(GAME_STATUS.WON);
    expect(game.snake).toHaveLength(3);
    expect(game.isFinished).toBe(true);
  });
});
