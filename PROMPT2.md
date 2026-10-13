# «ИҚАННЫҢ АҚ МАРЖАНЫ» — Part 2: Living Factory, AI Assistant, Robot Guide, Exploded View, Robots Page

> **Нұсқаулық (қазақша):** Бұл файл жобаның екінші бөлімі. Ол 4 фазадан тұрады (PHASE 10–13). Бірінші хабарламаға **PART 2 BRIEF** пен **PHASE 10**-ды бірге жібер. Кейінгі хабарламаларға бір фазадан жібер.

---

## PART 2 BRIEF (send once at the start of every new session)

The project «Иқанның Ақ Маржаны» (a futuristic 2040 zero-smoke cotton-processing complex in Three.js) is **already built** by following `PROMPT.md`. Now we add five major features:

1. A **living, self-running factory**: an accelerated simulation clock, a real day/night cycle with a night "sleep" mode and the user controls ⏸ 1× 2× 5× 10× 30×.
2. An **economy engine** that computes production, revenue and costs in real time from the actual simulation.
3. **«Ақылды көмекші»**: a Kazakh chatbot that shows the **daily report** and answers questions.
4. **«Маржан»**: a robot guide that flies to every important object of the base and explains it step by step. Also **«Бөлшектеп көру»** (exploded view): the base is taken apart piece by piece, like a computer, and every part explains its function.
5. A separate **robots page**: every robot type in 360° 3D, tap-to-learn hotspots, chat with robots, give them commands and control them.

### Mandatory rules
- **First read the existing code**, `PROMPT.md` and `PROGRESS.md`. **Integrate** with the existing modules (scene, flow, robots, vehicles, UI, tour, `data.js`). Do not rewrite or break what already works. Reuse the existing robot builders, materials, fonts and UI style.
- All the rules from the `PROMPT.md` GLOBAL BRIEF still apply:
  - Vite + vanilla JS + Three.js, static build into `docs/`, GitHub Pages.
  - No external assets.
  - iPad performance budget.
  - The same visual language: frosted glass, teal `#12b5a0`, gold `#f5c04a`, cotton white.
- **All user-facing text is in Kazakh.** Use the Kazakh strings in this document **verbatim**. Any new Kazakh text must be grammatically correct Kazakh (never Russian). Use the locally bundled fonts: Inter (UI) and Unbounded (headings). Ә Ғ Қ Ң Ө Ұ Ү Һ І must render perfectly in HTML and on canvas. Wait for `document.fonts.ready` before drawing canvas text.
- **No backend.** GitHub Pages is static, so the chatbot and robot dialogue must run **fully offline in the browser**, using a rule-based Kazakh intent engine (described below). Do not call any API.
- **Number formatting:** use spaces as thousands separators and the tenge sign after the number: `12 450 000 ₸`, `3,8 т`, `1 284 л`. Use `Intl.NumberFormat('kk-KZ')` with a manual fallback.
- **End-of-phase routine:**
  1. `npm run build` passes.
  2. Take a Playwright screenshot at 1180×820 (Chromium is at `/opt/pw-browsers`; do not run `playwright install`). Check for console errors and visually check the Kazakh glyphs.
  3. Update `PROGRESS.md`.
  4. Commit and push.
  5. Reply briefly in Kazakh.
- **Budget:** edit files in place, don't re-explain code and take at most 1–3 screenshots per phase.

---

## PHASE 10 — Living factory: simulation clock, day/night life cycle and economy engine

### 10.1 Simulation clock (`src/sim/clock.js`)
- `clock.minutes` is the game time of the day (0–1440). `clock.day` is the day number, starting from «1-күн».
- **1× = 1 game minute per real second**, so one full day takes 24 real minutes.
  - Speeds: **⏸ 0×, 1×, 2×, 5×, 10×, 30×**.
  - Every animation (vehicles, robots, conveyors, machines, fans, product flow, sun) uses the scaled `simDt`. Clamp `simDt` per frame and sub-step it, so high speeds stay stable and nothing teleports.
