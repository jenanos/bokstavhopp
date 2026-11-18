// The endless road for Bokstavbil: road + grass that scroll, and all the things
// that roll past (trees, houses, sheep, ramps, stars, rainbows, the finish line).
//
// The car stays at z = 0 and the world moves towards the camera (+z).

import * as THREE from 'three';

export const LANE_W = 3.4;
export const LANES = [-1, 0, 1];
export const laneX = (lane) => lane * LANE_W;
const CURB = 0.6;
export const ROAD_HALF = LANE_W * 1.5 + CURB;
export const SPAWN_Z = -130;
export const DESPAWN_Z = 16;

const ROAD_PERIOD = 8; // world units per repeat of the road texture
const GRASS_PERIOD = 12;
const ROAD_LEN = 300;

export const FAST_COLOR = '#ff2b3a';
export const SLOW_COLOR = '#2f7bff';

// ---------- helpers ----------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
};

const M = {
  trunk: mat('#8a5a35'),
  leaves: ['#3fa535', '#57c03f', '#2f8f3a', '#6bcf4a'].map((c) => mat(c)),
  pine: mat('#2e8b4a'),
  white: mat('#ffffff'),
  wool: mat('#fbfbf6', { roughness: 1 }),
  black: mat('#25272e'),
  pupil: mat('#141821', { roughness: 0.2 }),
  door: mat('#8a5a35'),
  glass: mat('#bfe8ff', { roughness: 0.2, emissive: '#5aa9d6', emissiveIntensity: 0.2 }),
  stem: mat('#3f9a35'),
  yellow: mat('#ffd23f'),
  pole: mat('#f4f4f4', { roughness: 0.5 }),
  cloud: mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 }),
};
// Bright, "toy town" colours. Red and blue are kept out on purpose:
// on this road those two colours mean faster and slower.
const PARTY = ['#ff9f1c', '#ffd60a', '#52d053', '#ff70d9', '#b78cff', '#2ec4b6', '#ffffff'];
const PARTY_MATS = PARTY.map((c) => mat(c, { roughness: 0.5 }));
const HOUSE_WALLS = ['#ffe3a3', '#ffd0e0', '#d9f2c4', '#fff4e0', '#e6dcff'].map((c) => mat(c));
const ROOFS = ['#e07a3f', '#8a4fff', '#2e9e5b', '#ff8fb1', '#c0573b'].map((c) => mat(c));

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function part(geo, material, [sx, sy, sz], [x, y, z], shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

// ---------- road + grass ----------

export function createTrack(renderer) {
  const group = new THREE.Group();
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const roadTex = canvasTexture(512, 256, (g, W, H) => {
    const px = (x) => ((x + ROAD_HALF) / (2 * ROAD_HALF)) * W;
    g.fillStyle = '#6b7080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    // Kerbs: yellow and white blocks
    const kw = px(-ROAD_HALF + CURB);
    for (const x0 of [0, W - kw]) {
      g.fillStyle = '#ffc233';
      g.fillRect(x0, 0, kw, H / 2);
      g.fillStyle = '#ffffff';
      g.fillRect(x0, H / 2, kw, H / 2);
    }
    // Edge lines and dashed lane lines
    g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      g.fillRect(px(s * (LANE_W * 1.5 - 0.15)) - 4, 0, 8, H);
      g.fillRect(px(s * LANE_W * 0.5) - 5, H * 0.08, 10, H * 0.42);
    }
  });
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, ROAD_LEN / ROAD_PERIOD);
  roadTex.anisotropy = aniso;
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LEN),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.005, -ROAD_LEN / 2 + 25);
  road.receiveShadow = true;
  group.add(road);

  const grassTex = canvasTexture(128, 256, (g, W, H) => {
    g.fillStyle = '#6cc94a';
    g.fillRect(0, 0, W, H / 2);
    g.fillStyle = '#5fbd40';
    g.fillRect(0, H / 2, W, H / 2);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,60,0,0.1)';
      g.fillRect(Math.random() * W, Math.random() * H, 2, 3);
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  const GRASS_W = 260;
  grassTex.repeat.set(GRASS_W / GRASS_PERIOD, ROAD_LEN / GRASS_PERIOD);
  grassTex.anisotropy = aniso;
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(GRASS_W, ROAD_LEN), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(side * (ROAD_HALF + GRASS_W / 2), 0, -ROAD_LEN / 2 + 25);
    grass.receiveShadow = true;
    group.add(grass);
  }

  // Far-away hills that ignore the fog, so they look like a soft painted backdrop.
  const hillColors = ['#9bd88a', '#8fcf80', '#a8e096', '#86c779'];
  const hillGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  [[-150, 60, 22], [-70, 50, 16], [0, 70, 20], [80, 55, 18], [160, 65, 24], [-220, 50, 15], [230, 50, 16]].forEach(
    ([x, r, h], i) => {
      const m = new THREE.Mesh(hillGeo, new THREE.MeshBasicMaterial({ color: hillColors[i % 4], fog: false }));
      m.position.set(x, -1, -240 - (i % 3) * 12);
      m.scale.set(r, h, r * 0.4);
      group.add(m);
    },
  );

  return {
    group,
    /** @param {number} distance total distance driven */
    scroll(distance) {
      roadTex.offset.y = (distance / ROAD_PERIOD) % 1;
      grassTex.offset.y = (distance / GRASS_PERIOD) % 1;
    },
  };
}

