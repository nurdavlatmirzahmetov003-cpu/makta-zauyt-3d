// Talking to a robot: the offline intent engine's normaliser + robot commands, replies in the
// robot's own voice (Сақшы strict and polite, Маржан cheerful, Темірқол laconic…).
import { normalise, detect } from '../chat/intents.js';

export const COMMAND_CHIPS = ['сәлем', 'өзіңді таныстыр', 'қол бұлға', 'би биле', 'алға жүр', 'артқа жүр', 'оңға бұрыл', 'солға бұрыл', 'айнал', 'секір', 'отыр', 'тұр', 'жарықты қос', 'жарықты сөндір', 'түсіңді өзгерт', 'жұмыс істе', 'батарея қанша?', 'тоқта'];

const RULES = [
  ['lightOff', (t) => /жарық|шам|фар/.test(t) && /сөндір|өшір/.test(t)],
  ['lightOn', (t) => /жарық|шам|фар/.test(t) && /қос|жақ|жан/.test(t)],
  ['color', (t) => /түс/.test(t) && /өзгерт|ауыстыр|басқа/.test(t)],
  ['battery', (t) => /батарея|заряд|қуат/.test(t)],
  ['intro', (t) => /таныстыр|кімсің|сен кім|атың/.test(t)],
  ['hello', (t) => /^сәлем|сәлеметсіз|^hello|^hi(\s|$)|қайырлы/.test(t)],
  ['wave', (t) => /бұлға|қол сілт/.test(t)],
  ['dance', (t) => /(^|\s)би(\s|$)|биле|билеп/.test(t)],
  ['stop', (t) => /тоқта/.test(t)],
  ['forward', (t) => /алға/.test(t)],
  ['back', (t) => /артқа|кері/.test(t)],
  ['right', (t) => /оңға/.test(t)],
  ['left', (t) => /солға/.test(t)],
  ['spin', (t) => /айнал/.test(t)],
  ['jump', (t) => /секір|ырғы/.test(t)],
  ['sit', (t) => /отыр/.test(t)],
  ['stand', (t) => /(^|\s)тұр(\s|$)|тұрып|орныңнан/.test(t)],
  ['work', (t) => /жұмыс|істе|еңбек/.test(t)],
  ['thanks', (t) => /рахмет/.test(t)],
];
export function detectCommand(text) {
  const t = normalise(text);
  for (const [id, test] of RULES) if (test(t)) return id;
  return detect(text).id === 'greet' ? 'hello' : 'unknown';
}

const SAY = {
  wave: '👋', dance: '💃 Би бастадым!', forward: '⬆️ Алға жүрдім.', back: '⬇️ Артқа жүрдім.', right: '➡️ Оңға бұрылдым.', left: '⬅️ Солға бұрылдым.',
  spin: '🔄 Бір айналдым!', jump: '⤴️ Секірдім!', sit: '🪑 Отырдым.', stand: '🧍 Тұрдым.', lightOn: '💡 Жарықты қостым.', lightOff: '🌑 Жарықты сөндірдім.',
  work: '🛠️ Жұмысқа кірістім!', stop: '⏹ Тоқтадым.', thanks: 'Оқасы жоқ! 😊',
};
const CANT = { jump: '⤴️ Мен секіре алмаймын, бірақ сәл ырғып көрсетейін!', sit: '🪑 Менде аяқ жоқ, отыра алмаймын — бірақ дайын тұрмын.' };

/** → reply text for the robot `r` after the animator ran the command (hint from animator.command). */
export function replyFor(r, id, hint, { battery, accent }) {
  const p = r.personality;
  if (id === 'intro') return p.intro;
  if (id === 'hello') return `${p.greet} ${p.intro}`;
  if (id === 'battery') return p.battery(battery);
  if (id === 'unknown') return p.unknown;
  if (id === 'color') return `🎨 ${p.done} Түсім енді — ${accent}.`;
  if (hint === 'stationary') return '⚙️ Мен еденге бекітілгенмін, бірақ оңға-солға бұрыла аламын.';
  if (hint === 'cant') return CANT[id] || SAY[id];
  if (r.id === 'arm') return `${p.done} ${SAY[id] || ''}`.trim(); // laconic
  return `${SAY[id] || p.done}${id === 'wave' ? ` ${p.greet}` : ''}`;
}
