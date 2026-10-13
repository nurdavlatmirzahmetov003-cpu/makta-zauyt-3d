// Simulation clock: game time of day in minutes (0–1440) and the day number. 1× = one game minute
// per real second; the returned simDt (seconds) drives every animation, so 30× runs 30 times faster.
export const SPEEDS = [0, 1, 2, 5, 10, 30];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function createClock({ start = 7 * 60 + 40, day = 1 } = {}) {
  let minutes = start, dayN = day, speed = 1, lastSpeed = 1, warp = null;
  const listeners = { day: [], speed: [] };
  const emit = (k, v) => { for (const f of listeners[k]) f(v); };

  function advance(m) {
    minutes += m;
    while (minutes >= 1440) {
      minutes -= 1440;
      dayN++;
      emit('day', dayN);
    }
  }
  return {
    get minutes() { return minutes; },
    get day() { return dayN; },
    get speed() { return speed; },
    get warping() { return !!warp; },
    on(k, f) { listeners[k].push(f); },
    setSpeed(s) {
      if (s > 0) lastSpeed = s;
      speed = s;
      emit('speed', s);
    },
    togglePause() { this.setSpeed(speed === 0 ? lastSpeed : 0); },
    /** Fast-forward (never backwards) to the given time of day over `dur` real seconds. */
    jumpTo(target, dur = 2.5) {
      let d = target - minutes;
      if (d <= 0) d += 1440;
      warp = { from: 0, total: d, done: 0, t: 0, dur };
    },
    /** Advance by a real frame time; returns the simulation step in seconds. */
    update(realDt) {
      const simDt = realDt * speed;
      if (warp) {
        warp.t += realDt;
        const k = ease(Math.min(1, warp.t / warp.dur));
        const goal = warp.total * k;
        advance(goal - warp.done);
        warp.done = goal;
        if (k >= 1) warp = null;
      } else {
        advance(simDt); // 1 sim second = 1 game minute
      }
      return simDt;
    },
    format(m = minutes) {
      const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    },
  };
}