// ---------- scenery ----------

function tree() {
  const g = new THREE.Group();
  g.add(part(G.cyl, M.trunk, [0.22, 1.6, 0.22], [0, 0.8, 0]));
  const leaf = pick(M.leaves);
  g.add(part(G.sphere, leaf, [1.3, 1.2, 1.3], [0, 2.3, 0]));
  g.add(part(G.sphere, leaf, [0.9, 0.85, 0.9], [0.7, 2.0, 0.2]));
  g.add(part(G.sphere, leaf, [0.85, 0.8, 0.85], [-0.6, 2.6, -0.1]));
  // Sometimes an apple tree
  if (Math.random() < 0.35) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      g.add(part(G.sphere, PARTY_MATS[0], [0.15, 0.15, 0.15], [Math.cos(a) * 1.1, 2.1 + Math.random() * 0.8, Math.sin(a) * 1.1 + 0.3], false));
    }
  }
  return g;
}

function pine() {
  const g = new THREE.Group();
  g.add(part(G.cyl, M.trunk, [0.2, 1.2, 0.2], [0, 0.6, 0]));
  g.add(part(G.cone, M.pine, [1.4, 1.8, 1.4], [0, 1.9, 0]));
  g.add(part(G.cone, M.pine, [1.1, 1.5, 1.1], [0, 2.8, 0]));
  g.add(part(G.cone, M.pine, [0.75, 1.2, 0.75], [0, 3.6, 0]));
  return g;
}

function bush() {
  const g = new THREE.Group();
  const leaf = pick(M.leaves);
  g.add(part(G.sphere, leaf, [0.9, 0.7, 0.8], [0, 0.45, 0]));
  g.add(part(G.sphere, leaf, [0.7, 0.55, 0.7], [0.75, 0.35, 0.1]));
  g.add(part(G.sphere, leaf, [0.65, 0.5, 0.6], [-0.7, 0.32, -0.1]));
  if (Math.random() < 0.5) {
    const berry = pick(PARTY_MATS);
    for (let i = 0; i < 4; i++) g.add(part(G.sphere, berry, [0.12, 0.12, 0.12], [(Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.3, 0.6], false));
  }
  return g;
}

function flowers() {
  const g = new THREE.Group();
  const n = 3 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * 2.2;
    const z = (Math.random() - 0.5) * 2.2;
    const h = 0.5 + Math.random() * 0.4;
    g.add(part(G.cyl, M.stem, [0.04, h, 0.04], [x, h / 2, z], false));
    const petal = pick(PARTY_MATS);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.add(part(G.sphere, petal, [0.14, 0.14, 0.1], [x + Math.cos(a) * 0.17, h + Math.sin(a) * 0.17, z], false));
    }
    g.add(part(G.sphere, M.yellow, [0.11, 0.11, 0.11], [x, h, z + 0.05], false));
  }
  return g;
}

