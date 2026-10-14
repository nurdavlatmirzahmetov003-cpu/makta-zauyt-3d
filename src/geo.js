// Geometry helpers: merging, vertex colouring and organic "blob" displacement.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { perlin2 } from './noise.js';

/** Make attributes compatible (non-indexed, position/normal/uv/color) and merge. */
export function merge(geos) {
  const prepared = geos.map((g) => {
    let geo = g.index ? g.toNonIndexed() : g;
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    return geo;
  });
  const hasColor = prepared.some((g) => g.attributes.color);
  if (hasColor) prepared.forEach((g) => { if (!g.attributes.color) paint(g, 0xffffff); });
  for (const g of prepared) {
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    }
  }
  return mergeGeometries(prepared, false);
}

/** Fill a vertex colour attribute with a single colour. */
export function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Smooth, lumpy blob from an icosahedron (for tree crowns, shrubs, cotton bolls). */
export function blob(radius, detail = 1, amp = 0.18, seed = 0) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(radius, detail));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = perlin2(v.x * 1.7 / radius + seed, v.z * 1.7 / radius + v.y * 0.9 / radius - seed);
    v.multiplyScalar(1 + n * amp * 2);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Transform helper: returns the geometry after applying T/R/S (degrees for rotation). */
export function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx * THREE.MathUtils.DEG2RAD, ry * THREE.MathUtils.DEG2RAD, rz * THREE.MathUtils.DEG2RAD)),
    new THREE.Vector3(sx, sy, sz),
  );
  return geo.applyMatrix4(m);
}

/* ---------- World-space building blocks (radians, world coordinates) ---------- */

const _rm = new THREE.Matrix4(), _re = new THREE.Euler();
function orient(g, rx, ry, rz) {
  if (rx || ry || rz) g.applyMatrix4(_rm.makeRotationFromEuler(_re.set(rx, ry, rz)));
  return g;
}

/** Box of size w×h×d centred at (x, y, z), optionally rotated. */
export function box(w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  return orient(new THREE.BoxGeometry(w, h, d), rx, ry, rz).translate(x, y, z);
}

/** Vertical cylinder standing on y0 (or centred when rotated). */
export function cyl(rTop, rBot, h, x, y, z, seg = 16, rx = 0, rz = 0) {
  return orient(new THREE.CylinderGeometry(rTop, rBot, h, seg), rx, 0, rz).translate(x, y, z);
}

/** Flat horizontal quad covering x0..x1 × z0..z1 at height y (normal +Y). */
export function rectXZ(x0, x1, z0, z1, y) {
  return new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
}

/** Flat shape in the XZ plane (draw with shape coords x → X, y → Z) at height y, normal +Y. */
export function shapeXZ(build, y, curveSegments = 12) {
  const s = new THREE.Shape();
  build(s);
  // Shape Y maps to −Z after rotateX(−90°), so mirror Z back afterwards.
  const g = new THREE.ShapeGeometry(s, curveSegments).rotateX(-Math.PI / 2);
  g.scale(1, 1, -1);
  // Mirroring flips the winding: restore it so the face points up.
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.computeVertexNormals();
  return g.translate(0, y, 0);
}

/** Triangle fan / polygon from 3D points with the face oriented towards `outward`. */
export function polygon(points, outward) {
  const pos = [];
  for (let i = 1; i < points.length - 1; i++) pos.push(points[0], points[i], points[i + 1]);
  const g = new THREE.BufferGeometry().setFromPoints(pos);
  g.computeVertexNormals();
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
  if (n.dot(outward) < 0) {
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; }
    g.computeVertexNormals();
  }
  return g;
}

/** Box-projected world-space UVs (u, v in metres / tile). */
export function worldUV(geo, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * Collects world-space geometries per material key and merges each key into a single mesh,
 * so a whole district costs one draw call per material.
 */
export class Batch {
  constructor() { this.parts = new Map(); this.tags = new Map(); this.tag = null; }
  /** Geometries added while `tag` is set are recorded as vertex ranges (mesh.userData.ranges). */
  add(key, ...geos) {
    if (!this.parts.has(key)) { this.parts.set(key, []); this.tags.set(key, []); }
    this.parts.get(key).push(...geos);
    this.tags.get(key).push(...geos.map(() => this.tag));
  }
  build(materials, tiles, parent, { castShadow = true, receiveShadow = true, name = '' } = {}) {
    const meshes = {};
    for (const [key, geos] of this.parts) {
      if (!geos.length) continue;
      const mat = materials[key];
      if (!mat) throw new Error(`Batch: no material "${key}"`);
      const prepared = geos.map((g) => {
        const geo = g.index ? g.toNonIndexed() : g;
        if (!geo.attributes.normal) geo.computeVertexNormals();
        return tiles[key] ? worldUV(geo, tiles[key]) : geo;
      });
      // Vertex ranges per tag (merge keeps the order), used to lift one building out of a merged mesh.
      const ranges = {};
      let start = 0;
      prepared.forEach((g, i) => {
        const tag = this.tags.get(key)[i], n = g.attributes.position.count;
        if (tag != null) {
          const list = (ranges[tag] ||= []), last = list[list.length - 1];
          if (last && last[0] + last[1] === start) last[1] += n; else list.push([start, n]);
        }
        start += n;
      });
      const mesh = new THREE.Mesh(merge(prepared), mat);
      mesh.userData.ranges = ranges;
      mesh.castShadow = castShadow && !mat.transparent;
      mesh.receiveShadow = receiveShadow;
      mesh.name = `${name}:${key}`;
      parent.add(mesh);
      meshes[key] = mesh;
    }
    this.parts.clear();
    this.tags.clear();
    return meshes;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/** Write one instance transform. */
export function setInstance(mesh, i, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0) {
  _e.set(rx, ry, 0);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}