- **When the site opens, the factory is already running.** Start at **07:40 on «1-күн»**, so the morning startup is visible within 20 seconds. There is no "start" button: production, trucks and robots begin automatically.
- **Clock widget** in the top bar: a large clock (`07:42`), the day («1-күн»), a sun or moon icon, the phase name and the speed buttons. Keyboard shortcuts: Space = pause, 1–5 = speeds. The current speed is highlighted.
- The old «КҮН / КҮН БАТУ / ТҮН» buttons now **jump the clock**: КҮН → 12:00, КҮН БАТУ → 19:30, ТҮН → 23:00. The light then follows the clock automatically.

### 10.2 Day schedule (the factory "lives")
| Time | Phase | What happens |
|---|---|---|
| 05:30–06:30 | «Таң атуда» | Sunrise colours, stars fade out, mist over the lake. |
| 06:30 | «Таңғы іске қосу» | **Wake-up sequence.** Robots walk out of the Robot centre charging docks. Buildings power up **one after another in a light wave** along the production chain. Conveyors start, roof fans spin up, the first cotton trucks leave the parking lot. Toast: «☀️ Қайырлы таң! Зауыт жұмысқа кірісті». |
| 07:00–20:00 | «Жұмыс уақыты» | Full production: trucks, products, robots and machines are all active. |
| 12:00–13:00 | «Түскі үзіліс» | Some humanoid robots walk to the canteen and the rest area, then return. The line keeps running. |
| 20:00–21:00 | «Жұмыс аяқталуда» | No new raw cotton is accepted after 20:00. The remaining products drain through the line, and the last export truck leaves through the gate. |
| 21:00 | «Зауыт ұйқыға кетті» | **Sleep sequence.** Robots walk back to the charging docks (their visors dim to a slow "breathing" glow). Conveyors stop and machines go idle. Fans slow to a stop. Interior lights fade, leaving a soft night glow on the contours and signs. Trucks park. Toast: «🌙 Зауыт демалып жатыр · Роботтар қуаттануда». |
| 21:00–05:30 | «Түн» | Moon, milky-way stars, fireflies around the park and the lake, a gently glowing «Ақ Маржан» monument. **Security robots and patrol drones keep working**, because «Күзет ешқашан ұйықтамайды». A small night card shows the robots' battery charging (e.g. «Роботтар қуаттануда: 64% → 100%»). |
| 00:00 | New day | The daily report is archived and «2-күн» begins. |

All transitions must be **smooth**: fade lights over game minutes, accelerate and decelerate the machines, and walk the robots along their paths (no teleporting). The sun position and the sky come from the clock. The shadow direction changes during the day.

### 10.3 Economy engine (`src/sim/economy.js`)
All conditional prices and ratios live in `data.js` as `ECONOMY`, labelled in the UI as «Оқу мақсатындағы шартты есеп». **Hook the engine into the real flow events** (`raw` spawned, bale pressed, oil bottled, garment sewn, box dispatched, truck exported). Never use fake random totals.

- **Conversion model:**
  - Each `raw` product unit is **0,5 т** of raw cotton.
  - 1 т of raw cotton gives 0,35 т fibre, 0,55 т seed and 0,10 т waste.
  - 1 т of seed gives 160 л of oil.
  - 1 т of fibre gives ≈ 4 000 garments.
  - The waste becomes biogas.
- **Sale prices:**
  - fibre bale: 900 ₸/кг
  - cotton oil: 950 ₸/л
  - garment: 4 500 ₸/дана
  - biogas energy: 40 ₸/кВт·сағ
  - **Revenue is booked only when products leave through dispatch/export.**
- **Costs:**
  - raw cotton purchase: 280 ₸/кг
  - robot maintenance: 18 000 ₸ per hour of work
  - dyes and water treatment
  - packaging
  - logistics: 35 000 ₸ per truck trip
  - equipment depreciation
  - electricity: **0 ₸**, because it is own solar and wind power. Also show «Күн энергиясы арқылы үнемделді: … ₸» compared with grid power at 30 ₸/кВт·сағ.
