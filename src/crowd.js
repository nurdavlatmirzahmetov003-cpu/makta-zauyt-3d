// Robots that replace people: ~32 instanced humanoids with a walk cycle and roles, drones on
// inspection loops, outdoor AMR carts, and extra industrial arms in the robot centre / repair shop.
import * as THREE from 'three';
import { Batch, box, cyl, merge, paint } from './geo.js';
import { mats, TILE } from './materials.js';
import { Path } from './flow.js';
import { RobotArm, makeAMR } from './robots.js';
import { PALETTE, ROBOT_TEXT } from './data.js';
import { fitFont } from './textures.js';
import { ROADS } from './roads.js';

const V = (x, z) => new THREE.Vector3(x, groundY(x, z), z);

/** Walking surface height: road 0.07, raised sidewalk 0.2, lawn / plaza / apron ~0.05. */
function groundY(x, z) {
  for (const r of ROADS) {
    if (r.highway) continue;
    const along = r.axis === 'x' ? x : z, off = Math.abs(r.axis === 'x' ? z - r.c : x - r.c);
    if (along < r.a0 - 8 || along > r.a1 + 8) continue;
    if (off <= r.w / 2) return 0.07;
    if (!r.minor && off <= r.w / 2 + 3) return 0.2;
  }
  return 0.05;
}
const FAR = 260;

/* ---------------- Humanoids (instanced body parts) ---------------- */

// Roles: walk = follows a path; idle = stands; wave = greeter; tablet / carry = arm poses.
const BODY = '#eef1f2', NAVY = '#1f3157';
const VESTS = { lime: '#b8ff3a', orange: '#ff8b3d', teal: '#27e3c8', gold: '#ffd24a' };

function people() {
  const P = [];
  const walk = (pts, opts = {}) => P.push({ pts: pts.map(([x, z]) => V(x, z)), ...opts });
  // Robots walking between the production rows and the canteen (cross S2 at the zebra).
  const canteen = [[-245, -17.8], [-273.5, -17.8], [-273.5, -2.2], [-208, -2.2], [-208, 30], [-210, 44]];
  for (let i = 0; i < 6; i++) walk(canteen, { vest: i % 2 ? 'lime' : 'orange', start: i / 6 });
  // Engineers with tablets: administration ↔ showroom over the roundabout zebra.
  const eng = [[-90, 87], [-24, 69], [24, 69], [62, 80], [90, 93]];
  for (let i = 0; i < 4; i++) walk(eng, { vest: 'teal', pose: 'tablet', start: i / 4 });
  // Security patrols at the gate and the guard on the island.
  walk([[12.6, 225], [12.6, 238]], { body: NAVY, vest: 'gold', badge: true, start: 0.2 });
  walk([[-12.6, 225], [-12.6, 238]], { body: NAVY, vest: 'gold', badge: true, start: 0.7 });
  P.push({ pts: [new THREE.Vector3(0, 0.25, 231)], idle: true, body: NAVY, vest: 'gold', badge: true, yaw: 0 });
  // Greeter outside the gate, waving at the arriving trucks.
  P.push({ pts: [V(13.2, 247)], idle: true, pose: 'wave', vest: 'teal', yaw: -0.5 });
  // Visitors browsing inside the factory shop.
  for (let i = 0; i < 3; i++) walk([[162, 156], [178, 156], [178, 164], [162, 164]], { loop: true, indoor: true, vest: 'gold', start: i / 3, speed: 0.7 });
  // Laboratory robots on the apron in front of the lab.
  for (let i = 0; i < 2; i++) walk([[-52, -21], [-18, -21]], { vest: 'teal', pose: 'tablet', start: i * 0.5 });
  // Operators on the control platforms inside the stations.
  for (const [x, y, z, yaw] of [[-230.5, 3.32, -142, 0], [-112, 2.72, -125, 1.6], [35, 4.32, -213.8, 0], [-120, 0.16, -112, 3.1], [236, 0.16, -51, 0.4], [104, 0.16, -121.5, 0]]) {
    P.push({ pts: [new THREE.Vector3(x, y, z)], idle: true, pose: 'tablet', vest: 'orange', yaw });
  }
  // Warehouse robots carrying cartons inside dispatch.
  for (let i = 0; i < 3; i++) walk([[21, -50], [49, -50]], { vest: 'lime', pose: 'carry', indoor: true, start: i / 3, speed: 1.0 });
  // Robots resting on the charging pads outside the robot centre.
  for (const x of [-251, -247, -243, -239]) P.push({ pts: [new THREE.Vector3(x, 0.08, -21)], idle: true, vest: 'teal', yaw: 0, charging: true });
  return P;
}

function badgeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d1b33';
  ctx.fillRect(0, 0, 128, 48);
  ctx.strokeStyle = PALETTE.teal;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 44);
  ctx.fillStyle = '#9ffcef';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = PALETTE.teal;
  ctx.shadowBlur = 8;
  fitFont(ctx, ROBOT_TEXT.security, 800, 'Unbounded, Inter, Arial', 26, 112);
  ctx.fillText(ROBOT_TEXT.security, 64, 25);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildHumanoids(scene) {
  const list = people();
  const N = list.length;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2, ...o });
  const body = std({ color: '#ffffff' });
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const parts = {
    torso: [new THREE.CapsuleGeometry(0.19, 0.36, 4, 12).scale(1.25, 1, 0.8), body, 1],
    pelvis: [new THREE.BoxGeometry(0.36, 0.16, 0.22), body, 1],
    head: [new THREE.SphereGeometry(0.13, 16, 12).scale(1, 1.1, 1), body, 1],
    helmet: [new THREE.SphereGeometry(0.155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1.1), std({ color: '#ffffff' }), 1],
    visor: [new THREE.BoxGeometry(0.21, 0.06, 0.05), glow(PALETTE.teal), 1],
    vest: [new THREE.BoxGeometry(0.5, 0.34, 0.3), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 1],
    upperArm: [new THREE.CapsuleGeometry(0.055, 0.22, 3, 8).translate(0, -0.15, 0), body, 2],
    lowerArm: [new THREE.CapsuleGeometry(0.048, 0.22, 3, 8).translate(0, -0.15, 0), body, 2],
    upperLeg: [new THREE.CapsuleGeometry(0.075, 0.3, 3, 8).translate(0, -0.21, 0), body, 2],
    lowerLeg: [merge([new THREE.CapsuleGeometry(0.065, 0.3, 3, 8).translate(0, -0.21, 0), new THREE.BoxGeometry(0.12, 0.06, 0.24).translate(0, -0.43, 0.05)]), body, 2],
  };
  const im = {};
  for (const [k, [g, mat, mult]] of Object.entries(parts)) {
    const m = new THREE.InstancedMesh(g, mat, N * mult);
    m.castShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    im[k] = m;
  }
  const extras = {
    badge: new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.075), new THREE.MeshBasicMaterial({ map: badgeTexture(), toneMapped: false }), N),
    tablet: new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.18, 0.015), glow('#7ffbe9'), N),
    carton: new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.3, 0.32), new THREE.MeshStandardMaterial({ color: '#c9a06a', roughness: 0.8 }), N),
  };
  for (const m of Object.values(extras)) { m.frustumCulled = false; m.count = 0; scene.add(m); }
  const col = new THREE.Color();
  list.forEach((p, i) => {
    for (const k of ['torso', 'pelvis', 'head', 'upperArm', 'lowerArm', 'upperLeg', 'lowerLeg']) {
      const c = col.set(p.body || BODY);
      if (parts[k][2] === 2) { im[k].setColorAt(i * 2, c); im[k].setColorAt(i * 2 + 1, c); } else im[k].setColorAt(i, c);
    }
    im.vest.setColorAt(i, col.set(VESTS[p.vest] || VESTS.lime));
    im.helmet.setColorAt(i, col.set(p.body === NAVY ? '#2b4a7a' : p.vest === 'orange' ? '#ffd24a' : '#ffffff'));
    if (p.indoor) for (const v of p.pts) v.y = 0.16;
    p.path = p.pts.length > 1 ? new Path(p.pts, !!p.loop) : null;
    p.s = (p.start || 0) * (p.path ? p.path.length : 0);
    p.dir = 1;
    p.phase = i * 1.7;
    p.pos = p.pts[0].clone();
    p.yawNow = p.yaw ?? 0;
    p.speed = p.speed ?? 1.25;
  });

  // Matrix helpers (root → joints).
  const M = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), A = new THREE.Matrix4(), B = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3();
  const local = (out, parent, x, y, z, rx = 0, ry = 0, rz = 0) => {
    e.set(rx, ry, rz);
    q.setFromEuler(e);
    T.compose(tmp.set(x, y, z), q, one);
    return out.multiplyMatrices(parent, T);
  };

  function pose(p, i, t, moving) {
    const ph = p.phase;
    const sw = moving ? Math.sin(ph) : 0;
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.035 : Math.sin(t * 1.5 + i) * 0.006;
    e.set(0, p.yawNow, 0);
    q.setFromEuler(e);
    M.compose(tmp.set(p.pos.x, p.pos.y + bob, p.pos.z), q, one);
    im.pelvis.setMatrixAt(i, local(A, M, 0, 0.92, 0));
    const lean = moving ? 0.06 : 0;
    const torso = local(B, M, 0, 1.2, 0, lean);
    im.torso.setMatrixAt(i, torso);
    im.vest.setMatrixAt(i, local(A, torso, 0, 0.02, 0));
    const look = p.idle ? Math.sin(t * 0.4 + i) * 0.4 : 0;
    im.head.setMatrixAt(i, local(A, torso, 0, 0.44, 0, 0, look));
    im.helmet.setMatrixAt(i, local(A, torso, 0, 0.49, 0, 0, look));
    im.visor.setMatrixAt(i, local(A, torso, Math.sin(look) * 0.11, 0.45, Math.cos(look) * 0.115, 0, look));
    // Arms.
    for (const s of [-1, 1]) {
      let ua = -sw * 0.45 * s, la = -0.25, uz = s * 0.08;
      if (p.pose === 'tablet') { ua = -0.45; la = -1.3; }
      if (p.pose === 'carry') { ua = -0.7; la = -0.9; uz = s * 0.02; }
      if (p.pose === 'wave' && s > 0) { ua = 0; uz = 2.6; la = Math.sin(t * 6) * 0.6 - 0.2; }
      const shoulder = local(A, torso, s * 0.27, 0.2, 0, ua, 0, uz);
      im.upperArm.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), shoulder);
      im.lowerArm.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), local(B, shoulder, 0, -0.31, 0, la));
    }
    // Legs.
    for (const s of [-1, 1]) {
      const swing = sw * 0.5 * s;
      const knee = moving ? Math.max(0, Math.sin(ph + (s > 0 ? 0 : Math.PI) + 1.2)) * 0.75 : 0.02;
      const hip = local(A, M, s * 0.11, 0.9, 0, swing);
      im.upperLeg.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), hip);
      im.lowerLeg.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), local(B, hip, 0, -0.43, 0, knee));
    }
  }

  const write = (t, camera) => {
    let nb = 0, nt = 0, nc = 0;
    list.forEach((p, i) => {
      if (!(camera && camera.position.distanceTo(p.pos) > FAR && p.drawn)) pose(p, i, t, !!p.path);
      p.drawn = true;
      e.set(0, p.yawNow, 0);
      q.setFromEuler(e);
      M.compose(tmp.set(p.pos.x, p.pos.y, p.pos.z), q, one);
      if (p.badge) extras.badge.setMatrixAt(nb++, local(A, M, 0.08, 1.3, 0.165));
      if (p.pose === 'tablet') extras.tablet.setMatrixAt(nt++, local(A, M, 0, 1.06, 0.36, -0.6));
      if (p.pose === 'carry') extras.carton.setMatrixAt(nc++, local(A, M, 0, 1.0, 0.36));
    });
    extras.badge.count = nb; extras.tablet.count = nt; extras.carton.count = nc;
    for (const m of [...Object.values(im), ...Object.values(extras)]) m.instanceMatrix.needsUpdate = true;
  };

  write(0, null);
  for (const m of Object.values(im)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return {
    list,
    update(dt, t, camera) {
      for (const p of list) {
        if (!p.path) continue;
        if (camera.position.distanceTo(p.pos) > FAR) continue; // far away: freeze
        const L = p.path.length;
        p.s += p.dir * p.speed * dt;
        if (p.loop) p.s = ((p.s % L) + L) % L;
        else if (p.s > L) { p.s = L; p.dir = -1; }
        else if (p.s < 0) { p.s = 0; p.dir = 1; }
        p.path.at(p.s, p.pos);
        p.pos.y = p.indoor ? 0.16 : groundY(p.pos.x, p.pos.z);
        p.path.dirAt(p.s, dir);
        const target = Math.atan2(dir.x * p.dir, dir.z * p.dir);
        let d = target - p.yawNow;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        p.yawNow += d * Math.min(1, dt * 6);
        p.phase += dt * p.speed * 5.2;
      }
      write(t, camera);
    },
  };
}

