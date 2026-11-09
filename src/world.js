// Owns everything that lives in the 3D scene: hoppers and particle effects.

import * as THREE from 'three';
import { Hopper, glyphColor } from './hopper.js';
import { createEffects, GOLD } from './particles.js';
import { ROWS } from './scene.js';

const _v = new THREE.Vector3();

export class World {
  constructor(stage, sound) {
    this.stage = stage;
    this.scene = stage.scene;
    this.sound = sound;
    this.hoppers = [];
    this.fx = createEffects(this.scene);
  }

  get halfWidth() {
    return this.stage.bounds.halfWidth;
  }

  /**
   * Spawn a hopper.
   * @param {string[]} chars
   * @param {object} o options passed to Hopper (+ `quiet` to skip sounds, `burst` to skip sparkles)
   */
  spawn(chars, o = {}) {
    const h = new Hopper(chars, {
      bound: this.halfWidth - 0.5,
      ...o,
      onLand: (hp, impact) => {
        if (!o.quiet) this.sound.thud(impact / 14);
        if (impact > 6) {
          this.fx.stars.emit(_v.set(hp.pos.x, hp.floorY + 0.1, hp.pos.z), {
            count: 4, speed: 2.5, up: 1.5, colors: [glyphColor(chars[0])], size: 0.6, life: 0.7,
          });
        }
        o.onLand?.(hp, impact);
      },
      onPop: (hp) => {
        if (!o.quiet) this.sound.pop();
        this.fx.confetti.emit(_v.set(hp.pos.x, hp.pos.y + hp.height * 0.4, hp.pos.z), {
          count: 18, speed: 4, up: 2, colors: chars.map(glyphColor), size: 0.8, life: 1.1,
        });
        o.onPop?.(hp);
      },
    });
    this.scene.add(h.group);
    this.hoppers.push(h);
    if (o.burst !== false && o.from !== 'sky') {
      this.fx.stars.emit(_v.set(h.pos.x, h.floorY + 0.2, h.pos.z), {
        count: 12, speed: 5, up: 5, colors: [glyphColor(chars[0]), ...GOLD], size: 0.9, life: 1.2,
      });
    }
    return h;
  }

  /**
   * Spawn a capital letter on the cloud shelf and its small letter on the grass,
   * in the same column and at the same moment. Digits get the same digit in both rows.
   * @param {string} up e.g. 'K'
   * @param {string} low e.g. 'k'
   * @param {object} o shared Hopper options; `x` is the column, `upper`/`lower` override per row
   */
  spawnPair(up, low, o = {}) {
    const { upper: oU = {}, lower: oL = {}, ...shared } = o;
    const x = shared.x ?? 0;
    const z = shared.z ?? ROWS.z;
    const home = shared.home === false ? null : { x, z };
    const u = this.spawn([up], {
      jump: 9 + Math.random() * 2, ...shared, home, z, floorY: ROWS.upperY, ...oU,
    });
    const l = this.spawn([low], {
      jump: 10 + Math.random() * 2, ...shared, home, z, floorY: ROWS.lowerY, ...oL,
    });
    if (o.burst !== false) {
      // A short sparkle trail between the two, so it's clear they belong together
      const colors = [glyphColor(up), ...GOLD];
      for (let y = ROWS.lowerY + 0.8; y < ROWS.upperY - 0.6; y += 0.7) {
        this.fx.stars.emit(_v.set(x, y, z + 0.6), { count: 2, speed: 0.6, up: 0.4, colors, size: 0.45, life: 0.9, spread: 0.15 });
      }
    }
    return new Pair(u, l);
  }

  /** Make the oldest hoppers leave when there are too many. */
  limit(max, keep = []) {
    const alive = this.hoppers.filter((h) => !h.leaving && !keep.includes(h));
    for (let i = 0; i < alive.length - max; i++) alive[i].leave();
  }

  everyoneJump(power = 11) {
    for (const h of this.hoppers) {
      if (h.leaving) continue;
      if (h.pos.y - h.floorY < 1.5) h.jump(power + Math.random() * 3, (Math.random() - 0.5) * 3);
      h.wiggle(0.3);
    }
  }

  push(dir) {
    for (const h of this.hoppers) {
      if (h.leaving) continue;
      h.jump(5 + Math.random() * 2, dir * (7 + Math.random() * 3));
      h.wiggle(0.25);
    }
  }

  clear() {
    for (const h of this.hoppers) this.scene.remove(h.group);
    this.hoppers = [];
    this.fx.clear();
  }

  update(dt) {
    for (const h of this.hoppers) {
      h.bound = this.halfWidth - 0.5;
      h.update(dt);
    }
    for (let i = this.hoppers.length - 1; i >= 0; i--) {
      if (this.hoppers[i].dead) {
        this.scene.remove(this.hoppers[i].group);
        this.hoppers.splice(i, 1);
      }
    }
    this.fx.update(dt);
  }
}

/** A capital + small letter that belong together, even though they stand in different rows. */
export class Pair {
  constructor(upper, lower) {
    this.upper = upper;
    this.lower = lower;
    this.both = [upper, lower];
  }
  get onGround() { return this.both.every((h) => h.onGround); }
  get leaving() { return this.upper.leaving; }
  get x() { return this.lower.home?.x ?? this.lower.pos.x; }
  set idleHops(v) { for (const h of this.both) h.idleHops = v; }
  jump(vUpper, vLower = vUpper) { this.upper.jump(vUpper); this.lower.jump(vLower); }
  wiggle(a) { for (const h of this.both) h.wiggle(a); }
  shake(a) { for (const h of this.both) h.shake(a); }
  leave() { for (const h of this.both) h.leave(); }
}
