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
