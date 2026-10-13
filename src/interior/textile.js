// Stations 11–14: spinning, weaving, dyeing, garment sewing.
import * as THREE from 'three';
import { merge, paint, setInstance } from '../geo.js';
import { local, lbox, lcyl, floorGuide, hazardBorder, platform, makeHolo } from './kit.js';
import { RobotArm } from '../robots.js';
import { addMesh, addObj } from './fibre.js';
import { PALETTE, STATION_TEXT } from '../data.js';

const DEG = Math.PI / 180;
const DYES = ['#12b5a0', '#f5c04a', '#7cc7ff', '#ff7f6e'];

function threadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0)';
  ctx.clearRect(0, 0, 128, 16);
  for (let x = 0; x < 128; x += 4) {
    ctx.fillStyle = `rgba(255,252,240,${0.55 + (x % 8 ? 0.2 : 0.35)})`;
    ctx.fillRect(x, 0, 1.5, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* 11 · Spinning: carding machine, long spinning frames with rotating spindles, doffer robots */
function spinning(ctx) {
  const { B, spec, m, group } = ctx;
  // Carding machine along the central aisle (products disappear into it).
  lbox(B, 'white', spec, 20, 1.8, 2.6, 0, 0.9, 0);
  lbox(B, 'clearGlass', spec, 6, 0.9, 2.4, -4, 2.2, 0);
  lbox(B, 'glowTeal', spec, 20.1, 0.08, 2.65, 0, 1.82, 0);
  const card = addMesh(ctx, new THREE.CylinderGeometry(0.75, 0.75, 2.2, 24).rotateX(Math.PI / 2), m.steel, -4, 2.2, 0);
  // Spinning frames with spindles on both sides.
  const frames = [-14, -7.5, 7.5, 14];
  const spindleGeo = merge([
    paint(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 8).translate(0, 0.27, 0), '#cfd6d9'),
    paint(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10).translate(0, 0.42, 0), '#fffaf0'),
    paint(new THREE.BoxGeometry(0.04, 0.33, 0.15).translate(0.08, 0.42, 0), PALETTE.teal),
  ]);
  const spots = [];
  for (const z of frames) {
    lbox(B, 'white', spec, 26, 1.5, 1.3, 0, 0.9, z);
    lbox(B, 'graphite', spec, 26.2, 0.2, 1.5, 0, 1.7, z);
    lbox(B, 'steel', spec, 26, 0.12, 0.12, 0, 3.6, z);
    for (let x = -12.6; x <= 12.6; x += 0.8) {
      for (const s of [-1, 1]) spots.push([x, z + s * 0.62, z]);
      lcyl(B, 'fabric', spec, 0.16, 0.16, 0.4, x, 3.85, z, 8);
    }
    lbox(B, 'gold', spec, 26.4, 0.1, 0.1, 0, 0.32, z + 0.9);
  }
  const spindles = new THREE.InstancedMesh(spindleGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4 }), spots.length);
  spots.forEach(([x, z], i) => { const [wx, wz] = local(spec)(x, z); setInstance(spindles, i, wx, 1.8, wz); });
  spindles.computeBoundingSphere();
  group.add(spindles);
  // Yarn threads from the creel bobbins down to each spindle.
  const threadPts = [];
  for (const [x, z, fz] of spots) {
    const [wx, wz] = local(spec)(x, z), [, cz] = local(spec)(x, fz);
    threadPts.push(wx, 3.7, cz, wx, 2.3, wz);
  }
  const threads = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(threadPts, 3)),
    new THREE.LineBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.7 }));
  group.add(threads);
  // Rail-mounted doffer robots.
  const doffers = frames.map((z, i) => {
    const d = addMesh(ctx, merge([
      paint(new THREE.BoxGeometry(1.1, 1.4, 0.7).translate(0, 0.7, 0), '#f3f5f5'),
      paint(new THREE.BoxGeometry(1.12, 0.1, 0.72).translate(0, 1.1, 0), PALETTE.teal),
      paint(new THREE.BoxGeometry(0.9, 0.12, 0.5).translate(0, 1.5, -0.4), '#2a3338'),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), 0, 0.2, z + 1.25);
    d.userData.phase = i * 1.7;
    return d;
  });
  floorGuide(B, spec, -22, 22, -2.2, 2.2);
  const dummy = new THREE.Object3D();
  let a = 0, t = 0;
  return {
    update(dt, s) {
      t += dt * s;
      a += dt * 40 * s;
      card.rotation.z -= dt * 6 * s;
      spots.forEach(([x, z], i) => {
        const [wx, wz] = local(spec)(x, z);
        dummy.position.set(wx, 1.8, wz);
        dummy.rotation.set(0, a + i, 0);
        dummy.updateMatrix();
        spindles.setMatrixAt(i, dummy.matrix);
      });
      spindles.instanceMatrix.needsUpdate = true;
      for (const d of doffers) {
        const [wx] = local(spec)(Math.sin(t * 0.18 + d.userData.phase) * 12, 0);
        d.position.x = wx;
      }
    },
  };
}

