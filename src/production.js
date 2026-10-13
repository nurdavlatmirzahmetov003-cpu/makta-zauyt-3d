// Production line orchestration: routes every conveyor/pipe through the wall portals (incline inside,
// glass tube outside, 7 m bridges over roads), wires the flow nodes, and builds the 17 stations.
import * as THREE from 'three';
import { Line, Node, FlowSystem, addBelt, addTube, addPipe } from './flow.js';
import { createProducts } from './products.js';
import { STAGES, PALETTE } from './data.js';
import { Batch, box } from './geo.js';
import { mats, TILE } from './materials.js';
import { makeHolo, trusses } from './interior/kit.js';
import { ROADS } from './roads.js';
import { FIBRE_STATIONS } from './interior/fibre.js';
import { OIL_STATIONS } from './interior/oil.js';
import { TEXTILE_STATIONS } from './interior/textile.js';
import { LOGISTICS_STATIONS } from './interior/logistics.js';

const STATIONS = { ...FIBRE_STATIONS, ...OIL_STATIONS, ...TEXTILE_STATIONS, ...LOGISTICS_STATIONS };
const BELT_Y = 1.2, WALL_Y = 4.05, HIGH_Y = 7.25;
const DYES = ['#12b5a0', '#f5c04a', '#7cc7ff', '#ff7f6e', '#4caf6a', '#b58cff', '#fffaf0'];

// [id, from building, side, local [x, z], to building, side, local [x, z], form, kind]
const LINES = [
  ['raw', 'raw', 'S', [0, 8], 'intake', 'N', [-10, -4], 'raw', 'belt'],
  ['L1', 'intake', 'E', [-3, 0], 'cleaning', 'W', [-8, 0], 'raw', 'belt'],
  ['L2', 'cleaning', 'E', [8, 0], 'ginning', 'W', [-9, 0], 'clean', 'belt'],
  ['L3', 'ginning', 'E', [6, 0], 'baling', 'W', [-6, 0], 'fiber', 'belt'],
  ['L4', 'ginning', 'N', [-1, -12], 'seed', 'S', [0, 10], 'seed', 'belt'],
  ['L5', 'baling', 'E', [6, 0], 'bales', 'W', [-12, 0], 'bale', 'belt'],
  ['L6', 'bales', 'E', [12, 0], 'spinning', 'W', [-12, 0], 'bale', 'belt'],
  ['L7', 'spinning', 'E', [12, 0], 'weaving', 'W', [-14, 0], 'yarn', 'belt'],
  ['L8', 'weaving', 'E', [14, 0], 'dyeing', 'W', [-14, 0], 'fabric', 'belt'],
  ['L9', 'dyeing', 'S', [6, 9], 'sewing', 'N', [0, -10], 'fabric', 'belt'],
  ['L10', 'sewing', 'W', [-10, 4], 'packaging', 'E', [5.2, 0], 'garment', 'belt'],
  ['L11', 'packaging', 'W', [-5.2, 0], 'goods', 'E', [12, 0], 'box', 'belt'],
  ['L12', 'goods', 'W', [-12, 0], 'dispatch', 'E', [8, 0], 'box', 'belt'],
  ['L13', 'seed', 'E', [10, 0], 'oil', 'W', [-8, 0], 'seed', 'belt'],
  ['L14', 'oil', 'E', [8, 0], 'refine', 'W', [-8, 0], 'oil', 'pipe'],
  ['L15', 'refine', 'E', [8, 0], 'tanks', 'W', [-15, 0], 'oil', 'pipe'],
  ['L16', 'tanks', 'E', [15, 0], 'bottling', 'W', [-9, 0], 'oil', 'pipe'],
];

const OUT = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };

function isHigh(spec, side) {
  return (spec.openings || []).some((o) => o.side === side && o.kind === 'portal' && o.high);
}

