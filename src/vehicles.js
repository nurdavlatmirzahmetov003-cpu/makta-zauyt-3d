// Electric autonomous vehicles: procedural models, right-hand lane paths with rounded corners,
// routes (cotton trucks, semi with articulated trailer, tanker, bale truck, service cars, minibus),
// stops (intake dock, dispatch dock, tank gantry, bus stop), collision avoidance and parked fleet.
import * as THREE from 'three';
import { merge, paint, place } from './geo.js';
import { Path } from './flow.js';
import { PALETTE, VEHICLE_TEXT } from './data.js';
import { fitFont } from './textures.js';

const WHITE = '#f4f6f6', TEAL = PALETTE.teal, DARK = '#232b30', GLASS = '#1d3a44', GOLD = PALETTE.gold;
let BODY = null, LIGHT = null;
function bodyMat() { return BODY || (BODY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 })); }
function lightMat() { return LIGHT || (LIGHT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); }

/* ---------------- Lane paths ---------------- */

/**
 * Right-hand lane path through centreline waypoints [{x, z, off}] (off = lane offset to the right
 * for the segment starting at that waypoint), with rounded corners.
 */
export function lanePath(wps, { closed = false, radius = 10 } = {}) {
  const P = wps.map((w) => new THREE.Vector2(w.x, w.z));
  const n = P.length, segN = closed ? n : n - 1;
  const segs = [];
  for (let i = 0; i < segN; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const d = b.clone().sub(a).normalize();
    const r = new THREE.Vector2(-d.y, d.x);
    const off = wps[i].off ?? 0;
    segs.push({ a: a.clone().addScaledVector(r, off), b: b.clone().addScaledVector(r, off), d });
  }
  const verts = [];
  const cross = (u, v) => u.x * v.y - u.y * v.x;
  const corner = (s1, s2) => {
    const den = cross(s1.d, s2.d);
    if (Math.abs(den) < 1e-4) return null;
    const t = cross(s2.a.clone().sub(s1.a), s2.d) / den;
    return s1.a.clone().addScaledVector(s1.d, t);
  };
  if (!closed) verts.push({ p: segs[0].a });
  const last = closed ? segN : segN - 1;
  for (let i = 0; i < last; i++) {
    const s1 = segs[i], s2 = segs[(i + 1) % segN];
    const c = corner(s1, s2);
    if (!c) { verts.push({ p: s1.b }, { p: s2.a }); continue; }
    verts.push({ p: c, d1: s1.d, d2: s2.d });
  }
  if (!closed) verts.push({ p: segs[segN - 1].b });
  // Round each corner with a quadratic curve of tangent length R·tan(θ/2).
  const pts = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    if (!v.d1) { pts.push(v.p); continue; }
    const ang = Math.acos(THREE.MathUtils.clamp(v.d1.dot(v.d2), -1, 1));
    if (ang < 0.05) { pts.push(v.p); continue; }
    const prev = verts[(i - 1 + verts.length) % verts.length].p, next = verts[(i + 1) % verts.length].p;
    const maxT = 0.45 * Math.min(prev.distanceTo(v.p), next.distanceTo(v.p));
    const t = Math.min(maxT, radius * Math.tan(ang / 2));
    const A = v.p.clone().addScaledVector(v.d1, -t), B = v.p.clone().addScaledVector(v.d2, t);
    const steps = Math.max(4, Math.round(ang * 8));
    for (let k = 0; k <= steps; k++) {
      const u = k / steps, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      pts.push(new THREE.Vector2(A.x * a + v.p.x * b + B.x * c, A.y * a + v.p.y * b + B.y * c));
    }
  }
  const path = new Path(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)), closed);
  path.closedLoop = closed;
  return path;
}

