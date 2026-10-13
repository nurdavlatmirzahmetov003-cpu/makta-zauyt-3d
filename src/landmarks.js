// Special buildings: administration, showroom dome, laboratory, oil tank farm, biogas plant, canteen,
// dormitory, shop, rest park, truck parking, guard house — plus the «Ақ Маржан» monument & fountain.
import * as THREE from 'three';
import { Batch, box, cyl, merge, place, blob } from './geo.js';
import { mats, TILE, registerGlow } from './materials.js';
import { Building, sideFrame, wallPiece, bandPieces, flatRoof, buildWalls, finishRoof, T, PARAPET, resolveSpec } from './buildings.js';
import { signGeometry } from './signs.js';
import { dashTexture } from './textures-site.js';
import { PALETTE } from './data.js';

const DEG = Math.PI / 180;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Extra tree spots requested by landmarks (planted by nature.plantTrees). */
export const treeSpots = [];

function facadeSign(S, signs, spec, id, y, h, maxW, side = 'S', push = 0.12) {
  const rect = signs.rect(id);
  if (!rect) return null;
  const f = sideFrame(spec, side);
  const sg = signGeometry(rect, f.o[0] + f.out[0] * push, y, f.o[1] + f.out[1] * push, f.ry, h, maxW);
  S.add('sign', sg.face);
  S.add('dark', sg.back);
  return sg;
}

/** Free-standing sign on two posts, facing +Z rotated by ry. */
function postSign(S, signs, id, x, z, y, h, maxW, ry = 0) {
  const sg = signGeometry(signs.rect(id), x, y, z, ry, h, maxW);
  S.add('sign', sg.face);
  S.add('dark', sg.back);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of [-0.38, 0.38]) S.add('steel', box(0.18, y, 0.18, x + c * sg.w * k - s * 0.15, y / 2, z - s * sg.w * k - c * 0.15));
  return sg;
}

function roofGroup(scene, id) {
  const g = new THREE.Group();
  g.name = `roof:${id}`;
  scene.add(g);
  return g;
}

