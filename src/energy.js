// Renewable energy outside the fence: two solar farms with battery storage, and wind turbines on the hills.
import * as THREE from 'three';
import { ZONES, heightAt } from './terrain.js';
import { mulberry32 } from './noise.js';
import { merge, place, setInstance } from './geo.js';
import { solarPanelTexture, batteryTexture } from './textures.js';
import { PALETTE } from './data.js';

const TILT = THREE.MathUtils.degToRad(25); // panels face south (+Z)
const PANEL = { w: 5, d: 4.2, y: 2.1 }; // two modules high per table
const TURBINES = [[-850, 560], [-1200, 480], [860, 560], [1200, 460], [950, -620], [-950, -650]];

export function buildSolarFarms(scene) {
  const farms = [ZONES.solarNW, ZONES.solarNE];
  const cols = 40, rows = 10;
  const total = farms.length * cols * rows;
  const cells = solarPanelTexture();
  cells.wrapS = cells.wrapT = THREE.RepeatWrapping;
  cells.repeat.set(1, 2);
  const panelMat = new THREE.MeshStandardMaterial({ map: cells, metalness: 0.15, roughness: 0.32, envMapIntensity: 0.7 });
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(PANEL.w, 0.07, PANEL.d), panelMat, total);
  // Mount: front (low) and back (high) posts plus a rail, shared by every table.
  const dz = (PANEL.d / 2) * Math.cos(TILT), dy = (PANEL.d / 2) * Math.sin(TILT);
  const lowH = PANEL.y - dy, highH = PANEL.y + dy;
  const mountParts = [];
  for (const x of [-1.9, 1.9]) {
    mountParts.push(place(new THREE.BoxGeometry(0.1, lowH, 0.1), { x, y: lowH / 2, z: dz * 0.85 }));
    mountParts.push(place(new THREE.BoxGeometry(0.1, highH, 0.1), { x, y: highH / 2, z: -dz * 0.85 }));
  }
  mountParts.push(place(new THREE.BoxGeometry(PANEL.w * 0.9, 0.08, 0.08), { y: PANEL.y - 0.1 }));
  const mounts = new THREE.InstancedMesh(merge(mountParts),
    new THREE.MeshStandardMaterial({ color: '#aeb8bd', metalness: 0.7, roughness: 0.35 }), total);
  panels.castShadow = mounts.castShadow = true;
  panels.receiveShadow = true;

  let i = 0;
  const batteries = [];
  for (const f of farms) {
    const sx = (f.x1 - f.x0) / cols, sz = (f.z1 - f.z0) / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = f.x0 + sx * (c + 0.5), z = f.z0 + sz * (r + 0.5);
        setInstance(panels, i, x, PANEL.y, z, 0, 1, 1, 1, TILT);
        setInstance(mounts, i, x, 0, z);
        i++;
      }
    }
    for (let k = 0; k < 4; k++) batteries.push([f.x0 + 30 + k * 16, f.z1 + 14]);
  }
  scene.add(panels, mounts);

  // Battery storage containers (they keep the factory running at night).
  const bt = batteryTexture();
  const box = new THREE.InstancedMesh(new THREE.BoxGeometry(12.2, 2.6, 2.44).translate(0, 1.3, 0),
    new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5, metalness: 0.2 }), batteries.length);
  box.castShadow = box.receiveShadow = true;
  batteries.forEach(([x, z], k) => setInstance(box, k, x, 0, z, Math.PI / 2));
  scene.add(box);
  return { panels: total };
}

function bladeGeometry(len) {
  const s = new THREE.Shape();
  s.moveTo(-0.9, 0);
  s.quadraticCurveTo(-1.5, len * 0.18, -0.7, len * 0.4);
  s.lineTo(-0.12, len);
  s.lineTo(0.22, len);
  s.quadraticCurveTo(1.0, len * 0.3, 0.9, 0);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false }).translate(0, 1.2, -0.17);
}

export function buildWindTurbines(scene) {
  const white = new THREE.MeshStandardMaterial({ color: '#f5f7f8', roughness: 0.38, metalness: 0.15 });
  const statics = [];
  const rotors = [];
  const rand = mulberry32(8);
  const H = 92, BLADE = 40;
  const blade = bladeGeometry(BLADE);
  const rotorGeo = merge([
    place(new THREE.SphereGeometry(1.5, 16, 10).scale(1, 1, 1.6), {}),
    ...[0, 120, 240].map((a) => place(blade.clone(), { rz: a })),
  ]);
  const lights = [];
  for (const [x, z] of TURBINES) {
    const y = heightAt(x, z) - 1.5;
    const yaw = -Math.PI / 4 + (rand() - 0.5) * 0.3; // rotors face south-west, towards the viewer
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    statics.push(place(new THREE.CylinderGeometry(1.4, 2.9, H, 20), { x, y: y + H / 2, z }));
    statics.push(place(new THREE.CylinderGeometry(4, 4.6, 1.2, 20), { x, y: y + 0.6, z }));
    const nacelle = new THREE.BoxGeometry(3.4, 3.6, 11).translate(0, 0, -2.5);
    nacelle.rotateY(yaw);
    statics.push(nacelle.translate(x, y + H + 1.2, z));
    const rotor = new THREE.Mesh(rotorGeo, white);
    rotor.position.set(x + fx * 3.6, y + H + 1.2, z + fz * 3.6);
    rotor.rotation.order = 'YXZ';
    rotor.rotation.y = yaw;
    rotor.userData.speed = 0.9 + rand() * 0.35;
    rotor.rotation.z = rand() * 6;
    rotor.castShadow = true;
    rotors.push(rotor);
    lights.push([x - fx * 6, y + H + 3.2, z - fz * 6]);
  }
  const towers = new THREE.Mesh(merge(statics), white);
  towers.castShadow = true;
  scene.add(towers, ...rotors);
  // Aviation lights on the nacelles (glow at night, Phase 8).
  const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#ff5a4a', emissive: '#ff3a2a', emissiveIntensity: 2 }), lights.length);
  lights.forEach(([x, y, z], k) => setInstance(lamp, k, x, y, z));
  scene.add(lamp);
  // Gold accent ring at the base of each tower.
  const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(2.95, 0.12, 6, 24).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.7, roughness: 0.3 }), TURBINES.length);
  TURBINES.forEach(([x, z], k) => setInstance(ring, k, x, heightAt(x, z) + 6, z));
  scene.add(ring);

  return {
    update(dt) {
      for (const r of rotors) r.rotation.z -= r.userData.speed * dt;
    },
  };
}