/** Arc length of the point on `path` nearest to (x, z). */
export function nearestS(path, x, z) {
  let best = 0, bd = Infinity;
  const p = new THREE.Vector3();
  for (let s = 0; s <= path.length; s += 0.5) {
    path.at(s, p);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

/* ---------------- Models ---------------- */

function liveryTexture(text, bg = '#f4f6f6') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 196, 1024, 26);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 226, 1024, 6);
  const disc = ctx.createLinearGradient(60, 55, 180, 175);
  disc.addColorStop(0, PALETTE.teal);
  disc.addColorStop(1, PALETTE.deepTeal);
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.arc(120, 115, 62, 0, 6.29); ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const [x, y, r] of [[120, 92, 26], [94, 114, 24], [146, 114, 24], [120, 134, 23]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); }
  ctx.fillStyle = PALETTE.deepTeal;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitFont(ctx, text, 800, 'Unbounded, Inter, Arial', 78, 800);
  ctx.fillText(text, 200, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Wheel pair (one axle) as one mesh, rotating about X. */
function axle(r, w, track, z) {
  const wheel = (x) => merge([
    paint(new THREE.CylinderGeometry(r, r, w, 18).rotateZ(Math.PI / 2).translate(x, 0, 0), '#1c2125'),
    paint(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 12).rotateZ(Math.PI / 2).translate(x, 0, 0), '#c5ccd0'),
    paint(new THREE.BoxGeometry(w + 0.03, r * 0.9, 0.12).translate(x, 0, 0), '#8a959b'),
  ]);
  const m = new THREE.Mesh(merge([wheel(-track), wheel(track)]), bodyMat());
  m.position.set(0, r, z);
  m.castShadow = true;
  m.userData.r = r;
  return m;
}

/** Cab-forward electric cab with a lidar dome; returns geometry parts (front at +Z). */
function cabParts(z0, len = 2.4, w = 2.5, h = 3.1, color = WHITE) {
  const zc = z0 + len / 2;
  return [
    paint(new THREE.BoxGeometry(w, h - 0.9, len).translate(0, 0.9 + (h - 0.9) / 2, zc), color),
    paint(new THREE.BoxGeometry(w + 0.02, 1.0, 0.08).translate(0, h - 0.9, z0 + len + 0.01), GLASS),
    paint(new THREE.BoxGeometry(0.06, 0.8, len * 0.55).translate(w / 2 + 0.01, h - 0.95, zc + len * 0.1), GLASS),
    paint(new THREE.BoxGeometry(0.06, 0.8, len * 0.55).translate(-w / 2 - 0.01, h - 0.95, zc + len * 0.1), GLASS),
    paint(new THREE.BoxGeometry(w + 0.04, 0.16, len + 0.04).translate(0, 1.55, zc), TEAL),
    paint(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 16).translate(0, h + 0.11, zc), DARK),
    paint(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h + 0.22, zc), '#3a4a52'),
    paint(new THREE.BoxGeometry(w * 0.7, 0.12, 0.05).translate(0, h - 0.25, z0 + len + 0.05), TEAL),
  ];
}

function lights(front, rear, w, yF = 1.2, yR = 1.1) {
  const parts = [];
  for (const s of [-1, 1]) {
    if (front !== null) parts.push(paint(new THREE.BoxGeometry(0.45, 0.16, 0.05).translate(s * (w / 2 - 0.35), yF, front), '#fff6dc'));
    if (rear !== null) parts.push(paint(new THREE.BoxGeometry(0.4, 0.14, 0.05).translate(s * (w / 2 - 0.3), yR, rear), '#ff3b30'));
  }
  return new THREE.Mesh(merge(parts), lightMat());
}

function finish(g) {
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Large raw-cotton truck: cab, chassis, mesh cage and a cotton heap that shrinks while unloading. */
export function makeCottonTruck() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge([
    ...cabParts(3.2, 2.4, 2.5, 3.2),
    paint(new THREE.BoxGeometry(2.3, 0.5, 8.4).translate(0, 0.9, 0.9), DARK),
    paint(new THREE.BoxGeometry(2.5, 0.25, 6.2).translate(0, 1.3, -0.4), '#c9d0d3'),
    ...[-1, 1].map((s) => paint(new THREE.BoxGeometry(0.08, 2.0, 6.2).translate(s * 1.25, 2.4, -0.4), '#9aa5ab')),
    paint(new THREE.BoxGeometry(2.5, 2.0, 0.08).translate(0, 2.4, -3.5), '#9aa5ab'),
    ...[-1, 1].map((s) => paint(new THREE.BoxGeometry(0.12, 0.12, 6.24).translate(s * 1.25, 3.42, -0.4), TEAL)),
    paint(new THREE.BoxGeometry(2.52, 0.12, 0.12).translate(0, 3.42, -3.5), TEAL),
    paint(new THREE.BoxGeometry(2.52, 0.12, 0.12).translate(0, 3.42, 2.7), TEAL),
  ]), bodyMat()));
  const heap = new THREE.Mesh(merge([0, 1, 2, 3].map((k) => place(new THREE.IcosahedronGeometry(1.25, 1), { x: (k % 2 - 0.5) * 1.0, y: 0, z: -2.4 + k * 1.3, sy: 0.75 }))),
    new THREE.MeshStandardMaterial({ color: PALETTE.cotton, roughness: 0.95 }));
  heap.position.y = 2.2;
  g.add(heap, lights(5.62, -3.55, 2.5));
  const wheels = [axle(0.55, 0.4, 1.05, 4.2), axle(0.55, 0.4, 1.05, -1.4), axle(0.55, 0.4, 1.05, -2.6)];
  g.add(...wheels);
  g.userData = { wheels, heap, length: 9.2 };
  return finish(g);
}

