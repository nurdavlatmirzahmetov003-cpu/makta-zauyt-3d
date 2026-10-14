// Offline Kazakh intent engine: normalise the text (lower case, punctuation, common Russian /
// informal words), then match stems / prefixes so Kazakh suffixes still work. Commands first.
import { BUILDINGS, GATE_TEXT } from '../data.js';

const MAP = [
  [/отч[её]т\w*/g, 'есеп'], [/прибыл\w*/g, 'пайда'], [/доход\w*/g, 'табыс'], [/расход\w*/g, 'шығын'],
  [/скорост\w*/g, 'жылдамдық'], [/быстр\w*/g, 'жылдамдат'], [/робот\w*/g, 'робот'], [/энерги\w*/g, 'энергия'],
  [/привет\w*|салам\w*|салем\w*/g, 'сәлем'], [/спасибо|рахмет|рақмет/g, 'рахмет'], [/ночь|ночн\w*/g, 'түн'], [/утр\w*/g, 'таң'],
  [/(\d)\s*х/g, '$1x'], // Cyrillic «х» after a number: 5х
];
const STOP = new Set(['мақта', 'мақтаны', 'мақта', 'бөлімі', 'цехы', 'ғимараты', 'орталығы', 'және', 'майын', 'талшығын', 'мен']);

export function normalise(text) {
  let t = ` ${String(text).toLowerCase().replace(/ё/g, 'е')} `;
  t = t.replace(/[«»"“”„.,!?;:()…—–\-/\\]+/g, ' ');
  for (const [re, to] of MAP) t = t.replace(re, to);
  return t.replace(/\s+/g, ' ').trim();
}

/* ---------- Buildings by name: IDF-weighted stem matching ---------- */
const PLACES = [...BUILDINGS.map((b) => ({ id: b.id, name: b.name })), { id: 'monument', name: GATE_TEXT.monument }];
const ALIASES = { canteen: ['асхана'], lab: ['зертхана', 'лаборатор'], admin: ['әкімшілі', 'басқару'], showroom: ['көрме'], shop: ['дүкен'], guard: ['күзет', 'қақпа'], tanks: ['резервуар'], biogas: ['биогаз', 'қалдық'], monument: ['монумент', 'ескерткіш', 'маржан'] };
const stem = (w) => w.slice(0, Math.max(3, Math.min(w.length - 1, 6)));
const placeStems = PLACES.map((p) => ({
  ...p,
  stems: [...p.name.toLowerCase().split(/[\s«»]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem), ...(ALIASES[p.id] || [])],
}));
const df = new Map();
for (const p of placeStems) for (const s of new Set(p.stems)) df.set(s, (df.get(s) || 0) + 1);

export function findPlace(t) {
  let best = null;
  for (const p of placeStems) {
    let score = 0;
    for (const s of new Set(p.stems)) if (t.includes(s)) score += 1 / df.get(s);
    if (score > (best?.score ?? 0.4)) best = { ...p, score };
  }
  return best;
}

const has = (t, re) => re.test(t);
// Note: \b does not work with Cyrillic in JS, so word edges are written as (^|\s) / (\s|$).
const SHOW = /көрсет|апар|ұш|қайда|(^|\s)бар(\s|$)|бару/;
const RULES = [
  ['speedNormal', (t) => has(t, /қалыпты|баяула|баяу/)],
  ['pause', (t) => has(t, /тоқтат|тоқта(\s|$)|пауза|кідірт/)],
  ['speed', (t) => has(t, /жылдамдат|жылдамда|тезірек|тездет|үдет|жылдамдық/) && !has(t, /қанша|қандай/)],
  ['night', (t) => has(t, /түн/) && has(t, /ауыстыр|өт|қос|жаса|көрсет/)],
  ['morning', (t) => has(t, /таң/) && has(t, /ауыстыр|өт|қос|жаса|көрсет/)],
  ['day', (t) => has(t, /күндіз|түске/) && has(t, /ауыстыр|өт|қос|жаса/)],
  ['guide', (t) => has(t, /гид|саяхат|таныстыр|(^|\s)тур(\s|$)/)],
  ['explode', (t) => has(t, /бөлшек/)],
  ['robotsPage', (t) => has(t, /робот/) && has(t, /бет|әлем/)],
  ['show', (t) => has(t, SHOW) && !!findPlace(t)],
  ['greet', (t) => has(t, /^сәлем|сәлеметсіз|ассалау|^hello|^hi(\s|$)|қайырлы/)],
  ['thanks', (t) => has(t, /рахмет|алғыс/)],
  ['who', (t) => has(t, /кімсің|сен кім|атың кім|өзіңді таныстыр/)],
  ['how', (t) => has(t, /қалайсың|халің|қалың қалай|қалың қалай/)],
  ['report', (t) => has(t, /есеп|қорытынды|отчет/)],
  ['profit', (t) => has(t, /пайда/)],
  ['revenue', (t) => has(t, /табыс|кіріс|түсім|ақша/)],
  ['cost', (t) => has(t, /шығын/)],
  ['oil', (t) => has(t, /(^|\s)май/) && !has(t, /маржан/)],
  ['garments', (t) => has(t, /киім|тігіл|тігу/)],
  ['cotton', (t) => has(t, /мақта/)],
  ['energy', (t) => has(t, /энерг|қуат|күн панел|электр|(^|\s)жел(\s|$)|жел турбин/)],
  ['busiest', (t) => has(t, /(қай|ең).*(цех|бөлім|ғимарат)|белсенді цех/)],
  ['robots', (t) => has(t, /робот/)],
  ['time', (t) => has(t, /уақыт|сағат|нешеде|қай күн/)],
  ['nightInfo', (t) => has(t, /түн/)],
  ['features', (t) => has(t, /ерекшелі|15/)],
  ['about', (t) => has(t, /зауыт|кешен|туралы/)],
  ['help', (t) => has(t, /көмек|не істей|не білесің|мүмкіндік|не істей аласың/)],
];

/** → { id, place?, speed? } or { id: 'fallback' } */
export function detect(text) {
  const t = normalise(text);
  for (const [id, test] of RULES) {
    if (!test(t)) continue;
    const out = { id, text: t };
    if (id === 'show') out.place = findPlace(t);
    if (id === 'speed') { const m = t.match(/(\d+)\s*(x|×|есе)?/); if (m) out.speed = +m[1]; }
    return out;
  }
  return { id: 'fallback', text: t };
}
