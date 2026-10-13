// Stations 6–10: seed warehouse, oil pressing, filtration & refining, tank farm, bottling.
import * as THREE from 'three';
import { merge, paint, place } from '../geo.js';
import { local, lbox, lcyl, floorGuide, hazardBorder, platform, makeHolo } from './kit.js';
import { RobotArm } from '../robots.js';
import { addMesh, addObj } from './fibre.js';
import { PALETTE, STATION_TEXT } from '../data.js';
import { registerGlow } from '../materials.js';

const DEG = Math.PI / 180;

function helixGeo(length, radius = 0.28, turns = 14, tube = 0.06, axis = 'y') {
  const pts = [];
  for (let k = 0; k <= turns * 10; k++) {
    const a = (k / 10) * Math.PI * 2, t = k / (turns * 10);
    pts.push(axis === 'x' ? new THREE.Vector3(t * length - length / 2, Math.cos(a) * radius, Math.sin(a) * radius)
      : new THREE.Vector3(Math.cos(a) * radius, t * length, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, tube, 5);
}

let liquid = null;
function oilLiquid() {
  if (!liquid) {
    liquid = new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: '#ffae1a', emissiveIntensity: 1.1, roughness: 0.15, transparent: true, opacity: 0.85 });
    registerGlow(liquid, 1.1, 2);
  }
  return liquid;
}

/* 6 · Seed warehouse: seed mounds, augers, ventilation ducts */
function seed(ctx) {
  const { B, spec, m } = ctx;
  const seedMat = new THREE.MeshStandardMaterial({ color: '#5b3f27', roughness: 1 });
  const mounds = [[-14, -9, 6.5, 3.6], [-1, -12, 7, 4.2], [12, -9, 6, 3.4], [-12, 9, 5, 2.8]];
  for (const [x, z, r, h] of mounds) addMesh(ctx, new THREE.ConeGeometry(r, h, 32, 3), seedMat, x, h / 2 + 0.16, z).receiveShadow = true;
  // Augers feeding the mounds (rotating flights inside glass housings).
  const augers = [];
  for (const [x, z, ang] of [[-6, -2, 0.9], [6, -3, -0.9]]) {
    const g = new THREE.Group();
    const flight = new THREE.Mesh(helixGeo(9, 0.3, 18), m.gold);
    g.add(flight, new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 9, 14, 1, true).translate(0, 4.5, 0), m.clearGlass));
    addObj(ctx, g, x, 0.6, z);
    g.rotation.set(-55 * DEG, ang, 0, 'YXZ');
    augers.push(flight);
  }
  // Ventilation: two big ceiling ducts with grilles and glowing floor vents.
  for (const z of [-17, 17]) {
    lcyl(B, 'steel', spec, 0.9, 0.9, spec.w - 4, 0, spec.h - 1.6, z, 20, 0, 90 * DEG);
    for (let x = -20; x <= 20; x += 5) lbox(B, 'dark', spec, 1.2, 0.3, 0.2, x, spec.h - 2.4, z + (z > 0 ? -0.8 : 0.8));
  }
  for (let x = -18; x <= 18; x += 6) lbox(B, 'glowTeal', spec, 2.2, 0.03, 0.35, x, 0.19, 16);
  floorGuide(B, spec, -22, 22, -4, 13);
  return { holoZ: -2, update(dt, s) { for (const a of augers) a.rotation.y += dt * 4 * s; } };
}

