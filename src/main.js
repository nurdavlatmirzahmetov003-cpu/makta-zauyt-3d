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
import { setNightLevel } from './materials.js';
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
const world = { scene, env: null, lake: null, fields: null, wind: null, site: null, monument: null, gate: null, production: null, traffic: null, robots: null, tour: null };
// Interface modules (created once the world exists).
let ui = null, cameraman = null, labels = null, quality = null, tod = null, hud = null;

function buildInterface() {
  cameraman = createCameraman(camera, controls, world);
  labels = createLabels(camera);
  quality = createQuality(renderer, world, { onAuto: () => ui?.toast(UI.quality.auto) });
  tod = createTimeOfDay(world);
  ui = createUI({ root: uiRoot, world, camera, controls, cameraman, labels, quality, tod });
  world.tour = createTour({ scene, camera, controls, world, cameraman, tod, root: uiRoot });
  ui.bindTour(world.tour);
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
    [LOADING_SITE.landmarks, () => { world.monument = buildMonument(scene, atlas.signs); }],
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
  for (let i = 0; i < steps.length; i++) {
    landing.progress((i + 1) / total, steps[i][0]);
    await nextFrame();
    steps[i][1]();
    // Let each message be readable even when a step is instant.
    await new Promise((r) => setTimeout(r, 220));
  }
  landing.progress(1, LOADING_STEPS[3]);
  await nextFrame();
  renderer.compile(scene, camera);
  if (DEBUG) {
    renderer.render(scene, camera);
    console.info('[world] draw calls', renderer.info.render.calls, 'triangles', renderer.info.render.triangles);
  }
  landing.ready();
  if (DEBUG) window.__app = { THREE, scene, camera, controls, intro, renderer, world, setNightLevel, ui, cameraman, labels, quality, tod, tour: world.tour };
  window.__sceneReady = true;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

const clock = new THREE.Clock();
let lastT = 0, hudT = 0;
renderer.setAnimationLoop(() => {
  if (!rendering) return;
  const t = clock.getElapsedTime();
  const dt = Math.min(0.1, t - lastT);
  lastT = t;
  intro.update(t);
  world.env?.update(dt);
  world.lake?.update(dt);
  world.fields?.update(dt);
  world.wind?.update(dt);
  world.site?.update(dt);
  world.monument?.update(dt);
  if (world.traffic) world.traffic.update(dt); else world.gate?.update(dt);
  world.production?.update(dt);
  world.robots?.update(dt, camera);
  tod?.update(dt);
  world.tour?.update(dt);
  if (!intro.active) {
    cameraman?.update(dt);
    if (!world.tour?.playing) controls.update();
  }
  renderer.render(scene, camera);
  labels?.update();
  ui?.update(dt);
  quality?.update(dt);
  if (hud && (hudT += dt) > 0.5) {
    hudT = 0;
    hud.textContent = `${quality.fps.toFixed(0)} FPS · ${renderer.info.render.calls} DC · ${(renderer.info.render.triangles / 1000).toFixed(0)}k △ · ${quality.level}`;
  }
});

init();
