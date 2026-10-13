// Vegetation and water: tree belts and alleys, shrubs, flower beds, the lake with reeds.
import * as THREE from 'three';
import { heightAt, plotDist, zoneDist, lakeE, LAKE, ZONES } from './terrain.js';
import { mulberry32, fbm } from './noise.js';
import { blob, merge, paint, place, setInstance } from './geo.js';
import { waterNormalTexture, flowerBedTexture } from './textures.js';

const TYPES = ['round', 'poplar', 'spruce', 'willow'];

/** Is (x, z) free for vegetation? Keeps roads, fields, solar farms and the lake clear. */
function free(x, z, pad = 0) {
  if (zoneDist('fields', x, z) < 8 + pad) return false;
  if (zoneDist('solarNW', x, z) < 14 + pad || zoneDist('solarNE', x, z) < 14 + pad) return false;
  if (zoneDist('highway', x, z) < 2 + pad) return false;
  if (zoneDist('access', x, z) < 6 + pad) return false;
  if (lakeE(x, z) < 1.1) return false;
  return true;
}

function planTrees() {
  const r = mulberry32(42);
  const list = [];
  const add = (type, x, z, s) => list.push({ type, x, z, s, k: r() });

  // Forest belts and patches outside the fence (jittered grid, clumped by noise).
  for (let gx = -1500; gx <= 1500; gx += 13) {
    for (let gz = -1300; gz <= 900; gz += 13) {
      const x = gx + (r() - 0.5) * 10, z = gz + (r() - 0.5) * 10;
      const pd = plotDist(x, z);
      if (pd < 24 || !free(x, z)) continue;
      const clump = fbm(x * 0.006, z * 0.006, 3);
      const h = heightAt(x, z);
      if (h > 230) continue;
      const rr = Math.hypot(x, z);
      let p;
      if (pd < 70) p = 0.32 + clump * 0.3;                // belt hugging the fence
      else if (rr < 900) p = clump > 0.25 ? 0.1 : 0.004;  // scattered groves
      else p = clump > 0.2 ? 0.07 : 0.0;                  // foothill forest
      if (r() > p) continue;
      const type = rr > 850 || h > 60 ? 'spruce' : r() < 0.7 ? 'round' : 'poplar';
      add(type, x, z, 0.8 + r() * 0.5);
    }
  }
  // Poplar rows along the highway (classic steppe roadside alleys).
  for (let x = -900; x <= 900; x += 14) {
    if (Math.abs(x) < 40) continue;
    for (const z of [ZONES.highway.z0 + 4, ZONES.highway.z1 - 4]) if (lakeE(x, z) > 1.15) add('poplar', x + (r() - 0.5) * 2, z, 0.85 + r() * 0.3);
  }
  // Planted alleys inside the fence.
  for (let z = -248; z <= 226; z += 16) for (const x of [-296.5, 296.5]) add('round', x, z, 0.7 + r() * 0.2);
  for (let x = -280; x <= 280; x += 16) add('round', x, -258, 0.7 + r() * 0.2);
  for (let x = 44; x <= 280; x += 16) for (const sx of [-1, 1]) add('poplar', sx * x, 234, 0.75 + r() * 0.15);
  // Willows and round trees around the lake.
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, e = 1.18 + r() * 0.55;
    const x = LAKE.x + Math.cos(a) * LAKE.rx * e, z = LAKE.z + Math.sin(a) * LAKE.rz * e;
    if (free(x, z) && plotDist(x, z) > 24) add(r() < 0.6 ? 'willow' : 'round', x, z, 0.8 + r() * 0.4);
  }
  return list;
}

