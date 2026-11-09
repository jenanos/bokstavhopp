// 3D letter characters ("hoppers") with googly eyes and bouncy physics.
// A Hopper holds one or more glyphs that always move together –
// for letters that is the big and the small one, side by side: "Aa".

import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { charHue } from './alphabet.js';

const GRAVITY = -30;
const GLYPH_GAP = 0.16; // space between "A" and "a", in glyph units

let font = null;
const geoCache = new Map();
const matCache = new Map();

const eyeWhiteGeo = new THREE.SphereGeometry(1, 20, 14);
const pupilGeo = new THREE.SphereGeometry(1, 16, 12);
const shineGeo = new THREE.SphereGeometry(1, 8, 6);
const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
const pupilMat = new THREE.MeshStandardMaterial({ color: '#141821', roughness: 0.15 });
const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

export async function loadFont(url) {
  font = await new FontLoader().loadAsync(url);
  return font;
}

/** Build (and cache) the extruded geometry for one character, pivot at bottom-centre. */
export function glyphGeometry(ch) {
  let entry = geoCache.get(ch);
  if (entry) return entry;
  const geo = new TextGeometry(ch, {
    font,
    size: 1,
    depth: 0.32,
    curveSegments: 7,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.035,
    bevelSegments: 4,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.computeBoundingBox();
  geo.computeVertexNormals();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  entry = { geo, width: size.x, height: size.y, front: geo.boundingBox.max.z };
  geoCache.set(ch, entry);
  return entry;
}

export function prewarm(chars) {
  for (const ch of chars) glyphGeometry(ch);
}

export function glyphMaterial(ch) {
  const hue = charHue(ch);
  const key = hue.toFixed(3);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setHSL(hue, 0.9, 0.52, THREE.SRGBColorSpace),
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.4,
    });
    matCache.set(key, m);
  }
  return m;
}

export function glyphColor(ch) {
  return glyphMaterial(ch).color;
}

function makeEyes(info) {
  const eyes = new THREE.Group();
  const r = THREE.MathUtils.clamp(Math.min(info.width, info.height) * 0.2, 0.075, 0.12);
  const pupils = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const white = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    white.scale.set(r, r * 1.12, r * 0.7);
    white.castShadow = true;
    eye.add(white);
    const pupil = new THREE.Group();
    const p = new THREE.Mesh(pupilGeo, pupilMat);
    p.scale.set(r * 0.52, r * 0.58, r * 0.4);
    pupil.add(p);
    const shine = new THREE.Mesh(shineGeo, shineMat);
    shine.scale.setScalar(r * 0.16);
    shine.position.set(r * 0.18, r * 0.22, r * 0.36);
    pupil.add(shine);
    pupil.position.z = r * 0.5;
    eye.add(pupil);
    eye.position.x = side * r * 1.08;
    eyes.add(eye);
    pupils.push(pupil);
  }
  eyes.position.set(0, info.height * 0.7, info.front + r * 0.15);
  return { eyes, pupils, radius: r };
}

/** One character mesh with eyes, inside a squash group pivoting at its feet. */
class Glyph {
  constructor(ch) {
    const info = glyphGeometry(ch);
    this.info = info;
    this.root = new THREE.Group(); // positioned within the hopper
    this.squash = new THREE.Group(); // scaled for squash & stretch
    this.root.add(this.squash);
    const mesh = new THREE.Mesh(info.geo, glyphMaterial(ch));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.squash.add(mesh);
    const { eyes, pupils, radius } = makeEyes(info);
    this.eyes = eyes;
    this.pupils = pupils;
    this.eyeR = radius;
    this.squash.add(eyes);
    this.blinkIn = 1 + Math.random() * 3;
    this.blinkT = 0;
    this.look = new THREE.Vector2();
    this.lookTarget = new THREE.Vector2();
    this.lookIn = Math.random() * 2;
  }

