// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InputController } from '../src/js/ui/input-controller.js';

/**
 * @param {string} type
 * @param {number} x
 * @param {number} y
 */
function createTouchEvent(type, x, y) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'changedTouches', {
    value: [{ clientX: x, clientY: y }],
  });
  return event;
}

/**
 * @param {string} code
 * @param {KeyboardEventInit} [init]
 */
function pressKey(code, init = {}) {
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

describe('InputController', () => {
  /** @type {HTMLElement} */
  let surface;
  /** @type {HTMLElement} */
  let dpad;
  /** @type {InputController} */
  let controller;
  let handlers;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="surface"></div>
      <div id="dpad">
        <button data-direction="up"></button>
        <button data-direction="down"></button>
        <button data-direction="left"></button>
        <button data-direction="right"></button>
        <button data-direction="diagonal"></button>
      </div>
    `;
    surface = /** @type {HTMLElement} */ (document.querySelector('#surface'));
    dpad = /** @type {HTMLElement} */ (document.querySelector('#dpad'));

    handlers = {
      onDirection: vi.fn(),
      onTogglePause: vi.fn(),
      onRestart: vi.fn(),
      onToggleMute: vi.fn(),
    };

    controller = new InputController({
      surface,
      directionButtons: dpad.querySelectorAll('[data-direction]'),
      handlers,
    });
    controller.attach();
  });

  afterEach(() => {
    controller.detach();
    document.body.innerHTML = '';
  });

  it('requires a surface and a direction handler', () => {
    expect(() => new InputController({ handlers })).toThrow(TypeError);
    expect(() => new InputController({ surface, handlers: {} })).toThrow(TypeError);
  });

  it('maps the arrow keys to directions', () => {
    for (const [code, direction] of [
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
    ]) {
      const event = pressKey(code);
      expect(handlers.onDirection).toHaveBeenLastCalledWith(direction);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(handlers.onDirection).toHaveBeenCalledTimes(4);
  });

  it('maps WASD to directions', () => {
    for (const [code, direction] of [
      ['KeyW', 'up'],
      ['KeyS', 'down'],
      ['KeyA', 'left'],
      ['KeyD', 'right'],
    ]) {
      pressKey(code);
      expect(handlers.onDirection).toHaveBeenLastCalledWith(direction);
    }
  });

  it('maps the command keys', () => {
    pressKey('Space');
    pressKey('KeyP');
    expect(handlers.onTogglePause).toHaveBeenCalledTimes(2);

    pressKey('KeyR');
    pressKey('Enter');
    expect(handlers.onRestart).toHaveBeenCalledTimes(2);

    pressKey('KeyM');
    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('ignores keys pressed with a modifier and unrelated keys', () => {
    pressKey('ArrowUp', { ctrlKey: true });
    pressKey('ArrowDown', { metaKey: true });
    pressKey('KeyZ');

    expect(handlers.onDirection).not.toHaveBeenCalled();
    expect(handlers.onTogglePause).not.toHaveBeenCalled();
  });

  it('emits a direction when a d-pad button is activated', () => {
    /** @type {HTMLButtonElement} */
    const upButton = dpad.querySelector('[data-direction="up"]');
    upButton.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handlers.onDirection).toHaveBeenCalledWith('up');
  });

  it('ignores buttons with an unknown direction', () => {
    /** @type {HTMLButtonElement} */
    const invalidButton = dpad.querySelector('[data-direction="diagonal"]');
    invalidButton.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handlers.onDirection).not.toHaveBeenCalled();
  });

  it('translates swipes into directions', () => {
    const cases = [
      { from: [100, 100], to: [200, 105], direction: 'right' },
      { from: [200, 100], to: [100, 105], direction: 'left' },
      { from: [100, 100], to: [105, 200], direction: 'down' },
      { from: [100, 200], to: [105, 100], direction: 'up' },
    ];

    for (const { from, to, direction } of cases) {
      surface.dispatchEvent(createTouchEvent('touchstart', from[0], from[1]));
      surface.dispatchEvent(createTouchEvent('touchend', to[0], to[1]));
      expect(handlers.onDirection).toHaveBeenLastCalledWith(direction);
    }
  });

  it('treats a tap as a pause toggle', () => {
    surface.dispatchEvent(createTouchEvent('touchstart', 100, 100));
    surface.dispatchEvent(createTouchEvent('touchend', 103, 102));

    expect(handlers.onDirection).not.toHaveBeenCalled();
    expect(handlers.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('prevents scrolling while a swipe is in progress', () => {
    surface.dispatchEvent(createTouchEvent('touchstart', 100, 100));
    const moveEvent = createTouchEvent('touchmove', 120, 100);
    surface.dispatchEvent(moveEvent);

    expect(moveEvent.defaultPrevented).toBe(true);
  });

  it('stops reacting after detach', () => {
    controller.detach();
    pressKey('ArrowUp');
    surface.dispatchEvent(createTouchEvent('touchstart', 100, 100));
    surface.dispatchEvent(createTouchEvent('touchend', 100, 200));

    expect(handlers.onDirection).not.toHaveBeenCalled();
  });

  it('is idempotent when attached twice', () => {
    controller.attach();
    pressKey('ArrowUp');

    expect(handlers.onDirection).toHaveBeenCalledTimes(1);
  });
});
