import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The storage module resolves its backend once at import time, so every
 * scenario imports a fresh copy through `vi.resetModules()`.
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

/** @returns {Promise<typeof import('../src/js/services/storage.js')>} */
async function importStorage() {
  vi.resetModules();
  return import('../src/js/services/storage.js');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage — with a working backend', () => {
  /** @type {Storage} */
  let backend;

  beforeEach(() => {
    backend = createMemoryStorage();
    vi.stubGlobal('localStorage', backend);
  });

  it('round-trips numbers under a namespaced key', async () => {
    const storage = await importStorage();

    storage.writeNumber('best-score', 1234);

    expect(storage.readNumber('best-score')).toBe(1234);
    expect(backend.getItem('snake-game:best-score')).toBe('1234');
  });

  it('truncates non-integer numbers', async () => {
    const storage = await importStorage();

    storage.writeNumber('best-score', 12.87);

    expect(storage.readNumber('best-score')).toBe(12);
  });

  it('round-trips booleans', async () => {
    const storage = await importStorage();

    storage.writeBoolean('muted', true);
    expect(storage.readBoolean('muted')).toBe(true);

    storage.writeBoolean('muted', false);
    expect(storage.readBoolean('muted')).toBe(false);
  });

  it('round-trips strings and validates them against an allow list', async () => {
    const storage = await importStorage();

    storage.writeString('difficulty', 'hard');
    expect(storage.readString('difficulty', 'normal', ['easy', 'normal', 'hard'])).toBe('hard');

    storage.writeString('difficulty', 'impossible');
    expect(storage.readString('difficulty', 'normal', ['easy', 'normal', 'hard'])).toBe('normal');
  });

  it('returns the fallback for missing and corrupted values', async () => {
    const storage = await importStorage();

    expect(storage.readNumber('missing', 7)).toBe(7);
    expect(storage.readBoolean('missing', true)).toBe(true);
    expect(storage.readString('missing', 'normal')).toBe('normal');

    backend.setItem('snake-game:best-score', 'not-a-number');
    expect(storage.readNumber('best-score', 42)).toBe(42);
  });
});

describe('storage — with a hostile backend', () => {
  it('falls back to memory when localStorage throws', async () => {
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

    const storage = await importStorage();

    storage.writeNumber('best-score', 99);
    expect(storage.readNumber('best-score')).toBe(99);
  });

  it('works when localStorage is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);

    const storage = await importStorage();

    storage.writeBoolean('muted', true);
    expect(storage.readBoolean('muted')).toBe(true);
    expect(storage.readNumber('best-score', 0)).toBe(0);
  });
});
