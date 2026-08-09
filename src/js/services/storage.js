/**
 * Namespaced, failure tolerant wrapper around `localStorage`.
 *
 * Private browsing modes and hardened browser settings can make `localStorage`
 * throw on access, so every operation degrades to an in-memory fallback instead
 * of breaking the game.
 */

const NAMESPACE = 'snake-game';

/** @type {Map<string, string>} */
const memoryFallback = new Map();

/** @returns {Storage|null} */
function getBackend() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    const probe = `${NAMESPACE}:__probe__`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const backend = getBackend();

/**
 * @param {string} key
 * @returns {string|null}
 */
function readRaw(key) {
  const namespacedKey = `${NAMESPACE}:${key}`;
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
  const namespacedKey = `${NAMESPACE}:${key}`;
  memoryFallback.set(namespacedKey, value);
  if (backend) {
    try {
      backend.setItem(namespacedKey, value);
    } catch {
      /* the in-memory copy keeps the session consistent */
    }
  }
}

/**
 * Reads a persisted string.
 *
 * @param {string} key
 * @param {string} fallback
 * @param {readonly string[]} [allowedValues] When given, values outside the list
 *   are rejected in favour of the fallback.
 * @returns {string}
 */
export function readString(key, fallback = '', allowedValues) {
  const raw = readRaw(key);
  if (raw === null) {
    return fallback;
  }
  if (allowedValues && !allowedValues.includes(raw)) {
    return fallback;
  }
  return raw;
}

/**
 * @param {string} key
 * @param {string} value
 */
export function writeString(key, value) {
  writeRaw(key, value);
}

/**
 * Reads a persisted number.
 *
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
export function readNumber(key, fallback = 0) {
  const raw = readRaw(key);
  if (raw === null) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {string} key
 * @param {number} value
 */
export function writeNumber(key, value) {
  writeRaw(key, String(Math.trunc(value)));
}

/**
 * Reads a persisted boolean.
 *
 * @param {string} key
 * @param {boolean} fallback
 * @returns {boolean}
 */
export function readBoolean(key, fallback = false) {
  const raw = readRaw(key);
  if (raw === null) {
    return fallback;
  }
  return raw === 'true';
}

/**
 * @param {string} key
 * @param {boolean} value
 */
export function writeBoolean(key, value) {
  writeRaw(key, value ? 'true' : 'false');
}
