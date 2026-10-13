# «ИҚАННЫҢ АҚ МАРЖАНЫ» — Phased Master Prompt for Claude Code

> **Нұсқаулық (қазақша):**
> 1. Claude Code бұлттық сессиясын ашып, `makta-zauyt-3d` репозиторийін таңда.
> 2. Бірінші хабарламаға **GLOBAL BRIEF** пен **PHASE 0**-ді бірге жібер.
> 3. Әр келесі хабарламаға бір фазадан жібер. Claude фаза біткенде коммит пен push жасайды, сондықтан сайт әрдайым жұмыс істейтін күйде қалады.
> 4. Сессия үзілсе, жаңа чатқа: *"Read PROMPT.md and PROGRESS.md, then continue with the next unfinished phase."* деп жаз.
> 5. Уақыт аз болса, мына ретпен жаса: **0 → 1 → 2 → 3 → 4 → 7 → 6 → 5 → 8 → 9**.

---

## GLOBAL BRIEF (send once at the start of every new session)

You are a senior Three.js/WebGL engineer, an environment artist and an industrial architect. Together we are building **«Иқанның Ақ Маржаны»** ("Ikan's White Pearl"). It is an interactive 3D web prototype of a **cotton-processing industrial complex of the year 2040**, made for a school olympiad presentation. The site is presented on an **iPad (Safari)** and other devices, and it is published with **GitHub Pages**. Aim for a portfolio-grade, cinematic result: think "Apple product page meets an architectural visualisation studio".

### Concept
- A **zero-smoke factory.** There are no chimneys and no black smoke anywhere. Instead there are slim white **«Таза ауа мұнаралары»** (clean-air towers) with softly glowing teal rings.
- The factory runs on **100% renewable energy**: solar roofs, a solar farm, wind turbines and battery storage.
- At night the complex **glows**: LED contour lines in teal, warm white and gold.
- It sits **inside nature**: mountains with snowy peaks, a lake, forest belts and cotton fields.
- **Robots do all the work. There are no human workers.** You can see the full chain in real time: cotton is harvested in the field, delivered by truck, processed step by step inside the factory, packed and finally **exported** by a truck leaving through the main gate.

### Language and typography rules (critical)
- **All user-facing content must be in Kazakh (Cyrillic)**: UI, labels, signs, info panels, tour texts, loading messages and tooltips. Code, comments and commit messages stay in English.
- Use the Kazakh strings from this document **verbatim**. When you need new Kazakh text, write grammatically correct Kazakh, never Russian. Never replace Kazakh letters with look-alike Russian or Latin letters (for example, never write `К` instead of `Қ` or `Y` instead of `Ү`).
- The Kazakh-specific letters **Ә Ғ Қ Ң Ө Ұ Ү Һ І** (and their lowercase forms) must render perfectly everywhere: in HTML **and** in `<canvas>` textures.
- **Bundle the fonts locally.** Do not rely on Google Fonts at runtime, because the presentation may be offline.
  - `npm i @fontsource/inter @fontsource/unbounded`
  - Import the `cyrillic-ext`, `cyrillic` and `latin` subsets with weights 400, 500, 600, 700 and 800.
  - **Inter** is for the UI and body text. **Unbounded** is for big headings, the logo and building signs.
  - CSS fallback stack: `"Inter", "SF Pro Text", "Segoe UI", "Noto Sans", Arial, sans-serif`.
- **Before drawing any canvas text, `await document.fonts.ready`**, then explicitly call `document.fonts.load('700 64px Unbounded', 'ӘҒҚҢӨҰҮҺІ')`. If you draw before the fonts load, the signs fall back to a system font.
- Add a dev-only check (`?debug`): render the string `ӘәҒғҚқҢңӨөҰұҮүҺһІі` in both fonts and assert `document.fonts.check(...)` is true. Log a warning if it is not.
- Use `<meta charset="utf-8">` and `<html lang="kk">`. Save all files as UTF-8.
- Typography polish:
  - Use proper Kazakh quotation marks «…» and the em dash —.
  - Use letter-spacing `0.04em` on all-caps headings.
  - Use `font-variant-numeric: tabular-nums` on live counters.
  - Format numbers with spaces as thousands separators (`1 284 т`).
  - Text on canvas signs gets a subtle shadow and is auto-fitted, so it is never clipped or squeezed.

### Technical rules (mandatory)
- **Stack:** Vite + vanilla JavaScript (ES modules) + **Three.js `0.170.0`**. Do not use React.
  - `vite.config.js`: `base: './'`, `build.outDir: 'docs'`.
  - `npm run build` must produce a fully static site.