/* ---------- Administration: 6-storey glass office, solar-glass fins, roof garden ---------- */
function admin(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const s = { ...spec, w: 44, d: 26, h: 24 };
  const { cx, cz, w, d, h } = s;
  S.add('glass', box(w - 0.6, h, d - 0.6, cx, h / 2, cz));
  for (let k = 1; k <= 6; k++) S.add('white', box(w + 0.9, 0.35, d + 0.9, cx, k * 4 - 0.17, cz));
  // Vertical solar-glass fins on the long façades.
  for (const sz of [-1, 1]) {
    for (let x = -w / 2 + 1.1; x <= w / 2 - 1; x += 2.2) S.add('solarRoof', box(0.22, h - 4.4, 1.3, cx + x, 2.2 + (h - 4.4) / 2 + 2, cz + sz * (d / 2 + 0.75)));
  }
  S.add('green', box(0.35, h - 6, d - 6, cx + w / 2 + 0.25, 3 + (h - 6) / 2, cz));
  S.add('glowTeal', box(w + 1.1, 0.2, 0.25, cx, h + 1.2, cz + d / 2 + 0.45), box(w + 1.1, 0.2, 0.25, cx, h + 1.2, cz - d / 2 - 0.45),
    box(0.25, 0.2, d + 1.1, cx + w / 2 + 0.45, h + 1.2, cz), box(0.25, 0.2, d + 1.1, cx - w / 2 - 0.45, h + 1.2, cz));
  S.add('white', box(w + 0.9, 1.2, 0.3, cx, h + 0.6, cz + d / 2 + 0.3), box(w + 0.9, 1.2, 0.3, cx, h + 0.6, cz - d / 2 - 0.3),
    box(0.3, 1.2, d + 0.9, cx + w / 2 + 0.3, h + 0.6, cz), box(0.3, 1.2, d + 0.9, cx - w / 2 - 0.3, h + 0.6, cz));
  // Entrance canopy with the sign on top.
  const ez = cz + d / 2 + 4;
  S.add('white', box(16, 0.45, 7, cx, 4.6, ez));
  S.add('glowTeal', box(16.1, 0.12, 0.12, cx, 4.35, ez + 3.5));
  for (const sx of [-1, 1]) S.add('steel', box(0.35, 4.4, 0.35, cx + sx * 7, 2.2, ez + 3));
  const rect = signs.rect(spec.id);
  const sg = signGeometry(rect, cx, 5.75, ez + 3.3, 0, 1.7, 15.5);
  S.add('sign', sg.face);
  S.add('dark', sg.back);
  // Roof garden (openable roof group).
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  R.add('roof', box(w - 0.6, 0.4, d - 0.6, cx, h + 0.2, cz));
  R.add('lawn', box(w - 5, 0.5, d - 5, cx, h + 0.55, cz));
  R.add('deck', box(w - 10, 0.12, 3, cx, h + 0.86, cz));
  for (let i = 0; i < 9; i++) {
    const x = cx - w / 2 + 4 + i * ((w - 8) / 8), z = cz + (i % 2 ? -1 : 1) * (d / 2 - 4.5);
    R.add('green', place(blob(1.1, 1, 0.22, i), { x, y: h + 1.4, z, sy: 0.8 }));
  }
  for (let i = 0; i < 5; i++) {
    const x = cx - 14 + i * 7;
    R.add('steel', box(0.15, 3, 0.15, x, h + 2.3, cz - 3), box(0.15, 3, 0.15, x, h + 2.3, cz + 3));
  }
  R.add('white', box(30, 0.2, 7, cx, h + 3.9, cz));
  finishRoof(R, materials, roof, spec.id);
  props.addTower(spec.id, cx + w / 2 - 4, h + 0.4, cz - d / 2 + 4);
  // Bus stop on the avenue in front of the building.
  const bx = -17.5, bz = 62;
  S.add('white', box(3, 0.2, 9, bx, 2.9, bz), box(0.12, 2.8, 0.12, bx - 1.3, 1.4, bz - 4.3), box(0.12, 2.8, 0.12, bx - 1.3, 1.4, bz + 4.3));
  S.add('clearGlass', box(0.08, 2.4, 8.4, bx - 1.35, 1.5, bz));
  S.add('deck', box(0.7, 0.12, 5, bx - 0.6, 0.5, bz));
  S.add('glowTeal', box(3.05, 0.08, 0.08, bx, 2.78, bz + 4.5));
  treeSpots.push(...[[-60, 50], [-40, 50], [-24, 50], [-60, 90], [-40, 90], [-24, 88]].map(([x, z]) => ({ type: 'round', x, z, s: 0.7 })));
  return new Building({ ...s, h: h + 1 }, roof, interior, props);
}

/* ---------- Showroom: glass dome on a podium ---------- */
function showroom(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const { cx, cz } = spec;
  const r = 18, base = 1.4;
  S.add('white', cyl(r + 1.2, r + 1.6, base, cx, base / 2, cz, 64));
  S.add('glowTeal', place(new THREE.TorusGeometry(r + 1.25, 0.12, 6, 96), { x: cx, y: base, z: cz, rx: 90 }));
  S.add('paving', cyl(r, r, 0.1, cx, base + 0.05, cz, 64));
  // Entrance portal (south).
  S.add('white', box(9, 6, 2.2, cx, base + 3, cz + r - 0.2));
  S.add('glass', box(6, 4.4, 0.2, cx, base + 2.2, cz + r + 0.9));
  S.add('glowTeal', box(9.1, 0.15, 0.15, cx, base + 6, cz + r + 0.95));
  postSign(S, signs, spec.id, cx, cz + r + 8, 2.8, 1.8, 16);
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  R.add('clearGlass', place(new THREE.SphereGeometry(r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), { x: cx, y: base, z: cz }));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = (k / 16) * (Math.PI / 2) * 0.96;
      pts.push(V3(cx + Math.cos(a) * Math.cos(t) * (r + 0.08), base + Math.sin(t) * (r + 0.08), cz + Math.sin(a) * Math.cos(t) * (r + 0.08)));
    }
    R.add('white', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.16, 5, false));
  }
  for (const t of [0.35, 0.75]) {
    R.add('gold', place(new THREE.TorusGeometry((r + 0.1) * Math.cos(t), 0.12, 5, 96), { x: cx, y: base + (r + 0.1) * Math.sin(t), z: cz, rx: 90 }));
  }
  R.add('glowTeal', place(new THREE.TorusGeometry(r * 0.12, 0.2, 6, 32), { x: cx, y: base + r * 0.995, z: cz, rx: 90 }));
  R.add('white', cyl(r * 0.1, r * 0.12, 1.2, cx, base + r + 0.4, cz, 24));
  finishRoof(R, materials, roof, spec.id);
  interior.visible = true; // the dome is transparent: its interior is always on show
  const b = new Building({ ...spec, w: 2 * r, d: 2 * r, h: r + base }, roof, interior, null);
  b.keepInterior = true;
  return b;
}