/* 7 · Oil production: three cold screw presses, gold oil in glass pipes */
function oil(ctx) {
  const { B, spec, m } = ctx;
  const screws = [];
  for (const z of [-6, 0, 6]) {
    if (z === 0) continue; // the incoming seed belt runs along z = 0
    lcyl(B, 'white', spec, 0.95, 0.95, 2.2, -3.4, 2.0, z, 24, 0, 90 * DEG);
    lcyl(B, 'white', spec, 0.95, 0.95, 1.6, 2.2, 2.0, z, 24, 0, 90 * DEG);
    lcyl(B, 'clearGlass', spec, 1.0, 1.0, 2.6, -0.6, 2.0, z, 24, 0, 90 * DEG);
    lbox(B, 'graphite', spec, 1.6, 1.6, 1.6, -5.4, 2.0, z);
    lbox(B, 'glowTeal', spec, 0.06, 0.5, 1.2, -6.22, 2.2, z);
    lbox(B, 'graphite', spec, 8.4, 1.2, 1.4, -1.6, 0.6, z);
    lbox(B, 'glowGold', spec, 2.4, 0.08, 0.9, -0.6, 1.24, z);
    screws.push(addMesh(ctx, helixGeo(2.5, 0.6, 5, 0.12, 'x'), m.gold, -0.6, 2.0, z));
    // Oil pipe from the press trough to the collector.
    lcyl(B, 'clearGlass', spec, 0.18, 0.18, 6.6, 2.6, 1.0, z * 0.5, 10, 90 * DEG, 0);
  }
  // Second middle press set beside the belt.
  lcyl(B, 'white', spec, 0.95, 0.95, 5.8, -1.6, 2.0, -12, 24, 0, 90 * DEG);
  lcyl(B, 'clearGlass', spec, 1.0, 1.0, 2.4, -1.6, 2.0, -12, 24, 0, 90 * DEG);
  screws.push(addMesh(ctx, helixGeo(2.3, 0.6, 5, 0.12, 'x'), m.gold, -1.6, 2.0, -12));
  lbox(B, 'graphite', spec, 8, 1.2, 1.4, -1.6, 0.6, -12);
  // Collector tank with a glowing oil level.
  lcyl(B, 'clearGlass', spec, 1.3, 1.3, 3, 5, 1.66, 3.2, 24);
  const level = addMesh(ctx, new THREE.CylinderGeometry(1.2, 1.2, 1, 24).translate(0, 0.5, 0), oilLiquid(), 5, 0.2, 3.2);
  const tag = makeHolo(STATION_TEXT.coldPress, 7);
  addObj(ctx, tag, -1, 6.4, -3);
  hazardBorder(B, spec, -7, 3.6, -14, 8);
  floorGuide(B, spec, -18, 18, -16, 12);
  return {
    holoZ: 10,
    update(dt, s, t) {
      for (const sc of screws) sc.rotation.x += dt * 3 * s;
      level.scale.y = 1.6 + Math.sin(t * 0.8) * 0.5 + s * 0.6;
      tag.userData.update(t);
    },
  };
}

/* 8 · Filtration & refining: transparent filter columns with moving levels, centrifuge */
function refine(ctx) {
  const { B, spec, m } = ctx;
  const levels = [];
  [-4.2, -1.4, 1.4, 4.2].forEach((x, i) => {
    lcyl(B, 'clearGlass', spec, 0.75, 0.75, 5.2, x, 2.9, -5.5, 24);
    lcyl(B, 'steel', spec, 0.85, 0.85, 0.35, x, 5.65, -5.5, 24);
    lcyl(B, 'steel', spec, 0.85, 0.95, 0.5, x, 0.45, -5.5, 24);
    lcyl(B, 'gold', spec, 0.12, 0.12, 2.2, x, 6.6, -5.5, 8);
    const lv = addMesh(ctx, new THREE.CylinderGeometry(0.66, 0.66, 1, 24).translate(0, 0.5, 0), oilLiquid(), x, 0.7, -5.5);
    lv.userData.phase = i * 1.3;
    levels.push(lv);
  });
  lcyl(B, 'gold', spec, 0.16, 0.16, 9, 0, 7.6, -5.5, 10, 0, 90 * DEG);
  // Centrifuge: spinning drum under a glass dome.
  lbox(B, 'graphite', spec, 3.6, 0.9, 3.6, 0, 0.45, 6);
  const drum = addMesh(ctx, merge([
    paint(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 32), '#cfd6d9'),
    ...[0, 1, 2, 3].map((k) => paint(new THREE.BoxGeometry(0.12, 1.62, 0.3).translate(1.48, 0, 0).rotateY(k * Math.PI / 2), PALETTE.gold)),
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.25 }), 0, 1.75, 6);
  const [wx, wz] = local(spec)(0, 6);
  B.add('clearGlass', new THREE.SphereGeometry(1.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(wx, 2.55, wz));
  B.add('glowTeal', new THREE.TorusGeometry(1.92, 0.07, 6, 32).rotateX(Math.PI / 2).translate(wx, 2.56, wz));
  platform(B, spec, -6, 6, -9.5, -8, 4.2);
  hazardBorder(B, spec, -5.4, 5.4, -7, -4);
  floorGuide(B, spec, -18, 18, -11, 10);
  return {
    holoZ: 3,
    update(dt, s, t) {
      drum.rotation.y += dt * 14 * s;
      for (const lv of levels) lv.scale.y = 2.2 + Math.sin(t * 0.6 + lv.userData.phase) * 1.6;
    },
  };
}

