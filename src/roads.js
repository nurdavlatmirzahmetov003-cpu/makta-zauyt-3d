// Road network: asphalt with world-space UVs (seamless overlaps), rounded corners (R ≥ 12 m),
// a roundabout with the monument, lane markings, zebra crossings, stop lines, sidewalks with curbs,
// street lamps (glow at night), road signs, the staff car park, industrial aprons and the highway.
import * as THREE from 'three';
import { Batch, box, rectXZ, shapeXZ, place, blob, setInstance, merge } from './geo.js';
import { mats, TILE } from './materials.js';
import { atlasPlane } from './signs.js';

// axis 'x' = runs along X (constant z = c); axis 'z' = runs along Z (constant x = c).
export const ROADS = [
  { id: 'A', axis: 'z', c: 0, a0: -245, a1: 336, w: 22, avenue: true },
  { id: 'S2', axis: 'x', c: -10, a0: -285, a1: 285, w: 14 },
  { id: 'S1', axis: 'x', c: -85, a0: -285, a1: 285, w: 14 },
  { id: 'N', axis: 'x', c: -245, a0: -285, a1: 285, w: 14 },
  { id: 'W', axis: 'z', c: -285, a0: -245, a1: 205, w: 14 },
  { id: 'E', axis: 'z', c: 285, a0: -245, a1: 205, w: 14 },
  { id: 'S3', axis: 'x', c: 205, a0: -285, a1: 285, w: 12 },
  { id: 'HW', axis: 'x', c: 336, a0: -1700, a1: 1700, w: 18, highway: true },
  { id: 'D1', axis: 'z', c: -145, a0: -10, a1: 12, w: 9, minor: true },
  { id: 'D2', axis: 'x', c: 80, a0: 225, a1: 285, w: 10, minor: true },
];
export const ROUNDABOUT = { x: 0, z: 95, rIn: 13, rOut: 22 };
export const MEDIANS = [[40, 73.2], [116.8, 150]];
export const GATE_ZONE = [212, 266];
/** Zebra crossings for robot path-finding (Phase 5): centre, walking axis and length. */
export const ZEBRAS = [];

const Y_ASPHALT = 0.06, Y_MARK = 0.075, SIDEWALK = 3, CURB_H = 0.2;

const isX = (r) => r.axis === 'x';
const perp = (a, b) => a.axis !== b.axis;
/** Do roads a and b actually meet? */
function meets(a, b) {
  if (!perp(a, b)) return false;
  return b.c >= a.a0 - 1 && b.c <= a.a1 + 1 && a.c >= b.a0 - 1 && a.c <= b.a1 + 1;
}
const crossings = (r) => ROADS.filter((o) => meets(r, o));
const filletR = (a, b) => (a.minor || b.minor ? 6 : 12);

/** Subtract blocked intervals from [a0, a1]. */
function freeIntervals(a0, a1, blocks) {
  let out = [[a0, a1]];
  for (const [b0, b1] of blocks) {
    const next = [];
    for (const [s, e] of out) {
      if (b1 <= s || b0 >= e) { next.push([s, e]); continue; }
      if (b0 > s) next.push([s, b0]);
      if (b1 < e) next.push([b1, e]);
    }
    out = next;
  }
  return out.filter(([s, e]) => e - s > 0.5);
}

/** World position of (along, offset) on a road. */
const P = (r, a, off) => (isX(r) ? [a, r.c + off] : [r.c + off, a]);

/** Box lying along a road: along a0..a1, across off0..off1, thickness and height. */
function along(r, a0, a1, off0, off1, y, h) {
  const [x, z] = P(r, (a0 + a1) / 2, (off0 + off1) / 2);
  return isX(r) ? box(a1 - a0, h, off1 - off0, x, y, z) : box(off1 - off0, h, a1 - a0, x, y, z);
}

function line(B, key, r, off, intervals, { width = 0.15, dash = 0, gap = 0 } = {}) {
  for (const [s, e] of intervals) {
    if (!dash) { B.add(key, along(r, s, e, off - width / 2, off + width / 2, Y_MARK, 0.02)); continue; }
    for (let a = s; a + dash <= e; a += dash + gap) B.add(key, along(r, a, a + dash, off - width / 2, off + width / 2, Y_MARK, 0.02));
  }
}