- **No external 3D models or images.** Network access may be blocked, and external assets also risk breaking during the presentation.
  - Build every model procedurally with Three.js primitives: Box, Cylinder, Sphere, Capsule, Lathe, Extrude, Tube and InstancedMesh.
  - Paint all textures on `<canvas>`.
  - Optional photo: if `public/images/cotton.jpg` exists, use it on the gate sign. Otherwise draw a beautiful procedural cotton-boll picture as a fallback.
- **Module layout** (keep each file under ~700 lines):

  ```
  src/
    main.js
    style.css
    data.js            ← ALL Kazakh texts and stage data live here
    fonts.js
    textures.js
    materials.js
    geo.js
    world.js
    buildings.js
    flow.js
    robots.js
    vehicles.js
    ui.js
    labels.js
    tour.js
    interior/*.js
  ```

- **Performance on iPad (hard requirement):**
  - Merge static meshes by material with `BufferGeometryUtils.mergeGeometries`.
  - Use `InstancedMesh` for anything repeated: trees, cotton plants, solar panels, shelves, products, fence posts.
  - Target **≤ 1500 draw calls** and **30+ FPS** on iPad.
  - Hide building interiors while their roof is closed.
  - Cap `pixelRatio` at 1.5 on touch devices.
  - Offer quality presets **Төмен / Орташа / Жоғары**. Auto-downgrade one level if FPS stays below 25 for 3 seconds.
- **Touch controls:** use OrbitControls.
  - One finger rotates. Two fingers zoom and pan.
  - Clamp the polar angle so the camera never goes under the ground.
  - Treat a pointer movement under 6 px as a tap, not a drag.
  - Set `touch-action: none` on the canvas and prevent double-tap zoom in Safari.
- **End-of-phase routine (every phase):**
  1. `npm run build` passes with no errors.
  2. Use Playwright (Chromium is preinstalled at `/opt/pw-browsers`; do **not** run `playwright install`) to take a screenshot at **1180×820 (iPad landscape)** and collect console errors. Look at the screenshot yourself and fix any visual problem, including broken Kazakh glyphs.
  3. Update `PROGRESS.md`: what was done, known issues and the next step.
  4. Commit (in English, descriptive) and push.
- **Budget discipline:**
  - Edit files in place and never rewrite whole files unnecessarily.
  - Don't re-explain code you already wrote.
  - Take at most 1–3 screenshots per phase.
  - Keep chat replies short and write them in Kazakh.

### Visual direction
- **Palette:**
  - cotton white `#fffaf0`
  - teal `#12b5a0`
  - deep teal `#0b6b63`
  - sky `#7cc7ff`
  - gold `#f5c04a`
  - leaf green `#4caf6a`
  - graphite `#1f2a30`
- **Architecture:** clean white composite panels, glass bands, **living green walls**, **sawtooth solar roofs**, slender steel columns, gold accent lines and a large glowing teal contour along every roof edge.
- **UI:** frosted-glass panels (`backdrop-filter: blur(18px)`), 16–20 px corner radius, soft shadows, teal-to-gold gradient accents, smooth 200–300 ms transitions and generous spacing. Touch targets are at least 44 px.

---

## PHASE 0 — Project skeleton and deployment

1. Create `package.json` with the scripts `dev` (`vite --host`), `build` and `preview`. Also create `vite.config.js`, `.gitignore` (`node_modules`) and install `three`, `vite`, `@fontsource/inter` and `@fontsource/unbounded`.
2. `index.html` has three layers:
   - `#landing` (the welcome screen),
   - `<canvas id="c">` (the 3D scene),
   - `#ui` (the interface, hidden at first).

   Add these meta tags: viewport `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`, `apple-mobile-web-app-capable`, `theme-color`, `lang="kk"`, the title `Иқанның Ақ Маржаны — болашақтың мақта зауыты` and an inline SVG cotton-boll favicon.
3. Create `src/fonts.js`. It imports the Fontsource CSS and exports `fontsReady()`, which waits for `document.fonts.ready` and preloads Kazakh glyphs in both families.
4. Build a minimal scene with sky, ground, one test object and OrbitControls. Add one canvas-texture sign that reads `ӘҒҚҢӨҰҮҺІ — ИҚАННЫҢ АҚ МАРЖАНЫ` and verify in the screenshot that every letter renders correctly.
5. Create `.github/workflows/deploy.yml`. On every push to `main` it runs `npm ci && npm run build` and deploys `docs/` with `actions/upload-pages-artifact` + `actions/deploy-pages`. Also commit the built `docs/` folder, so that "Deploy from branch → /docs" works as a backup.
6. Write `README.md` **in Kazakh**: the project idea, how to run it (`npm i`, `npm run dev`) and how to enable GitHub Pages (Settings → Pages → Source: GitHub Actions).

---

## PHASE 1 — Landing page (the first impression must be stunning)

