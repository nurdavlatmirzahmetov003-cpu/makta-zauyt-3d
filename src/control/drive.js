// «🎮 РОБОТТЫ БАСҚАРУ» in the factory: pick a humanoid or a drone and drive it in third person with the
// joystick (or WASD). Buildings and traffic block the way; humanoids stay on the ground, drones keep a
// minimum altitude. «Шығу» sends the robot back to its autonomous task.
import * as THREE from 'three';
import './drive.css';
import { createJoystick } from '../ui/joystick.js';
import { groundY } from '../crowd.js';

export const DRIVE_TEXT = {
  title: 'Роботты басқару', pick: 'Қай роботты басқарасыз?', humanoid: '🤖 Гуманоид робот', drone: '🚁 Дрон',
  exit: 'Шығу', up: 'Жоғары', down: 'Төмен', hint: 'Джойстикпен немесе WASD пернелерімен басқарыңыз',
  blocked: 'Алда кедергі бар',
};

export function createDrive({ camera, controls, world, cameraman, root, toast }) {
  const joy = createJoystick(document.body);
  joy.visible = false;
  const pop = document.createElement('section');
  pop.className = 'dv-pop glass';
  pop.hidden = true;
  pop.innerHTML = `<h4>${DRIVE_TEXT.pick}</h4><button data-dv="humanoid">${DRIVE_TEXT.humanoid}</button><button data-dv="drone">${DRIVE_TEXT.drone}</button>`;
  const bar = document.createElement('div');
  bar.className = 'dv-bar glass';
  bar.hidden = true;
  bar.innerHTML = `<span class="dv-name"></span><small>${DRIVE_TEXT.hint}</small>
    <button data-dv="up" class="dv-alt" aria-label="${DRIVE_TEXT.up}">▲</button><button data-dv="down" class="dv-alt" aria-label="${DRIVE_TEXT.down}">▼</button>
    <button data-dv="exit" class="dv-exit">${DRIVE_TEXT.exit}</button>`;
  root.append(pop, bar);
  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-dv]')?.dataset.dv;
    if (a === 'humanoid' || a === 'drone') start(a);
    if (a === 'exit') exit();
    if (a === 'up') alt += 4;
    if (a === 'down') alt -= 4;
  });

  let active = null, alt = 0, heading = 0, lastBlock = 0;
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const v3 = new THREE.Vector3();

  function start(kind) {
    pop.hidden = true;
    world.tour?.exit();
    world.guide?.exit();
    cameraman.stop();
    cameraman.highlight(null);
    const near = controls.target;
    if (kind === 'humanoid') {
      const list = world.robots.humans.list.filter((p) => p.path && !p.indoor && !p.resting);
      const p = list.sort((a, b) => a.pos.distanceTo(near) - b.pos.distanceTo(near))[0];
      if (!p) return;
      p.manual = true;
      active = { kind, ref: p, pos: p.pos, name: DRIVE_TEXT.humanoid };
      heading = p.yawNow;
    } else {
      const d = [...world.robots.drones].sort((a, b) => a.position.distanceTo(near) - b.position.distanceTo(near))[0];
      d.userData.manual = true;
      active = { kind, ref: d, pos: d.position, name: DRIVE_TEXT.drone };
      alt = d.position.y;
      heading = d.rotation.y;
    }
    bar.querySelector('.dv-name').textContent = active.name;
    bar.querySelectorAll('.dv-alt').forEach((b) => { b.hidden = kind !== 'drone'; });
    bar.hidden = false;
    joy.visible = true;
    cam.pos.copy(camera.position);
    cam.look.copy(controls.target);
    document.body.classList.add('driving');
  }
  function exit() {
    if (!active) return;
    if (active.kind === 'humanoid') { active.ref.manual = false; active.ref.manualMoving = false; active.ref.returning = true; }
    else { active.ref.userData.manual = false; active.ref.userData.returning = true; }
    active = null;
    bar.hidden = true;
    joy.visible = false;
    controls.target.copy(cam.look);
    document.body.classList.remove('driving');
  }

  /** Blocked by a building (XZ footprint, below its top) or by a vehicle. */
  function blocked(x, y, z, r) {
    for (const b of world.site.list.values()) {
      const bx = b.box;
      if (y < bx.max.y + (active.kind === 'drone' ? 2 : 0) && x > bx.min.x - r && x < bx.max.x + r && z > bx.min.z - r && z < bx.max.z + r) return true;
    }
    if (active.kind === 'humanoid') {
      for (const v of world.traffic?.vehicles || []) {
        if (v.hidden > 0) continue;
        if (Math.hypot(v.pos.x - x, v.pos.z - z) < 3.2) return true;
        if (v.trailer && Math.hypot(v.trailer.position.x - x, v.trailer.position.z - z) < 3.4) return true;
      }
    }
    return false;
  }

  return {
    get active() { return !!active; },
    get playing() { return !!active; },
    openPicker() { if (active) exit(); else pop.hidden = !pop.hidden; },
    start, exit,
    update(dt) {
      if (!active) return;
      const j = joy.value, P = active.pos;
      const camYaw = Math.atan2(camera.position.x - P.x, camera.position.z - P.z);
      const speed = active.kind === 'drone' ? 10 : 2.2;
      const moving = Math.abs(j.x) > 0.08 || Math.abs(j.y) > 0.08;
      if (moving) {
        // Stick up = away from the camera.
        const dx = -Math.sin(camYaw) * j.y + Math.cos(camYaw) * j.x, dz = -Math.cos(camYaw) * j.y - Math.sin(camYaw) * j.x;
        const n = Math.hypot(dx, dz) || 1;
        const nx = P.x + (dx / n) * speed * dt * Math.min(1, Math.hypot(j.x, j.y)), nz = P.z + (dz / n) * speed * dt * Math.min(1, Math.hypot(j.x, j.y));
        const y = active.kind === 'drone' ? alt : P.y + 0.5;
        if (!blocked(nx, y, nz, active.kind === 'drone' ? 1.2 : 0.45) && Math.abs(nx) < 640 && Math.abs(nz) < 640) { P.x = nx; P.z = nz; }
        else if (performance.now() - lastBlock > 2500) { lastBlock = performance.now(); toast?.(`⛔ ${DRIVE_TEXT.blocked}`); }
        heading = Math.atan2(dx, dz);
      }
      if (active.kind === 'humanoid') {
        const p = active.ref;
        P.y = groundY(P.x, P.z);
        p.manualMoving = moving;
        let d = heading - p.yawNow;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        p.yawNow += d * Math.min(1, dt * 8);
      } else {
        // Drones keep at least 8 m, and stay above roofs when flying over buildings.
        alt = THREE.MathUtils.clamp(alt, 8, 120);
        let floor = 8;
        for (const b of world.site.list.values()) if (b.box.containsPoint(v3.set(P.x, b.box.min.y + 0.1, P.z))) floor = Math.max(floor, b.box.max.y + 3);
        alt = Math.max(alt, floor);
        P.y += (alt - P.y) * Math.min(1, dt * 2);
        const d = active.ref;
        let dy = heading - d.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        d.rotation.y += dy * Math.min(1, dt * 4);
        d.rotation.x = moving ? 0.25 : 0.05;
      }
      // Third-person camera: behind the robot along its heading.
      const back = active.kind === 'drone' ? 16 : 7, up = active.kind === 'drone' ? 6 : 3.2;
      v3.set(P.x - Math.sin(heading) * back, P.y + up, P.z - Math.cos(heading) * back);
      const k = 1 - Math.exp(-dt * 3);
      cam.pos.lerp(v3, k);
      cam.look.lerp(v3.set(P.x, P.y + (active.kind === 'drone' ? 0 : 1.2), P.z), 1 - Math.exp(-dt * 6));
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
      controls.target.copy(cam.look);
    },
  };
}