/** Points from a station port (machine side) to its wall portal. */
function portPath(spec, side, [px, pz], open) {
  const [ox, oz] = OUT[side];
  const ew = side === 'E' || side === 'W';
  const half = ew ? spec.w / 2 : spec.d / 2;
  if (open) {
    return [new THREE.Vector3(spec.cx + px, WALL_Y, spec.cz + pz), new THREE.Vector3(spec.cx + ox * half, WALL_Y, spec.cz + oz * half)];
  }
  const high = isHigh(spec, side);
  const yWall = high ? HIGH_Y : WALL_Y, inc = high ? 10 : 7;
  const pts = [new THREE.Vector3(spec.cx + px, BELT_Y, spec.cz + pz)];
  const corner = ew ? new THREE.Vector3(spec.cx + px, BELT_Y, spec.cz) : new THREE.Vector3(spec.cx, BELT_Y, spec.cz + pz);
  if (corner.distanceTo(pts[0]) > 0.05) pts.push(corner);
  const depth = ew ? px * ox : pz * oz;
  if (depth < half - inc) pts.push(new THREE.Vector3(spec.cx + ox * (half - inc), BELT_Y, spec.cz + oz * (half - inc)));
  pts.push(new THREE.Vector3(spec.cx + ox * half, yWall, spec.cz + oz * half));
  return pts;
}

/** True when (x, z) lies on a road or sidewalk (no support columns there). */
function onRoad(x, z) {
  for (const r of ROADS) {
    const hw = r.w / 2 + 3.5;
    if (r.axis === 'x' ? Math.abs(z - r.c) < hw && x > r.a0 - 8 && x < r.a1 + 8 : Math.abs(x - r.c) < hw && z > r.a0 - 8 && z < r.a1 + 8) return true;
  }
  return false;
}