/** Bale truck: rigid truck carrying strapped bales. */
export function makeBaleTruck() {
  const g = new THREE.Group();
  const bales = [];
  for (let i = 0; i < 4; i++) for (const s of [-0.6, 0.6]) bales.push(paint(new THREE.BoxGeometry(1.1, 0.85, 1.3).translate(s, 1.85, -2.6 + i * 1.4), '#f6f1e6'));
  g.add(new THREE.Mesh(merge([
    ...cabParts(2.6, 2.3, 2.5, 3.0, WHITE),
    paint(new THREE.BoxGeometry(2.3, 0.5, 7.6).translate(0, 0.9, 0.8), DARK),
    paint(new THREE.BoxGeometry(2.5, 0.25, 6.0).translate(0, 1.3, -0.9), '#c9d0d3'),
    ...bales,
  ]), bodyMat()));
  g.add(lights(4.92, -3.92, 2.5));
  const wheels = [axle(0.52, 0.4, 1.05, 3.6), axle(0.52, 0.4, 1.05, -2.2)];
  g.add(...wheels);
  g.userData = { wheels, length: 8 };
  return finish(g);
}

/** Electric semi tractor (fifth wheel at z = −1.6). */
export function makeTractor(color = WHITE) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge([
    ...cabParts(0.8, 2.6, 2.55, 3.5, color),
    paint(new THREE.BoxGeometry(2.3, 0.55, 6.0).translate(0, 0.9, 0.4), DARK),
    paint(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 18).translate(0, 1.25, -1.6), '#4a555b'),
    paint(new THREE.BoxGeometry(2.58, 0.6, 1.4).translate(0, 1.0, 2.6), '#c9d0d3'),
  ]), bodyMat()));
  g.add(lights(3.42, -2.6, 2.5, 1.2, 1.0));
  const wheels = [axle(0.55, 0.42, 1.05, 2.4), axle(0.55, 0.42, 1.05, -1.4)];
  g.add(...wheels);
  g.userData = { wheels, length: 6.8, hitch: -1.6 };
  return finish(g);
}

/** Box semi-trailer with the «АҚ МАРЖАН · ЭКСПОРТ» livery (pivot at its front, extends towards −Z). */
export function makeBoxTrailer() {
  const g = new THREE.Group();
  const L = 13.2;
  const tex = liveryTexture(VEHICLE_TEXT.trailer);
  const livery = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1 });
  const plain = new THREE.MeshStandardMaterial({ color: '#f2f4f4', roughness: 0.4, metalness: 0.1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.9, L).translate(0, 2.75, -L / 2 + 0.6), [livery, livery, plain, plain, plain, plain]);
  // BoxGeometry groups: +x, −x, +y, −y, +z, −z → livery on both long sides.
  g.add(box);
  g.add(new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(2.3, 0.4, L - 1).translate(0, 1.15, -L / 2 + 0.6), DARK),
    paint(new THREE.BoxGeometry(2.56, 0.12, L + 0.02).translate(0, 4.22, -L / 2 + 0.6), TEAL),
  ]), bodyMat()));
  g.add(lights(null, -L + 0.55, 2.5, 0, 1.0));
  const wheels = [axle(0.5, 0.4, 1.05, -L + 2.8), axle(0.5, 0.4, 1.05, -L + 4.0)];
  g.add(...wheels);
  g.userData = { wheels, length: L, axle: -L + 3.4 };
  return finish(g);
}

