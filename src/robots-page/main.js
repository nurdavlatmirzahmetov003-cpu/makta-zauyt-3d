// «🤖 Роботтар әлемі» — a bright studio: glossy turntable, 360° orbit, carousel of 12 robots, info panel
// with specs and battery, tap-to-learn hotspots, chat + commands, joystick control.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import '../style.css';
import '../ui.css';
import './page.css';
import { fontsReady } from '../fonts.js';
import { PALETTE } from '../data.js';
import { ROBOTS, SPEC_LABELS } from './roster.js';
import { createAnimator } from './animator.js';
import { COMMAND_CHIPS, detectCommand, replyFor } from './robot-chat.js';
import { createJoystick } from '../ui/joystick.js';
import { RP } from './texts.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const canvas = document.getElementById('rc');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 2.4, 8.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.1, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9;
controls.minDistance = 3;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI * 0.49;
controls.enablePan = false;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.addEventListener('start', () => { controls.autoRotate = false; });

/* ---------- Studio: lights, glossy turntable, glowing ring, contact shadow ---------- */
scene.add(new THREE.HemisphereLight('#eefaff', '#cfe9e3', 1.0));
const key = new THREE.DirectionalLight('#ffffff', 2.3);
key.position.set(4, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -6;
key.shadow.camera.right = key.shadow.camera.top = 6;
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(PALETTE.teal, 0.9);
rim.position.set(-5, 4, -6);
scene.add(rim);
const table = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.35, 0.32, 96),
  new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }));
table.position.y = -0.16;
table.receiveShadow = true;
scene.add(table);
const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.teal, toneMapped: false });
const ring = new THREE.Mesh(new THREE.TorusGeometry(3.22, 0.035, 8, 160).rotateX(Math.PI / 2), ringMat);
ring.position.y = 0.01;
scene.add(ring);
const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(3.1, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.22 }));
shadowCatcher.position.y = 0.002;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);
const flashMat = new THREE.MeshBasicMaterial({ color: '#9ffcef', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
const flash = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 96).rotateX(Math.PI / 2), flashMat);
flash.position.y = 0.05;
scene.add(flash);

/* ---------- Robots (built once, one visible at a time) ---------- */
const robots = ROBOTS.map((r) => {
  const model = r.build();
  // Measure only solid parts (light cones and glows would inflate the box).
  const box = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((o) => { if (o.isMesh && !o.material.transparent) box.expandByObject(o, false); });
  const h = box.max.y - box.min.y || 1;
  model.scale.multiplyScalar(r.fit / h);
  model.position.y = -box.min.y * (r.fit / h);
  model.traverse((o) => { if (o.isMesh) o.castShadow = !o.material.transparent; });
  const root = new THREE.Group();
  root.add(model);
  const holder = new THREE.Group();
  holder.add(root);
  holder.visible = false;
  scene.add(holder);
  const anim = createAnimator(root, model.userData.rig, { onAccent: (c) => ringMat.color.set(c) });
  return { ...r, model, root, holder, anim, scale: r.fit / h };
});
let cur = -1, prev = null, swapT = 1;

/* ---------- DOM ---------- */
const ui = document.getElementById('rp-ui');
ui.innerHTML = `
  <header class="rp-top">
    <a class="rp-back glass" href="./">${RP.back}</a>
    <h1 class="rp-title glass">${RP.title}</h1>
    <div class="rp-tools"><button class="rp-btn glass" data-r="chat">${RP.chat}</button><button class="rp-btn glass" data-r="control">${RP.control}</button></div>
  </header>
  <aside class="rp-info glass"></aside>
  <section class="rp-chat glass" hidden>
    <div class="rc-head"><b></b><button class="icon-btn" data-r="chat-close" aria-label="✕">✕</button></div>
    <div class="rc-log"></div>
    <div class="rc-chips">${COMMAND_CHIPS.map((c) => `<button class="chip">${c}</button>`).join('')}</div>
    <form class="rc-form"><input type="text" placeholder="${RP.placeholder}" autocomplete="off"/><button type="button" class="icon-btn rc-mic" hidden aria-label="${RP.mic}">🎤</button><button type="submit" class="icon-btn rc-send" aria-label="${RP.send}">➤</button></form>
  </section>
  <div class="rp-actions glass" hidden>${[['wave', '👋'], ['dance', '💃'], ['jump', '⤴️'], ['light', '💡'], ['work', '🛠️']].map(([a, e]) => `<button data-act="${a}" aria-label="${RP.actions[a]}">${e}</button>`).join('')}</div>
  <nav class="rp-carousel glass"></nav>
  <div class="hs-layer"></div>
  <div class="hs-call glass" hidden></div>`;