function asphalt(B) {
  for (const r of ROADS) {
    // Extend each end by half the width of the road it ends on, so corners are filled.
    let a0 = r.a0, a1 = r.a1;
    for (const o of crossings(r)) {
      if (Math.abs(o.c - r.a0) < 1) a0 = r.a0 - o.w / 2;
      if (Math.abs(o.c - r.a1) < 1) a1 = r.a1 + o.w / 2;
    }
    const [x0, z0] = P(r, a0, -r.w / 2), [x1, z1] = P(r, a1, r.w / 2);
    B.add('asphalt', rectXZ(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1), Y_ASPHALT));
  }
  // Rounded corners.
  for (const H of ROADS.filter(isX)) {
    for (const V of ROADS.filter((r) => !isX(r))) {
      if (!meets(H, V)) continue;
      const R = filletR(H, V);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const hExt = sx > 0 ? H.a1 > V.c + V.w / 2 + 2 : H.a0 < V.c - V.w / 2 - 2;
          const vExt = sz > 0 ? V.a1 > H.c + H.w / 2 + 2 : V.a0 < H.c - H.w / 2 - 2;
          if (hExt && vExt) B.add('asphalt', fillet(V.c + sx * V.w / 2, H.c + sz * H.w / 2, sx, sz, R));
        }
      }
    }
  }
  // Roundabout disc and flared approaches.
  const { x: rx, z: rz, rOut } = ROUNDABOUT;
  B.add('asphalt', new THREE.CircleGeometry(rOut, 72).rotateX(-Math.PI / 2).translate(rx, Y_ASPHALT, rz));
  for (const s of [-1, 1]) for (const sz of [-1, 1]) B.add('asphalt', roundaboutFlare(s, sz));
}

function arcTo(shape, ox, oz, r, from, to) {
  const a0 = Math.atan2(from[1] - oz, from[0] - ox), a1 = Math.atan2(to[1] - oz, to[0] - ox);
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  shape.absarc(ox, oz, r, a0, a0 + d, d < 0);
}

function fillet(cx, cz, sx, sz, R) {
  return shapeXZ((s) => {
    const p1 = [cx + sx * R, cz], p2 = [cx, cz + sz * R];
    s.moveTo(cx, cz);
    s.lineTo(...p1);
    arcTo(s, cx + sx * R, cz + sz * R, R, p1, p2);
    s.lineTo(cx, cz);
  }, Y_ASPHALT, 10);
}

function roundaboutFlare(s, sz) {
  const { x: ox, z: oz, rOut } = ROUNDABOUT;
  const half = 11, Rf = 8;
  const zB = oz + sz * Math.sqrt(rOut * rOut - half * half);
  const fx = s * (half + Rf), fz = oz + sz * Math.sqrt((rOut + Rf) ** 2 - (half + Rf) ** 2);
  const t1 = [ox + s * half, fz];
  const k = rOut / (rOut + Rf);
  const t2 = [ox + fx * k, oz + (fz - oz) * k];
  return shapeXZ((sh) => {
    sh.moveTo(...t1);
    sh.lineTo(ox + s * half, zB);
    arcTo(sh, ox, oz, rOut, [ox + s * half, zB], t2);
    arcTo(sh, ox + fx, fz, Rf, t2, t1);
  }, Y_ASPHALT, 10);
}

function blocksFor(r, pad) {
  const blocks = crossings(r).map((o) => [o.c - o.w / 2 - pad(o), o.c + o.w / 2 + pad(o)]);
  if (r.avenue) blocks.push([ROUNDABOUT.z - ROUNDABOUT.rOut - 6, ROUNDABOUT.z + ROUNDABOUT.rOut + 6]);
  return blocks;
}

