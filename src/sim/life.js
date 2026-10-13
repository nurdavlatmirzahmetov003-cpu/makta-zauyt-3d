// The factory's day: wake-up light wave at 06:30, full shift, lunch, closing at 20:00, sleep at 21:00,
// night with security only. Everything is a function of the clock, so speed-ups and jumps stay smooth.
import * as THREE from 'three';
import { STAGES, CLOCK_TEXT as CT, PALETTE } from '../data.js';

const WAKE = 6 * 60 + 30, CLOSE = 20 * 60, SLEEP = 21 * 60, LUNCH = [12 * 60, 12 * 60 + 50];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CHAIN = STAGES.map((s) => s.building);
const waveAt = (i) => WAKE + 1 + i * 1.2; // buildings power up one after another along the chain

export function phaseAt(m) {
  if (m < 5 * 60 + 30) return 'night';
  if (m < WAKE) return 'dawn';
  if (m < 7 * 60) return 'wake';
  if (m >= LUNCH[0] && m < 13 * 60) return 'lunch';
  if (m < CLOSE) return 'work';
  if (m < SLEEP) return 'closing';
  if (m < SLEEP + 30) return 'sleep';
  return 'night';
}

export function createLife({ clock, world, scene, toast }) {
  const { production, traffic, robots, site } = world;
  const state = { phase: phaseAt(clock.minutes), power: 1, accepting: true, working: true, lunch: false, sleep: false, charge: null };
  const bpow = new Map();
  const buildingPower = (id) => bpow.get(id) ?? state.power;
  production.schedule.buildingPower = buildingPower;

  // Wake-up light wave: a glowing outline flashes over each production building in chain order.
  const outlines = CHAIN.map((id) => {
    const sp = site.list.get(id).spec, h = (sp.h || 14) + 1.5;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(sp.w + 1, h, sp.d + 1)).translate(sp.cx, h / 2, sp.cz);
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    // A soft glowing shell makes the wave readable from far away.
    const shell = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 1.2, h + 0.2, sp.d + 1.2).translate(sp.cx, h / 2, sp.cz),
      new THREE.MeshBasicMaterial({ color: '#2ff0d2', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
    line.visible = shell.visible = false;
    scene.add(line, shell);
    return { line, shell };
  });

  // Trucks only start trips while the schedule allows them.
  for (const v of traffic?.vehicles || []) {
    if (v.name === 'cotton') v.canRespawn = () => state.accepting;
    else if (['semi', 'tanker', 'bales'].includes(v.name)) v.canRespawn = () => state.working;
  }

  let flushedDay = -1;
  function update() {
    const m = clock.minutes;
    state.power = smooth(WAKE, WAKE + 20, m) * (1 - smooth(SLEEP, SLEEP + 20, m));
    state.accepting = m >= WAKE && m < CLOSE;
    state.working = m >= WAKE && m < SLEEP;
    state.lunch = m >= LUNCH[0] && m < LUNCH[1];
    state.sleep = m >= SLEEP || m < WAKE;
    state.charge = state.sleep ? Math.round(64 + 36 * Math.min(1, (((m - SLEEP) + 1440) % 1440) / (WAKE + 1440 - SLEEP))) : null;
    const down = 1 - smooth(SLEEP, SLEEP + 20, m);
    CHAIN.forEach((id, i) => {
      const w = waveAt(i);
      bpow.set(id, smooth(w, w + 4, m) * down);
      const k = m >= w && m < w + 8 ? Math.sin(Math.PI * Math.min(1, (m - w) / 8)) : 0;
      const o = outlines[i];
      o.line.visible = o.shell.visible = k > 0.01;
      o.line.material.opacity = k;
      o.shell.material.opacity = 0.38 * k;
    });
    production.schedule.accepting = state.accepting;
    production.schedule.power = state.power;
    robots?.setSchedule({ sleep: state.sleep, lunch: state.lunch, power: state.power });
    // The last export truck of the day leaves with whatever is loaded.
    if (m >= CLOSE + 30 && m < SLEEP && flushedDay !== clock.day) { flushedDay = clock.day; traffic?.flushExport(); }
    const ph = phaseAt(m);
    if (ph !== state.phase) {
      if (ph === 'wake') toast?.(CT.wakeToast);
      if (ph === 'sleep') toast?.(CT.sleepToast);
      state.phase = ph;
    }
  }
  update();
  return { state, buildingPower, update };
}