- **Tracked values:**
  - **Today:** totals plus **hourly buckets** for charts.
  - **Yesterday:** the archived day.
  - **Since the site opened:** session totals.
  - Kazakh KPIs:
    - «Қабылданған шикі мақта»
    - «Өндірілген талшық»
    - «Мақта майы»
    - «Тігілген киім»
    - «Жөнелтілген жүк көліктері»
    - «Табыс»
    - «Шығын»
    - «Таза пайда»
    - «Рентабельділік»
    - «Өндірілген энергия»
    - «CO₂ үнемделді»
    - «Белсенді роботтар»
- The top-bar live counters from PROMPT.md now read from this engine.

---

## PHASE 11 — «Ақылды көмекші» chatbot and the daily report

### 11.1 Chat UI
- A floating round button at the bottom right with a glowing robot face and the label «Ақылды көмекші». It opens a frosted-glass chat panel (a bottom sheet on phones).
- **Messages:**
  - Bot messages have a small robot avatar and a typing indicator ("…"), and the text appears with a short typing animation.
  - User messages appear as teal bubbles.
  - Show a timestamp in game time.
- **Quick-reply chips:**
  - «📊 Бүгінгі есеп»
  - «💰 Табыс қанша?»
  - «📉 Шығындар»
  - «🌿 Энергия»
  - «🤖 Роботтар»
  - «⏩ Уақытты жылдамдату»
  - «🧭 Гидпен саяхат»
  - «🧩 Бөлшектеп көру»
- **Optional voice:**
  - Microphone input via `webkitSpeechRecognition`/`SpeechRecognition` with `lang='kk-KZ'`. Hide the button if it is unsupported.
  - Spoken replies via `speechSynthesis` only if a `kk` voice exists. Add a mute toggle.

### 11.2 Daily report card («Күнделікті есеп»)
When the user asks for the report, the bot posts a **rich card** that **updates live** while it is open:

- **Header:** «📊 1-күн · 14:20 жағдайы бойынша»
- **KPI grid:**
  - Қабылданған шикі мақта
  - Талшық
  - Мақта майы
  - Киім
  - Жөнелтілген фуралар
  - Энергия
- **Finance block:**
  - «Табыс», «Шығын» and «Таза пайда». Profit is green when positive and red when negative.
  - Revenue and cost share bars.
  - A cost breakdown with mini horizontal bars.
- **Charts** (small and crisp, drawn on canvas or SVG, no libraries):
  - production per hour (bars),
  - revenue vs cost over the day (two lines).
- **Comparison:** «Кешегімен салыстырғанда: +12%» when a previous day exists.
- **Buttons:**
  - «⬇️ CSV жүктеу» downloads the report as a CSV file.
  - «🖨️ Басып шығару» opens a clean, print-styled report.
- **At 21:00 the bot posts the day summary automatically**, e.g. «🌙 Бүгінгі жұмыс аяқталды! Қысқаша есеп:», followed by the card.

### 11.3 Offline Kazakh intent engine (`src/chat/intents.js`)
- **Normalise the input:**
  - lowercase, trim punctuation;
  - also map common informal/Russian words students may type: «отчет/отчёт» → есеп, «прибыль» → пайда, «расход» → шығын, «скорость» → жылдамдық;
  - match by **stems/prefixes**, so that Kazakh suffixes work: `мақта*`, `табыс*|кіріс*|пайда*`, `шығын*`, `есеп*`, `энерг*|қуат*|күн панел*`, `робот*`, `уақыт*|сағат*`, `жылдам*|тезірек`, `баяу*`, `тоқта*|пауза`, `түн*`, `таң*|күндіз*`, `гид*|саяхат*|таныстыр*`, `бөлшек*`, `цех*|ғимарат*` + building names, `көмек*|не істей аласың`.
