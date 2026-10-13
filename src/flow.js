// Product-flow system. Phase 2 only needs the Path class (arc-length parametrised polyline);
// lines, nodes and product forms are added in Phase 4.
import * as THREE from 'three';

export class Path {
  /** @param {THREE.Vector3[]} points polyline vertices, @param {boolean} closed */
  constructor(points, closed = false) {
    this.points = points.map((p) => p.clone());
    if (closed) this.points.push(points[0].clone());
    this.cum = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.cum.push(this.cum[i - 1] + this.points[i].distanceTo(this.points[i - 1]));
    }
    this.length = this.cum[this.cum.length - 1];
    this.closed = closed;
  }

  _seg(s) {
    s = this.closed ? ((s % this.length) + this.length) % this.length : Math.min(Math.max(s, 0), this.length);
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid; else hi = mid;
    }
    const len = this.cum[hi] - this.cum[lo] || 1;
    return [lo, (s - this.cum[lo]) / len];
  }

  /** Point at arc length s. */
  at(s, out = new THREE.Vector3()) {
    const [i, t] = this._seg(s);
    return out.lerpVectors(this.points[i], this.points[i + 1], t);
  }

  /** Unit direction at arc length s. */
  dirAt(s, out = new THREE.Vector3()) {
    const [i] = this._seg(s);
    return out.subVectors(this.points[i + 1], this.points[i]).normalize();
  }
}

/* ===================== Product flow (Phase 4) ===================== */

/** A conveyor (or pipe) between two nodes; items ride along `path` at `speed` m/s. */
export class Line {
  constructor(id, points, { kind = 'belt', speed = 1.6 } = {}) {
    this.id = id;
    this.path = new Path(points);
    this.kind = kind;
    this.speed = speed;
    this.to = null;
  }
}

/**
 * A station node: items reaching the end of an incoming line disappear into the machine and,
 * after `delay` seconds, re-appear at the start of every output line in a new form.
 * outputs: [{ line, form, color?(inColor) }]; source: { every, form, line, when?() } emits on a timer.
 */
export class Node {
  constructor(id, { delay = 3, outputs = [], source = null, sink = false, onReceive = null, onEmit = null } = {}) {
    Object.assign(this, { id, delay, outputs, source, sink, onReceive, onEmit });
    this.pending = [];
    this.timer = 0;
    this.activity = 0;
    this.count = 0;
  }
  receive(item, flow) {
    this.activity = Math.min(1, this.activity + 0.45);
    this.count++;
    this.onReceive?.(item);
    if (!this.sink) this.pending.push({ at: flow.time + this.delay, color: item.color });
  }
  emit(flow, color) {
    for (const o of this.outputs) flow.spawn(o.line, o.form, o.color ? o.color(color) : color);
    this.onEmit?.();
  }
  update(dt, flow) {
    this.activity = Math.max(0, this.activity - dt * 0.12);
    while (this.pending.length && this.pending[0].at <= flow.time) this.emit(flow, this.pending.shift().color);
    if (this.source && (!this.source.when || this.source.when())) {
      this.timer += dt;
      if (this.timer >= this.source.every) {
        this.timer -= this.source.every;
        flow.spawn(this.source.line, this.source.form, this.source.color ?? 0xffffff);
        this.source.onSpawn?.();
        this.activity = Math.min(1, this.activity + 0.3);
      }
    }
  }
}

export class FlowSystem {
  constructor(products) {
    this.products = products;
    this.items = [];
    this.nodes = [];
    this.time = 0;
    this._dir = new THREE.Vector3();
  }
  addNode(n) { this.nodes.push(n); return n; }
  spawn(line, form, color = 0xffffff) {
    if (!line) return;
    this.items.push({ line, form, color, s: 0, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1) });
  }
  update(dt) {
    this.time += dt;
    const keep = [];
    for (const it of this.items) {
      it.s += it.line.speed * dt;
      if (it.s >= it.line.path.length) it.line.to?.receive(it, this);
      else keep.push(it);
    }
    this.items = keep;
    for (const n of this.nodes) n.update(dt, this);
  }
  render() {
    for (const it of this.items) {
      it.line.path.at(it.s, it.pos);
      it.line.path.dirAt(it.s, it.dir);
    }
    this.products.write(this.items);
  }
}

/* ---------- Conveyor geometry ---------- */
const _up = new THREE.Vector3(0, 1, 0);

/** Basis of a segment: f = forward, r = right (horizontal), u = up (perpendicular to f). */
function basis(a, b) {
  const f = new THREE.Vector3().subVectors(b, a);
  const len = f.length();
  f.divideScalar(len || 1);
  const r = new THREE.Vector3().crossVectors(_up, f).normalize();
  const u = new THREE.Vector3().crossVectors(f, r);
  return { f, r, u, len };
}