/** Oil tank semi-trailer. */
export function makeTankTrailer() {
  const g = new THREE.Group();
  const L = 11.5;
  const tank = new THREE.Mesh(merge([
    paint(new THREE.CylinderGeometry(1.25, 1.25, L - 1.2, 28).rotateX(Math.PI / 2).translate(0, 2.55, -L / 2 + 0.6), '#eef1f2'),
    paint(new THREE.SphereGeometry(1.25, 20, 10).scale(1, 1, 0.45).translate(0, 2.55, 0.6 - 0.6), '#eef1f2'),
    paint(new THREE.SphereGeometry(1.25, 20, 10).scale(1, 1, 0.45).translate(0, 2.55, -L + 1.2), '#eef1f2'),
    paint(new THREE.CylinderGeometry(1.27, 1.27, 0.35, 28).rotateX(Math.PI / 2).translate(0, 2.55, -L / 2 + 0.6), GOLD),
    paint(new THREE.BoxGeometry(2.3, 0.4, L - 1).translate(0, 1.1, -L / 2 + 0.6), DARK),
    paint(new THREE.BoxGeometry(0.6, 0.12, 6).translate(0, 3.85, -L / 2 + 0.6), '#9aa5ab'),
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.25 }));
  g.add(tank, lights(null, -L + 0.5, 2.5, 0, 1.0));
  const wheels = [axle(0.5, 0.4, 1.05, -L + 2.4), axle(0.5, 0.4, 1.05, -L + 3.6)];
  g.add(...wheels);
  g.userData = { wheels, length: L, axle: -L + 3.0 };
  return finish(g);
}

/** Drawbar trailer with bales (for the bale truck). */
export function makeBaleTrailer() {
  const g = new THREE.Group();
  const bales = [];
  for (let i = 0; i < 4; i++) for (const s of [-0.6, 0.6]) bales.push(paint(new THREE.BoxGeometry(1.1, 0.85, 1.3).translate(s, 1.75, -1.6 - i * 1.4), '#f6f1e6'));
  g.add(new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(0.15, 0.15, 1.4).translate(0, 0.9, -0.5), DARK),
    paint(new THREE.BoxGeometry(2.4, 0.3, 6.0).translate(0, 1.2, -3.6), '#c9d0d3'),
    ...bales,
  ]), bodyMat()));
  g.add(lights(null, -6.62, 2.4, 0, 1.0));
  const wheels = [axle(0.5, 0.4, 1.0, -2.2), axle(0.5, 0.4, 1.0, -5.2)];
  g.add(...wheels);
  g.userData = { wheels, length: 6.6, axle: -3.7 };
  return finish(g);
}

/** Compact autonomous service car. */
export function makeCar(color = WHITE) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(1.9, 0.75, 4.4).translate(0, 0.7, 0), color),
    paint(new THREE.BoxGeometry(1.75, 0.65, 2.6).translate(0, 1.38, -0.2), GLASS),
    paint(new THREE.BoxGeometry(1.8, 0.08, 2.5).translate(0, 1.73, -0.2), color),
    paint(new THREE.BoxGeometry(1.92, 0.1, 4.42).translate(0, 0.62, 0), TEAL),
    paint(new THREE.CylinderGeometry(0.16, 0.18, 0.16, 12).translate(0, 1.85, 0.1), DARK),
  ]), bodyMat()));
  g.add(lights(2.21, -2.21, 1.9, 0.82, 0.86));
  const wheels = [axle(0.36, 0.25, 0.82, 1.35), axle(0.36, 0.25, 0.82, -1.35)];
  g.add(...wheels);
  g.userData = { wheels, length: 4.4 };
  return finish(g);
}

/** Electric minibus with a window band and the brand name. */
export function makeMinibus() {
  const g = new THREE.Group();
  const tex = liveryTexture(VEHICLE_TEXT.bus);
  g.add(new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(2.3, 2.5, 7.6).translate(0, 1.65, 0), WHITE),
    paint(new THREE.BoxGeometry(2.32, 0.9, 6.2).translate(0, 2.2, -0.3), GLASS),
    paint(new THREE.BoxGeometry(2.2, 1.0, 0.08).translate(0, 2.2, 3.81), GLASS),
    paint(new THREE.BoxGeometry(2.34, 0.16, 7.62).translate(0, 1.15, 0), TEAL),
    paint(new THREE.CylinderGeometry(0.24, 0.28, 0.2, 14).translate(0, 3.0, 2.6), DARK),
  ]), bodyMat()));
  const side = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  side.position.set(1.17, 0.95, -0.4);
  side.rotation.y = Math.PI / 2;
  const side2 = side.clone();
  side2.position.x = -1.17;
  side2.rotation.y = -Math.PI / 2;
  g.add(side, side2, lights(3.82, -3.82, 2.3, 1.0, 1.0));
  const wheels = [axle(0.42, 0.3, 0.98, 2.6), axle(0.42, 0.3, 0.98, -2.5)];
  g.add(...wheels);
  g.userData = { wheels, length: 7.6 };
  return finish(g);
}