function markings(B) {
  for (const r of ROADS) {
    const blocks = blocksFor(r, (o) => (o.minor || r.minor ? 1 : 9));
    const free = freeIntervals(r.a0, r.a1, blocks);
    if (r.highway) {
      line(B, 'marking', r, -0.18, free); line(B, 'marking', r, 0.18, free);
      for (const o of [-4.4, 4.4]) line(B, 'marking', r, o, free, { dash: 4, gap: 8 });
      for (const o of [-8.4, 8.4]) line(B, 'marking', r, o, free, { width: 0.2 });
      continue;
    }
    if (r.avenue) {
      const out = freeIntervals(r.a0, r.a1, [...blocks, ...MEDIANS, GATE_ZONE]);
      line(B, 'marking', r, -0.2, out); line(B, 'marking', r, 0.2, out);
      for (const o of [-4.6, 4.6]) line(B, 'marking', r, o, out, { dash: 3, gap: 6 });
      const teal = freeIntervals(r.a0, 212, blocks);
      for (const o of [-1, 1]) {
        line(B, 'marking', r, o * 9, teal, { width: 0.18 });
        for (const [s, e] of teal) B.add('paintTeal', along(r, s, e, o > 0 ? 9.1 : -10.9, o > 0 ? 10.9 : -9.1, Y_MARK - 0.004, 0.02));
      }
      // Lanes through the gate (two in, two out) separated by solid lines.
      line(B, 'marking', r, -7, [GATE_ZONE]); line(B, 'marking', r, 7, [GATE_ZONE]);
      continue;
    }
    if (r.minor) { line(B, 'marking', r, 0, free, { dash: 2, gap: 3 }); continue; }
    line(B, 'marking', r, 0, free, { dash: 3, gap: 4 });
    for (const o of [-1, 1]) line(B, 'marking', r, o * (r.w / 2 - 0.7), free);
  }
  // Zebra crossings and stop lines on every leg of the main intersections.
  for (const H of ROADS.filter(isX)) {
    for (const V of ROADS.filter((r) => !isX(r))) {
      if (!meets(H, V) || H.minor || V.minor || H.highway) continue;
      for (const sx of [-1, 1]) {
        if (!(sx > 0 ? H.a1 > V.c + V.w / 2 + 2 : H.a0 < V.c - V.w / 2 - 2)) continue;
        const xc = V.c + sx * (V.w / 2 + 4.5);
        zebra(B, xc, H.c, 'z', H.w);
        B.add('marking', box(0.45, 0.02, H.w / 2 - 0.8, V.c + sx * (V.w / 2 + 8), Y_MARK, H.c - sx * (H.w / 4)));
      }
      for (const sz of [-1, 1]) {
        if (!(sz > 0 ? V.a1 > H.c + H.w / 2 + 2 : V.a0 < H.c - H.w / 2 - 2)) continue;
        const zc = H.c + sz * (H.w / 2 + 4.5);
        zebra(B, V.c, zc, 'x', V.w);
        B.add('marking', box(V.w / 2 - 0.8, 0.02, 0.45, V.c + sz * (V.w / 4), Y_MARK, H.c + sz * (H.w / 2 + 8)));
      }
    }
  }
  // Crossings on the roundabout approaches.
  for (const sz of [-1, 1]) zebra(B, 0, ROUNDABOUT.z + sz * (ROUNDABOUT.rOut + 4), 'x', 22);
}

/** Zebra centred at (x, z); pedestrians walk along `walk` across a road of width `len`. */
function zebra(B, x, z, walk, len) {
  ZEBRAS.push({ x, z, walk, len });
  for (let o = -len / 2 + 0.8; o <= len / 2 - 0.8; o += 1.2) {
    B.add('marking', walk === 'z' ? box(4, 0.02, 0.6, x, Y_MARK, z + o) : box(0.6, 0.02, 4, x + o, Y_MARK, z));
  }
}

function sidewalks(B, lampSpots, treeSpots) {
  for (const r of ROADS) {
    if (r.highway || r.minor) continue;
    const blocks = blocksFor(r, (o) => filletR(r, o));
    const free = freeIntervals(r.a0, r.a1, blocks);
    for (const s of [-1, 1]) {
      const o0 = s * r.w / 2, o1 = s * (r.w / 2 + SIDEWALK);
      for (const [a, b] of free) {
        B.add('paving', along(r, a, b, Math.min(o0, o1), Math.max(o0, o1), CURB_H / 2, CURB_H));
        B.add('curb', along(r, a, b, s > 0 ? o0 : o0 - 0.25, s > 0 ? o0 + 0.25 : o0, (CURB_H + 0.04) / 2, CURB_H + 0.04));
        for (let p = a + 8; p < b - 4; p += 32) lampSpots.push({ r, a: p, side: s });
      }
    }
  }
  // Ring sidewalks around the roundabout (east and west sectors).
  const { x: ox, z: oz, rOut } = ROUNDABOUT;
  for (const c of [0, Math.PI]) {
    const a0 = c - 0.72, a1 = c + 0.72;
    B.add('paving', shapeXZ((s) => {
      s.absarc(ox, oz, rOut + SIDEWALK, a0, a1, false);
      s.absarc(ox, oz, rOut, a1, a0, true);
    }, CURB_H, 24));
    const cylA = Math.PI / 2 - a1;
    B.add('curb', new THREE.CylinderGeometry(rOut + 0.01, rOut + 0.01, CURB_H + 0.04, 24, 1, true, cylA, a1 - a0).translate(ox, CURB_H / 2, oz));
    for (const a of [c - 0.5, c, c + 0.5]) lampSpots.push({ x: ox + Math.cos(a) * (rOut + 2.4), z: oz + Math.sin(a) * (rOut + 2.4), ry: Math.PI - a });
  }
  // Avenue medians with shrubs and small trees.
  for (const [z0, z1] of MEDIANS) {
    B.add('curb', box(6, 0.3, z1 - z0, 0, 0.15, (z0 + z1) / 2));
    B.add('lawn', box(5.4, 0.36, z1 - z0 - 0.6, 0, 0.18, (z0 + z1) / 2));
    for (let z = z0 + 4; z < z1 - 3; z += 9) treeSpots.push({ type: 'round', x: 0, z, s: 0.55 });
    for (let z = z0 + 2; z < z1 - 1; z += 3) B.add('green', place(blob(0.7, 1, 0.2, z), { x: (z % 2 ? 1.6 : -1.6), y: 0.55, z, sy: 0.7 }));
  }
  // Avenue tree alleys (south zone) and a green buffer along S2.
  for (const sx of [-1, 1]) {
    for (let z = 22; z <= 198; z += 12) if (z < 62 || z > 128) treeSpots.push({ type: 'round', x: sx * 16.6, z, s: 0.62 });
    for (let x = 24; x <= 270; x += 16) if (Math.abs(sx * x + 145) > 14) treeSpots.push({ type: x % 32 ? 'round' : 'poplar', x: sx * x, z: 3.6, s: 0.6 });
  }
}