/** Box aligned with segment a→b (w across, h up), offset `lift` along the segment's up vector. */
export function segBox(a, b, w, h, lift = 0, side = 0, extend = 0) {
  const { f, r, u, len } = basis(a, b);
  const g = new THREE.BoxGeometry(w, h, len + extend);
  const m = new THREE.Matrix4().makeBasis(r, u, f);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).addScaledVector(u, lift).addScaledVector(r, side);
  m.setPosition(mid);
  return g.applyMatrix4(m);
}

/** Belt surface ribbon with V = arc length / tile (for the scrolling chevrons). */
function ribbon(points, width, tile = 1.2) {
  const pos = [], uv = [], nor = [];
  let s = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const { r, u, len } = basis(a, b);
    if (len < 1e-3) continue;
    const a0 = a.clone().addScaledVector(r, -width / 2), a1 = a.clone().addScaledVector(r, width / 2);
    const b0 = b.clone().addScaledVector(r, -width / 2), b1 = b.clone().addScaledVector(r, width / 2);
    const v0 = s / tile, v1 = (s + len) / tile;
    // Wound so the face normal points up (u).
    pos.push(...a0.toArray(), ...b1.toArray(), ...a1.toArray(), ...a0.toArray(), ...b0.toArray(), ...b1.toArray());
    uv.push(0, v0, 1, v1, 1, v0, 0, v0, 0, v1, 1, v1);
    for (let k = 0; k < 6; k++) nor.push(u.x, u.y, u.z);
    s += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/**
 * Adds a belt conveyor along `points` (belt-top height) to batch B: frame, chevron belt, glowing
 * edge rails and legs down to the floor every ~3 m.
 */
export function addBelt(B, points, { width = 1.1, legs = true } = {}) {
  B.add('belt', ribbon(points, width));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (a.distanceTo(b) < 1e-3) continue;
    B.add('graphite', segBox(a, b, width + 0.3, 0.32, -0.18, 0, 0.3));
    for (const s of [-1, 1]) B.add('glowTeal', segBox(a, b, 0.07, 0.07, 0.12, s * (width / 2 + 0.12), 0.3));
    if (!legs) continue;
    const len = a.distanceTo(b), n = Math.max(1, Math.floor(len / 3));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n);
      const hgt = p.y - 0.35;
      if (hgt > 0.2) for (const s of [-1, 1]) {
        const { r } = basis(a, b);
        B.add('steel', new THREE.BoxGeometry(0.12, hgt, 0.12).translate(p.x + r.x * s * 0.5, hgt / 2, p.z + r.z * s * 0.5));
      }
    }
  }
}

/** Transparent glass tube (exterior) around a belt, with glowing rings and support columns. */
export function addTube(B, points, { radius = 1.0, lift = 0.45, supports = true, avoid = () => false } = {}) {
  const pts = points.map((p) => p.clone().addScaledVector(_up, lift));
  const curve = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const len = curve.getLength();
  B.add('clearGlass', new THREE.TubeGeometry(curve, Math.max(8, Math.round(len / 1.5)), radius, 14, false));
  for (let s = 0; s <= len; s += 5) {
    const p = curve.getPointAt(Math.min(1, s / len)), t = curve.getTangentAt(Math.min(1, s / len));
    const ring = new THREE.TorusGeometry(radius + 0.03, 0.05, 5, 20);
    ring.lookAt(t);
    ring.translate(p.x, p.y, p.z);
    B.add('glowTeal', ring);
    if (supports && s > 2 && s < len - 2 && !avoid(p.x, p.z)) {
      const hgt = p.y - radius;
      B.add('steel', new THREE.BoxGeometry(0.3, hgt, 0.3).translate(p.x, hgt / 2, p.z));
      B.add('steel', new THREE.BoxGeometry(radius * 1.6, 0.12, 0.4).translate(p.x, hgt, p.z));
    }
  }
}

/** Glass pipe for liquid oil (inside and outside), with pipe clamps and supports. */
export function addPipe(B, points, { radius = 0.3, supports = true, avoid = () => false } = {}) {
  const curve = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
  const len = curve.getLength();
  B.add('clearGlass', new THREE.TubeGeometry(curve, Math.max(8, Math.round(len / 1.2)), radius, 10, false));
  for (let s = 0; s <= len; s += 4) {
    const p = curve.getPointAt(Math.min(1, s / len)), t = curve.getTangentAt(Math.min(1, s / len));
    const ring = new THREE.TorusGeometry(radius + 0.03, 0.04, 4, 14);
    ring.lookAt(t);
    ring.translate(p.x, p.y, p.z);
    B.add('gold', ring);
    if (supports && !avoid(p.x, p.z) && p.y > 0.8) B.add('steel', new THREE.BoxGeometry(0.14, p.y - radius, 0.14).translate(p.x, (p.y - radius) / 2, p.z));
  }
}

/** Points along a circular arc in the XZ plane (angles in radians, y constant). */
export function arcPoints(cx, cz, r, a0, a1, y = 0, steps = 12) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  return pts;
}
