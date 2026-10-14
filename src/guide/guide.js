// «Маржан» guide tour: the robot flies above the roofs (Catmull-Rom) to 18 points of interest; the
// camera chases it, then orbits 360° while Маржан faces the viewer, gestures and talks (typewriter,
// optional kk voice). Highlight + label on each object; ◀ ⏸ ▶ ✕ controls; works at any sim speed.
import * as THREE from 'three';
import './guide.css';
import { GUIDE as G } from './texts.js';
import { makeMarzhan } from './marzhan.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
// t = look target, r = object radius (Маржан hovers r + 4 m out), cr / ch = camera orbit radius / height,
// mh = Маржан height above the target, near = hover this far in front of the camera (aerial stops).
const STOPS = [
  { t: V(0, 0, -40), cr: 470, ch: 230, near: 15 },
  { t: V(0, 10, 252), r: 12, cr: 42, ch: 10, mh: 1 },
  { t: V(0, 3, 224), r: 7, cr: 30, ch: 8, mh: 2 },
  { t: V(7, 4, 259), r: 6, cr: 26, ch: 6, mh: 2 },
  { t: V(0, 7, 95), r: 9, cr: 42, ch: 10, mh: 1 },
  { t: V(-90, 12, 70), r: 26, cr: 78, ch: 20, mh: 2 },
  { t: V(-490, 2, -400), r: 40, cr: 160, ch: 60, mh: 14 },
  { t: V(-175, 6, -45), r: 28, cr: 74, ch: 20, mh: 3 },
  { t: V(-470, 2, 0), r: 8, cr: 36, ch: 12, mh: 4, follow: 'harvester' },
  { t: V(-245, 7, -125), r: 30, cr: 78, ch: 24, mh: 4 },
  { t: V(-140, 8, -125), r: 42, cr: 105, ch: 34, mh: 5 },
  { t: V(105, 12, -205), r: 30, cr: 84, ch: 26, mh: 6 },
  { t: V(175, 8, -110), r: 48, cr: 120, ch: 40, mh: 6 },
  { t: V(-35, 6, -45), r: 24, cr: 62, ch: 18, mh: 3 },
  { t: V(-245, 6, -45), r: 28, cr: 72, ch: 20, mh: 3 },
  { t: V(70, 10, -45), r: 42, cr: 104, ch: 30, mh: 4 },
  { t: V(245, 6, -205), r: 26, cr: 72, ch: 22, mh: 3 },
  { t: V(0, 0, -40), cr: 560, ch: 280, near: 15 },
];
const FACE = `<svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="17" fill="#fbfcfc"/><rect x="12" y="17" width="24" height="15" rx="7.5" fill="#0b2226"/>
  <circle cx="19" cy="24.5" r="2.6" fill="#5ff5df"/><circle cx="29" cy="24.5" r="2.6" fill="#5ff5df"/><path d="M20.5 28.5q3.5 2.4 7 0" stroke="#5ff5df" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="38" r="3" fill="#f5c04a"/><circle cx="12" cy="9" r="2.2" fill="#f5c04a"/><circle cx="36" cy="9" r="2.2" fill="#f5c04a"/><path d="M13 10l3 6M35 10l-3 6" stroke="#fbfcfc" stroke-width="1.6"/></svg>`;
const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = { prev: ico('<path d="M15 6l-6 6 6 6"/>'), next: ico('<path d="M9 6l6 6-6 6"/>'), pause: ico('<path d="M9 5v14M15 5v14"/>'), play: ico('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'), end: ico('<path d="M6 6l12 12M18 6L6 18"/>') };

