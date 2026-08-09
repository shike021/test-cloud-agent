import { GOMOKU_STATUS, PLAYER, PLAYER_LABEL } from './constants.js';

/**
 * Keeps the DOM chrome (player cards, turn indicator, record, overlay and
 * buttons) in sync with the match.
 *
 * All copy lives here so the rest of the UI layer stays language agnostic.
 */

export class GomokuHud {
  #elements;

  /**
   * @param {object} elements
   * @param {Record<import('./constants.js').PlayerName, HTMLElement>} elements.playerCards
   * @param {HTMLElement} elements.turnLabel
   * @param {HTMLElement} elements.moveCount
   * @param {HTMLElement} elements.blackWins
   * @param {HTMLElement} elements.whiteWins
   * @param {HTMLElement} elements.draws
   * @param {HTMLElement} elements.overlay
   * @param {HTMLElement} elements.overlayTitle
   * @param {HTMLElement} elements.overlayMessage
   * @param {HTMLButtonElement} elements.overlayAction
   * @param {HTMLButtonElement} elements.overlayUndo
   * @param {HTMLButtonElement} elements.undoButton
   * @param {HTMLButtonElement} elements.muteButton
   * @param {HTMLElement} elements.liveRegion
   */
  constructor(elements) {
    this.#elements = elements;
  }

  /**
   * @param {import('./gomoku-game.js').GomokuGame} game
   * @param {{ black: number, white: number, draws: number }} record
   */
  update(game, record) {
    const { turnLabel, moveCount, blackWins, whiteWins, draws } = this.#elements;

    moveCount.textContent = String(game.moveCount);
    blackWins.textContent = String(record.black);
    whiteWins.textContent = String(record.white);
    draws.textContent = String(record.draws);
    turnLabel.textContent = this.#turnText(game);

    this.#updatePlayerCards(game);
    this.#elements.undoButton.disabled = game.moveCount === 0;
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

  /**
   * Describes a move in the notation shown on the board (column letter + row).
   *
   * @param {import('./gomoku-game.js').Move} move
   * @returns {string}
   */
  static describeMove(move) {
    return `${PLAYER_LABEL[move.player]} ${'ABCDEFGHJKLMNOPQRSTUVWXYZ'[move.x]}${move.y + 1}`;
  }

  /** @param {import('./gomoku-game.js').GomokuGame} game */
  #turnText(game) {
    if (game.status === GOMOKU_STATUS.WON) {
      return `${PLAYER_LABEL[game.winner]}获胜`;
    }
    if (game.status === GOMOKU_STATUS.DRAW) {
      return '和棋';
    }
    return `${PLAYER_LABEL[game.currentPlayer]}回合`;
  }

  /** @param {import('./gomoku-game.js').GomokuGame} game */
  #updatePlayerCards(game) {
    for (const player of [PLAYER.BLACK, PLAYER.WHITE]) {
      const card = this.#elements.playerCards[player];
      const isActive = !game.isFinished && game.currentPlayer === player;
      const isWinner = game.status === GOMOKU_STATUS.WON && game.winner === player;

      card.classList.toggle('is-active', isActive);
      card.classList.toggle('is-winner', isWinner);
      // `aria-current` moves with the turn so assistive technology can announce
      // whose move it is without reading the whole panel.
      if (isActive) {
        card.setAttribute('aria-current', 'true');
      } else {
        card.removeAttribute('aria-current');
      }
    }
  }

  /** @param {import('./gomoku-game.js').GomokuGame} game */
  #updateOverlay(game) {
    const { overlay, overlayTitle, overlayMessage, overlayAction, overlayUndo } = this.#elements;

    if (!game.isFinished) {
      overlay.hidden = true;
      overlay.dataset.status = game.status;
      return;
    }

    if (game.status === GOMOKU_STATUS.WON) {
      overlayTitle.textContent = `${PLAYER_LABEL[game.winner]}获胜！`;
      overlayMessage.textContent = `第 ${game.moveCount} 手连成 ${game.winningLine.length} 子。`;
      overlay.dataset.status = 'won';
    } else {
      overlayTitle.textContent = '和棋';
      overlayMessage.textContent = '棋盘已满，双方都没有连成五子。';
      overlay.dataset.status = 'draw';
    }

    overlayAction.textContent = '再来一局';
    overlayUndo.hidden = game.moveCount === 0;
    overlay.hidden = false;
  }
}
