// «Бөлшектеп көру» — like taking a computer apart in the informatics lab.
// A) One building separates into 11 floating parts (real roof, solar, interior meshes + its own wall
//    triangles lifted out of the merged batch + generated frame / sensors / cables / foundation).
// B) The whole base lifts into 5 tinted layers (groups of the already-built scene; no new geometry).
import * as THREE from 'three';
import './explode.css';
import { EXPLODE as X } from '../guide/texts.js';
import { mats, TILE } from '../materials.js';
import { Batch, box, cyl } from '../geo.js';
import { RobotArm } from '../robots.js';

const backOut = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const ORDER = [...X.parts].reverse().map((p) => p.id); // bottom → top
const PART = Object.fromEntries(X.parts.map((p) => [p.id, p]));
const LAYER_GAP = 120;

export function createExplode({ scene, camera, world, cameraman, root }) {
  const m = mats();
  const ghost = new THREE.MeshBasicMaterial({ color: '#cfeee9', transparent: true, opacity: 0.12, depthWrite: false });
  let mode = null, k = 0, dir = 0, cur = null, selected = null;

  /* ---------- DOM: hint pop, info card, assemble bar, labels ---------- */
  const pop = el('section', 'xp-pop glass', `<p>${X.hint}</p><button data-x="whole">🧩 ${X.whole}</button>`);
  const card = el('aside', 'xp-card glass', '');
  const bar = el('div', 'xp-bar glass', `<span>💻 ${X.lab} · ${X.tapHint}</span><button data-x="assemble">${X.assemble}</button>`);
  const labelLayer = el('div', 'xp-labels', '');
  for (const e of [pop, card, bar]) e.hidden = true;
  root.append(pop, card, bar, labelLayer);
  function el(tag, cls, html) { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; }
  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-x]')?.dataset.x;
    if (a === 'whole') { pop.hidden = true; explodeBase(); }
    if (a === 'assemble') assemble();
    if (a === 'card-close') select(null);
  });

  /* ---------- Whole-base layers ---------- */
  const layers = X.layers.map((L, i) => {
    const g = new THREE.Group();
    g.name = `layer:${L.id}`;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(720, 580).rotateX(-Math.PI / 2).translate(0, 0.8, -15),
      new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    plate.visible = false;
    plate.userData.layerIndex = i;
    g.add(plate);
    scene.add(g);
    return { ...L, i, g, plate, anchor: new THREE.Vector3(372, 6, -15), label: null };
  });
  /** Move every tagged scene child into its layer group (once, after the scene is built). */
  function collect() {
    const byId = Object.fromEntries(layers.map((L) => [L.id, L]));
    for (const o of [...scene.children]) {
      const L = byId[o.userData.layer];
      if (L && o !== L.g) L.g.add(o);
    }
  }

  function explodeBase() {
    if (mode === 'building') finishBuilding(true);
    mode = 'base';
    dir = 1;
    world.tour?.exit();
    world.guide?.exit();
    cameraman.highlight(null);
    for (const L of layers) {
      L.plate.visible = true;
      L.label = label(L.name, 'layer');
      L.label.dataset.i = L.i;
    }
    cameraman.flyTo(new THREE.Vector3(980, 330, 980), new THREE.Vector3(0, 225, -40), 2.4);
    showBar();
  }

  /* ---------- Building parts ---------- */
  const canExplode = (b) => !!(b && b.roof && b.interior && !b.spec.special);
  function explodeBuilding(b) {
    if (!canExplode(b)) return false;
    if (mode === 'building') finishBuilding(true);
    if (mode === 'base') finishBase(true);
    world.tour?.exit();
    world.guide?.exit();
    mode = 'building';
    dir = 1;
    const sp = b.spec, h = sp.h || 14;
    const parts = Object.fromEntries(ORDER.map((id) => { const g = new THREE.Group(); g.name = `part:${id}`; g.userData.part = id; scene.add(g); return [id, g]; }));
    const restore = [];
    const move = (o, part) => { restore.push([o, o.parent]); parts[part].add(o); };
    // Roof: closed and opaque, interior visible.
    if (b.clones) for (const c of b.clones) c.mesh.material = c.shared;
    b.alpha = b.target = 1;
    b.roof.visible = true;
    b.interior.visible = true;
    for (const o of [...b.roof.children]) move(o, /solar/i.test(o.name) ? 'solar' : 'roof');
    // Interior meshes by material key; robot arms → robots; anything else → machines.
    for (const o of [...b.interior.children]) {
      const key = o.isMesh ? o.name.split(':').pop() : '';
      const part = o instanceof RobotArm ? 'robots' : key === 'floor' ? 'floor' : ['belt', 'clearGlass', 'glowTeal'].includes(key) ? 'conveyors' : key === 'steel' ? 'frame' : 'machines';
      move(o, part);
    }
    // Walls: copy this building's triangles out of the merged batch and collapse them there.
    const stash = [];
    for (const mesh of world.site.wallMeshes) {
      const ranges = mesh.userData.ranges?.[b.id];
      if (!ranges) continue;
      const geo = mesh.geometry, pos = geo.attributes.position;
      const n = ranges.reduce((s, r) => s + r[1], 0);
      const copy = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(geo.attributes)) {
        const arr = new Float32Array(n * attr.itemSize);
        let o = 0;
        for (const [s, c] of ranges) { arr.set(attr.array.subarray(s * attr.itemSize, (s + c) * attr.itemSize), o); o += c * attr.itemSize; }
        copy.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
      }
      const wm = new THREE.Mesh(copy, mesh.material);
      wm.name = 'xp-wall';
      wm.castShadow = wm.receiveShadow = true;
      parts.walls.add(wm);
      for (const [s, c] of ranges) {
        stash.push({ pos, s, data: pos.array.slice(s * 3, (s + c) * 3) });
        pos.array.fill(0, s * 3, (s + c) * 3); // zero-area triangles: invisible
      }
      pos.needsUpdate = true;
    }
    // Rooftop towers and fans: stand-ins reusing the instanced geometry; the instances shrink to 0.
    const P = world.site.props;
    for (const tw of P.tlist.filter((x) => x.owner === b.id)) for (const im of [P.towers, P.rings, P.caps]) { const s = new THREE.Mesh(im.geometry, im.material); s.name = 'xp-standin'; s.position.set(tw.x, tw.y, tw.z); parts.towers.add(s); }
    for (const f of P.flist.filter((x) => x.owner === b.id)) for (const im of [P.housings, P.blades]) { const s = new THREE.Mesh(im.geometry, im.material); s.name = 'xp-standin'; s.position.set(f.x, f.y, f.z); parts.towers.add(s); }
    P.setScale(b.id, 0);
    // Generated parts: frame columns, sensors and cameras, cables and pipes, foundation slab.
    const G = { frame: new Batch(), sensors: new Batch(), cables: new Batch(), floor: new Batch() };
    const { cx, cz, w, d } = sp;
    for (let x = -w / 2 + 1; x <= w / 2 - 1; x += w / Math.round(w / 9)) for (const sz of [-1, 1]) G.frame.add('steel', box(0.45, h, 0.45, cx + x, h / 2, cz + sz * (d / 2 - 1)));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
      G.sensors.add('white', cyl(0.35, 0.35, 0.25, cx + x * (w / 2 - 1.5), h - 1.2, cz + z * (d / 2 - 1.5), 12));
      G.sensors.add('dark', cyl(0.22, 0.28, 0.35, cx + x * (w / 2 - 1.5), h - 1.5, cz + z * (d / 2 - 1.5), 12));
      G.sensors.add('glowRed', box(0.12, 0.12, 0.12, cx + x * (w / 2 - 1.5), h - 1.75, cz + z * (d / 2 - 1.5)));
    }
    for (let i = 0; i < 10; i++) G.sensors.add('glowGreen', box(0.18, 0.18, 0.18, cx - w / 2 + 3 + (i * (w - 6)) / 9, 2.4, cz - d / 2 + 0.9));
    for (const [key, off, y] of [['dark', 0.9, 0.5], ['glowTeal', 1.5, 0.7], ['gold', 2.1, 0.9]]) {
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new THREE.Vector3(cx + x * (w / 2 - off), y, cz + z * (d / 2 - off)));
      G.cables.add(key, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 64, 0.16, 6, false));
    }
    G.floor.add('concrete', box(w + 2, 1.2, d + 2, cx, -0.62, cz));
    for (const [id, B] of Object.entries(G)) B.build(m, TILE, parts[id], { name: `xp:${id}` });
    // Products on the belts would float in place: hide them while the building is apart.
    const products = world.production.flow.products.meshes;
    for (const pm of Object.values(products)) pm.visible = false;

    // Offsets: up the stack, slightly outward, with labels on the right.
    const gap = Math.max(5.5, h * 0.42);
    const info = ORDER.map((id, i) => {
      // Labels evenly spaced up the stack (each part's lift is i × gap).
      return { id, i, g: parts[id], off: new THREE.Vector3((i % 2 ? 1 : -1) * (1.5 + i * 0.7), i * gap, 0), anchor: new THREE.Vector3(cx + w / 2 + 3, h * 0.45, cz), label: label(PART[id].name, 'part') };
    });
    cur = { b, parts, restore, stash, info, products, height: (ORDER.length - 1) * gap + h };
    const c = new THREE.Vector3(cx, cur.height * 0.5, cz);
    const dist = Math.max(w, cur.height) * 1.6 + 30;
    cameraman.setFollow(null);
    cameraman.highlight(null);
    cameraman.flyTo(c.clone().add(new THREE.Vector3(dist * 0.62, dist * 0.18, dist * 0.78)), c, 2);
    showBar();
    return true;
  }

  /* ---------- Assemble / finish ---------- */
  function assemble() { if (mode) { dir = -1; select(null); } }
  function finishBuilding(now = false) {
    if (!cur) return;
    const { b, parts, restore, stash, products } = cur;
    restoreMaterials();
    for (const [o, parent] of restore) parent.add(o);
    for (const { pos, s, data } of stash) { pos.array.set(data, s * 3); pos.needsUpdate = true; }
    for (const g of Object.values(parts)) {
      // Only our own geometry is disposed (stand-ins share the instanced geometry).
      g.traverse((o) => { if (o.isMesh && (o.name.startsWith('xp:') || o.name === 'xp-wall')) o.geometry.dispose(); });
      scene.remove(g);
    }
    world.site.props.setScale(b.id, 1);
    b.interior.visible = false;
    for (const pm of Object.values(products)) pm.visible = true;
    for (const p of cur.info) p.label.remove();
    cur = null;
    if (!now) endMode();
  }
  function finishBase(now = false) {
    if (mode !== 'base' && !now) return;
    for (const L of layers) { L.g.position.y = 0; L.plate.visible = false; L.label?.remove(); L.label = null; }
    if (!now) endMode();
  }
  function endMode() { mode = null; k = 0; dir = 0; bar.hidden = card.hidden = true; document.body.classList.remove('exploded'); }
  function showBar() { bar.hidden = false; pop.hidden = true; document.body.classList.add('exploded'); }

  /* ---------- Selection: highlight one part / layer, dim the rest ---------- */
  const dimmed = [];
  function restoreMaterials() { for (const [o, mat] of dimmed) o.material = mat; dimmed.length = 0; }
  function select(item) {
    selected = item;
    restoreMaterials();
    cameraman.highlight(null);
    card.hidden = !item;
    labelLayer.querySelectorAll('.xp-label').forEach((e) => e.classList.toggle('dim', !!item && e !== item.label));
    if (!item) return;
    const isLayer = !!item.plate;
    const T = isLayer ? X.layers[item.i] : PART[item.id];
    card.innerHTML = `
      <div class="card-head"><div class="tags"><span class="tag">${isLayer ? '🧩' : X.name}</span></div><button class="icon-btn" data-x="card-close" aria-label="✕">✕</button></div>
      <h2>${T.name}</h2>
      <div class="sec"><h5>${X.fn}</h5><p>${T.fn}</p></div>
      <div class="sec now"><p>${X.pc(isLayer ? T.pc : T.pc.charAt(0).toLowerCase() + T.pc.slice(1))}</p></div>
      ${T.fact ? `<div class="fact">💡 <b>${X.fact}:</b> ${T.fact}</div>` : ''}`;
    if (isLayer) {
      for (const L of layers) L.plate.material.opacity = L === item ? 0.34 : 0.07;
    } else {
      for (const p of cur.info) if (p !== item) p.g.traverse((o) => { if (o.isMesh) { dimmed.push([o, o.material]); o.material = ghost; } });
      cameraman.highlight(() => new THREE.Box3().setFromObject(item.g));
    }
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function onTap(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (mode === 'building' && cur) {
      const hit = ray.intersectObjects(cur.info.map((p) => p.g), true)[0];
      let o = hit?.object;
      while (o && !o.userData.part) o = o.parent;
      select(o ? cur.info.find((p) => p.g === o) : null);
    } else if (mode === 'base') {
      const hit = ray.intersectObjects(layers.map((L) => L.plate), false)[0];
      select(hit ? layers[hit.object.userData.layerIndex] : null);
    }
  }

  function label(text, kind) {
    const e = el('div', `xp-label ${kind}`, `<span>${text}</span>`);
    labelLayer.appendChild(e);
    e.addEventListener('click', () => {
      if (kind === 'layer') select(layers[+e.dataset.i]);
      else select(cur.info.find((p) => p.label === e));
    });
    return e;
  }
  const v = new THREE.Vector3();
  function place(e, p) {
    v.copy(p).project(camera);
    // Kept on screen so every label stays tappable whatever the camera does.
    const x = Math.min(innerWidth - 230, Math.max(8, (v.x * 0.5 + 0.5) * innerWidth)), y = Math.min(innerHeight - 150, Math.max(90, (-v.y * 0.5 + 0.5) * innerHeight));
    e.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    e.style.visibility = v.z < 1 ? 'visible' : 'hidden';
  }

  return {
    get active() { return !!mode; },
    get mode() { return mode; },
    canExplode, explodeBuilding, explodeBase, assemble, collect, onTap,
    togglePop() { if (mode) assemble(); else pop.hidden = !pop.hidden; },
    update(dt) {
      if (!mode) return;
      k = Math.min(1, Math.max(0, k + (dir * dt) / 1.2));
      const e = dir > 0 ? backOut(k) : k * k * (3 - 2 * k);
      if (mode === 'building' && cur) {
        cur.b.interior.visible = true;
        for (const p of cur.info) { p.g.position.copy(p.off).multiplyScalar(e); place(p.label, v.copy(p.anchor).add(p.g.position)); }
      } else if (mode === 'base') {
        for (const L of layers) {
          L.g.position.y = L.i * LAYER_GAP * e;
          if (!selected) L.plate.material.opacity = 0.2 * Math.min(1, k);
          place(L.label, v.copy(L.anchor).add(L.g.position));
        }
      }
      if (dir < 0 && k === 0) {
        if (mode === 'building') finishBuilding(); else finishBase();
      }
    },
  };
}
