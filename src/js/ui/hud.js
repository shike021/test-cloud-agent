import { DEATH_CAUSE, GAME_STATUS } from '../core/constants.js';

/**
 * Keeps the DOM chrome (scoreboard, overlay, buttons) in sync with the game.
 *
 * All copy lives here so the rest of the UI layer stays language agnostic.
 */

const OVERLAY_CONTENT = Object.freeze({
  [GAME_STATUS.IDLE]: {
    title: '准备开始',
    message: '使用方向键或 WASD 控制蛇的移动，吃到果实即可成长。',
    action: '开始游戏',
  },
  [GAME_STATUS.PAUSED]: {
    title: '已暂停',
    message: '按空格键或点击下方按钮继续游戏。',
    action: '继续游戏',
  },
  [GAME_STATUS.WON]: {
    title: '完美通关！',
    message: '你已经填满了整个棋盘，这是贪吃蛇的极限。',
    action: '再来一局',
  },
});

const DEATH_MESSAGE = Object.freeze({
  [DEATH_CAUSE.WALL]: '撞到墙壁了，注意边界。',
  [DEATH_CAUSE.SELF]: '咬到自己了，注意身体长度。',
});

export class Hud {
  #elements;

  /**
   * @param {object} elements
   * @param {HTMLElement} elements.score
   * @param {HTMLElement} elements.bestScore
   * @param {HTMLElement} elements.level
   * @param {HTMLElement} elements.length
   * @param {HTMLElement} elements.overlay
   * @param {HTMLElement} elements.overlayTitle
   * @param {HTMLElement} elements.overlayMessage
   * @param {HTMLButtonElement} elements.overlayAction
   * @param {HTMLButtonElement} elements.startPauseButton
   * @param {HTMLButtonElement} elements.muteButton
   * @param {HTMLElement} elements.liveRegion
   */
  constructor(elements) {
    this.#elements = elements;
  }

  /**
   * @param {import('../core/snake-game.js').SnakeGame} game
   * @param {number} bestScore
   */
  update(game, bestScore) {
    const { score, bestScore: bestEl, level, length } = this.#elements;
    score.textContent = String(game.score);
    bestEl.textContent = String(bestScore);
    level.textContent = String(game.level);
    length.textContent = String(game.snake.length);

    this.#updateStartPauseButton(game.status);
    this.#updateOverlay(game);
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    const button = this.#elements.muteButton;
    button.setAttribute('aria-pressed', String(!muted));
    button.dataset.state = muted ? 'muted' : 'unmuted';
    button.title = muted ? '开启音效 (M)' : '关闭音效 (M)';
    const label = button.querySelector('[data-label]');
    if (label) {
      label.textContent = muted ? '音效关' : '音效开';
    }
  }

  /**
   * Announces short, transient messages to screen readers.
   *
   * @param {string} message
   */
  announce(message) {
    this.#elements.liveRegion.textContent = message;
  }

  /** Adds a short highlight animation to the score value. */
  pulseScore() {
    const element = this.#elements.score;
    element.classList.remove('is-pulsing');
    // Forces a reflow so the animation can be retriggered immediately.
    void element.offsetWidth;
    element.classList.add('is-pulsing');
  }

  /** @param {string} status */
  #updateStartPauseButton(status) {
    const button = this.#elements.startPauseButton;
    const label = status === GAME_STATUS.RUNNING ? '暂停' : '开始';
    button.textContent = `${label} (空格)`;
    button.dataset.action = status === GAME_STATUS.RUNNING ? 'pause' : 'start';
    button.disabled = status === GAME_STATUS.GAME_OVER || status === GAME_STATUS.WON;
  }

  /** @param {import('../core/snake-game.js').SnakeGame} game */
  #updateOverlay(game) {
    const { overlay, overlayTitle, overlayMessage, overlayAction } = this.#elements;

    if (game.status === GAME_STATUS.RUNNING) {
      overlay.hidden = true;
      overlay.dataset.status = game.status;
      return;
    }

    const content =
      game.status === GAME_STATUS.GAME_OVER
        ? {
            title: '游戏结束',
            message: `${DEATH_MESSAGE[game.deathCause] ?? ''} 本局得分 ${game.score}。`,
            action: '再来一局',
          }
        : OVERLAY_CONTENT[game.status];

    overlay.hidden = false;
    overlay.dataset.status = game.status;
    overlayTitle.textContent = content.title;
    overlayMessage.textContent = content.message;
    overlayAction.textContent = content.action;
  }
}