/* ---------- Street lamps (instanced) ---------- */
function lamps(scene, spots) {
  const m = mats();
  const pole = merge([
    place(new THREE.CylinderGeometry(0.11, 0.17, 8, 8), { y: 4 }),
    place(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 8), { y: 0.15 }),
    place(new THREE.BoxGeometry(1.7, 0.12, 0.14), { x: 0.8, y: 8.0 }),
  ]);
  const head = place(new THREE.BoxGeometry(0.95, 0.16, 0.4), { x: 1.45, y: 7.9 });
  const ring = place(new THREE.TorusGeometry(0.16, 0.05, 6, 12), { y: 3.2, rx: 90 });
  const n = spots.length;
  const P1 = new THREE.InstancedMesh(pole, m.steel, n), P2 = new THREE.InstancedMesh(head, m.glowWarm, n), P3 = new THREE.InstancedMesh(ring, m.glowTeal, n);
  spots.forEach((s, i) => {
    let x, z, ry;
    if (s.r) {
      [x, z] = P(s.r, s.a, s.side * (s.r.w / 2 + 2.4));
      ry = isX(s.r) ? s.side * Math.PI / 2 : (s.side > 0 ? Math.PI : 0);
    } else ({ x, z, ry } = s);
    for (const im of [P1, P2, P3]) setInstance(im, i, x, CURB_H, z, ry);
  });
  P1.castShadow = true;
  for (const im of [P1, P2, P3]) { im.computeBoundingSphere(); scene.add(im); }
  return n;
}

/* ---------- Road signs (pictogram atlas) ---------- */
function roadSigns(B, safety) {
  const add = (type, x, z, ry) => {
    B.add('safety', atlasPlane(safety.rect(type), 0.85, 1.2).rotateY(ry).translate(x, 2.6, z));
    B.add('steel', box(0.08, 3.2, 0.08, x - Math.sin(ry) * 0.05, 1.6, z - Math.cos(ry) * 0.05));
  };
  for (const zb of ZEBRAS) {
    if (zb.walk === 'z') add('crossing', zb.x, zb.z - zb.len / 2 - 1.2, Math.PI / 2);
    else add('crossing', zb.x + zb.len / 2 + 1.2, zb.z, 0);
  }
  add('speed', 13, 6, 0);
  add('helmet', 13, -6, 0);
  add('speed', -13, -20, Math.PI);
  add('stop', -140, -2, 0);
  add('stop', 278, 86, -Math.PI / 2);
  add('ev', -118, 12, 0);
}

/* ---------- Car park, aprons and plazas ---------- */
function grounds(B) {
  B.add('apron', rectXZ(-296, 296, -258, -3, 0.03));
  B.add('paving', rectXZ(-118, -14, 44, 96, 0.04), rectXZ(14, 118, 44, 100, 0.04));
  // Staff car park with EV bays.
  B.add('asphalt', rectXZ(-170, -120, 10, 40, Y_ASPHALT));
  for (let i = 0; i <= 19; i++) {
    const x = -170 + 1 + i * 2.5;
    B.add('marking', box(0.12, 0.02, 5.5, x, Y_MARK, 13.2), box(0.12, 0.02, 5.5, x, Y_MARK, 36.8));
  }
  for (let i = 0; i < 6; i++) {
    const x = -168.5 + i * 2.5;
    B.add('white', box(0.4, 1.5, 0.3, x + 1.25, 0.75, 10.4));
    B.add('glowTeal', box(0.3, 0.35, 0.04, x + 1.25, 1.1, 10.57));
  }
}

export function buildRoads(scene, safety) {
  const m = mats();
  const B = new Batch();
  const lampSpots = [], treeSpots = [];
  ZEBRAS.length = 0;
  asphalt(B);
  markings(B);
  sidewalks(B, lampSpots, treeSpots);
  grounds(B);
  // Highway lamps near the junction only.
  for (const x of [-90, -45, 45, 90]) for (const s of [-1, 1]) lampSpots.push({ x, z: 336 + s * 11.4, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
  roadSigns(B, safety);
  B.build({ ...m, safety: safety.material }, TILE, scene, { name: 'roads', castShadow: false });
  const lampCount = lamps(scene, lampSpots);
  return { treeSpots, lampCount };
}
