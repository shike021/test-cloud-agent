import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStorage } from '../src/js/services/storage.js';

/**
 * `createStorage` probes the backend once per store, so every scenario stubs
 * `localStorage` first and creates the store afterwards.
 */

/** @returns {Storage} */
function createMemoryStorage() {
  const map = new Map();
  return /** @type {Storage} */ ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createStorage — with a working backend', () => {
  /** @type {Storage} */
  let backend;
  /** @type {import('../src/js/services/storage.js').NamespacedStorage} */
  let storage;

  beforeEach(() => {
    backend = createMemoryStorage();
    vi.stubGlobal('localStorage', backend);
    storage = createStorage('snake-game');
  });

  it('reports that values are persisted', () => {
    expect(storage.namespace).toBe('snake-game');
    expect(storage.persistent).toBe(true);
  });

  it('round-trips numbers under a namespaced key', () => {
    storage.writeNumber('best-score', 1234);

    expect(storage.readNumber('best-score')).toBe(1234);
    expect(backend.getItem('snake-game:best-score')).toBe('1234');
  });

  it('truncates non-integer numbers', () => {
    storage.writeNumber('best-score', 12.87);

    expect(storage.readNumber('best-score')).toBe(12);
  });

  it('round-trips booleans', () => {
    storage.writeBoolean('muted', true);
    expect(storage.readBoolean('muted')).toBe(true);

    storage.writeBoolean('muted', false);
    expect(storage.readBoolean('muted')).toBe(false);
  });

  it('round-trips strings and validates them against an allow list', () => {
    storage.writeString('difficulty', 'hard');
    expect(storage.readString('difficulty', 'normal', ['easy', 'normal', 'hard'])).toBe('hard');

    storage.writeString('difficulty', 'impossible');
    expect(storage.readString('difficulty', 'normal', ['easy', 'normal', 'hard'])).toBe('normal');
  });

  it('returns the fallback for missing and corrupted values', () => {
    expect(storage.readNumber('missing', 7)).toBe(7);
    expect(storage.readBoolean('missing', true)).toBe(true);
    expect(storage.readString('missing', 'normal')).toBe('normal');

    backend.setItem('snake-game:best-score', 'not-a-number');
    expect(storage.readNumber('best-score', 42)).toBe(42);
  });

  it('isolates stores that use different namespaces', () => {
    const other = createStorage('gomoku');

    storage.writeNumber('rounds', 3);
    other.writeNumber('rounds', 11);

    expect(storage.readNumber('rounds')).toBe(3);
    expect(other.readNumber('rounds')).toBe(11);
    expect(backend.getItem('gomoku:rounds')).toBe('11');
  });
});

describe('createStorage — with a hostile backend', () => {
  it('falls back to memory when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      get length() {
        return 0;
      },
      getItem() {
        throw new Error('access denied');
      },
      setItem() {
        throw new Error('access denied');
      },
      removeItem() {
        throw new Error('access denied');
      },
      clear() {},
      key() {
        return null;
      },
    });

    const storage = createStorage('snake-game');

    expect(storage.persistent).toBe(false);
    storage.writeNumber('best-score', 99);
    expect(storage.readNumber('best-score')).toBe(99);
  });

  it('works when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    const storage = createStorage('snake-game');

    expect(storage.persistent).toBe(false);
    storage.writeBoolean('muted', true);
    expect(storage.readBoolean('muted')).toBe(true);
    expect(storage.readNumber('best-score', 0)).toBe(0);
  });

  it('rejects an empty namespace', () => {
    expect(() => createStorage('')).toThrow(TypeError);
    expect(() => createStorage(undefined)).toThrow(TypeError);
  });
});
