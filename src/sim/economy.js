// Economy engine: books production, revenue and costs from the real simulation events (raw units
// spawned, bales pressed, bottles filled, garments sewn, boxes dispatched, trucks leaving), plus hourly
// costs and the energy balance. Today (with hourly buckets), yesterday and the whole session.
import { ECONOMY as E } from '../data.js';

const UNIT = E.rawPerUnit; // t of raw cotton per product unit
const FIBRE_T = UNIT * E.split.fibre, SEED_T = UNIT * E.split.seed, WASTE_T = UNIT * E.split.waste;
const OIL_L = SEED_T * E.oilPerSeedT;
const SOLD_FIBRE_KG = FIBRE_T * E.fibreSoldShare * 1000;
const GARMENTS = FIBRE_T * (1 - E.fibreSoldShare) * E.garmentsPerFibreT; // per garment / box item

function blank(day) {
  return {
    day, raw: 0, fibre: 0, seed: 0, oil: 0, garments: 0, boxes: 0, trucks: 0,
    revenue: 0, cost: 0,
    rev: { garments: 0, oil: 0, fibre: 0, biogas: 0 },
    costs: { raw: 0, robots: 0, dye: 0, pack: 0, logistics: 0, depreciation: 0 },
    kwh: 0, usedKwh: 0, co2: 0,
    hours: Array.from({ length: 24 }, () => ({ raw: 0, garments: 0, oil: 0, revenue: 0, cost: 0 })),
  };
}
const chain = (obj, key, fn) => { const prev = obj[key]; obj[key] = (...a) => { prev?.(...a); fn(...a); }; };

export function createEconomy({ clock, world, life }) {
  const { production, traffic, robots } = world;
  const nodes = production.nodes;
  let today = blank(clock.day), yesterday = null;
  const session = blank(0);
  const pending = { boxes: 0, fibreKg: 0 };
  const listeners = [];

  const hour = () => today.hours[Math.min(23, Math.floor(clock.minutes / 60))];
  function add(key, v) {
    today[key] += v;
    session[key] += v;
    const h = hour();
    if (key in h) h[key] += v;
  }
  function revenue(part, v) {
    add('revenue', v);
    today.rev[part] += v;
    session.rev[part] += v;
  }
  function cost(part, v) {
    add('cost', v);
    today.costs[part] += v;
    session.costs[part] += v;
  }

  /* ---------- Flow events ---------- */
  const rawIn = () => { add('raw', UNIT); cost('raw', UNIT * 1000 * E.costs.rawKg); };
  chain(nodes.raw.source, 'onSpawn', rawIn);
  chain(nodes.intake.source, 'onSpawn', rawIn);
  chain(nodes.cleaning, 'onEmit', () => revenue('biogas', WASTE_T * E.biogasKwhPerWasteT * E.prices.biogasKwh));
  chain(nodes.ginning, 'onEmit', () => { add('fibre', FIBRE_T); add('seed', SEED_T); });
  chain(nodes.baling, 'onEmit', () => { pending.fibreKg += SOLD_FIBRE_KG; });
  chain(nodes.bottling, 'onEmit', () => add('oil', OIL_L));
  chain(nodes.bottleDock, 'onReceive', () => revenue('oil', OIL_L * E.prices.oilL));
  chain(nodes.dyeing, 'onEmit', () => cost('dye', E.costs.dyePerUnit));
  chain(nodes.sewing, 'onEmit', () => add('garments', GARMENTS));
  chain(nodes.packaging, 'onEmit', () => cost('pack', E.costs.packPerBox));
  chain(nodes.dispatch, 'onReceive', () => { pending.boxes++; add('boxes', 1); });

  /* ---------- Truck trips (revenue only when goods leave) ---------- */
  const trip = (exported) => { cost('logistics', E.costs.truckTrip); if (exported) add('trucks', 1); };
  for (const v of traffic?.vehicles || []) {
    if (v.name === 'semi') v.onDepart = () => { revenue('garments', pending.boxes * GARMENTS * E.prices.garment); pending.boxes = 0; trip(true); };
    else if (v.name === 'tanker') v.onDepart = () => trip(true);
    else if (v.name === 'cotton') v.onDepart = () => trip(false);
    else if (v.name === 'bales') v.onExit = () => { revenue('fibre', pending.fibreKg * E.prices.fibreKg); pending.fibreKg = 0; trip(true); };
  }

  clock.on('day', (d) => {
    yesterday = today;
    today = blank(d);
    for (const f of listeners) f(yesterday);
  });

  /* ---------- Energy and robots ---------- */
  let t = 0;
  const solarMW = () => E.energy.solarPeakMW * Math.max(0, world.env?.sunDir?.y ?? 0);
  const windMW = () => E.energy.windMW * (0.85 + 0.15 * Math.sin(t * 0.01));
  const loadMW = () => E.energy.loadNightMW + (E.energy.loadWorkMW - E.energy.loadNightMW) * life.state.power;
  function activeRobots() {
    const c = robots?.counts || {}, p = life.state.power;
    const awake = robots ? robots.humans.list.filter((h) => !(h.resting && life.state.sleep)).length : 0;
    return Math.round(awake + (c.drones || 0) + (c.amrs || 0) * p + (25 + (c.extraArms || 0)) * (0.3 + 0.7 * p));
  }

  return {
    get today() { return today; },
    get yesterday() { return yesterday; },
    session,
    pending,
    perUnit: { fibre: FIBRE_T, oil: OIL_L, garments: GARMENTS },
    onDay(f) { listeners.push(f); },
    solarMW, windMW, loadMW, activeRobots,
    /** Hourly costs and the energy balance; `dt` in sim seconds (1 s = 1 game minute). */
    update(dt) {
      if (dt <= 0) return;
      t += dt;
      const h = dt / 60;
      cost('robots', E.costs.robotHour * life.state.power * h);
      cost('depreciation', E.costs.depreciationHour * h);
      const kwh = (solarMW() + windMW()) * 1000 * h, used = loadMW() * 1000 * h;
      add('kwh', kwh);
      add('usedKwh', used);
      add('co2', kwh * E.co2PerKwh);
    },
    /** KPI numbers for a day record (today by default). */
    kpis(d = today) {
      const profit = d.revenue - d.cost;
      return {
        raw: d.raw, fibre: d.fibre, oil: d.oil, garments: d.garments, trucks: d.trucks,
        revenue: d.revenue, cost: d.cost, profit, margin: d.cost > 0 ? (profit / d.cost) * 100 : 0,
        energyMWh: d.kwh / 1000, co2: d.co2, saved: d.usedKwh * E.costs.gridKwh, electricity: E.costs.electricity,
      };
    },
  };
}
