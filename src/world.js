// Environment: physical sky, sun + hemisphere light, PMREM reflections, fog, clouds and stars.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { cloudTexture } from './textures.js';
import { mulberry32, smoothstep } from './noise.js';

const OUTDOOR_FOCUS = new THREE.Vector3(0, 0, -10);
const SUN_DISTANCE = 900;

export function createEnvironment(renderer, scene, { shadowMapSize = 2048 } = {}) {
  /* ---------- Sky ---------- */
  const sky = new Sky();
  sky.scale.setScalar(6000);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.6;
  u.rayleigh.value = 1.35;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.86;
  scene.add(sky);

  // A second Sky sharing the same material renders into the PMREM (env reflections).
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.material = sky.material;
  envSky.scale.setScalar(50);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  /* ---------- Lights ---------- */
  const hemi = new THREE.HemisphereLight('#d6ecff', '#5f7d45', 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff3e0', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.5;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = SUN_DISTANCE * 2;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3();
  const focus = OUTDOOR_FOCUS.clone();

  /** Centre the shadow frustum on `center` with half-size `radius` (±330 outdoors, ±80 in the tour). */
  function setShadowFocus(center = OUTDOOR_FOCUS, radius = 330) {
    focus.copy(center);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -radius;
    cam.right = cam.top = radius;
    cam.updateProjectionMatrix();
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, SUN_DISTANCE);
  }
  setShadowFocus(OUTDOOR_FOCUS, 330);

  /* ---------- Fog ---------- */
  scene.fog = new THREE.FogExp2('#cfe2ee', 0.00034);

  /* ---------- Clouds ---------- */
  const rand = mulberry32(99);
  const cloudTex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.88,
    });
    const s = new THREE.Sprite(mat);
    const a = rand() * Math.PI * 2, r = 500 + rand() * 2300;
    s.position.set(Math.cos(a) * r, 430 + rand() * 320, Math.sin(a) * r);
    const w = 520 + rand() * 520;
    s.scale.set(w, w * 0.42, 1);
    s.userData.speed = 3 + rand() * 4;
    s.renderOrder = -1;
    scene.add(s);
    clouds.push(s);
  }

  /* ---------- Stars (night) ---------- */
  const starCount = 1800;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const y = 0.06 + rand() * 0.94, t = rand() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(t) * rr * 5200, y * 5200, Math.sin(t) * rr * 5200], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
  }));
  stars.visible = false;
  scene.add(stars);

  /* ---------- Sun / time of day ---------- */
  const C = {
    sunDay: new THREE.Color('#fff4e2'), sunLow: new THREE.Color('#ffb06a'),
    fogDay: new THREE.Color('#cfe2ee'), fogLow: new THREE.Color('#f0c9a6'), fogNight: new THREE.Color('#0d1726'),
    cloudDay: new THREE.Color('#ffffff'), cloudLow: new THREE.Color('#ffd2b0'), cloudNight: new THREE.Color('#33405a'),
  };
  const tmp = new THREE.Color();

  /**
   * Place the sun (degrees). Elevation < 0 is night. Regenerates the PMREM, so call it only
   * when the time of day changes (Phase 8 blends between presets).
   */
  function setSun(elevation = 42, azimuth = 205) {
    const el = THREE.MathUtils.degToRad(elevation), az = THREE.MathUtils.degToRad(azimuth);
    // Azimuth from north (−Z), clockwise towards east (+X).
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    u.sunPosition.value.copy(sunDir);
    setShadowFocus(focus, sun.shadow.camera.right);

    const day = smoothstep(-4, 14, elevation);
    const low = 1 - smoothstep(4, 30, elevation);
    sun.intensity = 3.1 * day;
    sun.color.copy(C.sunDay).lerp(C.sunLow, low);
    hemi.intensity = 0.12 + 0.48 * smoothstep(-8, 25, elevation);
    renderer.toneMappingExposure = 0.5 + 0.12 * (1 - day);

    tmp.copy(C.fogDay).lerp(C.fogLow, low * day);
    tmp.lerp(C.fogNight, 1 - smoothstep(-6, 6, elevation));
    scene.fog.color.copy(tmp);
    tmp.copy(C.cloudDay).lerp(C.cloudLow, low * day).lerp(C.cloudNight, 1 - smoothstep(-6, 6, elevation));
    for (const c of clouds) c.material.color.copy(tmp);

    stars.material.opacity = 1 - smoothstep(-8, 3, elevation);
    stars.visible = stars.material.opacity > 0.01;

    envRT?.dispose();
    envRT = pmrem.fromScene(envScene, 0, 0.1, 200);
    scene.environment = envRT.texture;
  }

  function update(dt) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 3200) c.position.x = -3200;
    }
  }

  return { sky, sun, hemi, stars, clouds, setSun, setShadowFocus, update, sunDir };
}