- **Background:** a bright, airy, **animated gradient** of mint `#c9f7e8`, sky `#bfe3ff`, pearl `#fffaf0` and soft gold `#ffe7a8`.
  - The gradient flows slowly (a 20 s loop).
  - 3–4 large blurred "aurora" blobs drift on top.
  - A subtle grain overlay adds depth.
- **Particles:** a `<canvas>` layer with 60–80 **floating cotton fluffs** drifting upward with parallax. They gently move away from the pointer or finger.
- **Central glass card:**
  - Eyebrow text: «2040 · БОЛАШАҚТЫҢ ЗАУЫТЫ»
  - Title (Unbounded 800): **«Иқанның Ақ Маржаны»**
    - The letters rise in one by one (staggered).
    - The text is filled with a teal → gold gradient.
    - A shimmer light sweep passes over it every few seconds.
  - Animated SVG cotton-boll logo: the petals open and the fluff "breathes".
  - Typewriter subtitle that cycles through:
    - «Болашақтың түтінсіз мақта зауытын бірге тамашалайық!»
    - «Күн нұрымен жұмыс істейтін ақылды өндіріс»
    - «Мақта алқабынан — дайын өнімге дейін, роботтардың қолымен»
  - A real loading progress bar. It follows the actual scene-building steps and shows Kazakh messages:
    - «Күн панельдері орнатылуда…»
    - «Роботтар іске қосылуда…»
    - «Мақта алқабы суарылуда…»
    - «Конвейерлер іске қосылуда…»
  - When loading finishes, the glowing **«ЗАУЫТҚА САЯХАТ ⟶»** button appears with a pulse.
  - Three small badges sit below: «☀️ 100% күн энергиясы», «🤖 Толық роботтандырылған», «🌿 0 г қара түтін».
- **Transition:** when the button is pressed, the landing fades and blurs out. The 3D camera then flies a 7-second cinematic path from high above the mountains, across the cotton fields, down to the main gate sign.
- Respect `prefers-reduced-motion`.

---

## PHASE 2 — Nature and environment

Units are metres, Y is up and north is −Z. The factory plot is flat: x ∈ [-300, 300], z ∈ [-262, 240].

- **Sky and light:**
  - Sky from `three/examples/jsm/objects/Sky.js`.
  - DirectionalLight sun with PCFSoft shadows. The shadow frustum adapts: ±330 m outdoors, ±80 m around the active building during the tour.
  - Add a HemisphereLight.
  - `scene.environment` comes from a PMREM of the sky, so metal and glass reflect it. Regenerate it only when the time of day changes.
  - Add light exponential fog.
- **Terrain:** a 4000×4000 m plane with fbm hills.
  - Put a distant ring of **snow-capped mountains** on the horizon (Alatau mood).
  - Colour the vertices by height: lush grass → rock → snow.
- **Lake** in the east (x≈600, z≈100): reflective water with a slowly scrolling normal map. Add reeds and trees along the shore.
- **Cotton fields** in the west, outside the fence (x ∈ [-620, -320]):
  - Plant rows on a ground texture with furrows.
  - Each plant is green foliage with 4–5 white cotton bolls. Use an InstancedMesh with 4000–6000 instances.
  - An **autonomous cotton-harvester robot** slowly drives along the rows.
- **Trees:** forest belts outside the fence and planted alleys inside (poplars and round deciduous trees, ~900 instances with colour variation). Add shrubs and flower beds.
- **Solar farms:** two fields (north-east and north-west), ~800 panels tilted 25° south.
- **Wind turbines:** 5–6 on the hills with rotating blades.
- **Sky details:** 12–15 drifting cloud sprites by day and a star dome at night.

---

## PHASE 3 — Buildings, roads, fence and main entrance (the exterior)

### 3.1 Site plan (use these coordinates)
Production buildings are about 52×46 m. Their columns sit at x = ±35, ±105, ±175 and ±245. The **«Орталық даңғыл»** (central avenue) runs along x = 0.

| Row | z | Buildings from west to east |
|---|---|---|
| **O – oil chain** | -205 | Raw cotton warehouse (-245) · Seed warehouse (-105) · Oil production (-35) · Oil filtration and refining (35) · Oil tank farm, open air (105) · Oil bottling (175) · Waste recycling / biogas (245) |
| **F – fibre chain** | -125 | Cotton intake (-245) · Cleaning (-175) · Ginning, fibre/seed separation (-105) · Baling/pressing (-35) · Bale warehouse (35) · Spinning (105) · Weaving (175) · Dyeing and finishing (245) |
| **T – sewing and logistics** | -45 | Robot centre (-245) · Energy centre / substation (-175) · Repair workshop (-105) · Laboratory (-35) · Dispatch (35) · Finished goods warehouse (105) · Packaging (175) · Garment sewing (245) |
| **South zone** | 20…235 | Administration (-90, 70) · Showroom (90, 70) · Canteen (-200, 60) · Dormitory (-210, 160) · Rest park with pond (-110, 175) · Factory shop (170, 160) · Truck parking (190, 80) with EV chargers |

