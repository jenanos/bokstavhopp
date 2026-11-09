// Pooled confetti / star particles using one InstancedMesh per kind.

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Particles {
  constructor(scene, geometry, material, max = 600, { gravity = -9, drag = 1.2 } = {}) {
    this.max = max;
    this.gravity = gravity;
    this.drag = drag;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.next = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.r = new Float32Array(max * 3);
    this.w = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.set(1, 1, 1));
    }
    scene.add(this.mesh);
  }

  /**
   * @param {THREE.Vector3} origin
   * @param {object} o count, speed, colors (THREE.Color[]), up (extra upward), spread (position jitter), life, size, dir (THREE.Vector3)
   */
  emit(origin, o = {}) {
    const count = o.count ?? 30;
    const speed = o.speed ?? 6;
    const up = o.up ?? 4;
    const spread = o.spread ?? 0.3;
    const colors = o.colors ?? [new THREE.Color('#ffffff')];
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const i3 = i * 3;
      this.p[i3] = origin.x + (Math.random() - 0.5) * spread * 2;
      this.p[i3 + 1] = origin.y + (Math.random() - 0.5) * spread * 2;
      this.p[i3 + 2] = origin.z + (Math.random() - 0.5) * spread * 2;
      // Random direction on a sphere, biased upwards
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.v[i3] = rr * Math.cos(a) * sp + (o.dir?.x ?? 0);
      this.v[i3 + 1] = Math.abs(u) * sp + up * (0.5 + Math.random() * 0.5) + (o.dir?.y ?? 0);
      this.v[i3 + 2] = rr * Math.sin(a) * sp * 0.6 + (o.dir?.z ?? 0);
      for (let k = 0; k < 3; k++) {
        this.r[i3 + k] = Math.random() * Math.PI * 2;
        this.w[i3 + k] = (Math.random() - 0.5) * 14;
      }
      this.maxLife[i] = this.life[i] = (o.life ?? 1.6) * (0.7 + Math.random() * 0.6);
      this.size[i] = (o.size ?? 1) * (0.7 + Math.random() * 0.6);
      this.mesh.setColorAt(i, colors[(Math.random() * colors.length) | 0]);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const drag = Math.exp(-this.drag * dt);
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }
      this.v[i3 + 1] += this.gravity * dt;
      for (let k = 0; k < 3; k++) {
        this.v[i3 + k] *= drag;
        this.p[i3 + k] += this.v[i3 + k] * dt;
        this.r[i3 + k] += this.w[i3 + k] * dt;
      }
      if (this.p[i3 + 1] < 0.03) {
        // Settle on the grass
        this.p[i3 + 1] = 0.03;
        this.v[i3] *= 0.8;
        this.v[i3 + 1] = 0;
        this.v[i3 + 2] *= 0.8;
        this.w[i3] *= 0.8;
        this.w[i3 + 1] *= 0.8;
        this.w[i3 + 2] *= 0.8;
      }
      const t = this.life[i] / this.maxLife[i];
      const sc = this.size[i] * Math.min(1, t * 4);
      _p.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]);
      _q.setFromEuler(_e.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]));
      _s.set(sc, sc, sc);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function createEffects(scene) {
  const confettiGeo = new THREE.PlaneGeometry(0.24, 0.13);
  const confettiMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 });
  const confetti = new Particles(scene, confettiGeo, confettiMat, 900, { gravity: -7, drag: 1.6 });

  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.09 : 0.22;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  starGeo.center();
  const starMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2, emissive: '#555533', emissiveIntensity: 0.6 });
  const stars = new Particles(scene, starGeo, starMat, 500, { gravity: -5, drag: 1.4 });

  return {
    confetti,
    stars,
    update(dt) {
      confetti.update(dt);
      stars.update(dt);
    },
    clear() {
      confetti.clear();
      stars.clear();
    },
  };
}

export const RAINBOW = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#52d053', '#2ec4f1', '#7b61ff', '#ff70d9'].map(
  (c) => new THREE.Color(c),
);
export const GOLD = ['#ffd60a', '#ffe680', '#ffb703', '#fff3b0'].map((c) => new THREE.Color(c));
