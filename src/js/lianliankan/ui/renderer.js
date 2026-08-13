import { glyphForType } from '../core/constants.js';

/**
 * DOM renderer for the Lianliankan board.
 *
 * Tiles are real buttons so they stay keyboard-focusable. Their type, selection
 * and hint state are written as data attributes / classes; the stylesheet owns
 * colour and motion. An SVG overlay draws the last connecting polyline in the
 * padded coordinate space of the board so a wrap-around path stays visible.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const PATH_CLEAR_MS = 420;

export class LianliankanRenderer {
  #tileLayer;
  #pathLayer;
  #game;
  /** @type {Map<string, HTMLButtonElement>} */
  #tiles = new Map();
  /** @type {ReturnType<typeof setTimeout>|null} */
  #pathTimer = null;

  /**
   * @param {object} elements
   * @param {HTMLElement} elements.tileLayer
   * @param {SVGSVGElement} elements.pathLayer
   * @param {import('../core/lianliankan-game.js').LianliankanGame} game
   */
  constructor({ tileLayer, pathLayer }, game) {
    if (!tileLayer || !pathLayer) {
      throw new TypeError('LianliankanRenderer requires a "tileLayer" and a "pathLayer" element.');
    }
    this.#tileLayer = tileLayer;
    this.#pathLayer = pathLayer;
    this.#game = game;
  }

  /** Rebuilds the grid after a size change. Safe to call again. */
  mount() {
    this.clearPath();
    this.#tiles.clear();
    this.#tileLayer.replaceChildren();
    const root = this.#tileLayer.parentElement ?? this.#tileLayer;
    root.style.setProperty('--board-rows', String(this.#game.rows));
    root.style.setProperty('--board-cols', String(this.#game.cols));
    this.#tileLayer.style.setProperty('--board-rows', String(this.#game.rows));
    this.#tileLayer.style.setProperty('--board-cols', String(this.#game.cols));
    this.#pathLayer.setAttribute('viewBox', `-1 -1 ${this.#game.cols + 2} ${this.#game.rows + 2}`);

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < this.#game.rows; row += 1) {
      for (let col = 0; col < this.#game.cols; col += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'llk-tile';
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        fragment.append(button);
        this.#tiles.set(LianliankanRenderer.#key(row, col), button);
      }
    }
    this.#tileLayer.append(fragment);
  }

  /** Synchronises every cell with the current board, selection and hint. */
  render() {
    const selected = this.#game.selected;
    const hint = this.#game.hintPair;

    for (let row = 0; row < this.#game.rows; row += 1) {
      for (let col = 0; col < this.#game.cols; col += 1) {
        const button = this.#tiles.get(LianliankanRenderer.#key(row, col));
        if (!button) {
          continue;
        }
        const tile = this.#game.tileAt(row, col);
        this.#syncTile(button, tile, selected, hint);
      }
    }
  }

  /**
   * Draws `path` and keeps it on screen briefly so the match is readable.
   *
   * @param {import('../core/path-finder.js').LinkPath|null} path
   */
  showPath(path) {
    this.clearPath();
    if (!path || path.length < 2) {
      return;
    }

    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('class', 'board__path-line');
    polyline.setAttribute('pathLength', '1');
    polyline.setAttribute(
      'points',
      path.map((cell) => `${cell.col + 0.5},${cell.row + 0.5}`).join(' '),
    );
    this.#pathLayer.append(polyline);

    for (const cell of [path[0], path[path.length - 1]]) {
      const button = this.#tiles.get(LianliankanRenderer.#key(cell.row, cell.col));
      button?.classList.add('is-matching');
    }

    this.#pathTimer = setTimeout(() => {
      this.clearPath();
    }, PATH_CLEAR_MS);
  }

  clearPath() {
    if (this.#pathTimer !== null) {
      clearTimeout(this.#pathTimer);
      this.#pathTimer = null;
    }
    this.#pathLayer.replaceChildren();
    for (const button of this.#tiles.values()) {
      button.classList.remove('is-matching');
    }
  }

  destroy() {
    this.clearPath();
    this.#tiles.clear();
    this.#tileLayer.replaceChildren();
  }

  /**
   * @param {HTMLButtonElement} button
   * @param {import('../core/lianliankan-game.js').Tile|null} tile
   * @param {import('../core/path-finder.js').Cell|null} selected
   * @param {{ a: import('../core/path-finder.js').Cell, b: import('../core/path-finder.js').Cell }|null} hint
   */
  #syncTile(button, tile, selected, hint) {
    if (!tile) {
      button.hidden = true;
      button.disabled = true;
      button.classList.remove('is-selected', 'is-hint');
      button.removeAttribute('data-type');
      button.style.removeProperty('--tile-hue');
      button.textContent = '';
      button.setAttribute('aria-label', '空位');
      return;
    }

    const identity = glyphForType(tile.type);
    button.hidden = false;
    button.disabled = false;
    button.dataset.type = String(tile.type);
    button.style.setProperty('--tile-hue', String(identity.hue));
    button.textContent = identity.glyph;
    button.setAttribute(
      'aria-label',
      `${identity.label}，第 ${tile.row + 1} 行第 ${tile.col + 1} 列`,
    );

    const isSelected = Boolean(selected && selected.row === tile.row && selected.col === tile.col);
    const isHint = Boolean(
      hint &&
      ((hint.a.row === tile.row && hint.a.col === tile.col) ||
        (hint.b.row === tile.row && hint.b.col === tile.col)),
    );
    button.classList.toggle('is-selected', isSelected);
    button.classList.toggle('is-hint', isHint && !isSelected);
  }

  /**
   * @param {number} row
   * @param {number} col
   * @returns {string}
   */
  static #key(row, col) {
    return `${row},${col}`;
  }
}
