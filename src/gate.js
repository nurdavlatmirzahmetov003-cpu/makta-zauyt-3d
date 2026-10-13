// Perimeter fence and the main entrance: sculptural arch with illuminated signs, cotton photo light
// boxes, 2 entry + 2 exit lanes with animated boom barriers, an inspection scanner arch and safety signs.
import * as THREE from 'three';
import { Batch, box, merge, setInstance } from './geo.js';
import { mats, TILE, registerGlow } from './materials.js';
import { ZONES } from './terrain.js';
import { GATE_TEXT, PALETTE } from './data.js';
import { gateSignTexture, atlasPlane } from './signs.js';
import { barrierTexture, cottonPhotoTexture, dashTexture } from './textures-site.js';

const GZ = 240;          // gate line (south fence)
const OPEN_X = 25;       // gate opening half width
const LANES = [          // centre x, barrier z, direction of travel (−1 = northbound / entering)
  { x: 5, z: 251, dir: -1, post: 3.3, arm: 3.1 },
  { x: 9, z: 251, dir: -1, post: 7.2, arm: 3.6 },
  { x: -5, z: 229, dir: 1, post: -3.3, arm: -3.1 },
  { x: -9, z: 229, dir: 1, post: -7.2, arm: -3.6 },
];

function fence(B, scene) {
  const { x0, x1, z0, z1 } = ZONES.plot;
  const runs = [
    [[x0, z1], [-OPEN_X, z1]], [[OPEN_X, z1], [x1, z1]],
    [[x0, z0], [x1, z0]], [[x0, z0], [x0, z1]], [[x1, z0], [x1, z1]],
  ];
  const posts = [];
  for (const [[ax, az], [bx, bz]] of runs) {
    const len = Math.hypot(bx - ax, bz - az), alongX = az === bz;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    B.add('concrete', alongX ? box(len, 0.6, 0.35, mx, 0.3, mz) : box(0.35, 0.6, len, mx, 0.3, mz));
    B.add('fence', alongX ? new THREE.PlaneGeometry(len, 2.2).translate(mx, 1.7, mz)
      : new THREE.PlaneGeometry(len, 2.2).rotateY(Math.PI / 2).translate(mx, 1.7, mz));
    B.add('steel', alongX ? box(len, 0.07, 0.07, mx, 2.83, mz) : box(0.07, 0.07, len, mx, 2.83, mz));
    B.add('glowTeal', alongX ? box(len, 0.05, 0.05, mx, 0.62, mz + 0.18) : box(0.05, 0.05, len, mx + 0.18, 0.62, mz));
    const n = Math.round(len / 3);
    for (let i = 0; i <= n; i++) posts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  }
  const m = mats();
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 3, 0.12).translate(0, 1.5, 0), m.steel, posts.length);
  posts.forEach(([x, z], i) => setInstance(im, i, x, 0, z));
  im.castShadow = true;
  im.computeBoundingSphere();
  scene.add(im);
  // Taller corner posts with CCTV cameras.
  for (const [x, z, a] of [[x0, z0, 45], [x1, z0, 135], [x1, z1, -135], [x0, z1, -45], [-OPEN_X - 1, z1, -90], [OPEN_X + 1, z1, -90]]) {
    const r = (a * Math.PI) / 180;
    B.add('graphite', box(0.3, 5, 0.3, x, 2.5, z));
    B.add('white', box(0.32, 0.28, 0.7, x + Math.sin(r) * 0.45, 4.8, z + Math.cos(r) * 0.45, r, 0.2));
    B.add('glowRed', box(0.08, 0.08, 0.04, x + Math.sin(r) * 0.82, 4.8, z + Math.cos(r) * 0.82, r));
  }
  return posts.length;
}

/** Sculptural arch: tapered pylons leaning inwards into a slim crescent crown, extruded 5 m deep. */
const ARCH_TOP = 19;
function archCurves() {
  const v = (x, y) => new THREE.Vector3(x, y, 0);
  const outer = new THREE.CurvePath();
  outer.add(new THREE.LineCurve3(v(-26, 0.3), v(-23.6, 12.5)));
  outer.add(new THREE.QuadraticBezierCurve3(v(-23.6, 12.5), v(-22.6, 18.6), v(-13, ARCH_TOP)));
  outer.add(new THREE.LineCurve3(v(-13, ARCH_TOP), v(13, ARCH_TOP)));
  outer.add(new THREE.QuadraticBezierCurve3(v(13, ARCH_TOP), v(22.6, 18.6), v(23.6, 12.5)));
  outer.add(new THREE.LineCurve3(v(23.6, 12.5), v(26, 0.3)));
  const inner = new THREE.CurvePath();
  inner.add(new THREE.LineCurve3(v(-22, 0.3), v(-21, 10.4)));
  inner.add(new THREE.QuadraticBezierCurve3(v(-21, 10.4), v(-20.4, 15.4), v(-12, 15.6)));
  inner.add(new THREE.LineCurve3(v(-12, 15.6), v(12, 15.6)));
  inner.add(new THREE.QuadraticBezierCurve3(v(12, 15.6), v(20.4, 15.4), v(21, 10.4)));
  inner.add(new THREE.LineCurve3(v(21, 10.4), v(22, 0.3)));
  return { outer, inner };
}

