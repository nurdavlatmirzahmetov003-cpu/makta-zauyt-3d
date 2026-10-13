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

/** Points along a circular arc in the XZ plane (angles in radians, y constant). */
export function arcPoints(cx, cz, r, a0, a1, y = 0, steps = 12) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  return pts;
}
