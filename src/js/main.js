import { FOOD_TYPE, GAME_STATUS } from './core/constants.js';
import { SnakeGame } from './core/snake-game.js';
import { createStorage } from './services/storage.js';
import { Hud } from './ui/hud.js';
import { InputController } from './ui/input-controller.js';
import { Renderer } from './ui/renderer.js';
import { SoundPlayer } from './ui/sound-player.js';

/**
 * Application entry point: wires the headless game core to the DOM, drives the
 * fixed-timestep loop and persists player preferences.
 */

const STORAGE_KEYS = Object.freeze({
  bestScore: 'best-score',
  muted: 'muted',
  difficulty: 'difficulty',
  wrapWalls: 'wrap-walls',
});

const storage = createStorage('snake-game');

/** Difficulty presets. Only pacing changes so the board stays comparable. */
const DIFFICULTIES = Object.freeze({
  easy: { baseTickMs: 175, minTickMs: 95, speedUpPerLevelMs: 6 },
  normal: { baseTickMs: 140, minTickMs: 68, speedUpPerLevelMs: 7 },
  hard: { baseTickMs: 108, minTickMs: 52, speedUpPerLevelMs: 8 },
});

/** @type {readonly string[]} */
const DIFFICULTY_NAMES = Object.freeze(Object.keys(DIFFICULTIES));

