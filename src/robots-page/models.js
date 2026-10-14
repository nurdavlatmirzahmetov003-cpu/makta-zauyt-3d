// Stand-alone robot models for the robots page (the factory scene uses instanced humanoids).
// Every model returns a Group whose userData.rig = { kind, lights, accents, update(dt, s) } where
// s = { t, moving, speed, action, k } drives walking, waving, dancing, sitting, jumping and the job.
import * as THREE from 'three';
import { PALETTE } from '../data.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.2, ...o });
const glowMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.4 });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

/* ---------------- Humanoid (operator, security, lab) ---------------- */
export function makeHumanoid({ body = '#eef1f2', vest = '#ff8b3d', helmet = '#ffffff', badge = false, prop = null } = {}) {
  const root = new THREE.Group();
  const B = std(body), V = new THREE.MeshBasicMaterial({ color: vest, toneMapped: false }), H = std(helmet);
  const visor = glowMat(PALETTE.teal), dark = std('#1f2a30', { metalness: 0.5 });
  const hips = pivot(0, 0.92, 0);
  root.add(hips);
  hips.add(mesh(new THREE.BoxGeometry(0.36, 0.16, 0.22), B));
  const torso = pivot(0, 0.28, 0);
  hips.add(torso);
  torso.add(mesh(new THREE.CapsuleGeometry(0.19, 0.36, 4, 14).scale(1.25, 1, 0.8), B));
  torso.add(mesh(new THREE.BoxGeometry(0.5, 0.34, 0.3), V, 0, 0.02, 0));
  if (badge) torso.add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.02), glowMat(PALETTE.gold), 0.09, 0.1, 0.16));
  const head = pivot(0, 0.44, 0);
  torso.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.13, 18, 14).scale(1, 1.1, 1), B));
  head.add(mesh(new THREE.SphereGeometry(0.155, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1.1), H, 0, 0.05, 0));
  head.add(mesh(new THREE.BoxGeometry(0.21, 0.06, 0.05), visor, 0, 0.01, 0.115));
  const limb = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10).translate(0, -l / 2 - r * 0.5, 0);
  const arms = [-1, 1].map((s) => {
    const sh = pivot(s * 0.27, 0.2, 0);
    torso.add(sh);
    sh.add(mesh(limb(0.055, 0.22), B));
    const el = pivot(0, -0.31, 0);
    sh.add(el);
    el.add(mesh(limb(0.048, 0.22), B));
    el.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), dark, 0, -0.32, 0));
    return { sh, el, s };
  });
  const legs = [-1, 1].map((s) => {
    const hip = pivot(s * 0.11, -0.02, 0);
    hips.add(hip);
    hip.add(mesh(limb(0.075, 0.3), B));
    const knee = pivot(0, -0.43, 0);
    hip.add(knee);
    knee.add(mesh(limb(0.065, 0.3), B));
    knee.add(mesh(new THREE.BoxGeometry(0.12, 0.06, 0.24), dark, 0, -0.43, 0.05));
    return { hip, knee, s };
  });
  let tool = null;
  if (prop === 'tablet') { tool = mesh(new THREE.BoxGeometry(0.26, 0.18, 0.015), glowMat('#7ffbe9'), 0, -0.36, 0.08); arms[1].el.add(tool); }
  if (prop === 'scanner') { tool = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 10).rotateX(Math.PI / 2), glowMat('#b58cff'), 0, -0.34, 0.12); arms[1].el.add(tool); }
  root.userData.rig = {
    kind: 'humanoid', lights: [visor], accents: [V],
    update(dt, s) {
      const t = s.t, w = s.moving ? Math.sin(t * 7) : 0, sit = s.sit || 0;
      hips.position.y = 0.92 - sit * 0.38 + (s.moving ? Math.abs(Math.sin(t * 7)) * 0.03 : Math.sin(t * 1.6) * 0.005);
      torso.rotation.x = s.moving ? 0.06 : -sit * 0.1;
      head.rotation.y = s.action === 'idle' ? Math.sin(t * 0.5) * 0.35 : 0;
      for (const L of legs) {
        L.hip.rotation.x = w * 0.55 * L.s - sit * 1.45;
        L.knee.rotation.x = (s.moving ? Math.max(0, Math.sin(t * 7 + (L.s > 0 ? 0 : Math.PI) + 1.2)) * 0.8 : 0.02) + sit * 1.5;
      }
      for (const A of arms) {
        let x = -w * 0.5 * A.s, z = A.s * 0.08, e = -0.25;
        if (tool && A.s > 0) { x = -0.5; e = -1.3; }
        if (s.action === 'wave' && A.s > 0) { x = 0; z = 2.7; e = Math.sin(t * 9) * 0.6 - 0.2; }
        if (s.action === 'dance') { x = Math.sin(t * 6 + A.s) * 1.1; z = A.s * (1.2 + Math.sin(t * 6) * 0.6); e = -1 - Math.sin(t * 12) * 0.4; }
        if (s.action === 'work' && A.s > 0) { x = -0.9 - Math.sin(t * 4) * 0.3; e = -1.4; }
        A.sh.rotation.set(x, 0, z);
        A.el.rotation.x = e;
      }
      if (s.action === 'dance') { hips.rotation.y = Math.sin(t * 4) * 0.5; hips.position.y += Math.abs(Math.sin(t * 8)) * 0.05; } else hips.rotation.y = 0;
    },
  };
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}

