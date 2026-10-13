// Quality presets (Төмен / Орташа / Жоғары) with FPS-based auto-downgrade, and time of day
// (КҮН / КҮН БАТУ / ТҮН) blended over 2.5 s. Phase 8 refines the lighting on top of this.
import { setNightLevel } from './materials.js';

const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
export const QUALITY = {
  low: { pr: 1, shadows: false, map: 1024 },
  mid: { pr: 1.5, shadows: true, map: 2048 },
  high: { pr: 2, shadows: true, map: 4096 },
};
const ORDER = ['low', 'mid', 'high'];

export function createQuality(renderer, world, { onAuto } = {}) {
  let level = IS_TOUCH ? 'mid' : 'high';
  let acc = 0, frames = 0, low = 0, fps = 60, cooldown = 0;
  const listeners = [];
  function apply(l) {
    level = l;
    const p = QUALITY[l];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, p.pr, IS_TOUCH ? 1.5 : 2)); // touch cap 1.5
    const sun = world.env?.sun;
    if (sun) {
      sun.castShadow = p.shadows;
      if (sun.shadow.mapSize.x !== p.map) {
        sun.shadow.mapSize.set(p.map, p.map);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
    for (const f of listeners) f(l);
  }
  apply(level);
  return {
    get level() { return level; },
    get fps() { return fps; },
    set: apply,
    onChange(f) { listeners.push(f); },
    update(dt) {
      acc += dt;
      frames++;
      cooldown = Math.max(0, cooldown - dt);
      if (acc < 0.5) return;
      fps = frames / acc;
      acc = 0;
      frames = 0;
      // Auto-downgrade one level if FPS stays below 25 for 3 seconds (not in automated tests).
      low = fps < 25 ? low + 0.5 : 0;
      if (low >= 3 && cooldown === 0 && level !== 'low' && !navigator.webdriver) {
        apply(ORDER[ORDER.indexOf(level) - 1]);
        low = 0;
        cooldown = 10;
        onAuto?.(level);
      }
    },
  };
}

// Phase 10: the light follows the simulation clock. The dock buttons jump the clock instead.
export const TIME_JUMPS = { day: 12 * 60, sunset: 19 * 60 + 30, night: 23 * 60, golden: 19 * 60 + 10 };
const RISE = 6 * 60, SET = 19 * 60 + 55;

/** Sun elevation / azimuth (degrees) for a time of day in minutes. Azimuth from north, clockwise. */
export function sunAt(m) {
  if (m >= RISE && m <= SET) {
    const u = (m - RISE) / (SET - RISE);
    return { el: 56 * Math.sin(Math.PI * u), az: 95 + 170 * u };
  }
  const v = (((m - SET) % 1440) + 1440) % 1440 / (1440 - (SET - RISE));
  return { el: -24 * Math.sin(Math.PI * v), az: 265 + 190 * v };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const modeAt = (m) => (m >= 21 * 60 + 30 || m < 5 * 60 + 30 ? 'night' : m >= 18 * 60 + 30 || m < 6 * 60 + 30 ? 'sunset' : 'day');

export function createTimeOfDay(world, clock, { getWork = () => 1 } = {}) {
  let mode = modeAt(clock.minutes), night = 0, lastEnv = null, envT = 9, emitted = -1;
  const listeners = [];
  const emit = () => { for (const f of listeners) f(mode, night); };
  function apply(realDt, force = false) {
    const { el, az } = sunAt(clock.minutes);
    night = 1 - smooth(-5, 8, el);
    setNightLevel(night, getWork());
    envT += realDt;
    // Light and shadows move every frame; the PMREM reflections only when the sky changed enough.
    const needEnv = force || !lastEnv || ((Math.abs(el - lastEnv.el) > 0.8 || Math.abs(az - lastEnv.az) > 4) && envT > 0.3);
    world.env.setSun(el, az, { env: needEnv });
    if (needEnv) { lastEnv = { el, az }; envT = 0; }
    const m = modeAt(clock.minutes);
    if (m !== mode || Math.abs(night - emitted) > 0.02) { mode = m; emitted = night; emit(); }
  }
  return {
    get mode() { return mode; },
    get night() { return night; },
    onChange(f) { listeners.push(f); },
    set(m) { if (TIME_JUMPS[m] != null) clock.jumpTo(TIME_JUMPS[m]); },
    cycle() {
      const order = ['day', 'sunset', 'night'];
      this.set(order[(order.indexOf(mode) + 1) % 3]);
    },
    /** Tour finale: jump to golden hour, but only forward within the same working day. */
    golden() { const m = clock.minutes; if (m > 7 * 60 && m < 19 * 60) clock.jumpTo(TIME_JUMPS.golden); },
    update(realDt) { apply(realDt); },
    init() { apply(0, true); },
  };
}
