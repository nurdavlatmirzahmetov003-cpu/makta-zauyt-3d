// All user-facing Kazakh strings and stage data live here.
export const TEXT = {
  title: 'Иқанның Ақ Маржаны',
  titleCaps: 'ИҚАННЫҢ АҚ МАРЖАНЫ',
  eyebrow: '2040 · БОЛАШАҚТЫҢ ЗАУЫТЫ',
  complex: 'МАҚТА ӨҢДЕУ ӨНЕРКӘСІПТІК КЕШЕНІ',
  enter: 'ЗАУЫТҚА САЯХАТ ⟶',
  skipHint: 'Өткізіп жіберу үшін экранды түртіңіз',
  loading: 'Жүктелуде…',
  ready: 'Зауыт сізді күтуде!',
  testSign: 'ӘҒҚҢӨҰҮҺІ — ИҚАННЫҢ АҚ МАРЖАНЫ',
};

export const SUBTITLES = [
  'Болашақтың түтінсіз мақта зауытын бірге тамашалайық!',
  'Күн нұрымен жұмыс істейтін ақылды өндіріс',
  'Мақта алқабынан — дайын өнімге дейін, роботтардың қолымен',
];

export const BADGES = [
  { icon: '☀️', text: '100% күн энергиясы' },
  { icon: '🤖', text: 'Толық роботтандырылған' },
  { icon: '🌿', text: '0 г қара түтін' },
];

export const LOADING_STEPS = [
  'Күн панельдері орнатылуда…',
  'Роботтар іске қосылуда…',
  'Мақта алқабы суарылуда…',
  'Конвейерлер іске қосылуда…',
];

// Extra loading messages for the nature steps (Phase 2).
export const LOADING_NATURE = {
  sky: 'Аспан мен күн дайындалуда…',
  terrain: 'Таулар мен төбелер көтерілуде…',
  lake: 'Көл суға толтырылуда…',
  trees: 'Ағаштар отырғызылуда…',
  wind: 'Жел турбиналары іске қосылуда…',
};

// Loading messages for the built environment (Phase 3).
export const LOADING_SITE = {
  roads: 'Жолдар мен тротуарлар төселуде…',
  buildings: 'Цехтар тұрғызылуда…',
  landmarks: 'Әкімшілік пен көрме залы безендірілуде…',
  gate: 'Бас қақпа мен қоршау орнатылуда…',
  production: 'Өндіріс желілері іске қосылуда…',
};

/* ===================== Site plan (Phase 3) =====================
 * Units: metres, north = −Z. Production rows: O (oil, z −205), F (fibre, z −125), T (sewing & logistics, z −45).
 * Openings: portal = conveyor portal (glass tubes, Phase 4), dock = truck dock, door = personnel door.
 */
const P = (side, off = 0) => ({ side, off, w: 4.2, h: 4.2, y: 2.4, kind: 'portal' });
const D = (side, off = 0) => ({ side, off, w: 5, h: 5.2, y: 0, kind: 'dock' });
const G = (side, off = 0) => ({ side, off, w: 2.4, h: 3, y: 0, kind: 'door' });
// High portal: for conveyor bridges that cross a road at ~7 m.
const PH = (side, off = 0) => ({ side, off, w: 4.2, h: 4.2, y: 5.6, kind: 'portal', high: true });

export const ROWS = { O: -205, F: -125, T: -45 };

