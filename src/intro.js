// Cinematic intro flight: high above the mountains → across the cotton fields → down to the main gate sign.
import * as THREE from 'three';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Camera path (metres). The gate sign sits at z = 240 facing south (+Z).
const PATH = [
  [-1350, 560, -620],
  [-980, 330, -260],
  [-640, 120, 40],   // descending towards the west cotton fields
  [-470, 58, 180],   // skimming over the fields
  [-260, 40, 330],
  [-80, 20, 330],
  [0, 11, 292],      // in front of the gate
];
export const GATE_TARGET = new THREE.Vector3(0, 8.5, 240);
export const GATE_VIEW = new THREE.Vector3(...PATH[PATH.length - 1]);

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createIntro(camera, controls, { duration = 7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const ahead = new THREE.Vector3();
  const look = new THREE.Vector3();
  let t0 = -1, active = false, onDone = null;

  function pose(u) {
    curve.getPointAt(u, camera.position);
    // Look forward along the path with a gentle downward pitch (horizon stays in frame),
    // then settle on the gate sign.
    curve.getPointAt(Math.min(1, u + 0.02), ahead).sub(camera.position).setY(0).normalize();
    ahead.multiplyScalar(420).add(camera.position);
    ahead.y = camera.position.y * 0.5;
    look.lerpVectors(ahead, GATE_TARGET, smooth(0.45, 0.97, u));
    camera.lookAt(look);
  }

  function finish() {
    active = false;
    camera.position.copy(GATE_VIEW);
    controls.target.copy(GATE_TARGET);
    controls.enabled = true;
    controls.update();
    onDone?.();
  }

  return {
    get active() { return active; },
    /** Put the camera at the first frame (used behind the landing while it fades). */
    prime() { pose(0); },
    start(cb) {
      onDone = cb;
      controls.enabled = false;
      if (REDUCED) { finish(); return; }
      active = true;
      t0 = -1;
    },
    skip() { if (active) finish(); },
    update(now) {
      if (!active) return;
      if (t0 < 0) t0 = now;
      const u = Math.min(1, (now - t0) / duration);
      pose(easeInOut(u));
      if (u >= 1) finish();
    },
  };
}