function house(side) {
  const g = new THREE.Group();
  const w = 3 + Math.random() * 1.2;
  const h = 2.4 + Math.random() * 0.8;
  g.add(part(G.box, pick(HOUSE_WALLS), [w, h, 3], [0, h / 2, 0]));
  g.add(part(G.roof, pick(ROOFS), [w * 0.82, 1.8, 2.3], [0, h + 0.9, 0]));
  g.add(part(G.box, M.door, [0.7, 1.3, 0.1], [0, 0.65, 1.52], false));
  g.add(part(G.box, M.glass, [0.7, 0.7, 0.1], [-w * 0.3, h * 0.6, 1.52], false));
  g.add(part(G.box, M.glass, [0.7, 0.7, 0.1], [w * 0.3, h * 0.6, 1.52], false));
  g.add(part(G.box, M.white, [0.4, 1.0, 0.4], [w * 0.28, h + 1.2, -0.4]));
  // Face the road
  g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  return g;
}

function sheep(side) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  for (const [x, y, z, s] of [[0, 0.9, 0, 0.6], [0.45, 0.95, 0, 0.45], [-0.45, 0.95, 0, 0.45], [0, 1.2, 0.1, 0.45], [0, 0.95, 0.4, 0.42], [0, 0.95, -0.4, 0.42]]) {
    body.add(part(G.sphere, M.wool, [s, s, s], [x, y, z]));
  }
  for (const [x, z] of [[0.35, 0.3], [-0.35, 0.3], [0.35, -0.3], [-0.35, -0.3]]) {
    body.add(part(G.cyl, M.black, [0.07, 0.6, 0.07], [x, 0.3, z], false));
  }
  const head = new THREE.Group();
  head.position.set(0, 1.15, 0.75);
  head.add(part(G.sphere, M.black, [0.3, 0.34, 0.32], [0, 0, 0]));
  for (const s of [-1, 1]) {
    head.add(part(G.sphere, M.white, [0.11, 0.12, 0.08], [s * 0.12, 0.08, 0.27], false));
    head.add(part(G.sphere, M.pupil, [0.055, 0.06, 0.05], [s * 0.12, 0.07, 0.33], false));
    head.add(part(G.sphere, M.black, [0.16, 0.07, 0.08], [s * 0.3, 0.05, 0], false)); // ears
  }
  body.add(head);
  // Look at the road (and the car!)
  g.rotation.y = side < 0 ? Math.PI / 2 + 0.5 : -Math.PI / 2 - 0.5;
  const phase = Math.random() * 6;
  g.userData.update = (t) => {
    body.position.y = Math.max(0, Math.sin(t * 5 + phase)) * 0.25; // happy little hops
    head.rotation.z = Math.sin(t * 2 + phase) * 0.2;
  };
  return g;
}

function balloon() {
  const g = new THREE.Group();
  const y = 5 + Math.random() * 4;
  const m = pick(PARTY_MATS);
  const b = part(G.sphere, m, [0.8, 1.0, 0.8], [0, y, 0]);
  g.add(b);
  g.add(part(G.cone, m, [0.18, 0.25, 0.18], [0, y - 1.05, 0], false));
  g.add(part(G.cyl, M.white, [0.015, 2.5, 0.015], [0, y - 2.4, 0], false));
  const phase = Math.random() * 6;
  const baseY = g.position.y;
  g.userData.update = (t) => {
    g.position.y = baseY + Math.sin(t * 1.2 + phase) * 0.4;
    g.rotation.z = Math.sin(t * 0.9 + phase) * 0.08;
  };
  return g;
}

const swirlTex = canvasTexture(128, 128, (g, W) => {
  const colors = ['#ff70d9', '#ffffff', '#ffd60a', '#ffffff', '#52d053', '#ffffff'];
  for (let r = W / 2, i = 0; r > 0; r -= 9, i++) {
    g.fillStyle = colors[i % colors.length];
    g.beginPath();
    g.arc(W / 2, W / 2, r, 0, Math.PI * 2);
    g.fill();
  }
});
const swirlMat = new THREE.MeshStandardMaterial({ map: swirlTex, roughness: 0.3 });
const candyGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 32);

