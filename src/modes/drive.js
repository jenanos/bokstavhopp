// Bokstavbil: drive down the alphabet road!
//
// The letters come in alphabet order, two at a time: one capital and one small,
// one red and one blue. Drive into a red letter to go faster, a blue one to go slower
// (or between them to keep the speed). ← → change lane, ↑ hops, Space honks.
// Along the way: ramps, stars, rainbows, sheep – and a finish line after Å.

import * as THREE from 'three';
import { Hopper } from '../hopper.js';
import { ALPHABET, lower, upper } from '../alphabet.js';
import { letterName } from '../audio.js';
import { RAINBOW, GOLD } from '../particles.js';
import { Car } from '../drive/car.js';
import { Puffs, SpeedLines } from '../drive/fx.js';
import { DriveHud } from '../drive/hud.js';
import {
  createTrack, createScenery, createPad, createRamp, createStar, createRainbow, createFinish,
  laneX, LANE_W, LANES, SPAWN_Z, DESPAWN_Z, FAST_COLOR, SLOW_COLOR,
} from '../drive/track.js';

const SPEEDS = [7, 10, 14, 19, 25]; // world units per second for each speed level
const START_LEVEL = 2;
const GATE_GAP = 44; // distance between two letters of the alphabet
const AFTER_FINISH_GAP = GATE_GAP * 2.6; // a quiet stretch to celebrate before A comes again
const LETTER_SCALE = 2.1;
const GRAVITY = -32;
const RAMP_LEN = 3.4;
const RAMP_VY = 13;
const INTRO = 2.6; // seconds of camera swoop before the start lights
const CAM = { y: 4.4, z: 9, lookY: 1.3, lookZ: -10 };
const LAP_PRAISE = ['Hurra! Du kjørte hele alfabetet!', 'Jippi! Hele alfabetet!', 'Kjempebra! Fra A til Å!'];

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const ease = (t) => t * t * (3 - 2 * t);

function letterMaterial(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4 });
}

export class DriveMode {
  constructor({ stage, world, sound, speech, hudEl }) {
    this.stage = stage;
    this.world = world;
    this.sound = sound;
    this.speech = speech;
    this.hud = new DriveHud(hudEl, SPEEDS.length);
    this.mats = { fast: letterMaterial(FAST_COLOR), slow: letterMaterial(SLOW_COLOR) };
    this.colors = {
      fast: [FAST_COLOR, '#ff9f1c', '#ffd60a', '#ffffff'].map((c) => new THREE.Color(c)),
      slow: [SLOW_COLOR, '#9ad8ff', '#5ec8ff', '#ffffff'].map((c) => new THREE.Color(c)),
    };
    this.root = null; // the 3D bits are built the first time the mode starts
    this.tasks = [];
  }

