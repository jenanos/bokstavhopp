// Øving: a big "Bb" appears – find the B on the keyboard!
// Wrong keys are never punished: the child just sees (and hears) what they pressed.

import * as THREE from 'three';
import { glyphColor } from '../hopper.js';
import { letterName } from '../audio.js';
import { lower } from '../alphabet.js';
import { RAINBOW, GOLD } from '../particles.js';

const PRAISE = ['Bra!', 'Hurra!', 'Supert!', 'Så flink!', 'Jippi!', 'Kjempebra!', 'Du fant den!'];
const HINT_AFTER = 7; // seconds before the keyboard hint appears
const REPROMPT_EVERY = 10; // seconds between gentle reminders
const _v = new THREE.Vector3();

export class PracticeMode {
  constructor({ world, sound, speech, hint, stars }) {
    this.world = world;
    this.sound = sound;
    this.speech = speech;
    this.hint = hint;
    this.stars = stars;
    this.letters = [];
    this.tasks = [];
  }

  setLetters(letters) {
    this.letters = letters;
  }

  start() {
    this.tasks = [];
    this.target = null;
    this.last = null;
    this.stars.reset();
    this.stars.show();
    this.next(0.3);
  }

  stop() {
    this.tasks = [];
    this.target = null;
    this.hint.hide();
    this.stars.hide();
  }

  after(sec, fn) {
    this.tasks.push({ t: sec, fn });
  }

  next(delay = 0) {
    this.state = 'between';
    this.after(delay, () => {
      let pick;
      do {
        pick = this.letters[(Math.random() * this.letters.length) | 0];
      } while (pick === this.last && this.letters.length > 1);
      this.last = pick;
      this.letter = pick;
      this.wrongs = 0;
      this.waitT = 0;
      this.nextPrompt = REPROMPT_EVERY;
      this.hint.hide();
      // Capital on the cloud shelf, small letter on the grass – same column, same moment.
      this.target = this.world.spawnPair(pick, lower(pick), {
        x: 0,
        scale: 3.2,
        life: Infinity,
        idleHops: true,
        lower: { jump: 8 }, // small hop so it doesn't bump into the cloud
      });
      this.state = 'waiting';
      this.after(0.7, () => this.prompt());
    });
  }

  prompt() {
    if (this.state !== 'waiting') return;
    this.speech.say(`Hvor er ${letterName(this.letter)}?`);
  }

  onKey(k) {
    const { world, sound, speech } = this;
    if (k.type !== 'letter' && k.type !== 'digit') {
      // Other keys are not "wrong" – just a little sparkle.
      world.fx.stars.emit(_v.set((Math.random() * 2 - 1) * 6, 5, 1), { count: 8, speed: 3, up: 2, colors: GOLD, size: 0.7 });
      sound.sparkle();
      return;
    }

    if (this.state === 'waiting' && k.type === 'letter' && k.upper === this.letter) {
      this.celebrate();
      return;
    }

    // Show what was pressed, small, off to the side.
    const chars = k.type === 'letter' ? [k.upper, k.lower] : [k.char, k.char];
    const side = Math.random() < 0.5 ? -1 : 1;
    world.spawnPair(chars[0], chars[1], {
      x: side * world.halfWidth * (0.55 + Math.random() * 0.2),
      scale: 1.5,
      life: 0.9,
      idleHops: false,
      burst: false,
      upper: { jump: 7 },
      lower: { jump: 9 },
    });
    world.limit(8, this.target?.both);

    if (this.state === 'waiting') {
      sound.oops();
      speech.say(letterName(chars[0]));
      this.target?.shake(0.4);
      this.target?.jump(6, 5);
      this.wrongs++;
      if (this.wrongs >= 2) this.hint.show(this.letter);
    } else {
      sound.boing(chars[0]);
    }
  }

  celebrate() {
    const { world, sound, speech, target } = this;
    this.state = 'celebrating';
    this.hint.hide();
    target.idleHops = false;
    // The capital jumps high into the sky; the small one less, so it doesn't hit the cloud.
    target.jump(14, 6);
    target.wiggle(0.5);
    const colors = [glyphColor(this.letter), ...RAINBOW];
    world.fx.confetti.emit(_v.set(target.x, 6, 1), { count: 110, speed: 11, up: 9, colors, spread: 1.5, life: 2.6 });
    world.fx.confetti.emit(_v.set(target.x, 1, 1), { count: 60, speed: 9, up: 7, colors, spread: 1.5, life: 2.2 });
    world.fx.stars.emit(_v.set(target.x, 1, 1), { count: 40, speed: 8, up: 8, colors: GOLD, life: 1.8 });
    sound.success();
    speech.say(`${letterName(this.letter)}! ${PRAISE[(Math.random() * PRAISE.length) | 0]}`);

    const trophy = this.stars.add();
    let wait = 1.9;
    if (trophy) {
      wait = 3.4;
      this.after(0.6, () => this.party());
    }
    this.after(wait, () => target.leave());
    this.next(wait + 0.6);
  }

  /** Every 10 stars: a big party with confetti rain. */
  party() {
    const { world, sound, speech } = this;
    sound.fanfare();
    speech.say('Du har fått en pokal! Hurra!');
    world.everyoneJump(14);
    for (let i = 0; i < 6; i++) {
      this.after(i * 0.25, () => {
        const x = (Math.random() * 2 - 1) * (world.halfWidth - 2);
        world.fx.confetti.emit(_v.set(x, 13, 0), { count: 80, speed: 4, up: 0, colors: RAINBOW, spread: 3, life: 3.2 });
      });
    }
  }

  update(dt) {
    // Run scheduled tasks (copy first: tasks may schedule new tasks)
    const due = [];
    for (const task of this.tasks) {
      task.t -= dt;
      if (task.t <= 0) due.push(task);
    }
    if (due.length) {
      this.tasks = this.tasks.filter((t) => t.t > 0);
      for (const task of due) task.fn();
    }

    if (this.state === 'waiting') {
      this.waitT += dt;
      if (this.waitT > HINT_AFTER) this.hint.show(this.letter);
      if (this.waitT > this.nextPrompt) {
        this.nextPrompt += REPROMPT_EVERY;
        this.target.jump(10, 7);
        this.target.wiggle(0.4);
        this.prompt();
      }
    }
  }
}