export const BUILDINGS = [
  // O — oil chain
  { id: 'raw', row: 'O', cx: -245, h: 22, roof: 'vault', name: 'ШИКІ МАҚТА ҚОЙМАСЫ', openings: [P('S'), D('W', -10), D('W', 10), G('S', 18)] },
  { id: 'seed', row: 'O', cx: -105, h: 18, roof: 'vault', name: 'МАҚТА ТҰҚЫМЫ ҚОЙМАСЫ', openings: [P('S'), P('E'), G('S', 16)] },
  { id: 'oil', row: 'O', cx: -35, w: 40, h: 15, roof: 'flat', name: 'МАҚТА МАЙЫН ӨНДІРУ', openings: [P('W'), PH('E'), G('S', 10)], green: [{ side: 'S', off: -12, w: 7 }] },
  { id: 'refine', row: 'O', cx: 35, w: 40, h: 15, roof: 'flat', wall: 'glass', name: 'МАЙДЫ СҮЗУ ЖӘНЕ ТАЗАРТУ', openings: [PH('W'), P('E'), G('S', -10)] },
  { id: 'tanks', row: 'O', cx: 105, special: 'tanks', name: 'МАҚТА МАЙЫН САҚТАУ РЕЗЕРВУАРЛАРЫ' },
  { id: 'bottling', row: 'O', cx: 175, h: 13, roof: 'flat', name: 'МАҚТА МАЙЫН ҚАПТАУ БӨЛІМІ', openings: [P('W'), D('N', -12), D('N', 0), G('S', 12)], green: [{ side: 'S', off: -15, w: 8 }] },
  { id: 'biogas', row: 'O', cx: 245, special: 'biogas', name: 'ҚАЛДЫҚТАРДЫ КӘДЕГЕ ЖАРАТУ' },
  // F — fibre chain
  { id: 'intake', row: 'F', cx: -245, h: 14, roof: 'flat', name: 'МАҚТА ҚАБЫЛДАУ БӨЛІМІ', openings: [D('W', -12), D('W', 0), D('W', 12), P('E'), P('N'), G('S', 15)], green: [{ side: 'S', off: -14, w: 8 }] },
  { id: 'cleaning', row: 'F', cx: -175, h: 16, roof: 'flat', name: 'МАҚТА ТАЗАЛАУ ЦЕХЫ', openings: [P('W'), P('E'), G('S', 15)], green: [{ side: 'S', off: 14, w: 7 }] },
  { id: 'ginning', row: 'F', cx: -105, h: 18, roof: 'saw', roofSign: true, name: 'МАҚТА ӨҢДЕУ ЗАУЫТЫ', openings: [P('W'), P('E'), P('N'), G('S', 0)], green: [{ side: 'S', off: -15, w: 8 }, { side: 'S', off: 15, w: 8 }] },
  { id: 'baling', row: 'F', cx: -35, w: 40, h: 15, roof: 'flat', name: 'МАҚТА ТАЛШЫҒЫН БУЫП-ТҮЮ БӨЛІМІ', openings: [P('W'), PH('E'), G('S', 10)] },
  { id: 'bales', row: 'F', cx: 35, w: 40, h: 24, roof: 'vault', name: 'МАҚТА БУМАЛАРЫНЫҢ ҚОЙМАСЫ', openings: [PH('W'), P('E'), D('N', 0), G('S', -10)] },
  { id: 'spinning', row: 'F', cx: 105, h: 17, roof: 'saw', name: 'ЖІП ИІРУ ЦЕХЫ', openings: [P('W'), P('E'), G('S', 0)], green: [{ side: 'S', off: 16, w: 7 }] },
  { id: 'weaving', row: 'F', cx: 175, h: 17, roof: 'saw', name: 'МАТА ТОҚУ ЦЕХЫ', openings: [P('W'), P('E'), G('S', 0)], green: [{ side: 'S', off: -16, w: 7 }] },
  { id: 'dyeing', row: 'F', cx: 245, h: 15, roof: 'flat', wall: 'glass', name: 'МАТАНЫ БОЯУ ЖӘНЕ ӨҢДЕУ', openings: [P('W'), PH('S'), G('S', 14)], green: [{ side: 'W', off: 14, w: 8 }] },
  // T — sewing, logistics and services
  { id: 'robots', row: 'T', cx: -245, h: 12, roof: 'flat', wall: 'glass', name: 'РОБОТТАР ОРТАЛЫҒЫ', openings: [D('S', -12), D('S', 12), G('S', 0)] },
  { id: 'energy', row: 'T', cx: -175, h: 12, roof: 'flat', name: 'ЭНЕРГИЯ ОРТАЛЫҒЫ', openings: [G('S', 0), D('E', 0)], green: [{ side: 'S', off: -14, w: 10 }, { side: 'S', off: 14, w: 10 }] },
  { id: 'repair', row: 'T', cx: -105, h: 12, roof: 'saw', name: 'ЖӨНДЕУ ШЕБЕРХАНАСЫ', openings: [D('S', -14), D('S', 0), D('S', 14)] },
  { id: 'lab', row: 'T', cx: -35, w: 40, special: 'lab', name: 'ЗЕРТХАНА' },
  { id: 'dispatch', row: 'T', cx: 35, w: 40, h: 12, roof: 'flat', name: 'ДАЙЫН ӨНІМДЕРДІ ЖӨНЕЛТУ БӨЛІМІ', openings: [P('E'), D('S', -12), D('S', 0), D('S', 12)] },
  { id: 'goods', row: 'T', cx: 105, h: 24, roof: 'flat', name: 'ДАЙЫН ӨНІМ ҚОЙМАСЫ', openings: [P('W'), P('E'), G('S', 16)] },
  { id: 'packaging', row: 'T', cx: 175, h: 13, roof: 'flat', name: 'ҚАПТАУ БӨЛІМІ', openings: [P('W'), P('E'), G('S', 0)], green: [{ side: 'S', off: 15, w: 8 }] },
  { id: 'sewing', row: 'T', cx: 245, h: 15, roof: 'saw', name: 'КИІМ ТІГУ ЦЕХЫ', openings: [PH('N'), P('W'), G('S', 0)], green: [{ side: 'S', off: -15, w: 8 }] },
  // South zone
  { id: 'admin', special: 'admin', cx: -90, cz: 70, name: 'ӘКІМШІЛІК ҒИМАРАТЫ' },
  { id: 'showroom', special: 'showroom', cx: 90, cz: 70, name: 'КӨРМЕ ЗАЛЫ' },
  { id: 'canteen', special: 'canteen', cx: -200, cz: 56, name: 'АСХАНА' },
  { id: 'dorm', special: 'dorm', cx: -210, cz: 160, name: 'ҚЫЗМЕТКЕРЛЕР ЖАТАҚХАНАСЫ' },
  { id: 'park', special: 'park', cx: -110, cz: 172, name: 'ДЕМАЛЫС АЙМАҒЫ' },
  { id: 'shop', special: 'shop', cx: 170, cz: 160, name: 'ЗАУЫТ ДҮКЕНІ' },
  { id: 'trucks', special: 'truckpark', cx: 190, cz: 80, name: 'ЖҮК КӨЛІКТЕРІ ТҰРАҒЫ' },
  { id: 'guard', special: 'guard', cx: 0, cz: 224, name: 'КҮЗЕТ БЕКЕТІ' },
];

