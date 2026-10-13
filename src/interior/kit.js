// Shared kit for station interiors: hologram signs, roof trusses with LED strips, floor guide lines,
// safety stripes, railings, metal stairs and mezzanine platforms. Geometry goes into a Batch.
import * as THREE from 'three';
import { box, cyl } from '../geo.js';
import { fitFont } from '../textures.js';
import { PALETTE } from '../data.js';

const FONT = 'Unbounded, Inter, Arial, sans-serif';

/** Local → world helper for a building spec. */
export const local = (spec) => (x, z) => [spec.cx + x, spec.cz + z];

function holoTexture(text) {
  const W = 1024, H = 150;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(18,181,160,0.38)');
  g.addColorStop(1, 'rgba(11,107,99,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(4, 4, W - 8, H - 8);
  ctx.strokeStyle = 'rgba(120,255,230,0.95)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = 'rgba(120,255,230,0.25)';
  for (let y = 10; y < H - 10; y += 6) ctx.fillRect(10, y, W - 20, 1);
  fitFont(ctx, text, 700, FONT, H * 0.4, W - 70);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = PALETTE.teal;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#e9fffb';
  ctx.fillText(text, W / 2, H / 2 + 3);
  ctx.shadowBlur = 0;
  ctx.fillText(text, W / 2, H / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Floating hologram sign with a projector puck and a faint light cone. Tilted back so it reads
 * both from the ground and from above (the tour camera). Returns a Group with update(t).
 */
export function makeHolo(text, width = 15) {
  const g = new THREE.Group();
  const tex = holoTexture(text);
  const h = width * (150 / 1024);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0.95 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat);
  panel.rotation.x = -0.45;
  g.add(panel);
  const coneMat = new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.32, 0.25, 2.2, 24, 1, true), coneMat);
  cone.position.y = -h / 2 - 1.1;
  g.add(cone);
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.teal, emissive: PALETTE.teal, emissiveIntensity: 2 }));
  puck.position.y = -h / 2 - 2.25;
  g.add(puck);
  const base = g.position.clone();
  g.userData.update = (t) => {
    panel.position.y = Math.sin(t * 1.3) * 0.12;
    mat.opacity = 0.86 + Math.sin(t * 9.1) * 0.04 + Math.sin(t * 3.7) * 0.05;
  };
  g.userData.base = base;
  return g;
}

/** Steel roof trusses every ~8 m spanning the depth, with LED strips under the bottom chord. */
export function trusses(B, spec) {
  const { cx, cz, w, d, h } = spec;
  const yTop = h - 0.9, yBot = h - 2.6;
  const n = Math.max(2, Math.round(w / 12));
  for (let i = 1; i < n; i++) {
    const x = cx - w / 2 + (w * i) / n;
    B.add('steel', box(0.16, 0.16, d - 1, x, yTop, cz), box(0.16, 0.16, d - 1, x, yBot, cz));
    const panels = Math.round((d - 1) / 2.6);
    for (let k = 0; k <= panels; k++) {
      const z = cz - (d - 1) / 2 + ((d - 1) * k) / panels;
      B.add('steel', box(0.08, yTop - yBot, 0.08, x, (yTop + yBot) / 2, z));
      if (k < panels) {
        const z2 = cz - (d - 1) / 2 + ((d - 1) * (k + 1)) / panels;
        const len = Math.hypot(z2 - z, yTop - yBot);
        B.add('steel', box(0.07, 0.07, len, x, (yTop + yBot) / 2, (z + z2) / 2, 0, (k % 2 ? 1 : -1) * Math.atan2(yTop - yBot, z2 - z)));
      }
    }
    B.add('glowWarm', box(0.3, 0.08, d - 4, x, yBot - 0.16, cz));
  }
}

/** Glowing teal walkway outline on the floor. */
export function floorGuide(B, spec, x0, x1, z0, z1) {
  const L = local(spec), y = 0.18, t = 0.12;
  const [ax, az] = L(x0, z0), [bx, bz] = L(x1, z1);
  B.add('glowTeal', box(bx - ax, 0.02, t, (ax + bx) / 2, y, az), box(bx - ax, 0.02, t, (ax + bx) / 2, y, bz),
    box(t, 0.02, bz - az, ax, y, (az + bz) / 2), box(t, 0.02, bz - az, bx, y, (az + bz) / 2));
}