/* ---------------- Routes ---------------- */
const HW = 336, AV = 5, ST = 3.5, S3O = 3, HWO = 6.4;
const w = (x, z, off) => ({ x, z, off });
// Through the roundabout (centre 0, 95): northbound passes east of the island, southbound west.
const RB_N = [w(0, 117, AV), w(10, 105, AV), w(14, 95, AV), w(10, 85, AV), w(0, 73, AV)];
const RB_S = [w(0, 73, AV), w(-10, 85, AV), w(-14, 95, AV), w(-10, 105, AV), w(0, 117, AV)];
const IN_FROM_W = [w(-1700, HW, HWO), w(0, HW, AV), w(0, 240, AV), ...RB_N];
const IN_FROM_E = [w(1700, HW, HWO), w(0, HW, AV), w(0, 240, AV), ...RB_N];
const OUT_E = [...RB_S, w(0, 240, AV), w(0, HW, HWO), w(1700, HW, 0)];
const OUT_W = [...RB_S, w(0, 240, AV), w(0, HW, HWO), w(-1700, HW, 0)];

export const ROUTES = {
  // Highway → gate → avenue → S2 → W → intake dock → N → E → S1 → avenue → gate → highway.
  cotton: [...IN_FROM_W, w(0, -10, ST), w(-285, -10, ST), w(-285, -245, ST), w(285, -245, ST), w(285, -85, ST), w(0, -85, AV), ...OUT_E],
  // Highway → gate → avenue → S1 → E → S2 → dispatch dock → avenue → gate → export (west).
  semi: [...IN_FROM_E, w(0, -85, ST), w(285, -85, ST), w(285, -10, ST), w(0, -10, AV), ...OUT_W],
  // Highway → avenue → N street → tank gantry → E → S1 → avenue → gate → highway.
  tanker: [...IN_FROM_W, w(0, -245, ST), w(285, -245, ST), w(285, -85, ST), w(0, -85, AV), ...OUT_W],
  // Bale truck: avenue → S1 west → W south → S2 east → avenue → gate.
  bales: [...IN_FROM_E, w(0, -85, ST), w(-285, -85, ST), w(-285, -10, ST), w(0, -10, AV), ...OUT_E],
  // Service loop (closed): S2 east → E south → S3 west → W north.
  service: [w(-285, -10, ST), w(285, -10, ST), w(285, 205, S3O), w(-285, 205, ST)],
  // Minibus loop (closed): car park → S2 → avenue (bus stop by the administration) → S3 → W → S2 → car park.
  minibus: [w(-142.8, 12, 0), w(-142.8, -10, ST), w(0, -10, 8.5), ...RB_S, w(0, 205, S3O), w(-285, 205, ST), w(-285, -10, ST),
    w(-145, -10, 2.2), w(-145, 26, 0), w(-138, 33, 0), w(-130, 26, 0), w(-130, 16, 0)],
};

/* ---------------- Vehicles and traffic ---------------- */
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3();

