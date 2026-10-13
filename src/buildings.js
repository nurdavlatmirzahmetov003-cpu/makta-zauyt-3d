// Production-building generator: walls with openings, glass ribbons, green walls, glowing contours,
// openable roofs (flat / sawtooth / vault) with solar panels, clean-air towers and rooftop fans.
import * as THREE from 'three';
import { BUILDINGS, ROWS } from './data.js';
import { mats, TILE } from './materials.js';
import { Batch, box, polygon, merge, place } from './geo.js';
import { signGeometry } from './signs.js';

const T = 0.4;            // wall thickness
const PARAPET = 1.0;
const FADE = 0.8;         // roof fade duration (s)
const DEG = Math.PI / 180;

/** Expand defaults (row → cz, standard footprint). */
export function resolveSpec(s) {
  return { w: 50, d: 46, h: 14, roof: 'flat', wall: 'panel', openings: [], green: [], cz: ROWS[s.row] ?? 0, ...s };
}

/* ---------- Instanced rooftop props shared by every roof ---------- */
class RoofProps {
  constructor(scene) {
    const m = mats();
    // «Таза ауа мұнарасы»: a slender, closed purifier tower with a halo crown (never a chimney).
    const profile = [[0, 0], [1.3, 0], [1.3, 0.8], [0.95, 1.2], [0.62, 7], [0.5, 11.6], [0.95, 12.4], [2.1, 13.1], [2.1, 13.45], [1.2, 13.9], [0.55, 14.5], [0, 14.7]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const towerGeo = new THREE.LatheGeometry(profile, 28);
    const ringGeo = merge([
      ...[3.2, 5.6, 8.0, 10.4].map((y) => place(new THREE.TorusGeometry(0.98 - y * 0.035, 0.13, 8, 28), { y, rx: 90 })),
      place(new THREE.TorusGeometry(2.0, 0.16, 8, 40), { y: 12.95, rx: 90 }),
    ]);
    // Dark louvre band of the intake under the halo.
    const capGeo = place(new THREE.CylinderGeometry(1.0, 0.62, 0.9, 28, 1, true), { y: 12.1 });
    const housingGeo = merge([
      place(new THREE.CylinderGeometry(1.7, 1.8, 0.9, 24, 1, true), { y: 0.45 }),
      place(new THREE.TorusGeometry(1.72, 0.08, 6, 24), { y: 0.92, rx: 90 }),
      place(new THREE.BoxGeometry(3.4, 0.12, 0.12), { y: 0.95 }),
    ]);
    const bladeGeo = merge([0, 1, 2, 3, 4].map((k) => place(new THREE.BoxGeometry(1.5, 0.04, 0.42), { x: 0.8, y: 0.7, ry: k * 72, rx: 14 }).rotateY(k * 72 * DEG)));
    const N = 160;
    this.towers = new THREE.InstancedMesh(towerGeo, m.white, N);
    this.rings = new THREE.InstancedMesh(ringGeo, m.glowTeal, N);
    this.caps = new THREE.InstancedMesh(capGeo, m.dark, N);
    this.housings = new THREE.InstancedMesh(housingGeo, m.steel, N * 2);
    this.blades = new THREE.InstancedMesh(bladeGeo, m.dark, N * 2);
    for (const im of [this.towers, this.rings, this.caps, this.housings, this.blades]) {
      im.count = 0;
      im.castShadow = im !== this.rings;
      scene.add(im);
    }
    this.tlist = [];
    this.flist = [];
    this.dummy = new THREE.Object3D();
  }
  addTower(owner, x, y, z) { this.tlist.push({ owner, x, y, z, s: 1 }); }
  addFan(owner, x, y, z) { this.flist.push({ owner, x, y, z, s: 1, a: Math.random() * 6, v: 2.5 + Math.random() * 2 }); }
  setScale(owner, s) {
    for (const t of this.tlist) if (t.owner === owner) t.s = s;
    for (const f of this.flist) if (f.owner === owner) f.s = s;
    this.writeTowers();
  }
  writeTowers() {
    const d = this.dummy;
    this.tlist.forEach((t, i) => {
      d.position.set(t.x, t.y, t.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(t.s || 1e-4, t.s || 1e-4, t.s || 1e-4);
      d.updateMatrix();
      this.towers.setMatrixAt(i, d.matrix);
      this.rings.setMatrixAt(i, d.matrix);
      this.caps.setMatrixAt(i, d.matrix);
    });
    for (const im of [this.towers, this.rings, this.caps]) { im.count = this.tlist.length; im.instanceMatrix.needsUpdate = true; }
  }
  finish() {
    this.writeTowers();
    for (const im of [this.towers, this.rings, this.caps]) im.computeBoundingSphere();
    this.update(0);
    this.housings.computeBoundingSphere();
    this.blades.computeBoundingSphere();
  }
  update(dt) {
    const d = this.dummy;
    this.flist.forEach((f, i) => {
      f.a += f.v * dt;
      const s = f.s || 1e-4;
      d.position.set(f.x, f.y, f.z);
      d.scale.set(s, s, s);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.housings.setMatrixAt(i, d.matrix);
      d.rotation.set(0, f.a, 0);
      d.updateMatrix();
      this.blades.setMatrixAt(i, d.matrix);
    });
    this.housings.count = this.blades.count = this.flist.length;
    this.housings.instanceMatrix.needsUpdate = this.blades.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- Walls ---------- */

// Local side frame: along = unit vector of the wall run, out = outward normal.
function sideFrame(spec, side) {
  const { cx, cz, w, d } = spec;
  switch (side) {
    case 'S': return { len: w, o: [cx, cz + d / 2], along: [1, 0], out: [0, 1], ry: 0 };
    case 'N': return { len: w, o: [cx, cz - d / 2], along: [-1, 0], out: [0, -1], ry: Math.PI };
    case 'E': return { len: d, o: [cx + w / 2, cz], along: [0, -1], out: [1, 0], ry: Math.PI / 2 };
    default: return { len: d, o: [cx - w / 2, cz], along: [0, 1], out: [-1, 0], ry: -Math.PI / 2 };
  }
}

/** Box lying in a wall: s0..s1 along the side, y0..y1 high, `depth` thick, pushed `push` outwards. */
function wallPiece(f, s0, s1, y0, y1, depth = T, push = -T / 2) {
  const sm = (s0 + s1) / 2;
  const x = f.o[0] + f.along[0] * sm + f.out[0] * push;
  const z = f.o[1] + f.along[1] * sm + f.out[1] * push;
  return box(s1 - s0, y1 - y0, depth, x, (y0 + y1) / 2, z, f.ry);
}

export function bands(h, wall) {
  if (wall === 'glass') return { low: 0.8, glassTop: h - 1.2 };
  const low = Math.min(8, Math.max(5.5, h * 0.48));
  return { low, glassTop: Math.min(h - 1.2, low + Math.min(3.4, h * 0.24)) };
}

/**
 * One horizontal wall band (y0..y1) along a side, with every opening that overlaps it cut out.
 */
function bandPieces(S, key, f, half, y0, y1, ops, depth = T, push = -T / 2) {
  let s = -half;
  for (const o of ops) {
    const a = Math.max(-half, o.off - o.w / 2), b = Math.min(half, o.off + o.w / 2);
    const oy0 = o.y, oy1 = o.y + o.h;
    if (oy1 <= y0 || oy0 >= y1) continue; // opening does not reach this band
    if (a > s) S.add(key, wallPiece(f, s, a, y0, y1, depth, push));
    if (oy0 > y0) S.add(key, wallPiece(f, a, b, y0, oy0, depth, push));
    if (oy1 < y1) S.add(key, wallPiece(f, a, b, oy1, y1, depth, push));
    s = b;
  }
  if (s < half) S.add(key, wallPiece(f, s, half, y0, y1, depth, push));
}

function buildWalls(spec, S) {
  const { h, wall } = spec;
  const { low, glassTop } = bands(h, wall);
  const top = h + PARAPET;
  const lowKey = wall === 'glass' ? 'graphite' : 'panel';
  for (const side of ['S', 'N', 'E', 'W']) {
    const f = sideFrame(spec, side);
    // E/W walls sit between the S/N walls to avoid overlapping corners.
    const half = side === 'E' || side === 'W' ? f.len / 2 - T : f.len / 2;
    const ops = spec.openings.filter((o) => o.side === side).sort((a, b) => a.off - b.off);
    // Three bands: solid base, glass ribbon (full-height curtain wall on glass buildings), panel top.
    bandPieces(S, lowKey, f, half, 0, low, ops);
    bandPieces(S, 'glass', f, half, low, glassTop, ops, T * 0.6);
    bandPieces(S, 'gold', f, half + 0.05, low - 0.09, low + 0.09, ops, T + 0.08);
    bandPieces(S, 'panel', f, half, glassTop, top, ops);
    for (const o of ops) decorateOpening(S, f, o);
    // Glowing teal contour along the parapet.
    S.add('glowTeal', wallPiece(f, -half - 0.08, half + 0.08, top - 0.02, top + 0.18, T + 0.16));
    // Slender steel pilasters every ~12 m on the long sides (clear of openings, green walls and the sign).
    if (side === 'S' || side === 'N') {
      const n = Math.max(2, Math.round(f.len / 12));
      for (let i = 1; i < n; i++) {
        const sp = -half + (f.len * i) / n;
        if (side === 'S' && Math.abs(sp) < f.len * 0.38) continue;
        if (ops.some((o) => Math.abs(o.off - sp) < o.w / 2 + 0.8)) continue;
        if (spec.green.some((g) => g.side === side && Math.abs(g.off - sp) < g.w / 2 + 0.6)) continue;
        S.add('steel', wallPiece(f, sp - 0.25, sp + 0.25, 0, top, 0.35, 0.17));
      }
    }
  }
  // Corner glow strips.
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    S.add('glowTeal', box(0.22, top, 0.22, spec.cx + sx * (spec.w / 2 + 0.05), top / 2, spec.cz + sz * (spec.d / 2 + 0.05)));
  }
  // Living green walls (proud of the façade).
  for (const g of spec.green) {
    const f = sideFrame(spec, g.side);
    S.add('green', wallPiece(f, g.off - g.w / 2, g.off + g.w / 2, 0.6, glassTop - 0.2, 0.3, 0.15));
    S.add('steel', wallPiece(f, g.off - g.w / 2 - 0.15, g.off + g.w / 2 + 0.15, 0.45, 0.6, 0.45, 0.2));
  }
  // Interior floor.
  S.add('floor', box(spec.w - T * 2, 0.16, spec.d - T * 2, spec.cx, 0.08, spec.cz));
  return { low, glassTop, top };
}

function decorateOpening(S, f, o) {
  const a = o.off - o.w / 2, b = o.off + o.w / 2, y1 = o.y + o.h;
  if (o.kind === 'portal') {
    // Glowing frame for the conveyor glass tube.
    S.add('glowTeal', wallPiece(f, a - 0.25, a, o.y, y1, T + 0.2), wallPiece(f, b, b + 0.25, o.y, y1, T + 0.2),
      wallPiece(f, a - 0.25, b + 0.25, y1, y1 + 0.25, T + 0.2), wallPiece(f, a - 0.25, b + 0.25, o.y - 0.25, o.y, T + 0.2));
  } else if (o.kind === 'dock') {
    S.add('hazard', wallPiece(f, a - 0.35, a, 0, y1, T + 0.1), wallPiece(f, b, b + 0.35, 0, y1, T + 0.1));
    S.add('steel', wallPiece(f, a, b, y1 - 1.1, y1, 0.12, -0.15));                    // rolled-up door
    S.add('panel', wallPiece(f, a - 1.2, b + 1.2, y1 + 0.5, y1 + 0.8, 3.2, 1.6));        // canopy
    S.add('glowWarm', wallPiece(f, a, b, y1 + 0.42, y1 + 0.5, 0.2, 2.8));               // canopy light
    S.add('rubber', wallPiece(f, a + 0.3, a + 0.7, 0.6, 1.4, 0.35, 0.18), wallPiece(f, b - 0.7, b - 0.3, 0.6, 1.4, 0.35, 0.18));
  } else {
    S.add('glass', wallPiece(f, a, b, 0, y1, 0.08, -0.12));
    S.add('graphite', wallPiece(f, a - 0.18, b + 0.18, y1, y1 + 0.22, T + 0.1));
    S.add('panel', wallPiece(f, a - 1.0, b + 1.0, y1 + 0.35, y1 + 0.6, 2.2, 1.1));
  }
}

/* ---------- Roofs ---------- */

function solarGrid(R, spec, y, margin = 4, tilt = 10 * DEG) {
  const { cx, cz, w, d } = spec;
  const pw = 3.6, pd = 2.0, gx = 4.0, gz = 3.3;
  const nx = Math.floor((w - margin * 2) / gx), nz = Math.floor((d - margin * 2) / gz);
  const x0 = cx - ((nx - 1) * gx) / 2, z0 = cz - ((nz - 1) * gz) / 2;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      // Leave a corridor on the north edge for fans and service walkways.
      if (j === 0) continue;
      R.add('solar', box(pw, 0.06, pd, x0 + i * gx, y + 0.55, z0 + j * gz, 0, tilt));
      R.add('steel', box(pw * 0.9, 0.45, 0.08, x0 + i * gx, y + 0.25, z0 + j * gz));
    }
  }
}

function flatRoof(R, spec, props) {
  const { cx, cz, w, d, h } = spec;
  R.add('roof', box(w - T * 2, 0.5, d - T * 2, cx, h - 0.25, cz));
  solarGrid(R, spec, h);
  const nf = w > 45 ? 3 : 2;
  for (let i = 0; i < nf; i++) props.addFan(spec.id, cx - w / 2 + (w * (i + 1)) / (nf + 1), h, cz - d / 2 + 3.2);
}

function sawRoof(R, spec, props) {
  const { cx, cz, w, d, h } = spec;
  R.add('roof', box(w - T * 2, 0.5, d - T * 2, cx, h - 0.25, cz));
  const n = Math.max(3, Math.round(d / 8)), L = d / n, H = 3.4, y0 = h;
  const slope = Math.hypot(L, H), ang = Math.atan2(H, L);
  for (let i = 0; i < n; i++) {
    const zs = cz + d / 2 - i * L, zn = zs - L;
    R.add('solarRoof', box(w - 0.2, 0.22, slope, cx, y0 + H / 2, (zs + zn) / 2, 0, ang));
    R.add('glass', box(w - 0.4, H, 0.14, cx, y0 + H / 2, zn + 0.07));
    R.add('steel', box(w - 0.2, 0.25, 0.3, cx, y0 + H + 0.05, zn + 0.1));
    for (const sx of [-1, 1]) {
      const x = cx + sx * (w / 2 - 0.1);
      R.add('panel', polygon([
        new THREE.Vector3(x, y0, zs), new THREE.Vector3(x, y0 + H, zn), new THREE.Vector3(x, y0, zn),
      ], new THREE.Vector3(sx, 0, 0)));
    }
  }
}

function vaultRoof(R, spec) {
  const { cx, cz, w, d, h } = spec;
  const rise = Math.min(8, d * 0.18);
  const r = (d * d / 4 + rise * rise) / (2 * rise);
  const th = Math.asin(d / 2 / r);
  const N = 28;
  const arc = (rr, a) => [cz + rr * Math.sin(a), h + rr * Math.cos(a) - (r - rise)];
  // Outer shell: a strip of quads wound so the normals point outwards (up / away from the axis).
  const strip = (rr, a0s, a1s, n, xa, xb) => {
    const pos = [];
    for (let i = 0; i < n; i++) {
      const a0 = a0s + ((a1s - a0s) * i) / n, a1 = a0s + ((a1s - a0s) * (i + 1)) / n;
      const [z0, y0] = arc(rr, a0), [z1, y1] = arc(rr, a1);
      pos.push(xa, y0, z0, xb, y1, z1, xb, y0, z0, xa, y0, z0, xa, y1, z1, xb, y1, z1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  };
  R.add('roof', strip(r, -th, th, N, cx - w / 2, cx + w / 2));
  // Gable ends in glass, a skylight along the crest and steel ribs every ~8 m.
  for (const sx of [-1, 1]) {
    const x = cx + sx * (w / 2 - 0.05);
    const pts = [new THREE.Vector3(x, h, cz)];
    for (let i = 0; i <= N; i++) { const [z, y] = arc(r, -th + (2 * th * i) / N); pts.push(new THREE.Vector3(x, y, z)); }
    R.add('glass', polygon(pts, new THREE.Vector3(sx, 0, 0)));
  }
  // Glowing skylight strip along the crest.
  R.add('glowTeal', strip(r + 0.06, -0.1, 0.1, 6, cx - w / 2 + 2, cx + w / 2 - 2));
  const nRibs = Math.max(3, Math.round(w / 8));
  for (let i = 0; i <= nRibs; i++) {
    const x = cx - w / 2 + 0.3 + ((w - 0.6) * i) / nRibs;
    const pts = [];
    for (let k = 0; k <= 16; k++) { const [z, y] = arc(r + 0.12, -th + (2 * th * k) / 16); pts.push(new THREE.Vector3(x, y, z)); }
    R.add('steel', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.14, 5, false));
  }
  return rise;
}

/* ---------- Building ---------- */

class Building {
  constructor(spec, roof, interior, props) {
    this.id = spec.id;
    this.spec = spec;
    this.roof = roof;
    this.interior = interior;
    this.props = props;
    this.alpha = 1;
    this.target = 1;
    this.clones = null;
    const top = spec.h + PARAPET;
    this.box = new THREE.Box3(new THREE.Vector3(spec.cx - spec.w / 2, 0, spec.cz - spec.d / 2),
      new THREE.Vector3(spec.cx + spec.w / 2, top + 6, spec.cz + spec.d / 2));
    this.center = new THREE.Vector3(spec.cx, top / 2, spec.cz);
  }
  get isOpen() { return this.target === 0; }
  /** Fade the roof out (open) or back in (close). */
  setRoof(open) {
    if (!this.roof) return;
    this.target = open ? 0 : 1;
    if (open) this.interior.visible = true;
    if (!this.clones) {
      this.clones = [];
      this.roof.traverse((o) => {
        if (!o.isMesh) return;
        const shared = o.material;
        const clone = shared.clone();
        clone.transparent = true;
        this.clones.push({ mesh: o, shared, clone });
      });
    }
    for (const c of this.clones) c.mesh.material = c.clone;
    this.roof.visible = true;
  }
  update(dt) {
    if (this.alpha === this.target) return;
    const step = dt / FADE;
    this.alpha = this.target > this.alpha ? Math.min(this.target, this.alpha + step) : Math.max(this.target, this.alpha - step);
    for (const c of this.clones) c.clone.opacity = c.shared.opacity * this.alpha;
    this.props?.setScale(this.id, this.alpha);
    if (this.alpha === 0) {
      this.roof.visible = false;
    } else if (this.alpha === 1) {
      for (const c of this.clones) c.mesh.material = c.shared; // back to the shared opaque materials
      this.interior.visible = false;
    }
  }
}

/**
 * Builds every regular production building of the site plan.
 * @returns {{ list: Map<string, Building>, update(dt), props }}
 */
export function buildBuildings(scene, signs, specials = {}) {
  const m = mats();
  const materials = { ...m, sign: signs.material };
  const S = new Batch();
  const props = new RoofProps(scene);
  const list = new Map();
  for (const raw of BUILDINGS) {
    const spec = resolveSpec(raw);
    const interior = new THREE.Group();
    interior.name = `interior:${spec.id}`;
    interior.visible = false;
    scene.add(interior);
    if (spec.special) {
      const make = specials[spec.special];
      if (!make) continue;
      const b = make(spec, { S, materials, props, interior, scene, signs, Building, finishRoof });
      if (b) list.set(spec.id, b);
      continue;
    }
    const { glassTop, top } = buildWalls(spec, S);
    const roof = new THREE.Group();
    roof.name = `roof:${spec.id}`;
    const R = new Batch();
    let roofTop = spec.h;
    if (spec.roof === 'saw') { sawRoof(R, spec, props); roofTop = spec.h + 3.4; }
    else if (spec.roof === 'vault') roofTop = spec.h + vaultRoof(R, spec);
    else flatRoof(R, spec, props);
    // Clean-air towers on two opposite corners (one on smaller roofs).
    const inset = 5;
    props.addTower(spec.id, spec.cx + spec.w / 2 - inset, spec.roof === 'vault' ? spec.h : spec.h, spec.cz - spec.d / 2 + inset);
    if (spec.w >= 45) props.addTower(spec.id, spec.cx - spec.w / 2 + inset, spec.h, spec.cz + spec.d / 2 - inset);
    // Signs: façade sign (south side) or the giant roof sign of the ginning hall.
    const rect = signs.rect(spec.id);
    if (spec.roofSign) {
      const sg = signGeometry(rect, spec.cx, roofTop + 4.3, spec.cz + spec.d / 2 - 3, 0, 5.2, spec.w * 0.95);
      R.add('sign', sg.face);
      R.add('dark', sg.back);
      for (const sx of [-1, 1]) R.add('steel', box(0.35, 4.5, 0.35, spec.cx + sx * sg.w * 0.35, roofTop + 1.2, spec.cz + spec.d / 2 - 3.3));
    } else if (rect) {
      const f = sideFrame(spec, 'S');
      const y = (glassTop + top) / 2;
      const sh = Math.min(2.6, (top - glassTop) * 0.82);
      const sg = signGeometry(rect, f.o[0], y, f.o[1] + 0.12, f.ry, sh, spec.w * 0.72);
      S.add('sign', sg.face);
      S.add('dark', sg.back);
    }
    finishRoof(R, materials, roof, spec.id);
    scene.add(roof);
    list.set(spec.id, new Building(spec, roof, interior, props));
  }
  S.build(materials, TILE, scene, { name: 'buildings' });
  props.finish();
  return {
    list,
    props,
    update(dt) {
      props.update(dt);
      for (const b of list.values()) b.update?.(dt);
    },
  };
}

/** Merge a roof batch into its group. */
export function finishRoof(R, materials, group, id) {
  R.build(materials, TILE, group, { name: `roof:${id}` });
}

export { Building, sideFrame, wallPiece, bandPieces, solarGrid, flatRoof, buildWalls, T, PARAPET };
