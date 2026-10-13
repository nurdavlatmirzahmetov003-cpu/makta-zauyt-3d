// Stations 1–5: intake, cleaning, ginning, baling, bale warehouse.
import * as THREE from 'three';
import { merge, paint, place, blob } from '../geo.js';
import { local, lbox, lcyl, floorGuide, hazardBorder, platform, makeHolo } from './kit.js';
import { RobotArm, makeAMR } from '../robots.js';
import { PALETTE, STATION_TEXT } from '../data.js';

const DEG = Math.PI / 180;

/** Add a mesh at local (x, y, z) of a station to its interior group. */
export function addMesh(ctx, geo, mat, x, y, z) {
  const [wx, wz] = local(ctx.spec)(x, z);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wx, y, wz);
  mesh.castShadow = true;
  ctx.group.add(mesh);
  return mesh;
}
export function addObj(ctx, obj, x, y, z, ry = 0) {
  const [wx, wz] = local(ctx.spec)(x, z);
  obj.position.set(wx, y, wz);
  obj.rotation.y = ry;
  ctx.group.add(obj);
  return obj;
}
const cottonMat = () => new THREE.MeshStandardMaterial({ color: PALETTE.cotton, roughness: 0.9 });
const laserMat = () => new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

/* 1 · Intake: dock arm, hopper, AI quality scanner, sampling robot */
function intake(ctx) {
  const { B, spec, m, truck } = ctx;
  // Hopper (square frustum on legs) receiving cotton from the dock arm and the buffer line.
  const [hx, hz] = local(spec)(-8, 0);
  B.add('steel', new THREE.CylinderGeometry(3.1, 0.9, 2.8, 4, 1, true).rotateY(Math.PI / 4).translate(hx, 4.4, hz));
  B.add('gold', new THREE.TorusGeometry(3.1, 0.08, 4, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).translate(hx, 5.8, hz));
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) lbox(B, 'steel', spec, 0.2, 4.4, 0.2, -8 + x, 2.2, z);
  lbox(B, 'steel', spec, 1.2, 0.2, 5, -5.5, 2.4, 0, 0, 0, -0.5);
  hazardBorder(B, spec, -11, -5, -3, 3);
  const heap = addMesh(ctx, place(blob(1.6, 1, 0.2, 3), { sy: 0.55 }), cottonMat(), -8, 5.4, 0);
  // Giant dock robot arm, picking cotton modules from the truck at the west dock.
  const payload = new THREE.Mesh(place(blob(0.5, 1, 0.2, 5), { sy: 0.8 }), cottonMat());
  const arm = addObj(ctx, new RobotArm({ scale: 2.1, payload, poses: RobotArm.pickPlace(Math.PI, 0, 1) }), -18.5, 0.16, 0);
  // AI quality scanner arch over the outgoing belt, with a sweeping laser plane.
  for (const z of [-1.3, 1.3]) lbox(B, 'white', spec, 0.4, 3.6, 0.5, 4, 1.8, z);
  lbox(B, 'white', spec, 0.8, 0.6, 3.1, 4, 3.6, 0);
  lbox(B, 'glowTeal', spec, 0.85, 0.08, 3.15, 4, 3.28, 0);
  lbox(B, 'dark', spec, 0.1, 1.1, 1.8, 4.42, 4.6, 0);
  const laser = addMesh(ctx, new THREE.PlaneGeometry(2.3, 0.7).rotateX(Math.PI / 2).rotateY(Math.PI / 2), laserMat(), 4, 2, 0);
  const tag = makeHolo(STATION_TEXT.aiScan, 4.6);
  addObj(ctx, tag, 4, 6.4, 0, Math.PI / 2);
  // Sampling robot beside the belt with a sample tray.
  const sample = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), cottonMat());
  const sampler = addObj(ctx, new RobotArm({ scale: 0.75, payload: sample, poses: RobotArm.pickPlace(Math.PI / 2, -Math.PI / 2, 0.8) }), 8, 0.16, -2.6);
  lbox(B, 'graphite', spec, 1.4, 0.9, 1.0, 8, 0.45, -4.4);
  lbox(B, 'glowTeal', spec, 1.0, 0.05, 0.6, 8, 0.92, -4.4);
  // Control mezzanine and floor guides.
  platform(B, spec, 10, 19, -20, -14, 3.2);
  lbox(B, 'graphite', spec, 6, 1.1, 0.8, 14.5, 3.8, -18.5);
  lbox(B, 'glowTeal', spec, 5.6, 0.7, 0.05, 14.5, 4.1, -18.06);
  floorGuide(B, spec, -22, 22, -10, 10);
  return {
    update(dt, s, t) {
      arm.update(dt, truck.atDock ? 1.1 : 0.35);
      sampler.update(dt, s);
      laser.position.y = 2.0 + Math.sin(t * 2.5 * s) * 1.4;
      tag.userData.update(t);
      heap.scale.y = 0.85 + Math.sin(t * 0.7) * 0.05 + s * 0.15;
    },
  };
}