**Roads:**
- The avenue at x = 0 runs from z = 240 to z = -245. It is 22 m wide, with a planted median at z 40–150. In the middle of the median stands the **«Ақ Маржан» monument**: a giant glowing cotton boll on a pedestal with a fountain.
- Streets: S2 (z = -10), S1 (z = -85), N (z = -245), W (x = -285) and E (x = 285). Each is 14 m wide.
- Traffic drives on the right.
- Add lane markings, zebra crossings, sidewalks, road signs, street lamps that light up at night, parking bay lines and wide loading yards. Turn radius is at least 12 m.
- Use world-space UVs on the asphalt, so overlapping roads have no seams.

### 3.2 Building generator
`makeBuilding(spec)` with spec `{id, cx, cz, w, d, h, roof: 'saw'|'flat'|'vault'|'dome', wall: 'panel'|'glass'|'concrete', accent, openings:[{side, off, w, h}]}`.

- **Walls:**
  - Door openings for the conveyors and docks.
  - Composite panel texture and glass ribbon windows. At night the windows glow through an emissive map.
  - Living green-wall panels.
  - A glowing accent strip along the parapet.
- **Roof:** a separate `Group` containing solar panels, sawtooth skylights, **spinning rooftop fans** and the clean-air towers.
  - The roof must be openable: clone its materials, fade the opacity to 0 over 0.8 s, then set `visible = false`. Fade back in when it closes.
- **Signs:** every building has a **Kazakh sign** on its main façade.
  - It is a canvas texture with a teal gradient, a thin gold border, a cotton-boll icon and Unbounded bold text, auto-fitted to the width.
  - It is lit at night.
- **Shape follows function:**
  - Warehouses are long and tall (h 18–28).
  - Spinning and weaving are huge sawtooth halls.
  - Administration is a 6-storey glass office with solar-glass fins and a roof garden.
  - The showroom is a glass dome.
  - The laboratory is white with round windows and a small observatory-style dome.
  - The oil tank farm has 4 giant cylinders (r 8, h 22) with ladders, rings and a loading gantry.
  - The dormitory is two 4-storey blocks with balconies.
  - The canteen has a large terrace with parasols.

### 3.3 Sign texts (use verbatim, store in `data.js`)
«МАҚТА ҚАБЫЛДАУ БӨЛІМІ», «ШИКІ МАҚТА ҚОЙМАСЫ», «МАҚТА ТАЗАЛАУ ЦЕХЫ», «МАҚТА ӨҢДЕУ ЗАУЫТЫ» (the largest sign, on the roof of the ginning hall), «МАҚТА ТАЛШЫҒЫН БУЫП-ТҮЮ БӨЛІМІ», «МАҚТА БУМАЛАРЫНЫҢ ҚОЙМАСЫ», «МАҚТА ТҰҚЫМЫ ҚОЙМАСЫ», «МАҚТА МАЙЫН ӨНДІРУ», «МАЙДЫ СҮЗУ ЖӘНЕ ТАЗАРТУ», «МАҚТА МАЙЫН САҚТАУ РЕЗЕРВУАРЛАРЫ», «МАҚТА МАЙЫН ҚАПТАУ БӨЛІМІ», «ЖІП ИІРУ ЦЕХЫ», «МАТА ТОҚУ ЦЕХЫ», «МАТАНЫ БОЯУ ЖӘНЕ ӨҢДЕУ», «КИІМ ТІГУ ЦЕХЫ», «ҚАПТАУ БӨЛІМІ», «ДАЙЫН ӨНІМ ҚОЙМАСЫ», «ДАЙЫН ӨНІМДЕРДІ ЖӨНЕЛТУ БӨЛІМІ», «ҚАЛДЫҚТАРДЫ КӘДЕГЕ ЖАРАТУ», «ЗЕРТХАНА», «ӘКІМШІЛІК ҒИМАРАТЫ», «АСХАНА», «ҚЫЗМЕТКЕРЛЕР ЖАТАҚХАНАСЫ», «ЖӨНДЕУ ШЕБЕРХАНАСЫ», «ЗАУЫТ ДҮКЕНІ», «КӨРМЕ ЗАЛЫ», «ЖҮК КӨЛІКТЕРІ ТҰРАҒЫ», «КҮЗЕТ БЕКЕТІ», «ЭНЕРГИЯ ОРТАЛЫҒЫ», «РОБОТТАР ОРТАЛЫҒЫ», «ДЕМАЛЫС АЙМАҒЫ».

