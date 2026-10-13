// Cotton fields west of the fence, with an autonomous harvester working the instanced parcel.
import * as THREE from 'three';
import { ZONES } from './terrain.js';
import { mulberry32 } from './noise.js';
import { blob, merge, paint, place, setInstance } from './geo.js';
import { cottonRowTexture } from './textures.js';
import { Path, arcPoints } from './flow.js';
import { PALETTE } from './data.js';

const ROW = 2.6;          // row spacing (m)
const STEP = 2.2;         // plant spacing along a row (m)
const ROWS_PER_PASS = 4;  // the harvester picks 4 rows at once
// Instanced parcel (closest to the factory).
const A = { x0: -472, x1: -332, z0: -30, z1: 206 };

function parcel(scene, tex, x0, x1, z0, z1, y) {
  const w = x1 - x0, d = z1 - z0;
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / ROW, d / 6);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  scene.add(m);
}

function plantGeometries() {
  const r = mulberry32(3);
  const leaves = [];
  for (let k = 0; k < 3; k++) {
    leaves.push(place(blob(0.34, 0, 0.22, k * 3), { x: (r() - 0.5) * 0.35, y: 0.5 + k * 0.18, z: (r() - 0.5) * 0.35, sy: 0.8 }));
  }
  leaves.push(place(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 4), { y: 0.3 }));
  const bolls = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r();
    bolls.push(place(new THREE.IcosahedronGeometry(0.12, 0), {
      x: Math.cos(a) * 0.3, y: 0.62 + r() * 0.42, z: Math.sin(a) * 0.3, sy: 0.9,
    }));
  }
  return { leaves: merge(leaves), bolls: merge(bolls) };
}

/* ---------- Harvester ---------- */
function buildHarvester() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f4f6f5', roughness: 0.35, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a3237', roughness: 0.6, metalness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.4, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0b6b63', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.75 });
  const glow = new THREE.MeshStandardMaterial({ color: PALETTE.teal, emissive: PALETTE.teal, emissiveIntensity: 1.6 });
  const cage = new THREE.MeshStandardMaterial({ color: '#cfe9e5', roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.35, depthWrite: false });
  const cotton = new THREE.MeshStandardMaterial({ color: PALETTE.cotton, roughness: 0.95 });

  const body = new THREE.Mesh(merge([
    place(new THREE.BoxGeometry(3.4, 1.0, 7.2), { y: 1.55 }),
    place(new THREE.BoxGeometry(3.2, 1.8, 2.8), { y: 2.95, z: -2.2 }),
    place(new THREE.BoxGeometry(2.5, 0.25, 2.3), { y: 4.55, z: 2.55 }),          // cab roof
    place(new THREE.BoxGeometry(10.8, 0.45, 0.7), { y: 1.5, z: 4.1 }),           // header beam
    place(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 8), { x: 1.2, y: 3.6, z: 3.3, rx: -35 }),  // air ducts
    place(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 8), { x: -1.2, y: 3.6, z: 3.3, rx: -35 }),
  ]), white);
  const units = new THREE.Mesh(merge([-1.5, -0.5, 0.5, 1.5].flatMap((i) => [
    place(new THREE.BoxGeometry(0.9, 1.1, 2.0), { x: i * ROW, y: 0.95, z: 5.2 }),
    place(new THREE.ConeGeometry(0.45, 1.4, 4), { x: i * ROW, y: 0.7, z: 6.8, rx: 90, ry: 45 }),
  ])), gold);
  const cab = new THREE.Mesh(place(new THREE.BoxGeometry(2.3, 2.0, 2.1), { y: 3.45, z: 2.55 }), glass);
  const cageMesh = new THREE.Mesh(place(new THREE.BoxGeometry(3.6, 2.9, 4.6), { y: 5.55, z: -0.9 }), cage);
  const fill = new THREE.Mesh(place(new THREE.BoxGeometry(3.4, 1, 4.4), { y: 0.5 }), cotton);
  fill.position.set(0, 4.15, -0.9);
  const strips = new THREE.Mesh(merge([
    place(new THREE.BoxGeometry(0.06, 0.12, 7.0), { x: 1.73, y: 1.75 }),
    place(new THREE.BoxGeometry(0.06, 0.12, 7.0), { x: -1.73, y: 1.75 }),
    place(new THREE.BoxGeometry(10.6, 0.1, 0.06), { y: 1.78, z: 4.47 }),
  ]), glow);
  const lidar = new THREE.Mesh(merge([
    place(new THREE.CylinderGeometry(0.32, 0.36, 0.28, 16), { y: 4.82, z: 2.55 }),
    place(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: 4.96, z: 2.55 }),
  ]), dark);

  const wheel = (r, w) => merge([
    paint(place(new THREE.CylinderGeometry(r, r, w, 20), { rz: 90 }), '#20262a'),
    paint(place(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.04, 12), { rz: 90 }), PALETTE.gold),
  ]);
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const axle = (r, w, z, track) => {
    const m = new THREE.Mesh(merge([place(wheel(r, w), { x: track }), place(wheel(r, w), { x: -track })]), wheelMat);
    m.position.set(0, r, z);
    m.castShadow = true;
    return m;
  };
  const front = axle(1.05, 0.7, 2.2, 2.05), rear = axle(0.72, 0.55, -2.7, 1.7);

  for (const m of [body, units, cab, fill, lidar]) m.castShadow = true;
  g.add(body, units, cab, cageMesh, fill, strips, lidar, front, rear);
  g.userData = { front, rear, fill };
  return g;
}