// Production stages (Phase 4/7). Texts verbatim from PROMPT.md.
export const STAGES = [
  { n: 1, building: 'intake', name: 'Мақтаны қабылдау', what: 'Алқаптан келген шикі мақта таразыда өлшеніп, жасанды интеллект сканерімен сапасы тексеріледі.' },
  { n: 2, building: 'cleaning', name: 'Мақтаны тазалау', what: 'Айналмалы барабандар мақтаны шаңнан, жапырақтан және қоқыстан тазартады. Ауа сүзгіден өтіп, таза күйінде шығарылады.' },
  { n: 3, building: 'ginning', name: 'Талшық пен тұқымды ажырату', what: 'Джин-машиналардың ара-дискілері талшықты тұқымнан бөледі. Талшық иіруге, тұқым майға жіберіледі.' },
  { n: 4, building: 'baling', name: 'Престеу және буып-түю', what: 'Гидравликалық пресс талшықты тығыз бумаға айналдырады. Робот белдік тағып, QR-жапсырма басады.' },
  { n: 5, building: 'bales', name: 'Мақта бумаларының қоймасы', what: 'Бумаларды көпірлі кран мен AMR тележкалар ақылды сөрелерге орналастырады.' },
  { n: 6, building: 'seed', name: 'Тұқым қоймасы', what: 'Мақта тұқымы желдетілетін қоймада сақталып, шнек арқылы май цехына беріледі.' },
  { n: 7, building: 'oil', name: 'Мақта майын өндіру', what: 'Шнекті престер тұқымнан майды химиясыз, салқын сығу әдісімен алады.' },
  { n: 8, building: 'refine', name: 'Майды сүзу және тазарту', what: 'Сүзгі бағаналары мен центрифуга майды мөлдір әрі таза етеді.' },
  { n: 9, building: 'tanks', name: 'Май резервуарлары', what: 'Тазартылған май үлкен резервуарларда сақталып, цистерналарға құйылады.' },
  { n: 10, building: 'bottling', name: 'Майды бөтелкеге құю', what: 'Айналмалы карусель бөтелкелерді толтырады, роботтар қақпағын жабып, жапсырма жабыстырады.' },
  { n: 11, building: 'spinning', name: 'Жіп иіру', what: 'Талшық созылып, ширатылып, берік жіпке айналады. Шпиндельдер минутына мыңдаған рет айналады.' },
  { n: 12, building: 'weaving', name: 'Мата тоқу', what: 'Тоқу станоктары негіз бен арқау жіптерін айқастырып, мата тоқиды.' },
  { n: 13, building: 'dyeing', name: 'Матаны бояу және өңдеу', what: 'Мата экологиялық бояулармен боялып, кептіріледі. Судың 95%-ы қайта пайдаланылады.' },
  { n: 14, building: 'sewing', name: 'Киім тігу', what: 'Робот-қолдар матаны пішіп, жоғары дәлдікпен киім тігеді.' },
  { n: 15, building: 'packaging', name: 'Қаптау', what: 'Роботтар киімді бүктеп, «АҚ МАРЖАН» қораптарына салып, штрих-код басады.' },
  { n: 16, building: 'goods', name: 'Дайын өнім қоймасы', what: 'Автоматты стеллаж-кран қораптарды биік сөрелерге орналастырады.' },
  { n: 17, building: 'dispatch', name: 'Жөнелту және экспорт', what: 'Паллеттер электр фураларға тиеліп, дайын өнім әлемнің түкпір-түкпіріне жөнелтіледі.' },
];