function lollipop() {
  const g = new THREE.Group();
  const h = 2.2 + Math.random();
  g.add(part(G.cyl, M.pole, [0.08, h, 0.08], [0, h / 2, 0]));
  const candy = new THREE.Mesh(candyGeo, [M.white, swirlMat, swirlMat]);
  candy.rotation.x = Math.PI / 2;
  candy.position.y = h + 0.8;
  candy.castShadow = true;
  g.add(candy);
  const phase = Math.random() * 6;
  g.userData.update = (t) => { candy.rotation.y = Math.sin(t * 1.5 + phase) * 0.3; };
  return g;
}

const SCENERY = [
  // [builder, weight, min distance from road edge, max distance]
  [tree, 30, 2, 28],
  [pine, 14, 2, 30],
  [bush, 14, 1, 14],
  [flowers, 16, 0.8, 5],
  [house, 8, 7, 22],
  [sheep, 8, 2, 10],
  [balloon, 4, 2, 14],
  [lollipop, 6, 1.5, 8],
];
const SCENERY_TOTAL = SCENERY.reduce((s, e) => s + e[1], 0);

/** A random piece of scenery for one side of the road (-1 left, 1 right). */
export function createScenery(side) {
  let r = Math.random() * SCENERY_TOTAL;
  let entry = SCENERY[0];
  for (const e of SCENERY) {
    r -= e[1];
    if (r <= 0) { entry = e; break; }
  }
  const [build, , min, max] = entry;
  const g = build(side);
  const d = min + Math.pow(Math.random(), 1.6) * (max - min);
  g.position.x = side * (ROAD_HALF + d);
  if (build !== house && build !== sheep) g.rotation.y = Math.random() * Math.PI * 2;
  const s = 0.85 + Math.random() * 0.4;
  g.scale.setScalar(s);
  return g;
}

// ---------- things on (and over) the road ----------

/** A coloured pad under a letter. Red has arrows pointing ahead, blue arrows pointing back. */
const padTex = {};
function padTexture(fast) {
  const key = fast ? 'fast' : 'slow';
  if (padTex[key]) return padTex[key];
  padTex[key] = canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = fast ? FAST_COLOR : SLOW_COLOR;
    g.beginPath();
    g.roundRect(8, 8, W - 16, H - 16, 48);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 22;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const y of [70, 150]) {
      g.beginPath();
      // In the texture, "up" points away from the car.
      if (fast) { g.moveTo(70, y + 40); g.lineTo(128, y - 10); g.lineTo(186, y + 40); }
      else { g.moveTo(70, y); g.lineTo(128, y + 50); g.lineTo(186, y); }
      g.stroke();
    }
  });
  return padTex[key];
}
const padGeo = new THREE.PlaneGeometry(2.7, 2.7).rotateX(-Math.PI / 2);
const padMats = {};
export function createPad(fast) {
  const key = fast ? 'fast' : 'slow';
  padMats[key] ??= new THREE.MeshStandardMaterial({
    map: padTexture(fast), roughness: 0.6, emissive: fast ? FAST_COLOR : SLOW_COLOR, emissiveIntensity: 0.25,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(padGeo, padMats[key]);
  m.position.y = 0.02;
  m.receiveShadow = true;
  return m;
}

const rampTex = canvasTexture(128, 256, (g, W, H) => {
  g.fillStyle = '#ff9f1c';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd60a';
  for (let y = -H; y < H * 2; y += 60) {
    g.beginPath();
    g.moveTo(0, y); g.lineTo(W, y - 50); g.lineTo(W, y - 20); g.lineTo(0, y + 30);
    g.fill();
  }
});
const rampGeo = (() => {
  // Side profile in (x = length, y = height), extruded across the lane.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(3.4, 0);
  s.lineTo(3.4, 1.0);
  s.quadraticCurveTo(1.6, 0.4, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.7, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 10 });
  // length -> towards -z (low end nearest the car), width -> x
  geo.rotateY(Math.PI / 2);
  geo.translate(-1.35, 0, 1.7);
  return geo;
})();
const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.5 });
export function createRamp() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(rampGeo, rampMat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

const starShape = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.26 : 0.6;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
})();
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }).center();
const starMat = new THREE.MeshStandardMaterial({ color: '#ffd60a', roughness: 0.25, metalness: 0.3, emissive: '#ffb703', emissiveIntensity: 0.5 });
export function createStar() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(starGeo, starMat);
  m.position.y = 1.2;
  m.castShadow = true;
  g.add(m);
  const phase = Math.random() * 6;
  g.userData.update = (t) => {
    m.rotation.y = t * 3 + phase;
    m.position.y = 1.2 + Math.sin(t * 4 + phase) * 0.15;
  };
  return g;
}

