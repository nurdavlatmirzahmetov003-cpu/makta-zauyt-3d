// Night and dawn atmosphere: the moon, a milky way band, fireflies over the park and the lake shore,
// morning mist on the lake and a soft halo around the «Ақ Маржан» monument.
import * as THREE from 'three';
import { LAKE, heightAt } from '../terrain.js';
import { cloudTexture } from '../textures.js';
import { mulberry32 } from '../noise.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function discTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildNight(scene, env) {
  const rand = mulberry32(2040);
  const sprite = (map, o = {}) => new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false, ...o }));

  // Moon (where the night light comes from).
  const moon = sprite(discTexture((g, s) => {
    const r = s / 2;
    const glow = g.createRadialGradient(r, r, r * 0.3, r, r, r);
    glow.addColorStop(0, 'rgba(220,232,255,0.55)');
    glow.addColorStop(1, 'rgba(220,232,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    g.beginPath();
    g.arc(r, r, r * 0.34, 0, Math.PI * 2);
    g.fillStyle = '#eef3ff';
    g.fill();
    g.fillStyle = 'rgba(160,175,205,0.45)';
    for (const [x, y, rr] of [[0.44, 0.42, 0.07], [0.56, 0.55, 0.05], [0.47, 0.6, 0.04], [0.58, 0.4, 0.035]]) { g.beginPath(); g.arc(x * s, y * s, rr * s, 0, Math.PI * 2); g.fill(); }
  }));
  moon.position.copy(env.moonDir).multiplyScalar(4700);
  moon.scale.setScalar(420);
  moon.renderOrder = -1;

  // Milky way: a dense band of faint stars on a tilted great circle.
  const N = 2600, pos = new Float32Array(N * 3);
  const n = new THREE.Vector3(0.35, 0.42, 0.84).normalize(), u = new THREE.Vector3(1, 0, 0).cross(n).normalize(), w = n.clone().cross(u);
  const d = new THREE.Vector3();
  for (let i = 0, k = 0; k < N && i < N * 4; i++) {
    const a = rand() * Math.PI * 2, g = (rand() + rand() + rand() - 1.5) * 0.12;
    d.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a)).addScaledVector(n, g).normalize();
    if (d.y < 0.04) continue;
    pos.set([d.x * 5100, d.y * 5100, d.z * 5100], k * 3);
    k++;
  }
  const milky = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: '#cddcff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));

  // Fireflies: around the park and along the lake shore.
  const F = 90, base = [], fpos = new Float32Array(F * 3), fcol = new Float32Array(F * 3);
  for (let i = 0; i < F; i++) {
    let x, z;
    if (i < 40) { const a = rand() * Math.PI * 2, r = 6 + rand() * 30; x = -110 + Math.cos(a) * r; z = 172 + Math.sin(a) * r * 0.8; }
    else { const a = rand() * Math.PI * 2, s = 1.02 + rand() * 0.12; x = LAKE.x + Math.cos(a) * LAKE.rx * s; z = LAKE.z + Math.sin(a) * LAKE.rz * s; }
    base.push({ x, y: Math.max(heightAt(x, z), LAKE.water) + 0.8 + rand() * 2, z, p: rand() * 10, s: 0.4 + rand() * 0.6 });
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flies = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flies.frustumCulled = false;

  // Morning mist over the lake.
  const mistTex = cloudTexture(2);
  const mist = [];
  for (let i = 0; i < 8; i++) {
    const s = sprite(mistTex, { color: '#e8f2f6', fog: true });
    s.position.set(LAKE.x + (rand() - 0.5) * LAKE.rx * 1.3, LAKE.water + 3 + rand() * 2, LAKE.z + (rand() - 0.5) * LAKE.rz * 1.1);
    s.scale.set(150 + rand() * 80, 26 + rand() * 10, 1);
    s.userData.v = 1 + rand() * 1.5;
    mist.push(s);
  }

  // Soft halo around the monument's cotton boll.
  const halo = sprite(discTexture((g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,248,225,0.9)');
    grad.addColorStop(0.35, 'rgba(255,224,150,0.35)');
    grad.addColorStop(1, 'rgba(255,210,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }, 128), { blending: THREE.AdditiveBlending, fog: true });
  halo.position.set(0, 6.6, 95);
  halo.scale.setScalar(20);

  scene.add(moon, milky, flies, halo, ...mist);
  let t = 0;
  return {
    update(dt, minutes, night) {
      t += dt;
      moon.material.opacity = night;
      milky.material.opacity = 0.7 * night;
      moon.visible = milky.visible = night > 0.01;
      halo.material.opacity = night * (0.55 + 0.15 * Math.sin(t * 1.2));
      halo.visible = night > 0.01;
      flies.visible = night > 0.3;
      if (flies.visible) {
        flies.material.opacity = smooth(0.3, 0.8, night);
        base.forEach((b, i) => {
          const k = t * b.s + b.p;
          fpos.set([b.x + Math.sin(k * 0.7) * 1.6, b.y + Math.sin(k * 1.3) * 0.5, b.z + Math.cos(k * 0.6) * 1.6], i * 3);
          const blink = Math.max(0, Math.sin(k * 2.2)) ** 3;
          fcol.set([0.85 * blink, 1.0 * blink, 0.35 * blink], i * 3);
        });
        fgeo.attributes.position.needsUpdate = fgeo.attributes.color.needsUpdate = true;
      }
      const m = smooth(5 * 60, 5 * 60 + 40, minutes) * (1 - smooth(7 * 60, 8 * 60, minutes));
      for (const s of mist) {
        s.visible = m > 0.01;
        s.material.opacity = 0.5 * m;
        s.position.x += Math.sin(t * 0.05 + s.userData.v) * dt * s.userData.v;
      }
    },
  };
}