### 3.4 Fence and main entrance
- **Perimeter fence:** a concrete plinth with steel mesh on top (alpha-tested texture) and instanced posts. CCTV cameras stand on the corner posts.
- **Main gate** (z = 240): a wide, sculptural modern arch.
  - On top is a large illuminated sign: **«ИҚАННЫҢ АҚ МАРЖАНЫ»**.
  - Underneath: «МАҚТА ӨҢДЕУ ӨНЕРКӘСІПТІК КЕШЕНІ · 2040».
  - On both sides are large panels with the **cotton photo** (`images/cotton.jpg` or the procedural fallback).
- **At the entrance:**
  - 2 entry lanes and 2 exit lanes.
  - **Animated boom barriers** that lift when a vehicle approaches.
  - A vehicle inspection zone with a scanner arch and green/red lights.
  - The «КҮЗЕТ БЕКЕТІ» guard house.
  - Safety signs: «ЖЫЛДАМДЫҚ 20», «ТОҚТА», «КАСКА МІНДЕТТІ», «ТҮТІНСІЗ АЙМАҚ».

---

## PHASE 4 — Interior production line and the journey of cotton (the heart of the project)

### 4.1 Product-flow system (`flow.js`)
- **`Path` class:** a 3D polyline with arc-length parametrisation: `at(s)` and `dirAt(s)`.
- **Line:** a conveyor from one station's machine to the next.
  - Between buildings it runs inside a **transparent glass tube**, so the cotton is always visible.
  - Where it crosses a road, it rises into a bridge at 7 m height.
- **Node:** a product travels to the end of a line and disappears into the machine housing. After `delay` seconds the node emits it at the start of the next line(s) **in a new form**. A node may branch: ginning produces **fibre + seed**.
- **Product forms:** each form is one `InstancedMesh` with per-instance colour.
  - `raw`: greyish raw cotton with debris
  - `clean`: bright white fluff
  - `fiber`: a fibre bundle
  - `seed`: a brown seed pile
  - `bale`: a strapped cube
  - `yarn`: a yarn cone
  - `fabric`: a fabric roll, cream first and then coloured after dyeing
  - `garment`: a folded shirt
  - `box`: a carton with the «АҚ МАРЖАН» logo
  - Oil branch: `seed` → (oil flows as glowing gold liquid in transparent pipes) → `bottle` (a golden bottle with a label)
- **Belts:** the belt texture scrolls (teal chevrons). Add glowing edge rails and support legs.
- **Supply:**
  - While a cotton truck stands at the intake dock, a product spawns every 2.2 s and the cotton heap on the truck visibly shrinks.
  - Without a truck, a buffer feeds the line every 6 s, so the flow never stops.

### 4.2 Stations
Each station lives in `interior/*.js` and is animated by `activity` (0–1). Activity rises when products arrive and drives the machine speed and glow.

1. **Intake:** dock door, a giant robot arm unloading the truck, an LED weighbridge, an **AI quality-scanner arch** with a sweeping laser plane, a hopper and a sampling robot.
2. **Cleaning:** two big rotating spiked drums under glass hoods, dust-extraction ducts and a "clean air" filter block with a green glow.
3. **Ginning:** a row of 5 gin stands with visible rotating saw discs. Fibre exits at the front and seed is carried out by an auger at the back.
4. **Baling:** a hydraulic press with a moving platen, a strapping robot arm and a label printer.
5. **Bale warehouse:** instanced racks, an overhead bridge crane and AMR carts.
6. **Seed warehouse:** seed mounds, augers and ventilation ducts.
7. **Oil production:** 3 screw presses with spinning screws, a «САЛҚЫН СЫҒУ» hologram and gold oil flowing in glass pipes.
8. **Filtration and refining:** transparent filter columns with animated liquid levels and a spinning centrifuge.
9. **Tank farm:** 4 tanks and a tanker loading gantry.
10. **Oil bottling:** a rotating filling carousel, capping robot arms and a labeller.
11. **Spinning:** long spinning frames with rotating spindles, visible yarn threads and a rail-mounted doffer robot.
12. **Weaving:** 12 looms in 3 rows with oscillating reeds, growing fabric rolls and scrolling warp-thread sheets.
13. **Dyeing:** 4 colour vats, fabric running over rollers, a drying tunnel and a «СУДЫҢ 95% ҚАЙТА ӨҢДЕЛЕДІ» sign.
14. **Sewing:** 3 rows of tables, each with 2 sewing robot arms, and an overhead hanger conveyor with garments.
15. **Packaging:** a folding robot, a box erector, a tape sealer and barcode printing.
16. **Finished goods warehouse:** high-bay racks and a moving stacker crane.
17. **Dispatch:** a palletising robot arm, docks and AMR forklifts loading the truck. When the truck is full it drives out through the gate (**экспорт**).

