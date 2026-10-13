// Stations 15–17: packaging, finished goods high-bay warehouse, dispatch & export.
import * as THREE from 'three';
import { setInstance } from '../geo.js';
import { local, lbox, floorGuide, hazardBorder, platform } from './kit.js';
import { RobotArm, makeForklift } from '../robots.js';
import { addMesh, addObj } from './fibre.js';

/* 15 · Packaging: folding robot, box erector, tape sealer, barcode printing */
function packaging(ctx) {
  const { B, spec, m, products } = ctx;
  // Machine housing along the line (garments go in at the east end, boxes come out at the west).
  lbox(B, 'white', spec, 10.4, 1.7, 2.6, 0, 0.85, 0);
  lbox(B, 'clearGlass', spec, 10, 1.1, 2.4, 0, 2.25, 0);
  lbox(B, 'glowTeal', spec, 10.5, 0.08, 2.65, 0, 1.72, 0);
  // Folding robot with folding flaps.
  const folder = addObj(ctx, new RobotArm({ scale: 0.9, poses: RobotArm.pickPlace(-Math.PI / 2, -Math.PI / 4, 0.8) }), 3.6, 0.16, 2.6);
  lbox(B, 'graphite', spec, 2.4, 0.9, 1.6, 3.6, 0.45, 4.4);
  const flaps = [-1, 1].map((sx) => {
    const f = addMesh(ctx, new THREE.BoxGeometry(0.8, 0.04, 1.4).translate(sx * 0.4, 0, 0), m.steel, 3.6 + sx * 0.4, 0.95, 4.4);
    f.userData.sx = sx;
    return f;
  });
  // Box erector: a carton rising from the magazine, pushed by a ram.
  lbox(B, 'steel', spec, 2, 2.6, 2, 0, 1.3, -3.2);
  const carton = addMesh(ctx, new THREE.BoxGeometry(0.9, 0.7, 0.7), products.meshes.box.material, 0, 1.0, -3.2);
  const pusher = addMesh(ctx, new THREE.BoxGeometry(0.3, 0.3, 1.2), m.gold, 0, 2.9, -3.2);
  // Tape sealer arch with a spinning tape roll.
  for (const z of [-1.5, 1.5]) lbox(B, 'white', spec, 0.4, 3.2, 0.4, -2, 1.6, z);
  lbox(B, 'white', spec, 0.8, 0.5, 3.4, -2, 3.3, 0);
  const tape = addMesh(ctx, new THREE.TorusGeometry(0.32, 0.13, 8, 24), new THREE.MeshStandardMaterial({ color: '#c9a06a', roughness: 0.6 }), -2, 2.85, 0);
  // Barcode printer and a red scan line.
  lbox(B, 'graphite', spec, 1.2, 1.5, 1.0, -4.2, 0.75, -2.4);
  lbox(B, 'glowTeal', spec, 0.7, 0.4, 0.04, -4.2, 1.2, -1.89);
  const scan = addMesh(ctx, new THREE.BoxGeometry(0.05, 0.02, 2.6), m.glowRed, -4.2, 2.95, 0);
  hazardBorder(B, spec, -6, 6, -4.8, 5.6);
  floorGuide(B, spec, -22, 22, -7, 7);
  return {
    update(dt, s, t) {
      folder.update(dt, s);
      for (const f of flaps) f.rotation.z = f.userData.sx * Math.max(0, Math.sin(t * 2.4 * s)) * 1.4;
      const k = (t * 0.5 * s) % 1;
      carton.position.y = 0.5 + Math.min(1, k * 2) * 1.6;
      pusher.position.y = 2.9 - Math.max(0, Math.sin(k * Math.PI * 2)) * 0.6;
      tape.rotation.z += dt * 5 * s;
      const [sx] = local(spec)(-4.2 + Math.sin(t * 3) * 0.3, 0);
      scan.position.x = sx;
    },
  };
}