const $ = (s) => ui.querySelector(s);
const info = $('.rp-info'), chat = $('.rp-chat'), log = $('.rc-log'), car = $('.rp-carousel'), hsLayer = $('.hs-layer'), call = $('.hs-call');
const joy = createJoystick(document.body);
joy.visible = false;
let manual = false;

function renderInfo(r) {
  const b = r.battery;
  info.innerHTML = `
    <div class="tags"><span class="tag">${r.type}</span></div>
    <h2>${r.name}</h2>
    <div class="sec"><h5>${RP.fn}</h5><p>${r.fn}</p></div>
    <div class="specs">${r.specs.map((v, i) => `<div><span>${SPEC_LABELS[i]}</span><b>${v}</b></div>`).join('')}
      <div class="bat"><span>${RP.battery}</span><b>${b}%</b><em><i style="transform:scaleX(${b / 100})" class="${b < 30 ? 'low' : ''}"></i></em></div></div>
    <button class="wide-btn" data-r="factory">🏭 ${RP.showInFactory}</button>`;
}
function renderCarousel() {
  car.innerHTML = robots.map((r, i) => `<button class="rp-card${i === cur ? ' on' : ''}" data-i="${i}"><img alt="" src="${r.thumb || ''}"/><b>${r.name}</b><small>${r.type}</small></button>`).join('');
}