export function createGuide({ scene, camera, controls, world, cameraman, tod, root }) {
  const bot = makeMarzhan();
  bot.scale.setScalar(1.7);
  bot.visible = false;
  scene.add(bot);

  /* ---------- Dialogue panel ---------- */
  const panel = document.createElement('section');
  panel.className = 'guide glass';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="g-av">${FACE}</div>
    <div class="g-body">
      <div class="g-top"><b>${G.name}</b><span class="g-role">${G.role}</span><span class="g-step"></span></div>
      <h4 class="g-title"></h4>
      <p class="g-text"></p>
      <div class="g-bar"><i></i></div>
    </div>
    <div class="g-ctrl">
      <button data-g="prev" aria-label="${G.prev}">${I.prev}<span>${G.prev}</span></button>
      <button data-g="play" class="main" aria-label="${G.pause}">${I.pause}</button>
      <button data-g="next" aria-label="${G.next}"><span>${G.next}</span>${I.next}</button>
      <button data-g="end" class="end" aria-label="${G.end}">${I.end}<span>${G.end}</span></button>
    </div>`;
  const label = document.createElement('div');
  label.className = 'guide-label';
  label.hidden = true;
  root.append(panel, label);
  const $ = (s) => panel.querySelector(s);
  panel.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-g]')?.dataset.g;
    if (a === 'play') (playing ? pause : resume)();
    if (a === 'prev') go(Math.max(0, idx - 1));
    if (a === 'next') { if (idx < STOPS.length - 1) go(idx + 1); else exit(); }
    if (a === 'end') exit();
  });

  /* ---------- State ---------- */
  let active = false, playing = false, idx = 0, phase = 'fly', t = 0, dur = 6, typed = 0, flight = null, a0 = 0;
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const look = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let blend = null, voice = null;
  const pickVoice = () => { voice = window.speechSynthesis?.getVoices().find((v) => v.lang?.toLowerCase().startsWith('kk')) || null; };
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

  const target = (s) => (s.follow === 'harvester' && world.fields?.harvester ? world.fields.harvester.position.clone().setY(3) : s.t.clone());
  /** Where Маржан hovers for a stop, seen from camera angle `a`. */
  function hover(s, a, out) {
    const T = target(s);
    if (s.near) {
      orbitCam(s, a, tmp2);
      return out.copy(tmp2).lerp(T, s.near / tmp2.distanceTo(T)).add(V(0, -3, 0));
    }
    return out.set(T.x + Math.sin(a) * (s.r + 4), T.y + s.mh, T.z + Math.cos(a) * (s.r + 4));
  }
  function orbitCam(s, a, out) {
    const T = target(s);
    return out.set(T.x + Math.sin(a) * s.cr, T.y + s.ch, T.z + Math.cos(a) * s.cr);
  }

  function go(i) {
    idx = i;
    const s = STOPS[i];
    const from = bot.position.clone();
    const T = target(s);
    // Arrive from the side Маржан comes from, so the flight ends facing the object.
    a0 = Math.atan2(from.x - T.x, from.z - T.z);
    if (s.near) a0 = Math.atan2(camera.position.x - T.x, camera.position.z - T.z);
    const end = hover(s, a0, new THREE.Vector3());
    const cruise = Math.max(58, from.y + 10, end.y + 22);
    const mid = from.clone().lerp(end, 0.5).setY(cruise + 10);
    const pts = from.distanceTo(end) < 20 ? [from, end] : [from, from.clone().setY(cruise), mid, end.clone().setY(cruise), end];
    flight = { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), dur: 0 };
    flight.dur = THREE.MathUtils.clamp(flight.curve.getLength() / 30, 2.5, 8);
    phase = 'fly';
    t = 0;
    typed = 0;
    cameraman.highlight(null);
    label.hidden = true;
    $('.g-step').textContent = `${i + 1} / ${STOPS.length}`;
    $('.g-title').textContent = G.stops[i][0];
    $('.g-text').textContent = G.flying;
    $('.g-bar i').style.transform = `scaleX(${(i / (STOPS.length - 1)).toFixed(3)})`;
    if (!playing) resume();
  }

  function arrive() {
    const s = STOPS[idx];
    phase = 'talk';
    t = 0;
    const text = G.stops[idx][1];
    dur = THREE.MathUtils.clamp(3 + text.length * 0.045, 6, 9) + text.length / 55; // typing + reading
    const T = target(s), R = s.r ? s.r * 1.3 : 0;
    if (R) cameraman.highlight(() => { const c = target(s); return new THREE.Box3(c.clone().add(V(-R, -c.y, -R)), c.clone().add(V(R, Math.max(4, c.y * 1.6), R))); });
    label.textContent = G.stops[idx][0];
    label.hidden = !R;
    if (voice && window.speechSynthesis) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      speechSynthesis.speak(u);
    }
    void T;
  }

  /* ---------- Public ---------- */
  function start() {
    world.tour?.exit();
    active = true;
    cameraman.stop();
    cameraman.highlight(null);
    cam.pos.copy(camera.position);
    cam.look.copy(controls.target);
    // Маржан appears just in front of the camera.
    bot.position.copy(camera.position).lerp(controls.target, 0.06).add(V(0, -2, 0));
    bot.visible = true;
    panel.hidden = false;
    document.body.classList.add('guiding');
    playing = true;
    refresh();
    go(0);
  }
  function pause() {
    if (!active || !playing) return;
    playing = false;
    controls.target.copy(look);
    refresh();
  }
  function resume() {
    if (!active) return;
    if (!playing) blend = { pos: camera.position.clone(), look: controls.target.clone(), t: 0 };
    playing = true;
    refresh();
  }
  function exit() {
    if (!active) return;
    active = playing = false;
    bot.visible = false;
    panel.hidden = label.hidden = true;
    cameraman.highlight(null);
    controls.target.copy(look);
    document.body.classList.remove('guiding');
    window.speechSynthesis?.cancel();
  }
  function refresh() {
    $('[data-g="play"]').innerHTML = playing ? I.pause : I.play;
    $('[data-g="play"]').setAttribute('aria-label', playing ? G.pause : G.resume);
    panel.classList.toggle('paused', !playing);
  }
  controls.addEventListener('start', () => { if (active && playing) pause(); });

  const fwd = new THREE.Vector3(), prevPos = new THREE.Vector3(), lab = new THREE.Vector3();
  return {
    get active() { return active; },
    get playing() { return playing; },
    get stop() { return idx + 1; },
    start, pause, resume, exit, go,
    update(dt) {
      if (!active) return;
      const s = STOPS[idx];
      const light = (tod?.night ?? 0) > 0.5;
      let gesture = 0, talking = false;
      prevPos.copy(bot.position);
      if (playing) t += dt;
      if (phase === 'fly') {
        const u = ease(Math.min(1, t / flight.dur));
        flight.curve.getPointAt(u, bot.position);
        if (t >= flight.dur) arrive();
        // Chase camera: behind and above Маржан, looking ahead along the flight.
        fwd.subVectors(bot.position, prevPos).setY(0);
        if (fwd.lengthSq() > 1e-6) fwd.normalize(); else fwd.set(Math.sin(a0 + Math.PI), 0, Math.cos(a0 + Math.PI));
        tmp.copy(bot.position).addScaledVector(fwd, -15).add(V(0, 5.5, 0));
        const k = 1 - Math.exp(-dt * 3);
        if (playing) { cam.pos.lerp(tmp, k); cam.look.lerp(tmp2.copy(bot.position).addScaledVector(fwd, 8), k); }
      } else {
        // 360° orbit around the object; Маржан hovers on the camera side, faces it and gestures.
        const u = Math.min(1, t / dur);
        const a = a0 + smooth(u) * Math.PI * 2;
        orbitCam(s, a, tmp);
        const T = target(s);
        const k = 1 - Math.exp(-dt * 2.5);
        if (playing) { cam.pos.lerp(tmp, k); cam.look.lerp(tmp2.copy(T).lerp(bot.position, s.near ? 0.25 : 0.3), k); }
        hover(s, a + (s.near ? 0 : 0.16), tmp2);
        bot.position.lerp(tmp2.add(V(0, Math.sin(t * 2.2) * 0.25, 0)), 1 - Math.exp(-dt * 2));
        talking = typed < 1;
        gesture = Math.min(1, t / 0.6) * (1 - smooth(Math.min(1, Math.max(0, (t - 3) / 1.5))));
        const text = G.stops[idx][1];
        if (playing && typed < 1) {
          typed = Math.min(1, typed + dt / Math.max(1.5, text.length / 55));
          $('.g-text').textContent = text.slice(0, Math.ceil(text.length * typed));
        }
        if (playing && t >= dur) { if (idx < STOPS.length - 1) go(idx + 1); else pause(); }
        // Label above the object.
        if (!label.hidden) {
          lab.copy(T).setY(T.y * 2 + 6).project(camera);
          label.style.transform = `translate(${((lab.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-lab.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
          label.style.opacity = lab.z < 1 ? '1' : '0';
        }
      }
      // Маржан faces where it flies, or turns to the camera while talking.
      fwd.subVectors(phase === 'fly' ? bot.position.clone().add(bot.position).sub(prevPos) : camera.position, bot.position).setY(0);
      if (fwd.lengthSq() > 1e-6) {
        const yaw = Math.atan2(fwd.x, fwd.z);
        let d = yaw - bot.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        bot.rotation.y += d * Math.min(1, dt * 5);
      }
      bot.rotation.z = phase === 'fly' ? Math.sin(t * 1.4) * 0.08 : 0;
      bot.userData.update(dt, { talking, gesture, light, speed: prevPos.distanceTo(bot.position) / Math.max(dt, 1e-3) });
      if (!playing) return;
      if (blend) {
        blend.t += dt;
        const b = smooth(Math.min(1, blend.t / 1.4));
        camera.position.lerpVectors(blend.pos, cam.pos, b);
        look.lerpVectors(blend.look, cam.look, b);
        if (b >= 1) blend = null;
      } else {
        camera.position.copy(cam.pos);
        look.copy(cam.look);
      }
      camera.lookAt(look);
      controls.target.copy(look);
    },
  };
}