- **Intents and actions:**
  - **Questions:**
    - бүгінгі есеп
    - табыс
    - шығын
    - таза пайда
    - қанша мақта өңделді
    - қанша май / киім
    - энергия
    - роботтар саны және күйі
    - қазір сағат нешеде
    - қай цех ең белсенді
    - зауыт туралы
    - 15 ерекшелік
    - көмек
  - **Commands:**
    - «уақытты 5x жылдамдат», «уақытты тоқтат», «қалыпты жылдамдық»
    - «түнге ауыстыр», «таңға ауыстыр»
    - «гидпен саяхатты баста»
    - «бөлшектеп көрсет»
    - «роботтар бетін аш»
    - «[ғимарат атауы] көрсет» flies the camera to that building
  - **Small talk:** сәлем, рахмет, сен кімсің, қалайсың.
- **Fallback** (always helpful, never empty):
  «Кешіріңіз, түсінбедім 🤔 Мына сұрақтарды қойып көріңіз:» followed by 4 suggestion chips.
- **Example replies:**
  - «Бүгін 07:00-ден бері 38,5 т шикі мақта өңделді. Одан 13,5 т талшық пен 3 380 л май алынды 🌿»
  - «Қазіргі таза пайда: 4 820 000 ₸. Табыс — 9 650 000 ₸, шығын — 4 830 000 ₸.»
  - «Барлық электр қуаты күн мен желден алынады, сондықтан электрге 0 ₸ жұмсалды ☀️»

---

## PHASE 12 — Robot guide «Маржан» and the «Бөлшектеп көру» (exploded view) mode

### 12.1 «МАРЖАН» robot guide tour
- New dock button: «🧭 ГИДПЕН САЯХАТ».
- **The guide:** «Маржан» is a small, friendly **flying guide robot**: a rounded white body, a glowing teal face screen with animated eyes, a gold cotton-boll emblem and a soft hover thruster glow. It **physically flies** in the 3D scene to each point of interest. The camera follows it with a smooth chase/orbit shot. On arrival, Маржан turns to face the camera, gestures towards the object, and the object is highlighted (outline, pulsing ring on the ground, label).
- **Speech:**
  - A speech bubble or dialogue panel with Маржан's avatar.
  - Typewriter text and a step counter «3 / 18».
  - Controls: «◀ Алдыңғы», «⏸», «Келесі ▶», «✕ Аяқтау».
  - Auto-advance after the text has been read (about 6–9 s per stop), plus a 360° camera orbit during each stop.
  - Optional `speechSynthesis` narration if a Kazakh voice exists.
- **Stops** (use these texts verbatim, and pick the camera framing for each stop yourself):