/* 2 · Cleaning: spiked drums under glass hoods, dust ducts, clean-air filter */
function cleaning(ctx) {
  const { B, spec, m } = ctx;
  const drumGeo = (() => {
    const parts = [paint(new THREE.CylinderGeometry(1.35, 1.35, 3.4, 24).rotateX(Math.PI / 2), '#c7cdd0')];
    for (let row = 0; row < 7; row++) {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + row * 0.22;
        parts.push(paint(new THREE.ConeGeometry(0.07, 0.4, 5).translate(0, 1.5, 0).rotateZ(a).translate(0, 0, -1.5 + row * 0.5), '#8b969c'));
      }
    }
    return merge(parts);
  })();
  const drumMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.3 });
  const drums = [];
  for (const x of [-3, 3]) {
    lbox(B, 'graphite', spec, 3.8, 1.4, 4.0, x, 0.7, 0);
    lbox(B, 'glowTeal', spec, 3.9, 0.08, 4.1, x, 1.42, 0);
    drums.push(addMesh(ctx, drumGeo, drumMat, x, 2.9, 0));
    const [wx, wz] = local(spec)(x, 0);
    B.add('clearGlass', new THREE.CylinderGeometry(1.95, 1.95, 3.9, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(wx, 2.9, wz));
    // Dust-extraction duct up to the ceiling and over to the filter block.
    lcyl(B, 'steel', spec, 0.42, 0.42, 5, x, 7.2, 0);
    lcyl(B, 'steel', spec, 0.42, 0.42, 14.5, x, 9.6, -7.2, 16, 90 * DEG, 0);
    lcyl(B, 'steel', spec, 0.42, 0.42, 5.6, x, 6.9, -14.4);
  }
  hazardBorder(B, spec, -5.4, 5.4, -2.6, 2.6);
  // Clean-air filter block with a green glowing filter grid.
  lbox(B, 'white', spec, 11, 4.4, 3.2, 0, 2.2, -16.8);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) lbox(B, 'glowGreen', spec, 1.7, 1.4, 0.06, -4.4 + i * 2.2, 1.4 + j * 1.8, -15.17);
  lbox(B, 'glowTeal', spec, 11.1, 0.1, 3.3, 0, 4.42, -16.8);
  const tag = makeHolo(STATION_TEXT.cleanAir, 5);
  addObj(ctx, tag, 0, 6.6, -16.8);
  floorGuide(B, spec, -22, 22, -11, 9);
  return {
    update(dt, s, t) {
      for (const d of drums) d.rotation.z += dt * 4.5 * s;
      tag.userData.update(t);
    },
  };
}

