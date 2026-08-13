// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GAME_STATUS } from '../src/js/lianliankan/core/constants.js';
import { LianliankanGame } from '../src/js/lianliankan/core/lianliankan-game.js';
import { LianliankanHud } from '../src/js/lianliankan/ui/hud.js';
import { LianliankanInputController } from '../src/js/lianliankan/ui/input-controller.js';
import { LianliankanRenderer } from '../src/js/lianliankan/ui/renderer.js';

function mountBoard() {
  document.body.innerHTML = `
    <div id="board-frame" class="board board--lianliankan">
      <div id="tiles"></div>
      <svg id="paths"></svg>
    </div>
  `;
  return {
    tileLayer: /** @type {HTMLElement} */ (document.querySelector('#tiles')),
    pathLayer: /** @type {SVGSVGElement} */ (document.querySelector('#paths')),
  };
}

function mountHud() {
  document.body.innerHTML = `
    <output id="score"></output>
    <output id="best-score"></output>
    <output id="stage"></output>
    <output id="combo"></output>
    <output id="hints"></output>
    <output id="time"></output>
    <div id="overlay" hidden>
      <h2 id="overlay-title"></h2>
      <p id="overlay-message"></p>
      <button id="overlay-advance" type="button" hidden></button>
      <button id="overlay-restart" type="button"></button>
    </div>
    <button id="hint" type="button"></button>
    <button id="undo" type="button"></button>
    <select id="difficulty">
      <option value="easy">轻松</option>
      <option value="standard">标准</option>
      <option value="hard">困难</option>
    </select>
    <p id="board-summary"></p>
    <p id="live-region"></p>
  `;
  return {
    score: /** @type {HTMLElement} */ (document.querySelector('#score')),
    bestScore: /** @type {HTMLElement} */ (document.querySelector('#best-score')),
    stage: /** @type {HTMLElement} */ (document.querySelector('#stage')),
    combo: /** @type {HTMLElement} */ (document.querySelector('#combo')),
    hints: /** @type {HTMLElement} */ (document.querySelector('#hints')),
    time: /** @type {HTMLElement} */ (document.querySelector('#time')),
    overlay: /** @type {HTMLElement} */ (document.querySelector('#overlay')),
    overlayTitle: /** @type {HTMLElement} */ (document.querySelector('#overlay-title')),
    overlayMessage: /** @type {HTMLElement} */ (document.querySelector('#overlay-message')),
    overlayAdvance: /** @type {HTMLButtonElement} */ (document.querySelector('#overlay-advance')),
    overlayRestart: /** @type {HTMLButtonElement} */ (document.querySelector('#overlay-restart')),
    hintButton: /** @type {HTMLButtonElement} */ (document.querySelector('#hint')),
    undoButton: /** @type {HTMLButtonElement} */ (document.querySelector('#undo')),
    difficulty: /** @type {HTMLSelectElement} */ (document.querySelector('#difficulty')),
    boardSummary: /** @type {HTMLElement} */ (document.querySelector('#board-summary')),
    liveRegion: /** @type {HTMLElement} */ (document.querySelector('#live-region')),
  };
}