/* ---------- Laboratory: white volume, round windows, observatory dome ---------- */
function lab(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const s = resolveSpec({ ...spec, h: 12 });
  const { cx, cz, w, d, h } = s;
  const top = h + PARAPET;
  const ops = { S: [{ off: 0, w: 3, h: 3.2, y: 0 }], E: [{ off: 0, w: 4.2, h: 4.2, y: 2.4 }], W: [{ off: 0, w: 4.2, h: 4.2, y: 2.4 }], N: [] };
  for (const side of ['S', 'N', 'E', 'W']) {
    const f = sideFrame(s, side);
    const half = side === 'E' || side === 'W' ? f.len / 2 - T : f.len / 2;
    bandPieces(S, 'white', f, half, 0, top, ops[side].map((o) => ({ ...o, side })));
    S.add('glowTeal', wallPiece(f, -half - 0.08, half + 0.08, top - 0.02, top + 0.18, T + 0.16));
    // Round windows in two rows.
    for (const y of [3.6, 8.4]) {
      for (let sp = -half + 3; sp <= half - 3; sp += 3.6) {
        if (ops[side].some((o) => Math.abs(o.off - sp) < o.w / 2 + 1.2 && y < o.y + o.h + 1.2)) continue;
        const x = f.o[0] + f.along[0] * sp + f.out[0] * 0.03, z = f.o[1] + f.along[1] * sp + f.out[1] * 0.03;
        S.add('glass', new THREE.CircleGeometry(0.95, 24).rotateY(f.ry).translate(x, y, z));
        S.add('steel', new THREE.TorusGeometry(1.0, 0.1, 6, 24).rotateY(f.ry).translate(x + f.out[0] * 0.04, y, z + f.out[1] * 0.04));
      }
    }
  }
  S.add('glass', wallPiece(sideFrame(s, 'S'), -1.5, 1.5, 0, 3.2, 0.08, -0.12));
  S.add('floor', box(w - T * 2, 0.16, d - T * 2, cx, 0.08, cz));
  facadeSign(S, signs, s, spec.id, 11, 1.6, 14);
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  R.add('roof', box(w - T * 2, 0.5, d - T * 2, cx, h - 0.25, cz));
  const ox = cx + 8, oz = cz - 6;
  R.add('white', cyl(5, 5, 2.4, ox, h + 1.2, oz, 32), place(new THREE.SphereGeometry(5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), { x: ox, y: h + 2.4, z: oz }));
  R.add('dark', box(1.2, 4.6, 0.3, ox, h + 4.6, oz + 2.2, 0, -0.55));
  R.add('glowTeal', place(new THREE.TorusGeometry(5.02, 0.1, 6, 48), { x: ox, y: h + 2.4, z: oz, rx: 90 }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    R.add('solar', box(3.4, 0.06, 1.9, cx - 14 + i * 4.2, h + 0.6, cz + 4 + j * 3.2, 0, 10 * DEG));
  }
  finishRoof(R, materials, roof, spec.id);
  props.addTower(spec.id, cx - w / 2 + 5, h, cz - d / 2 + 5);
  return new Building(s, roof, interior, props);
}

/* ---------- Oil tank farm (open air) ---------- */
function tanks(spec, ctx) {
  const { S, interior, signs } = ctx;
  const { cx, cz } = spec;
  const R = 8, H = 22;
  const centers = [[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([x, z]) => [cx + x, cz + z]);
  for (const [x, z] of centers) {
    S.add('tank', cyl(R, R, H, x, H / 2, z, 48));
    S.add('tank', place(new THREE.SphereGeometry(R, 48, 8, 0, Math.PI * 2, 0, 0.35), { x, y: H - R * Math.cos(0.35), z }));
    for (const [k, y] of [4, 9, 14, 19].entries()) S.add(k % 2 ? 'steel' : 'gold', place(new THREE.TorusGeometry(R + 0.04, 0.12, 6, 64), { x, y, z, rx: 90 }));
    S.add('steel', place(new THREE.TorusGeometry(R - 0.4, 0.06, 4, 48), { x, y: H + 1.6, z, rx: 90 }));
    for (let a = 0; a < 16; a++) S.add('steel', box(0.06, 1.1, 0.06, x + Math.cos(a / 16 * 6.283) * (R - 0.4), H + 1.05, z + Math.sin(a / 16 * 6.283) * (R - 0.4)));
    // Caged ladder on the south side.
    const lz = z + R + 0.35;
    S.add('steel', box(0.07, H + 1.5, 0.07, x - 0.35, (H + 1.5) / 2, lz), box(0.07, H + 1.5, 0.07, x + 0.35, (H + 1.5) / 2, lz));
    for (let y = 0.4; y < H + 1.2; y += 0.45) S.add('steel', box(0.7, 0.04, 0.04, x, y, lz));
    for (let y = 3; y < H + 1; y += 1.6) S.add('steel', place(new THREE.TorusGeometry(0.55, 0.035, 3, 10, Math.PI), { x, y, z: lz, rx: 90, rz: 180 }));
  }
  // Catwalks between the tank roofs.
  for (const [a, b] of [[0, 1], [2, 3], [0, 2], [1, 3]]) {
    const [x0, z0] = centers[a], [x1, z1] = centers[b];
    const horiz = z0 === z1;
    const len = (horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0)) - 2 * R + 2;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    S.add('steel', horiz ? box(len, 0.15, 1.2, mx, H + 0.4, mz) : box(1.2, 0.15, len, mx, H + 0.4, mz));
    S.add('steel', horiz ? box(len, 0.06, 0.06, mx, H + 1.4, mz - 0.6) : box(0.06, 0.06, len, mx - 0.6, H + 1.4, mz));
  }
  // Containment bund and pipe manifold.
  const bw = 48, bd = 44;
  S.add('concrete', box(bw, 1.3, 0.4, cx, 0.65, cz - bd / 2), box(bw, 1.3, 0.4, cx, 0.65, cz + bd / 2),
    box(0.4, 1.3, bd, cx - bw / 2, 0.65, cz), box(0.4, 1.3, bd, cx + bw / 2, 0.65, cz));
  S.add('gold', cyl(0.35, 0.35, bw - 2, cx, 2.6, cz, 12, 0, 90 * DEG), cyl(0.25, 0.25, bw - 2, cx, 3.4, cz + 1, 12, 0, 90 * DEG));
  S.add('apron', box(bw - 0.8, 0.08, bd - 0.8, cx, 0.04, cz));
  // Tanker loading gantry on the N street side.
  const gz = cz - bd / 2 - 6;
  for (const x of [cx - 12, cx + 12]) S.add('steel', box(0.6, 9, 0.6, x, 4.5, gz));
  S.add('white', box(26, 1.2, 3.5, cx, 9.4, gz));
  S.add('glowTeal', box(26.1, 0.12, 0.12, cx, 8.8, gz + 1.8));
  for (const x of [cx - 6, cx + 6]) {
    S.add('gold', cyl(0.18, 0.18, 4, x, 7.6, gz - 1.6, 10, 30 * DEG, 0));
    S.add('steel', box(1.1, 0.6, 1.1, x, 9, gz));
  }
  postSign(S, signs, spec.id, cx, cz + bd / 2 + 2.5, 3.2, 1.9, 46);
  interior.visible = true;
  const b = new Building({ ...spec, w: bw, d: bd, h: H + 2 }, null, interior, null);
  b.keepInterior = true;
  return b;
}

/* ---------- Biogas & waste recycling: hall + two membrane digesters ---------- */
function biogas(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const s = resolveSpec({ ...spec, cx: spec.cx - 14, w: 22, d: 40, h: 10, openings: [{ side: 'W', off: 0, w: 4.2, h: 4.2, y: 2.4, kind: 'portal' }, { side: 'S', off: 0, w: 2.4, h: 3, y: 0, kind: 'door' }] });
  const { glassTop, top } = buildWalls(s, S);
  facadeSign(S, signs, s, spec.id, (glassTop + top) / 2, 1.2, 20);
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  flatRoof(R, s, props);
  finishRoof(R, materials, roof, spec.id);
  for (const dz of [-11, 11]) {
    const x = spec.cx + 13, z = spec.cz + dz;
    S.add('concrete', cyl(9.8, 10, 1.4, x, 0.7, z, 48));
    S.add('membrane', place(new THREE.SphereGeometry(9.5, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 1.4, z, sy: 0.82 }));
    S.add('glowTeal', place(new THREE.TorusGeometry(9.85, 0.12, 6, 64), { x, y: 1.45, z, rx: 90 }));
    S.add('steel', cyl(0.4, 0.4, 1.4, x, 1.4 + 9.5 * 0.82 + 0.4, z, 12));
    S.add('gold', cyl(0.3, 0.3, 12, x - 10, 2.2, z, 10, 0, 90 * DEG));
  }
  return new Building({ ...spec, w: 50, d: 46, h: 10 }, roof, interior, props);
}

/* ---------- Canteen with a big terrace and parasols ---------- */
function canteen(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const s = resolveSpec({ ...spec, w: 36, d: 22, h: 7, wall: 'glass', openings: [{ side: 'S', off: 0, w: 4, h: 3, y: 0, kind: 'door' }, { side: 'N', off: 10, w: 3, h: 3, y: 0, kind: 'door' }] });
  const { glassTop, top } = buildWalls(s, S);
  facadeSign(S, signs, s, spec.id, (glassTop + top) / 2 + 0.1, 1.5, 12);
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  flatRoof(R, s, props);
  R.add('white', box(s.w + 4, 0.35, 4, s.cx, s.h + 0.1, s.cz + s.d / 2 + 2));
  finishRoof(R, materials, roof, spec.id);
  const tz = s.cz + s.d / 2 + 8;
  S.add('deck', box(s.w + 2, 0.3, 14, s.cx, 0.15, tz));
  for (let i = 0; i < 8; i++) {
    const x = s.cx - 15 + (i % 4) * 10, z = tz - 3 + Math.floor(i / 4) * 6.5;
    S.add('steel', cyl(0.06, 0.06, 2.6, x, 1.6, z, 6));
    S.add(i % 2 ? 'tealFabric' : 'fabric', place(new THREE.ConeGeometry(2.3, 0.75, 10, 1, true), { x, y: 3.1, z }));
    S.add('white', cyl(0.65, 0.65, 0.06, x, 1.05, z, 16), cyl(0.08, 0.08, 0.75, x, 0.68, z, 6));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4;
      S.add('graphite', box(0.45, 0.5, 0.45, x + Math.cos(a) * 1.15, 0.55, z + Math.sin(a) * 1.15));
    }
  }
  for (let x = -17; x <= 17; x += 4.25) S.add('green', box(3, 0.7, 0.9, s.cx + x, 0.65, tz + 6.6));
  return new Building(s, roof, interior, props);
}