function show(i) {
  if (i === cur) return;
  prev = cur >= 0 ? robots[cur] : null;
  cur = (i + robots.length) % robots.length;
  const r = robots[cur];
  r.anim.reset();
  r.holder.visible = true;
  r.holder.position.set(0, -2.6, 0);
  swapT = 0;
  controls.autoRotate = true;
  renderInfo(r);
  car.querySelectorAll('.rp-card').forEach((c) => c.classList.toggle('on', +c.dataset.i === cur));
  car.querySelector(`[data-i="${cur}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  $('.rc-head b').textContent = `💬 ${r.name}`;
  log.innerHTML = '';
  buildHotspots(r);
  call.hidden = true;
}

/* ---------- Hotspots ---------- */
let spots = [];
function buildHotspots(r) {
  hsLayer.innerHTML = '';
  spots = r.hotspots.map(([x, y, z, name, text]) => {
    const el = document.createElement('button');
    el.className = 'hs';
    el.setAttribute('aria-label', name);
    hsLayer.appendChild(el);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      call.innerHTML = `<b>${name}</b><p>${text}</p>`;
      call.hidden = false;
      call.dataset.i = spots.findIndex((s) => s.el === el);
    });
    return { el, p: new THREE.Vector3(x, y, z) };
  });
}
const tmp = new THREE.Vector3();
function placeHotspots() {
  const r = robots[cur];
  spots.forEach((s, i) => {
    tmp.copy(s.p);
    r.model.localToWorld(tmp);
    tmp.project(camera);
    const x = (tmp.x * 0.5 + 0.5) * innerWidth, y = (-tmp.y * 0.5 + 0.5) * innerHeight;
    s.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    s.el.style.visibility = swapT >= 1 && tmp.z < 1 ? 'visible' : 'hidden';
    if (!call.hidden && +call.dataset.i === i) call.style.transform = `translate(${Math.min(innerWidth - 280, x + 18).toFixed(0)}px, ${(y - 20).toFixed(0)}px)`;
  });
}

/* ---------- Chat with the robot ---------- */
function bubble(who, text) {
  const m = document.createElement('div');
  m.className = `rc-msg ${who}`;
  m.textContent = text;
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
}
function ask(text) {
  const t = text.trim();
  if (!t) return;
  const r = robots[cur];
  bubble('user', t);
  const id = detectCommand(t);
  let hint = 'ok';
  if (!['intro', 'battery', 'unknown', 'thanks'].includes(id)) hint = r.anim.command(id);
  if (id === 'intro') r.anim.command('wave');
  const text2 = replyFor(r, id, hint, { battery: r.battery, accent: r.anim.accentName });
  setTimeout(() => {
    bubble('bot', text2);
    if (id === 'unknown') {
      const c = document.createElement('div');
      c.className = 'rc-sugg';
      c.innerHTML = ['сәлем', 'би биле', 'айнал', 'жұмыс істе'].map((x) => `<button class="chip">${x}</button>`).join('');
      log.appendChild(c);
      log.scrollTop = log.scrollHeight;
    }
    r.anim.talk(2.5);
    speak(text2);
  }, 350);
}
let voice = null;
const pickVoice = () => { voice = window.speechSynthesis?.getVoices().find((v) => v.lang?.toLowerCase().startsWith('kk')) || null; };
if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
function speak(text) {
  if (!voice) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿⬀-⯿]/gu, ''));
  u.voice = voice;
  u.lang = voice.lang;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $('.rc-mic');
  mic.hidden = false;
  mic.addEventListener('click', () => {
    const rec = new SR();
    rec.lang = 'kk-KZ';
    mic.classList.add('rec');
    rec.onresult = (e) => ask(e.results[0][0].transcript);
    rec.onend = () => mic.classList.remove('rec');
    try { rec.start(); } catch { rec.onend(); }
  });
}

/* ---------- Events ---------- */
ui.addEventListener('click', (ev) => {
  const card = ev.target.closest('.rp-card');
  if (card) show(+card.dataset.i);
  const chip = ev.target.closest('.chip');
  if (chip) ask(chip.textContent);
  const a = ev.target.closest('[data-r]')?.dataset.r;
  if (a === 'chat') { chat.hidden = !chat.hidden; if (!chat.hidden && !log.childElementCount) bubble('bot', robots[cur].personality.intro); }
  if (a === 'chat-close') chat.hidden = true;
  if (a === 'factory') location.href = `./?focus=${robots[cur].factory}`;
  if (a === 'control') {
    manual = !manual;
    joy.visible = manual;
    $('.rp-actions').hidden = !manual;
    ev.target.closest('[data-r]').classList.toggle('on', manual);
    controls.autoRotate = false;
  }
  const act = ev.target.closest('[data-act]')?.dataset.act;
  if (act) {
    const r = robots[cur];
    r.anim.command(act === 'light' ? (r.anim.st.light ? 'lightOff' : 'lightOn') : act);
  }
  if (!ev.target.closest('.hs, .hs-call')) call.hidden = true;
});
$('.rc-form').addEventListener('submit', (ev) => { ev.preventDefault(); const i = $('.rc-form input'); ask(i.value); i.value = ''; });
addEventListener('keydown', (ev) => {
  if (ev.target.closest?.('input')) return;
  if (ev.key === 'PageDown' || (ev.key === ']')) show(cur + 1);
  if (ev.key === 'PageUp' || (ev.key === '[')) show(cur - 1);
});
// Swipe on the carousel is native scroll; a horizontal swipe on the stage switches robots.
let sx = null;
canvas.addEventListener('pointerdown', (e) => { sx = e.clientX; });
canvas.addEventListener('pointerup', (e) => { if (sx != null && !manual && Math.abs(e.clientX - sx) > 160 && e.pointerType === 'touch') show(cur + (e.clientX < sx ? 1 : -1)); sx = null; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

/* ---------- Thumbnails: each robot rendered once into a small canvas ---------- */
function thumbnails() {
  const S = 160, pr = renderer.getPixelRatio();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  table.visible = ring.visible = false;
  for (const r of robots) {
    r.holder.visible = true;
    r.holder.position.set(0, 0, 0);
    r.root.rotation.y = 0.5;
    const bb = new THREE.Box3();
    r.model.updateMatrixWorld(true);
    r.model.traverse((o) => { if (o.isMesh && !o.material.transparent) bb.expandByObject(o, false); });
    const size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z) * 1.75 + 0.3;
    cam.position.set(mid.x + dist * 0.35, mid.y + dist * 0.25, mid.z + dist);
    cam.lookAt(mid);
    renderer.setViewport(0, 0, S / pr, S / pr);
    renderer.setScissor(0, 0, S / pr, S / pr);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(scene, cam);
    g.clearRect(0, 0, S, S);
    g.drawImage(canvas, 0, canvas.height - S, S, S, 0, 0, S, S);
    r.thumb = c.toDataURL('image/png');
    r.holder.visible = false;
    r.root.rotation.y = 0;
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  table.visible = ring.visible = true;
}

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  if (swapT < 1) {
    swapT = Math.min(1, swapT + dt / 0.9);
    const e = easeOut(swapT);
    robots[cur].holder.position.y = -2.6 * (1 - e);
    if (prev) { prev.holder.position.set(e * 6, -e * 1.5, 0); if (swapT >= 1) prev.holder.visible = false; }
    flash.scale.setScalar(0.3 + e * 3.2);
    flashMat.opacity = (1 - e) * 0.9;
  }
  const r = robots[cur];
  if (r) {
    const theta = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    r.anim.update(dt, manual ? joy.value : null, theta);
    if (manual) controls.target.lerp(tmp.set(r.root.position.x, 1.1, r.root.position.z), Math.min(1, dt * 3));
  }
  ring.material.opacity = 1;
  controls.update();
  renderer.render(scene, camera);
  if (r) placeHotspots();
});

(async () => {
  await fontsReady();
  thumbnails();
  renderCarousel();
  const want = new URLSearchParams(location.search).get('robot');
  show(Math.max(0, robots.findIndex((x) => x.id === want)));
  document.body.classList.add('ready');
  if (DEBUG) window.__rp = { robots, show, ask, camera, controls, joy, get cur() { return cur; } };
  window.__rpReady = true;
})();
