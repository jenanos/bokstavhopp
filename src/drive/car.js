// The little car: a yellow convertible with a driver, a fluttering scarf,
// a flag on the antenna, spinning wheels and boost flames.
// It faces -z (away from the camera), so we mostly see its back.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const WHEEL_R = 0.44;
const PIVOT_Y = 0.8; // the body rolls and squashes around this height

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

function mesh(geo, material, pos, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(...pos);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(4, 4, 248, 88, 18);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#1e2a4a';
  g.stroke();
  g.font = 'bold 66px Andika, "Comic Sans MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  ['#ff9f1c', '#52d053', '#b78cff'].forEach((col, i) => {
    g.fillStyle = col;
    g.fillText('ABC'[i], 70 + i * 58, 52);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Car {
  constructor() {
    this.group = new THREE.Group(); // x / y on the road, yaw
    this.body = new THREE.Group(); // roll, lean, squash (pivot raised a bit)
    this.body.position.y = PIVOT_Y;
    this.group.add(this.body);
    const inner = new THREE.Group();
    inner.position.y = -PIVOT_Y;
    this.body.add(inner);

    const paint = new THREE.MeshPhysicalMaterial({ color: '#ffc21a', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
    const white = std('#ffffff', { roughness: 0.4 });
    const dark = std('#2a2d3a', { roughness: 0.85 });
    const chrome = std('#e6ebf2', { roughness: 0.15, metalness: 0.8 });

    // Body
    inner.add(mesh(new RoundedBoxGeometry(2.0, 0.72, 3.3, 4, 0.3), paint, [0, 0.76, 0]));
    inner.add(mesh(new RoundedBoxGeometry(0.4, 0.74, 3.32, 2, 0.12), white, [0, 0.77, 0])); // racing stripe
    inner.add(mesh(new RoundedBoxGeometry(1.8, 0.34, 1.0, 3, 0.15), paint, [0, 1.2, -1.05])); // bonnet
    inner.add(mesh(new RoundedBoxGeometry(1.86, 0.3, 0.85, 3, 0.14), paint, [0, 1.18, 1.15])); // rear deck
    inner.add(mesh(new RoundedBoxGeometry(1.5, 0.62, 0.22, 3, 0.1), white, [0, 1.42, 0.62])); // seat back

    // Windscreen
    const screen = mesh(
      new THREE.BoxGeometry(1.7, 0.55, 0.05),
      new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.05, transparent: true, opacity: 0.45 }),
      [0, 1.55, -0.5],
      false,
    );
    screen.rotation.x = -0.45;
    inner.add(screen);

    // Spoiler
    for (const s of [-1, 1]) inner.add(mesh(new THREE.BoxGeometry(0.1, 0.35, 0.12), dark, [s * 0.6, 1.45, 1.4]));
    inner.add(mesh(new RoundedBoxGeometry(2.0, 0.1, 0.45, 2, 0.04), white, [0, 1.65, 1.45]));

    // Lights, plate, exhaust
    const tail = std('#ff5050', { emissive: '#ff2020', emissiveIntensity: 0.6 });
    for (const s of [-1, 1]) {
      inner.add(mesh(new RoundedBoxGeometry(0.42, 0.2, 0.08, 2, 0.05), tail, [s * 0.68, 0.92, 1.66], false));
      inner.add(mesh(new THREE.SphereGeometry(0.16, 14, 10), std('#fffbe0', { emissive: '#fff3b0', emissiveIntensity: 0.8 }), [s * 0.65, 0.9, -1.62], false));
    }
    const plate = mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5 }), [0, 0.62, 1.67], false);
    inner.add(plate);
    const pipe = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 12).rotateX(Math.PI / 2), chrome, [-0.55, 0.42, 1.68]);
    inner.add(pipe);
    this.exhaust = new THREE.Vector3(-0.55, 0.42, 1.9);

    // Boost flames
    const flameGeo = new THREE.ConeGeometry(0.16, 1, 10).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    this.flames = new THREE.Group();
    this.flames.position.set(-0.55, 0.42, 1.85);
    const outer = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: '#ff8c1a' }));
    const core = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: '#fff3b0' }));
    core.scale.set(0.55, 0.55, 0.7);
    this.flames.add(outer, core);
    this.flames.visible = false;
    inner.add(this.flames);

    // Wheels
    const tyreGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.38, 24).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.4, 16).rotateZ(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.42, 0.08, 0.34);
    this.wheels = [];
    for (const [x, z] of [[-1, -1.05], [1, -1.05], [-1, 1.05], [1, 1.05]]) {
      const w = new THREE.Group();
      w.position.set(x * 0.98, WHEEL_R, z);
      w.add(mesh(tyreGeo, dark));
      w.add(mesh(hubGeo, white, null, false));
      const spoke = mesh(spokeGeo, std('#ff9f1c'), null, false);
      spoke.rotation.x = Math.PI / 4;
      w.add(spoke);
      inner.add(w);
      this.wheels.push(w);
    }

    // Driver: head, helmet, goggles and a long scarf
    this.head = new THREE.Group();
    this.head.position.set(0, 1.92, 0.25);
    inner.add(this.head);
    const skin = std('#ffd1a6', { roughness: 0.7 });
    this.head.add(mesh(new THREE.SphereGeometry(0.34, 20, 16), skin));
    const helmet = mesh(new THREE.SphereGeometry(0.37, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std('#b78cff', { roughness: 0.3 }), [0, 0.02, 0]);
    this.head.add(helmet);
    this.head.add(mesh(new THREE.TorusGeometry(0.36, 0.04, 8, 32).rotateX(Math.PI / 2), white, [0, 0.06, 0], false));
    for (const s of [-1, 1]) {
      this.head.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), white, [s * 0.13, 0.04, -0.3], false));
      this.head.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), std('#141821'), [s * 0.13, 0.04, -0.37], false));
    }
    inner.add(mesh(new THREE.CylinderGeometry(0.33, 0.4, 0.4, 16), std('#52d053'), [0, 1.62, 0.25])); // shoulders
    this.scarf = [];
    let parent = inner;
    const scarfMat = [std('#ff70d9'), std('#ffffff')];
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.set(i === 0 ? 0.12 : 0, i === 0 ? 1.72 : 0, i === 0 ? 0.55 : 0.26);
      seg.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.28).translate(0, 0, 0.13), scarfMat[i % 2], null, false));
      parent.add(seg);
      parent = seg;
      this.scarf.push(seg);
    }

    // Antenna with a little flag
    inner.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), dark, [0.8, 1.9, 1.25], false));
    this.flag = new THREE.Group();
    this.flag.position.set(0.8, 2.55, 1.25);
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(0, 0.4);
    flagShape.lineTo(0.6, 0.2);
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#52d053', side: THREE.DoubleSide }));
    flag.position.y = -0.2;
    this.flag.add(flag);
    inner.add(this.flag);

    this.t = 0;
  }

  /**
   * @param {number} dt
   * @param {{speed:number, vx:number, roll:number, boost:number, squash:number, airborne:boolean}} s
   */
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    for (const w of this.wheels) w.rotation.x -= (s.speed * dt) / WHEEL_R;

    const sp = Math.min(1, s.speed / 25);
    // Lean and yaw with steering
    this.group.rotation.y = THREE.MathUtils.clamp(-s.vx * 0.035, -0.35, 0.35);
    this.body.rotation.z = THREE.MathUtils.clamp(s.vx * 0.02, -0.15, 0.15) + s.roll;
    this.body.rotation.x = s.airborne ? -0.12 : 0;
    // Bumpy road + squash
    const bump = s.airborne ? 0 : Math.abs(Math.sin(t * (8 + sp * 14))) * 0.03 * (0.3 + sp);
    this.body.position.y = PIVOT_Y + bump;
    const q = s.squash;
    this.body.scale.set(1 + q * 0.25, 1 - q * 0.35, 1 + q * 0.15);

    // Driver looks where we are going
    this.head.rotation.y = THREE.MathUtils.clamp(-s.vx * 0.09, -0.7, 0.7);
    this.head.rotation.z = Math.sin(t * 3) * 0.05;

    // Scarf and flag flutter more at speed
    const flutter = 0.15 + sp * 0.5;
    this.scarf.forEach((seg, i) => {
      seg.rotation.x = Math.sin(t * (10 + sp * 14) - i * 0.9) * flutter * 0.6 - (i === 0 ? 0.3 * (1 - sp) : 0);
      seg.rotation.y = Math.sin(t * 7 - i * 1.3) * flutter * 0.5;
    });
    this.flag.rotation.y = Math.sin(t * (8 + sp * 16)) * (0.2 + sp * 0.3);

    // Flames
    this.flames.visible = s.boost > 0.05;
    if (this.flames.visible) {
      const f = s.boost * (0.8 + Math.random() * 0.5);
      this.flames.scale.set(0.8 + f * 0.5, 0.8 + f * 0.5, 0.3 + f * 1.4);
    }
  }
}
