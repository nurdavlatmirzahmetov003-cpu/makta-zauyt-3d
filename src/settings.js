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

export const TIMES = {
  day: { el: 38, az: 232, night: 0 },
  sunset: { el: 3.5, az: 258, night: 0.55 },
  night: { el: -14, az: 250, night: 1 },
};

export function createTimeOfDay(world) {
  const cur = { ...TIMES.day };
  let from = null, to = null, t = 1, pm = 0, mode = 'day';
  const listeners = [];
  const emit = () => { for (const f of listeners) f(mode, cur.night); };
  return {
    get mode() { return mode; },
    get night() { return cur.night; },
    onChange(f) { listeners.push(f); },
    set(m) {
      if (!TIMES[m]) return;
      mode = m;
      from = { ...cur };
      to = TIMES[m];
      t = 0;
      emit();
    },
    cycle() {
      const order = ['day', 'sunset', 'night'];
      this.set(order[(order.indexOf(mode) + 1) % 3]);
    },
    update(dt) {
      if (t >= 1 || !to) return;
      t = Math.min(1, t + dt / 2.5);
      const u = t * t * (3 - 2 * t);
      cur.el = from.el + (to.el - from.el) * u;
      cur.az = from.az + (to.az - from.az) * u;
      cur.night = from.night + (to.night - from.night) * u;
      setNightLevel(cur.night);
      pm += dt;
      // The PMREM environment is regenerated only a few times during the blend.
      if (pm > 0.22 || t >= 1) { pm = 0; world.env.setSun(cur.el, cur.az); }
      emit();
    },
  };
}