export function buildProduction(scene, site) {
  const m = mats();
  const products = createProducts(scene);
  const flow = new FlowSystem(products);
  const ext = new Batch();
  const inner = new Map(); // building id → Batch
  const batchOf = (id) => { if (!inner.has(id)) inner.set(id, new Batch()); return inner.get(id); };
  const spec = (id) => site.list.get(id).spec;
  const isOpen = (id) => id === 'tanks';

  // ---------- Lines ----------
  const lines = {};
  for (const [id, a, sa, pa, b, sb, pb, form, kind] of LINES) {
    const A = portPath(spec(a), sa, pa, isOpen(a));
    const Bp = portPath(spec(b), sb, pb, isOpen(b)).reverse();
    const line = new Line(id, [...A, ...Bp], { kind });
    line.form = form;
    lines[id] = line;
    const wallA = A[A.length - 1], wallB = Bp[0];
    if (kind === 'belt') {
      addBelt(batchOf(a), A);
      addBelt(batchOf(b), Bp);
      addBelt(ext, [wallA, wallB], { legs: false });
      addTube(ext, [wallA, wallB], { avoid: onRoad });
    } else {
      addPipe(batchOf(a), A);
      addPipe(batchOf(b), Bp);
      addPipe(ext, [wallA, wallB], { radius: 0.36, avoid: onRoad });
    }
  }
  // Internal bottle line from the filling carousel to the north dock.
  const bs = spec('bottling');
  lines.L17 = new Line('L17', [new THREE.Vector3(bs.cx + 3, BELT_Y, bs.cz - 4), new THREE.Vector3(bs.cx + 3, BELT_Y, bs.cz - 12),
    new THREE.Vector3(bs.cx, BELT_Y, bs.cz - 12), new THREE.Vector3(bs.cx, BELT_Y, bs.cz - 20)]);
  addBelt(batchOf('bottling'), lines.L17.path.points);

  // ---------- Nodes ----------
  const truck = { atDock: false, onUnload: null };
  const nodes = {};
  const out = (id, color) => [{ line: lines[id], form: lines[id].form, color }];
  let dye = 0;
  const N = (id, opts) => (nodes[id] = flow.addNode(new Node(id, opts)));
  N('raw', { source: { every: 6, line: lines.raw, form: 'raw', color: '#e6e1d6', when: () => !truck.atDock } });
  N('intake', {
    delay: 2.5, outputs: out('L1'),
    source: { every: 2.2, line: lines.L1, form: 'raw', color: '#e6e1d6', when: () => truck.atDock, onSpawn: () => truck.onUnload?.() },
  });
  N('cleaning', { delay: 3, outputs: out('L2', () => '#ffffff') });
  N('ginning', { delay: 3, outputs: [...out('L3', () => '#ffffff'), ...out('L4', () => '#ffffff')] });
  N('baling', { delay: 3.5, outputs: out('L5', () => '#ffffff') });
  N('bales', { delay: 6, outputs: out('L6') });
  N('spinning', { delay: 4, outputs: out('L7', () => '#fffaf0') });
  N('weaving', { delay: 4, outputs: out('L8', () => '#f3ead8') });
  N('dyeing', { delay: 4, outputs: out('L9', () => DYES[dye++ % DYES.length]) });
  N('sewing', { delay: 4, outputs: out('L10') });
  N('packaging', { delay: 3, outputs: out('L11', () => '#ffffff') });
  N('goods', { delay: 6, outputs: out('L12') });
  const hooks = { onPalletFull: null };
  N('dispatch', { sink: true, onReceive: () => { if (nodes.dispatch.count % 24 === 0) hooks.onPalletFull?.(nodes.dispatch.count / 24); } });
  N('seed', { delay: 5, outputs: out('L13') });
  N('oil', { delay: 3.5, outputs: out('L14', () => PALETTE.gold) });
  N('refine', { delay: 3, outputs: out('L15') });
  N('tanks', { delay: 6, outputs: out('L16') });
  N('bottling', { delay: 3, outputs: [{ line: lines.L17, form: 'bottle', color: () => '#ffffff' }] });
  N('bottleDock', { sink: true });
  for (const [id, , , , b] of LINES) lines[id].to = nodes[b];
  lines.L17.to = nodes.bottleDock;

  // ---------- Stations ----------
  const stations = [];
  for (const st of STAGES) {
    const b = site.list.get(st.building);
    const sp = b.spec;
    const B = batchOf(st.building);
    if (b.roof) trusses(B, { ...sp, h: sp.h });
    const make = STATIONS[st.building];
    const ctx = { spec: sp, B, group: b.interior, m, node: nodes[st.building], nodes, lines, truck, scene, products };
    const station = make ? make(ctx) : { update() {} };
    const holo = makeHolo(`${st.n} · ${st.name.toUpperCase()}`, Math.min(16, sp.w * 0.42));
    const hy = st.building === 'tanks' ? 28 : Math.max(7.5, sp.h - 4.2);
    holo.position.set(sp.cx, hy, sp.cz + (station.holoZ ?? 0));
    b.interior.add(holo);
    stations.push({ id: st.building, stage: st.n, b, node: nodes[st.building], station, holo, act: 0 });
  }
  // Exterior LED weighbridge in front of the intake docks (W street, northbound lane).
  const is = spec('intake');
  ext.add('graphite', box(5.2, 0.06, 18, -281.6, 0.09, is.cz));
  for (const [w, d, x, z] of [[5.2, 0.12, -281.6, is.cz - 9], [5.2, 0.12, -281.6, is.cz + 9], [0.12, 18, -284.2, is.cz], [0.12, 18, -279, is.cz]]) {
    ext.add('glowTeal', box(w, 0.04, d, x, 0.13, z));
  }

  ext.build(m, TILE, scene, { name: 'conveyors' });
  for (const [id, B] of inner) B.build(m, TILE, site.list.get(id).interior, { name: `interior:${id}` });

  // Warm up: run the factory for a few simulated minutes so every belt is already busy.
  for (let i = 0; i < 3400; i++) flow.update(0.25);

  const beltTex = m.belt.userData.tex;
  let t = 0;
  return {
    flow, nodes, lines, stations, truck, hooks,
    /** Call from Phase 5 when a cotton truck is parked at / leaves the intake dock. */
    setTruckAtDock(on, onUnload = null) { truck.atDock = on; truck.onUnload = onUnload; },
    update(dt) {
      t += dt;
      flow.update(dt);
      flow.render();
      beltTex.offset.y -= (1.6 / 1.2) * dt;
      for (const s of stations) {
        s.act += ((s.node?.activity ?? 0.5) - s.act) * Math.min(1, dt * 1.5);
        if (!s.b.interior.visible) continue;
        s.station.update(dt, 0.25 + 0.75 * s.act, t);
        s.holo.userData.update(t);
      }
    },
  };
}