  #build() {
    this.root = new THREE.Group();
    this.track = createTrack(this.stage.renderer);
    this.root.add(this.track.group);
    this.car = new Car();
    this.root.add(this.car.group);
    this.dyn = new THREE.Group(); // everything that scrolls past
    this.root.add(this.dyn);
    this.puffs = new Puffs(this.root);
    this.lines = new SpeedLines(this.root);
  }

  start() {
    if (!this.root) this.#build();
    const { stage, hud } = this;
    stage.setView('drive');
    stage.scene.add(this.root);
    stage.scene.fog.near = 45;
    stage.scene.fog.far = 140;
    stage.camera.far = 400;

    this.dyn.clear();
    this.things = [];
    this.flyers = [];
    this.tasks = [];
    this.puffs.clear();
    this.t = 0;
    this.distance = 0;
    this.state = 'intro';
    this.introT = 0;
    this.level = START_LEVEL;
    this.speed = 0;
    this.lane = 0;
    this.carX = 0;
    this.carVx = 0;
    this.carY = 0;
    this.carVy = 0;
    this.roll = 0;
    this.rollLeft = 0;
    this.rollDir = 1;
    this.boost = 0;
    this.slow = 0;
    this.squash = 0;
    this.squashV = 0;
    this.bumpX = 0;
    this.fovKick = 0;
    this.puffIn = 0;
    this.starCount = 0;
    this.lapCount = 0;

    // Planned positions of the next things to appear. They move towards us with the road.
    this.spawnIdx = 0; // alphabet index of the next gate (ALPHABET.length = the finish line)
    this.nextGateZ = -50;
    this.nextSceneryZ = [DESPAWN_Z - 2, DESPAWN_Z - 4];
    this.#spawnAhead();

    hud.resetStrip();
    hud.current(0);
    hud.speed(this.level);
    hud.stars(0);
    hud.laps(0);
    hud.show();
    this.sound.engineStart();

    // Intro: the camera swoops around the car, a short explanation, then the start lights.
    this.after(0.4, () => this.speech.say('Rød bokstav går fortere. Blå bokstav går saktere.'));
    [1, 2, 3].forEach((n, i) =>
      this.after(INTRO + 0.4 + i * 0.8, () => {
        this.state = 'countdown';
        hud.lights(n);
        this.sound.beep();
      }),
    );
    this.after(INTRO + 2.8, () => {
      hud.lights('go');
      this.sound.beep(true);
      this.speech.say('Kjør!');
      this.state = 'driving';
      this.boost = 0.6;
    });
    this.after(INTRO + 3.8, () => hud.lights(null));
  }

  stop() {
    this.tasks = [];
    this.sound.engineStop();
    this.hud.hide();
    if (this.root) {
      this.dyn.clear();
      for (const f of this.flyers) this.root.remove(f.carrier);
      this.flyers = [];
      this.things = [];
      this.puffs.clear();
      this.stage.scene.remove(this.root);
    }
    this.stage.setView('meadow');
  }

  after(sec, fn) {
    this.tasks.push({ t: sec, fn });
  }

  // ---------- spawning ----------

  #spawnAhead() {
    while (this.nextGateZ > SPAWN_Z) {
      const z = this.nextGateZ;
      if (this.spawnIdx < ALPHABET.length) {
        this.#spawnGate(z, this.spawnIdx);
        this.#spawnExtras(z - GATE_GAP / 2, this.spawnIdx);
        this.spawnIdx++;
        this.nextGateZ -= GATE_GAP;
      } else {
        this.#add('finish', createFinish(), z);
        this.spawnIdx = 0;
        this.nextGateZ -= AFTER_FINISH_GAP;
      }
    }
    for (let s = 0; s < 2; s++) {
      while (this.nextSceneryZ[s] > SPAWN_Z) {
        this.#add('scenery', createScenery(s ? 1 : -1), this.nextSceneryZ[s]);
        this.nextSceneryZ[s] -= rand(3, 8);
      }
    }
  }

  #add(kind, group, z, extra = {}) {
    group.position.z = z;
    this.dyn.add(group);
    const th = { kind, group, ...extra };
    this.things.push(th);
    return th;
  }

  /** One letter of the alphabet: a capital and a small one, one red and one blue, in two lanes. */
  #spawnGate(z, idx) {
    const g = new THREE.Group();
    const lanes = [...LANES].sort(() => Math.random() - 0.5).slice(0, 2);
    const kinds = Math.random() < 0.5 ? ['fast', 'slow'] : ['slow', 'fast'];
    const U = ALPHABET[idx];
    const chars = Math.random() < 0.5 ? [U, lower(U)] : [lower(U), U];
    const letters = lanes.map((lane, i) => {
      const kind = kinds[i];
      const pad = createPad(kind === 'fast');
      pad.position.x = laneX(lane);
      g.add(pad);
      const carrier = new THREE.Group();
      carrier.position.x = laneX(lane);
      const hopper = new Hopper([chars[i]], {
        scale: LETTER_SCALE,
        life: Infinity,
        idleHops: true,
        idleEvery: [0.6, 1.1],
        home: { x: 0, z: 0 },
        material: this.mats[kind],
        bound: 50,
        jump: 8,
      });
      carrier.add(hopper.group);
      g.add(carrier);
      return { hopper, carrier, lane, kind, char: chars[i] };
    });
    this.#add('gate', g, z, { letters, idx, passed: false, excited: false });
  }

  /** Something fun between two letters: stars, a ramp, a ramp with stars in the air, a rainbow. */
  #spawnExtras(z, idx) {
    if (idx % 7 === 3) this.#add('scenery', createRainbow(), z - 6);
    const lane = pick(LANES);
    const r = Math.random();
    if (r < 0.32) {
      for (let k = 0; k < 3; k++) this.#add('star', createStar(), z + 4 - k * 4, { lane, y: 1.2 });
    } else if (r < 0.55) {
      this.#add('ramp', createRamp(), z, { lane });
    } else if (r < 0.75) {
      // A ramp with a trail of stars up in the air that you only get by jumping.
      this.#add('ramp', createRamp(), z + 6, { lane });
      const sp = SPEEDS[this.level];
      for (const t of [0.22, 0.4, 0.58]) {
        const s = createStar(); // the star itself bobs at y = 1.2 inside its group
        s.position.y = 3.4;
        this.#add('star', s, z + 6 - RAMP_LEN / 2 - sp * t, { lane, y: 3.4 + 1.2 });
      }
    }
  }

  // ---------- input ----------

  onKey(k) {
    const { sound } = this;
    if (k.type === 'letter') {
      sound.hornNote(k.upper);
      this.squashV += 2;
      const next = this.#upcomingGate();
      if (next && ALPHABET[next.idx] === k.upper) {
        // Pressing the letter that is coming up makes it jump and wave.
        for (const l of next.letters) { l.hopper.jump(11); l.hopper.wiggle(0.5); }
        this.speech.say(letterName(k.upper));
      } else {
        this.speech.sayDebounced(letterName(k.upper));
      }
      return;
    }
    if (k.type === 'digit') {
      sound.hornNote(k.char);
      this.#sparkleAtCar(GOLD);
      return;
    }
    switch (k.code) {
      case 'ArrowLeft': this.#steer(-1); break;
      case 'ArrowRight': this.#steer(1); break;
      case 'ArrowUp': this.#hop(); break;
      case 'ArrowDown':
      case 'Space':
      case 'Enter':
      case 'NumpadEnter':
        this.#honk();
        break;
      default:
        this.#sparkleAtCar(RAINBOW);
        sound.sparkle();
    }
  }

  #steer(d) {
    const lane = this.lane + d;
    if (lane < -1 || lane > 1) {
      // Bump softly into the kerb and bounce back.
      this.bumpX = d * 0.7;
      this.squashV += 4;
      this.sound.bump();
      return;
    }
    this.lane = lane;
    this.sound.pop();
  }

  #hop() {
    if (this.carY > 0.05) return;
    this.carVy = 8.5;
    this.squashV -= 5;
    this.sound.whoop();
  }

  #honk() {
    this.sound.horn();
    this.squashV += 5;
    // Every letter in sight jumps when you honk.
    for (const th of this.things) {
      if (th.kind !== 'gate' || th.group.position.z < -70) continue;
      for (const l of th.letters) { l.hopper.jump(rand(8, 11)); l.hopper.wiggle(0.4); }
    }
  }

  #upcomingGate() {
    let best = null;
    for (const th of this.things) {
      if (th.kind === 'gate' && !th.passed && (!best || th.group.position.z > best.group.position.z)) best = th;
    }
    return best;
  }

  #carLane() {
    return THREE.MathUtils.clamp(Math.round(this.carX / LANE_W), -1, 1);
  }

  #sparkleAtCar(colors, count = 20) {
    _dir.set(0, 0, this.speed * 0.6);
    this.world.fx.stars.emit(_v.set(this.carX, this.carY + 1.8, 0), { count, speed: 5, up: 4, colors, size: 0.8, life: 1, dir: _dir });
  }

  // ---------- what happens on the road ----------

  #passGate(th) {
    th.passed = true;
    const lane = this.#carLane();
    const hit = th.letters.find((l) => l.lane === lane);
    for (const l of th.letters) if (l !== hit) l.hopper.wiggle(0.6); // wave goodbye
    if (hit) this.#collect(th, hit);
    else this.hud.mark(th.idx, null, null);
    this.hud.current(th.idx + 1 < ALPHABET.length ? th.idx + 1 : null);
  }

  #collect(th, l) {
    const fast = l.kind === 'fast';
    this.level = THREE.MathUtils.clamp(this.level + (fast ? 1 : -1), 0, SPEEDS.length - 1);
    this.hud.speed(this.level, true);
    this.hud.mark(th.idx, l.char, l.kind);
    this.speech.say(letterName(upper(l.char)));

    // The letter leaps up ahead of the car and pops in a burst of its colour.
    const wp = l.carrier.getWorldPosition(new THREE.Vector3());
    th.letters = th.letters.filter((x) => x !== l);
    l.carrier.position.copy(wp);
    this.root.add(l.carrier);
    l.hopper.jump(15, rand(-2, 2));
    l.hopper.wiggle(0.6);
    l.flyT = 0.4;
    this.flyers.push(l);

    const colors = this.colors[l.kind];
    _dir.set(0, 0, this.speed * 0.7);
    this.world.fx.confetti.emit(_v.set(wp.x, 1.5, 0), { count: 60, speed: 8, up: 6, colors, spread: 0.8, life: 1.6, dir: _dir });
    this.world.fx.stars.emit(_v.set(wp.x, 1, 0), { count: 16, speed: 6, up: 5, colors: GOLD, life: 1.2, dir: _dir });

    if (fast) {
      this.boost = 1;
      this.fovKick = 1;
      this.carVy = Math.max(this.carVy, 4); // a little wheelie-hop
      this.sound.speedUp();
    } else {
      this.slow = 1;
      this.squashV -= 7;
      this.sound.slowDown();
      for (let i = 0; i < 8; i++) {
        this.puffs.emit(_v.set(this.carX + rand(-1, 1), 0.4, rand(-1.5, 1.5)), { vz: this.speed * 0.4, size: 0.45, life: 0.8 });
      }
    }
  }

  #launch() {
    this.carY = 1;
    this.carVy = RAMP_VY;
    this.rollLeft = Math.PI * 2;
    this.rollDir = Math.random() < 0.5 ? -1 : 1;
    this.sound.wheee();
    this.#sparkleAtCar(RAINBOW, 30);
  }

  #collectStar(th) {
    th.group.visible = false;
    this.starCount++;
    this.hud.stars(this.starCount);
    this.sound.coin();
    _dir.set(0, 0, this.speed * 0.6);
    this.world.fx.stars.emit(_v.set(laneX(th.lane), th.y, 0), { count: 14, speed: 5, up: 3, colors: GOLD, size: 0.7, life: 0.9, dir: _dir });
  }

  #finishLap() {
    const { hud, world } = this;
    this.lapCount++;
    hud.laps(this.lapCount);
    hud.current(null);
    hud.banner('🏆 Hurra! 🏆');
    this.sound.fanfare();
    this.speech.say(pick(LAP_PRAISE));
    this.carVy = 10;
    this.rollLeft = Math.PI * 2;
    this.rollDir = 1;
    for (let i = 0; i < 9; i++) {
      this.after(i * 0.22, () => {
        _dir.set(0, 0, this.speed * 0.7);
        world.fx.confetti.emit(_v.set(rand(-7, 7), rand(6, 9), -6), { count: 70, speed: 6, up: 2, colors: RAINBOW, spread: 2, life: 2.6, dir: _dir });
        if (i % 3 === 0) this.sound.sparkle();
      });
    }
    this.after(2.4, () => {
      hud.banner(null);
      hud.resetStrip();
      hud.current(0);
    });
  }

  // ---------- per frame ----------

  update(dt) {
    this.t += dt;
    this.#runTasks(dt);

    // Speed: constant per level, plus a burst after red and a dip after blue.
    const driving = this.state === 'driving';
    const target = driving ? Math.max(4, SPEEDS[this.level] + this.boost * 9 - this.slow * 4) : 0;
    this.speed += (target - this.speed) * (1 - Math.exp(-(driving ? 1.8 : 4) * dt));
    this.boost = Math.max(0, this.boost - dt * 0.7);
    this.slow = Math.max(0, this.slow - dt * 0.8);
    const dz = this.speed * dt;
    this.distance += dz;
    this.nextGateZ += dz;
    this.nextSceneryZ[0] += dz;
    this.nextSceneryZ[1] += dz;
    this.track.scroll(this.distance);
    if (!this.sound.engine) this.sound.engineStart(); // the audio context may only just have woken up
    this.sound.engineSpeed(this.speed / 30);

    this.#updateCar(dt);
    this.#updateThings(dt, dz);
    this.#updateFlyers(dt);
    this.#spawnAhead();

    this.puffs.update(dt);
    this.lines.update(dt, this.speed, Math.max(THREE.MathUtils.clamp((this.speed - 16) / 10, 0, 1), this.boost));
    this.#updateCamera(dt);
  }

  #runTasks(dt) {
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

  #updateCar(dt) {
    // Steering: glide towards the lane (plus a little bounce off the kerb)
    const prev = this.carX;
    this.carX += (laneX(this.lane) + this.bumpX - this.carX) * (1 - Math.exp(-9 * dt));
    this.carVx = (this.carX - prev) / Math.max(dt, 1e-4);
    this.bumpX *= Math.exp(-9 * dt);

    // Jumping
    const wasAir = this.carY > 0.01;
    if (this.carY > 0 || this.carVy > 0) {
      this.carVy += GRAVITY * dt;
      this.carY += this.carVy * dt;
      if (this.carY <= 0) {
        if (wasAir && this.carVy < -7) {
          this.squashV -= Math.min(12, -this.carVy * 0.6);
          this.sound.thud(1);
          for (let i = 0; i < 6; i++) {
            this.puffs.emit(_v.set(this.carX + rand(-1.2, 1.2), 0.2, rand(-1.5, 1.5)), { vz: this.speed * 0.5, size: 0.4, life: 0.6 });
          }
        }
        this.carY = 0;
        this.carVy = 0;
      }
    }
    // Barrel roll
    if (this.rollLeft > 0) {
      const step = Math.min(this.rollLeft, dt * Math.PI * 2.7);
      this.rollLeft -= step;
      this.roll += step * this.rollDir;
      if (this.rollLeft <= 0) this.roll = 0;
    }
    // Squash spring
    this.squashV += (-this.squash * 200 - this.squashV * 12) * dt;
    this.squash = THREE.MathUtils.clamp(this.squash + this.squashV * dt, -0.3, 0.3);

    this.car.group.position.set(this.carX, this.carY, 0);
    this.car.update(dt, {
      speed: this.speed, vx: this.carVx, roll: this.roll, boost: this.boost, squash: this.squash, airborne: this.carY > 0.05,
    });

    // Exhaust puffs: more and bigger when going fast or boosting.
    this.puffIn -= dt;
    if (this.puffIn <= 0) {
      const sp = this.speed / 25;
      this.puffIn = 0.14 - sp * 0.07 - this.boost * 0.04;
      const e = this.car.exhaust;
      this.puffs.emit(_v.set(this.carX + e.x, this.carY + e.y, e.z), {
        vz: 1.5 + this.speed * 0.5, size: 0.22 + this.boost * 0.2, life: 0.5 + sp * 0.2,
      });
    }
  }

  #updateThings(dt, dz) {
    const carLane = this.#carLane();
    for (let i = this.things.length - 1; i >= 0; i--) {
      const th = this.things[i];
      const g = th.group;
      g.position.z += dz;
      const z = g.position.z;
      g.userData.update?.(this.t, dt);

      switch (th.kind) {
        case 'gate':
          for (const l of th.letters) l.hopper.update(dt);
          if (!th.excited && z > -18) {
            th.excited = true;
            for (const l of th.letters) { l.hopper.jump(rand(9, 11)); l.hopper.wiggle(0.3); }
          }
          if (!th.passed && z >= -0.3) this.#passGate(th);
          // Letters we drove past pop away before they get in front of the camera.
          if (th.passed && !th.popped && z > 1.5) {
            th.popped = true;
            for (const l of th.letters) {
              l.hopper.leave();
              _dir.set(0, 0, this.speed * 0.5);
              this.world.fx.stars.emit(_v.set(laneX(l.lane), 1.2, z), { count: 10, speed: 4, up: 3, colors: this.colors[l.kind], size: 0.6, life: 0.8, dir: _dir });
            }
          }
          break;
        case 'ramp': {
          // Drive up the ramp, then fly off the top.
          const u = (z + RAMP_LEN / 2) / RAMP_LEN; // 0 at the low end, 1 at the top
          if (!th.done && u >= 0 && carLane === th.lane && this.carY < 1.2 && this.rollLeft <= 0) {
            if (u >= 1) {
              th.done = true;
              this.#launch();
            } else {
              this.carY = Math.pow(u, 1.6);
              this.carVy = 0;
            }
          }
          if (u > 1.2) th.done = true;
          break;
        }
        case 'star':
          if (!th.done && z >= -0.4) {
            th.done = true;
            if (carLane === th.lane && Math.abs(this.carY + 0.9 - th.y) < 1.6) this.#collectStar(th);
          }
          break;
        case 'finish':
          if (!th.done && z >= 0) {
            th.done = true;
            this.#finishLap();
          }
          break;
      }

      if (z > DESPAWN_Z) {
        this.dyn.remove(g);
        this.things.splice(i, 1);
      }
    }
  }

  #updateFlyers(dt) {
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.hopper.update(dt);
      f.carrier.position.z -= 5 * dt; // fly on ahead of the car, out of the camera's way
      f.flyT -= dt;
      if (f.flyT <= 0) f.hopper.leave();
      if (f.hopper.dead) {
        const p = f.carrier.position;
        _dir.set(0, 0, this.speed * 0.7);
        this.world.fx.confetti.emit(_v.set(p.x, p.y + f.hopper.pos.y + 1, p.z), {
          count: 40, speed: 7, up: 3, colors: this.colors[f.kind], spread: 0.6, life: 1.4, dir: _dir,
        });
        this.sound.pop();
        this.root.remove(f.carrier);
        this.flyers.splice(i, 1);
      }
    }
  }

  #updateCamera(dt) {
    const cam = this.stage.camera;
    const sp = this.speed / 25;
    const x = this.carX * 0.55;
    let k = 1;
    if (this.introT < INTRO) {
      this.introT += dt;
      k = ease(Math.min(1, this.introT / INTRO));
    }
    // Swoop from the front of the car (to see the driver's face) round to behind it.
    const a = Math.PI * 0.85 * (1 - k);
    const r = THREE.MathUtils.lerp(7, CAM.z - sp * 0.8, k);
    const h = THREE.MathUtils.lerp(2.6, CAM.y + this.carY * 0.35, k);
    cam.position.set(x * k + Math.sin(a) * r, h, Math.cos(a) * r);
    _look.set(x * 0.8 * k, THREE.MathUtils.lerp(1.4, CAM.lookY + this.carY * 0.3, k), THREE.MathUtils.lerp(0, CAM.lookZ, k));
    // A tiny rumble at top speed
    if (sp > 0.7) _look.y += Math.sin(this.t * 37) * 0.02 * sp;
    cam.lookAt(_look);

    // Keep the whole road in view on narrow screens; widen the view with speed.
    this.fovKick *= Math.exp(-2.5 * dt);
    const fovForWidth = THREE.MathUtils.radToDeg(2 * Math.atan(0.74 / cam.aspect));
    cam.fov = THREE.MathUtils.clamp(fovForWidth, 56, 95) + sp * 9 + this.fovKick * 8;
    cam.updateProjectionMatrix();
  }
}