/* ---------- Staff dormitory: two 4-storey blocks with balconies ---------- */
function dorm(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  const w = 44, d = 12, fh = 3.5, floors = 4, h = fh * floors;
  for (const dz of [-15, 15]) {
    const s = { id: spec.id, cx: spec.cx, cz: spec.cz + dz, w, d, h };
    for (const side of ['S', 'N', 'E', 'W']) {
      const f = sideFrame(s, side);
      const half = side === 'E' || side === 'W' ? f.len / 2 - T : f.len / 2;
      const door = side === 'S' ? [{ off: 0, w: 2.4, h: 2.6, y: 0 }] : [];
      for (let k = 0; k < floors; k++) {
        const y0 = k * fh;
        bandPieces(S, 'panel', f, half, y0, y0 + 0.9, k === 0 ? door : []);
        bandPieces(S, 'glass', f, half, y0 + 0.9, y0 + 2.8, k === 0 ? door : [], T * 0.6);
        S.add('panel', wallPiece(f, -half, half, y0 + 2.8, y0 + fh));
      }
      S.add('panel', wallPiece(f, -half, half, h, h + PARAPET));
      S.add('glowTeal', wallPiece(f, -half - 0.08, half + 0.08, h + PARAPET - 0.02, h + PARAPET + 0.18, T + 0.16));
    }
    // Balconies with glass railings on the south façade.
    for (let k = 1; k < floors; k++) {
      for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 4.4) {
        S.add('white', box(3.4, 0.22, 1.5, s.cx + x, k * fh, s.cz + d / 2 + 0.75));
        S.add('clearGlass', box(3.4, 1.0, 0.05, s.cx + x, k * fh + 0.6, s.cz + d / 2 + 1.48));
        S.add('glowWarm', box(3.4, 0.05, 0.05, s.cx + x, k * fh + 1.12, s.cz + d / 2 + 1.48));
      }
    }
    S.add('floor', box(w - 1, 0.16, d - 1, s.cx, 0.08, s.cz));
    R.add('roof', box(w - T * 2, 0.5, d - T * 2, s.cx, h - 0.25, s.cz));
    for (let i = 0; i < 9; i++) R.add('solar', box(3.6, 0.06, 2, s.cx - 18 + i * 4.5, h + 0.6, s.cz + 1, 0, 10 * DEG));
    props.addTower(spec.id, s.cx + w / 2 - 3, h, s.cz - 2);
    if (dz > 0) facadeSign(S, signs, s, spec.id, h + 0.15 - 0.2, 1.3, 30);
  }
  S.add('paving', box(30, 0.1, 18, spec.cx, 0.05, spec.cz));
  finishRoof(R, materials, roof, spec.id);
  return new Building({ ...spec, w, d: 42, h }, roof, interior, props);
}