function serpentine(passes) {
  const rowX = (i) => A.x0 + ROW / 2 + i * ROW;
  const zN = A.z0 - 9, zS = A.z1 + 9, turn = (ROWS_PER_PASS * ROW) / 2;
  const pts = [];
  const ranges = [];
  for (let p = 0; p < passes; p++) {
    const x = rowX(p * ROWS_PER_PASS + 1.5);
    const north = p % 2 === 0;
    ranges.push({ start: pts.length, x, north, rows: [0, 1, 2, 3].map((k) => p * ROWS_PER_PASS + k) });
    pts.push(new THREE.Vector3(x, 0, north ? zS : zN), new THREE.Vector3(x, 0, north ? zN : zS));
    if (p < passes - 1) {
      const arc = north ? arcPoints(x + turn, zN, turn, Math.PI, Math.PI * 2) : arcPoints(x + turn, zS, turn, Math.PI, 0);
      pts.push(...arc.slice(1, -1));
    }
  }
  // Return along the southern headland to the first row.
  const last = pts[pts.length - 1];
  const x0 = rowX(1.5);
  pts.push(new THREE.Vector3(last.x - 4, 0, zS + 8), new THREE.Vector3(x0 + 4, 0, zS + 8), new THREE.Vector3(x0, 0, zS + 2));
  const path = new Path(pts, true);
  for (const rg of ranges) {
    rg.s0 = path.cum[rg.start];
    rg.s1 = path.cum[rg.start + 1];
  }
  return { path, ranges };
}

