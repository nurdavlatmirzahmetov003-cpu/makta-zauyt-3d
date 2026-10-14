import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { fontsReady, debugFontCheck } from './fonts.js';
import { TEXT, LOADING_STEPS, LOADING_NATURE, LOADING_SITE, BUILDINGS, GATE_TEXT, UI } from './data.js';
import { grassDetailTexture } from './textures.js';
import { buildSignAtlas, buildSafetyAtlas } from './signs.js';
import { buildRoads } from './roads.js';
import { buildBuildings } from './buildings.js';
import { SPECIALS, buildMonument, treeSpots } from './landmarks.js';
import { buildGate } from './gate.js';
import { buildProduction } from './production.js';
import { buildTraffic } from './vehicles.js';
import { buildRobots } from './crowd.js';
import { setNightLevel, onNight } from './materials.js';
import { createPost } from './post.js';
import { buildShowroomWall } from './showroom.js';
import { createEnvironment } from './world.js';
import { buildTerrain } from './terrain.js';
import { buildTrees, buildShrubsAndFlowers, buildLake } from './nature.js';
import { buildFields } from './fields.js';
import { buildSolarFarms, buildWindTurbines } from './energy.js';
import { createLanding } from './landing.js';
import { createIntro, GATE_TARGET } from './intro.js';
import { createCameraman } from './cameraman.js';
import { createLabels } from './labels.js';
import { createQuality, createTimeOfDay } from './settings.js';
import { createUI } from './ui.js';
import { createTour } from './tour.js';
import { createClock } from './sim/clock.js';
import { createLife } from './sim/life.js';
import { createEconomy } from './sim/economy.js';
import { createClockUI } from './sim/clock-ui.js';
import { buildNight } from './sim/night.js';
import { createChat } from './chat/chat-ui.js';
import { createGuide } from './guide/guide.js';
import { createExplode } from './explode/explode.js';
import { createDrive } from './control/drive.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const canvas = document.getElementById('c');
const uiRoot = document.getElementById('ui');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2)); // refined by the quality preset
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 8000);
camera.position.set(28, 16, 274);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(GATE_TARGET);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48; // never below the ground
controls.minDistance = 8;
controls.maxDistance = 1400;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// Prevent Safari double-tap zoom / pinch-zoom on the page.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// No rubber-band page scroll on iOS: only the UI's own scroll areas may scroll.
const SCROLLERS = '.list-items, .card, .tour-panel, .tour-finale, .features-grid, .timeline, .counters, .dock';
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest?.(SCROLLERS)) e.preventDefault(); }, { passive: false });

// Tap detection: movement under 6 px counts as a tap.
let downPos = null;
canvas.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved < 6) canvas.dispatchEvent(new CustomEvent('tap', { detail: { x: e.clientX, y: e.clientY } }));
});
canvas.addEventListener('tap', (e) => { if (ui && !intro.active) ui.onTap(e.detail.x, e.detail.y); });

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const intro = createIntro(camera, controls);
let rendering = false; // the 3D scene is not drawn while the landing covers it

const skipHint = document.createElement('div');
skipHint.className = 'skip-hint';
skipHint.textContent = TEXT.skipHint;
document.body.appendChild(skipHint);
for (const cls of ['top', 'bot']) {
  const bar = document.createElement('div');
  bar.className = `cine ${cls}`;
  document.body.appendChild(bar);
}
const skipIntro = () => intro.skip();

const landing = createLanding({
  onEnter() {
    rendering = true;
    intro.prime();
    skipHint.classList.add('on');
    document.body.classList.add('flying');
    canvas.addEventListener('pointerdown', skipIntro);
    intro.start(() => {
      skipHint.classList.remove('on');
      document.body.classList.remove('flying');
      canvas.removeEventListener('pointerdown', skipIntro);
      uiRoot.hidden = false;
    });
  },
});

