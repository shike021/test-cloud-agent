/**
 * Translates keyboard, pointer and touch input into 2048 actions.
 *
 * All listeners are registered through a single {@link AbortController} so that
 * {@link Game2048InputController#detach} reliably removes them again.
 */

/** @typedef {import('../core/constants.js').DirectionName} DirectionName */

/** Keyboard layout: arrow keys plus WASD. */
const KEY_TO_DIRECTION = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
});

/** Lookup used to validate `data-direction` attributes. */
const VALID_DIRECTIONS = Object.freeze(new Set(['up', 'down', 'left', 'right']));

/** Minimum swipe distance in CSS pixels before a direction is emitted. */
const SWIPE_THRESHOLD_PX = 24;

export class Game2048InputController {
  /** @type {AbortController|null} */
  #abortController = null;
  #handlers;
  #keyboardTarget;
  #surface;
  /** @type {HTMLElement[]} */
  #directionButtons;
  /** @type {{ x: number, y: number }|null} */
  #touchStart = null;

  /**
   * @param {object} options
   * @param {Window|HTMLElement} [options.keyboardTarget] Element receiving key events.
   * @param {HTMLElement} options.surface Element that recognises swipe gestures.
   * @param {Iterable<HTMLElement>} [options.directionButtons] Buttons carrying a
   *   `data-direction` attribute.
   * @param {object} options.handlers
   * @param {(direction: DirectionName) => void} options.handlers.onMove
   * @param {() => void} [options.handlers.onRestart]
   * @param {() => void} [options.handlers.onContinue]
   */
  constructor({ keyboardTarget = globalThis, surface, directionButtons = [], handlers }) {
    if (!surface) {
      throw new TypeError('Game2048InputController requires a "surface" element.');
    }
    if (typeof handlers?.onMove !== 'function') {
      throw new TypeError('Game2048InputController requires a "handlers.onMove" callback.');
    }

    this.#keyboardTarget = keyboardTarget;
    this.#surface = surface;
    this.#directionButtons = [...directionButtons];
    this.#handlers = handlers;
  }

  /** Registers every listener. Calling it twice is a no-op. */
  attach() {
    if (this.#abortController) {
      return;
    }
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#keyboardTarget.addEventListener('keydown', this.#onKeyDown, { signal });

    for (const button of this.#directionButtons) {
      const direction = button.dataset.direction;
      if (!direction || !VALID_DIRECTIONS.has(direction)) {
        continue;
      }
      button.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault();
          this.#handlers.onMove(/** @type {DirectionName} */ (direction));
        },
        { signal },
      );
      // Keyboard and assistive technology activate buttons via `click`.
      button.addEventListener(
        'click',
        () => this.#handlers.onMove(/** @type {DirectionName} */ (direction)),
        { signal },
      );
    }

    this.#surface.addEventListener('touchstart', this.#onTouchStart, { signal, passive: true });
    this.#surface.addEventListener('touchmove', this.#onTouchMove, { signal, passive: false });
    this.#surface.addEventListener('touchend', this.#onTouchEnd, { signal, passive: true });
  }

  /** Removes every listener registered by {@link Game2048InputController#attach}. */
  detach() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#touchStart = null;
  }

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    // Typing in a form control must never move the board.
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      return;
    }

    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault();
      this.#handlers.onMove(/** @type {DirectionName} */ (direction));
      return;
    }

    switch (event.code) {
      case 'KeyR':
        event.preventDefault();
        this.#handlers.onRestart?.();
        break;
      case 'Space':
      case 'KeyC':
        event.preventDefault();
        this.#handlers.onContinue?.();
        break;
      default:
        break;
    }
  };

  /** @param {TouchEvent} event */
  #onTouchStart = (event) => {
    const touch = event.changedTouches[0];
    if (touch) {
      this.#touchStart = { x: touch.clientX, y: touch.clientY };
    }
  };

  /** @param {TouchEvent} event */
  #onTouchMove = (event) => {
    // Keeps the page from scrolling while the player swipes on the board.
    if (this.#touchStart) {
      event.preventDefault();
    }
  };

  /** @param {TouchEvent} event */
  #onTouchEnd = (event) => {
    const start = this.#touchStart;
    this.#touchStart = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD_PX) {
      return;
    }

    const direction =
      Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX > 0
          ? 'right'
          : 'left'
        : deltaY > 0
          ? 'down'
          : 'up';
    this.#handlers.onMove(/** @type {DirectionName} */ (direction));
  };
}
