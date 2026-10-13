// Product forms moving through the factory. One InstancedMesh per form (per-instance colour).
import * as THREE from 'three';
import { blob, merge, paint, place } from './geo.js';
import { mulberry32 } from './noise.js';
import { PALETTE, STATION_TEXT } from './data.js';
import { registerGlow } from './materials.js';

const CAP = 260;

function boxTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a06a';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(120,85,45,0.25)';
  for (let y = 0; y < 256; y += 6) ctx.fillRect(0, y, 256, 1);
  ctx.fillStyle = PALETTE.teal;
  ctx.fillRect(0, 196, 256, 22);
  // Cotton icon + brand name.
  ctx.fillStyle = '#ffffff';
  for (const [x, y, r] of [[128, 70, 26], [100, 96, 24], [156, 96, 24], [128, 112, 22]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); }
  ctx.fillStyle = PALETTE.deepTeal;
  ctx.font = '800 34px Unbounded, Inter, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(STATION_TEXT.boxLogo, 128, 172);
  // Barcode.
  ctx.fillStyle = '#1f2a30';
  const r = mulberry32(4);
  for (let x = 170; x < 240; x += 3) if (r() < 0.6) ctx.fillRect(x, 228, 2, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function geometries() {
  const r = mulberry32(12);
  const debris = [];
  for (let i = 0; i < 9; i++) {
    debris.push(paint(new THREE.IcosahedronGeometry(0.06, 0).translate((r() - 0.5) * 0.7, 0.2 + r() * 0.4, (r() - 0.5) * 0.7), r() < 0.5 ? '#5b4630' : '#6e7f3d'));
  }
  const fluff = (s, seed) => paint(place(blob(0.42 * s, 1, 0.2, seed), { y: 0.36 * s, sy: 0.8 }), '#ffffff');
  const straps = [-0.32, 0, 0.32].map((z) => paint(new THREE.BoxGeometry(1.14, 0.84, 0.06).translate(0, 0.42, z), '#2a3338'));
  const label = paint(new THREE.BoxGeometry(0.3, 0.2, 0.02).translate(0.2, 0.55, 0.47), PALETTE.teal);
  const shirt = merge([
    paint(new THREE.BoxGeometry(0.9, 0.14, 0.7).translate(0, 0.07, 0), '#ffffff'),
    paint(new THREE.BoxGeometry(0.34, 0.06, 0.12).translate(0, 0.17, -0.3), '#e8e8e8'),
    paint(new THREE.BoxGeometry(0.06, 0.03, 0.4).translate(0, 0.16, 0.05), '#d9d9d9'),
  ]);
  const bottle = merge([
    paint(new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.17, 0.05], [0.17, 0.42], [0.08, 0.56], [0.06, 0.66], [0.07, 0.72], [0, 0.73]].map(([x, y]) => new THREE.Vector2(x, y)), 16), PALETTE.gold),
    paint(new THREE.CylinderGeometry(0.175, 0.175, 0.16, 16, 1, true).translate(0, 0.25, 0), '#ffffff'),
    paint(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12).translate(0, 0.72, 0), '#1f2a30'),
  ]);
  return {
    raw: merge([fluff(1.1, 1), fluff(0.8, 2).translate(0.3, -0.05, 0.15), ...debris]),
    clean: merge([fluff(1.1, 3), fluff(0.8, 4).translate(-0.28, -0.05, 0.12)]),
    fiber: paint(new THREE.CapsuleGeometry(0.22, 0.9, 4, 10).rotateX(Math.PI / 2).translate(0, 0.24, 0), '#ffffff'),
    seed: merge(Array.from({ length: 14 }, () => paint(new THREE.SphereGeometry(0.07, 6, 4).scale(1, 0.7, 1.4)
      .translate((r() - 0.5) * 0.45, 0.06 + r() * 0.16, (r() - 0.5) * 0.45), r() < 0.5 ? '#4a321e' : '#6a4a2c'))),
    bale: merge([paint(new THREE.BoxGeometry(1.1, 0.82, 0.9).translate(0, 0.41, 0), '#f6f1e6'), ...straps, label]),
    yarn: merge([
      paint(new THREE.CylinderGeometry(0.17, 0.3, 0.62, 16).translate(0, 0.31, 0), '#ffffff'),
      paint(new THREE.CylinderGeometry(0.05, 0.08, 0.72, 8).translate(0, 0.36, 0), PALETTE.gold),
    ]),
    fabric: merge([
      paint(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 18).rotateZ(Math.PI / 2).translate(0, 0.3, 0), '#ffffff'),
      paint(new THREE.CylinderGeometry(0.07, 0.07, 1.12, 8).rotateZ(Math.PI / 2).translate(0, 0.3, 0), '#9aa5ab'),
    ]),
    garment: shirt,
    box: new THREE.BoxGeometry(0.7, 0.55, 0.55).translate(0, 0.275, 0),
    oil: new THREE.CapsuleGeometry(0.17, 0.5, 4, 10).rotateX(Math.PI / 2),
    bottle,
  };
}

export const FORMS = ['raw', 'clean', 'fiber', 'seed', 'bale', 'yarn', 'fabric', 'garment', 'box', 'oil', 'bottle'];

export function createProducts(scene) {
  const geos = geometries();
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
  const cotton = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: '#fffaf0', emissiveIntensity: 0.12 });
  const oil = new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: '#ffb020', emissiveIntensity: 1.4, roughness: 0.2, transparent: true, opacity: 0.92 });
  registerGlow(oil, 1.4, 2.2);
  const bottleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.3, emissive: '#ffb020', emissiveIntensity: 0.25 });
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTexture(), roughness: 0.8 });
  const matFor = { raw: cotton, clean: cotton, fiber: cotton, oil, bottle: bottleMat, box: boxMat };
  const meshes = {};
  for (const f of FORMS) {
    const im = new THREE.InstancedMesh(geos[f], matFor[f] || vc, CAP);
    im.count = 0;
    im.castShadow = f !== 'oil';
    im.frustumCulled = false;
    im.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(im);
    meshes[f] = im;
  }
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  return {
    meshes,
    /** items: [{ form, pos: Vector3, dir: Vector3, color }] — written every frame. */
    write(items) {
      for (const f of FORMS) meshes[f].count = 0;
      for (const it of items) {
        const im = meshes[it.form];
        const i = im.count;
        if (i >= CAP) continue;
        dummy.position.copy(it.pos);
        dummy.up.set(0, 1, 0);
        dummy.lookAt(it.pos.x + it.dir.x, it.pos.y + it.dir.y, it.pos.z + it.dir.z);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        im.setColorAt(i, col.set(it.color ?? 0xffffff));
        im.count = i + 1;
      }
      for (const f of FORMS) {
        meshes[f].instanceMatrix.needsUpdate = true;
        if (meshes[f].instanceColor) meshes[f].instanceColor.needsUpdate = true;
      }
    },
  };
}