/* 16 · Finished goods: high-bay racks and two moving stacker cranes */
function goods(ctx) {
  const { B, spec, m, products, group } = ctx;
  const levels = 8, lh = 2.4, spots = [];
  const rows = [7.2, 14.4];
  for (const sz of [-1, 1]) {
    for (const zr of rows) {
      const z = sz * zr;
      for (let x = -19; x <= 19; x += 2.4) {
        for (const dz of [-1.1, 1.1]) lbox(B, 'steel', spec, 0.12, levels * lh + 0.6, 0.12, x, (levels * lh + 0.6) / 2, z + dz);
        if (x >= 19) continue;
        for (let lv = 0; lv < levels; lv++) {
          lbox(B, 'gold', spec, 2.4, 0.1, 0.1, x + 1.2, 0.3 + lv * lh, z - 1.1);
          lbox(B, 'gold', spec, 2.4, 0.1, 0.1, x + 1.2, 0.3 + lv * lh, z + 1.1);
          if ((x * 13 + lv * 7 + zr * 3) % 9 > 1.5) for (const dx of [0.6, 1.8]) spots.push([x + dx, 0.36 + lv * lh, z]);
        }
      }
    }
  }
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.8, 1.8).translate(0, 0.4, 0), products.meshes.box.material, spots.length);
  spots.forEach(([x, y, z], i) => { const [wx, wz] = local(spec)(x, z); setInstance(boxes, i, wx, y, wz); });
  boxes.computeBoundingSphere();
  boxes.castShadow = true;
  group.add(boxes);
  // Stacker cranes running in the aisles between the rack rows.
  const cranes = [-1, 1].map((sz, i) => {
    const aisle = sz * (rows[0] + rows[1]) / 2;
    lbox(B, 'gold', spec, 40, 0.25, 0.4, 0, 0.2, aisle);
    lbox(B, 'gold', spec, 40, 0.25, 0.4, 0, levels * lh + 0.8, aisle);
    const mast = addMesh(ctx, new THREE.BoxGeometry(0.7, levels * lh + 0.6, 0.7).translate(0, (levels * lh + 0.6) / 2, 0), m.white, 0, 0.3, aisle);
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 2.6), m.graphite);
    const load = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.8).translate(0, 0.55, 0), products.meshes.box.material);
    car.add(load);
    car.position.set(0, 2, 0);
    mast.add(car);
    mast.add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72).translate(0, levels * lh * 0.5, 0), m.glowTeal));
    return { mast, car, phase: i * 2.1 };
  });
  floorGuide(B, spec, -22, 22, -4, 4);
  return {
    update(dt, s, t) {
      for (const c of cranes) {
        const u = t * 0.12 * s + c.phase;
        const [wx] = local(spec)(Math.sin(u) * 17, 0);
        c.mast.position.x = wx;
        c.car.position.y = 1 + (0.5 + 0.5 * Math.sin(u * 2.3)) * (levels - 1) * lh;
      }
    },
  };
}

/* 17 · Dispatch & export: palletising robot, pallet stack, robotic forklifts to the docks */
function dispatch(ctx) {
  const { B, spec, m, products, node, group } = ctx;
  const payload = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), products.meshes.box.material);
  const arm = addObj(ctx, new RobotArm({ scale: 1.4, payload, poses: RobotArm.pickPlace(0, Math.PI / 2, 0.9) }), 6.5, 0.16, 2.4);
  lbox(B, 'deck', spec, 2.4, 0.18, 2.0, 6.5, 0.25, 6.2);
  const PER = 24;
  const stack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.55, 0.55).translate(0, 0.275, 0), products.meshes.box.material, PER);
  stack.count = 0;
  stack.frustumCulled = false;
  group.add(stack);
  const slot = (i) => {
    const lv = Math.floor(i / 6), r = i % 6;
    const [wx, wz] = local(spec)(6.5 - 0.75 + (r % 3) * 0.75, 6.2 - 0.3 + Math.floor(r / 3) * 0.6);
    return [wx, 0.34 + lv * 0.56, wz];
  };
  // Forklifts shuttling full pallets from the palletiser to the three south docks.
  const lifts = [-12, 0, 12].slice(0, 2).map((dx, i) => {
    const f = makeForklift();
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.0).translate(0, 0.65, 1.2), products.meshes.box.material);
    f.userData.forks.add(pallet);
    addObj(ctx, f, dx, 0.16, 12, Math.PI);
    return { f, pallet, dock: i ? 12 : -12, phase: i * 3.3 };
  });
  hazardBorder(B, spec, 4.6, 8.4, 4.6, 7.8);
  for (const x of [-12, 0, 12]) hazardBorder(B, spec, x - 2.8, x + 2.8, 18.5, 22.6);
  floorGuide(B, spec, -18, 18, 9, 17);
  platform(B, spec, -18, -10, -20, -15, 3.4);
  let shown = 0;
  return {
    pallets: 0,
    update(dt, s, t) {
      arm.update(dt, s * 1.2);
      const n = node.count % PER;
      if (n !== shown) {
        shown = n;
        for (let i = 0; i < n; i++) { const [x, y, z] = slot(i); setInstance(stack, i, x, y, z); }
        stack.count = n;
        stack.instanceMatrix.needsUpdate = true;
      }
      for (const L of lifts) {
        const u = (t * 0.08 * s + L.phase) % 2;
        const k = u < 1 ? u : 2 - u;                    // 0 = palletiser, 1 = dock
        const [wx, wz] = local(spec)(4 + (L.dock - 4) * k, 9 + 10 * k);
        L.f.position.set(wx, 0.16, wz);
        L.f.rotation.y = u < 1 ? Math.atan2(L.dock - 4, 10) : Math.atan2(4 - L.dock, -10);
        L.pallet.visible = u < 1;
        L.f.userData.forks.position.y = 0.2 + (u < 1 ? 0.3 : 0);
      }
    },
  };
}

export const LOGISTICS_STATIONS = { packaging, goods, dispatch };