/* ---------------- Drones ---------------- */
function makeDrone() {
  const g = new THREE.Group();
  const m = mats();
  g.add(new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(0.7, 0.22, 0.7), '#f3f5f5'),
    paint(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.1, 0), '#f3f5f5'),
    paint(new THREE.BoxGeometry(1.9, 0.06, 0.1).rotateY(Math.PI / 4), '#2a3338'),
    paint(new THREE.BoxGeometry(1.9, 0.06, 0.1).rotateY(-Math.PI / 4), '#2a3338'),
    paint(new THREE.SphereGeometry(0.12, 10, 8).translate(0, -0.16, 0.25), '#1f2a30'),
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 24).rotateX(Math.PI / 2), m.glowTeal));
  const rotors = [];
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const r = new THREE.Mesh(merge([
      new THREE.BoxGeometry(0.75, 0.015, 0.07),
      new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8),
    ]), m.dark);
    r.position.set(Math.cos(a) * 0.67, 0.1, Math.sin(a) * 0.67);
    g.add(r);
    rotors.push(r);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.rotors = rotors;
  return g;
}

const DRONE_LOOPS = [
  (t) => [-490 + Math.cos(t) * 90, 34, -400 + Math.sin(t) * 40],
  (t) => [490 + Math.cos(t) * 90, 36, -400 + Math.sin(t) * 40],
  (t) => [Math.sin(t) * 230, 46, -125 + Math.sin(t * 2) * 30],
  (t) => [-475 + Math.sin(t) * 120, 28, 90 + Math.sin(t * 2) * 60],
  (t) => [105 + Math.cos(t) * 32, 34, -205 + Math.sin(t) * 32],
  (t) => [Math.cos(t) * 310, 24, -11 + Math.sin(t) * 262],
];

