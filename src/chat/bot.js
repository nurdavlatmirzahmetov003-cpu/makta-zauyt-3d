// Bot brain: turns a detected intent into a Kazakh reply (+ chips, a report card or an action)
// using the live simulation: clock, day cycle, economy, robots and the scene.
import { detect } from './intents.js';
import { CHAT, REPLY } from './texts.js';
import { STAGES, BUILDINGS, CLOCK_TEXT as CT, KPI_TEXT as KT } from '../data.js';
import { SPEEDS } from '../sim/clock.js';
import { phaseAt } from '../sim/life.js';
import { num, money, tons, litres, pct } from '../sim/format.js';

const NAME = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.name]));
const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();

export function createBot(app) {
  const { clock, life, economy, world, ui, tod, actions } = app;
  const K = () => economy.kpis();
  const since = () => (clock.day === 1 ? '07:40-тан' : '06:30-дан');

  const H = {
    report: () => ({ text: REPLY.report, card: 'report' }),
    cotton: () => {
      const k = K();
      return { text: k.raw > 0 ? REPLY.cotton(tons(k.raw), tons(k.fibre), litres(k.oil), since()) : REPLY.cottonNone };
    },
    profit: () => { const k = K(); return { text: REPLY.profit(money(k.profit), money(k.revenue), money(k.cost)), chips: ['📊 Бүгінгі есеп', '📉 Шығындар'] }; },
    revenue: () => {
      const d = economy.today, r = d.rev;
      return { text: REPLY.revenue(money(d.revenue), money(r.garments), money(r.oil), money(r.fibre), money(r.biogas)), chips: ['📉 Шығындар', '📊 Бүгінгі есеп'] };
    },
    cost: () => {
      const d = economy.today;
      const [top, v] = Object.entries(d.costs).sort((a, b) => b[1] - a[1])[0];
      return { text: REPLY.cost(money(d.cost), KT.costParts[top].toLowerCase(), money(v)), chips: ['💰 Табыс қанша?', '📊 Бүгінгі есеп'] };
    },
    oil: () => ({ text: REPLY.oil(litres(economy.today.oil)) }),
    garments: () => ({ text: REPLY.garments(`${num(economy.today.garments)} дана`, num(economy.today.boxes)) }),
    energy: () => {
      const k = K();
      return { text: REPLY.energy(`${num(economy.solarMW(), 1)} МВт`, `${num(economy.windMW(), 1)} МВт`, `${num(k.energyMWh, 1)} МВт·сағ`, money(k.saved)) };
    },
    robots: () => {
      const c = world.robots.counts, p = life.state.power, sleep = life.state.sleep;
      const hum = world.robots.humans.list.filter((h) => !(h.resting && sleep)).length;
      const arms = Math.round((25 + c.extraArms) * (0.3 + 0.7 * p));
      return { text: REPLY.robots(num(economy.activeRobots()), hum, arms, Math.round(c.amrs * p), c.drones, sleep) };
    },
    time: () => ({ text: REPLY.time(clock.format(), CT.day(clock.day), CT.phases[phaseAt(clock.minutes)], clock.speed === 0 ? '⏸' : `${clock.speed}×`) }),
    busiest: () => {
      if (life.state.power < 0.05) return { text: REPLY.sleeping };
      const s = [...world.production.stations].sort((a, b) => b.act - a.act)[0];
      return { text: REPLY.busiest(title(STAGES[s.stage - 1].name), s.stage, pct(Math.min(100, s.act * 100))), action: () => ui.goStage(s.stage) };
    },
    about: () => ({ text: REPLY.about, chips: ['📊 Бүгінгі есеп', '🧭 Гидпен саяхат'] }),
    features: () => ({ text: REPLY.features, action: () => actions.features?.() }),
    help: () => ({ text: REPLY.help, chips: CHAT.chips }),
    greet: () => ({ text: REPLY.greet, chips: CHAT.chips.slice(0, 5) }),
    thanks: () => ({ text: REPLY.thanks }),
    who: () => ({ text: REPLY.who }),
    how: () => ({ text: REPLY.how(CT.phases[phaseAt(clock.minutes)].toLowerCase()) }),
    speed: (r) => {
      let n = r.speed;
      if (!SPEEDS.includes(n)) n = n ? SPEEDS.find((s) => s >= n) ?? 30 : SPEEDS.find((s) => s > clock.speed) ?? 30;
      if (n === clock.speed && n === 30) return { text: REPLY.speedMax };
      return { text: REPLY.speed(`${n}×`), action: () => clock.setSpeed(n) };
    },
    speedNormal: () => ({ text: REPLY.normal, action: () => clock.setSpeed(1) }),
    pause: () => ({ text: REPLY.pause, action: () => clock.setSpeed(0) }),
    night: () => ({ text: REPLY.night, action: () => tod.set('night') }),
    morning: () => ({ text: REPLY.morning, action: () => clock.jumpTo(6 * 60 + 20) }),
    day: () => ({ text: REPLY.day, action: () => tod.set('day') }),
    nightInfo: () => ({ text: REPLY.nightInfo, chips: ['🌙 Түнге ауыстыр'] }),
    guide: () => ({ text: REPLY.guide, action: () => actions.guide?.() }),
    // Phases 12–13 plug in `actions.explode` / `actions.robotsPage` (with their own reply texts).
    explode: () => (actions.explode ? { text: actions.explodeText, action: actions.explode } : { text: REPLY.explodeSoon }),
    robotsPage: () => (actions.robotsPage ? { text: actions.robotsPageText, action: actions.robotsPage } : { text: REPLY.robotsPageSoon, action: () => actions.robotsList?.() }),
    show: (r) => ({ text: REPLY.show(title(NAME[r.place.id] || r.place.name)), action: () => actions.show?.(r.place.id) }),
    fallback: () => ({ text: CHAT.fallback, chips: CHAT.fallbackChips }),
  };

  return {
    /** → { text, chips?, card?, action? } */
    answer(text) {
      const r = detect(text);
      return { intent: r.id, ...(H[r.id] || H.fallback)(r) };
    },
  };
}
