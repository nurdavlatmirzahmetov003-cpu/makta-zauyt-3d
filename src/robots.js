// Robots. Phase 4 needs the 6-axis industrial arm and AMR carts; Phase 5 adds humanoids and drones.
import * as THREE from 'three';
import { merge, paint, place } from './geo.js';
import { PALETTE } from './data.js';

let MAT = null;
function robotMat() {
  if (!MAT) MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25 });
  return MAT;
}
const WHITE = '#f3f5f5', DARK = '#2a3338', TEAL = PALETTE.teal, GOLD = PALETTE.gold;

const ease = (t) => t * t * (3 - 2 * t);

/**
 * 6-axis industrial arm (base yaw, shoulder, elbow, wrist pitch, wrist roll, gripper) with a
 * keyframed pick → lift → move → place cycle. Each link is one merged, vertex-coloured mesh.
 * poses: array of { yaw, sh, el, wr, grip, hold, t } (radians, t = seconds to reach this pose).
 */
export class RobotArm extends THREE.Group {
  constructor({ scale = 1, poses = null, color = WHITE, payload = null } = {}) {
    super();
    const m = robotMat();
    const L1 = 1.5, L2 = 1.3;
    this.base = new THREE.Mesh(merge([
      paint(new THREE.CylinderGeometry(0.55, 0.65, 0.35, 20).translate(0, 0.17, 0), DARK),
      paint(new THREE.TorusGeometry(0.56, 0.05, 6, 24).rotateX(Math.PI / 2).translate(0, 0.36, 0), TEAL),
    ]), m);
    this.turret = new THREE.Group();
    this.turret.position.y = 0.35;
    this.turret.add(new THREE.Mesh(merge([
      paint(new THREE.CylinderGeometry(0.4, 0.48, 0.55, 18).translate(0, 0.27, 0), color),
      paint(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16).rotateX(Math.PI / 2).translate(0, 0.72, 0), DARK),
    ]), m));
    this.shoulder = new THREE.Group();
    this.shoulder.position.y = 0.72;
    this.shoulder.add(new THREE.Mesh(merge([
      paint(new THREE.BoxGeometry(0.34, L1, 0.34).translate(0, L1 / 2, 0), color),
      paint(new THREE.TorusGeometry(0.2, 0.05, 6, 16).translate(0, L1 * 0.5, 0.18), TEAL),
      paint(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 14).rotateX(Math.PI / 2).translate(0, L1, 0), DARK),
    ]), m));
    this.elbow = new THREE.Group();
    this.elbow.position.y = L1;
    this.shoulder.add(this.elbow);
    this.elbow.add(new THREE.Mesh(merge([
      paint(new THREE.BoxGeometry(0.26, L2, 0.26).translate(0, L2 / 2, 0), color),
      paint(new THREE.BoxGeometry(0.28, 0.12, 0.28).translate(0, L2 * 0.75, 0), TEAL),
    ]), m));
    this.wrist = new THREE.Group();
    this.wrist.position.y = L2;
    this.elbow.add(this.wrist);
    this.wrist.add(new THREE.Mesh(merge([
      paint(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12).translate(0, 0.15, 0), DARK),
      paint(new THREE.BoxGeometry(0.42, 0.08, 0.2).translate(0, 0.32, 0), GOLD),
    ]), m));
    this.fingers = [-1, 1].map((s) => {
      const f = new THREE.Mesh(paint(new THREE.BoxGeometry(0.06, 0.3, 0.16).translate(0, 0.5, 0), GOLD), m);
      f.position.x = s * 0.15;
      this.wrist.add(f);
      return f;
    });
    this.payload = payload;
    if (payload) { payload.position.y = 0.62; payload.visible = false; this.wrist.add(payload); }
    this.turret.add(this.shoulder);
    this.add(this.base, this.turret);
    this.scale.setScalar(scale);
    this.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.poses = poses || RobotArm.pickPlace();
    this.k = 0;
    this.t = 0;
    this.apply(this.poses[0]);
  }

  /** Default cycle: pick in front (+X), place to the side (+Z). */
  static pickPlace(yawPick = 0, yawPlace = Math.PI / 2, reach = 0.9) {
    return [
      { yaw: yawPick, sh: 0.2, el: 0.9, wr: 0.6, grip: 0, hold: 0, t: 0.9 },
      { yaw: yawPick, sh: 0.55 * reach, el: 1.5, wr: 1.0, grip: 0, hold: 0, t: 0.8 },
      { yaw: yawPick, sh: 0.55 * reach, el: 1.5, wr: 1.0, grip: 1, hold: 1, t: 0.35 },
      { yaw: yawPick, sh: 0.1, el: 0.9, wr: 0.7, grip: 1, hold: 1, t: 0.7 },
      { yaw: yawPlace, sh: 0.1, el: 0.9, wr: 0.7, grip: 1, hold: 1, t: 1.0 },
      { yaw: yawPlace, sh: 0.5 * reach, el: 1.45, wr: 1.0, grip: 1, hold: 1, t: 0.8 },
      { yaw: yawPlace, sh: 0.5 * reach, el: 1.45, wr: 1.0, grip: 0, hold: 0, t: 0.35 },
    ];
  }

  apply(p) {
    this.turret.rotation.y = p.yaw;
    this.shoulder.rotation.z = -p.sh;
    this.elbow.rotation.z = -p.el;
    this.wrist.rotation.z = -p.wr;
    this.wrist.rotation.y = p.yaw * 0.5;
    const g = 0.15 - 0.07 * p.grip;
    this.fingers[0].position.x = -g;
    this.fingers[1].position.x = g;
    if (this.payload) this.payload.visible = p.hold > 0.5;
  }

  update(dt, speed = 1) {
    const P = this.poses;
    this.t += dt * speed;
    let next = P[(this.k + 1) % P.length];
    while (this.t >= next.t) {
      this.t -= next.t;
      this.k = (this.k + 1) % P.length;
      next = P[(this.k + 1) % P.length];
    }
    const a = P[this.k], u = ease(Math.min(1, this.t / next.t));
    const lerp = (x, y) => x + (y - x) * u;
    this.apply({
      yaw: lerp(a.yaw, next.yaw), sh: lerp(a.sh, next.sh), el: lerp(a.el, next.el), wr: lerp(a.wr, next.wr),
      grip: u < 0.5 ? a.grip : next.grip, hold: u < 0.5 ? a.hold : next.hold,
    });
  }
}