/* ---------------- «Тазалықшы»: round cleaning robot ---------------- */
export function makeCleaner() {
  const g = new THREE.Group();
  const white = std('#f6f8f8'), dark = std('#243036', { metalness: 0.4 }), ring = glowMat(PALETTE.teal), head = glowMat('#fff2c8');
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.32, 40), white, 0, 0.26, 0));
  g.add(mesh(new THREE.TorusGeometry(0.64, 0.035, 8, 48).rotateX(Math.PI / 2), ring, 0, 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.5, 32), white, 0, 0.66, -0.05));
  g.add(mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#0b6b63', { metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.8 }), 0, 0.9, -0.05));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), dark, 0, 1.2, -0.05));
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), head, 0, 0.36, 0.64));
  const brushes = [-1, 1].map((s) => {
    const b = new THREE.Group();
    b.position.set(s * 0.45, 0.06, 0.45);
    for (let k = 0; k < 6; k++) { const bristle = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.04), std(PALETTE.gold)); bristle.rotation.y = (k * Math.PI) / 6; b.add(bristle); }
    g.add(b);
    return b;
  });
  g.userData.rig = {
    kind: 'wheeled', lights: [head], accents: [ring],
    update(dt, s) {
      const spin = s.action === 'work' || s.moving ? 18 : s.action === 'dance' ? 10 : 2;
      brushes.forEach((b, i) => { b.rotation.y += dt * spin * (i ? -1 : 1); });
    },
  };
  return g;
}

/* ---------------- «Өрмекші»: six-legged inspection robot ---------------- */
export function makeSpider() {
  const g = new THREE.Group();
  const white = std('#eef2f2'), dark = std('#2a3338', { metalness: 0.5 }), eye = glowMat('#ff6b5a'), ring = glowMat(PALETTE.teal);
  const body = pivot(0, 0.75, 0);
  g.add(body);
  body.add(mesh(new THREE.SphereGeometry(0.5, 28, 18).scale(1.2, 0.5, 1), white));
  body.add(mesh(new THREE.TorusGeometry(0.58, 0.03, 8, 40).rotateX(Math.PI / 2), ring, 0, 0, 0));
  const head = pivot(0, 0.12, 0.55);
  body.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), dark));
  for (const x of [-0.09, 0.09]) head.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), eye, x, 0.02, 0.12));
  head.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 16), dark, 0, 0.18, 0));
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1, k = i % 3, a = (k - 1) * 0.65;
    const hip = pivot(side * 0.45 * Math.cos(a), -0.02, 0.45 * Math.sin(a) * 1.1);
    hip.rotation.y = side < 0 ? Math.PI - a : a;
    body.add(hip);
    const up = pivot(0, 0, 0);
    hip.add(up);
    up.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 10).rotateZ(Math.PI / 2).translate(0.31, 0, 0), white));
    const knee = pivot(0.62, 0, 0);
    up.add(knee);
    knee.add(mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.78, 10).translate(0, -0.39, 0), dark));
    knee.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), std(PALETTE.gold), 0, -0.78, 0));
    legs.push({ up, knee, ph: (i % 2) * Math.PI });
  }
  g.userData.rig = {
    kind: 'legged', lights: [eye], accents: [ring],
    update(dt, s) {
      const t = s.t, walk = s.moving || s.action === 'work';
      for (const L of legs) {
        const p = Math.sin(t * 8 + L.ph);
        L.up.rotation.z = 0.35 + (walk ? Math.max(0, p) * 0.35 : 0) + (s.action === 'dance' ? Math.sin(t * 10 + L.ph) * 0.4 : 0);
        L.knee.rotation.z = -0.95 + (walk ? p * 0.15 : 0);
        L.up.rotation.y = walk ? Math.cos(t * 8 + L.ph) * 0.25 : 0;
      }
      body.position.y = 0.75 - (s.sit || 0) * 0.35 + (walk ? Math.abs(Math.sin(t * 8)) * 0.03 : 0);
      head.rotation.y = s.action === 'work' ? Math.sin(t * 2) * 0.6 : 0;
    },
  };
  return g;
}