// Updatable parts of the world (filled by the build steps).
const world = { scene, env: null, lake: null, fields: null, wind: null, site: null, monument: null, gate: null, production: null, traffic: null, robots: null, tour: null, showroom: null };
// Interface modules (created once the world exists).
let ui = null, cameraman = null, labels = null, quality = null, tod = null, hud = null;
// Living factory (Part 2): simulation clock, day cycle, economy, clock widget, night atmosphere.
let simClock = null, life = null, economy = null, clockUI = null, nightFx = null, chat = null;
const post = createPost(renderer, scene, camera);
onNight((k) => post.setNight(k));

function buildInterface() {
  cameraman = createCameraman(camera, controls, world);
  labels = createLabels(camera);
  quality = createQuality(renderer, world, { onAuto: () => ui?.toast(UI.quality.auto) });
  // The factory is already running when the site opens: 07:40 on day 1.
  simClock = createClock({ start: 7 * 60 + 40, day: 1 });
  life = createLife({ clock: simClock, world, scene, toast: (m) => ui?.toast(m) });
  economy = createEconomy({ clock: simClock, world, life });
  tod = createTimeOfDay(world, simClock, { getWork: () => life.state.power });
  nightFx = buildNight(scene, world.env);
  tod.init();
  // Bloom only on «Жоғары»; the pixel ratio change also resizes the composer.
  const applyPost = (l) => { post.setEnabled(l === 'high'); post.resize(); };
  quality.onChange(applyPost);
  applyPost(quality.level);
  ui = createUI({ root: uiRoot, world, camera, controls, cameraman, labels, quality, tod, economy });
  world.tour = createTour({ scene, camera, controls, world, cameraman, tod, root: uiRoot });
  ui.bindTour(world.tour);
  // «Ақылды көмекші»: offline Kazakh chatbot; actions are the UI's own buttons and camera moves.
  const dockClick = (a) => uiRoot.querySelector(`[data-a="${a}"]`)?.click();
  const actions = {
    features: () => dockClick('features'),
    guide: () => world.tour.start(1),
    robotsList: () => dockClick('robots'),
    show: (id) => {
      const b = world.site.list.get(id);
      if (b) ui.select({ kind: 'building', ref: b });
      else cameraman.flyTo(new THREE.Vector3(34, 26, 140), new THREE.Vector3(0, 6, 95), 2); // monument
    },
  };
  world.guide = createGuide({ scene, camera, controls, world, cameraman, tod, root: uiRoot });
  world.explode = createExplode({ scene, camera, world, cameraman, root: uiRoot });
  actions.guide = () => world.guide.start();
  actions.explode = () => world.explode.explodeBase();
  actions.explodeText = '🧩 Бүкіл базаны бес қабатқа бөлшектеймін! Қабатты басып, оның қызметін біліңіз.';
  world.drive = createDrive({ camera, controls, world, cameraman, root: uiRoot, toast: (m) => ui.toast(m) });
  actions.robotsPage = () => { location.href = './robots.html'; };
  actions.robotsPageText = '🤖 «Роботтар әлемі» бетін ашып жатырмын…';
  chat = createChat({ root: uiRoot, app: { clock: simClock, life, economy, world, ui, tod, cameraman, actions } });
  clockUI = createClockUI({ root: uiRoot, clock: simClock, life, economy, toast: (m) => ui.toast(m), tourActive: () => world.tour?.active });
  if (DEBUG) {
    hud = document.createElement('div');
    hud.className = 'debug-hud';
    document.body.appendChild(hud);
  }
}