/** Low autonomous mobile robot (AMR) cart with a lidar puck and glowing status strip. */
export function makeAMR({ load = null, length = 1.6 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(1.0, 0.32, length).translate(0, 0.26, 0), WHITE),
    paint(new THREE.BoxGeometry(1.02, 0.06, length + 0.02).translate(0, 0.2, 0), TEAL),
    paint(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12).translate(0, 0.48, length / 2 - 0.2), DARK),
    ...[[-0.38, -1], [0.38, -1], [-0.38, 1], [0.38, 1]].map(([x, s]) => paint(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10).rotateZ(Math.PI / 2).translate(x, 0.11, s * (length / 2 - 0.25)), DARK)),
  ]), robotMat());
  body.castShadow = true;
  g.add(body);
  if (load) { load.position.y = 0.42; g.add(load); }
  return g;
}

/** Robotic forklift (AMR with a mast and forks). */
export function makeForklift() {
  const g = new THREE.Group();
  const m = robotMat();
  g.add(new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(1.2, 0.7, 1.8).translate(0, 0.5, -0.3), WHITE),
    paint(new THREE.BoxGeometry(1.22, 0.08, 1.82).translate(0, 0.62, -0.3), TEAL),
    paint(new THREE.BoxGeometry(0.08, 2.4, 0.1).translate(-0.45, 1.3, 0.62), DARK),
    paint(new THREE.BoxGeometry(0.08, 2.4, 0.1).translate(0.45, 1.3, 0.62), DARK),
    paint(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 12).translate(0, 0.95, -0.6), DARK),
  ]), m));
  const forks = new THREE.Mesh(merge([
    paint(new THREE.BoxGeometry(0.12, 0.06, 1.1).translate(-0.3, 0, 1.2), GOLD),
    paint(new THREE.BoxGeometry(0.12, 0.06, 1.1).translate(0.3, 0, 1.2), GOLD),
    paint(new THREE.BoxGeometry(1.0, 0.5, 0.06).translate(0, 0.25, 0.68), DARK),
  ]), m);
  forks.position.y = 0.2;
  g.add(forks);
  g.userData.forks = forks;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export { place };
