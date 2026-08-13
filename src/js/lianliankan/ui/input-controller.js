/**
 * Translates keyboard and pointer input into Lianliankan actions.
 *
 * Tile clicks are delegated from the board so newly mounted cells stay live
 * without rebinding. All listeners share one AbortController.
 */

export class LianliankanInputController {
  /** @type {AbortController|null} */
  #abortController = null;
  #handlers;
  #keyboardTarget;
  #surface;

  /**
   * @param {object} options
   * @param {Window|HTMLElement} [options.keyboardTarget]
   * @param {HTMLElement} options.surface Board that contains the tile buttons.
   * @param {object} options.handlers
   * @param {(row: number, col: number) => void} options.handlers.onSelect
   * @param {() => void} [options.handlers.onHint]
   * @param {() => void} [options.handlers.onUndo]
   * @param {() => void} [options.handlers.onRestart]
   * @param {() => void} [options.handlers.onAdvance]
   * @param {() => void} [options.handlers.onDeselect]
   */
  constructor({ keyboardTarget = globalThis, surface, handlers }) {
    if (!surface) {
      throw new TypeError('LianliankanInputController requires a "surface" element.');
    }
    if (typeof handlers?.onSelect !== 'function') {
      throw new TypeError('LianliankanInputController requires a "handlers.onSelect" callback.');
    }

    this.#keyboardTarget = keyboardTarget;
    this.#surface = surface;
    this.#handlers = handlers;
  }

  attach() {
    if (this.#abortController) {
      return;
    }
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#keyboardTarget.addEventListener('keydown', this.#onKeyDown, { signal });
    this.#surface.addEventListener('click', this.#onClick, { signal });
  }

  detach() {
    this.#abortController?.abort();
    this.#abortController = null;
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest('[data-row][data-col]');
    if (!(button instanceof HTMLElement) || button.hidden) {
      return;
    }
    const row = Number.parseInt(button.dataset.row ?? '', 10);
    const col = Number.parseInt(button.dataset.col ?? '', 10);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return;
    }
    this.#handlers.onSelect(row, col);
  };

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      return;
    }

    switch (event.code) {
      case 'KeyH':
        event.preventDefault();
        this.#handlers.onHint?.();
        break;
      case 'KeyU':
      case 'KeyZ':
        event.preventDefault();
        this.#handlers.onUndo?.();
        break;
      case 'KeyR':
        event.preventDefault();
        this.#handlers.onRestart?.();
        break;
      case 'KeyN':
      case 'Enter':
        event.preventDefault();
        this.#handlers.onAdvance?.();
        break;
      case 'Escape':
        event.preventDefault();
        this.#handlers.onDeselect?.();
        break;
      default:
        break;
    }
  };
}
