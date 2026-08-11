import { createStorage } from '../services/storage.js';
import { GAME_STATUS } from './core/constants.js';
import { Game2048 } from './core/game-2048.js';
import { Game2048Hud } from './ui/hud.js';
import { Game2048InputController } from './ui/input-controller.js';
import { Game2048Renderer } from './ui/renderer.js';

/**
 * Application entry point for the 2048 page: wires the headless rules to the
 * DOM, translates keyboard, swipe and button input into moves and persists the
 * best score.
 *
 * The board only changes in response to input, so the DOM is updated on demand
 * rather than from an animation loop.
 */

const STORAGE_KEYS = Object.freeze({
  bestScore: 'best-score',
});

const storage = createStorage('game-2048');

/**
 * @template {Element} T
 * @param {string} selector
 * @param {new () => T} [type]
 * @returns {T}
 */
function queryRequired(selector, type) {
  const element = document.querySelector(selector);
  if (!element || (type && !(element instanceof type))) {
    throw new Error(`Required element not found or of unexpected type: ${selector}`);
  }
  return /** @type {T} */ (element);
}

function bootstrap() {
  const elements = {
    boardFrame: queryRequired('#board-frame', HTMLElement),
    gridLayer: queryRequired('#grid', HTMLElement),
    tileLayer: queryRequired('#tiles', HTMLElement),
    score: queryRequired('#score', HTMLElement),
    bestScore: queryRequired('#best-score', HTMLElement),
    largestTile: queryRequired('#largest-tile', HTMLElement),
    moveCount: queryRequired('#move-count', HTMLElement),
    overlay: queryRequired('#overlay', HTMLElement),
    overlayTitle: queryRequired('#overlay-title', HTMLElement),
    overlayMessage: queryRequired('#overlay-message', HTMLElement),
    overlayContinue: queryRequired('#overlay-continue', HTMLButtonElement),
    overlayRestart: queryRequired('#overlay-restart', HTMLButtonElement),
    restartButton: queryRequired('#restart', HTMLButtonElement),
    dpad: queryRequired('#dpad', HTMLElement),
    boardSummary: queryRequired('#board-summary', HTMLElement),
    liveRegion: queryRequired('#live-region', HTMLElement),
  };

  let bestScore = Math.max(0, storage.readNumber(STORAGE_KEYS.bestScore, 0));

  const game = new Game2048();
  const hud = new Game2048Hud(elements);
  const renderer = new Game2048Renderer(elements, game);

  renderer.mount();
  renderer.render();
  hud.update(game, bestScore);

  /* --------------------------------------------------------------- actions */

  function persistBestScore() {
    if (game.score > bestScore) {
      bestScore = game.score;
      storage.writeNumber(STORAGE_KEYS.bestScore, bestScore);
    }
  }

  /** @param {import('./core/constants.js').DirectionName} direction */
  function playMove(direction) {
    const result = game.move(direction);
    if (!result.moved) {
      return;
    }

    renderer.render();
    persistBestScore();
    hud.update(game, bestScore);

    if (result.gained > 0) {
      hud.pulseScore();
    }

    if (result.won) {
      hud.announce(`合成了 ${game.winTile}！继续挑战或重新开始。`);
    } else if (result.gameOver) {
      hud.announce(`游戏结束，本局得分 ${game.score}，最大方块 ${game.largestTile}。`);
    } else if (result.gained > 0) {
      hud.announce(`得分 +${result.gained}，当前 ${game.score} 分。`);
    }
  }

  function restart() {
    persistBestScore();
    game.reset();
    // A restart shares no tiles with the finished board, so the pooled elements
    // are dropped instead of being animated away.
    renderer.clear();
    renderer.render();
    hud.update(game, bestScore);
    hud.announce('新的一局已开始。');
  }

  function continueAfterWin() {
    if (!game.continueAfterWin()) {
      return;
    }
    hud.update(game, bestScore);
    hud.announce(
      game.status === GAME_STATUS.GAME_OVER ? '棋盘已无处可走，本局结束。' : '继续挑战更大的方块。',
    );
  }

  /* -------------------------------------------------------------- bindings */

  const input = new Game2048InputController({
    surface: elements.boardFrame,
    directionButtons: elements.dpad.querySelectorAll('[data-direction]'),
    handlers: {
      onMove: playMove,
      onRestart: restart,
      onContinue: continueAfterWin,
    },
  });
  input.attach();

  elements.restartButton.addEventListener('click', restart);
  elements.overlayRestart.addEventListener('click', restart);
  elements.overlayContinue.addEventListener('click', continueAfterWin);

  globalThis.addEventListener('pagehide', () => {
    input.detach();
    renderer.destroy();
    persistBestScore();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