function arch(B) {
  const s = new THREE.Shape();
  s.moveTo(-26, 0);
  s.lineTo(-23.6, 12.5);
  s.quadraticCurveTo(-22.6, 18.6, -13, ARCH_TOP);
  s.lineTo(13, ARCH_TOP);
  s.quadraticCurveTo(22.6, 18.6, 23.6, 12.5);
  s.lineTo(26, 0);
  s.lineTo(22, 0);
  s.lineTo(21, 10.4);
  s.quadraticCurveTo(20.4, 15.4, 12, 15.6);
  s.lineTo(-12, 15.6);
  s.quadraticCurveTo(-20.4, 15.4, -21, 10.4);
  s.lineTo(-22, 0);
  s.closePath();
  const depth = 5;
  B.add('white', new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 3, curveSegments: 24 })
    .translate(0, 0, GZ - depth / 2));
  // Glowing inner contour and gold outer line on both faces.
  const { outer, inner } = archCurves();
  for (const z of [GZ + depth / 2 + 0.35, GZ - depth / 2 - 0.35]) {
    B.add('glowTeal', new THREE.TubeGeometry(inner, 200, 0.17, 6, false).translate(0, 0, z));
    B.add('gold', new THREE.TubeGeometry(outer, 200, 0.12, 6, false).translate(0, 0, z));
  }
  // Pylon accents: vertical teal strips and dark plinths.
  for (const sx of [-1, 1]) {
    for (const z of [GZ + depth / 2 + 0.33, GZ - depth / 2 - 0.33]) B.add('glowTeal', box(0.25, 8.5, 0.08, sx * 23.4, 4.8, z));
    B.add('graphite', box(5.4, 0.8, depth + 1.4, sx * 24, 0.4, GZ));
  }
}

function signs(group) {
  const m = mats();
  const mainTex = gateSignTexture(GATE_TEXT.main, { width: 2048, height: 230 });
  const subTex = gateSignTexture(GATE_TEXT.sub, { width: 2048, height: 120, color: PALETTE.gold, font: 700 });
  const mk = (tex, glow) => {
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: glow, roughness: 0.3, metalness: 0.2 });
    registerGlow(mat, glow, glow * 2.4);
    return mat;
  };
  const mainMat = mk(mainTex, 0.75), subMat = mk(subTex, 0.6);
  const W = 36, H = W * (230 / 2048);
  // Main sign box standing on the crown of the arch, readable from both sides.
  const frame = new THREE.Mesh(box(W + 0.6, H + 0.6, 1.0, 0, ARCH_TOP + H / 2 + 0.55, GZ), m.graphite);
  frame.castShadow = true;
  group.add(frame);
  for (const [z, ry] of [[GZ + 0.52, 0], [GZ - 0.52, Math.PI]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateY(ry).translate(0, ARCH_TOP + H / 2 + 0.55, z), mainMat);
    group.add(p);
  }
  group.add(new THREE.Mesh(box(W + 0.7, 0.14, 1.1, 0, ARCH_TOP + 0.2, GZ), m.glowTeal));
  // Subtitle on the face of the crown band.
  const sw = 22, sh = sw * (120 / 2048);
  for (const [z, ry] of [[GZ + 2.86, 0], [GZ - 2.86, Math.PI]]) {
    group.add(new THREE.Mesh(new THREE.PlaneGeometry(sw, sh).rotateY(ry).translate(0, 17.3, z), subMat));
  }
}

/** Cotton "photo" light boxes beside the arch: uses public/images/cotton.jpg when present. */
function photoPanels(group) {
  const m = mats();
  const tex = cottonPhotoTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.32, roughness: 0.35 });
  registerGlow(mat, 0.32, 0.95);
  new THREE.TextureLoader().load('./images/cotton.jpg', (photo) => {
    photo.colorSpace = THREE.SRGBColorSpace;
    mat.map = mat.emissiveMap = photo;
    mat.needsUpdate = true;
  }, undefined, () => { /* no photo: keep the procedural cotton boll */ });
  const w = 9, h = 12;
  for (const sx of [-1, 1]) {
    const x = sx * 35, z = GZ + 4.5;
    const frame = new THREE.Mesh(box(w + 0.8, h + 0.8, 0.8, x, 1.2 + h / 2, z), m.white);
    frame.castShadow = true;
    group.add(frame);
    group.add(new THREE.Mesh(box(w + 0.9, 0.12, 0.9, x, 1.2 + h + 0.45, z), m.glowTeal));
    group.add(new THREE.Mesh(box(1.4, 1.2, 1.4, x, 0.6, z), m.graphite));
    for (const [dz, ry] of [[0.41, 0], [-0.41, Math.PI]]) {
      group.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(ry).translate(x, 1.2 + h / 2, z + dz), mat));
    }
  }
}