/* 3 · Ginning: five gin stands with saw discs, lint collector, seed auger */
function ginning(ctx) {
  const { B, spec, m } = ctx;
  const discGeo = merge(Array.from({ length: 9 }, (_, k) => new THREE.CylinderGeometry(0.85, 0.85, 0.05, 32).rotateX(Math.PI / 2).translate(0, 0, -1.1 + k * 0.275)));
  const discMat = new THREE.MeshStandardMaterial({ color: '#dfe4e6', metalness: 0.95, roughness: 0.18, emissive: PALETTE.gold, emissiveIntensity: 0.05 });
  const discs = [];
  for (let i = 0; i < 5; i++) {
    const z = -8 + i * 4;
    lbox(B, 'white', spec, 2.8, 3.2, 3.0, -2.4, 1.6, z);
    lbox(B, 'glowTeal', spec, 0.06, 0.12, 3.0, -0.98, 3.0, z);
    lbox(B, 'steel', spec, 1.6, 0.5, 2.4, -2.6, 3.5, z, 0, 0, -0.35);
    lbox(B, 'dark', spec, 0.2, 1.7, 2.6, -0.95, 1.9, z);
    discs.push(addMesh(ctx, discGeo, discMat, -0.75, 1.9, z));
  }
  // Lint collector (glass) carrying the fibre to the outgoing belt.
  lbox(B, 'clearGlass', spec, 1.4, 1.4, 20, 1.2, 2.2, 0);
  lbox(B, 'steel', spec, 1.5, 0.12, 20.2, 1.2, 1.45, 0);
  const lint = addMesh(ctx, place(blob(0.5, 1, 0.2, 9), { sx: 1.4, sz: 30 }), new THREE.MeshStandardMaterial({ color: PALETTE.cotton, roughness: 0.95, transparent: true, opacity: 0.85 }), 1.2, 2.2, 0);
  lint.scale.set(1, 1, 0.6);
  // Seed auger from the back of the stands towards the north port.
  const augerLen = 8.5;
  const auger = new THREE.Group();
  const helix = [];
  for (let k = 0; k <= 80; k++) { const a = k * 0.6; helix.push(new THREE.Vector3(Math.cos(a) * 0.25, (k / 80) * augerLen, Math.sin(a) * 0.25)); }
  const screw = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 200, 0.05, 5), m.gold);
  auger.add(screw, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, augerLen, 14, 1, true).translate(0, augerLen / 2, 0), m.clearGlass));
  addObj(ctx, auger, -5.6, 0.6, -9.5);
  auger.rotation.set(-62 * DEG, 0, 0, 'YXZ');
  auger.rotation.y = -0.25;
  platform(B, spec, -9, -6, -11, 11, 2.6);
  hazardBorder(B, spec, -4.2, 0.4, -10, 10);
  floorGuide(B, spec, -22, 22, -13, 13);
  return {
    holoZ: 4,
    update(dt, s) {
      for (const d of discs) d.rotation.z -= dt * 9 * s;
      screw.rotation.y += dt * 5 * s;
      lint.position.y = 2.2 + Math.sin(performance.now() * 0.004) * 0.05;
    },
  };
}

/* 4 · Baling: hydraulic press, strapping robot, label printer */
function baling(ctx) {
  const { B, spec, m } = ctx;
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
    lbox(B, 'steel', spec, 0.5, 7.4, 0.5, x, 3.7, z);
    lbox(B, 'gold', spec, 0.55, 0.25, 0.55, x, 3.2, z);
  }
  lbox(B, 'white', spec, 4.8, 1.3, 4.8, 0, 7.6, 0);
  lbox(B, 'glowTeal', spec, 4.9, 0.1, 4.9, 0, 6.92, 0);
  lbox(B, 'clearGlass', spec, 3.4, 2.4, 3.4, 0, 1.4, 0);
  lbox(B, 'graphite', spec, 4.0, 0.25, 4.0, 0, 0.3, 0);
  const ram = addMesh(ctx, new THREE.CylinderGeometry(0.42, 0.42, 1, 18).translate(0, -0.5, 0), m.steel, 0, 7.0, 0);
  const platen = addMesh(ctx, new THREE.BoxGeometry(3.2, 0.45, 3.2), m.white, 0, 5, 0);
  const strap = new RobotArm({ scale: 1.0, poses: RobotArm.pickPlace(Math.PI, Math.PI / 2, 0.7) });
  addObj(ctx, strap, 3.6, 0.16, 2.8);
  // Label / QR printer with a moving head.
  lbox(B, 'graphite', spec, 1.2, 1.4, 0.9, 3.4, 0.7, -2.8);
  lbox(B, 'glowTeal', spec, 0.6, 0.4, 0.04, 3.4, 1.15, -2.33);
  const head = addMesh(ctx, new THREE.BoxGeometry(0.3, 0.18, 0.3), m.gold, 3.4, 1.5, -2.8);
  hazardBorder(B, spec, -2.6, 2.6, -2.6, 2.6);
  floorGuide(B, spec, -16, 16, -10, 10);
  let phase = 0;
  return {
    update(dt, s) {
      phase += dt * 0.6 * s;
      const k = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
      platen.position.y = 5.2 - k * 2.4;
      ram.scale.y = 7.0 - (platen.position.y + 0.22);
      strap.update(dt, s);
      const [wx] = local(spec)(3.4 + Math.sin(phase * 7) * 0.35, 0);
      head.position.x = wx;
    },
  };
}