/* 12 · Weaving: 12 looms in 3 rows — oscillating reeds, heddles, warp sheets, growing cloth rolls */
function weaving(ctx) {
  const { B, spec, m } = ctx;
  const warpTex = threadTexture();
  warpTex.repeat.set(10, 3);
  const warpMat = new THREE.MeshStandardMaterial({ map: warpTex, transparent: true, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false });
  const looms = [];
  [-13, -6.5, 8].forEach((z, row) => {
    [-15, -5, 5, 15].forEach((x, k) => {
      for (const sx of [-1.7, 1.7]) lbox(B, 'graphite', spec, 0.25, 2.2, 2.6, x + sx, 1.1, z);
      lbox(B, 'white', spec, 3.6, 0.3, 0.5, x, 2.3, z - 1.1);
      lbox(B, 'white', spec, 3.6, 0.3, 0.5, x, 2.3, z + 1.1);
      lcyl(B, 'steel', spec, 0.32, 0.32, 3.2, x, 0.9, z - 1.0, 16, 0, 90 * DEG);
      lcyl(B, 'fabric', spec, 0.28, 0.28, 3.0, x, 0.9, z - 1.0, 16, 0, 90 * DEG);
      const [wx, wz] = local(spec)(x, z);
      const warp = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.9).rotateX(-Math.PI / 2 + 0.25), warpMat);
      warp.position.set(wx, 1.2, wz - 0.1);
      ctx.group.add(warp);
      const reed = addMesh(ctx, new THREE.BoxGeometry(3.0, 0.8, 0.06), m.gold, x, 1.55, z + 0.4);
      const h1 = addMesh(ctx, new THREE.BoxGeometry(3.0, 0.6, 0.05), m.steel, x, 1.7, z - 0.2);
      const h2 = addMesh(ctx, new THREE.BoxGeometry(3.0, 0.6, 0.05), m.steel, x, 1.7, z - 0.32);
      const cloth = addMesh(ctx, new THREE.CylinderGeometry(1, 1, 3.0, 20).rotateZ(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.85 }), x, 0.75, z + 1.0);
      looms.push({ reed, h1, h2, cloth, z, x, phase: row * 0.7 + k * 1.3, grow: (row * 4 + k) / 12 });
    });
  });
  hazardBorder(B, spec, -18, 18, -15, -4.5);
  floorGuide(B, spec, -22, 22, -2.2, 2.2);
  return {
    update(dt, s, t) {
      warpTex.offset.y -= dt * 0.25 * s;
      for (const L of looms) {
        const ph = t * 6 * s + L.phase;
        const [, wz] = local(spec)(0, L.z + 0.4 + Math.sin(ph) * 0.18);
        L.reed.position.z = wz;
        L.h1.position.y = 1.7 + Math.sin(ph * 0.5) * 0.25;
        L.h2.position.y = 1.7 - Math.sin(ph * 0.5) * 0.25;
        L.grow = (L.grow + dt * 0.02 * s) % 1;
        const r = 0.22 + L.grow * 0.32;
        L.cloth.scale.set(1, r, r);
      }
    },
  };
}