**Every station** has:
- a glowing **hologram sign** above it with its number and name, for example «3 · ТАЛШЫҚ ПЕН ТҰҚЫМДЫ АЖЫРАТУ»;
- glowing floor guide lines, steel trusses, LED light strips, safety railings, metal stairs and yellow-black safety stripes.

---

## PHASE 5 — Robots and vehicles (bring it to life)

### 5.1 Robots (they replace humans)
- **Humanoid robot** (1.8 m): white body, glowing teal visor, articulated limbs, a safety helmet and a glowing hi-vis vest.
  - **Roles:** operator, engineer with a tablet, warehouse worker, security (dark navy with a glowing «КҮЗЕТ» badge), **greeter at the gate** (waves), lab robot, robots walking to the canteen, and visitor robots in the shop.
  - **Walking:** a proper walk cycle with alternating legs and arms and a slight body bob.
  - **Placement rules:** robots always stand on the ground (y = 0). They follow predefined sidewalk paths, never walk through walls, and cross roads only at zebra crossings.
- **6-axis industrial robot arm** with keyframed pick → lift → move → place cycles.
- **AMR carts** and **robotic forklifts**.
- **Drones** with spinning rotors, flying inspection loops.
- **Counts:** ~30 humanoids, ~40 arms, ~15 AMRs and 6 drones. Skip animation updates for actors more than 260 m from the camera.

### 5.2 Vehicles (all electric and autonomous, with a lidar dome on the roof)
- **Types:**
  - a large raw-cotton truck
  - a bale truck with a trailer
  - a semi-trailer truck: the tractor and trailer follow the path separately, so the trailer articulates realistically in turns
  - an oil tanker
  - service cars
  - an electric minibus
- **Routes:** build them with `lanePath(waypoints, offset)` for right-hand traffic with rounded corners.
  - **Cotton trucks:** highway → gate → avenue → S2 → W → **stop at the intake dock and unload** → N → E → S2 → out through the gate.
  - **Semi truck:** S1 → E → S2 → **load at the dispatch dock** → avenue → gate → **export**.
  - **Tanker:** N street → tank gantry → out.
  - **Minibus:** bus stop → administration → parking.
- **Collision avoidance:**
  - Each vehicle checks a forward cone (14 m plus a speed-dependent margin, ±3.2 m lateral) and brakes smoothly.
  - If a vehicle stays blocked for more than 6 s, a deadlock breaker lets it continue.
  - Vehicles slow down smoothly at stops, and their wheels spin according to speed.
- **Parking:** 10–12 parked vehicles plus a few that come and go. EV charging posts glow.

---

## PHASE 6 — Interface and interactivity (all in Kazakh)

