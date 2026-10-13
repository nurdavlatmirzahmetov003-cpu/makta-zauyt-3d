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