/** Islands, lane separators, scanner arch and safety signs. */
function entranceFurniture(B, safety) {
  B.add('curb', box(6, 0.25, 48, 0, 0.125, 239));
  B.add('lawn', box(5.4, 0.3, 30, 0, 0.15, 248));
  for (const sx of [-1, 1]) B.add('curb', box(0.8, 0.22, 26, sx * 7, 0.11, sx > 0 ? 251 : 229));
  // Inspection scanner arch over the entry lanes.
  const zs = 259;
  B.add('white', box(0.7, 6.2, 1.2, 2.6, 3.1, zs), box(0.7, 6.2, 1.2, 11.4, 3.1, zs), box(9.5, 1.0, 1.4, 7, 6.6, zs));
  B.add('glowTeal', box(9.6, 0.12, 0.12, 7, 6.05, zs + 0.72), box(0.12, 5.8, 0.12, 2.95, 3, zs + 0.62), box(0.12, 5.8, 0.12, 11.05, 3, zs + 0.62));
  B.add('dark', box(2.6, 0.6, 0.2, 7, 6.6, zs + 0.75));
  // Safety signs at the entrance.
  const add = (type, x, z, ry) => {
    B.add('safety', atlasPlane(safety.rect(type), 1.1, 1.55).rotateY(ry).translate(x, 2.9, z));
    B.add('steel', box(0.1, 3.7, 0.1, x - Math.sin(ry) * 0.06, 1.85, z - Math.cos(ry) * 0.06));
  };
  add('speed', 13.2, 272, 0);
  add('stop', 12.6, 256, 0);
  add('smokeFree', -13.2, 262, 0);
  add('helmet', 13.2, 226, 0);
  add('speed', -13.2, 214, Math.PI);
}

export function buildGate(scene, safety) {
  const m = mats();
  const group = new THREE.Group();
  group.name = 'gate';
  scene.add(group);
  const B = new Batch();
  const posts = fence(B, scene);
  arch(B);
  entranceFurniture(B, safety);
  B.build({ ...m, safety: safety.material }, TILE, group, { name: 'gate' });
  signs(group);
  photoPanels(group);

  // Boom barriers + traffic lights.
  const armTex = barrierTexture();
  armTex.repeat.set(2, 1);
  const armMat = new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.5, emissive: '#ff6060', emissiveIntensity: 0.05 });
  const lanes = LANES.map((L) => {
    const post = new THREE.Mesh(merge([box(0.4, 1.15, 0.4, L.post, 0.58, L.z), box(0.42, 0.14, 0.42, L.post, 0.9, L.z)]), m.graphite);
    post.castShadow = true;
    const pivot = new THREE.Group();
    pivot.position.set(L.post, 1.05, L.z);
    const len = Math.abs(L.arm);
    const arm = new THREE.Mesh(box(len, 0.12, 0.1, Math.sign(L.arm) * len / 2, 0, 0), armMat);
    arm.castShadow = true;
    pivot.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), m.glowRed);
    lamp.position.set(L.post, 1.45, L.z + (L.dir < 0 ? 0.22 : -0.22));
    // Scanner lights for the entry lanes.
    let signal = null;
    if (L.dir < 0) {
      signal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), m.glowRed);
      signal.position.set(L.x, 6.6, 259.8);
      group.add(signal);
    }
    group.add(post, pivot, lamp);
    return { ...L, pivot, lamp, signal, angle: 0, hold: 0 };
  });

  // Laser plane sweeping inside the scanner arch.
  const dash = dashTexture();
  const laserMat = new THREE.MeshBasicMaterial({ color: PALETTE.teal, map: dash, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 0.9).rotateX(Math.PI / 2), laserMat);
  laser.position.set(7, 3, 259);
  group.add(laser);

  let t = 0;
  return {
    posts,
    lanes,
    /** Hold a lane's barrier open for `seconds` (vehicles call this as they approach, Phase 5). */
    request(i, seconds = 3) { lanes[i].hold = Math.max(lanes[i].hold, seconds); },
    /** vehicles: [{ position: Vector3 }] — barriers lift when one is within 18 m of the boom. */
    update(dt, vehicles = []) {
      t += dt;
      laser.position.y = 3.1 + Math.sin(t * 1.4) * 2.6;
      dash.offset.x -= dt * 0.8;
      for (const L of lanes) {
        for (const v of vehicles) {
          const p = v.position;
          if (Math.abs(p.x - L.x) < 2 && Math.abs(p.z - L.z) < 18) L.hold = Math.max(L.hold, 1.2);
        }
        L.hold = Math.max(0, L.hold - dt);
        const target = L.hold > 0 ? 1 : 0;
        L.angle += (target - L.angle) * Math.min(1, dt * 2.4);
        L.pivot.rotation.z = Math.sign(L.arm) * L.angle * (82 * Math.PI / 180);
        const green = L.angle > 0.85;
        L.lamp.material = green ? m.glowGreen : m.glowRed;
        if (L.signal) L.signal.material = green ? m.glowGreen : m.glowRed;
      }
    },
  };
}