class Vehicle {
  constructor(model, path, { trailer = null, speed = 6.5, stops = [], s = 0, respawn = 25, name = '' } = {}) {
    Object.assign(this, { model, path, trailer, cruise: speed, stops, s, respawn, name });
    this.v = 0;
    this.pos = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, 1);
    this.blocked = 0;
    this.ignore = 0;
    this.wait = 0;
    this.hidden = 0;
    this.stopIdx = 0;
    this.place();
  }
  place() {
    const { path, model } = this;
    path.at(this.s, this.pos);
    path.at(this.s + 2, _q);
    this.dir.subVectors(_q, this.pos).normalize();
    model.position.copy(this.pos);
    model.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    if (this.trailer) {
      const hitch = model.userData.hitch ?? -model.userData.length / 2;
      path.at(this.s + hitch, _p);
      path.at(this.s + hitch + this.trailer.userData.axle, _q);
      this.trailer.position.copy(_p);
      this.trailer.rotation.y = Math.atan2(_p.x - _q.x, _p.z - _q.z);
    }
  }
  /** Points other vehicles must keep clear of. */
  obstacles(out) {
    out.push({ p: this.pos, v: this });
    if (this.trailer) {
      const t = this.trailer;
      out.push({ p: t.position.clone().addScaledVector(new THREE.Vector3(Math.sin(t.rotation.y), 0, Math.cos(t.rotation.y)), -t.userData.length * 0.6), v: this });
    }
  }
  speedLimit() {
    const p = this.pos;
    if (Math.hypot(p.x, p.z - 95) < 30) return 4.5;
    if (Math.abs(p.x) < 305 && p.z < 300) return this.cruise;
    return 14;
  }
}

export function buildTraffic(scene, { production, gate }) {
  const vehicles = [];
  const add = (v) => {
    scene.add(v.model);
    if (v.trailer) scene.add(v.trailer);
    vehicles.push(v);
    return v;
  };
  const paths = Object.fromEntries(Object.entries(ROUTES).map(([k, wps]) => [k, lanePath(wps, { closed: k === 'service' || k === 'minibus' })]));

  // Cotton trucks: three of them, unloading in turn at the intake dock (W street, weighbridge).
  const intakeS = nearestS(paths.cotton, -281.5, -125);
  for (let i = 0; i < 3; i++) {
    const model = makeCottonTruck();
    const truck = add(new Vehicle(model, paths.cotton, { s: [intakeS - 45, intakeS - 330, 1250][i], name: 'cotton' }));
    let load = 1;
    truck.stops = [{
      s: intakeS, wait: 30,
      arrive: () => {
        production?.setTruckAtDock(true, () => { load = Math.max(0.05, load - 0.075); model.userData.heap.scale.set(1, load, 1); });
      },
      depart: () => production?.setTruckAtDock(false),
    }];
    truck.onRespawn = () => { load = 1; model.userData.heap.scale.set(1, 1, 1); };
  }
  // Semi with an articulated box trailer: loads at the dispatch dock until a pallet is full.
  const semiStop = nearestS(paths.semi, 35, -13.5);
  const semi = add(new Vehicle(makeTractor(), paths.semi, { trailer: makeBoxTrailer(), s: semiStop - 120, name: 'semi' }));
  let palletReady = false;
  if (production) production.hooks.onPalletFull = () => { palletReady = true; };
  semi.stops = [{
    s: semiStop, wait: 75, until: () => palletReady,
    arrive: () => { palletReady = false; }, depart: () => { semi.exported = (semi.exported || 0) + 1; },
  }];
  // Oil tanker loading at the gantry on N street.
  const tankS = nearestS(paths.tanker, 105, -241.5);
  const tanker = add(new Vehicle(makeTractor('#eef1f2'), paths.tanker, { trailer: makeTankTrailer(), s: tankS - 160, name: 'tanker' }));
  tanker.stops = [{ s: tankS, wait: 22 }];
  // Bale truck with a drawbar trailer.
  const baleTruck = makeBaleTruck();
  baleTruck.userData.hitch = -4.4;
  add(new Vehicle(baleTruck, paths.bales, { trailer: makeBaleTrailer(), s: 1500, name: 'bales' }));
  // Service cars on the internal loop.
  ['#f4f6f6', '#12b5a0', '#f5c04a'].forEach((c, i) => add(new Vehicle(makeCar(c), paths.service, { s: i * paths.service.length / 3, speed: 7, name: 'car' })));
  // Minibus with stops at the bus stop (administration) and in the car park.
  const bus = add(new Vehicle(makeMinibus(), paths.minibus, { s: 30, speed: 6, name: 'bus' }));
  bus.stops = [{ s: nearestS(paths.minibus, -8.5, 62), wait: 12 }, { s: nearestS(paths.minibus, -138, 33), wait: 15 }];

  // Parked fleet: trucks at the truck parking (EV chargers), cars in the staff car park.
  const parked = [];
  for (const i of [0, 2, 4, 7, 10]) {
    const t = i % 2 ? makeBaleTruck() : makeCottonTruck();
    t.position.set(155 + 2.5 + i * 5, 0, 72);
    t.rotation.y = Math.PI;
    if (t.userData.heap) t.userData.heap.visible = i % 4 === 0;
    parked.push(t);
  }
  ['#f4f6f6', '#7cc7ff', '#12b5a0', '#f4f6f6', '#f5c04a', '#1f2a30'].forEach((c, k) => {
    const car = makeCar(c);
    car.position.set(-168.5 + 1.25 + k * 2.5, 0, 13.4);
    car.rotation.y = Math.PI;
    parked.push(car);
  });
  for (const p of parked) scene.add(p);

  const obs = [];
  return {
    vehicles, parked, paths, semi,
    update(dt) {
      obs.length = 0;
      for (const v of vehicles) if (!v.hidden) v.obstacles(obs);
      for (const v of vehicles) step(v, dt, obs);
      gate?.update(dt, vehicles.filter((v) => !v.hidden).map((v) => ({ position: v.pos })));
    },
  };
}