| № | Объект | Маржанның сөзі |
|---|---|---|
| 1 | Аспаннан жалпы көрініс | «Сәлем! Мен — Маржан, «Иқанның Ақ Маржаны» зауытының робот-гидімін. Бүгін сізге болашақтың түтінсіз зауытын көрсетемін. Ұшып кеттік!» |
| 2 | Басты қақпа | «Бұл — зауыттың басты қақпасы. Маңдайшадағы мақта бейнесі — біздің басты байлығымыздың белгісі. Қақпадан тек тексерістен өткен көліктер ғана кіреді.» |
| 3 | Күзет бекеті | «Күзет бекетінде күзетші роботтар тәулік бойы кезекшілік атқарады. Олар бейнекамералар мен сенсорлар арқылы бүкіл аумақты бақылап отырады.» |
| 4 | Көлік тексеру аймағы | «Әр көлік сканер аркасынан өтеді: жүгі, салмағы және құжаттары автоматты түрде тексеріледі. Тексерістен өткен соң шлагбаум өзі көтеріледі.» |
| 5 | «Ақ Маржан» монументі | «Орталық даңғылдағы «Ақ Маржан» монументі — алып мақта қауашағы. Ол түнде жарқырап, зауыттың символына айналған.» |
| 6 | Әкімшілік ғимараты | «Әкімшілік ғимараты — зауыттың «миы». Мұнда инженерлер мен жасанды интеллект бүкіл өндірісті басқарады.» |
| 7 | Күн станциясы | «Мыңдаған күн панелі зауытқа таза энергия береді. Бізде бірде-бір мұржа жоқ, сондықтан ауаға қара түтін шықпайды.» |
| 8 | Энергия орталығы | «Энергия орталығы күн мен желден келген қуатты аккумуляторларда сақтайды. Сондықтан зауыт түнде де қуатсыз қалмайды.» |
| 9 | Мақта алқабы | «Барлығы осы жерден басталады. Робот-комбайн піскен мақтаны жинап, жүк көлігіне тиейді.» |
| 10 | Мақта қабылдау бөлімі | «Шикі мақта осы жерде өлшеніп, жасанды интеллект сканерімен тексеріледі.» |
| 11 | Тазалау және ажырату цехтары | «Мақта тазаланып, талшық пен тұқымға бөлінеді. Талшықтан мата, ал тұқымнан май алынады.» |
| 12 | Май резервуарлары | «Мақта тұқымынан салқын сығу әдісімен таза май алынады. Ол алып резервуарларда сақталады.» |
| 13 | Тоқыма цехтары | «Иіру, тоқу, бояу және тігу цехтарында мақта талшығы жіпке, матаға, содан соң киімге айналады.» |
| 14 | Зертхана | «Зертханада әр партияның сапасы тексеріледі: талшықтың ұзындығы, беріктігі мен ылғалдылығы өлшенеді.» |
| 15 | Роботтар орталығы | «Түнде роботтар осы орталықта демалып, қуат алады. Мұнда оларға техникалық қызмет көрсетіледі.» |
| 16 | Қойма және жөнелту | «Дайын өнім ақылды қоймада сақталып, электр фуралар арқылы әлемнің түкпір-түкпіріне жөнелтіледі.» |
| 17 | Қалдықтарды кәдеге жарату | «Бізде қалдық жоқ: мақтаның қауызы мен қоқысы биогазға, ал талшық қалдығы қайта өңдеуге жіберіледі.» |
| 18 | Финал, панорама | «Саяхатымыз аяқталды! «Иқанның Ақ Маржаны» — табиғатқа зиянсыз, ақылды әрі тиімді болашақ зауыты. Назарларыңызға рахмет!» |

- **Flight rules:** Маржан flies along smooth Catmull-Rom curves **above the roofs** (it never passes through buildings) and lands 3–6 m from each object. The tour keeps working at any sim speed. If it is night, Маржан switches on a small headlight.

### 12.2 «БӨЛШЕКТЕП КӨРУ» (exploded view), "like taking a computer apart in the informatics lab"
- New dock button: «🧩 БӨЛШЕКТЕП КӨРУ». There are two levels.

**A) Building exploded view.**
- The user taps a building, then «Бөлшектеу».
- The building **smoothly separates into layers** over 1.2 s with easeOutBack, moving up and slightly outward. Each layer floats with a label and a leader line:

| Бөлшек | Қызметі | 💻 Компьютер аналогиясы |
|---|---|---|
| Күн панельдері | Шатырға түскен күн сәулесін электр қуатына айналдырады. | Қуат блогы — бүкіл жүйені энергиямен қамтамасыз етеді. |
| Таза ауа мұнаралары мен желдеткіштер | Цех ішіндегі ауаны тазартып, салқындатады. Түтін шығармайды. | Кулер — процессорды қызып кетуден сақтайды. |
| Шатыр | Ғимаратты жаңбыр мен қардан қорғайды, жарық өткізеді. | Корпус қақпағы. |
| Қабырғалар мен шыны қасбет | Жылуды сақтайды, табиғи жарық береді. | Корпус. |
| Металл қаңқа | Бүкіл ғимараттың салмағын көтереді. | Корпустың қаңқасы мен бекіткіштері. |
| Өндірістік машиналар | Мақтаны өңдеудің негізгі жұмысын атқарады. | Процессор — негізгі есептеуді жүргізеді. |
| Конвейерлер мен шыны түтіктер | Өнімді цехтан цехқа тасымалдайды. | Деректер шинасы — ақпаратты бөліктер арасында тасиды. |
| Робот-қолдар мен роботтар | Нақты әрі қауіпсіз жұмыс істейді. | Перифериялық құрылғылар. |
| Датчиктер мен камералар | Сапаны және қауіпсіздікті бақылайды. | Енгізу құрылғылары (пернетақта, тышқан). |
| Кабельдер мен құбырлар | Қуат, су және май тасымалдайды. | Сымдар мен қуат кабельдері. |
| Еден мен іргетас | Бүкіл жабдықты берік ұстап тұрады. | Аналық тақта — бәрі соған бекітіледі. |

- Tapping a floating part highlights it, dims the others and opens an info card with «Атауы», «Қызметі», «💻 Компьютерде бұл — …» and a fun fact.
- «Құрастыру» reassembles the building with the reverse animation.

**B) Whole-base layers.**
- «Бүкіл базаны бөлшектеу» lifts the base into **5 floating layers** stacked vertically, each tinted and labelled:
  1. **«🌿 Табиғат қабаты»** (terrain, trees, fields, lake)
  2. **«⚡ Энергия қабаты»** (solar, wind, energy centre, cables)
  3. **«🏭 Өндіріс қабаты»** (production buildings and machines)
  4. **«🚚 Логистика қабаты»** (roads, vehicles, conveyors, warehouses)
  5. **«🧠 Басқару қабаты»** (administration, lab, security, robots centre, sensors)
- The PC analogies for these layers are: корпус/аналық тақта, қуат блогы, процессор, шина/жад, операциялық жүйе.
- Tapping a layer explains it.
- Simulation keeps running while exploded, so cars and robots move on their layers.
- **Implementation tips:** tag objects with `userData.layer` / `userData.part` while building them. Animate group positions only and never rebuild geometry. Keep draw calls the same.

---

## PHASE 13 — Robots page: 360° gallery, chat with robots, commands and manual control

### 13.1 Separate page
- Add a second Vite entry `robots.html` (multi-page build via `build.rollupOptions.input`) that reuses the robot builder modules, materials and fonts.
- Link it from the main UI with «🤖 РОБОТТАР ӘЛЕМІ», and link back with «← Зауытқа қайту».
- **Design:** a bright, airy **studio**:
  - a soft gradient backdrop (mint → sky → pearl);
  - a glossy circular turntable with a glowing teal ring;
  - soft contact shadows;
  - a slow auto-rotation that stops when the user touches the screen.
  - One finger orbits **360°**, two fingers zoom.
- **Bottom carousel:** robot cards with a mini thumbnail (rendered once to a canvas), name and role. Swipe or tap to switch. The current robot slides off the turntable and the next one rises with a light ring effect.

### 13.2 Robot roster (unique look and function for each)
| Аты | Түрі | Қызметі |
|---|---|---|
| «Маржан» | Ұшатын гид-робот | Қонақтарға зауытты таныстырады. |
| «Оператор-Х1» | Гуманоид оператор | Машиналарды басқарып, өндірісті қадағалайды. |
| «Сақшы» | Күзет роботы | Аумақты тәулік бойы күзетеді. |
| «Темірқол» | 6 осьті робот-қол | Тігеді, қаптайды, жүк тиейді. |
| «Жүкші» | AMR тележка | Тауарды цехтар арасында тасымалдайды. |
| «Көтергіш» | Робот-погрузчик | Паллеттерді көтеріп, фураларға тиейді. |
| «Қыран» | Дрон-инспектор | Аумақты әуеден бақылайды. |
| «Жинақшы» | Мақта жинайтын робот-комбайн | Алқаптан піскен мақтаны жинайды. |
| «Тазалықшы» | Тазалау роботы | Цехтар мен жолдарды таза ұстайды. |
| «Зерттеуші» | Зертхана роботы | Мақтаның сапасын талдайды. |
| «Өрмекші» | Алты аяқты инспекция роботы | Құбырлар мен биік жабдықтарды тексереді. |
| «Шебер» | Жөндеуші робот | Ақауларды тауып, жөндейді. |