/* ---------- Factory shop ---------- */
function shop(spec, ctx) {
  const { S, materials, props, interior, scene, signs } = ctx;
  const s = resolveSpec({ ...spec, w: 28, d: 18, h: 6.5, wall: 'glass', openings: [{ side: 'S', off: 0, w: 4, h: 3, y: 0, kind: 'door' }] });
  const { glassTop, top } = buildWalls(s, S);
  facadeSign(S, signs, s, spec.id, (glassTop + top) / 2 + 0.05, 1.3, 14);
  const roof = roofGroup(scene, spec.id);
  const R = new Batch();
  flatRoof(R, s, props);
  R.add('white', box(s.w + 5, 0.3, s.d + 5, s.cx, s.h + 0.2, s.cz));
  finishRoof(R, materials, roof, spec.id);
  S.add('paving', box(40, 0.1, 30, s.cx, 0.05, s.cz + 4));
  treeSpots.push({ type: 'round', x: s.cx - 18, z: s.cz + 14, s: 0.7 }, { type: 'round', x: s.cx + 18, z: s.cz + 14, s: 0.7 });
  return new Building(s, roof, interior, props);
}

/* ---------- Rest park with pond, pergola and benches ---------- */
function park(spec, ctx) {
  const { S, interior, signs, scene } = ctx;
  const { cx, cz } = spec;
  S.add('paving', place(new THREE.RingGeometry(18, 21, 64, 1), { x: cx, y: 0.06, z: cz, rx: -90, sx: 1.7 }));
  S.add('paving', box(3, 0.1, 22, cx + 22, 0.06, cz + 14), box(30, 0.1, 3, cx, 0.06, cz - 21));
  S.add('curb', place(new THREE.RingGeometry(14.5, 15.4, 64, 1), { x: cx, y: 0.25, z: cz, rx: -90, sx: 1.4 }));
  S.add('curb', place(new THREE.CylinderGeometry(15.4, 15.4, 0.5, 64, 1, true), { x: cx, y: 0, z: cz, sx: 1.4 }));
  const water = new THREE.Mesh(place(new THREE.CircleGeometry(14.6, 64), { rx: -90, sx: 1.4 }), mats().water);
  water.position.set(cx, 0.15, cz);
  water.receiveShadow = true;
  scene.add(water);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = cx + Math.cos(a) * 19.5 * 1.7, z = cz + Math.sin(a) * 19.5;
    S.add('deck', box(1.8, 0.1, 0.5, x, 0.5, z, -a + Math.PI / 2));
    S.add('graphite', box(0.1, 0.45, 0.45, x, 0.25, z, -a + Math.PI / 2));
  }
  for (let i = 0; i < 6; i++) {
    const x = cx - 15 + i * 6;
    S.add('white', box(0.25, 3, 0.25, x, 1.5, cz - 24), box(0.25, 3, 0.25, x, 1.5, cz - 28));
  }
  S.add('white', box(32, 0.25, 5, cx, 3.1, cz - 26));
  S.add('green', box(31, 0.35, 4.6, cx, 3.4, cz - 26));
  // Park sign on a low stone monolith at the entrance.
  const rect = signs.rect(spec.id);
  S.add('concrete', box(10, 1.6, 0.8, cx + 30, 0.8, cz + 22));
  const sg = signGeometry(rect, cx + 30, 0.85, cz + 22.42, 0, 1.1, 9.4);
  S.add('sign', sg.face);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.2;
    treeSpots.push({ type: i % 3 ? 'round' : 'willow', x: cx + Math.cos(a) * 25 * 1.55, z: cz + Math.sin(a) * 24, s: 0.75 });
  }
  interior.visible = true;
  const b = new Building({ ...spec, w: 80, d: 46, h: 4 }, null, interior, null);
  b.keepInterior = true;
  return b;
}

