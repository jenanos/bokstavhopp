// DOM bits: title, star counter and the on-screen keyboard hint.

import { ALPHABET, cssColor } from './alphabet.js';

export function renderTitle(el, text) {
  el.innerHTML = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.color = cssColor(ALPHABET[(i * 3) % ALPHABET.length]);
    s.style.animationDelay = `${i * 0.09}s`;
    el.appendChild(s);
  });
}

// Norwegian keyboard layout – keycaps show capital letters, just like the real keyboard.
const ROWS = ['QWERTYUIOPÅ', 'ASDFGHJKLØÆ', 'ZXCVBNM'];

export class KeyboardHint {
  constructor(el) {
    this.el = el;
    this.keys = new Map();
    for (const row of ROWS) {
      const r = document.createElement('div');
      r.className = 'kb-row';
      for (const ch of row) {
        const k = document.createElement('div');
        k.className = 'kb-key';
        k.textContent = ch;
        r.appendChild(k);
        this.keys.set(ch, k);
      }
      el.appendChild(r);
    }
  }

  show(letter) {
    if (this.current === letter && !this.el.hidden) return;
    this.current = letter;
    for (const [ch, k] of this.keys) {
      const on = ch === letter;
      k.classList.toggle('target', on);
      k.style.setProperty('--key-color', on ? cssColor(ch) : '');
    }
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
    this.current = null;
  }
}

const STAR_SVG =
  '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M12 2.2l2.9 6.6 7.1.7-5.4 4.8 1.6 7.1L12 17.7l-6.2 3.7 1.6-7.1L2 9.5l7.1-.7z" ' +
  'fill="#ffd60a" stroke="#e09b00" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const TROPHY_SVG =
  '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">' +
  '<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffc300" stroke="#c98a00" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.6 10M17 5h3v1.5A3.5 3.5 0 0 1 16.4 10" fill="none" stroke="#c98a00" stroke-width="1.4"/>' +
  '<path d="M10.5 13h3v3.5h-3z" fill="#e0a800"/><rect x="7.5" y="16.5" width="9" height="4" rx="1" fill="#b5651d"/></svg>';

export class StarCounter {
  constructor(hud, starsEl, trophiesEl, perTrophy = 10) {
    this.hud = hud;
    this.starsEl = starsEl;
    this.trophiesEl = trophiesEl;
    this.perTrophy = perTrophy;
    this.reset();
  }

  reset() {
    this.stars = 0;
    this.trophies = 0;
    this.render();
  }

  /** @returns {boolean} true if a trophy was just earned */
  add() {
    this.stars++;
    let trophy = false;
    if (this.stars >= this.perTrophy) {
      this.stars = 0;
      this.trophies++;
      trophy = true;
    }
    this.render(true);
    return trophy;
  }

  render(animateLast = false) {
    this.starsEl.innerHTML = '';
    for (let i = 0; i < this.perTrophy; i++) {
      const s = document.createElement('span');
      s.innerHTML = STAR_SVG;
      if (i >= this.stars) s.className = 'empty';
      else if (!(animateLast && i === this.stars - 1)) s.style.animation = 'none';
      this.starsEl.appendChild(s);
    }
    this.trophiesEl.innerHTML = '';
    for (let i = 0; i < this.trophies; i++) {
      const t = document.createElement('span');
      t.innerHTML = TROPHY_SVG;
      if (!(animateLast && this.stars === 0 && i === this.trophies - 1)) t.style.animation = 'none';
      this.trophiesEl.appendChild(t);
    }
  }

  show() { this.hud.hidden = false; }
  hide() { this.hud.hidden = true; }
}