**Info panel** (right side; a bottom sheet on phones):
- name, type, «Қызметі»;
- **specs:** «Биіктігі», «Салмағы», «Батарея», «Жылдамдығы», «Датчиктері», «Жұмыс орны»;
- a battery meter;
- «Зауытта көрсету» flies the main scene camera to that robot type.

**Hotspots:** glowing pulsing dots on the model (e.g. visor/cameras, lidar, battery, gripper, wheels/legs, antenna). Tapping one shows a callout such as «Лидар — айналадағы заттарға дейінгі қашықтықты өлшейді».

### 13.3 Talk to robots and give commands
- **Each robot has a chat panel with its own personality:**
  - «Сақшы» is strict and polite.
  - «Маржан» is cheerful.
  - «Темірқол» is laconic.
- It uses the same offline intent engine from Phase 11, extended with robot commands. Show the command chips under the input.

| Команда (мысалдар) | Әрекет |
|---|---|
| «сәлем», «өзіңді таныстыр» | Wave animation plus an introduction in the first person. |
| «қол бұлға» | Wave. |
| «би биле» | A short fun dance loop (each robot type in its own style). |
| «алға жүр», «артқа жүр», «оңға бұрыл», «солға бұрыл» | Move or turn on the turntable stage. |
| «айнал» | Spin 360°. |
| «секір» | Jump (humanoids) or hop (drone). |
| «отыр» / «тұр» | Sit down or stand up (humanoids). |
| «жарықты қос» / «жарықты сөндір» | Toggle the visor and headlights. |
| «түсіңді өзгерт» | Cycle accent colours (teal, gold, coral, violet). |
| «жұмыс істе» | Play its job animation: arm picks and places a box, AMR carries a bale, drone scans with a laser cone, harvester spins its pickers. |
| «батарея қанша?» | Answers with its battery percentage. |
| «тоқта» | Stop. |

- Unknown commands get a friendly in-character reply plus suggestions.
- Optional voice input with `kk-KZ`, and robot speech via `speechSynthesis` if a Kazakh voice exists.

### 13.4 Manual control
- **On the robots page:** a «🎮 Басқару» toggle shows an on-screen **virtual joystick** (touch and mouse) plus action buttons «👋», «💃», «⤴️», «💡», «🛠️». Keyboard: WASD/arrows. The robot moves with proper walk/drive/fly animations, stays within the stage radius, and the camera follows smoothly.
- **In the main factory scene:** «🎮 РОБОТТЫ БАСҚАРУ» lets the user pick a humanoid or a drone and drive it in third person with the joystick. Rules:
  - Collisions use building and vehicle bounding boxes: the robot never walks through walls or into traffic.
  - The robot stays on the ground; a drone keeps a minimum altitude.
  - «Шығу» returns the robot to its autonomous task.

### 13.5 Final QA for Part 2
- Use Playwright to tap every new button (clock speeds, chat chips, report CSV, guide tour, exploded view, robots page, commands, joystick) with no console errors.
- Take screenshots at 1180×820, 820×1180 and 390×844. Verify the night "sleep" scene and the morning wake-up visually.
- Check the Kazakh glyphs everywhere, including the CSV file (UTF-8 with BOM, so Excel opens it correctly).
- Build, commit `docs/`, merge into `main` and confirm that GitHub Pages works for both `index.html` and `robots.html`.
- Add a Kazakh «2-бөлім» section to `README.md` with screenshots and a demo script: what to show the jury in 3 minutes.