/* ---------- Truck parking with EV chargers and a solar carport ---------- */
function truckpark(spec, ctx) {
  const { S, interior, signs } = ctx;
  const { cx, cz } = spec;
  const w = 70, d = 40, x0 = cx - w / 2, z0 = cz - d / 2;
  S.add('asphalt', box(w, 0.06, d, cx, 0.05, cz));
  for (let i = 0; i <= 14; i++) S.add('marking', box(0.15, 0.02, 18, x0 + i * 5, 0.09, z0 + 2 + 9));
  S.add('marking', box(w, 0.02, 0.15, cx, 0.09, z0 + 20));
  for (let i = 0; i < 14; i++) {
    const x = x0 + 2.5 + i * 5;
    S.add('white', box(0.6, 1.9, 0.45, x, 0.95, z0 + 1));
    S.add('glowTeal', box(0.4, 0.5, 0.05, x, 1.35, z0 + 1.24));
  }
  for (let x = x0 + 2; x <= x0 + w - 2; x += 11.5) S.add('steel', box(0.3, 5.4, 0.3, x, 2.7, z0 + 2.2));
  S.add('solarRoof', box(w, 0.25, 5.5, cx, 5.5, z0 + 2.5, 0, -6 * DEG));
  S.add('glowTeal', box(w, 0.08, 0.08, cx, 5.25, z0 + 5.2));
  postSign(S, signs, spec.id, cx - 10, cz + d / 2 + 2, 2.6, 1.6, 28);
  interior.visible = true;
  const b = new Building({ ...spec, w, d, h: 6 }, null, interior, null);
  b.keepInterior = true;
  return b;
}