export function buildFields(scene) {
  const { x0, x1, z0, z1 } = ZONES.fields;
  // Packed-earth farm tracks under everything, then the parcels.
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0 + 16, z1 - z0 + 16).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#b8a17c', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  base.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  base.receiveShadow = true;
  scene.add(base);
  const rows = cottonRowTexture(), stubble = cottonRowTexture({ harvested: true });
  // Rows texture under the instanced plants too, so the parcel still reads as cotton from afar.
  parcel(scene, rows, A.x0, A.x1, A.z0, A.z1, 0.05);
  parcel(scene, rows, x0, A.x0 - 6, A.z0, A.z1, 0.05);
  parcel(scene, stubble, x0, A.x0 - 6, z0, A.z0 - 6, 0.05);
  parcel(scene, rows, A.x0, A.x1, z0, A.z0 - 6, 0.05);

  // Instanced plants: foliage and bolls are separate so harvested plants lose only their bolls.
  const nRows = Math.round((A.x1 - A.x0) / ROW);
  const perRow = Math.floor((A.z1 - A.z0) / STEP);
  const count = nRows * perRow;
  const { leaves, bolls } = plantGeometries();
  const leafMesh = new THREE.InstancedMesh(leaves, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), count);
  const bollMesh = new THREE.InstancedMesh(bolls, new THREE.MeshStandardMaterial({ color: '#fffdf6', roughness: 0.9, emissive: '#fffaf0', emissiveIntensity: 0.08 }), count);
  leafMesh.receiveShadow = true;
  const r = mulberry32(21);
  const plants = new Float32Array(count * 4); // x, z, scale, yaw
  const col = new THREE.Color();
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < perRow; j++) {
      const k = i * perRow + j;
      const x = A.x0 + ROW / 2 + i * ROW + (r() - 0.5) * 0.3;
      const z = A.z0 + STEP / 2 + j * STEP + (r() - 0.5) * 0.6;
      const s = 0.85 + r() * 0.4, yaw = r() * 6.28;
      plants.set([x, z, s, yaw], k * 4);
      setInstance(leafMesh, k, x, 0.05, z, yaw, s * 1.15, s, s * 1.15);
      setInstance(bollMesh, k, x, 0.05, z, yaw, s * 1.15, s, s * 1.15);
      col.setHSL((88 + r() * 30) / 360, 0.42 + r() * 0.15, 0.26 + r() * 0.1, THREE.SRGBColorSpace);
      leafMesh.setColorAt(k, col);
    }
  }
  leafMesh.computeBoundingSphere();
  bollMesh.computeBoundingSphere();
  scene.add(leafMesh, bollMesh);

  // Harvester on a serpentine route, 4 rows per pass.
  const passes = Math.ceil(nRows / ROWS_PER_PASS);
  const { path, ranges } = serpentine(passes);
  const harvester = buildHarvester();
  scene.add(harvester);
  const picked = new Uint8Array(count);
  let pickedCount = 0, regrow = -1;
  const SPEED = 3.2;
  let s = (ranges[5].s0 + ranges[5].s1) / 2; // start mid-field so it is visible right away
  const pos = new THREE.Vector3(), dir = new THREE.Vector3();
  let yaw = null;

  const hideBoll = (k) => {
    picked[k] = 1;
    pickedCount++;
    const b = k * 4;
    setInstance(bollMesh, k, plants[b], 0.05, plants[b + 1], plants[b + 3], 0, 0, 0);
  };
  const harvestRows = (rg, zHead) => {
    let changed = false;
    for (const row of rg.rows) {
      if (row >= nRows) continue;
      for (let j = 0; j < perRow; j++) {
        const k = row * perRow + j;
        if (picked[k]) continue;
        const z = plants[k * 4 + 1];
        if (zHead === null || (rg.north ? z > zHead : z < zHead)) { hideBoll(k); changed = true; }
      }
    }
    return changed;
  };
  // Fields already picked before the starting point.
  for (const rg of ranges) if (rg.s1 <= s) harvestRows(rg, null);
  bollMesh.instanceMatrix.needsUpdate = true;

  function update(dt) {
    const prev = s;
    s = (s + SPEED * dt) % path.length;
    if (s < prev) regrow = 0; // a new season: the bolls grow back
    path.at(s, pos);
    path.dirAt(s + 1.5, dir);
    const target = Math.atan2(dir.x, dir.z);
    if (yaw === null) yaw = target;
    let d = target - yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw += d * Math.min(1, dt * 3);
    harvester.position.copy(pos);
    harvester.rotation.y = yaw;
    const { front, rear, fill } = harvester.userData;
    front.rotation.x += (SPEED / 1.05) * dt;
    rear.rotation.x += (SPEED / 0.72) * dt;

    let changed = false;
    for (const rg of ranges) {
      if (s >= rg.s0 && s <= rg.s1) changed = harvestRows(rg, pos.z + (rg.north ? -5.6 : 5.6)) || changed;
    }
    if (regrow >= 0) {
      regrow += dt / 5;
      const g = Math.min(1, regrow);
      for (let k = 0; k < count; k++) {
        if (!picked[k]) continue;
        const b = k * 4, sc = plants[b + 2] * g;
        setInstance(bollMesh, k, plants[b], 0.05, plants[b + 1], plants[b + 3], sc * 1.15, sc, sc * 1.15);
        if (g >= 1) picked[k] = 0;
      }
      if (g >= 1) { regrow = -1; pickedCount = 0; }
      changed = true;
    }
    if (changed) bollMesh.instanceMatrix.needsUpdate = true;
    // The basket fills with the cotton picked this season.
    const level = 0.08 + 0.92 * Math.min(1, ((pickedCount / count) * 4) % 1.0001);
    fill.scale.y = THREE.MathUtils.lerp(fill.scale.y, level * 2.6, Math.min(1, dt * 2));
  }

  return { update, harvester, plants: count };
}
