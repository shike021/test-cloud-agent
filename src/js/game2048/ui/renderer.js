/**
 * DOM renderer for the 2048 board.
 *
 * Tiles are absolutely positioned `div`s whose cell coordinates are written to
 * the CSS custom properties `--tile-x` / `--tile-y`; the stylesheet turns those
 * into a `translate` and animates the change. Keeping the geometry in CSS means
 * the board stays responsive without the renderer ever measuring the layout.
 *
 * Elements are pooled by tile id, so a tile that slides across the board keeps
 * its element — and therefore its transition — instead of being recreated.
 */

/**
 * How long a merged-away tile stays in the DOM. It has to outlive the slide
 * animation defined in `game2048.css`, otherwise the tile would vanish before
 * reaching the cell it merges into.
 */
const RETIRE_DELAY_MS = 260;

/** @typedef {import('../core/game-2048.js').Tile} Tile */

export class Game2048Renderer {
  #gridLayer;
  #tileLayer;
  #game;
  /** @type {Map<number, HTMLElement>} */
  #elements = new Map();
  /** @type {Set<ReturnType<typeof setTimeout>>} */
  #timers = new Set();

  /**
   * @param {object} elements
   * @param {HTMLElement} elements.gridLayer Holds the static background cells.
   * @param {HTMLElement} elements.tileLayer Holds the live tiles.
   * @param {import('../core/game-2048.js').Game2048} game
   */
  constructor({ gridLayer, tileLayer }, game) {
    if (!gridLayer || !tileLayer) {
      throw new TypeError('Game2048Renderer requires a "gridLayer" and a "tileLayer" element.');
    }
    this.#gridLayer = gridLayer;
    this.#tileLayer = tileLayer;
    this.#game = game;
  }

  /** Builds the background grid. Safe to call again after a size change. */
  mount() {
    const { size } = this.#game;
    this.#gridLayer.replaceChildren();
    this.#gridLayer.style.setProperty('--grid-size', String(size));
    this.#tileLayer.style.setProperty('--grid-size', String(size));

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < size * size; index += 1) {
      const cell = document.createElement('div');
      cell.className = 'board__cell';
      fragment.append(cell);
    }
    this.#gridLayer.append(fragment);
  }

  /** Synchronises the DOM with the current board. */
  render() {
    this.#retireMergedTiles();

    /** @type {Set<number>} */
    const live = new Set();
    for (const tile of this.#game.tiles) {
      live.add(tile.id);
      this.#syncTile(tile);
    }

    // Whatever is left over belongs to a board that no longer exists, for
    // example after a restart.
    for (const [id, element] of this.#elements) {
      if (!live.has(id)) {
        element.remove();
        this.#elements.delete(id);
      }
    }
  }

  /** Removes every tile immediately, cancelling pending clean-ups. */
  clear() {
    for (const timer of this.#timers) {
      clearTimeout(timer);
    }
    this.#timers.clear();
    this.#elements.clear();
    this.#tileLayer.replaceChildren();
  }

  /** Releases the timers held by the renderer. */
  destroy() {
    this.clear();
  }

  /* --------------------------------------------------------------- helpers */

  #retireMergedTiles() {
    for (const tile of this.#game.removedTiles) {
      const element = this.#elements.get(tile.id);
      if (!element) {
        continue;
      }
      this.#elements.delete(tile.id);
      // The merged tile pops in on top; the consumed ones slide underneath it.
      element.classList.add('tile--retiring');
      this.#position(element, tile.x, tile.y);

      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        element.remove();
      }, RETIRE_DELAY_MS);
      this.#timers.add(timer);
    }
  }

  /** @param {Tile} tile */
  #syncTile(tile) {
    let element = this.#elements.get(tile.id);

    if (!element) {
      element = this.#createElement(tile);
      this.#elements.set(tile.id, element);
      const origin = tile.previous ?? tile;
      this.#position(element, origin.x, origin.y);
      this.#tileLayer.append(element);

      if (origin.x !== tile.x || origin.y !== tile.y) {
        // The element has to be laid out at its origin before the new position
        // can transition towards the current cell.
        element.getBoundingClientRect();
      }
    }

    this.#value(element, tile.value);
    this.#position(element, tile.x, tile.y);
  }

  /**
   * @param {Tile} tile
   * @returns {HTMLElement}
   */
  #createElement(tile) {
    const element = document.createElement('div');
    element.className = 'tile';
    if (tile.isNew) {
      element.classList.add('tile--new');
    } else if (tile.isMerged) {
      element.classList.add('tile--merged');
    }
    return element;
  }

  /**
   * @param {HTMLElement} element
   * @param {number} value
   */
  #value(element, value) {
    if (element.dataset.value === String(value)) {
      return;
    }
    element.dataset.value = String(value);
    // Long numbers have to shrink to stay inside their tile.
    element.dataset.digits = String(String(value).length);
    element.textContent = String(value);
  }

  /**
   * @param {HTMLElement} element
   * @param {number} x
   * @param {number} y
   */
  #position(element, x, y) {
    element.style.setProperty('--tile-x', String(x));
    element.style.setProperty('--tile-y', String(y));
  }
}