async function init() {
  // Real loading progress: each scene-building step reports when it completes.
  const steps = [
    [LOADING_NATURE.sky, () => {
      world.env = createEnvironment(renderer, scene);
      world.env.setSun(38, 232); // afternoon sun from the WSW: side light gives the mountains form
    }],
    [LOADING_NATURE.terrain, () => scene.add(buildTerrain(grassDetailTexture()))],
    [LOADING_NATURE.lake, () => { world.lake = buildLake(scene); }],
    [LOADING_STEPS[2], () => { world.fields = buildFields(scene); }],
    [LOADING_SITE.roads, () => {
      atlas.signs = buildSignAtlas([...BUILDINGS.map((b) => ({ id: b.id, text: b.name })), { id: 'monument', text: GATE_TEXT.monument }]);
      atlas.safety = buildSafetyAtlas();
      roads = buildRoads(scene, atlas.safety);
    }],
    [LOADING_SITE.buildings, () => { world.site = buildBuildings(scene, atlas.signs, SPECIALS); }],
    [LOADING_SITE.landmarks, () => { world.monument = buildMonument(scene, atlas.signs); world.showroom = buildShowroomWall(world.site); }],
    [LOADING_SITE.gate, () => { world.gate = buildGate(scene, atlas.safety); }],
    [LOADING_STEPS[3], () => { world.production = buildProduction(scene, world.site); }],
    [LOADING_SITE.vehicles, () => { world.traffic = buildTraffic(scene, { production: world.production, gate: world.gate }); }],
    [LOADING_STEPS[1], () => {
      world.robots = buildRobots(scene, world.site);
      if (DEBUG) console.info('[world] robots', JSON.stringify(world.robots.counts), 'vehicles', world.traffic.vehicles.length, 'parked', world.traffic.parked.length);
    }],
    [LOADING_NATURE.trees, () => {
      const t = buildTrees(scene, [...treeSpots, ...roads.treeSpots]), s = buildShrubsAndFlowers(scene);
      if (DEBUG) console.info('[world] trees', t.count, 'shrubs', s.shrubs, 'beds', s.beds, 'lamps', roads.lampCount, 'buildings', world.site.list.size);
    }],
    [LOADING_STEPS[0], () => buildSolarFarms(scene)],
    [LOADING_NATURE.wind, () => { world.wind = buildWindTurbines(scene); }],
    [TEXT.loading, buildInterface],
  ];
  const atlas = {};
  let roads = null;
  const total = steps.length + 1;
  landing.progress(0.02, TEXT.loading);
  await fontsReady();
  if (DEBUG) {
    console.table(debugFontCheck());
    setTimeout(() => document.querySelector('.font-debug')?.remove(), 5000);
  }
  landing.progress(1 / total);
  // «Бөлшектеп көру» whole-base layers: objects each step adds to the scene get its layer tag.
  const STEP_LAYER = ['', 'nature', 'nature', 'nature', 'logistics', 'production', 'control', 'control', 'logistics', 'logistics', 'control', 'nature', 'energy', 'energy', ''];
  for (let i = 0; i < steps.length; i++) {
    landing.progress((i + 1) / total, steps[i][0]);
    await nextFrame();
    const before = new Set(scene.children);
    steps[i][1]();
    if (STEP_LAYER[i]) for (const o of scene.children) if (!before.has(o) && !o.userData.layer) o.userData.layer = STEP_LAYER[i];
    // Let each message be readable even when a step is instant.
    await new Promise((r) => setTimeout(r, 220));
  }
  world.explode?.collect(); // tagged objects into the five layer groups (positions unchanged)
  landing.progress(1, LOADING_STEPS[3]);
  await nextFrame();
  renderer.compile(scene, camera);
  if (DEBUG) {
    renderer.info.reset();
    renderer.render(scene, camera);
    console.info('[world] draw calls', renderer.info.render.calls, 'triangles', renderer.info.render.triangles);
  }
  landing.ready();
  // Coming from «Роботтар әлемі» → «Зауытта көрсету»: enter at once and show that robot type.
  const FOCUS = new URLSearchParams(location.search).get('focus');
  if (FOCUS) {
    document.getElementById('enter-btn').click();
    setTimeout(() => { intro.skip(); setTimeout(() => focusRobot(FOCUS), 400); }, 300);
  }
  if (DEBUG) window.__app = { THREE, scene, camera, controls, intro, renderer, world, setNightLevel, ui, cameraman, labels, quality, tod, tour: world.tour, guide: world.guide, explode: world.explode, drive: world.drive, focus: focusRobot, post, clock: simClock, life, economy, chat, step: stepWorld };
  window.__sceneReady = true;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.resize();
});