function step(v, dt, obs) {
  if (v.hidden > 0) {
    v.hidden -= dt;
    if (v.hidden <= 0) { v.s = 0; v.stopIdx = 0; v.v = 0; v.onRespawn?.(); v.model.visible = true; if (v.trailer) v.trailer.visible = true; }
    return;
  }
  const L = v.path.length;
  // Dwelling at a stop.
  const stop = v.stops[v.stopIdx];
  if (v.wait > 0) {
    v.wait -= dt;
    if (v.wait <= 0 || (stop?.until && stop.until() && v.wait < stop.wait - 8)) {
      v.wait = 0;
      stop?.depart?.();
      v.stopIdx++;
      if (v.path.closedLoop && v.stopIdx >= v.stops.length) v.stopIdx = 0;
    }
    return;
  }
  // Target speed: limit, curvature, stop ahead, traffic ahead.
  let target = v.speedLimit();
  v.path.at(v.s + 12, _q);
  v.path.at(v.s + 24, _p);
  _d.subVectors(_p, _q).normalize();
  const turn = 1 - _d.dot(v.dir);
  if (turn > 0.04) target = Math.min(target, 5.5 - Math.min(2.5, turn * 6));
  if (stop) {
    let ds = stop.s - v.s;
    if (v.path.closedLoop && ds < -5) ds += L;
    if (ds < -2 && !v.path.closedLoop) v.stopIdx++; // already passed this stop
    else if (ds >= 0 && ds < 60) {
      target = Math.min(target, Math.sqrt(2 * 2.2 * Math.max(0, ds - 0.5)));
      if (ds < 0.8 && v.v < 0.6) { v.wait = stop.wait; v.v = 0; stop.arrive?.(); return; }
    }
  }
  if (v.ignore > 0) v.ignore -= dt;
  else {
    const look = 14 + v.v * 1.6;
    const right = new THREE.Vector3(v.dir.z, 0, -v.dir.x);
    let blocked = false, queue = false;
    for (const o of obs) {
      if (o.v === v) continue;
      _p.subVectors(o.p, v.pos);
      const ahead = _p.dot(v.dir);
      if (ahead > 0.5 && ahead < look && Math.abs(_p.dot(right)) < 3.2) {
        blocked = true;
        if (o.v.wait > 0 || o.v.queued) queue = true; // a proper queue behind a stopped vehicle
        target = Math.min(target, Math.max(0, (ahead - 9) * 0.6));
      }
    }
    v.queued = blocked && queue;
    v.blocked = blocked && !queue && v.v < 0.3 ? v.blocked + dt : 0;
    if (v.blocked > 6) { v.ignore = 3; v.blocked = 0; } // deadlock breaker
  }
  const acc = target > v.v ? 2.2 : 4.5;
  v.v += Math.sign(target - v.v) * Math.min(Math.abs(target - v.v), acc * dt);
  v.s += v.v * dt;
  if (v.s >= L) {
    if (v.path.closedLoop) { v.s -= L; v.stopIdx = 0; }
    else { v.hidden = v.respawn; v.model.visible = false; if (v.trailer) v.trailer.visible = false; return; }
  }
  v.place();
  spin(v, v.v, dt);
}

function spin(v, speed, dt) {
  for (const w of v.model.userData.wheels) w.rotation.x += (speed / w.userData.r) * dt;
  if (v.trailer) for (const w of v.trailer.userData.wheels) w.rotation.x += (speed / w.userData.r) * dt;
}

