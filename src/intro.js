// Cinematic intro flight: high above the mountains → across the cotton fields → down to the main gate sign.
import * as THREE from 'three';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Camera path (metres). The gate sign sits at z = 240 facing south (+Z).
// Clearance over terrain was checked numerically (≥ 11 m everywhere, ~350 m over the peaks).
const PATH = [
  [-1500, 900, -1700], // high above the snowy ridge (north-west)
  [-1150, 520, -900],  // over the foothill forest
  [-820, 200, -250],
  [-560, 60, 40],      // descending towards the west cotton fields
  [-440, 28, 150],     // skimming over the harvester's parcel
  [-250, 34, 330],     // over the poplar-lined highway
  [-80, 18, 330],
  [0, 7, 306],         // in front of the main gate arch
];
export const GATE_TARGET = new THREE.Vector3(0, 12, 240);
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
    /** Debug: freeze the camera at path parameter u (0..1), e.g. for screenshots. */
    peek(u) {
      active = false;
      pose(u);
      controls.target.copy(look);
      controls.update();
    },
    update(now) {
      if (!active) return;
      if (t0 < 0) t0 = now;
      const u = Math.min(1, (now - t0) / duration);
      pose(easeInOut(u));
      if (u >= 1) finish();
    },
  };
}
