/**
 * Namespaced, failure tolerant wrapper around `localStorage`.
 *
 * Private browsing modes and hardened browser settings can make `localStorage`
 * throw on access, so every operation degrades to an in-memory fallback instead
 * of breaking the game.
 *
 * Each game owns its own namespace, which keeps the keys of the arcade titles
 * isolated from each other even though they share one origin.
 */

/**
 * @typedef {object} NamespacedStorage
 * @property {string} namespace
 * @property {boolean} persistent  `false` when the in-memory fallback is in use.
 * @property {(key: string, fallback?: string, allowedValues?: readonly string[]) => string} readString
 * @property {(key: string, value: string) => void} writeString
 * @property {(key: string, fallback?: number) => number} readNumber
 * @property {(key: string, value: number) => void} writeNumber
 * @property {(key: string, fallback?: boolean) => boolean} readBoolean
 * @property {(key: string, value: boolean) => void} writeBoolean
 */

/**
 * @param {string} namespace
 * @returns {Storage|null} `null` when persistence is unavailable.
 */
function resolveBackend(namespace) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    const probe = `${namespace}:__probe__`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Creates an isolated key-value store.
 *
 * The backend is probed once per store, because a browser that rejects
 * `localStorage` will keep rejecting it for the lifetime of the page.
 *
 * @param {string} namespace Prefix for every key written by the store.
 * @returns {NamespacedStorage}
 */
export function createStorage(namespace) {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    throw new TypeError('createStorage requires a non-empty namespace.');
  }

  const backend = resolveBackend(namespace);
  /** @type {Map<string, string>} */
  const memoryFallback = new Map();

  /**
   * @param {string} key
   * @returns {string|null}
   */
  function readRaw(key) {
    const namespacedKey = `${namespace}:${key}`;
    if (backend) {
      try {
        return backend.getItem(namespacedKey);
      } catch {
        /* fall through to the in-memory copy */
      }
    }
    return memoryFallback.get(namespacedKey) ?? null;
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  function writeRaw(key, value) {
    const namespacedKey = `${namespace}:${key}`;
    memoryFallback.set(namespacedKey, value);
    if (backend) {
      try {
        backend.setItem(namespacedKey, value);
      } catch {
        /* the in-memory copy keeps the session consistent */
      }
    }
  }

  return {
    namespace,
    persistent: backend !== null,

    /**
     * Reads a persisted string.
     *
     * @param {string} key
     * @param {string} [fallback]
     * @param {readonly string[]} [allowedValues] When given, values outside the
     *   list are rejected in favour of the fallback.
     * @returns {string}
     */
    readString(key, fallback = '', allowedValues) {
      const raw = readRaw(key);
      if (raw === null) {
        return fallback;
      }
      if (allowedValues && !allowedValues.includes(raw)) {
        return fallback;
      }
      return raw;
    },

    /**
     * @param {string} key
     * @param {string} value
     */
    writeString(key, value) {
      writeRaw(key, value);
    },

    /**
     * Reads a persisted integer, rejecting values that cannot be parsed.
     *
     * @param {string} key
     * @param {number} [fallback]
     * @returns {number}
     */
    readNumber(key, fallback = 0) {
      const raw = readRaw(key);
      if (raw === null) {
        return fallback;
      }
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    },

    /**
     * @param {string} key
     * @param {number} value
     */
    writeNumber(key, value) {
      writeRaw(key, String(Math.trunc(value)));
    },

    /**
     * @param {string} key
     * @param {boolean} [fallback]
     * @returns {boolean}
     */
    readBoolean(key, fallback = false) {
      const raw = readRaw(key);
      if (raw === null) {
        return fallback;
      }
      return raw === 'true';
    },

    /**
     * @param {string} key
     * @param {boolean} value
     */
    writeBoolean(key, value) {
      writeRaw(key, value ? 'true' : 'false');
    },
  };
}
