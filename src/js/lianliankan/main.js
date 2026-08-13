import { createStorage } from '../services/storage.js';
import { SoundPlayer } from '../ui/sound-player.js';
import { DIFFICULTY_IDS, GAME_STATUS } from './core/constants.js';
import { LianliankanGame } from './core/lianliankan-game.js';
import { LianliankanHud } from './ui/hud.js';
import { LianliankanInputController } from './ui/input-controller.js';
import { LianliankanRenderer } from './ui/renderer.js';

/**
 * Application entry point for the Lianliankan page: wires the headless rules
 * to the DOM, drives the optional stage clock from animation frames and
 * persists the best score plus the last chosen difficulty.
 */

const STORAGE_KEYS = Object.freeze({
  bestScore: 'best-score',
  difficulty: 'preferred-difficulty',
});

const DIFFICULTY_VALUES = Object.freeze(Object.values(DIFFICULTY_IDS));

const storage = createStorage('lianliankan');

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
    tileLayer: queryRequired('#tiles', HTMLElement),
    pathLayer: queryRequired('#paths', SVGSVGElement),
    score: queryRequired('#score', HTMLElement),
    bestScore: queryRequired('#best-score', HTMLElement),
    stage: queryRequired('#stage', HTMLElement),
    combo: queryRequired('#combo', HTMLElement),
    hints: queryRequired('#hints', HTMLElement),
    time: queryRequired('#time', HTMLElement),
    overlay: queryRequired('#overlay', HTMLElement),
    overlayTitle: queryRequired('#overlay-title', HTMLElement),
    overlayMessage: queryRequired('#overlay-message', HTMLElement),
    overlayAdvance: queryRequired('#overlay-advance', HTMLButtonElement),
    overlayRestart: queryRequired('#overlay-restart', HTMLButtonElement),
    hintButton: queryRequired('#hint', HTMLButtonElement),
    undoButton: queryRequired('#undo', HTMLButtonElement),
    restartButton: queryRequired('#restart', HTMLButtonElement),
    difficulty: queryRequired('#difficulty', HTMLSelectElement),
    boardSummary: queryRequired('#board-summary', HTMLElement),
    liveRegion: queryRequired('#live-region', HTMLElement),
  };

  let bestScore = Math.max(0, storage.readNumber(STORAGE_KEYS.bestScore, 0));
  const preferredDifficulty = storage.readString(
    STORAGE_KEYS.difficulty,
    DIFFICULTY_IDS.EASY,
    DIFFICULTY_VALUES,
  );

  const game = new LianliankanGame({ difficulty: preferredDifficulty });
  const hud = new LianliankanHud(elements);
  const renderer = new LianliankanRenderer(elements, game);
  const sound = new SoundPlayer({
    muted: storage.readBoolean('muted', false),
  });

  renderer.mount();
  renderer.render();
  hud.update(game, bestScore);

  let lastFrameMs = 0;
  let rafId = 0;

  function persistBestScore() {
    if (game.score > bestScore) {
      bestScore = game.score;
      storage.writeNumber(STORAGE_KEYS.bestScore, bestScore);
    }
  }

  function refresh({ announce, pulse, path } = {}) {
    persistBestScore();
    renderer.render();
    hud.update(game, bestScore);
    if (path) {
      renderer.showPath(path);
    }
    if (pulse) {
      hud.pulseScore();
    }
    if (announce) {
      hud.announce(announce);
    }
  }

  function playSelect(row, col) {
    const result = game.select(row, col);
    if (result.action === 'ignored') {
      return;
    }
    if (result.action === 'matched') {
      sound.play('eat');
      let message = `消除一对，得分 +${result.gained}`;
      if (result.cleared) {
        sound.play('win');
        message = `第 ${game.stage} 关已过，当前 ${game.score} 分。`;
      } else if (result.failed) {
        sound.play('gameOver');
        message = '没有可以连接的牌了。';
      }
      refresh({ announce: message, pulse: result.gained > 0, path: result.path });
      return;
    }
    if (result.action === 'rejected') {
      sound.play('undo');
      refresh({
        announce: result.reason === 'type-mismatch' ? '图案不同，不能消除。' : '这两张牌连不上。',
      });
      return;
    }
    refresh();
  }

  function useHint() {
    const match = game.hint();
    if (!match) {
      return;
    }
    refresh({ announce: '已高亮一对可以消除的牌。', path: match.path });
  }

  function undoMatch() {
    if (!game.undo()) {
      return;
    }
    sound.play('undo');
    renderer.clearPath();
    refresh({ announce: '已撤销上一对。' });
  }

  function restartStage() {
    persistBestScore();
    game.restartStage();
    renderer.clearPath();
    renderer.mount();
    refresh({ announce: '本关已重新开始。' });
  }

  function advanceStage() {
    if (!game.advance()) {
      return;
    }
    renderer.clearPath();
    renderer.mount();
    refresh({ announce: `进入第 ${game.stage} 关。` });
  }

  function changeDifficulty(difficulty) {
    persistBestScore();
    storage.writeString(STORAGE_KEYS.difficulty, difficulty);
    game.startRun(difficulty);
    renderer.clearPath();
    renderer.mount();
    refresh({
      announce: `已切换到${elements.difficulty.selectedOptions[0]?.text ?? difficulty}难度。`,
    });
  }

  function onFrame(now) {
    if (lastFrameMs === 0) {
      lastFrameMs = now;
    }
    const delta = now - lastFrameMs;
    lastFrameMs = now;

    if (game.timeLimitMs > 0 && game.status === GAME_STATUS.PLAYING) {
      const previousStatus = game.status;
      game.tick(delta);
      hud.update(game, bestScore);
      if (previousStatus === GAME_STATUS.PLAYING && game.status === GAME_STATUS.FAILED) {
        sound.play('gameOver');
        hud.announce('时间到，本关结束。');
      }
    }

    rafId = globalThis.requestAnimationFrame(onFrame);
  }

  const input = new LianliankanInputController({
    surface: elements.tileLayer,
    handlers: {
      onSelect: playSelect,
      onHint: useHint,
      onUndo: undoMatch,
      onRestart: restartStage,
      onAdvance: advanceStage,
      onDeselect: () => {
        game.clearSelection();
        refresh();
      },
    },
  });
  input.attach();

  elements.hintButton.addEventListener('click', useHint);
  elements.undoButton.addEventListener('click', undoMatch);
  elements.restartButton.addEventListener('click', restartStage);
  elements.overlayRestart.addEventListener('click', restartStage);
  elements.overlayAdvance.addEventListener('click', advanceStage);
  elements.difficulty.addEventListener('change', () => {
    changeDifficulty(elements.difficulty.value);
  });

  rafId = globalThis.requestAnimationFrame(onFrame);

  globalThis.addEventListener('pagehide', () => {
    input.detach();
    renderer.destroy();
    persistBestScore();
    globalThis.cancelAnimationFrame(rafId);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
