import { GAME_STATUS } from '../core/constants.js';

/**
 * Keeps the DOM chrome (scoreboard, overlay and the textual board description
 * used by screen readers) in sync with the game.
 *
 * All copy lives here so the rest of the UI layer stays language agnostic.
 */

export class Game2048Hud {
  #elements;

  /**
   * @param {object} elements
   * @param {HTMLElement} elements.score
   * @param {HTMLElement} elements.bestScore
   * @param {HTMLElement} elements.largestTile
   * @param {HTMLElement} elements.moveCount
   * @param {HTMLElement} elements.overlay
   * @param {HTMLElement} elements.overlayTitle
   * @param {HTMLElement} elements.overlayMessage
   * @param {HTMLButtonElement} elements.overlayContinue
   * @param {HTMLButtonElement} elements.overlayRestart
   * @param {HTMLElement} elements.boardSummary
   * @param {HTMLElement} elements.liveRegion
   */
  constructor(elements) {
    this.#elements = elements;
  }

  /**
   * @param {import('../core/game-2048.js').Game2048} game
   * @param {number} bestScore
   */
  update(game, bestScore) {
    const { score, bestScore: bestElement, largestTile, moveCount } = this.#elements;

    score.textContent = String(game.score);
    bestElement.textContent = String(bestScore);
    largestTile.textContent = String(game.largestTile);
    moveCount.textContent = String(game.moveCount);

    this.#elements.boardSummary.textContent = Game2048Hud.describeBoard(game);
    this.#updateOverlay(game);
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

  /**
   * Describes the whole board as text, row by row.
   *
   * The tiles themselves are `aria-hidden`, because their absolute positions
   * carry no meaning in the accessibility tree; this sentence does.
   *
   * @param {import('../core/game-2048.js').Game2048} game
   * @returns {string}
   */
  static describeBoard(game) {
    const rows = game
      .toRows()
      .map((row, index) => {
        const cells = row.map((value) => (value === 0 ? '空' : String(value))).join('、');
        return `第 ${index + 1} 行：${cells}`;
      })
      .join('；');
    return `${rows}。`;
  }

  /** @param {import('../core/game-2048.js').Game2048} game */
  #updateOverlay(game) {
    const { overlay, overlayTitle, overlayMessage, overlayContinue, overlayRestart } =
      this.#elements;

    if (game.status === GAME_STATUS.PLAYING) {
      overlay.hidden = true;
      overlay.dataset.status = game.status;
      return;
    }

    const won = game.status === GAME_STATUS.WON;
    overlayTitle.textContent = won ? `达成 ${game.winTile}！` : '游戏结束';
    overlayMessage.textContent = won
      ? `本局得分 ${game.score}，继续挑战可以叠出更大的方块。`
      : `没有可以移动的方向了，本局得分 ${game.score}，最大方块 ${game.largestTile}。`;
    overlayContinue.hidden = !won;
    overlayRestart.textContent = won ? '重新开始 (R)' : '再来一局 (R)';
    overlay.dataset.status = game.status;
    overlay.hidden = false;
  }
}