function crownGeometry(type) {
  switch (type) {
    case 'poplar': return place(blob(1.7, 2, 0.12, 3), { y: 9, sy: 4.2 });
    case 'spruce': {
      const tiers = [];
      for (let i = 0; i < 4; i++) {
        tiers.push(place(new THREE.ConeGeometry(3.6 - i * 0.75, 4.6, 9, 1), { y: 3.6 + i * 2.6, ry: i * 20 }));
      }
      return merge(tiers);
    }
    case 'willow': return place(blob(3.6, 2, 0.16, 7), { y: 5.2, sy: 0.75 });
    default: return merge([
      place(blob(3.2, 2, 0.16, 1), { y: 6.2 }),
      place(blob(2.2, 1, 0.18, 2), { x: 1.8, y: 5.2, z: 0.6 }),
      place(blob(2.0, 1, 0.18, 5), { x: -1.5, y: 5.6, z: -0.9 }),
    ]);
  }
}

const TRUNK_H = { round: 3.6, poplar: 4, spruce: 2.4, willow: 3.2 };
const COLORS = {
  round: [[95, 125], [32, 50], [26, 38]],
  poplar: [[78, 105], [38, 55], [30, 42]],
  spruce: [[140, 165], [28, 40], [18, 26]],
  willow: [[75, 100], [30, 45], [36, 48]],
};

/** All trees: the planned belts/alleys plus `extra` spots requested by the site ({type, x, z, s}). */
export function buildTrees(scene, extra = []) {
  const plan = [...planTrees(), ...extra];
  const r = mulberry32(5);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, 6, 1).translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6b5240', roughness: 0.9 }), plan.length);
  trunks.castShadow = true;
  const crowns = {};
  const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0 });
  for (const t of TYPES) {
    const n = plan.filter((p) => p.type === t).length;
    const m = new THREE.InstancedMesh(crownGeometry(t), crownMat, Math.max(1, n));
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    crowns[t] = m;
  }
  const col = new THREE.Color();
  plan.forEach((p, i) => {
    const y = heightAt(p.x, p.z) - 0.4;
    const ry = r() * Math.PI * 2;
    setInstance(trunks, i, p.x, y, p.z, ry, p.s, TRUNK_H[p.type] * p.s, p.s);
    const m = crowns[p.type];
    setInstance(m, m.count, p.x, y, p.z, ry, p.s, p.s * (0.9 + r() * 0.2), p.s);
    const [hh, ss, ll] = COLORS[p.type];
    col.setHSL((hh[0] + r() * (hh[1] - hh[0])) / 360, (ss[0] + r() * (ss[1] - ss[0])) / 100,
      (ll[0] + r() * (ll[1] - ll[0])) / 100, THREE.SRGBColorSpace);
    m.setColorAt(m.count, col);
    m.count++;
  });
  trunks.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  for (const m of Object.values(crowns)) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    scene.add(m);
  }
  trunks.computeBoundingSphere();
  return { count: plan.length };
}

export function buildShrubsAndFlowers(scene) {
  const r = mulberry32(77);
  // Shrubs along the outside of the fence and around the lake.
  const spots = [];
  const { x0, x1, z0, z1 } = ZONES.plot;
  const ring = (step, off) => {
    for (let x = x0; x <= x1; x += step) { spots.push([x, z0 - off]); spots.push([x, z1 + off]); }
    for (let z = z0; z <= z1; z += step) { spots.push([x0 - off, z]); spots.push([x1 + off, z]); }
  };
  ring(7, 6);
  ring(11, 12);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, e = 1.08 + r() * 0.25;
    spots.push([LAKE.x + Math.cos(a) * LAKE.rx * e, LAKE.z + Math.sin(a) * LAKE.rz * e]);
  }
  const shrubSpots = spots.filter(([x, z]) => free(x, z) && !(Math.abs(x) < 44 && z > 200));
  const shrubs = new THREE.InstancedMesh(place(blob(1, 1, 0.2, 9), { y: 0.55, sy: 0.75 }),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), shrubSpots.length);
  shrubs.castShadow = shrubs.receiveShadow = true;
  const col = new THREE.Color();
  shrubSpots.forEach(([x, z], i) => {
    const s = 0.8 + r() * 0.9;
    setInstance(shrubs, i, x + (r() - 0.5) * 2, heightAt(x, z), z + (r() - 0.5) * 2, r() * 6, s * 1.3, s, s * 1.2);
    col.setHSL((95 + r() * 40) / 360, 0.38 + r() * 0.15, 0.22 + r() * 0.12, THREE.SRGBColorSpace);
    shrubs.setColorAt(i, col);
  });
  scene.add(shrubs);

  // Flower beds lining the access road to the gate.
  const beds = [];
  for (let z = 252; z <= 292; z += 10) for (const x of [-19, 19]) beds.push([x, z, 2.6, 7]);
  beds.push([-34, 262, 10, 16], [34, 262, 10, 16]);
  const flowers = new THREE.InstancedMesh(place(new THREE.BoxGeometry(0.92, 0.42, 0.92), { y: 0.21 }),
    new THREE.MeshStandardMaterial({ map: flowerBedTexture(), roughness: 0.8 }), beds.length);
  const border = new THREE.InstancedMesh(place(new THREE.BoxGeometry(1, 0.3, 1), { y: 0.15 }),
    new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.7 }), beds.length);
  flowers.receiveShadow = border.receiveShadow = true;
  beds.forEach(([x, z, w, d], i) => {
    setInstance(flowers, i, x, 0, z, 0, w, 1, d);
    setInstance(border, i, x, 0, z, 0, w, 1, d);
  });
  scene.add(flowers, border);
  return { shrubs: shrubSpots.length, beds: beds.length };
}

