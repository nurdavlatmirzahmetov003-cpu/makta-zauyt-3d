// Kazakh interface: top bar with live counters, left dock, info card, searchable lists, quality and
// time-of-day controls, labels toggle, 17-stage timeline with a fact ticker, night theme.
import * as THREE from 'three';
import './ui.css';
import './tour.css';
import { UI, TEXT, STAGES, BUILDINGS, BUILDING_INFO, VEHICLE_INFO, ROBOT_ROLES, FEATURES, FEATURES_TITLE } from './data.js';
import { GATE_TARGET, GATE_VIEW } from './intro.js';
import { num } from './sim/format.js';

const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  top: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="3"/>',
  tour: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M21 3v6h-6"/><circle cx="12" cy="12" r="2.5"/>',
  process: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12h4l5-6M11.5 12l5 6"/>',
  buildings: '<path d="M3 21V9l6-4v16M9 21V3l12 6v12M3 21h18M13 12h4M13 16h4"/>',
  vehicles: '<path d="M2 16V7h11v9M13 10h5l3 3v3h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  robots: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 16h6"/><circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>',
  labels: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  roof: '<path d="M2 10l7-6 4 3.4M22 10l-6-5.5"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>',
  time: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  quality: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  features: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  guide: '<circle cx="12" cy="10" r="6"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="10" r="1"/><path d="M9 18c1 1.5 5 1.5 6 0M12 16v2M8 20h8"/>',
  explode: '<path d="M4 9l8-5 8 5-8 5z"/><path d="M4 15l8 5 8-5"/><path d="M12 14v6"/>',
  screen: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
};
const svg = (k, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const LOGO = `<svg class="logo-mini" viewBox="-30 -30 60 60"><circle r="28" fill="none" stroke="url(#lgm)" stroke-width="2.5"/><defs><linearGradient id="lgm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12b5a0"/><stop offset="1" stop-color="#f5c04a"/></linearGradient></defs>${[[0, -8, 9], [-9, 2, 9], [9, 2, 9], [0, 9, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fffaf0" stroke="#d9e3e0" stroke-width="0.8"/>`).join('')}</svg>`;

/** "1284.4" → "1 284", decimals with a comma (Kazakh style). */
export const fmt = (n, d = 0) => num(n, d);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI({ root, world, camera, controls, cameraman, labels, quality, tod, economy = null }) {
  const nameOf = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.name]));
  const stageOf = Object.fromEntries(STAGES.map((s) => [s.building, s]));
  root.innerHTML = `
    <header class="topbar glass">
      <div class="brand">${LOGO}<span class="brand-text">${esc(TEXT.titleCaps)}<em> — ${esc(TEXT.complex)}</em></span></div>
      <div class="counters">
        ${[['sun', '☀️', UI.units.mw], ['cotton', '🌱', UI.units.t], ['goods', '📦', UI.units.pcs], ['co2', '🌿', UI.units.t], ['robots', '🤖', '']]
          .map(([k, ic, u]) => `<div class="counter" data-k="${k}"><span class="c-ico">${ic}</span><span class="c-lbl">${UI.counters[k]}</span><span class="c-num"><b class="c-val">0</b><span class="c-unit">${u}</span></span></div>`).join('')}
      </div>
    </header>
    <nav class="dock glass" aria-label="${UI.menu}">
      <button class="dock-toggle" data-a="toggle" aria-label="${UI.menu}">${svg('menu')}</button>
      ${[['home', 'home'], ['top', 'top'], ['tour', 'tour'], ['process', 'process'], ['buildings', 'buildings'], ['vehicles', 'vehicles'], ['robots', 'robots'], ['guide', 'guide'], ['explode', 'explode'], ['features', 'features'],
        ['labels', 'labels'], ['roof', 'roof'], ['time', 'time'], ['quality', 'quality'], ['reset', 'reset']]
        .map(([a, ic]) => `<button class="dock-btn${a === 'tour' ? ' accent' : ''}" data-a="${a}">${svg(ic)}<span>${a === 'time' ? timeLabel('day') : UI.dock[a]}</span></button>`).join('')}
    </nav>
    <aside class="card glass" hidden></aside>
    <section class="list glass" hidden>
      <div class="list-head"><h3></h3><button class="icon-btn" data-a="list-close" aria-label="${UI.card.close}">${svg('close')}</button></div>
      <label class="search">${svg('search')}<input type="search" placeholder="${UI.search}" autocomplete="off"/></label>
      <div class="list-items"></div>
    </section>
    <div class="popover glass quality-pop" hidden>
      <h4>${UI.quality.title}</h4>
      ${['low', 'mid', 'high'].map((q) => `<button data-q="${q}">${UI.quality[q]}</button>`).join('')}
    </div>
    <footer class="bottombar">
      <div class="ticker glass"><div class="ticker-track">${tickerHTML()}${tickerHTML()}</div></div>
      <div class="timeline glass">${STAGES.map((s) => `<button class="stage" data-n="${s.n}" title="${esc(s.name)}"><b>${s.n}</b><span>${esc(s.name)}</span></button>`).join('')}</div>
    </footer>
    <section class="features glass" hidden>
      <div class="list-head"><h3>${esc(FEATURES_TITLE)}</h3><button class="icon-btn" data-a="features-close" aria-label="${UI.card.close}">${svg('close')}</button></div>
      <div class="features-grid">${FEATURES.map(([t, d], i) => `<div class="feat"><b class="n">${i + 1}</b><div><h4>${esc(t.replace(/\.$/, ''))}</h4><p>${esc(d)}</p></div></div>`).join('')}</div>
      <button class="wide-btn" data-a="features-led">${svg('screen')}<span>${UI.featuresLed}</span></button>
    </section>
    <div class="toast glass" hidden></div>`;

  function timeLabel(mode) {
    return ['day', 'sunset', 'night'].map((m) => `<i class="${m === mode ? 'on' : ''}">${UI.time[m]}</i>`).join(' / ');
  }
  function tickerHTML() {
    return FEATURES.map(([t, d], i) => `<span class="tick"><b>${i + 1}. ${esc(t)}</b> ${esc(d)}</span>`).join('');
  }
  const $ = (sel) => root.querySelector(sel);
  const card = $('.card'), list = $('.list'), pop = $('.quality-pop'), toastEl = $('.toast'), feats = $('.features');
  const dock = $('.dock');

  /* ---------- Toast ---------- */
  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add('on');
    toastT = 3.2;
  }

  /* ---------- Selection & info card ---------- */
  let sel = null, liveT = 0;
  const vehicleName = (v) => {
    const info = VEHICLE_INFO[v.name] || { name: v.name };
    const list = world.traffic.vehicles.filter((x) => x.name === v.name);
    return list.length > 1 ? `${info.name} №${list.indexOf(v) + 1}` : info.name;
  };
  const robotName = (p) => {
    const r = ROBOT_ROLES[p.role] || ROBOT_ROLES.worker;
    const same = world.robots.humans.list.filter((x) => x.role === p.role);
    return same.length > 1 ? `${r.name} №${same.indexOf(p) + 1}` : r.name;
  };
  const boxOfObj = (obj, extra) => () => { const b = new THREE.Box3().setFromObject(obj); if (extra) b.expandByObject(extra); return b; };
  const boxAround = (p, w = 0.9, h = 1.95) => () => new THREE.Box3(new THREE.Vector3(p.x - w / 2, p.y, p.z - w / 2), new THREE.Vector3(p.x + w / 2, p.y + h, p.z + w / 2));

  function select(e, { openRoof = false, stage = null } = {}) {
    if (e && world.tour?.active) world.tour.exit();
    sel = e;
    list.hidden = true;
    if (!e) { card.hidden = true; cameraman.highlight(null); cameraman.setFollow(null); setActiveStage(null); refreshRoofBtn(); return; }
    if (e.kind === 'building') {
      const b = e.ref;
      cameraman.setFollow(null);
      cameraman.highlight(() => b.box);
      cameraman.frameBox(b.box, openRoof ? { closer: 1.05, pitch: 0.78 } : {});
      if (openRoof && b.roof && !b.isOpen) b.setRoof(true);
    } else if (e.kind === 'vehicle') {
      const v = e.ref;
      const getBox = boxOfObj(v.model, v.trailer);
      cameraman.highlight(getBox);
      cameraman.frameBox(getBox(), { closer: 1.6 });
      cameraman.setFollow(() => v.pos, 2);
    } else if (e.kind === 'robot') {
      const p = e.ref;
      cameraman.highlight(boxAround(p.pos));
      cameraman.frameBox(boxAround(p.pos)(), { closer: 2.6 });
      cameraman.setFollow(() => p.pos, 1.2);
    } else if (e.kind === 'drone') {
      const d = e.ref;
      cameraman.highlight(boxOfObj(d));
      cameraman.frameBox(new THREE.Box3().setFromObject(d), { closer: 4 });
      cameraman.setFollow(() => d.position, 0);
    } else if (e.kind === 'amr') {
      const a = e.ref.a;
      cameraman.highlight(boxOfObj(a));
      cameraman.frameBox(new THREE.Box3().setFromObject(a), { closer: 3 });
      cameraman.setFollow(() => a.position, 0.5);
    }
    renderCard(stage);
    setActiveStage(stage ?? (e.kind === 'building' ? stageOf[e.ref.id]?.n : null));
    refreshRoofBtn();
  }

  function pills(a, b) {
    return `<div class="io"><span class="pill">${esc(a)}</span><span class="arrow">→</span><span class="pill out">${esc(b)}</span></div>`;
  }

  function renderCard(stageN = null) {
    const e = sel;
    let html = '';
    if (e.kind === 'building') {
      const b = e.ref, id = b.id, info = BUILDING_INFO[id] || {};
      const st = stageN ? STAGES[stageN - 1] : stageOf[id];
      html = `
        <div class="card-head">
          <div class="tags"><span class="tag">${UI.card.type.building}</span>${st ? `<span class="tag gold">${st.n}-${UI.card.stage}</span>` : ''}</div>
          <button class="icon-btn" data-a="card-close" aria-label="${UI.card.close}">${svg('close')}</button>
        </div>
        <h2>${esc(nameOf[id] || id)}</h2>
        ${st ? `<div class="sec now"><h5>${UI.card.what}</h5><p>${esc(st.what)}</p></div>` : ''}
        <div class="sec"><h5>${UI.card.fn}</h5><p>${esc(info.fn || '')}</p></div>
        <div class="sec"><h5>${UI.card.role}</h5><p>${esc(info.role || '')}</p></div>
        <div class="sec"><h5>${UI.card.io}</h5>${pills(info.in || '—', info.out || '—')}</div>
        <div class="stats"><div><span>🤖 ${UI.card.robots}</span><b>${info.robots ?? 0}</b></div><div><span>⚡ ${UI.card.energy}</span><b>${esc(info.energy || '—')}</b></div></div>
        ${info.fact ? `<div class="fact">💡 <b>${UI.card.fact}:</b> ${esc(info.fact)}</div>` : ''}
        ${b.roof ? `<button class="wide-btn" data-a="card-roof">${svg('roof')}<span>${b.isOpen ? UI.dock.roofClose : UI.dock.roof}</span></button>` : ''}
        ${world.explode?.canExplode(b) ? `<button class="wide-btn alt" data-a="card-explode">${svg('explode')}<span>${UI.explodeBtn}</span></button>` : ''}`;
    } else if (e.kind === 'vehicle') {
      const v = e.ref, info = VEHICLE_INFO[v.name] || {};
      html = `
        <div class="card-head"><div class="tags"><span class="tag">${UI.card.type.vehicle}</span><span class="tag teal">${UI.vehicleTag}</span></div>
          <button class="icon-btn" data-a="card-close" aria-label="${UI.card.close}">${svg('close')}</button></div>
        <h2>${esc(vehicleName(v))}</h2>
        <div class="sec"><h5>${UI.card.fn}</h5><p>${esc(info.fn || '')}</p></div>
        <div class="stats"><div><span>${UI.card.speed}</span><b class="live-speed">0 ${UI.card.kmh}</b></div><div><span>${UI.card.status}</span><b class="live-status">—</b></div></div>
        <button class="wide-btn" data-a="card-follow">${svg('vehicles')}<span>${cameraman.following ? UI.card.stopFollow : UI.card.follow}</span></button>`;
    } else {
      const role = e.kind === 'robot' ? e.ref.role : e.kind;
      const r = ROBOT_ROLES[role] || ROBOT_ROLES.worker;
      const title = e.kind === 'robot' ? robotName(e.ref) : r.name;
      html = `
        <div class="card-head"><div class="tags"><span class="tag">${UI.card.type.robot}</span></div>
          <button class="icon-btn" data-a="card-close" aria-label="${UI.card.close}">${svg('close')}</button></div>
        <h2>${esc(title)}</h2>
        <div class="sec"><h5>${UI.card.fn}</h5><p>${esc(r.fn)}</p></div>
        <div class="stats"><div><span>${UI.card.status}</span><b class="live-status">—</b></div></div>
        <button class="wide-btn" data-a="card-follow">${svg('robots')}<span>${cameraman.following ? UI.card.stopFollow : UI.card.follow}</span></button>`;
    }
    card.innerHTML = html;
    card.hidden = false;
    card.classList.remove('in');
    void card.offsetWidth;
    card.classList.add('in');
    liveT = 0;
  }

  function liveUpdate() {
    if (!sel || card.hidden) return;
    const sp = card.querySelector('.live-speed'), st = card.querySelector('.live-status');
    if (sel.kind === 'vehicle') {
      if (sp) sp.textContent = `${fmt(sel.ref.v * 3.6)} ${UI.card.kmh}`;
      if (st) st.textContent = sel.ref.wait > 0 ? UI.card.atStop : UI.card.onRoad;
    } else if (st) {
      const moving = sel.kind === 'robot' ? !!sel.ref.path : true;
      st.textContent = moving ? UI.card.moving : UI.card.working;
    }
  }

  /* ---------- Lists ---------- */
  let listKind = null;
  function openList(kind) {
    listKind = kind;
    list.hidden = false;
    card.hidden = true;
    pop.hidden = true;
    list.querySelector('h3').textContent = UI.lists[kind];
    const input = list.querySelector('input');
    input.value = '';
    fillList('');
    if (!matchMedia('(pointer: coarse)').matches) input.focus();
  }
  function entries(kind) {
    if (kind === 'buildings') return BUILDINGS.filter((b) => world.site.list.has(b.id)).map((b) => ({ t: b.name, s: BUILDING_INFO[b.id]?.fn || '', go: () => select({ kind: 'building', ref: world.site.list.get(b.id) }) }));
    if (kind === 'vehicles') return world.traffic.vehicles.map((v) => ({ t: vehicleName(v), s: VEHICLE_INFO[v.name]?.fn || '', go: () => select({ kind: 'vehicle', ref: v }) }));
    if (kind === 'robots') {
      return [
        ...world.robots.humans.list.map((p) => ({ t: robotName(p), s: ROBOT_ROLES[p.role]?.fn || '', go: () => select({ kind: 'robot', ref: p }) })),
        ...world.robots.drones.map((d, i) => ({ t: `${ROBOT_ROLES.drone.name} №${i + 1}`, s: ROBOT_ROLES.drone.fn, go: () => select({ kind: 'drone', ref: d }) })),
        ...world.robots.amrs.map((a, i) => ({ t: `${ROBOT_ROLES.amr.name} №${i + 1}`, s: ROBOT_ROLES.amr.fn, go: () => select({ kind: 'amr', ref: a }) })),
      ];
    }
    // Choosing a stage starts (or jumps) the 360° tour there.
    return STAGES.map((s) => ({ t: `${s.n}. ${s.name}`, s: s.what, go: () => { list.hidden = true; world.tour ? world.tour.jump(s.n) : goStage(s.n); } }));
  }
  function fillList(q) {
    const items = entries(listKind).filter((e) => !q || (e.t + ' ' + e.s).toLowerCase().includes(q.toLowerCase()));
    const box = list.querySelector('.list-items');
    box.innerHTML = items.length ? items.map((e, i) => `<button class="item" data-i="${i}"><b>${esc(e.t)}</b><small>${esc(e.s)}</small></button>`).join('') : `<p class="empty">${UI.empty}</p>`;
    box.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => items[+el.dataset.i].go()));
  }
  list.querySelector('input').addEventListener('input', (ev) => fillList(ev.target.value.trim()));

  /* ---------- Stages / timeline ---------- */
  let activeStage = null;
  function setActiveStage(n) {
    activeStage = n;
    root.querySelectorAll('.stage').forEach((el) => el.classList.toggle('on', +el.dataset.n === n));
    if (n) root.querySelector(`.stage[data-n="${n}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  function goStage(n) {
    if (world.tour?.active) { list.hidden = true; world.tour.jump(n); return; }
    const st = STAGES[n - 1];
    const b = world.site.list.get(st.building);
    if (b) select({ kind: 'building', ref: b }, { openRoof: true, stage: n });
  }

  /* ---------- Roofs ---------- */
  const productionRoofs = () => STAGES.map((s) => world.site.list.get(s.building)).filter((b) => b?.roof);
  function refreshRoofBtn() {
    const btn = dock.querySelector('[data-a="roof"] span');
    const open = sel?.kind === 'building' && sel.ref.roof ? sel.ref.isOpen : productionRoofs().every((b) => b.isOpen);
    btn.textContent = open ? UI.dock.roofClose : UI.dock.roof;
  }
  function toggleRoof() {
    if (sel?.kind === 'building' && sel.ref.roof) {
      sel.ref.setRoof(!sel.ref.isOpen);
      renderCard(activeStage);
    } else {
      const roofs = productionRoofs();
      const open = !roofs.every((b) => b.isOpen);
      for (const b of roofs) b.setRoof(open);
    }
    refreshRoofBtn();
  }

  /* ---------- Dock actions ---------- */
  const actions = {
    toggle: () => dock.classList.toggle('open'),
    home: () => { world.tour?.exit(); select(null); cameraman.view('home'); },
    top: () => { world.tour?.exit(); select(null); cameraman.view('top'); },
    tour: () => { if (!world.tour) { toast(UI.tourSoon); goStage(1); } else if (world.tour.active) world.tour.resume(); else world.tour.start(1); },
    process: () => openList('process'),
    buildings: () => openList('buildings'),
    vehicles: () => openList('vehicles'),
    robots: () => openList('robots'),
    labels: () => { labels.set(!labels.enabled); dock.querySelector('[data-a="labels"]').classList.toggle('on', labels.enabled); },
    roof: toggleRoof,
    time: () => tod.cycle(),
    quality: () => { pop.hidden = !pop.hidden; list.hidden = true; markQuality(); },
    features: () => { feats.hidden = !feats.hidden; list.hidden = pop.hidden = true; },
    guide: () => { select(null); list.hidden = true; world.guide?.start(); },
    explode: () => { list.hidden = pop.hidden = true; if (sel?.kind === 'building' && world.explode?.canExplode(sel.ref)) { const b = sel.ref; select(null); world.explode.explodeBuilding(b); } else world.explode?.togglePop(); },
    reset: () => { world.tour?.exit(); select(null); cameraman.flyTo(GATE_VIEW.clone(), GATE_TARGET.clone(), 2); },
  };
  dock.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    actions[btn.dataset.a]?.();
    if (btn.dataset.a !== 'toggle' && matchMedia('(max-width: 760px)').matches) dock.classList.remove('open');
  });
  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (a === 'card-close') select(null);
    if (a === 'list-close') list.hidden = true;
    if (a === 'features-close') feats.hidden = true;
    if (a === 'features-led' && world.showroom) {
      feats.hidden = true;
      world.tour?.exit();
      select(null);
      cameraman.flyTo(world.showroom.view.pos.clone(), world.showroom.view.target.clone(), 2.6);
    }
    if (a === 'card-roof') toggleRoof();
    if (a === 'card-explode' && sel?.kind === 'building') { const b = sel.ref; select(null); world.explode.explodeBuilding(b); }
    if (a === 'card-follow' && sel) {
      if (cameraman.following) cameraman.setFollow(null);
      else select(sel);
      const sp = card.querySelector('[data-a="card-follow"] span');
      if (sp) sp.textContent = cameraman.following ? UI.card.stopFollow : UI.card.follow;
    }
    const st = ev.target.closest('.timeline .stage');
    if (st) goStage(+st.dataset.n);
  });
  pop.addEventListener('click', (ev) => {
    const q = ev.target.closest('[data-q]')?.dataset.q;
    if (q) { quality.set(q); markQuality(); pop.hidden = true; }
  });
  const markQuality = () => pop.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === quality.level));
  quality.onChange(markQuality);
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { select(null); list.hidden = true; pop.hidden = true; feats.hidden = true; } });

  tod.onChange((mode, night) => {
    dock.querySelector('[data-a="time"] span').innerHTML = timeLabel(mode);
    document.body.classList.toggle('night', night > 0.5);
  });

  /* ---------- Labels ---------- */
  for (const b of world.site.list.values()) {
    const c = b.center.clone();
    c.y = b.box.max.y + 2;
    labels.add(nameOf[b.id] || b.id, () => c, 'building');
  }
  for (const v of world.traffic?.vehicles || []) {
    const top = new THREE.Vector3();
    labels.add(vehicleName(v), () => (v.hidden > 0 ? null : top.set(v.pos.x, v.pos.y + 5.5, v.pos.z)), 'vehicle');
  }

  /* ---------- Counters ---------- */
  const counters = {};
  root.querySelectorAll('.counter').forEach((el) => { counters[el.dataset.k] = { el: el.querySelector('.c-val'), shown: 0 }; });
  // Live counters read from the economy engine (sim/economy.js): today's totals.
  let elapsed = 0;
  function targets() {
    const d = economy.today;
    return {
      sun: [economy.solarMW(), 1],
      cotton: [d.raw, 1],
      goods: [d.garments, 0],
      co2: [d.co2, 1],
      robots: [economy.activeRobots(), 0],
    };
  }
  // Panels below the top bar follow its real height (it wraps onto two rows on narrow screens).
  const topbar = root.querySelector('.topbar');
  new ResizeObserver(() => document.documentElement.style.setProperty('--top-b', `${Math.round(topbar.getBoundingClientRect().bottom)}px`)).observe(topbar);

  /** Connect the 360° tour (created after the interface). */
  function bindTour(tour) {
    tour.onStage((n) => setActiveStage(n));
    tour.onState((on) => {
      if (on) { select(null); list.hidden = true; pop.hidden = true; feats.hidden = true; }
      else { setActiveStage(null); refreshRoofBtn(); }
      dock.querySelector('[data-a="tour"]').classList.toggle('live', on);
    });
  }

  return {
    select,
    bindTour,
    goStage,
    setActiveStage,
    toast,
    onTap(x, y) {
      if (world.tour?.active || world.guide?.active) return; // touching the view only pauses the tour / guide
      if (world.explode?.active) { world.explode.onTap(x, y); return; }
      if (!pop.hidden) { pop.hidden = true; return; }
      const hit = cameraman.pick(x, y);
      if (hit) select({ kind: hit.kind, ref: hit.ref });
      else if (sel) select(null);
    },
    update(dt) {
      elapsed += dt;
      for (const [k, [v, d]] of Object.entries(economy ? targets() : {})) {
        const c = counters[k];
        c.shown += (v - c.shown) * Math.min(1, dt * 2.5);
        if (Math.abs(v - c.shown) < 0.05) c.shown = v;
        const txt = fmt(c.shown, d);
        if (c.el.textContent !== txt) c.el.textContent = txt;
      }
      liveT -= dt;
      if (liveT <= 0) { liveT = 0.25; liveUpdate(); }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
    },
  };
}
