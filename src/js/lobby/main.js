import { createStorage } from '../services/storage.js';

/**
 * Lobby entry point.
 *
 * The lobby is static markup; this module only enriches it with the locally
 * stored progress of each game and wires the numeric shortcuts. Every lookup is
 * defensive, because a visitor may never have opened a game before.
 */

/** Digit shortcuts are read from the cards themselves via `data-shortcut`. */
const SHORTCUT_SELECTOR = '.card[data-shortcut]';

function showSnakeProgress() {
  const output = document.querySelector('#snake-best');
  if (!output) {
    return;
  }
  const storage = createStorage('snake-game');
  output.textContent = String(Math.max(0, storage.readNumber('best-score', 0)));
}

function showGomokuProgress() {
  const targets = {
    black: document.querySelector('#gomoku-black'),
    white: document.querySelector('#gomoku-white'),
    draws: document.querySelector('#gomoku-draws'),
  };
  if (!targets.black || !targets.white || !targets.draws) {
    return;
  }

  const storage = createStorage('gomoku');
  targets.black.textContent = String(Math.max(0, storage.readNumber('black-wins', 0)));
  targets.white.textContent = String(Math.max(0, storage.readNumber('white-wins', 0)));
  targets.draws.textContent = String(Math.max(0, storage.readNumber('draws', 0)));
}

function bindShortcuts() {
  /** @type {Map<string, HTMLAnchorElement>} */
  const shortcuts = new Map();
  for (const card of document.querySelectorAll(SHORTCUT_SELECTOR)) {
    const code = /** @type {HTMLElement} */ (card).dataset.shortcut;
    if (code && card instanceof HTMLAnchorElement) {
      shortcuts.set(code, card);
    }
  }
  if (shortcuts.size === 0) {
    return;
  }

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
      return;
    }
    const card = shortcuts.get(event.code);
    if (card) {
      event.preventDefault();
      card.click();
    }
  });
}

function bootstrap() {
  showSnakeProgress();
  showGomokuProgress();
  bindShortcuts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
