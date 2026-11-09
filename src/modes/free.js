// Fri lek: type freely. Capitals line up on the cloud shelf, small letters on
// the grass right below – written left to right, so you can write words.
//
//   K A T T   E R   S Ø T     <- cloud shelf
//   k a t t   e r   s ø t     <- grass

import * as THREE from 'three';
import { glyphGeometry, glyphColor } from '../hopper.js';
import { letterName } from '../audio.js';
import { ROWS } from '../scene.js';
import { RAINBOW, GOLD } from '../particles.js';

const SCALE = 2.0;
const GAP = 0.2; // between letters, in glyph units
const SPACE = 0.55; // width of a word space, in glyph units
const MARGIN = 1.2; // world units kept free at each screen edge
const _v = new THREE.Vector3();

export class FreeMode {
  constructor({ world, sound, speech }) {
    this.world = world;
    this.sound = sound;
    this.speech = speech;
    this.columns = [];
    this.tasks = [];
  }

  start() {
    this.columns = [];
    this.tasks = [];
  }

  stop() {
    this.columns = [];
    this.tasks = [];
  }

  after(sec, fn) {
    this.tasks.push({ t: sec, fn });
  }

  update(dt) {
    const due = [];
    for (const task of this.tasks) {
      task.t -= dt;
      if (task.t <= 0) due.push(task);
    }
    if (due.length) {
      this.tasks = this.tasks.filter((t) => t.t > 0);
      for (const task of due) task.fn();
    }
  }

  /** x where the next column starts */
  get cursor() {
    const last = this.columns[this.columns.length - 1];
    return last ? last.x + last.width / 2 : -this.world.halfWidth + MARGIN;
  }

  get rightEdge() {
    return this.world.halfWidth - MARGIN;
  }

  onKey(k) {
    const { world, sound, speech } = this;
    if (k.type === 'letter' || k.type === 'digit') {
      const up = k.type === 'letter' ? k.upper : k.char;
      const low = k.type === 'letter' ? k.lower : k.char;
      const width = (Math.max(glyphGeometry(up).width, glyphGeometry(low).width) + GAP) * SCALE;
      if (this.cursor + width > this.rightEdge) this.clearAll();
      const x = this.cursor + width / 2;
      const pair = world.spawnPair(up, low, {
        x,
        scale: SCALE,
        life: Infinity,
        idleEvery: [2.5, 4],
      });
      this.columns.push({ x, width, pair, char: low });
      sound.boing(up);
      speech.sayDebounced(letterName(up));
      return;
    }

    switch (k.code) {
      case 'Space':
        this.space();
        break;
      case 'Enter':
      case 'NumpadEnter':
        this.readAll();
        break;
      case 'Backspace':
        this.removeLast();
        break;
      case 'Escape':
      case 'Delete':
        this.clearAll();
        break;
      case 'ArrowLeft':
        world.push(-1);
        sound.whoop();
        break;
      case 'ArrowRight':
        world.push(1);
        sound.whoop();
        break;
      default: {
        // Any other key: a sparkle burst somewhere
        const x = (Math.random() * 2 - 1) * (world.halfWidth - 2);
        const last = this.columns.findLast((c) => c.pair);
        const colors = last ? [glyphColor(last.char), ...GOLD] : GOLD;
        world.fx.stars.emit(_v.set(x, 2 + Math.random() * 4, 1.5), { count: 26, speed: 6, up: 3, colors, life: 1.4 });
        sound.sparkle();
      }
    }
  }

  /** Word gap. The word just finished is read aloud and its letters do a little hop. */
  space() {
    const last = this.columns[this.columns.length - 1];
    if (!last || !last.pair) return; // no double spaces / leading space
    const width = SPACE * SCALE;
    if (this.cursor + width > this.rightEdge) {
      this.clearAll();
      return;
    }
    const word = this.lastWord();
    this.columns.push({ x: this.cursor + width / 2, width, pair: null, char: ' ' });
    word.forEach((c, i) => this.after(i * 0.08, () => c.pair.jump(7, 6)));
    this.say(word.map((c) => c.char).join(''));
    this.sound.sparkle();
  }

  /** Enter: everybody jumps, confetti, and the whole line is read aloud. */
  readAll() {
    const { world, sound } = this;
    world.everyoneJump();
    world.fx.confetti.emit(_v.set(0, 1, 1.5), { count: 90, speed: 9, up: 12, colors: RAINBOW, spread: 3, life: 2.4 });
    sound.whoop();
    const text = this.columns.map((c) => c.char).join('').trim();
    if (text) this.say(text);
  }

  removeLast() {
    const col = this.columns.pop();
    if (!col) return;
    col.pair?.leave();
  }

  /** Pop every letter, left to right. */
  clearAll() {
    const cols = this.columns.filter((c) => c.pair);
    this.columns = [];
    cols.forEach((c, i) => this.after(i * 0.05, () => c.pair.leave()));
  }

  lastWord() {
    const word = [];
    for (let i = this.columns.length - 1; i >= 0 && this.columns[i].pair; i--) word.unshift(this.columns[i]);
    return word;
  }

  /** Single letters are read by name ("hå"), longer runs as a word. */
  say(text) {
    if (!text) return;
    this.speech.say(text.length === 1 ? letterName(text) : text);
  }
}
