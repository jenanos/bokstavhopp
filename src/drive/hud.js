// On-screen bits for Bokstavbil: the alphabet strip, the speedometer,
// stars and trophies, the start lights and a big banner.

import { ALPHABET } from '../alphabet.js';

export class DriveHud {
  constructor(root, levels) {
    this.root = root;
    root.innerHTML = `
      <div class="abc"></div>
      <div class="speedo"><span class="snail">🐌</span><div class="bars"></div><span class="rocket">🚀</span></div>
      <div class="score"><span class="laps"></span><span class="stars">⭐<b>0</b></span></div>
      <div class="lights" hidden><i></i><i></i><i></i></div>
      <div class="banner" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    this.abcEl = $('.abc');
    this.cells = [...ALPHABET].map((ch) => {
      const s = document.createElement('span');
      s.textContent = ch;
      this.abcEl.appendChild(s);
      return s;
    });
    this.bars = [];
    for (let i = 0; i < levels; i++) {
      const b = document.createElement('i');
      b.style.height = `${30 + (70 * i) / (levels - 1)}%`;
      // Blue (slow) to red (fast)
      b.style.setProperty('--c', `hsl(${220 + (140 * i) / (levels - 1)} 90% 55%)`);
      $('.bars').appendChild(b);
      this.bars.push(b);
    }
    this.speedoEl = $('.speedo');
    this.starsEl = $('.stars b');
    this.starsBox = $('.stars');
    this.lapsEl = $('.laps');
    this.lightsEl = $('.lights');
    this.bannerEl = $('.banner');
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; this.banner(null); this.lights(null); }

  resetStrip() {
    this.cells.forEach((c, i) => {
      c.className = '';
      c.textContent = ALPHABET[i];
    });
  }

  /** Highlight the letter that is coming up next (or none). */
  current(i) {
    this.cells.forEach((c, k) => c.classList.toggle('current', k === i));
  }

  /** @param {'fast'|'slow'|null} kind null = drove past it */
  mark(i, char, kind) {
    const c = this.cells[i];
    if (!c) return;
    c.className = kind ?? 'missed';
    c.textContent = kind ? char : ALPHABET[i];
  }

  speed(level, flash = false) {
    this.bars.forEach((b, i) => b.classList.toggle('on', i <= level));
    if (flash) {
      this.speedoEl.classList.remove('flash');
      void this.speedoEl.offsetWidth; // restart the animation
      this.speedoEl.classList.add('flash');
    }
  }

  stars(n) {
    this.starsEl.textContent = n;
    this.starsBox.classList.remove('flash');
    void this.starsBox.offsetWidth;
    this.starsBox.classList.add('flash');
  }

  laps(n) {
    this.lapsEl.textContent = '🏆'.repeat(Math.min(n, 8)) + (n > 8 ? ` ×${n}` : '');
  }

  /** Start lights: 0..3 red lamps lit, 'go' = all green, null = hidden. */
  lights(state) {
    const el = this.lightsEl;
    el.hidden = state === null;
    el.classList.toggle('go', state === 'go');
    [...el.children].forEach((lamp, i) => lamp.classList.toggle('lit', typeof state === 'number' && i < state));
  }

  banner(text) {
    const el = this.bannerEl;
    el.hidden = !text;
    if (!text) return;
    el.textContent = text;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }
}