/* ---------------- «Шебер»: tracked repair robot with a wrench and a welder ---------------- */
export function makeRepairer() {
  const g = new THREE.Group();
  const white = std('#f2f4f4'), dark = std('#222a2f', { metalness: 0.5 }), gold = std(PALETTE.gold, { metalness: 0.8 }), visor = glowMat(PALETTE.teal), spark = glowMat('#7fd8ff');
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.28, 0.34, 1.1), dark, s * 0.42, 0.17, 0));
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.3, 0.9), white, 0, 0.45, 0));
  const torso = pivot(0, 0.6, 0);
  g.add(torso);
  torso.add(mesh(new THREE.BoxGeometry(0.62, 0.6, 0.45), white, 0, 0.3, 0));
  torso.add(mesh(new THREE.BoxGeometry(0.64, 0.08, 0.47), visor, 0, 0.42, 0));
  const head = pivot(0, 0.72, 0);
  torso.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.4, 0.26, 0.32), white));
  head.add(mesh(new THREE.BoxGeometry(0.3, 0.07, 0.04), visor, 0, 0.02, 0.17));
  head.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), dark, 0.12, 0.26, 0));
  const arms = [-1, 1].map((s) => {
    const sh = pivot(s * 0.38, 0.45, 0);
    torso.add(sh);
    sh.add(mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12).translate(0, -0.21, 0), gold));
    const el = pivot(0, -0.42, 0);
    sh.add(el);
    el.add(mesh(new THREE.BoxGeometry(0.1, 0.36, 0.1).translate(0, -0.18, 0), white));
    el.add(s < 0 ? mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12, Math.PI * 1.4), dark, 0, -0.42, 0) : mesh(new THREE.ConeGeometry(0.05, 0.16, 10).rotateX(Math.PI), dark, 0, -0.44, 0));
    return { sh, el, s };
  });
  const sparkle = mesh(new THREE.SphereGeometry(0.06, 8, 6), spark, 0, -0.55, 0);
  arms[1].el.add(sparkle);
  g.userData.rig = {
    kind: 'wheeled', lights: [visor, spark], accents: [visor],
    update(dt, s) {
      const t = s.t, work = s.action === 'work';
      for (const A of arms) {
        A.sh.rotation.x = work ? -1.1 + Math.sin(t * 5 + A.s) * 0.2 : s.action === 'wave' && A.s > 0 ? 0 : -0.2;
        A.sh.rotation.z = s.action === 'wave' && A.s > 0 ? 2.5 + Math.sin(t * 8) * 0.4 : s.action === 'dance' ? A.s * (0.6 + Math.sin(t * 7) * 0.5) : A.s * 0.15;
        A.el.rotation.x = work ? -0.8 : -0.3;
      }
      sparkle.visible = work && Math.sin(t * 40) > -0.2;
      torso.rotation.y = s.action === 'dance' ? Math.sin(t * 5) * 0.5 : 0;
      head.rotation.y = s.action === 'idle' ? Math.sin(t * 0.6) * 0.4 : 0;
    },
  };
  return g;
}
