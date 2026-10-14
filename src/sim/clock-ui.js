// Top-bar clock widget (time, day, phase, ⏸ 1× 2× 5× 10× 30×), keyboard shortcuts, the night
// battery card and the «Бүгінгі көрсеткіштер» KPI panel fed by the economy engine.
import { CLOCK_TEXT as CT, KPI_TEXT as KT, ECONOMY } from '../data.js';
import { SPEEDS } from './clock.js';
import { phaseAt } from './life.js';
import './sim.css';
import { num, money, tons, litres, pct } from './format.js';

const PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const ICON = { night: '🌙', sleep: '🌙', dawn: '🌅', wake: '🌅', closing: '🌇', work: '☀️', lunch: '☀️' };

export function createClockUI({ root, clock, life, economy, toast, tourActive = () => false }) {
  const top = root.querySelector('.topbar');
  const w = document.createElement('div');
  w.className = 'clock-w';
  w.innerHTML = `
    <button class="cw-main" data-k="kpi" aria-label="${KT.open}">
      <span class="cw-ico">☀️</span>
      <span class="cw-txt"><b class="cw-time">00:00</b><span class="cw-sub"><i class="cw-day"></i><i class="cw-phase"></i></span></span>
    </button>
    <div class="cw-speeds" role="group" aria-label="${CT.speed}">
      ${SPEEDS.map((s) => `<button data-s="${s}" aria-label="${s === 0 ? CT.pause : `${s}×`}">${s === 0 ? PAUSE : `${s}×`}</button>`).join('')}
    </div>`;
  top.insertBefore(w, top.querySelector('.counters'));

  const nightCard = document.createElement('div');
  nightCard.className = 'night-card glass';
  nightCard.hidden = true;
  nightCard.innerHTML = '<b class="nc-txt"></b><div class="nc-bar"><i></i></div><small>🛡️ ' + CT.guard + '</small>';
  root.appendChild(nightCard);

  const pop = document.createElement('section');
  pop.className = 'kpi-pop glass';
  pop.hidden = true;
  root.appendChild(pop);

  const $ = (s) => w.querySelector(s);
  const markSpeed = () => w.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s === clock.speed));
  clock.on('speed', markSpeed);
  markSpeed();
  clock.on('day', (d) => toast?.(CT.newDay(d)));
  w.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.s != null) clock.setSpeed(+b.dataset.s);
    if (b.dataset.k === 'kpi') { pop.hidden = !pop.hidden; renderKPI(); }
  });
  root.querySelector('.counters')?.addEventListener('click', () => { pop.hidden = !pop.hidden; renderKPI(); });
  pop.addEventListener('click', (ev) => { if (ev.target.closest('[data-k="kpi-close"]')) pop.hidden = true; });
  addEventListener('keydown', (ev) => {
    if (ev.target.closest?.('input, textarea') || tourActive()) return;
    if (ev.key === ' ') { ev.preventDefault(); clock.togglePause(); }
    const n = '12345'.indexOf(ev.key);
    if (n >= 0) clock.setSpeed(SPEEDS[n + 1]);
  });

  function renderKPI() {
    if (pop.hidden) return;
    const k = economy.kpis(), u = KT.units;
    const rows = [
      ['raw', tons(k.raw)], ['fibre', tons(k.fibre)], ['oil', litres(k.oil)], ['garments', `${num(k.garments)} ${u.pcs}`],
      ['trucks', `${num(k.trucks)} ${u.trucks}`], ['revenue', money(k.revenue)], ['cost', money(k.cost)],
      ['profit', money(k.profit), k.profit >= 0 ? 'pos' : 'neg'], ['margin', pct(k.margin)],
      ['energy', `${num(k.energyMWh, 1)} ${u.mwh}`], ['co2', tons(k.co2)], ['robots', num(economy.activeRobots())],
    ];
    // The frame (with the close button) is built once; only the values refresh, so taps never hit a replaced node.
    if (!pop.firstChild) {
      pop.innerHTML = `
        <div class="kp-head"><h3></h3><button class="icon-btn" data-k="kpi-close" aria-label="✕">✕</button></div>
        <p class="kp-note">${ECONOMY.note}</p>
        <div class="kp-grid"></div>
        <div class="kp-foot"></div>`;
    }
    pop.querySelector('h3').textContent = KT.today(clock.day, clock.format());
    pop.querySelector('.kp-grid').innerHTML = rows.map(([key, v, cls = '']) => `<div class="kp ${cls}"><span>${KT[key]}</span><b>${v}</b></div>`).join('');
    pop.querySelector('.kp-foot').innerHTML = `⚡ ${KT.electricity}: <b>${money(k.electricity)}</b> · ☀️ ${KT.saved}: <b>${money(k.saved)}</b>`;
  }

  let lastMin = -1, kpiT = 0;
  return {
    update(dt) {
      const m = Math.floor(clock.minutes), ph = phaseAt(clock.minutes);
      if (m !== lastMin) {
        lastMin = m;
        $('.cw-time').textContent = clock.format();
        $('.cw-day').textContent = CT.day(clock.day);
        $('.cw-phase').textContent = CT.phases[ph];
        $('.cw-ico').textContent = ICON[ph];
        const c = life.state.charge;
        nightCard.hidden = c == null;
        if (c != null) {
          nightCard.querySelector('.nc-txt').textContent = '🔋 ' + CT.charging(c);
          nightCard.querySelector('.nc-bar i').style.transform = `scaleX(${(c / 100).toFixed(3)})`;
        }
      }
      if ((kpiT += dt) > 0.5) { kpiT = 0; renderKPI(); }
    },
  };
}