const clock = new THREE.Clock(); // real time
let lastT = 0, hudT = 0;
/** Fly to (or start) the robot type chosen on the robots page. */
function focusRobot(key) {
  const humans = world.robots.humans.list;
  const role = { operator: 'operator', security: 'security', lab: 'lab' }[key];
  const building = { sewing: 'sewing', dispatch: 'dispatch', tanks: 'tanks', repair: 'repair', cleaner: 'cleaning' }[key];
  if (key === 'guide') world.guide.start();
  else if (role) { const p = humans.find((h) => h.role === role); if (p) ui.select({ kind: 'robot', ref: p }); }
  else if (key === 'amr') ui.select({ kind: 'amr', ref: world.robots.amrs[0] });
  else if (key === 'drone') ui.select({ kind: 'drone', ref: world.robots.drones[2] });
  else if (key === 'harvester') {
    const h = world.fields.harvester;
    cameraman.flyTo(h.position.clone().add(new THREE.Vector3(18, 12, 18)), h.position.clone(), 2);
    cameraman.setFollow(() => h.position, 2);
  } else if (building) ui.select({ kind: 'building', ref: world.site.list.get(building) }, { openRoof: true });
}

/** One frame of world logic (no rendering); `dt` is real time. Also used by tests (`__app.step`). */
function stepWorld(dt) {
  // Simulation time: scaled by the clock speed (⏸ 1× 2× 5× 10× 30×).
  const simDt = simClock ? simClock.update(dt) : dt;
  life?.update();
  tod?.update(dt);
  const sd = Math.min(simDt, 0.5); // cosmetic animations (water, clouds, turbines) need no sub-steps
  world.env?.update(sd);
  world.lake?.update(sd);
  world.fields?.update(sd);
  world.wind?.update(sd);
  world.monument?.update(sd);
  world.site?.update(dt, sd, life?.buildingPower);
  nightFx?.update(dt, simClock?.minutes ?? 0, tod?.night ?? 0);
  // Sub-steps of ≤ 0.1 s keep traffic, robots and the product flow stable at high speeds.
  const steps = Math.max(1, Math.ceil(simDt / 0.1)), h = simDt / steps;
  for (let i = 0; i < steps; i++) {
    const last = i === steps - 1;
    if (world.traffic) world.traffic.update(h); else world.gate?.update(h);
    world.production?.update(h, { render: last, animDt: simDt });
    world.robots?.update(h, camera, last);
    economy?.update(h);
  }
}

renderer.setAnimationLoop(() => {
  if (!rendering) return;
  const t = clock.getElapsedTime();
  const dt = Math.min(0.1, t - lastT); // real time: camera, UI, roof fades
  lastT = t;
  intro.update(t);
  stepWorld(dt);
  world.tour?.update(dt);
  world.guide?.update(dt);
  world.explode?.update(dt);
  world.drive?.update(dt);
  if (!intro.active) {
    cameraman?.update(dt);
    if (!world.tour?.playing && !world.guide?.playing && !world.drive?.playing) controls.update();
  }
  renderer.info.reset(); // counted over all passes of the frame
  post.render(dt);
  labels?.update();
  ui?.update(dt);
  clockUI?.update(dt);
  chat?.update(dt);
  quality?.update(dt);
  if (hud && (hudT += dt) > 0.5) {
    hudT = 0;
    hud.textContent = `${quality.fps.toFixed(0)} FPS · ${renderer.info.render.calls} DC · ${(renderer.info.render.triangles / 1000).toFixed(0)}k △ · ${quality.level}`;
  }
});

init();
