// Camera director for the interface: smooth fly-to, follow mode (orbit still works), tap picking of
// buildings / vehicles / robots / drones, and a HUD-style corner-bracket selection outline.
import * as THREE from 'three';
import { PALETTE } from './data.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const VIEWS = {
  home: { pos: [380, 250, 430], target: [0, 0, -30] },
  top: { pos: [0.1, 760, 30], target: [0, 0, -15] },
};

export function createCameraman(camera, controls, world) {
  const fly = { active: false, t: 0, dur: 1.4, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };
  let follow = null; // { get(): Vector3, lift }
  const lastTarget = new THREE.Vector3();

  controls.addEventListener('start', () => { fly.active = false; });

  function flyTo(pos, target, dur = 1.5) {
    fly.p0.copy(camera.position);
    fly.t0.copy(controls.target);
    fly.p1.copy(pos);
    fly.t1.copy(target);
    fly.t = 0;
    fly.dur = dur;
    fly.active = true;
  }

  /** Fly to frame a box (keeps the current viewing direction; pitch in radians, ~35° by default). */
  function frameBox(box, { closer = 1, pitch = 0.62 } = {}) {
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z, size.y * 1.4) * 0.5;
    const dist = (r * 2.3 + 14) * closer;
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).setY(0);
    if (dir.lengthSq() < 1) dir.set(0.6, 0, 1);
    dir.normalize();
    const pos = c.clone().addScaledVector(dir, dist * Math.cos(pitch)).setY(c.y + dist * Math.sin(pitch));
    flyTo(pos, c);
  }

  function setFollow(getPos, lift = 1.5) {
    follow = getPos ? { get: getPos, lift } : null;
    if (follow) lastTarget.copy(getPos());
  }

  /* ---------- Selection outline: corner brackets + pulsing ground ring ---------- */
  const bracketGeo = new THREE.BufferGeometry();
  const corners = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) corners.push([x, y, z]);
  const seg = [];
  const k = 0.22;
  for (const [x, y, z] of corners) {
    const sx = x ? -1 : 1, sy = y ? -1 : 1, sz = z ? -1 : 1;
    seg.push(x, y, z, x + sx * k, y, z, x, y, z, x, y + sy * k, z, x, y, z, x, y, z + sz * k);
  }
  bracketGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const brackets = new THREE.LineSegments(bracketGeo, new THREE.LineBasicMaterial({ color: '#7ffbe9', depthTest: false, transparent: true, toneMapped: false }));
  brackets.renderOrder = 10;
  brackets.visible = false;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ring.visible = false;
  world.scene.add(brackets, ring);
  let selBox = null, selGet = null;

  function highlight(getBox) {
    selGet = getBox;
    selBox = getBox?.() || null;
    brackets.visible = ring.visible = !!selBox;
  }

  /* ---------- Picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmpBox = new THREE.Box3(), hitP = new THREE.Vector3();
  const segA = new THREE.Vector3(), segB = new THREE.Vector3();

  function pick(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null;
    const consider = (d, item) => { if (d != null && (!best || d < best.d)) best = { d, ...item }; };
    // Vehicles (moving and parked).
    for (const v of world.traffic?.vehicles || []) {
      if (v.hidden > 0) continue;
      tmpBox.setFromObject(v.model);
      if (v.trailer) tmpBox.expandByObject(v.trailer);
      if (ray.ray.intersectBox(tmpBox, hitP)) consider(hitP.distanceTo(ray.ray.origin) - 2, { kind: 'vehicle', ref: v });
    }
    // Humanoid robots (capsule test), drones and AMRs.
    for (const p of world.robots?.humans.list || []) {
      segA.set(p.pos.x, p.pos.y + 0.2, p.pos.z);
      segB.set(p.pos.x, p.pos.y + 1.8, p.pos.z);
      const d2 = ray.ray.distanceSqToSegment(segA, segB, hitP);
      if (d2 < 0.55 * 0.55) consider(hitP.distanceTo(ray.ray.origin) - 3, { kind: 'robot', ref: p });
    }
    for (const d of world.robots?.drones || []) {
      if (ray.ray.distanceSqToPoint(d.position) < 2.2 * 2.2) consider(d.position.distanceTo(ray.ray.origin) - 3, { kind: 'drone', ref: d });
    }
    for (const a of world.robots?.amrs || []) {
      if (ray.ray.distanceSqToPoint(a.a.position) < 1.4 * 1.4) consider(a.a.position.distanceTo(ray.ray.origin) - 2, { kind: 'amr', ref: a });
    }
    // Buildings (footprint boxes).
    for (const b of world.site?.list.values() || []) {
      if (ray.ray.intersectBox(b.box, hitP)) consider(hitP.distanceTo(ray.ray.origin), { kind: 'building', ref: b });
    }
    return best;
  }

  let pulse = 0;
  return {
    flyTo,
    frameBox,
    setFollow,
    highlight,
    pick,
    get following() { return !!follow; },
    view(name) {
      const v = VIEWS[name];
      setFollow(null);
      flyTo(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), 2.0);
    },
    update(dt) {
      if (fly.active) {
        fly.t += dt / fly.dur;
        const u = ease(Math.min(1, fly.t));
        // Arc upwards a little on long flights.
        const lift = Math.sin(u * Math.PI) * Math.min(80, fly.p0.distanceTo(fly.p1) * 0.15);
        camera.position.lerpVectors(fly.p0, fly.p1, u).y += lift;
        controls.target.lerpVectors(fly.t0, fly.t1, u);
        if (fly.t >= 1) fly.active = false;
      }
      if (follow) {
        const p = follow.get();
        const target = new THREE.Vector3(p.x, p.y + follow.lift, p.z);
        if (fly.active) {
          fly.t1.copy(target); // keep homing on the moving object
          fly.p1.add(target.clone().sub(lastTarget));
        } else {
          const delta = target.clone().sub(controls.target);
          controls.target.add(delta);
          camera.position.add(delta);
        }
        lastTarget.copy(target);
      }
      if (selGet && brackets.visible) {
        selBox = selGet();
        if (selBox) {
          const size = selBox.getSize(new THREE.Vector3()), min = selBox.min;
          brackets.position.copy(min);
          brackets.scale.set(Math.max(size.x, 0.5), Math.max(size.y, 0.5), Math.max(size.z, 0.5));
          pulse += dt;
          const r = Math.max(size.x, size.z) * 0.62 + 1;
          ring.position.set((selBox.min.x + selBox.max.x) / 2, 0.12, (selBox.min.z + selBox.max.z) / 2);
          ring.scale.setScalar(r * (1 + 0.06 * Math.sin(pulse * 4)));
          ring.material.opacity = 0.55 + 0.3 * Math.sin(pulse * 4);
        }
      }
    },
  };
}