  update(dt) {
    // Blink
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.14;
      this.blinkIn = 1.8 + Math.random() * 3.5;
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      this.eyes.scale.y = 0.12;
    } else {
      this.eyes.scale.y = 1;
    }
    // Wandering gaze
    this.lookIn -= dt;
    if (this.lookIn <= 0) {
      this.lookIn = 0.6 + Math.random() * 1.8;
      const a = Math.random() * Math.PI * 2;
      const m = Math.random() < 0.4 ? 0 : 0.32;
      this.lookTarget.set(Math.cos(a) * m, Math.sin(a) * m);
    }
    this.look.lerp(this.lookTarget, 1 - Math.exp(-12 * dt));
    for (const p of this.pupils) {
      p.position.x = this.look.x * this.eyeR;
      p.position.y = this.look.y * this.eyeR;
    }
  }
}

const easeOutBack = (t) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export class Hopper {
  /**
   * @param {string[]} chars e.g. ['A', 'a'] or ['7']
   * @param {object} o
   */
  constructor(chars, o = {}) {
    this.chars = chars;
    this.scale = o.scale ?? 2.4;
    this.life = o.life ?? 5; // seconds on the ground before popping (Infinity = stay)
    this.idleHops = o.idleHops ?? true;
    this.bound = o.bound ?? 12;
    this.floorY = o.floorY ?? 0; // 0 = the grass; >0 = standing on the cloud shelf
    this.home = o.home ?? null; // {x, z}: a slot in the word row it always returns to
    this.idleEvery = o.idleEvery ?? [1.3, 2.2]; // [min, random extra] seconds between idle hops
    this.onLand = o.onLand;
    this.onPop = o.onPop;

    this.group = new THREE.Group();
    this.glyphs = chars.map((c) => new Glyph(c));
    const widths = this.glyphs.map((g) => g.info.width);
    const total = widths.reduce((a, b) => a + b, 0) + GLYPH_GAP * (widths.length - 1);
    let x = -total / 2;
    this.glyphs.forEach((g, i) => {
      g.root.position.x = x + widths[i] / 2;
      x += widths[i] + GLYPH_GAP;
      this.group.add(g.root);
    });
    this.width = total * this.scale;
    this.height = Math.max(...this.glyphs.map((g) => g.info.height)) * this.scale;

    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.groundTime = 0;
    this.age = 0;
    this.squashA = 0; // >0 stretch, <0 squash
    this.squashV = 0;
    this.wiggleAmp = 0;
    this.wigglePhase = 0;
    this.shakeAmp = 0;
    this.shakePhase = 0;
    this.idleIn = 0.8 + Math.random() * 1.5;
    this.leaving = false;
    this.leaveT = 0;
    this.dead = false;
    this.swayPhase = Math.random() * 10;
    this.group.scale.setScalar(0.001);

    if (o.from === 'sky') {
      this.pos.set(o.x ?? 0, o.y ?? 15, o.z ?? 0);
    } else {
      // Pop up out of the grass (or just grow out of the cloud shelf)
      const startY = this.floorY > 0 ? this.floorY : -this.height * 0.6;
      this.pos.set(o.x ?? 0, startY, o.z ?? 0);
      this.jump(o.jump ?? 15 + Math.random() * 3, o.vx ?? 0, o.vz ?? 0);
    }
  }

  jump(vy, vx = 0, vz = 0) {
    this.vel.set(this.vel.x * 0.3 + vx, vy, this.vel.z * 0.3 + vz);
    this.onGround = false;
    this.squashV += 6; // a little stretch kick
  }

  wiggle(amp = 0.35) {
    this.wiggleAmp = Math.max(this.wiggleAmp, amp);
  }

  shake(amp = 0.35) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.leaveT = 0;
    if (this.onGround) this.jump(6);
  }

  update(dt) {
    this.age += dt;

    // Physics
    if (this.home) {
      // Spring back to the slot in the row after being pushed around
      this.vel.x += ((this.home.x - this.pos.x) * 30 - this.vel.x * 8) * dt;
      this.vel.z += ((this.home.z - this.pos.z) * 30 - this.vel.z * 8) * dt;
    }
    this.vel.y += GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= this.floorY && this.vel.y < 0) {
      this.pos.y = this.floorY;
      const impact = -this.vel.y;
      if (impact > 3.5) {
        this.vel.y = impact * 0.42;
        this.squashV -= impact * 0.55;
        this.onLand?.(this, impact);
      } else {
        this.vel.y = 0;
        if (!this.onGround) this.onLand?.(this, impact);
        this.onGround = true;
      }
    }
    if (this.onGround) {
      this.vel.y = 0;
      this.pos.y = this.floorY;
      const f = Math.exp(-6 * dt);
      this.vel.x *= f;
      this.vel.z *= f;
      this.groundTime += dt;
    } else {
      this.vel.x *= Math.exp(-0.4 * dt);
    }
    // Keep inside the screen
    const limit = Math.max(0, this.bound - this.width / 2);
    if (this.pos.x < -limit) { this.pos.x = -limit; this.vel.x = Math.abs(this.vel.x) * 0.6; }
    if (this.pos.x > limit) { this.pos.x = limit; this.vel.x = -Math.abs(this.vel.x) * 0.6; }
    if (this.pos.z > 5) { this.pos.z = 5; this.vel.z = -Math.abs(this.vel.z) * 0.5; }
    if (this.pos.z < -8) { this.pos.z = -8; this.vel.z = Math.abs(this.vel.z) * 0.5; }

    // Squash & stretch spring, with a stretch target while flying fast
    const target = this.onGround ? 0 : THREE.MathUtils.clamp(this.vel.y / 70, -0.08, 0.2);
    this.squashV += ((target - this.squashA) * 220 - this.squashV * 14) * dt;
    this.squashA += this.squashV * dt;
    this.squashA = THREE.MathUtils.clamp(this.squashA, -0.45, 0.4);
    const sy = 1 + this.squashA;
    const sxz = 1 - this.squashA * 0.55;
    for (const g of this.glyphs) {
      g.squash.scale.set(sxz, sy, sxz);
      g.update(dt);
    }

    // Idle hops while waiting on the ground
    if (this.onGround && this.idleHops && !this.leaving) {
      this.idleIn -= dt;
      if (this.idleIn <= 0) {
        this.idleIn = this.idleEvery[0] + Math.random() * this.idleEvery[1];
        this.jump(4.5 + Math.random() * 3.5, this.home ? 0 : (Math.random() - 0.5) * 1.5);
      }
    }

    // Rotations: sway + wiggle + shake. Never turn far enough to show a mirrored letter (b/d!).
    this.wigglePhase += dt * 18;
    this.wiggleAmp *= Math.exp(-2.2 * dt);
    this.shakePhase += dt * 30;
    this.shakeAmp *= Math.exp(-3.5 * dt);
    this.swayPhase += dt;
    this.group.rotation.z = Math.sin(this.wigglePhase) * this.wiggleAmp + Math.sin(this.swayPhase * 1.3) * 0.03;
    this.group.rotation.y = Math.sin(this.shakePhase) * this.shakeAmp + Math.sin(this.swayPhase * 0.9) * 0.1;

    // Scale in / out
    let s = this.scale;
    const grow = Math.min(1, this.age / 0.28);
    s *= easeOutBack(grow);
    if (!this.leaving && this.onGround && this.groundTime > this.life) this.leave();
    if (this.leaving) {
      this.leaveT += dt;
      const k = Math.min(1, this.leaveT / 0.45);
      s *= 1 - k * k;
      if (k >= 1) {
        this.dead = true;
        this.onPop?.(this);
      }
    }
    this.group.scale.setScalar(Math.max(0.001, s));
  }
}
