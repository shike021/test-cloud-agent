import { FAIL_REASONS, GAME_STATUS, glyphForType } from '../core/constants.js';

/**
 * Keeps the Lianliankan chrome (scoreboard, overlay, buttons, live region)
 * in sync with the game. All player-facing copy lives here.
 */

const DIFFICULTY_LABELS = Object.freeze({
  easy: '轻松',
  standard: '标准',
  hard: '困难',
});

export class LianliankanHud {
  #elements;

  /**
   * @param {object} elements
   * @param {HTMLElement} elements.score
   * @param {HTMLElement} elements.bestScore
   * @param {HTMLElement} elements.stage
   * @param {HTMLElement} elements.combo
   * @param {HTMLElement} elements.hints
   * @param {HTMLElement} elements.time
   * @param {HTMLElement} elements.overlay
   * @param {HTMLElement} elements.overlayTitle
   * @param {HTMLElement} elements.overlayMessage
   * @param {HTMLButtonElement} elements.overlayAdvance
   * @param {HTMLButtonElement} elements.overlayRestart
   * @param {HTMLButtonElement} elements.hintButton
   * @param {HTMLButtonElement} elements.undoButton
   * @param {HTMLSelectElement} elements.difficulty
   * @param {HTMLElement} elements.boardSummary
   * @param {HTMLElement} elements.liveRegion
   */
  constructor(elements) {
    this.#elements = elements;
  }

  /**
   * @param {import('../core/lianliankan-game.js').LianliankanGame} game
   * @param {number} bestScore
   */
  update(game, bestScore) {
    const { score, bestScore: bestElement, stage, combo, hints, time, difficulty } = this.#elements;

    score.textContent = String(game.score);
    bestElement.textContent = String(bestScore);
    stage.textContent = `${game.stage} · ${DIFFICULTY_LABELS[game.difficulty]}`;
    combo.textContent = String(game.combo);
    hints.textContent = `${game.remainingHints}/${game.hintLimit}`;
    time.textContent = LianliankanHud.formatTime(game);
    time.classList.toggle('is-urgent', game.timeLimitMs > 0 && game.remainingTimeMs <= 15_000);

    if (difficulty.value !== game.difficulty) {
      difficulty.value = game.difficulty;
    }

    this.#elements.hintButton.disabled = !game.canHint;
    this.#elements.undoButton.disabled = !game.canUndo;
    this.#elements.boardSummary.textContent = LianliankanHud.describeBoard(game);
    this.#updateOverlay(game);
  }

  /**
   * @param {string} message
   */
  announce(message) {
    this.#elements.liveRegion.textContent = message;
  }

  pulseScore() {
    const element = this.#elements.score;
    element.classList.remove('is-pulsing');
    void element.offsetWidth;
    element.classList.add('is-pulsing');
  }

  /**
   * @param {import('../core/lianliankan-game.js').LianliankanGame} game
   * @returns {string}
   */
  static formatTime(game) {
    if (game.timeLimitMs === 0) {
      return '不限时';
    }
    const totalSeconds = Math.ceil(game.remainingTimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * @param {import('../core/lianliankan-game.js').LianliankanGame} game
   * @returns {string}
   */
  static describeBoard(game) {
    const rows = game.toRows().map((row, index) => {
      const cells = row.map((type) => (type === 0 ? '空' : glyphForType(type).label)).join('、');
      return `第 ${index + 1} 行：${cells}`;
    });
    return `${rows.join('；')}。剩余 ${game.tilesRemaining} 张牌。`;
  }

  /**
   * @param {import('../core/lianliankan-game.js').LianliankanGame} game
   */
  #updateOverlay(game) {
    const { overlay, overlayTitle, overlayMessage, overlayAdvance, overlayRestart } =
      this.#elements;

    if (game.status === GAME_STATUS.PLAYING) {
      overlay.hidden = true;
      overlay.dataset.status = game.status;
      return;
    }

    const cleared = game.status === GAME_STATUS.CLEARED;
    overlayTitle.textContent = cleared ? '全部消除！' : '本关失败';
    overlayMessage.textContent = cleared
      ? `第 ${game.stage} 关已过，当前得分 ${game.score}。进入下一关棋盘会更大、图案更多。`
      : game.failReason === FAIL_REASONS.TIMEOUT
        ? `时间到，本关得分 ${game.score}。可以重开本关再试。`
        : `没有可以连接的牌了，本关得分 ${game.score}。可以重开本关再试。`;
    overlayAdvance.hidden = !cleared;
    overlayRestart.textContent = cleared ? '重开本关 (R)' : '再试一次 (R)';
    overlay.dataset.status = cleared ? 'cleared' : 'failed';
    overlay.hidden = false;
  }
}
