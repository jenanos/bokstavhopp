// Synthesised sound effects (no audio files) and Norwegian speech.

import { LETTER_NAMES, charIndex, upper } from './alphabet.js';

// Major pentatonic: anything a child mashes sounds musical.
const PENTA = [0, 2, 4, 7, 9];
const BASE = 261.63; // C4

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastThud = 0;
  }

  /** Create/resume the AudioContext. Call from a user gesture. */
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  noteFreq(i) {
    const step = i % 10;
    const semis = PENTA[step % 5] + 12 * Math.floor(step / 5);
    return BASE * Math.pow(2, semis / 12);
  }

  #tone({ type = 'sine', from, to = from, start = 0, dur = 0.3, gain = 0.25, attack = 0.01 }) {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + Math.min(dur * 0.5, 0.15));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Springy "boing" whose pitch belongs to the letter. */
  boing(ch) {
    if (!this.ready) return;
    const f = this.noteFreq(charIndex(ch));
    this.#tone({ type: 'triangle', from: f * 0.5, to: f, dur: 0.38, gain: 0.3 });
    this.#tone({ type: 'sine', from: f, to: f * 2, dur: 0.25, gain: 0.12 });
  }

  thud(strength = 1) {
    if (!this.ready) return;
    const now = performance.now();
    if (now - this.lastThud < 45) return;
    this.lastThud = now;
    this.#tone({ type: 'sine', from: 150, to: 55, dur: 0.16, gain: 0.18 * Math.min(1, strength) });
  }

  pop() {
    if (!this.ready) return;
    this.#tone({ type: 'sine', from: 700, to: 1500, dur: 0.1, gain: 0.12 });
  }

  sparkle() {
    if (!this.ready) return;
    for (let i = 0; i < 4; i++) {
      const f = this.noteFreq(5 + Math.floor(Math.random() * 5)) * 2;
      this.#tone({ type: 'sine', from: f, start: i * 0.055, dur: 0.22, gain: 0.07 });
    }
  }

  whoop() {
    if (!this.ready) return;
    this.#tone({ type: 'triangle', from: 200, to: 800, dur: 0.4, gain: 0.2 });
    this.#tone({ type: 'sine', from: 400, to: 1600, dur: 0.35, gain: 0.08, start: 0.04 });
  }

  success() {
    if (!this.ready) return;
    [0, 4, 7, 12, 16].forEach((s, i) => {
      const f = BASE * 2 * Math.pow(2, s / 12);
      this.#tone({ type: 'triangle', from: f, start: i * 0.08, dur: 0.4, gain: 0.2 });
      this.#tone({ type: 'sine', from: f * 2, start: i * 0.08, dur: 0.3, gain: 0.06 });
    });
  }

  fanfare() {
    if (!this.ready) return;
    const seq = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    seq.forEach((s, i) => {
      const f = BASE * Math.pow(2, s / 12);
      this.#tone({ type: 'square', from: f, start: i * 0.11, dur: 0.3, gain: 0.07 });
      this.#tone({ type: 'triangle', from: f, start: i * 0.11, dur: 0.5, gain: 0.18 });
    });
  }

  /** Gentle "hm-hm" when the wrong key is pressed. Never scary. */
  oops() {
    if (!this.ready) return;
    this.#tone({ type: 'sine', from: 392, dur: 0.18, gain: 0.14 });
    this.#tone({ type: 'sine', from: 330, start: 0.16, dur: 0.24, gain: 0.14 });
  }

  // ---------- Car sounds (Bokstavbil) ----------

  /** A pitch glide over the whole duration (#tone only bends at the start). */
  #slide({ type = 'triangle', from, to, start = 0, dur = 0.4, gain = 0.2 }) {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Red letter: a rising "vrooom!" */
  speedUp() {
    if (!this.ready) return;
    this.#slide({ type: 'sawtooth', from: 110, to: 440, dur: 0.5, gain: 0.08 });
    this.#slide({ type: 'triangle', from: 220, to: 880, dur: 0.45, gain: 0.2 });
    this.#slide({ type: 'sine', from: 440, to: 1760, start: 0.05, dur: 0.4, gain: 0.08 });
  }

  /** Blue letter: a lazy "wah-wah". */
  slowDown() {
    if (!this.ready) return;
    this.#slide({ type: 'triangle', from: 660, to: 330, dur: 0.3, gain: 0.2 });
    this.#slide({ type: 'triangle', from: 495, to: 196, start: 0.28, dur: 0.45, gain: 0.2 });
  }

  /** Tut-tut! */
  horn() {
    if (!this.ready) return;
    for (const s of [0, 0.2]) {
      this.#tone({ type: 'square', from: 392, start: s, dur: 0.16, gain: 0.05, attack: 0.005 });
      this.#tone({ type: 'triangle', from: 494, start: s, dur: 0.16, gain: 0.16, attack: 0.005 });
    }
  }

  /** A short honk whose pitch belongs to the letter. */
  hornNote(ch) {
    if (!this.ready) return;
    const f = this.noteFreq(charIndex(ch));
    this.#tone({ type: 'square', from: f, dur: 0.2, gain: 0.05, attack: 0.005 });
    this.#tone({ type: 'triangle', from: f * 1.5, dur: 0.2, gain: 0.12, attack: 0.005 });
  }

  coin() {
    if (!this.ready) return;
    this.#tone({ type: 'sine', from: 988, dur: 0.1, gain: 0.15 });
    this.#tone({ type: 'sine', from: 1319, start: 0.07, dur: 0.3, gain: 0.15 });
  }

  wheee() {
    if (!this.ready) return;
    this.#slide({ type: 'sine', from: 300, to: 1400, dur: 0.5, gain: 0.16 });
    this.#slide({ type: 'triangle', from: 1400, to: 500, start: 0.5, dur: 0.45, gain: 0.1 });
  }

  /** Countdown beep; the last one is higher and longer. */
  beep(go = false) {
    if (!this.ready) return;
    const f = go ? 880 : 440;
    this.#tone({ type: 'square', from: f, dur: go ? 0.6 : 0.22, gain: 0.06, attack: 0.005 });
    this.#tone({ type: 'triangle', from: f, dur: go ? 0.6 : 0.22, gain: 0.14, attack: 0.005 });
  }

  /** Soft bump against the kerb. */
  bump() {
    if (!this.ready) return;
    this.#tone({ type: 'sine', from: 200, to: 80, dur: 0.22, gain: 0.22 });
  }

  /** Soft "brum-brum" engine whose pitch follows the speed (0..1). */
  engineStart() {
    if (!this.ready || this.engine) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 50;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.045, ctx.currentTime, 0.3);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    osc.connect(filter).connect(g).connect(this.master);
    osc.start();
    lfo.start();
    this.engine = { osc, lfo, g, filter };
  }

  engineSpeed(f) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(45 + 70 * f, t, 0.2);
    this.engine.lfo.frequency.setTargetAtTime(7 + 16 * f, t, 0.2);
    this.engine.filter.frequency.setTargetAtTime(320 + 500 * f, t, 0.2);
  }

  engineStop() {
    if (!this.engine) return;
    const { osc, lfo, g } = this.engine;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, 0.08);
    osc.stop(t + 0.5);
    lfo.stop(t + 0.5);
    this.engine = null;
  }
}

