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
  const lightDir = new THREE.Vector3(0, 1, 0); // the sun by day, the moon at night
  const MOON_DIR = new THREE.Vector3(Math.sin(2.5) * 0.79, 0.62, -Math.cos(2.5) * 0.79).normalize();
  const focus = OUTDOOR_FOCUS.clone();

  /** Centre the shadow frustum on `center` with half-size `radius` (±330 outdoors, ±80 in the tour). */
  function setShadowFocus(center = OUTDOOR_FOCUS, radius = 330) {
    focus.copy(center);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -radius;
    cam.right = cam.top = radius;
    cam.updateProjectionMatrix();
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(lightDir, SUN_DISTANCE);
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
    sunDay: new THREE.Color('#fff4e2'), sunLow: new THREE.Color('#ff9442'), moon: new THREE.Color('#9db6ff'),
    fogDay: new THREE.Color('#cfe2ee'), fogLow: new THREE.Color('#f2b688'), fogNight: new THREE.Color('#0e1a2c'),
    skyDay: new THREE.Color('#d6ecff'), skyLow: new THREE.Color('#ffd2a8'), skyNight: new THREE.Color('#5d78b8'),
    groundDay: new THREE.Color('#5f7d45'), groundLow: new THREE.Color('#7a5a3a'), groundNight: new THREE.Color('#162030'),
    cloudDay: new THREE.Color('#ffffff'), cloudLow: new THREE.Color('#ffd2b0'), cloudNight: new THREE.Color('#33405a'),
  };
  const tmp = new THREE.Color();

  /**
   * Place the sun (degrees). Elevation < 0 is night. Regenerates the PMREM, so call it only
   * when the time of day changes (Phase 8 blends between presets).
   */
  function setSun(elevation = 42, azimuth = 205, { env = true } = {}) {
    const el = THREE.MathUtils.degToRad(elevation), az = THREE.MathUtils.degToRad(azimuth);
    // Azimuth from north (−Z), clockwise towards east (+X).
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    u.sunPosition.value.copy(sunDir);

    const day = smoothstep(-3, 8, elevation);
    const low = 1 - smoothstep(4, 30, elevation);
    const warm = low * smoothstep(-5, 2, elevation); // golden-hour weight (fades out after dusk)
    const nightK = 1 - smoothstep(-6, 2, elevation);
    // Below the horizon the directional light becomes a cool moon (switched while it is near zero).
    const moon = elevation < -3;
    lightDir.copy(moon ? MOON_DIR : sunDir);
    setShadowFocus(focus, sun.shadow.camera.right);
    sun.intensity = moon ? 0.55 * nightK : 3.1 * day;
    sun.color.copy(moon ? C.moon : C.sunDay).lerp(C.sunLow, moon ? 0 : low);
    // Golden hour: a warmer, hazier sky.
    u.turbidity.value = 2.6 + 4.5 * low * day;
    u.rayleigh.value = 1.35 + 1.1 * low * day;
    u.mieCoefficient.value = 0.004 + 0.004 * low * day;
    hemi.intensity = 0.22 + 0.38 * smoothstep(-8, 25, elevation) + 0.12 * warm;
    hemi.color.copy(C.skyDay).lerp(C.skyLow, warm).lerp(C.skyNight, nightK);
    hemi.groundColor.copy(C.groundDay).lerp(C.groundLow, warm * 0.6).lerp(C.groundNight, nightK);
    renderer.toneMappingExposure = 0.5 + 0.14 * warm * day + 0.2 * nightK;

    tmp.copy(C.fogDay).lerp(C.fogLow, warm);
    tmp.lerp(C.fogNight, 1 - smoothstep(-6, 6, elevation));
    scene.fog.density = 0.00034 + 0.00012 * low * day;
    scene.fog.color.copy(tmp);
    tmp.copy(C.cloudDay).lerp(C.cloudLow, warm).lerp(C.cloudNight, 1 - smoothstep(-6, 6, elevation));
    for (const c of clouds) c.material.color.copy(tmp);

    stars.material.opacity = 1 - smoothstep(-8, 3, elevation);
    stars.visible = stars.material.opacity > 0.01;

    // The PMREM reflections are regenerated only on request (the day cycle throttles it).
    if (!env) return;
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

  return { sky, sun, hemi, stars, clouds, setSun, setShadowFocus, update, sunDir, moonDir: MOON_DIR };
}