- **Top bar:**
  - Logo and «ИҚАННЫҢ АҚ МАРЖАНЫ — МАҚТА ӨҢДЕУ ӨНЕРКӘСІПТІК КЕШЕНІ».
  - Live counters with tabular numbers, animated counting:
    - «☀️ Күн энергиясы: 12,4 МВт» (follows the sun's elevation)
    - «Өңделген мақта: 1 284 т»
    - «Дайын өнім»
    - «CO₂ үнемделді»
    - «Белсенді роботтар»
- **Left dock** (collapsible on phones, buttons ≥ 44 px):
  - «БАСТЫ КӨРІНІС»
  - «ЖОҒАРЫДАН КӨРУ»
  - «ЗАУЫТҚА КІРУ (360° ТУР)»
  - «ӨНДІРІС ПРОЦЕСІ»
  - «ҒИМАРАТТАР»
  - «КӨЛІКТЕР»
  - «РОБОТТАР»
  - «БАРЛЫҚ АТАУЛАР»
  - «ШАТЫРДЫ АШУ»
  - «КҮН / КҮН БАТУ / ТҮН»
  - «САПА»
  - «КАМЕРАНЫ ҚАЙТАРУ»
- **Picking (raycast):** tapping a building, vehicle or robot:
  - flies the camera smoothly to it,
  - highlights it with an outline,
  - opens a right-hand info card with: name, function, role in the production chain, an «Кіреді → Шығады» mini diagram, robot count, energy use and a fun fact.
  - Example: tapping «МАҚТА МАЙЫН ӨНДІРУ» explains how oil is cold-pressed from cotton seed.
- **Lists:** «ҒИМАРАТТАР», «КӨЛІКТЕР» and «РОБОТТАР» open searchable lists. Choosing a vehicle makes the camera **follow** it.
- **Labels:** HTML labels with distance fading and screen-space overlap culling. «БАРЛЫҚ АТАУЛАР» toggles all of them.
- **Bottom bar:**
  - A clickable **17-stage timeline**. The active stage glows.
  - A slow ticker with facts above it.
- **Night mode:** UI panels switch to a dark frosted theme.

---

## PHASE 7 — «ЗАУЫТҚА КІРУ»: the automatic 360° tour (the main "wow")

- `tour.js` contains a director state machine. Stage data lives in `data.js`: `{id, target:[x,y,z], radius, height, building, duration}`.
- **Flow:**
  1. A cinematic fly-in from the gate along the avenue to the intake building.
  2. For **each stage**:
     - The active building's **roof fades open**, showing the interior.
     - The camera eases in with easeInOut.
     - The camera **orbits the station 360° over 12–15 s**, with a gentle height wave and focus drifting along the products.
     - The **right info panel** shows:
       - the stage number and title,
       - «Не болып жатыр?»,
       - «Роботтар не істейді?»,
       - «Кіреді → Шығады»,
       - three "smart tech" badges,
       - a stage progress bar.
     - The station machine is highlighted with an outline and a spotlight.
  3. Between stages the camera flies an **arc above the roofs**. For a few seconds it **follows one real product** through the glass tube, so the audience sees how cotton physically travels to the next stage.
  4. **Finale:** the loaded truck leaves through the gate. A panel appears: «ЭКСПОРТ ✈️ Әлемнің 30 еліне». The camera rises into a full panorama of the complex at golden hour.
- **Controls:** «⏸ Тоқтату / ▶ Жалғастыру», «◀ Алдыңғы», «Келесі ▶», «Турдан шығу».
  - Touching the screen pauses the tour and switches to manual orbit around the current station.
  - ▶ resumes the tour.
- **«ӨНДІРІС ПРОЦЕСІ»** opens the 17-stage list. Choosing a stage jumps the tour there.

### Stage texts (use verbatim; extend them in correct Kazakh if needed)
| № | Атауы | Не болып жатыр? |
|---|---|---|
| 1 | Мақтаны қабылдау | Алқаптан келген шикі мақта таразыда өлшеніп, жасанды интеллект сканерімен сапасы тексеріледі. |
| 2 | Мақтаны тазалау | Айналмалы барабандар мақтаны шаңнан, жапырақтан және қоқыстан тазартады. Ауа сүзгіден өтіп, таза күйінде шығарылады. |
| 3 | Талшық пен тұқымды ажырату | Джин-машиналардың ара-дискілері талшықты тұқымнан бөледі. Талшық иіруге, тұқым майға жіберіледі. |
| 4 | Престеу және буып-түю | Гидравликалық пресс талшықты тығыз бумаға айналдырады. Робот белдік тағып, QR-жапсырма басады. |
| 5 | Мақта бумаларының қоймасы | Бумаларды көпірлі кран мен AMR тележкалар ақылды сөрелерге орналастырады. |
| 6 | Тұқым қоймасы | Мақта тұқымы желдетілетін қоймада сақталып, шнек арқылы май цехына беріледі. |
| 7 | Мақта майын өндіру | Шнекті престер тұқымнан майды химиясыз, салқын сығу әдісімен алады. |
| 8 | Майды сүзу және тазарту | Сүзгі бағаналары мен центрифуга майды мөлдір әрі таза етеді. |
| 9 | Май резервуарлары | Тазартылған май үлкен резервуарларда сақталып, цистерналарға құйылады. |
| 10 | Майды бөтелкеге құю | Айналмалы карусель бөтелкелерді толтырады, роботтар қақпағын жабып, жапсырма жабыстырады. |
| 11 | Жіп иіру | Талшық созылып, ширатылып, берік жіпке айналады. Шпиндельдер минутына мыңдаған рет айналады. |
| 12 | Мата тоқу | Тоқу станоктары негіз бен арқау жіптерін айқастырып, мата тоқиды. |
| 13 | Матаны бояу және өңдеу | Мата экологиялық бояулармен боялып, кептіріледі. Судың 95%-ы қайта пайдаланылады. |
| 14 | Киім тігу | Робот-қолдар матаны пішіп, жоғары дәлдікпен киім тігеді. |
| 15 | Қаптау | Роботтар киімді бүктеп, «АҚ МАРЖАН» қораптарына салып, штрих-код басады. |
| 16 | Дайын өнім қоймасы | Автоматты стеллаж-кран қораптарды биік сөрелерге орналастырады. |
| 17 | Жөнелту және экспорт | Паллеттер электр фураларға тиеліп, дайын өнім әлемнің түкпір-түкпіріне жөнелтіледі. |

---

## PHASE 8 — Lighting, atmosphere, polish and iPad performance

- **Times of day:** «КҮН», «КҮН БАТУ» and «ТҮН» blend smoothly over 2.5 s (sun elevation, sky, fog colour, light intensities, exposure). ACES tone mapping and sRGB output.
- **At night:**
  - Windows, contour strips, clean-air towers, street lamps and signs glow.
  - Stars appear.
  - On «Жоғары» quality, enable a half-resolution UnrealBloom.
- **Materials:** reflective metals (envMap), semi-transparent reflective glass, asphalt and concrete textures and roof panels.
- **«15 ЕРЕКШЕЛІК» showcase:**
  - an elegant panel (button in the dock),
  - a big LED wall inside the showroom with the 15 features below.
- **Dev overlay (`?debug`):** FPS and `renderer.info.render.calls`.
- **Performance checks:**
  - Keep draw calls ≤ 1500.
  - Verify that the iPad profile («Орташа»: pixelRatio 1.5, shadowMap 2048, no bloom) holds 30+ FPS.
- **Touch checks:** test every gesture. There must be no Safari double-tap zoom and no rubber-band page scroll.
- **Loading:** the real loading progress comes from chunked scene building (`await requestAnimationFrame` between steps).

---

## PHASE 9 — Final QA and publishing on GitHub Pages

1. Write a Playwright script that taps every button. Take a screenshot after each tap and fail on console errors.
2. Take screenshots at 1180×820 (iPad landscape), 820×1180 (iPad portrait), 390×844 (phone) and 1920×1080.
   - The UI must fit at every size.
   - **Every Kazakh letter (Ә Ғ Қ Ң Ө Ұ Ү Һ І) must render correctly** in both HTML and canvas signs.
3. Run `npm run build` and commit `docs/`. Merge into `main`, either by a direct push or by opening and merging a PR. Confirm the Pages workflow is green.
4. In `README.md` (Kazakh), add:
   - the live link `https://<username>.github.io/makta-zauyt-3d/`,
   - screenshots,
   - a **2-minute defence script**: what to show and in which order.
5. Mark every phase as done in `PROGRESS.md`.

---

## «ИҚАННЫҢ АҚ МАРЖАНЫ» — 15 ЕРЕКШЕЛІК (show these Kazakh texts verbatim on the site)

1. **0% қара түтін.** Мұржа жоқ, оның орнына ауаны тазартатын «таза ауа мұнаралары» тұр.
2. **100% күн және жел энергиясы.** Шатырдағы күн панельдері, күн станциясы, жел турбиналары және түнгі жұмысқа арналған аккумулятор блоктары бар.
3. **Толық роботтандырылған өндіріс.** Гуманоид роботтар, робот-қолдар, AMR тележкалар мен дрондар жұмыс істейді.
4. **Жасанды интеллект сапа сканері.** Әр мақта партиясы лазермен және камерамен тексеріледі.
5. **Шыны түтікті конвейерлер.** Мақтаның цехтан цехқа қалай өтетіні көрініп тұрады.
6. **Нөлдік қалдық.** Қауыз бен қоқыс биогазға, ал талшық қалдығы қайта өңдеуге жіберіледі.
7. **Суды 95% қайта пайдалану.** Бояу цехы жабық айналымды су жүйесімен жұмыс істейді.
8. **Майды салқын сығу.** Химиясыз әдіспен таза мақта майы алынады.
9. **Автономды электр көліктер.** Жүк көліктерінің бәрі жүргізушісіз, электрмен жүреді.
10. **Сандық егіз (Digital Twin).** Әр станцияның тірі көрсеткіштері экранда көрініп тұрады.
11. **Ақылды қойма.** Автоматты биік сөрелер мен стеллаж-кран жұмыс істейді.
12. **Табиғатпен үйлесім.** Жасыл қабырғалар, шатырдағы бақтар, көл, орман және мақта алқабы бар.
13. **Түнгі нұрлы сәулет.** Үнемді LED жарықтары түнде ғимараттарды көркейтеді.
14. **Алқаптан экспортқа дейін.** Толық цикл: мақта жинау → иіру → тоқу → тігу → әлемге жөнелту.
15. **Мақтаның іздеу тізбегі.** Әр өнімнің QR-кодында оның қай алқаптан шыққаны жазылған.

---

## Лимитті үнемдеу бойынша кеңестер (100 $)
- Бір хабарламаға бір фаза жібер. Бәрін бірден сұрасаң, контекст толып кетеді.
- Әр фазадан кейін push жасалғанын тексеріп, сайтты аш (`npm run dev` немесе Pages сілтемесі).
- Қате шықса, нақты ағылшынша жаз. Мысалы: *"Phase 5: semi trucks pass the dispatch dock without stopping — fix it."*
- Ең қымбат фазалар — 4, 5 және 7. Әрқайсысын жаңа сессияда бастаған дұрыс: *"Read PROMPT.md and PROGRESS.md, do PHASE N."*