export class Speech {
  constructor() {
    this.enabled = true;
    this.voice = null;
    this.synth = window.speechSynthesis || null;
    this.pending = null;
    this.onVoices = null;
    if (this.synth) {
      this.#pick();
      this.synth.addEventListener?.('voiceschanged', () => this.#pick());
    }
  }

  get available() {
    return !!this.voice;
  }

  #pick() {
    const voices = this.synth.getVoices();
    const norwegian = voices.filter((v) => /^(nb|no|nn)\b/i.test(v.lang) || /norw|norsk|bokm/i.test(v.name));
    // Prefer the natural/online voices (e.g. Edge's "Microsoft Pernille Online (Natural)").
    norwegian.sort((a, b) => score(b) - score(a));
    this.voice = norwegian[0] || null;
    this.onVoices?.();
  }

  /** Speak right away, interrupting whatever is being said. */
  say(text, { rate = 0.9, pitch = 1.15 } = {}) {
    if (!this.enabled || !this.voice || !this.synth) return;
    clearTimeout(this.pending);
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.rate = rate;
    u.pitch = pitch;
    this.synth.speak(u);
  }

  /** Speak after a short pause; repeated calls replace each other (good for key mashing). */
  sayDebounced(text, ms = 160) {
    if (!this.enabled || !this.voice) return;
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.say(text), ms);
  }

  stop() {
    clearTimeout(this.pending);
    this.synth?.cancel();
  }
}

export const letterName = (ch) => LETTER_NAMES[upper(ch)] ?? ch;

function score(v) {
  let s = 0;
  if (/natural|online|neural/i.test(v.name)) s += 4;
  if (/^nb/i.test(v.lang)) s += 2;
  if (v.localService === false) s += 1;
  return s;
}
