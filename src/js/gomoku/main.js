import { createStorage } from '../services/storage.js';
import { SoundPlayer } from '../ui/sound-player.js';
import { OPPONENT, PLAYER, PLAYER_LABEL } from './constants.js';
import { GomokuGame } from './gomoku-game.js';
import { GomokuHud } from './hud.js';
import { GomokuRenderer } from './renderer.js';

/**
 * Application entry point for the gomoku page: wires the headless rules to the
 * DOM, translates pointer and keyboard input into moves and persists both the
 * player preferences and the match record.
 *
 * The board only changes in response to input, so frames are drawn on demand
 * rather than from an animation loop.
 */

const STORAGE_KEYS = Object.freeze({
  muted: 'muted',
  showCoordinates: 'show-coordinates',
  showLastMove: 'show-last-move',
  alternateFirst: 'alternate-first',
  blackWins: 'black-wins',
  whiteWins: 'white-wins',
  draws: 'draws',
  nextFirstPlayer: 'next-first-player',
});

const BOARD_SIZE = 15;
const PLAYER_NAMES = Object.freeze([PLAYER.BLACK, PLAYER.WHITE]);

const storage = createStorage('gomoku');

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
    playerCards: {
      [PLAYER.BLACK]: queryRequired('#player-black', HTMLElement),
      [PLAYER.WHITE]: queryRequired('#player-white', HTMLElement),
    },
    turnLabel: queryRequired('#turn-label', HTMLElement),
    moveCount: queryRequired('#move-count', HTMLElement),
    blackWins: queryRequired('#black-wins', HTMLElement),
    whiteWins: queryRequired('#white-wins', HTMLElement),
    draws: queryRequired('#draws', HTMLElement),
    overlay: queryRequired('#overlay', HTMLElement),
    overlayTitle: queryRequired('#overlay-title', HTMLElement),
    overlayMessage: queryRequired('#overlay-message', HTMLElement),
    overlayAction: queryRequired('#overlay-action', HTMLButtonElement),
    overlayUndo: queryRequired('#overlay-undo', HTMLButtonElement),
    restartButton: queryRequired('#restart', HTMLButtonElement),
    undoButton: queryRequired('#undo', HTMLButtonElement),
    resetRecordButton: queryRequired('#reset-record', HTMLButtonElement),
    muteButton: queryRequired('#mute', HTMLButtonElement),
    coordinatesToggle: queryRequired('#show-coordinates', HTMLInputElement),
    lastMoveToggle: queryRequired('#show-last-move', HTMLInputElement),
    alternateFirstToggle: queryRequired('#alternate-first', HTMLInputElement),
    liveRegion: queryRequired('#live-region', HTMLElement),
  };

  const settings = {
    showCoordinates: storage.readBoolean(STORAGE_KEYS.showCoordinates, true),
    showLastMove: storage.readBoolean(STORAGE_KEYS.showLastMove, true),
    alternateFirst: storage.readBoolean(STORAGE_KEYS.alternateFirst, true),
  };

  const record = {
    black: Math.max(0, storage.readNumber(STORAGE_KEYS.blackWins, 0)),
    white: Math.max(0, storage.readNumber(STORAGE_KEYS.whiteWins, 0)),
    draws: Math.max(0, storage.readNumber(STORAGE_KEYS.draws, 0)),
  };

  const sound = new SoundPlayer({ muted: storage.readBoolean(STORAGE_KEYS.muted, false) });
  const hud = new GomokuHud(elements);

  const game = new GomokuGame({
    size: BOARD_SIZE,
    firstPlayer: /** @type {import('./constants.js').PlayerName} */ (
      storage.readString(STORAGE_KEYS.nextFirstPlayer, PLAYER.BLACK, PLAYER_NAMES)
    ),
  });

  const renderer = new GomokuRenderer(elements.canvas, game, {
    showCoordinates: settings.showCoordinates,
    showLastMove: settings.showLastMove,
  });

  /**
   * The outcome already added to the record for the position on the board.
   * Undoing a decisive move has to take it back out again.
   *
   * @type {{ type: 'win', player: import('./constants.js').PlayerName } | { type: 'draw' } | null}
   */
  let countedOutcome = null;

  elements.coordinatesToggle.checked = settings.showCoordinates;
  elements.lastMoveToggle.checked = settings.showLastMove;
  elements.alternateFirstToggle.checked = settings.alternateFirst;
  hud.setMuted(sound.muted);
  refresh();

  /* --------------------------------------------------------------- actions */

  function refresh() {
    hud.update(game, record);
    renderer.render();
  }

  function persistRecord() {
    storage.writeNumber(STORAGE_KEYS.blackWins, record.black);
    storage.writeNumber(STORAGE_KEYS.whiteWins, record.white);
    storage.writeNumber(STORAGE_KEYS.draws, record.draws);
  }

  /** @param {number} x @param {number} y */
  function playMove(x, y) {
    const result = game.place(x, y);
    if (!result.placed) {
      return;
    }

    sound.play(result.move.player === PLAYER.BLACK ? 'place' : 'placeAlt');

    if (result.winner) {
      record[result.winner] += 1;
      countedOutcome = { type: 'win', player: result.winner };
      persistRecord();
      sound.play('win');
      hud.announce(
        `${GomokuHud.describeMove(result.move)}，${PLAYER_LABEL[result.winner]}连成五子获胜。`,
      );
    } else if (result.draw) {
      record.draws += 1;
      countedOutcome = { type: 'draw' };
      persistRecord();
      sound.play('gameOver');
      hud.announce('棋盘已满，本局和棋。');
    } else {
      hud.announce(
        `${GomokuHud.describeMove(result.move)}，轮到${PLAYER_LABEL[game.currentPlayer]}。`,
      );
    }

    // The cursor stays where the stone landed, so the preview would cover it.
    renderer.setCursor(null);
    refresh();
  }

  function undoMove() {
    const move = game.undo();
    if (!move) {
      return;
    }

    if (countedOutcome) {
      if (countedOutcome.type === 'win') {
        record[countedOutcome.player] = Math.max(0, record[countedOutcome.player] - 1);
      } else {
        record.draws = Math.max(0, record.draws - 1);
      }
      countedOutcome = null;
      persistRecord();
    }

    sound.play('undo');
    hud.announce(`已撤销 ${GomokuHud.describeMove(move)}。`);
    refresh();
  }

  function startNewMatch() {
    const previousFirst = game.firstPlayer;
    const firstPlayer = settings.alternateFirst ? OPPONENT[previousFirst] : PLAYER.BLACK;

    game.reset({ firstPlayer });
    storage.writeString(STORAGE_KEYS.nextFirstPlayer, firstPlayer);
    countedOutcome = null;
    renderer.setCursor(null);
    refresh();
    hud.announce(`新的一局开始，${PLAYER_LABEL[firstPlayer]}先行。`);
  }

  function resetRecord() {
    record.black = 0;
    record.white = 0;
    record.draws = 0;
    countedOutcome = null;
    persistRecord();
    refresh();
    hud.announce('战绩已清空。');
  }

  function toggleMute() {
    const muted = sound.toggleMuted();
    storage.writeBoolean(STORAGE_KEYS.muted, muted);
    hud.setMuted(muted);
  }

  /* -------------------------------------------------------------- bindings */

  elements.canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') {
      return;
    }
    if (renderer.setCursor(renderer.cellFromPoint(event.clientX, event.clientY))) {
      renderer.render();
    }
  });

  elements.canvas.addEventListener('pointerleave', () => {
    if (renderer.setCursor(null)) {
      renderer.render();
    }
  });

  elements.canvas.addEventListener('click', (event) => {
    const cell = renderer.cellFromPoint(event.clientX, event.clientY);
    if (cell) {
      playMove(cell.x, cell.y);
    }
  });

  elements.canvas.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const step = KEY_TO_STEP[event.code];
    if (step) {
      event.preventDefault();
      moveCursorBy(step.x, step.y);
      return;
    }

    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      const cursor = renderer.cursor ?? centreCell();
      renderer.setCursor(cursor);
      playMove(cursor.x, cursor.y);
    }
  });

  elements.canvas.addEventListener('blur', () => {
    if (renderer.setCursor(null)) {
      renderer.render();
    }
  });

  /** @param {number} deltaX @param {number} deltaY */
  function moveCursorBy(deltaX, deltaY) {
    const current = renderer.cursor ?? game.lastMove ?? centreCell();
    const next = {
      x: clampToBoard(current.x + deltaX),
      y: clampToBoard(current.y + deltaY),
    };
    if (renderer.setCursor(next)) {
      renderer.render();
    }
  }

  elements.restartButton.addEventListener('click', startNewMatch);
  elements.undoButton.addEventListener('click', undoMove);
  elements.resetRecordButton.addEventListener('click', resetRecord);
  elements.muteButton.addEventListener('click', toggleMute);
  elements.overlayAction.addEventListener('click', startNewMatch);
  elements.overlayUndo.addEventListener('click', undoMove);

  elements.coordinatesToggle.addEventListener('change', (event) => {
    settings.showCoordinates = /** @type {HTMLInputElement} */ (event.target).checked;
    storage.writeBoolean(STORAGE_KEYS.showCoordinates, settings.showCoordinates);
    renderer.setShowCoordinates(settings.showCoordinates);
    renderer.render();
  });

  elements.lastMoveToggle.addEventListener('change', (event) => {
    settings.showLastMove = /** @type {HTMLInputElement} */ (event.target).checked;
    storage.writeBoolean(STORAGE_KEYS.showLastMove, settings.showLastMove);
    renderer.setShowLastMove(settings.showLastMove);
    renderer.render();
  });

  elements.alternateFirstToggle.addEventListener('change', (event) => {
    settings.alternateFirst = /** @type {HTMLInputElement} */ (event.target).checked;
    storage.writeBoolean(STORAGE_KEYS.alternateFirst, settings.alternateFirst);
    hud.announce(settings.alternateFirst ? '新局将交替先手。' : '新局固定由黑棋先行。');
  });

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      return;
    }

    switch (event.code) {
      case 'KeyN':
        event.preventDefault();
        startNewMatch();
        break;
      case 'KeyU':
      case 'KeyZ':
        event.preventDefault();
        undoMove();
        break;
      case 'KeyM':
        event.preventDefault();
        toggleMute();
        break;
      default:
        break;
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    renderer.resize();
    renderer.render();
  });
  resizeObserver.observe(elements.boardFrame);

  globalThis.addEventListener('pagehide', () => {
    resizeObserver.disconnect();
    persistRecord();
  });
}

/** Arrow keys and WASD move the keyboard cursor one intersection at a time. */
const KEY_TO_STEP = Object.freeze({
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
});

/** @returns {{ x: number, y: number }} */
function centreCell() {
  const middle = Math.floor(BOARD_SIZE / 2);
  return { x: middle, y: middle };
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampToBoard(value) {
  return Math.min(BOARD_SIZE - 1, Math.max(0, value));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