// Extra hologram / wall texts inside the stations.
export const STATION_TEXT = {
  coldPress: 'САЛҚЫН СЫҒУ',
  water95: 'СУДЫҢ 95% ҚАЙТА ӨҢДЕЛЕДІ',
  boxLogo: 'АҚ МАРЖАН',
  cleanAir: 'ТАЗА АУА',
  aiScan: 'ЖИ САПА СКАНЕРІ',
};

// Main gate and monument texts.
export const GATE_TEXT = {
  main: 'ИҚАННЫҢ АҚ МАРЖАНЫ',
  sub: 'МАҚТА ӨҢДЕУ ӨНЕРКӘСІПТІК КЕШЕНІ · 2040',
  monument: 'АҚ МАРЖАН',
};

// Safety and road signs (pictogram + Kazakh caption).
export const SAFETY_SIGNS = {
  speed: 'ЖЫЛДАМДЫҚ 20',
  stop: 'ТОҚТА',
  helmet: 'КАСКА МІНДЕТТІ',
  smokeFree: 'ТҮТІНСІЗ АЙМАҚ',
  crossing: 'ЖАЯУ ӨТКЕЛ',
  ev: 'ЭЛЕКТР ҚУАТТАУ',
};

export const PALETTE = {
  cotton: '#fffaf0',
  teal: '#12b5a0',
  deepTeal: '#0b6b63',
  sky: '#7cc7ff',
  gold: '#f5c04a',
  leaf: '#4caf6a',
  graphite: '#1f2a30',
};