describe('LianliankanRenderer', () => {
  /** @type {LianliankanGame} */
  let game;
  /** @type {LianliankanRenderer} */
  let renderer;

  beforeEach(() => {
    const layers = mountBoard();
    game = new LianliankanGame({ random: () => 0.15 });
    game.loadBoard(
      [
        [1, 0, 1],
        [2, 2, 0],
      ],
      { evaluate: false },
    );
    renderer = new LianliankanRenderer(layers, game);
    renderer.mount();
  });

  afterEach(() => {
    renderer.destroy();
  });

  it('requires both layers', () => {
    expect(() => new LianliankanRenderer({ tileLayer: document.body }, game)).toThrow(TypeError);
  });

  it('builds one button per cell and writes board geometry', () => {
    const tiles = document.querySelector('#tiles');
    expect(tiles?.querySelectorAll('.llk-tile')).toHaveLength(6);
    expect(tiles?.style.getPropertyValue('--board-rows')).toBe('2');
    expect(tiles?.style.getPropertyValue('--board-cols')).toBe('3');
    renderer.mount();
    expect(tiles?.querySelectorAll('.llk-tile')).toHaveLength(6);
  });

  it('renders glyphs, hides empties and marks the selection', () => {
    game.select(0, 0);
    renderer.render();

    const first = /** @type {HTMLButtonElement} */ (
      document.querySelector('[data-row="0"][data-col="0"]')
    );
    const empty = /** @type {HTMLButtonElement} */ (
      document.querySelector('[data-row="0"][data-col="1"]')
    );

    expect(first.hidden).toBe(false);
    expect(first.dataset.type).toBe('1');
    expect(first.textContent).not.toBe('');
    expect(first.classList.contains('is-selected')).toBe(true);
    expect(empty.hidden).toBe(true);
    expect(empty.disabled).toBe(true);
  });

  it('draws a polyline for the last connecting path', () => {
    renderer.showPath([
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ]);

    const line = document.querySelector('#paths .board__path-line');
    expect(line?.getAttribute('points')).toBe('0.5,0.5 2.5,0.5');
  });
});

describe('LianliankanHud', () => {
  it('fills the scoreboard and keeps the overlay hidden while playing', () => {
    const elements = mountHud();
    const game = new LianliankanGame({ random: () => 0.2, difficulty: 'standard' });
    const hud = new LianliankanHud(elements);

    hud.update(game, 1200);

    expect(elements.score.textContent).toBe('0');
    expect(elements.bestScore.textContent).toBe('1200');
    expect(elements.stage.textContent).toContain('标准');
    expect(elements.hints.textContent).toBe('3/3');
    expect(elements.time.textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(elements.overlay.hidden).toBe(true);
    expect(elements.boardSummary.textContent).toContain('剩余');
  });

  it('shows the cleared card and announces messages', () => {
    const elements = mountHud();
    const game = new LianliankanGame({ random: () => 0.2 });
    game.loadBoard(
      [
        [1, 1],
        [0, 0],
      ],
      { evaluate: false },
    );
    game.select(0, 0);
    game.select(0, 1);

    const hud = new LianliankanHud(elements);
    hud.update(game, game.score);
    hud.announce('过关');

    expect(game.status).toBe(GAME_STATUS.CLEARED);
    expect(elements.overlay.hidden).toBe(false);
    expect(elements.overlay.dataset.status).toBe('cleared');
    expect(elements.overlayAdvance.hidden).toBe(false);
    expect(elements.liveRegion.textContent).toBe('过关');
  });
});

describe('LianliankanInputController', () => {
  it('maps tile clicks and command keys', () => {
    document.body.innerHTML = `
      <div id="tiles">
        <button type="button" data-row="1" data-col="2">●</button>
      </div>
    `;
    const calls = {
      select: /** @type {number[][]} */ ([]),
      hint: 0,
      undo: 0,
      restart: 0,
      advance: 0,
      deselect: 0,
    };
    const input = new LianliankanInputController({
      surface: /** @type {HTMLElement} */ (document.querySelector('#tiles')),
      handlers: {
        onSelect: (row, col) => calls.select.push([row, col]),
        onHint: () => {
          calls.hint += 1;
        },
        onUndo: () => {
          calls.undo += 1;
        },
        onRestart: () => {
          calls.restart += 1;
        },
        onAdvance: () => {
          calls.advance += 1;
        },
        onDeselect: () => {
          calls.deselect += 1;
        },
      },
    });
    input.attach();

    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));

    expect(calls.select).toEqual([[1, 2]]);
    expect(calls.hint).toBe(1);
    expect(calls.undo).toBe(1);
    expect(calls.restart).toBe(1);
    expect(calls.advance).toBe(1);
    expect(calls.deselect).toBe(1);

    input.detach();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true }));
    expect(calls.hint).toBe(1);
  });
});