/* ---------------- Assembly ---------------- */
export function buildRobots(scene, site) {
  const humans = buildHumanoids(scene);
  const drones = DRONE_LOOPS.map((f, i) => { const d = makeDrone(); d.userData.f = f; d.userData.t = i * 1.3; d.userData.speed = 0.05 + i * 0.006; scene.add(d); return d; });

  // Outdoor AMR carts in the yard between the oil and fibre rows.
  const S = new Batch();
  const amrs = [];
  const lanes = [[-230, -120, -170], [-230, -120, -160], [-90, 270, -170], [-90, 270, -160], [-90, 270, -166]];
  lanes.forEach(([x0, x1, z], i) => {
    for (let k = 0; k < (x1 - x0 > 200 ? 2 : 1); k++) {
      const load = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.2).translate(0, 0.35, 0), i % 2 ? mats().fabric : new THREE.MeshStandardMaterial({ color: '#c9a06a', roughness: 0.8 }));
      const a = makeAMR({ load });
      scene.add(a);
      amrs.push({ a, x0, x1, z, u: (k * 0.5 + i * 0.13) % 1, speed: 1.6 / (x1 - x0) });
    }
  });
  // Charging pads in front of the robot centre.
  for (const x of [-251, -247, -243, -239]) {
    S.add('glowTeal', cyl(0.75, 0.75, 0.04, x, 0.05, -21, 24));
    S.add('graphite', box(0.5, 1.4, 0.2, x, 0.7, -21.8));
  }
  S.build(mats(), TILE, scene, { name: 'robot-pads' });

  // Extra industrial arms: maintenance bays in the robot centre and the repair workshop.
  const bays = [];
  const addArms = (id, n, scale) => {
    const b = site?.list.get(id);
    if (!b) return;
    const { cx, cz } = b.spec;
    for (let i = 0; i < n; i++) {
      const arm = new RobotArm({ scale, poses: RobotArm.pickPlace(i % 2 ? 0 : Math.PI, Math.PI / 2 * (i % 3 - 1), 0.8) });
      arm.position.set(cx - 15 + (i % 4) * 10, 0.16, cz - 6 + Math.floor(i / 4) * 12);
      arm.k = i % 7;
      b.interior.add(arm);
      bays.push({ arm, b });
    }
  };
  addArms('robots', 8, 1.2);
  addArms('repair', 6, 1.6);

  let t = 0;
  return {
    humans, drones, amrs,
    counts: { humanoids: humans.list.length, drones: drones.length, amrs: amrs.length, extraArms: bays.length },
    update(dt, camera) {
      t += dt;
      humans.update(dt, t, camera);
      for (const d of drones) {
        const u = d.userData;
        u.t += dt * u.speed;
        const [x, y, z] = u.f(u.t), [nx, , nz] = u.f(u.t + 0.02);
        d.position.set(x, y + Math.sin(t * 1.3 + u.t) * 0.6, z);
        d.rotation.y = Math.atan2(nx - x, nz - z);
        d.rotation.x = 0.12;
        for (const r of u.rotors) r.rotation.y += dt * 40;
      }
      for (const A of amrs) {
        A.u = (A.u + dt * A.speed) % 2;
        const k = A.u < 1 ? A.u : 2 - A.u;
        A.a.position.set(A.x0 + (A.x1 - A.x0) * k, 0.03, A.z);
        A.a.rotation.y = A.u < 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      for (const { arm, b } of bays) if (b.interior.visible) arm.update(dt, 0.8);
    },
  };
}