/** Yellow-black safety stripes around a machine footprint. */
export function hazardBorder(B, spec, x0, x1, z0, z1) {
  const L = local(spec), y = 0.19, t = 0.32;
  const [ax, az] = L(x0, z0), [bx, bz] = L(x1, z1);
  B.add('hazard', box(bx - ax + t, 0.02, t, (ax + bx) / 2, y, az), box(bx - ax + t, 0.02, t, (ax + bx) / 2, y, bz),
    box(t, 0.02, bz - az, ax, y, (az + bz) / 2), box(t, 0.02, bz - az, bx, y, (az + bz) / 2));
}

/** Safety railing along a polyline of local points at height y0. */
export function railing(B, spec, pts, y0 = 0, h = 1.1) {
  const L = local(spec);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = L(...pts[i]), [bx, bz] = L(...pts[i + 1]);
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    B.add('gold', box(0.07, 0.07, len, mx, y0 + h, mz, ry));
    B.add('steel', box(0.05, 0.05, len, mx, y0 + h * 0.5, mz, ry));
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) B.add('steel', box(0.06, h, 0.06, ax + ((bx - ax) * k) / n, y0 + h / 2, az + ((bz - az) * k) / n));
  }
}

/** Straight metal stair from (x, z) rising `rise` metres in local direction (dx, dz). */
export function stairs(B, spec, x, z, dx, dz, rise, width = 1.2) {
  const L = local(spec);
  const steps = Math.ceil(rise / 0.2), run = steps * 0.27;
  const ry = Math.atan2(dx, dz);
  for (let k = 0; k < steps; k++) {
    const [wx, wz] = L(x + dx * (k + 0.5) * 0.27, z + dz * (k + 0.5) * 0.27);
    B.add('steel', box(width, 0.05, 0.27, wx, (k + 1) * (rise / steps), wz, ry));
  }
  const len = Math.hypot(run, rise), pitch = Math.atan2(rise, run);
  for (const s of [-1, 1]) {
    const ox = Math.cos(ry) * s * width / 2, oz = -Math.sin(ry) * s * width / 2;
    const [wx, wz] = L(x + dx * run / 2, z + dz * run / 2);
    B.add('graphite', box(0.08, 0.3, len, wx + ox, rise / 2, wz + oz, ry, -pitch));
    B.add('gold', box(0.05, 0.05, len, wx + ox, rise / 2 + 1.0, wz + oz, ry, -pitch));
  }
  return run;
}

/** Mezzanine platform with grating, railing, legs and a stair. */
export function platform(B, spec, x0, x1, z0, z1, y) {
  const L = local(spec);
  const [ax, az] = L(x0, z0), [bx, bz] = L(x1, z1);
  B.add('steel', box(bx - ax, 0.12, bz - az, (ax + bx) / 2, y, (az + bz) / 2));
  B.add('hazard', box(bx - ax, 0.13, 0.15, (ax + bx) / 2, y + 0.01, az), box(bx - ax, 0.13, 0.15, (ax + bx) / 2, y + 0.01, bz));
  for (const [x, z] of [[ax, az], [bx, az], [ax, bz], [bx, bz]]) B.add('steel', box(0.2, y, 0.2, x, y / 2, z));
  railing(B, spec, [[x0, z1], [x0, z0], [x1, z0], [x1, z1]], y);
  stairs(B, spec, x1 + 0.6, z1, 0, -1, y);
}

/** Cylinder helper in local coords. */
export function lcyl(B, key, spec, rt, rb, h, x, y, z, seg = 16, rx = 0, rz = 0) {
  const [wx, wz] = local(spec)(x, z);
  B.add(key, cyl(rt, rb, h, wx, y, wz, seg, rx, rz));
}

/** Box helper in local coords. */
export function lbox(B, key, spec, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  const [wx, wz] = local(spec)(x, z);
  B.add(key, box(w, h, d, wx, y, wz, ry, rx, rz));
}
