// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Game2048 } from '../src/js/game2048/core/game-2048.js';
import { Game2048Hud } from '../src/js/game2048/ui/hud.js';
import { Game2048InputController } from '../src/js/game2048/ui/input-controller.js';
import { Game2048Renderer } from '../src/js/game2048/ui/renderer.js';

/** Spawns in the last free cell and never rolls a 4, as in the core suite. */
const lastFreeCell = () => 1;

/**
 * @param {HTMLElement} element
 * @returns {{ x: number, y: number }}
 */
function cellOf(element) {
  return {
    x: Number(element.style.getPropertyValue('--tile-x')),
    y: Number(element.style.getPropertyValue('--tile-y')),
  };
}

/** @returns {HTMLElement[]} */
function liveTiles() {
  return [...document.querySelectorAll('.tile:not(.tile--retiring)')];
}

describe('Game2048Renderer', () => {
  /** @type {Game2048} */
  let game;
  /** @type {Game2048Renderer} */
  let renderer;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="grid"></div><div id="tiles"></div>';
    game = new Game2048({ random: lastFreeCell, fourProbability: 0 });
    renderer = new Game2048Renderer(
      {
        gridLayer: /** @type {HTMLElement} */ (document.querySelector('#grid')),
        tileLayer: /** @type {HTMLElement} */ (document.querySelector('#tiles')),
      },
      game,
    );
    renderer.mount();
  });

  afterEach(() => {
    renderer.destroy();
    vi.useRealTimers();
  });

  it('requires both layers', () => {
    expect(() => new Game2048Renderer({ gridLayer: document.body }, game)).toThrow(TypeError);
  });

  it('builds one background cell per board cell', () => {
    const grid = /** @type {HTMLElement} */ (document.querySelector('#grid'));

    expect(grid.querySelectorAll('.board__cell')).toHaveLength(16);
    expect(grid.style.getPropertyValue('--grid-size')).toBe('4');

    // Mounting again must not duplicate the cells.
    renderer.mount();
    expect(grid.querySelectorAll('.board__cell')).toHaveLength(16);
  });

  it('renders every tile with its cell, value and digit count', () => {
    game.loadBoard([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 1024, 0],
      [0, 0, 0, 0],
    ]);
    renderer.render();

    const tiles = liveTiles();
    expect(tiles).toHaveLength(2);

    const [small, large] = tiles.sort((a, b) => Number(a.dataset.value) - Number(b.dataset.value));
    expect(small.textContent).toBe('2');
    expect(small.dataset.digits).toBe('1');
    expect(cellOf(small)).toEqual({ x: 0, y: 0 });
    expect(large.dataset.value).toBe('1024');
    expect(large.dataset.digits).toBe('4');
    expect(cellOf(large)).toEqual({ x: 2, y: 2 });
  });

  it('moves the same element when a tile slides', () => {
    game.loadBoard([
      [0, 0, 0, 8],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    renderer.render();
    const [element] = liveTiles();

    game.move('left');
    renderer.render();

    const moved = liveTiles().find((tile) => tile.dataset.value === '8');
    expect(moved).toBe(element);
    expect(cellOf(moved)).toEqual({ x: 0, y: 0 });
  });

  it('slides the consumed tiles into the merge and drops them afterwards', () => {
    game.loadBoard([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    renderer.render();

    game.move('right');
    renderer.render();

    const retiring = [...document.querySelectorAll('.tile--retiring')];
    expect(retiring).toHaveLength(2);
    for (const tile of retiring) {
      expect(cellOf(tile)).toEqual({ x: 3, y: 0 });
    }

    const merged = liveTiles().find((tile) => tile.dataset.value === '4');
    expect(merged.classList.contains('tile--merged')).toBe(true);

    vi.runAllTimers();
    expect(document.querySelectorAll('.tile--retiring')).toHaveLength(0);
    expect(liveTiles()).toHaveLength(2);
  });

  it('drops tiles that are still animating out as soon as the board changes again', () => {
    game.loadBoard([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    renderer.render();
    game.move('right');
    renderer.render();

    expect(document.querySelectorAll('.tile--retiring')).toHaveLength(2);

    game.move('down');
    renderer.render();

    expect(document.querySelectorAll('.tile--retiring')).toHaveLength(0);
  });

  it('marks a spawned tile as new', () => {
    game.loadBoard([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    renderer.render();

    const spawned = game.move('left').spawned;
    renderer.render();

    const element = liveTiles().find(
      (tile) => cellOf(tile).x === spawned.x && cellOf(tile).y === spawned.y,
    );
    expect(element.classList.contains('tile--new')).toBe(true);
  });

  it('starts from an empty layer after a restart', () => {
    renderer.render();
    expect(liveTiles()).toHaveLength(2);

    game.reset();
    renderer.clear();
    renderer.render();

    expect(liveTiles()).toHaveLength(2);
    expect(document.querySelectorAll('.tile')).toHaveLength(2);
  });
});

describe('Game2048Hud', () => {
  /** @type {Game2048} */
  let game;
  /** @type {Game2048Hud} */
  let hud;
  /** @type {Record<string, HTMLElement>} */
  let elements;

  beforeEach(() => {
    document.body.innerHTML = `
      <output id="score">0</output>
      <output id="best-score">0</output>
      <output id="largest-tile">0</output>
      <output id="move-count">0</output>
      <div id="overlay" data-status="playing" hidden>
        <h2 id="overlay-title"></h2>
        <p id="overlay-message"></p>
        <button id="overlay-continue" type="button" hidden></button>
        <button id="overlay-restart" type="button"></button>
      </div>
      <p id="board-summary"></p>
      <p id="live-region"></p>
    `;

    const query = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));
    elements = {
      score: query('#score'),
      bestScore: query('#best-score'),
      largestTile: query('#largest-tile'),
      moveCount: query('#move-count'),
      overlay: query('#overlay'),
      overlayTitle: query('#overlay-title'),
      overlayMessage: query('#overlay-message'),
      overlayContinue: query('#overlay-continue'),
      overlayRestart: query('#overlay-restart'),
      boardSummary: query('#board-summary'),
      liveRegion: query('#live-region'),
    };

    game = new Game2048({ random: lastFreeCell, fourProbability: 0 });
    hud = new Game2048Hud(elements);
  });

  it('mirrors the score, the largest tile and the move count', () => {
    game.loadBoard(
      [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 512, 0],
      ],
      { score: 300 },
    );
    game.move('left');
    hud.update(game, 900);

    expect(elements.score.textContent).toBe('304');
    expect(elements.bestScore.textContent).toBe('900');
    expect(elements.largestTile.textContent).toBe('512');
    expect(elements.moveCount.textContent).toBe('1');
    expect(elements.overlay.hidden).toBe(true);
  });

  it('describes the board row by row for screen readers', () => {
    game.loadBoard([
      [2, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 8],
    ]);
    hud.update(game, 0);

    expect(elements.boardSummary.textContent).toBe(
      '第 1 行：2、空、空、空；第 2 行：空、4、空、空；第 3 行：空、空、空、空；第 4 行：空、空、空、8。',
    );
  });

  it('offers to keep going after a win', () => {
    game.loadBoard([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    game.move('left');
    hud.update(game, 0);

    expect(elements.overlay.hidden).toBe(false);
    expect(elements.overlay.dataset.status).toBe('won');
    expect(elements.overlayTitle.textContent).toBe('达成 2048！');
    expect(elements.overlayContinue.hidden).toBe(false);
    expect(elements.overlayRestart.textContent).toBe('重新开始 (R)');

    game.continueAfterWin();
    hud.update(game, 0);

    expect(elements.overlay.hidden).toBe(true);
  });

  it('shows the final score when the board runs out of moves', () => {
    game.loadBoard([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    hud.update(game, 0);

    expect(elements.overlay.hidden).toBe(false);
    expect(elements.overlay.dataset.status).toBe('game-over');
    expect(elements.overlayTitle.textContent).toBe('游戏结束');
    expect(elements.overlayMessage.textContent).toContain('最大方块 4');
    expect(elements.overlayContinue.hidden).toBe(true);
    expect(elements.overlayRestart.textContent).toBe('再来一局 (R)');
  });

  it('announces messages and pulses the score', () => {
    hud.announce('得分 +8，当前 8 分。');
    expect(elements.liveRegion.textContent).toBe('得分 +8，当前 8 分。');

    hud.pulseScore();
    expect(elements.score.classList.contains('is-pulsing')).toBe(true);
  });
});

describe('Game2048InputController', () => {
  /** @type {Game2048InputController} */
  let controller;
  let handlers;

  /**
   * @param {string} code
   * @param {KeyboardEventInit} [init]
   */
  function pressKey(code, init = {}) {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
  }

  /**
   * @param {string} type
   * @param {number} x
   * @param {number} y
   */
  function touch(type, x, y) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'changedTouches', { value: [{ clientX: x, clientY: y }] });
    return event;
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="surface"></div>
      <div id="dpad">
        <button data-direction="up"></button>
        <button data-direction="left"></button>
      </div>
      <input id="field" />
    `;
    handlers = { onMove: vi.fn(), onRestart: vi.fn(), onContinue: vi.fn() };
    controller = new Game2048InputController({
      surface: /** @type {HTMLElement} */ (document.querySelector('#surface')),
      directionButtons: document.querySelectorAll('#dpad [data-direction]'),
      handlers,
    });
    controller.attach();
  });

  afterEach(() => {
    controller.detach();
  });

  it('requires a surface and a move handler', () => {
    expect(() => new Game2048InputController({ handlers: { onMove() {} } })).toThrow(TypeError);
    expect(() => new Game2048InputController({ surface: document.body, handlers: {} })).toThrow(
      TypeError,
    );
  });

  it('maps the arrow keys and WASD to moves', () => {
    for (const [code, direction] of [
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['KeyW', 'up'],
      ['KeyS', 'down'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
    ]) {
      handlers.onMove.mockClear();
      const event = pressKey(code);
      expect(handlers.onMove).toHaveBeenCalledWith(direction);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it('maps the command keys', () => {
    pressKey('KeyR');
    pressKey('KeyC');
    pressKey('Space');

    expect(handlers.onRestart).toHaveBeenCalledTimes(1);
    expect(handlers.onContinue).toHaveBeenCalledTimes(2);
  });

  it('ignores shortcuts with modifiers and keys typed into a form control', () => {
    pressKey('ArrowUp', { ctrlKey: true });
    pressKey('KeyR', { metaKey: true });

    const field = /** @type {HTMLInputElement} */ (document.querySelector('#field'));
    field.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true, cancelable: true }),
    );

    expect(handlers.onMove).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('moves on the on-screen pad and on swipes', () => {
    document.querySelector('#dpad [data-direction="up"]').dispatchEvent(new Event('click'));
    expect(handlers.onMove).toHaveBeenLastCalledWith('up');

    const surface = /** @type {HTMLElement} */ (document.querySelector('#surface'));
    surface.dispatchEvent(touch('touchstart', 200, 200));
    surface.dispatchEvent(touch('touchend', 200, 260));
    expect(handlers.onMove).toHaveBeenLastCalledWith('down');

    // A tap is not a swipe and must not move the board.
    handlers.onMove.mockClear();
    surface.dispatchEvent(touch('touchstart', 200, 200));
    surface.dispatchEvent(touch('touchend', 205, 203));
    expect(handlers.onMove).not.toHaveBeenCalled();
  });

  it('stops responding once detached', () => {
    controller.detach();
    pressKey('ArrowUp');
    pressKey('KeyR');

    expect(handlers.onMove).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
  });
});
