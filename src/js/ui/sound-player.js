/**
 * Minimal Web Audio sound effects.
 *
 * Effects are synthesised at runtime so the game ships without binary assets.
 * The audio context is created lazily on the first user triggered sound, which
 * satisfies the autoplay policies of modern browsers.
 */

/** @typedef {'eat' | 'bonus' | 'levelUp' | 'gameOver' | 'win'} SoundName */

/**
 * @typedef {object} Tone
 * @property {number} frequency  Start frequency in Hz.
 * @property {number} [endFrequency] Target frequency for a glide.
 * @property {number} duration   Duration in seconds.
 * @property {number} [delay]    Offset from the start of the effect, in seconds.
 * @property {OscillatorType} [type]
 * @property {number} [gain]
 */

/** @type {Record<SoundName, Tone[]>} */
const EFFECTS = {
  eat: [{ frequency: 660, endFrequency: 990, duration: 0.09, type: 'triangle', gain: 0.16 }],
  bonus: [
    { frequency: 740, duration: 0.08, type: 'square', gain: 0.12 },
    { frequency: 988, duration: 0.08, delay: 0.07, type: 'square', gain: 0.12 },
    { frequency: 1319, duration: 0.12, delay: 0.14, type: 'square', gain: 0.12 },
  ],
  levelUp: [
    { frequency: 523, duration: 0.1, type: 'triangle', gain: 0.14 },
    { frequency: 784, duration: 0.14, delay: 0.09, type: 'triangle', gain: 0.14 },
  ],
  gameOver: [{ frequency: 392, endFrequency: 130, duration: 0.5, type: 'sawtooth', gain: 0.12 }],
  win: [
    { frequency: 523, duration: 0.12, type: 'triangle', gain: 0.14 },
    { frequency: 659, duration: 0.12, delay: 0.12, type: 'triangle', gain: 0.14 },
    { frequency: 784, duration: 0.12, delay: 0.24, type: 'triangle', gain: 0.14 },
    { frequency: 1047, duration: 0.24, delay: 0.36, type: 'triangle', gain: 0.14 },
  ],
};

export class SoundPlayer {
  /** @type {AudioContext|null} */
  #context = null;
  #muted;
  #supported;

  /**
   * @param {{ muted?: boolean }} [options]
   */
  constructor({ muted = false } = {}) {
    this.#muted = muted;
    this.#supported = typeof globalThis.AudioContext === 'function';
  }

  get muted() {
    return this.#muted;
  }

  set muted(value) {
    this.#muted = Boolean(value);
  }

  get supported() {
    return this.#supported;
  }

  /** @returns {boolean} The new muted state. */
  toggleMuted() {
    this.#muted = !this.#muted;
    return this.#muted;
  }

  /**
   * Plays one of the predefined effects. Unknown names and unsupported browsers
   * are silently ignored so callers never need to guard.
   *
   * @param {SoundName} name
   */
  play(name) {
    const tones = EFFECTS[name];
    if (this.#muted || !this.#supported || !tones) {
      return;
    }

    const context = this.#ensureContext();
    if (!context) {
      return;
    }
    if (context.state === 'suspended') {
      void context.resume();
    }

    for (const tone of tones) {
      this.#playTone(context, tone);
    }
  }

  /** Releases audio resources; used when tearing the game down. */
  async dispose() {
    if (this.#context) {
      const context = this.#context;
      this.#context = null;
      await context.close().catch(() => undefined);
    }
  }

  /** @returns {AudioContext|null} */
  #ensureContext() {
    if (this.#context) {
      return this.#context;
    }
    try {
      this.#context = new AudioContext();
      return this.#context;
    } catch {
      this.#supported = false;
      return null;
    }
  }

  /**
   * @param {AudioContext} context
   * @param {Tone} tone
   */
  #playTone(context, tone) {
    const { frequency, endFrequency, duration, delay = 0, type = 'sine', gain = 0.15 } = tone;
    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;

    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (typeof endFrequency === 'number') {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
    }

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(gain, startAt + Math.min(0.02, duration / 2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }
}