/* ---------- Guard house on the gate island ---------- */
function guard(spec, ctx) {
  const { S, materials, interior, scene, signs } = ctx;
  const { cx, cz } = spec;
  S.add('glass', box(4.4, 3.2, 7.4, cx, 1.8, cz));
  S.add('graphite', box(4.6, 0.25, 7.6, cx, 0.32, cz));
  S.add('white', box(6.2, 0.4, 9.4, cx, 3.6, cz));
  S.add('glowTeal', box(6.3, 0.12, 9.5, cx, 3.35, cz));
  const sg = signGeometry(signs.rect(spec.id), cx, 4.4, cz + 4.75, 0, 0.9, 6);
  S.add('sign', sg.face);
  S.add('dark', sg.back);
  const sg2 = signGeometry(signs.rect(spec.id), cx, 4.4, cz - 4.75, Math.PI, 0.9, 6);
  S.add('sign', sg2.face);
  S.add('dark', sg2.back);
  return new Building({ ...spec, w: 6, d: 9, h: 4 }, null, interior, null);
}

export const SPECIALS = { admin, showroom, lab, tanks, biogas, canteen, dorm, shop, park, truckpark, guard };

/* ---------- «Ақ Маржан» monument on the roundabout, with a fountain ---------- */
export function buildMonument(scene, signs, cx = 0, cz = 95) {
  const m = mats();
  const S = new Batch();
  S.add('curb', cyl(13, 13.1, 0.35, cx, 0.17, cz, 72));
  S.add('lawn', cyl(12.6, 12.6, 0.42, cx, 0.21, cz, 72));
  S.add('white', cyl(8.6, 8.8, 0.95, cx, 0.47, cz, 72));
  S.add('glowTeal', place(new THREE.TorusGeometry(8.7, 0.1, 6, 96), { x: cx, y: 0.96, z: cz, rx: 90 }));
  S.add('white', cyl(3.8, 4.0, 1.2, cx, 1.2, cz, 48), cyl(2.9, 3.1, 2.8, cx, 3.2, cz, 48));
  S.add('gold', place(new THREE.TorusGeometry(3.85, 0.1, 6, 64), { x: cx, y: 1.82, z: cz, rx: 90 }));
  S.add('glowTeal', place(new THREE.TorusGeometry(2.95, 0.12, 6, 64), { x: cx, y: 4.62, z: cz, rx: 90 }));
  const sg = signGeometry(signs.rect('monument'), cx, 3.1, cz + 3.08, 0, 0.85, 4.2);
  S.add('sign', sg.face);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    S.add('green', place(blob(1, 1, 0.2, i), { x: cx + Math.cos(a) * 11, y: 0.6, z: cz + Math.sin(a) * 11, sy: 0.6 }));
  }
  const group = new THREE.Group();
  scene.add(group);
  S.build({ ...m, sign: signs.material }, TILE, group, { name: 'monument' });

  // The glowing cotton boll: five lobes, dry bracts, a short stem.
  const cottonMat = new THREE.MeshStandardMaterial({ color: PALETTE.cotton, emissive: '#fff4dc', emissiveIntensity: 0.3, roughness: 0.88 });
  registerGlow(cottonMat, 0.3, 1.5);
  const bractMat = new THREE.MeshStandardMaterial({ color: '#5e4730', roughness: 0.8 });
  const by = 6.3;
  // Five locks radiating from the centre (elongated outwards, tilted up) plus a crown lock.
  const lockParts = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * Math.PI * 2;
    return blob(1.6, 2, 0.12, k + 1)
      .scale(1, 0.9, 1.3).rotateX(-18 * DEG).translate(0, 0.6, 1.25)
      .rotateY(Math.PI / 2 - a);
  });
  lockParts.push(place(blob(1.5, 2, 0.12, 7), { y: 1.9 }));
  const lobes = merge(lockParts);
  const boll = new THREE.Mesh(lobes, cottonMat);
  boll.position.set(cx, by, cz);
  boll.castShadow = true;
  // Dry bracts splay outwards like a five-pointed cup under the locks (base at the stem top).
  const bractParts = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * Math.PI * 2 + Math.PI / 5; // between the locks
    return blob(0.9, 1, 0.1, k + 9)
      .scale(0.8, 2.2, 0.16).translate(0, 1.9, 0)   // pointed leaf, base at the origin
      .rotateX(70 * DEG)                             // lean outwards (+Z)…
      .rotateY(Math.PI / 2 - a)                      // …in the direction of angle a
      .translate(Math.cos(a) * 0.5, -0.7, Math.sin(a) * 0.5);
  });
  bractParts.push(place(new THREE.CylinderGeometry(0.55, 0.8, 1.0, 12), { y: -1.15 })); // short neck on the pedestal
  const bracts = new THREE.Mesh(merge(bractParts), bractMat);
  bracts.position.set(cx, by, cz);
  bracts.castShadow = true;
  group.add(boll, bracts);

  // Fountain: parabolic jets arcing from the basin rim towards the pedestal, with flowing stripes.
  const dash = dashTexture();
  dash.repeat.set(5, 1);
  const jetMat = new THREE.MeshBasicMaterial({ color: '#e4fbff', map: dash, transparent: true, opacity: 0.6, depthWrite: false });
  const jets = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, rr = 7.8 - t * 3.8;
      pts.push(V3(cx + Math.cos(a) * rr, 0.95 + Math.sin(t * Math.PI) * 3.6 - t * 0.3, cz + Math.sin(a) * rr));
    }
    jets.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 5, false));
  }
  const jetMesh = new THREE.Mesh(merge(jets), jetMat);
  const water = new THREE.Mesh(cyl(8.25, 8.25, 0.08, cx, 0.86, cz, 72), m.water);
  water.receiveShadow = true;
  group.add(jetMesh, water);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      dash.offset.x -= dt * 1.6;
      boll.rotation.y = Math.sin(t * 0.25) * 0.25;
      boll.scale.setScalar(1 + Math.sin(t * 1.3) * 0.015);
      const n = m.water.userData.normal;
      if (n) { n.offset.x += dt * 0.02; n.offset.y += dt * 0.015; }
    },
  };
}