/* 13 · Dyeing & finishing: colour vats, fabric over rollers, drying tunnel, water recycling */
function dyeing(ctx) {
  const { B, spec, m } = ctx;
  const vz = -6;
  const vats = DYES.map((c, i) => {
    const x = -9 + i * 6;
    lcyl(B, 'steel', spec, 1.7, 1.7, 1.4, x, 0.86, vz, 32);
    lcyl(B, 'glowTeal', spec, 1.72, 1.72, 0.08, x, 1.56, vz, 32);
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.1 });
    return addMesh(ctx, new THREE.CylinderGeometry(1.6, 1.6, 0.08, 32), mat, x, 1.42, vz);
  });
  // Fabric band dipping into each vat over rollers (vertex-coloured by the last bath).
  const pts = [[-13, 2.8]];
  DYES.forEach((_, i) => { const x = -9 + i * 6; pts.push([x - 1.4, 3.4], [x, 1.1], [x + 1.4, 3.4]); });
  pts.push([13, 2.8]);
  for (let i = 1; i < pts.length; i++) if (pts[i][1] > 3) lcyl(B, 'steel', spec, 0.22, 0.22, 2.2, pts[i][0], 3.6, vz, 12, 90 * DEG, 0);
  const pos = [], col = [], uv = [];
  const cream = new THREE.Color('#f3ead8');
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const [ax, az] = local(spec)(x0, vz), [bx] = local(spec)(x1, vz);
    const c0 = i < 2 ? cream : new THREE.Color(DYES[Math.min(3, Math.floor((i - 1) / 3))]);
    const c1 = i < 1 ? cream : new THREE.Color(DYES[Math.min(3, Math.floor(i / 3))]);
    const len = Math.hypot(x1 - x0, y1 - y0);
    pos.push(ax, y0, az - 1, bx, y1, az - 1, bx, y1, az + 1, ax, y0, az - 1, bx, y1, az + 1, ax, y0, az + 1);
    for (const c of [c0, c1, c1, c0, c1, c0]) col.push(c.r, c.g, c.b);
    uv.push(s, 0, s + len, 0, s + len, 1, s, 0, s + len, 1, s, 1);
    s += len;
  }
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bandGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  bandGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bandGeo.computeVertexNormals();
  const bandTex = threadTexture();
  bandTex.repeat.set(0.6, 1);
  const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: bandTex, side: THREE.DoubleSide, roughness: 0.8 }));
  ctx.group.add(band);
  // Drying tunnel with a warm glow.
  lbox(B, 'white', spec, 18, 2.8, 3.2, 0, 1.4, 3.6);
  for (let x = -8; x <= 8; x += 2) lbox(B, 'glowWarm', spec, 1.2, 1.2, 0.05, x, 1.6, 1.98);
  lbox(B, 'glowTeal', spec, 18.1, 0.08, 3.25, 0, 2.82, 3.6);
  // Closed-loop water recycling: tanks + sign.
  for (const x of [14, 18]) {
    lcyl(B, 'clearGlass', spec, 1.3, 1.3, 4, x, 2.16, -15, 24);
    lcyl(B, 'paintTeal', spec, 1.22, 1.22, 2.6, x, 1.46, -15, 24);
  }
  lcyl(B, 'steel', spec, 0.2, 0.2, 24, 4, 4.6, -15, 10, 0, 90 * DEG);
  const tag = makeHolo(STATION_TEXT.water95, 10);
  addObj(ctx, tag, 10, 7.2, -15);
  floorGuide(B, spec, -22, 22, -9, 6);
  return {
    holoZ: 9,
    update(dt, sp, t) {
      bandTex.offset.x -= dt * 0.8 * sp;
      vats.forEach((v, i) => { v.position.y = 1.42 + Math.sin(t * 2 + i) * 0.03; });
      tag.userData.update(t);
    },
  };
}

