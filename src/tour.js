// «ЗАУЫТҚА КІРУ» — the automatic 360° tour. A small director: a queue of camera shots (curves, orbits,
// product follow, truck chase, panorama) plus the tour panel, controls, caption and export finale.
import * as THREE from 'three';
import { STAGES, BUILDING_INFO, TOUR_STAGES, TOUR_TEXT as TT } from './data.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICO = {
  prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>', exit: '<path d="M6 6l12 12M18 6L6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>', play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
};
const ico = (k) => `<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
const PANO = { center: V(0, 0, -40), radius: 760, height: 300 };

export function createTour({ scene, camera, controls, world, cameraman, tod, root }) {
  const { production, traffic, site, env } = world;
  const flow = production.flow;
  const lines = Object.values(production.lines);
  const listeners = { stage: [], state: [] };
  const emit = (k, v) => { for (const f of listeners[k]) f(v); };

  /* ---------- Station spotlight: a real SpotLight (always in the scene, so no shader recompiles) + a soft cone ---------- */
  const spot = new THREE.SpotLight('#dffff8', 0, 70, 0.55, 0.6, 1.6);
  spot.castShadow = false;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1, 1, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: '#bffcf2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  cone.visible = false;
  scene.add(spot, spot.target, cone);
  let spotOn = 0, spotK = 0;

  /* ---------- DOM ---------- */
  const wrap = document.createElement('div');
  wrap.className = 'tour';
  wrap.innerHTML = `
    <aside class="tour-panel glass" hidden></aside>
    <div class="tour-caption glass" hidden></div>
    <div class="tour-bar glass" hidden>
      <button data-t="prev">${ico('prev')}${TT.prev}</button>
      <button data-t="play" class="main"><span class="ic">${ico('pause')}</span><span class="lbl">${TT.pause}</span></button>
      <button data-t="next">${TT.next}${ico('next')}</button>
      <button data-t="exit" class="exit">${ico('exit')}${TT.exit}</button>
    </div>
    <section class="tour-finale glass" hidden>
      <div class="fin-title">${TT.exportTitle}</div>
      <div class="fin-sub">${TT.exportSub}</div>
      <p>${esc(TT.exportText)}</p>
      <div class="fin-stats">${TT.exportStats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="fin-btns"><button data-t="replay">${TT.replay}</button><button data-t="exit" class="ghost">${TT.exit}</button></div>
    </section>`;
  root.appendChild(wrap);
  const $ = (s) => wrap.querySelector(s);
  const panel = $('.tour-panel'), bar = $('.tour-bar'), caption = $('.tour-caption'), fin = $('.tour-finale');
  wrap.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-t]')?.dataset.t;
    if (a === 'play') (playing ? pause : resume)();
    else if (a === 'prev') jump(ending() ? 17 : Math.max(1, idx));
    else if (a === 'next') { if (ending()) return; if (idx >= 16) finale(); else jump(idx + 2); }
    else if (a === 'exit') exit();
    else if (a === 'replay') start(1);
  });
  addEventListener('keydown', (ev) => {
    if (!active || ev.target.closest?.('input')) return;
    if (ev.key === ' ') { ev.preventDefault(); (playing ? pause : resume)(); }
    if (ev.key === 'ArrowRight') bar.querySelector('[data-t="next"]').click();
    if (ev.key === 'ArrowLeft') bar.querySelector('[data-t="prev"]').click();
  });

  const ending = () => phase === 'finale' || phase === 'panorama';
  function setCaption(text) {
    caption.hidden = !text;
    if (text) caption.textContent = text;
  }

  function renderPanel(k) {
    const S = TOUR_STAGES[k], st = STAGES[k], info = BUILDING_INFO[S.building] || {};
    panel.innerHTML = `
      <div class="tp-head">
        <span class="tp-num">${st.n}</span>
        <div><small>${st.n}-${TT.stage} · ${TT.of}</small><h2>${esc(st.name)}</h2></div>
      </div>
      <div class="tp-dots">${STAGES.map((s) => `<i class="${s.n < st.n ? 'done' : s.n === st.n ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tp-progress"><i></i></div>
      <div class="sec now"><h5>${TT.what}</h5><p>${esc(st.what)}</p></div>
      <div class="sec"><h5>${TT.robots}</h5><p>${esc(S.robots)}</p></div>
      <div class="sec"><h5>${TT.io}</h5><div class="io"><span class="pill">${esc(info.in || '—')}</span><span class="arrow">→</span><span class="pill out">${esc(info.out || '—')}</span></div></div>
      <div class="sec"><h5>${TT.smart}</h5><div class="tp-badges">${S.badges.map((b) => `<span>✦ ${esc(b)}</span>`).join('')}</div></div>`;
    panel.hidden = false;
    panel.classList.remove('in');
    void panel.offsetWidth;
    panel.classList.add('in');
  }
  const setProgress = (u) => { const i = panel.querySelector('.tp-progress i'); if (i) i.style.transform = `scaleX(${u.toFixed(3)})`; };
  function refreshBar() {
    bar.querySelector('[data-t="play"] .ic').innerHTML = ico(playing ? 'pause' : 'play');
    bar.querySelector('[data-t="play"] .lbl').textContent = playing ? TT.pause : TT.resume;
    bar.classList.toggle('paused', !playing);
    bar.querySelector('[data-t="next"]').classList.toggle('off', ending());
  }

  /* ---------- Camera pose and shots ---------- */
  const cur = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const look = new THREE.Vector3();
  let shot = null, queue = [], blend = null;

  function curveShot(pp, lp, dur, { at = null } = {}) {
    const pc = new THREE.CatmullRomCurve3(pp, false, 'centripetal');
    const lc = new THREE.CatmullRomCurve3(lp, false, 'centripetal');
    const byLen = pc.getLength() > 1;
    let t = 0, fired = false;
    return {
      update(dt) {
        t += dt;
        const u = ease(Math.min(1, t / dur));
        if (byLen) pc.getPointAt(u, cur.pos); else pc.getPoint(u, cur.pos);
        lc.getPoint(u, cur.look);
        if (at && !fired && t / dur >= at[0]) { fired = true; at[1](); }
        return t >= dur;
      },
    };
  }
  /** Arc from the current pose to (pos, lk) over the roofs. */
  function arc(pos, lk, dur, lift = 24) {
    const d = cur.pos.distanceTo(pos);
    const mid = cur.pos.clone().lerp(pos, 0.5);
    mid.y = Math.max(cur.pos.y, pos.y) + Math.min(lift, d * 0.3) + 3;
    const midLook = cur.look.clone().lerp(lk, 0.55);
    return curveShot([cur.pos.clone(), mid, pos.clone()], [cur.look.clone(), midLook, lk.clone()], dur);
  }

  const lineInto = (id) => lines.find((l) => l.to === production.nodes[id] && l.ext);
  const lineOutOf = (id) => lines.find((l) => l.from === id && l.ext);
  function stageFrame(S) {
    const c = V(...S.target);
    const lin = lineInto(S.building), lout = lineOutOf(S.building);
    const pIn = lin ? lin.path.points[lin.path.points.length - 1].clone().setY(c.y) : c.clone();
    const pOut = lout ? lout.path.points[0].clone().setY(c.y) : c.clone();
    return { c, pIn, pOut };
  }
  function orbitPose(S, F, a, u, outPos, outLook) {
    const h = S.height + 2.6 * Math.sin(u * Math.PI * 4);
    const r = S.radius * (1 - 0.07 * Math.sin(u * Math.PI * 2));
    outPos.set(F.c.x + Math.sin(a) * r, h, F.c.z + Math.cos(a) * r);
    // The focus drifts from the entry port towards the exit port: the eye follows the product.
    outLook.lerpVectors(F.pIn, F.pOut, smooth(u)).lerp(F.c, 0.5);
  }
  function orbitShot(S, F, dur) {
    let a0 = Math.atan2(cur.pos.x - F.c.x, cur.pos.z - F.c.z), t = 0;
    return {
      update(dt) {
        t += dt;
        const u = Math.min(1, t / dur);
        orbitPose(S, F, a0 - u * Math.PI * 2, u, cur.pos, cur.look);
        setProgress(u);
        return t >= dur;
      },
      resync() { a0 = Math.atan2(camera.position.x - F.c.x, camera.position.z - F.c.z) + (t / dur) * Math.PI * 2; },
    };
  }
  function approach(S, F, dur) {
    const a0 = Math.atan2(cur.pos.x - F.c.x, cur.pos.z - F.c.z);
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    orbitPose(S, F, a0, 0, p, l);
    return arc(p, l, dur, 14);
  }

  function followPose(p, d, outPos, outLook) {
    const fx = d.x, fz = d.z, n = Math.hypot(fx, fz) || 1;
    const hx = fx / n, hz = fz / n;
    outPos.set(p.x + hz * 7 - hx * 7, p.y + 4.2, p.z - hx * 7 - hz * 7);
    outLook.set(p.x + hx * 3, p.y, p.z + hz * 3);
  }
  function pickItem(line, lead) {
    const [e0, e1] = line.ext;
    let best = null, bestS = Infinity;
    for (const it of flow.items) {
      if (it.line !== line) continue;
      const sp = it.s + line.speed * lead;
      if (sp > e0 + 1 && sp < e0 + (e1 - e0) * 0.45 && sp < bestS) { best = it; bestS = sp; }
    }
    if (!best) {
      flow.spawn(line, line.form, line.form === 'oil' ? '#f5c04a' : '#ffffff');
      best = flow.items[flow.items.length - 1];
      best.s = Math.max(0, e0 + 1.5 - line.speed * lead);
    }
    return best;
  }
  function followShot(item, dur) {
    let t = 0;
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    return {
      update(dt) {
        t += dt;
        followPose(item.pos, item.dir, p, l);
        const k = 1 - Math.exp(-dt * 5);
        cur.pos.lerp(p, k);
        cur.look.lerp(l, k);
        return t >= dur || item.s >= item.line.path.length - 0.5;
      },
    };
  }

  /* ---------- Stage management ---------- */
  let active = false, playing = false, idx = 0, phase = null, prevMode = 'day', semiHeld = false;
  const opened = new Set();

  function enterStage(k) {
    idx = k;
    phase = 'stage';
    const S = TOUR_STAGES[k], b = site.list.get(S.building), sp = b.spec;
    for (const id of opened) if (id !== b.id) { site.list.get(id).setRoof(false); opened.delete(id); }
    if (b.roof && !b.isOpen) { b.setRoof(true); opened.add(b.id); }
    const hb = Math.min(sp.h || 14, 22);
    const machine = new THREE.Box3(V(sp.cx - sp.w * 0.28, 0.2, sp.cz - sp.d * 0.26), V(sp.cx + sp.w * 0.28, Math.min(hb - 3, 8), sp.cz + sp.d * 0.26));
    cameraman.highlight(() => machine);
    spot.position.set(sp.cx, hb + 12, sp.cz + 4);
    spot.target.position.set(sp.cx, 0, sp.cz);
    cone.scale.set(Math.min(sp.w, sp.d) * 0.3, hb + 12, Math.min(sp.w, sp.d) * 0.3);
    cone.position.set(sp.cx, (hb + 12) / 2, sp.cz);
    spotOn = 1;
    env.setShadowFocus(V(sp.cx, 0, sp.cz), 140);
    renderPanel(k);
    setProgress(0);
    fin.hidden = true;
    emit('stage', k + 1);
  }

  function transferTo(k, { follow = true } = {}) {
    const S = TOUR_STAGES[k], F = stageFrame(S);
    idx = k; // the target stage: ◀ / ▶ during a transfer are relative to it
    if (k >= 15 && !semiHeld) { traffic.holdSemi(); semiHeld = true; }
    spotOn = 0;
    cameraman.highlight(null);
    queue = [];
    const line = follow ? lineInto(S.building) : null;
    if (line) {
      const lead = 2.6, item = pickItem(line, lead);
      const sp = item.s + line.speed * lead;
      const p = new THREE.Vector3(), l = new THREE.Vector3();
      followPose(line.path.at(sp, new THREE.Vector3()), line.path.dirAt(sp, new THREE.Vector3()), p, l);
      queue.push(() => { phase = 'transfer'; return arc(p, l, lead, 26); });
      queue.push(() => { setCaption(TT.following); return followShot(item, 4.6); });
    }
    queue.push(() => { setCaption(null); enterStage(k); return approach(S, F, 2.8); });
    queue.push(() => orbitShot(S, F, S.duration));
    queue.push(() => { if (k < 16) transferTo(k + 1); else finale(); return null; });
    shot = null;
  }

  function flyIn() {
    const S = TOUR_STAGES[0], F = stageFrame(S);
    const a0 = Math.atan2(-190 - F.c.x, -62 - F.c.z);
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    orbitPose(S, F, a0, 0, p, l);
    const pts = [cur.pos.clone(), V(0, 16, 268), V(0, 22, 175), V(0, 36, 95), V(0, 24, 8), V(-110, 26, -16), V(-190, 28, -62), p];
    const lks = [cur.look.clone(), V(0, 9, 170), V(0, 12, 90), V(0, 8, -20), V(-150, 6, -60), V(-215, 4, -100), l];
    queue = [
      () => { phase = 'intro'; setCaption(TT.entering); return curveShot(pts, lks, 13, { at: [0.62, () => { setCaption(null); enterStage(0); }] }); },
      () => orbitShot(S, F, S.duration),
      () => { transferTo(1); return null; },
    ];
    shot = null;
  }

  /* ---------- Finale: the loaded semi leaves for export, then a golden-hour panorama ---------- */
  function chaseShot(v) {
    let t = 0, shown = false;
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    return {
      update(dt) {
        t += dt;
        const d = v.dir, k = smooth(Math.min(1, t / 26));
        const rx = d.z, rz = -d.x;
        p.set(v.pos.x - d.x * (24 + 12 * k) + rx * 9, 10 + 26 * k, v.pos.z - d.z * (24 + 12 * k) + rz * 9);
        l.set(v.pos.x + d.x * 14, 2, v.pos.z + d.z * 14);
        const e = 1 - Math.exp(-dt * 2.2);
        cur.pos.lerp(p, e);
        cur.look.lerp(l, e);
        if (!shown && (t > 9 || v.pos.z > 60)) { shown = true; fin.hidden = false; fin.classList.add('in'); }
        return v.hidden > 0 || v.pos.z > 238 || t > 48;
      },
    };
  }
  function panoramaShot() {
    let a0 = Math.atan2(cur.pos.x - PANO.center.x, cur.pos.z - PANO.center.z);
    let t = 0;
    return {
      update(dt) {
        t += dt;
        const a = a0 + t * 0.035;
        cur.pos.set(PANO.center.x + Math.sin(a) * PANO.radius, PANO.height + 20 * Math.sin(t * 0.2), PANO.center.z + Math.cos(a) * PANO.radius);
        cur.look.copy(PANO.center);
        return false;
      },
      resync() { a0 = Math.atan2(camera.position.x - PANO.center.x, camera.position.z - PANO.center.z) - t * 0.035; },
    };
  }
  function finale() {
    phase = 'finale';
    idx = 16;
    spotOn = 0;
    cameraman.highlight(null);
    setCaption(null);
    panel.hidden = true;
    if (!semiHeld) traffic.holdSemi();
    semiHeld = false;
    traffic.releaseSemi(10);
    tod.golden?.();
    env.setShadowFocus();
    emit('stage', 17);
    refreshBar();
    const semi = traffic.semi;
    queue = [
      () => chaseShot(semi),
      () => {
        fin.hidden = false;
        const a = Math.atan2(cur.pos.x - PANO.center.x, cur.pos.z - PANO.center.z);
        const p = V(PANO.center.x + Math.sin(a) * PANO.radius, PANO.height, PANO.center.z + Math.cos(a) * PANO.radius);
        return arc(p, PANO.center.clone(), 7, 60);
      },
      () => { phase = 'panorama'; return panoramaShot(); },
    ];
    shot = null;
  }

  /* ---------- Public controls ---------- */
  function begin() {
    if (!active) {
      prevMode = tod.mode === 'golden' ? 'day' : tod.mode;
      cur.pos.copy(camera.position);
      cur.look.copy(controls.target);
    }
    active = true;
    playing = true;
    cameraman.stop();
    document.body.classList.add('touring');
    bar.hidden = false;
    fin.hidden = true;
    fin.classList.remove('in');
    if (tod.mode === 'golden') tod.set(prevMode);
    refreshBar();
    emit('state', true);
  }
  function start(n = 1) {
    const fresh = !active;
    const restart = fresh || ending();
    begin();
    if (restart) { cur.pos.copy(camera.position); cur.look.copy(controls.target); }
    blend = null;
    if (n === 1 && restart) flyIn(); else transferTo(n - 1);
  }
  function jump(n) {
    if (!active) return start(n);
    if (!playing) { cur.pos.copy(camera.position); cur.look.copy(controls.target); }
    begin();
    blend = null;
    transferTo(n - 1);
  }
  function pause() {
    if (!active || !playing) return;
    playing = false;
    controls.target.copy(look);
    setCaption(phase === 'panorama' ? null : TT.paused);
    refreshBar();
  }
  function resume() {
    if (!active || playing) return;
    playing = true;
    setCaption(null);
    blend = { pos: camera.position.clone(), look: controls.target.clone(), t: 0 };
    shot?.resync?.();
    refreshBar();
  }
  function exit() {
    if (!active) return;
    active = playing = false;
    phase = null;
    queue = [];
    shot = null;
    for (const id of opened) site.list.get(id).setRoof(false);
    opened.clear();
    spotOn = 0;
    cameraman.highlight(null);
    if (semiHeld) { traffic.releaseSemi(6.5); semiHeld = false; }
    if (tod.mode === 'golden') tod.set(prevMode);
    env.setShadowFocus();
    controls.target.copy(look);
    panel.hidden = bar.hidden = fin.hidden = true;
    setCaption(null);
    document.body.classList.remove('touring');
    emit('state', false);
  }
  // Touching the 3D view pauses the tour and hands over a manual orbit around the current station.
  controls.addEventListener('start', () => { if (playing) pause(); });

  return {
    get active() { return active; },
    get playing() { return playing; },
    get stage() { return idx + 1; },
    get phase() { return phase; },
    start, jump, pause, resume, exit,
    onStage(f) { listeners.stage.push(f); },
    onState(f) { listeners.state.push(f); },
    update(dt) {
      spotK += (spotOn - spotK) * Math.min(1, dt * 2.5);
      spot.intensity = 420 * spotK;
      cone.visible = spotK > 0.01;
      cone.material.opacity = 0.075 * spotK;
      if (!active || !playing) return;
      while (!shot && queue.length) shot = queue.shift()();
      if (shot && shot.update(dt)) shot = null;
      if (blend) {
        blend.t += dt;
        const k = smooth(Math.min(1, blend.t / 1.6));
        camera.position.lerpVectors(blend.pos, cur.pos, k);
        look.lerpVectors(blend.look, cur.look, k);
        if (k >= 1) blend = null;
      } else {
        camera.position.copy(cur.pos);
        look.copy(cur.look);
      }
      camera.lookAt(look);
      controls.target.copy(look);
    },
  };
}
