// Little effects for the car: exhaust puffs and speed lines.

import * as THREE from 'three';

/** Round puffs of smoke that grow, drift back and shrink away. */
export class Puffs {
  constructor(parent, max = 28) {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 });
    this.items = [];
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      parent.add(m);
      this.items.push({ m, life: 0, max: 1, v: new THREE.Vector3(), size: 0.3 });
    }
    this.next = 0;
  }

  emit(pos, { vz = 4, size = 0.3, life = 0.6, color } = {}) {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    p.m.position.copy(pos);
    p.v.set((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.6, vz);
    p.life = p.max = life * (0.8 + Math.random() * 0.4);
    p.size = size * (0.7 + Math.random() * 0.6);
    p.m.visible = true;
    if (color) p.m.material = color;
  }

  update(dt) {
    for (const p of this.items) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.position.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max; // 0 -> 1
      p.m.scale.setScalar(p.size * (0.4 + k * 1.6) * (1 - k * k));
    }
  }

  clear() {
    for (const p of this.items) { p.life = 0; p.m.visible = false; }
  }
}

/** Thin white streaks rushing past when going fast. */
export class SpeedLines {
  constructor(parent, count = 36) {
    const geo = new THREE.BoxGeometry(0.05, 0.05, 1);
    this.mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
    this.lines = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      this.#place(m, -60 + Math.random() * 70);
      parent.add(m);
      this.lines.push(m);
    }
    this.amount = 0;
  }

  #place(m, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    m.position.set(side * (2.5 + Math.random() * 7), 0.4 + Math.random() * 5, z);
    m.userData.len = 2 + Math.random() * 3;
  }

  /** @param {number} amount 0..1 how visible the lines are */
  update(dt, speed, amount) {
    this.amount += (amount - this.amount) * (1 - Math.exp(-5 * dt));
    this.mat.opacity = this.amount * 0.55;
    const visible = this.amount > 0.02;
    for (const m of this.lines) {
      m.visible = visible;
      m.position.z += speed * 1.8 * dt;
      m.scale.z = m.userData.len * (0.5 + this.amount);
      if (m.position.z > 12) this.#place(m, -50 - Math.random() * 15);
    }
  }
}