export function buildLake(scene) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, LAKE.rx * 1.02, LAKE.rz * 1.02, 0, Math.PI * 2, false, 0);
  const geo = new THREE.ShapeGeometry(shape, 96);
  geo.rotateX(-Math.PI / 2);
  const n1 = waterNormalTexture();
  n1.repeat.set(1 / 38, 1 / 38);
  const n2 = n1.clone();
  n2.repeat.set(1 / 23, 1 / 23);
  n2.needsUpdate = true;
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#1f6f78', roughness: 0.08, metalness: 0.05,
    normalMap: n1, normalScale: new THREE.Vector2(0.45, 0.45),
    clearcoat: 1, clearcoatRoughness: 0.04, clearcoatNormalMap: n2, clearcoatNormalScale: new THREE.Vector2(0.3, 0.3),
    transparent: true, opacity: 0.93, envMapIntensity: 1.2,
  });
  const water = new THREE.Mesh(geo, mat);
  water.position.set(LAKE.x, LAKE.water, LAKE.z);
  water.receiveShadow = true;
  water.renderOrder = 1;
  scene.add(water);

  // Reeds along the shoreline: clusters of thin leaning blades with cattail heads.
  const r = mulberry32(13);
  const parts = [];
  for (let k = 0; k < 7; k++) {
    const h = 1.6 + r() * 1.1;
    parts.push(paint(place(new THREE.ConeGeometry(0.05, h, 4, 1), {
      x: (r() - 0.5) * 0.9, y: h / 2, z: (r() - 0.5) * 0.9, rx: (r() - 0.5) * 18, rz: (r() - 0.5) * 18,
    }), '#7f9a4a'));
    if (k < 3) parts.push(paint(place(new THREE.CapsuleGeometry(0.06, 0.28, 2, 5), { x: (r() - 0.5) * 0.6, y: h * 0.9, z: (r() - 0.5) * 0.6 }), '#6b4a2e'));
  }
  const reedGeo = merge(parts);
  const count = 300;
  const reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), count);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, e = 0.9 + r() * 0.13;
    const x = LAKE.x + Math.cos(a) * LAKE.rx * e, z = LAKE.z + Math.sin(a) * LAKE.rz * e;
    const s = 0.8 + r() * 0.6;
    setInstance(reeds, i, x, Math.max(heightAt(x, z), LAKE.water - 0.3), z, r() * 6, s * 1.4, s, s * 1.4);
  }
  reeds.castShadow = true;
  scene.add(reeds);

  return {
    update(dt) {
      n1.offset.x += dt * 0.012; n1.offset.y += dt * 0.006;
      n2.offset.x -= dt * 0.008; n2.offset.y += dt * 0.011;
    },
  };
}
