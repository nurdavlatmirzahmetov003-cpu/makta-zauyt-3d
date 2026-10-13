// HTML labels for buildings and vehicles: projected every frame, faded by distance and culled when
// they overlap a nearer label. «БАРЛЫҚ АТАУЛАР» toggles them.
import * as THREE from 'three';

export function createLabels(camera) {
  const layer = document.createElement('div');
  layer.className = 'labels-layer';
  document.body.appendChild(layer);
  const items = [];
  let enabled = false;
  const v = new THREE.Vector3();

  function add(text, getPos, kind = 'building') {
    const el = document.createElement('div');
    el.className = `label3d ${kind}`;
    el.textContent = text;
    layer.appendChild(el);
    const it = { el, getPos, kind, w: 0, h: 0, shown: false };
    items.push(it);
    return it;
  }

  function update() {
    if (!enabled) return;
    const placed = [];
    const cam = camera.position;
    const vis = [];
    for (const it of items) {
      const p = it.getPos();
      if (!p) { hide(it); continue; }
      const dist = cam.distanceTo(p);
      v.copy(p).project(camera);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { hide(it); continue; }
      const fade = 1 - THREE.MathUtils.smoothstep(dist, it.kind === 'vehicle' ? 160 : 380, it.kind === 'vehicle' ? 260 : 720);
      if (fade <= 0.02) { hide(it); continue; }
      vis.push({ it, dist, x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, fade });
    }
    vis.sort((a, b) => a.dist - b.dist);
    for (const L of vis) {
      const { it } = L;
      if (!it.w) { it.w = it.el.offsetWidth || 120; it.h = it.el.offsetHeight || 22; }
      const r = { x0: L.x - it.w / 2 - 4, x1: L.x + it.w / 2 + 4, y0: L.y - it.h - 6, y1: L.y + 2 };
      // Keep labels clear of the top bar.
      if (r.y0 < 76 || placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) { hide(it); continue; }
      placed.push(r);
      it.el.style.transform = `translate(${(L.x - it.w / 2).toFixed(1)}px, ${(L.y - it.h).toFixed(1)}px)`;
      it.el.style.opacity = L.fade.toFixed(2);
      if (!it.shown) { it.el.classList.add('on'); it.shown = true; }
    }
  }

  function hide(it) {
    if (it.shown) { it.el.classList.remove('on'); it.el.style.opacity = '0'; it.shown = false; }
  }

  return {
    add,
    update,
    get enabled() { return enabled; },
    set(on) {
      enabled = on;
      layer.classList.toggle('on', on);
      if (!on) for (const it of items) hide(it);
    },
  };
}
