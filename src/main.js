import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { fontsReady, debugFontCheck } from './fonts.js';
import { TEXT, LOADING_STEPS, PALETTE } from './data.js';
import { makeSignTexture } from './textures.js';
import { createLanding } from './landing.js';
import { createIntro, GATE_TARGET } from './intro.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const canvas = document.getElementById('c');
const ui = document.getElementById('ui');
document.getElementById('ui-chip').textContent = `${TEXT.titleCaps} — ${TEXT.complex}`;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
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
controls.maxDistance = 400;
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
      ui.hidden = false;
    });
  },
});

function buildSky() {
  // Simple gradient sky dome (replaced by Sky.js in Phase 2).
  const geo = new THREE.SphereGeometry(7000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#5fb4f0') },
      horizon: { value: new THREE.Color('#e8f6ff') },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6,0.,1.); gl_FragColor = vec4(mix(horizon, top, h),1.); }',
  });
  scene.add(new THREE.Mesh(geo, mat));
  scene.fog = new THREE.FogExp2('#dff1fb', 0.0011);
}

function buildLights() {
  scene.add(new THREE.HemisphereLight('#dff4ff', '#6f8f5a', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.position.set(GATE_TARGET.x + 40, 60, GATE_TARGET.z + 25);
  sun.target.position.copy(GATE_TARGET);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
}

function buildGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14000, 14000), // temporary; replaced by fbm terrain in Phase 2
    new THREE.MeshStandardMaterial({ color: '#8fbf6a', roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

let testBoll;
function buildTestObject() {
  const group = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.6, 1.2, 48),
    new THREE.MeshStandardMaterial({ color: PALETTE.cotton, roughness: 0.4 }),
  );
  pedestal.position.y = 0.6;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.25, 0.08, 12, 96),
    new THREE.MeshStandardMaterial({ color: PALETTE.teal, emissive: PALETTE.teal, emissiveIntensity: 1.4 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.22;
  const fluff = new THREE.MeshStandardMaterial({ color: PALETTE.cotton, roughness: 0.9 });
  testBoll = new THREE.Group();
  for (const [x, y, z] of [[0, 1.2, 0], [-1, 0, 0.4], [1, 0, 0.4], [0, 0, -1], [0, -0.6, 0.9]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 20), fluff);
    s.position.set(x, y, z);
    s.castShadow = true;
    testBoll.add(s);
  }
  testBoll.position.y = 4;
  group.add(pedestal, ring, testBoll);
  pedestal.castShadow = pedestal.receiveShadow = true;
  group.position.z = 240; // stand-in for the main gate (Phase 3)
  scene.add(group);
}

function buildTestSign() {
  const tex = makeSignTexture(TEXT.testSign);
  const w = 20, h = 2.5;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.6 }),
  );
  sign.position.set(0, 9.5, 238);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.3),
    new THREE.MeshStandardMaterial({ color: PALETTE.graphite, metalness: 0.6, roughness: 0.35 }),
  );
  frame.position.set(0, 9.5, 237.83);
  const postMat = new THREE.MeshStandardMaterial({ color: '#cfd8dc', metalness: 0.8, roughness: 0.3 });
  for (const x of [-8, 8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9.5, 16), postMat);
    post.position.set(x, 4.75, 237.7);
    post.castShadow = true;
    scene.add(post);
  }
  scene.add(sign, frame);
}

async function init() {
  // Real loading progress: each scene-building step reports when it completes.
  const steps = [
    [LOADING_STEPS[0], buildSky],
    [LOADING_STEPS[1], buildLights],
    [LOADING_STEPS[2], buildGround],
    [LOADING_STEPS[3], buildTestObject],
    [LOADING_STEPS[3], buildTestSign],
  ];
  const total = steps.length + 1;
  landing.progress(0.02, TEXT.loading);
  await fontsReady();
  if (DEBUG) console.table(debugFontCheck());
  landing.progress(1 / total);
  for (let i = 0; i < steps.length; i++) {
    landing.progress((i + 1) / total, steps[i][0]);
    await nextFrame();
    steps[i][1]();
    // Let each message be readable even when a step is instant.
    await new Promise((r) => setTimeout(r, 380));
  }
  renderer.compile(scene, camera);
  landing.ready();
  window.__sceneReady = true;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!rendering) return;
  const t = clock.getElapsedTime();
  intro.update(t);
  if (testBoll) {
    testBoll.rotation.y = t * 0.3;
    testBoll.position.y = 4 + Math.sin(t * 1.2) * 0.25;
  }
  if (!intro.active) controls.update();
  renderer.render(scene, camera);
});

init();