const RAINBOW_ARCS = ['#ff4d6d', '#ff9f1c', '#ffd60a', '#52d053', '#2ec4f1', '#7b61ff', '#c77dff'].map((c, i) => [
  new THREE.TorusGeometry(9 - i * 0.42, 0.22, 10, 56, Math.PI),
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.3 }),
]);
export function createRainbow() {
  const g = new THREE.Group();
  for (const [geo, material] of RAINBOW_ARCS) g.add(new THREE.Mesh(geo, material));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const p = part(G.sphere, M.cloud, [1.3, 1, 1.2], [s * (7.7 + (k % 2) * 1.2), 0.4 + (k >> 1) * 0.6, (k % 2) - 0.5], false);
      g.add(p);
    }
  }
  return g;
}

// There is only ever one finish line on the road, so it is built once and reused.
let finish = null;
export function createFinish() {
  finish ??= buildFinish();
  return finish;
}
function buildFinish() {
  const g = new THREE.Group();
  const checker = canvasTexture(512, 64, (c, W, H) => {
    const sq = H / 2;
    for (let x = 0; x < W / sq; x++) {
      for (let y = 0; y < 2; y++) {
        c.fillStyle = (x + y) % 2 ? '#1e2a4a' : '#ffffff';
        c.fillRect(x * sq, y * sq, sq, sq);
      }
    }
  });
  // Chequered line across the road
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF * 2 - CURB * 2, 1.4).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: checker, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  line.position.y = 0.02;
  line.receiveShadow = true;
  g.add(line);
  // Arch with a banner
  const postX = ROAD_HALF + 0.6;
  for (const s of [-1, 1]) {
    g.add(part(G.cyl, M.pole, [0.25, 7, 0.25], [s * postX, 3.5, 0]));
    // A bunch of balloons on each post
    for (let k = 0; k < 3; k++) {
      g.add(part(G.sphere, PARTY_MATS[(k + (s > 0 ? 3 : 0)) % PARTY_MATS.length], [0.6, 0.75, 0.6], [s * (postX + (k - 1) * 0.7), 7.9 + (k % 2) * 0.5, 0], false));
    }
  }
  const bannerTex = canvasTexture(1024, 160, (c, W, H) => {
    const sq = 40;
    for (let x = 0; x < W / sq; x++) {
      for (let y = 0; y < H / sq; y++) {
        c.fillStyle = (x + y) % 2 ? '#1e2a4a' : '#ffffff';
        c.fillRect(x * sq, y * sq, sq, sq);
      }
    }
    c.fillStyle = '#ffd60a';
    c.beginPath();
    c.roundRect(W / 2 - 170, 14, 340, H - 28, 30);
    c.fill();
    c.fillStyle = '#1e2a4a';
    c.font = 'bold 110px Andika, "Comic Sans MS", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('MÅL', W / 2, H / 2 + 6);
  });
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(postX * 2, postX * 2 * (160 / 1024)),
    new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6, side: THREE.DoubleSide }),
  );
  banner.position.y = 6.3;
  banner.castShadow = true;
  g.add(banner);
  return g;
}
