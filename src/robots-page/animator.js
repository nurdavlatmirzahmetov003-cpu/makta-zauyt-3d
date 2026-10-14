// Turntable robot animator: commands (wave, dance, move, turn, spin, jump, sit / stand, lights, colour,
// work, stop) and joystick driving within the stage radius; feeds the model's rig every frame.
import * as THREE from 'three';
import { PALETTE } from '../data.js';

export const ACCENTS = [['көгілдір', PALETTE.teal], ['алтын', PALETTE.gold], ['маржан түсті', '#ff7f6e'], ['күлгін', '#b58cff']];
const SPEED = { humanoid: 1.3, wheeled: 1.7, flyer: 2.2, legged: 0.9, arm: 0 };

export function createAnimator(root, rig, { radius = 2.6, onAccent = null } = {}) {
  const kind = rig.kind;
  const st = { pos: new THREE.Vector2(), tPos: new THREE.Vector2(), yaw: 0, tYaw: 0, action: 'idle', aT: 0, sit: 0, tSit: 0, jump: -1, spin: 0, light: true, accent: 0, talkT: 0 };
  let t = 0;
  const base = rig.hover || 0;
  const clamp = (v) => { if (v.length() > radius) v.setLength(radius); return v; };
  const fwd = () => new THREE.Vector2(Math.sin(st.yaw), Math.cos(st.yaw));

  function setLight(on, beam = true) {
    st.light = on;
    for (const m of rig.lights) m.emissiveIntensity = on ? 1.6 : 0.04;
    if ('light' in rig && beam) rig.light = on; // Маржан's headlight beam only on request
  }
  function setAccent(i) {
    st.accent = i % ACCENTS.length;
    const c = ACCENTS[st.accent][1];
    for (const m of rig.accents) { m.color.set(c); if (m.emissive) m.emissive.set(c); }
    onAccent?.(c);
  }
  setLight(true, false);

  /** Run a command; returns a hint for the reply ('ok' | 'cant' | 'stationary'). */
  function command(id) {
    st.aT = 0;
    switch (id) {
      case 'hello': case 'wave': st.action = 'wave'; return 'ok';
      case 'dance': st.action = 'dance'; return 'ok';
      case 'work': st.action = 'work'; return 'ok';
      case 'stop': st.action = 'idle'; st.tPos.copy(st.pos); st.spin = 0; return 'ok';
      case 'forward': case 'back':
        if (!SPEED[kind]) return 'stationary';
        st.action = 'idle';
        st.tPos.copy(st.pos).addScaledVector(fwd(), id === 'forward' ? 1.4 : -1.4);
        clamp(st.tPos);
        return 'ok';
      case 'right': st.tYaw -= Math.PI / 2; return 'ok';
      case 'left': st.tYaw += Math.PI / 2; return 'ok';
      case 'spin': st.spin = Math.PI * 2; return 'ok';
      case 'jump': st.jump = 0; return kind === 'humanoid' || kind === 'flyer' || kind === 'legged' ? 'ok' : 'cant';
      case 'sit': st.tSit = 1; return kind === 'humanoid' || kind === 'legged' || kind === 'flyer' ? 'ok' : 'cant';
      case 'stand': st.tSit = 0; return 'ok';
      case 'lightOn': setLight(true); return 'ok';
      case 'lightOff': setLight(false); return 'ok';
      case 'color': setAccent(st.accent + 1); return 'ok';
      default: return 'ok';
    }
  }

  return {
    st, command, setAccent,
    get accentName() { return ACCENTS[st.accent][0]; },
    talk(sec = 2.5) { st.talkT = sec; },
    reset() { st.pos.set(0, 0); st.tPos.set(0, 0); st.yaw = st.tYaw = 0; st.action = 'idle'; st.sit = st.tSit = 0; },
    /** joy = { x, y } from the joystick (camera-relative directions are resolved by the page). */
    update(dt, joy = null, camYaw = 0) {
      t += dt;
      st.aT += dt;
      if (st.action === 'wave' && st.aT > 2.6) st.action = 'idle';
      st.talkT -= dt;
      const sp = SPEED[kind];
      let moving = false;
      if (joy && (Math.abs(joy.x) > 0.08 || Math.abs(joy.y) > 0.08) && sp) {
        // Stick up = away from the camera.
        const dx = -Math.sin(camYaw) * joy.y + Math.cos(camYaw) * joy.x, dz = -Math.cos(camYaw) * joy.y - Math.sin(camYaw) * joy.x;
        st.pos.x += dx * sp * dt;
        st.pos.y += dz * sp * dt;
        clamp(st.pos);
        st.tPos.copy(st.pos);
        st.tYaw = Math.atan2(dx, dz);
        moving = true;
      } else if (joy && Math.abs(joy.x) > 0.08 && !sp) {
        st.tYaw -= joy.x * dt * 1.5; // the arm only turns
      }
      // Job animations with motion: carts drive a loop, the spider walks, flyers circle.
      if (st.action === 'work' && sp && kind !== 'humanoid') {
        const a = st.aT * 0.6;
        st.tPos.set(Math.sin(a) * 1.3, Math.cos(a) * 1.3 - 1.3);
        st.tYaw = Math.atan2(Math.cos(a), -Math.sin(a));
      }
      const d = st.tPos.clone().sub(st.pos);
      if (d.length() > 0.02 && sp) {
        const step = Math.min(d.length(), sp * dt);
        st.pos.addScaledVector(d.normalize(), step);
        moving = true;
        if (st.action !== 'work' && !joy?.y && !joy?.x) {
          // Back up without turning around when moving backwards.
          const dirYaw = Math.atan2(d.x, d.y);
          if (Math.cos(dirYaw - st.yaw) > -0.2) st.tYaw = dirYaw;
        }
      }
      if (st.spin > 0) { const s = Math.min(st.spin, dt * 4); st.spin -= s; st.yaw += s; st.tYaw += s; }
      let dy = st.tYaw - st.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      st.yaw += dy * Math.min(1, dt * 6);
      st.sit += (st.tSit - st.sit) * Math.min(1, dt * 4);
      let y = base;
      if (st.jump >= 0) {
        st.jump += dt;
        const j = st.jump / (kind === 'flyer' ? 1.2 : 0.7);
        y += Math.sin(Math.PI * Math.min(1, j)) * (kind === 'flyer' ? 1.2 : kind === 'humanoid' ? 0.55 : 0.25);
        if (j >= 1) st.jump = -1;
      }
      if (kind === 'flyer') y += Math.sin(t * 2) * 0.06 - st.sit * (base - 0.25);
      if (st.action === 'dance' && kind !== 'humanoid') { st.yaw += Math.sin(t * 6) * dt * 3; y += Math.abs(Math.sin(t * 6)) * (kind === 'flyer' ? 0.3 : 0.06); }
      root.position.set(st.pos.x, y, st.pos.y);
      root.rotation.y = st.yaw;
      rig.update(dt, { t, moving, action: st.action, sit: st.sit, talking: st.talkT > 0 });
      return moving;
    },
  };
}