/* 14 · Sewing: 3 rows of tables with 2 sewing arms each, overhead hanger conveyor */
function sewing(ctx) {
  const { B, spec, m, group } = ctx;
  const arms = [];
  for (const z of [7, 12.5, 18]) {
    for (const x of [-12, 0, 12]) {
      lbox(B, 'white', spec, 4.2, 0.12, 2.0, x, 0.95, z);
      lbox(B, 'graphite', spec, 4.0, 0.9, 1.8, x, 0.45, z);
      lbox(B, 'fabric', spec, 2.8, 0.02, 1.4, x, 1.02, z);
      lbox(B, 'glowTeal', spec, 4.25, 0.04, 0.05, x, 0.9, z + 1.0);
      for (const sx of [-1, 1]) {
        const arm = new RobotArm({ scale: 0.62, poses: RobotArm.pickPlace(sx > 0 ? Math.PI : 0, sx > 0 ? Math.PI * 0.75 : Math.PI * 0.25, 0.6) });
        addObj(ctx, arm, x + sx * 2.6, 0.16, z);
        arm.k = (arms.length * 3) % 7;
        arms.push(arm);
      }
    }
  }
  // Laser cutting table near the input.
  lbox(B, 'graphite', spec, 6, 0.9, 3.2, 0, 0.45, -6);
  lbox(B, 'fabric', spec, 5.4, 0.02, 2.6, 0, 0.92, -6);
  const laser = addMesh(ctx, new THREE.BoxGeometry(0.05, 0.03, 2.6), m.glowRed, 0, 0.95, -6);
  // Overhead hanger conveyor loop with garments.
  const loop = [[-16, 3.5], [16, 3.5], [16, 21], [-16, 21]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % 4];
    lbox(B, 'steel', spec, Math.abs(bx - ax) + 0.15, 0.15, Math.abs(bz - az) + 0.15, (ax + bx) / 2, 4.6, (az + bz) / 2);
  }
  for (const [x, z] of loop) lbox(B, 'steel', spec, 0.12, 4.6, 0.12, x, 2.3, z);
  const perim = 2 * (32 + 17.5);
  const shirtGeo = merge([
    paint(new THREE.BoxGeometry(0.9, 1.0, 0.08).translate(0, -0.75, 0), '#ffffff'),
    paint(new THREE.BoxGeometry(1.4, 0.3, 0.08).translate(0, -0.35, 0), '#ffffff'),
    paint(new THREE.BoxGeometry(0.04, 0.25, 0.04).translate(0, -0.12, 0), '#9aa5ab'),
  ]);
  const N = 34;
  const shirts = new THREE.InstancedMesh(shirtGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), N);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) shirts.setColorAt(i, c.set(DYES[i % 4]));
  shirts.frustumCulled = false;
  group.add(shirts);
  const at = (u) => {
    let d = ((u % perim) + perim) % perim;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % 4];
      const len = Math.abs(bx - ax) + Math.abs(bz - az);
      if (d <= len) return [ax + (bx - ax) * (d / len), az + (bz - az) * (d / len), Math.abs(bx - ax) > 0 ? 0 : Math.PI / 2];
      d -= len;
    }
    return [loop[0][0], loop[0][1], 0];
  };
  hazardBorder(B, spec, -3.2, 3.2, -7.8, -4.2);
  floorGuide(B, spec, -18, 18, 3, 21.5);
  let u = 0;
  return {
    holoZ: -6,
    update(dt, s, t) {
      for (const a of arms) a.update(dt, s * 1.4);
      const [lx] = local(spec)(Math.sin(t * 1.4 * s) * 2.6, 0);
      laser.position.x = lx;
      u += dt * 1.2 * s;
      for (let i = 0; i < N; i++) {
        const [x, z, ry] = at(u + (i * perim) / N);
        const [wx, wz] = local(spec)(x, z);
        setInstance(shirts, i, wx, 4.5, wz, ry);
      }
      shirts.instanceMatrix.needsUpdate = true;
    },
  };
}

export const TEXTILE_STATIONS = { spinning, weaving, dyeing, sewing };