/* 5 · Bale warehouse: racks of bales, overhead bridge crane, AMR carts */
function bales(ctx) {
  const { B, spec, m } = ctx;
  for (const sz of [-1, 1]) {
    for (let x = -16; x <= 16; x += 2.9) {
      for (const zr of [8.5, 15]) {
        const z = sz * zr;
        for (const dz of [-2.4, 2.4]) lbox(B, 'steel', spec, 0.14, 10.5, 0.14, x, 5.25, z + dz);
        for (let lv = 0; lv < 4; lv++) {
          const y = 0.4 + lv * 2.5;
          lbox(B, 'gold', spec, 2.9, 0.12, 0.12, x + 1.45, y, z - 2.4);
          lbox(B, 'gold', spec, 2.9, 0.12, 0.12, x + 1.45, y, z + 2.4);
          if (x < 16 && (x * 7 + lv * 3 + zr) % 5 > 0.6) {
            for (const bz of [-1.2, 1.2]) {
              lbox(B, 'fabric', spec, 1.9, 1.3, 1.6, x + 1.45, y + 0.72, z + bz);
              lbox(B, 'dark', spec, 1.92, 1.32, 0.08, x + 1.45, y + 0.72, z + bz - 0.4);
              lbox(B, 'dark', spec, 1.92, 1.32, 0.08, x + 1.45, y + 0.72, z + bz + 0.4);
            }
          }
        }
      }
    }
  }
  // Overhead bridge crane on rails along the long walls.
  const ry = spec.h - 5;
  for (const z of [-21.5, 21.5]) lbox(B, 'gold', spec, 38, 0.5, 0.6, 0, ry, z);
  const bridge = addMesh(ctx, merge([
    new THREE.BoxGeometry(1.1, 1.3, 43),
    new THREE.BoxGeometry(1.4, 0.5, 1.4).translate(0, -0.2, 21.5),
    new THREE.BoxGeometry(1.4, 0.5, 1.4).translate(0, -0.2, -21.5),
  ]), m.white, 0, ry + 0.9, 0);
  const trolley = new THREE.Group();
  trolley.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), m.graphite));
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06).translate(0, -0.5, 0), m.steel);
  const load = new THREE.Mesh(merge([new THREE.BoxGeometry(1.9, 1.3, 1.6).translate(0, -0.65, 0)]), m.fabric);
  trolley.add(cable, load);
  bridge.add(trolley);
  trolley.position.y = -1;
  // AMR carts shuttling bales along the aisles.
  const carts = [-4.6, 4.6].map((z, i) => {
    const bale = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.82, 0.9).translate(0, 0.41, 0), m.fabric);
    const c = addObj(ctx, makeAMR({ load: bale }), 0, 0.16, z, Math.PI / 2);
    c.userData.phase = i * 2;
    return c;
  });
  floorGuide(B, spec, -19, 19, -6, 6);
  let t = 0;
  return {
    update(dt, s) {
      t += dt * s;
      const [bx] = local(spec)(Math.sin(t * 0.25) * 14, 0);
      bridge.position.x = bx;
      trolley.position.z = Math.sin(t * 0.37) * 15;
      const drop = 6 + Math.sin(t * 0.6) * 4;
      cable.scale.y = drop;
      load.position.y = -drop;
      for (const c of carts) {
        const u = Math.sin(t * 0.3 + c.userData.phase);
        const [cx] = local(spec)(u * 15, 0);
        c.position.x = cx;
        c.rotation.y = Math.cos(t * 0.3 + c.userData.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    },
  };
}

export const FIBRE_STATIONS = { intake, cleaning, ginning, baling, bales };
