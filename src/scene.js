// Renderer, camera, lights and the little meadow the letters play on.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const HORIZON = new THREE.Color('#d4f1ff');

/** Where the two letter rows live: capitals on the cloud shelf, small letters on the grass. */
export const ROWS = { upperY: 4.8, lowerY: 0, z: 0 };

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON, 45, 90);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const lookAt = new THREE.Vector3(0, 3.4, 0);

  // Lights
  scene.add(new THREE.HemisphereLight('#bfe6ff', '#4f9a35', 0.9));
  const sun = new THREE.DirectionalLight('#fff4dd', 2.4);
  sun.position.set(7, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;
  scene.add(sun);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 64),
    new THREE.MeshStandardMaterial({ color: '#5cbf3a', roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // A soft lighter "stage" patch where the letters land
  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.MeshStandardMaterial({ color: '#74cc4c', roughness: 0.95 }),
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.01;
  patch.scale.set(1.5, 0.55, 1);
  patch.receiveShadow = true;
  scene.add(patch);

  addHills(scene);
  const clouds = addClouds(scene);
  const shelf = createShelf(scene);
  const flowers = addFlowers(scene);

  // Visible half-width at z = 0, updated on resize; used to keep letters on screen.
  const bounds = { halfWidth: 10 };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull the camera back on narrow screens so there is always room for ~20 units across.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const neededWidth = 11;
    const dist = Math.max(19, neededWidth / (tanHalf * camera.aspect));
    camera.position.set(0, 6, dist);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
    bounds.halfWidth = tanHalf * camera.aspect * dist;
    shelf.build(bounds.halfWidth);
  }
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  function update(dt) {
    t += dt;
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 60) c.position.x = -60;
      c.position.y = c.userData.y + Math.sin(t * 0.3 + c.userData.phase) * 0.3;
    }
    shelf.update(t);
    for (const f of flowers) {
      f.rotation.z = Math.sin(t * 1.6 + f.userData.phase) * 0.12;
    }
  }

  return { renderer, scene, camera, bounds, update };
}

/** A long fluffy cloud the capital letters stand on. Rebuilt to fit the screen width. */
function createShelf(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, emissive: '#eaf6ff', emissiveIntensity: 0.35 });
  let builtFor = 0;
  let puffs = [];
  return {
    build(halfWidth) {
      if (Math.abs(halfWidth - builtFor) < 0.5) return;
      builtFor = halfWidth;
      group.clear();
      puffs = [];
      const span = halfWidth + 1;
      for (let x = -span, i = 0; x <= span; x += 0.95, i++) {
        // Top layer: flat-ish puffs whose tops sit just above the shelf line
        const r = 0.75 + ((i * 37) % 10) / 40;
        const p = new THREE.Mesh(geo, mat);
        p.scale.set(r, r * 0.55, r * 1.1);
        p.position.set(x, ROWS.upperY - r * 0.55 + 0.08, ROWS.z + (((i * 53) % 7) - 3) * 0.06);
        p.receiveShadow = true;
        p.userData.baseY = p.position.y;
        p.userData.phase = i * 0.7;
        group.add(p);
        puffs.push(p);
        // Lower, smaller puffs for a fluffy underside
        if (i % 2 === 0) {
          const q = new THREE.Mesh(geo, mat);
          const rq = r * 0.6;
          q.scale.set(rq, rq * 0.7, rq);
          q.position.set(x + 0.4, ROWS.upperY - r * 0.9, ROWS.z + 0.2);
          group.add(q);
        }
      }
    },
    update(t) {
      for (const p of puffs) p.position.y = p.userData.baseY + Math.sin(t * 1.2 + p.userData.phase) * 0.025;
    },
  };
}

function addHills(scene) {
  const colors = ['#4fae35', '#45a02f', '#5cbb40', '#52a83a'];
  const geo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const hills = [
    [-34, -42, 18, 7], [-8, -50, 22, 9], [20, -44, 17, 6.5], [44, -38, 15, 6], [-55, -30, 14, 5],
  ];
  hills.forEach(([x, z, r, h], i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 1 }));
    m.position.set(x, 0, z);
    m.scale.set(r, h, r * 0.6);
    scene.add(m);
  });
}

function addClouds(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(geo, mat);
      const s = 1.4 + Math.random() * 1.3;
      p.scale.set(s, s * 0.8, s);
      p.position.set(j * 1.6 - puffs * 0.8, Math.random() * 0.8, Math.random() * 0.8);
      g.add(p);
    }
    g.position.set(-60 + i * 18 + Math.random() * 8, 0, -28 - Math.random() * 14);
    g.userData = { speed: 0.6 + Math.random() * 0.8, y: 13 + Math.random() * 6, phase: Math.random() * 6 };
    clouds.push(g);
    scene.add(g);
  }
  return clouds;
}

function addFlowers(scene) {
  const flowers = [];
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.8, 6);
  stemGeo.translate(0, 0.4, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: '#3f9a35' });
  const petalGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const centerGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const centerMat = new THREE.MeshStandardMaterial({ color: '#ffd23f' });
  const petalColors = ['#ff6b9a', '#ffffff', '#b78cff', '#ff9f43', '#5ec8ff'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }),
  );
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (16 + Math.random() * 18);
    const z = -14 + Math.random() * 16;
    const f = new THREE.Group();
    f.add(new THREE.Mesh(stemGeo, stemMat));
    const pm = petalColors[i % petalColors.length];
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Mesh(petalGeo, pm);
      const a = (k / 5) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.2, 0.85 + Math.sin(a) * 0.2, 0);
      f.add(p);
    }
    const c = new THREE.Mesh(centerGeo, centerMat);
    c.position.set(0, 0.85, 0.06);
    f.add(c);
    const s = 1.2 + Math.random() * 0.9;
    f.scale.setScalar(s);
    f.position.set(x, 0, z);
    f.userData.phase = Math.random() * 6;
    scene.add(f);
    flowers.push(f);
  }
  return flowers;
}