const BOARD_COLS = 22;
const BOARD_ROWS = 22;
/** Upper bound of catch-up ticks per frame, protecting against long stalls. */
const MAX_TICKS_PER_FRAME = 4;

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
    canvas: queryRequired('#board', HTMLCanvasElement),
    boardFrame: queryRequired('#board-frame', HTMLElement),
    score: queryRequired('#score', HTMLElement),
    bestScore: queryRequired('#best-score', HTMLElement),
    level: queryRequired('#level', HTMLElement),
    length: queryRequired('#length', HTMLElement),
    overlay: queryRequired('#overlay', HTMLElement),
    overlayTitle: queryRequired('#overlay-title', HTMLElement),
    overlayMessage: queryRequired('#overlay-message', HTMLElement),
    overlayAction: queryRequired('#overlay-action', HTMLButtonElement),
    startPauseButton: queryRequired('#start-pause', HTMLButtonElement),
    restartButton: queryRequired('#restart', HTMLButtonElement),
    muteButton: queryRequired('#mute', HTMLButtonElement),
    difficultySelect: queryRequired('#difficulty', HTMLSelectElement),
    wrapWallsToggle: queryRequired('#wrap-walls', HTMLInputElement),
    liveRegion: queryRequired('#live-region', HTMLElement),
    dpad: queryRequired('#dpad', HTMLElement),
  };

  const settings = {
    difficulty: /** @type {keyof typeof DIFFICULTIES} */ (
      storage.readString(STORAGE_KEYS.difficulty, 'normal', DIFFICULTY_NAMES)
    ),
    wrapWalls: storage.readBoolean(STORAGE_KEYS.wrapWalls, false),
  };

  let bestScore = storage.readNumber(STORAGE_KEYS.bestScore, 0);
  const sound = new SoundPlayer({ muted: storage.readBoolean(STORAGE_KEYS.muted, false) });
  const hud = new Hud(elements);

  let game = createGame(settings);
  let renderer = new Renderer(elements.canvas, game);

  elements.difficultySelect.value = settings.difficulty;
  elements.wrapWallsToggle.checked = settings.wrapWalls;
  hud.setMuted(sound.muted);
  hud.update(game, bestScore);

  /* ------------------------------------------------------------- game loop */

  let accumulatorMs = 0;
  let lastFrameMs = 0;
  let frameHandle = 0;

  /** @param {number} timestamp */
  function frame(timestamp) {
    frameHandle = requestAnimationFrame(frame);

    if (lastFrameMs === 0) {
      lastFrameMs = timestamp;
    }
    // Clamping avoids a burst of catch-up ticks after the tab was inactive.
    const deltaMs = Math.min(timestamp - lastFrameMs, 250);
    lastFrameMs = timestamp;

    if (game.isRunning) {
      accumulatorMs += deltaMs;
      let ticks = 0;
      while (
        game.isRunning &&
        accumulatorMs >= game.tickIntervalMs &&
        ticks < MAX_TICKS_PER_FRAME
      ) {
        accumulatorMs -= game.tickIntervalMs;
        handleTickResult(game.tick());
        ticks += 1;
      }
      if (!game.isRunning) {
        accumulatorMs = 0;
      } else {
        // Drop the backlog a very slow frame may have produced instead of
        // letting it grow across frames.
        accumulatorMs = Math.min(accumulatorMs, game.tickIntervalMs);
      }
    } else {
      accumulatorMs = 0;
    }

    renderer.render({
      alpha: game.isRunning ? Math.min(1, accumulatorMs / game.tickIntervalMs) : 1,
      timestamp,
    });
  }

  /** @param {import('./core/snake-game.js').TickResult} result */
  function handleTickResult(result) {
    if (result.eaten) {
      renderer.spawnRipple(result.eaten.x, result.eaten.y, result.eaten.type);
      sound.play(result.eaten.type === FOOD_TYPE.BONUS ? 'bonus' : 'eat');
      hud.pulseScore();
    }

    if (result.levelUp) {
      sound.play('levelUp');
      hud.announce(`进入第 ${game.level} 级，速度提升。`);
    }

    if (result.gameOver) {
      sound.play('gameOver');
      hud.announce(`游戏结束，得分 ${game.score}。`);
    } else if (result.won) {
      sound.play('win');
      hud.announce(`恭喜通关，得分 ${game.score}。`);
    }

    if (result.eaten || result.levelUp || result.gameOver || result.won) {
      persistBestScore();
      hud.update(game, bestScore);
    }
  }

  function persistBestScore() {
    if (game.score > bestScore) {
      bestScore = game.score;
      storage.writeNumber(STORAGE_KEYS.bestScore, bestScore);
    }
  }

  /* ---------------------------------------------------------------- actions */

  function startOrResume() {
    if (game.isFinished) {
      restart();
      return;
    }
    game.start();
    accumulatorMs = 0;
    hud.update(game, bestScore);
  }

  function togglePause() {
    if (game.isFinished) {
      restart();
      return;
    }
    game.togglePause();
    accumulatorMs = 0;
    hud.update(game, bestScore);
    hud.announce(game.status === GAME_STATUS.PAUSED ? '游戏已暂停。' : '游戏继续。');
  }

  function restart() {
    game.restart();
    renderer.clearEffects();
    accumulatorMs = 0;
    hud.update(game, bestScore);
    hud.announce('新的一局已开始。');
  }

  /** @param {import('./core/constants.js').DirectionName} direction */
  function changeDirection(direction) {
    if (game.status === GAME_STATUS.IDLE) {
      game.start();
      hud.update(game, bestScore);
    }
    game.enqueueDirection(direction);
  }

  function rebuildGame() {
    persistBestScore();
    game = createGame(settings);
    renderer = new Renderer(elements.canvas, game);
    accumulatorMs = 0;
    hud.update(game, bestScore);
  }

  /* --------------------------------------------------------------- bindings */

  const input = new InputController({
    surface: elements.boardFrame,
    directionButtons: elements.dpad.querySelectorAll('[data-direction]'),
    handlers: {
      onDirection: changeDirection,
      onTogglePause: togglePause,
      onRestart: restart,
      onToggleMute: toggleMute,
    },
  });
  input.attach();

  function toggleMute() {
    const muted = sound.toggleMuted();
    storage.writeBoolean(STORAGE_KEYS.muted, muted);
    hud.setMuted(muted);
  }

  elements.startPauseButton.addEventListener('click', togglePause);
  elements.restartButton.addEventListener('click', restart);
  elements.muteButton.addEventListener('click', toggleMute);
  elements.overlayAction.addEventListener('click', startOrResume);

  elements.difficultySelect.addEventListener('change', (event) => {
    const value = normaliseDifficulty(/** @type {HTMLSelectElement} */ (event.target).value);
    settings.difficulty = value;
    storage.writeString(STORAGE_KEYS.difficulty, value);
    rebuildGame();
    hud.announce('难度已切换，新的一局已准备好。');
  });

  elements.wrapWallsToggle.addEventListener('change', (event) => {
    settings.wrapWalls = /** @type {HTMLInputElement} */ (event.target).checked;
    storage.writeBoolean(STORAGE_KEYS.wrapWalls, settings.wrapWalls);
    rebuildGame();
    hud.announce(settings.wrapWalls ? '穿墙模式已开启。' : '穿墙模式已关闭。');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.isRunning) {
      game.pause();
      hud.update(game, bestScore);
    }
  });

  globalThis.addEventListener('blur', () => {
    if (game.isRunning) {
      game.pause();
      hud.update(game, bestScore);
    }
  });

  const resizeObserver = new ResizeObserver(() => renderer.resize());
  resizeObserver.observe(elements.boardFrame);

  globalThis.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameHandle);
    resizeObserver.disconnect();
    input.detach();
    persistBestScore();
  });

  frameHandle = requestAnimationFrame(frame);
}

/**
 * @param {{ difficulty: keyof typeof DIFFICULTIES, wrapWalls: boolean }} settings
 * @returns {SnakeGame}
 */
function createGame(settings) {
  return new SnakeGame({
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    wallCollision: !settings.wrapWalls,
    ...DIFFICULTIES[settings.difficulty],
  });
}

/**
 * @param {string} value
 * @returns {keyof typeof DIFFICULTIES}
 */
function normaliseDifficulty(value) {
  return Object.hasOwn(DIFFICULTIES, value)
    ? /** @type {keyof typeof DIFFICULTIES} */ (value)
    : 'normal';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