/* 9 · Tank farm: manifold pipes, glowing level gauges */
function tanks(ctx) {
  const { B, spec, m } = ctx;
  const gauges = [];
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
    const gz = z + (z > 0 ? 8.05 : -8.05);
    lbox(B, 'dark', spec, 0.5, 18, 0.08, x + 2.5, 11, gz);
    const g = addMesh(ctx, new THREE.BoxGeometry(0.34, 1, 0.06).translate(0, 0.5, 0), oilLiquid(), x + 2.5, 2, gz + (z > 0 ? 0.06 : -0.06));
    gauges.push(g);
    // Manifold branches from the central pipe run to each tank.
    lcyl(B, 'gold', spec, 0.18, 0.18, Math.abs(z) - 7.6, x * 0.5 + (x > 0 ? 2.5 : -2.5), 4.05, z / 2, 10, 90 * DEG, 0);
  }
  return {
    holoZ: 0,
    update(dt, s, t) {
      gauges.forEach((g, i) => { g.scale.y = 9 + Math.sin(t * 0.15 + i * 1.7) * 5 + s * 2; });
    },
  };
}

/* 10 · Bottling: rotating filling carousel, capping robots, labeller */
function bottling(ctx) {
  const { B, spec, m } = ctx;
  const carousel = new THREE.Group();
  const bottle = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.17, 0.05], [0.17, 0.42], [0.08, 0.56], [0.06, 0.66], [0, 0.68]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
  const bottles = merge(Array.from({ length: 16 }, (_, k) => bottle.clone().translate(Math.cos(k / 16 * 6.283) * 2.2, 0.9, Math.sin(k / 16 * 6.283) * 2.2)));
  carousel.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.9, 32).translate(0, 0.45, 0), m.white));
  carousel.add(new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.06, 6, 48).rotateX(Math.PI / 2).translate(0, 0.9, 0), m.glowTeal));
  carousel.add(new THREE.Mesh(bottles, oilLiquid()));
  carousel.add(new THREE.Mesh(merge(Array.from({ length: 16 }, (_, k) => new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6).translate(Math.cos(k / 16 * 6.283) * 2.2, 2.2, Math.sin(k / 16 * 6.283) * 2.2))), m.steel));
  carousel.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 6, 48).rotateX(Math.PI / 2).translate(0, 2.65, 0), m.steel));
  addObj(ctx, carousel, -2.5, 0.16, 0);
  lcyl(B, 'steel', spec, 0.35, 0.35, 3.4, -2.5, 1.9, 0, 12);
  lcyl(B, 'clearGlass', spec, 0.9, 0.9, 1.6, -2.5, 4.2, 0, 20);
  const head = addMesh(ctx, new THREE.CylinderGeometry(0.8, 0.8, 1.2, 20).translate(0, 0.6, 0), oilLiquid(), -2.5, 3.4, 0);
  // Capping robots and labeller.
  const arms = [[1.6, 3], [-6.4, 2.6]].map(([x, z], i) => addObj(ctx, new RobotArm({ scale: 0.8, poses: RobotArm.pickPlace(i ? 0 : Math.PI, Math.PI / 2, 0.8) }), x, 0.16, z));
  lbox(B, 'graphite', spec, 1.8, 1.6, 1.4, 4.6, 0.8, -4);
  lbox(B, 'glowTeal', spec, 0.05, 0.6, 1.0, 3.69, 1.2, -4);
  const roll = addMesh(ctx, new THREE.CylinderGeometry(0.45, 0.45, 0.35, 20), m.white, 4.6, 1.95, -4);
  // Boxed bottles waiting at the north dock.
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) lbox(B, 'deck', spec, 1.2, 0.15, 1.2, -13 + i * 1.4, 0.24, -19 + j * 1.4);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) lbox(B, 'fabric', spec, 1.1, 0.8, 1.1, -13 + i * 1.4, 0.72, -19 + j * 1.4);
  hazardBorder(B, spec, -5.6, 0.6, -3.1, 3.1);
  floorGuide(B, spec, -22, 22, -21, 10);
  return {
    update(dt, s, t) {
      carousel.rotation.y += dt * 0.9 * s;
      head.scale.y = 0.6 + Math.sin(t * 2) * 0.3;
      for (const a of arms) a.update(dt, s);
      roll.rotation.y += dt * 6 * s;
    },
  };
}

export const OIL_STATIONS = { seed, oil, refine, tanks, bottling };
