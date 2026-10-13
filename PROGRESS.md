# PROGRESS

## Phase status
| Phase | Status |
|---|---|
| 0 — Skeleton & deployment | ✅ done |
| 1 — Landing page | ✅ done |
| 2 — Nature & environment | ✅ done |
| 3 — Buildings, roads, fence, gate | ✅ done |
| 4 — Interior production line & flow | ✅ done |
| 5 — Robots & vehicles | ✅ done |
| 6 — UI & interactivity | ✅ done |
| 7 — 360° tour | ✅ done |
| 8 — Lighting, polish, performance | ✅ done |
| 9 — Final QA & publishing | 🟡 QA script, README and size checks done; merge to `main` + Pages pending |

### Part 2 (`PROMPT2.md`)
| Phase | Status |
|---|---|
| 10 — Living factory: clock, day/night cycle, economy | ✅ done |
| 11 — «Ақылды көмекші» chatbot + daily report | ⏳ next |
| 12 — Robot guide «Маржан» + «Бөлшектеп көру» | — |
| 13 — Robots page, robot chat, manual control, final QA | — |

## Phase 0 — done
- Vite 8 + Three.js 0.170.0 (pinned). `vite.config.js`: `base: './'`, `outDir: 'docs'`. `docs/` is committed (Pages backup source).
- `index.html`: `#landing`, `<canvas id="c">`, `#ui` (hidden); `lang="kk"`, iPad meta tags, inline SVG cotton favicon.
- `src/fonts.js`: Inter + Unbounded bundled locally; `fontsReady()` waits for `document.fonts.ready` and preloads Kazakh glyphs; `?debug` runs `document.fonts.check` and shows a glyph probe.
- **Font fix:** upstream Unbounded has NO Ә Ғ Қ Ң Ө Ұ Ү Һ (only І і). `scripts/build-kz-font.py` (fonttools) composes them from Unbounded outlines (Ə/Ɵ/h/Y from latin-ext, К/Н/Г + descenders/bars) into `src/fonts/unbounded-kz-{400..800}.woff2`, declared under family `Unbounded` with a Kazakh-only `unicode-range` (`src/fonts/unbounded-kz.css`). Verified in HTML and canvas.
- Also: Fontsource single-subset CSS files lack `unicode-range`, so the per-weight CSS (`400.css` …) is imported instead (only needed subsets are downloaded).
- Minimal scene (`src/main.js`): gradient sky dome, hemi + shadowed sun, ground, test cotton boll on a pedestal, canvas sign «ӘҒҚҢӨҰҮҺІ — ИҚАННЫҢ АҚ МАРЖАНЫ» (`src/textures.js` → `makeSignTexture`, auto-fit text, gold border, cotton icon).
- OrbitControls (1 finger rotate, 2 fingers dolly/pan, polar clamp), tap detection < 6 px, `touch-action: none`, Safari gesture/double-tap prevention, pixelRatio cap 1.5 on touch.
- `.github/workflows/deploy.yml`: on push to `main` → `npm ci && npm run build` → upload-pages-artifact → deploy-pages.
- `scripts/shot.mjs`: Playwright (global install, no `playwright install`) screenshot at 1180×820 + console error capture. Usage: `npm run build && node scripts/shot.mjs screenshots/x.png [--enter] [--query=?debug]`.
- Screenshots: `screenshots/phase0-landing.png`, `screenshots/phase0-scene.png`.

## Phase 1 — done
- `src/landing.js` (new): builds the landing from `data.js` strings (eyebrow, title, badges, button, subtitles).
  - Title: per-letter staggered rise (blur + rotate), one title-wide teal → gold gradient sliced per letter (`--off`/`--tw` from layout, so it flows across line breaks), shimmer sweep every 5.5 s via a registered `@property --shine`.
  - Typewriter cycling the 3 subtitles, blinking caret.
  - Cotton-fluff particles canvas: 60–76 procedurally drawn fluff sprites, 3 depth layers with parallax, upward drift and sway, pushed away from the pointer/finger; stops when the landing is gone.
  - Animated SVG logo: gradient ring draws in, bracts bloom open, fluff puffs pop in and breathe.
  - Generated film-grain overlay, 4 drifting blurred aurora blobs, 20 s flowing background gradient (mint / sky / pearl / soft gold).
  - Real loading progress: `landing.progress(fraction, message)` is driven by the actual build steps in `main.js` (fonts → sky → lights → ground → objects → sign → shader compile), with the Kazakh step messages and a tabular-nums percentage.
  - «ЗАУЫТҚА САЯХАТ ⟶» appears only when loading finishes: pop-in, pulsing ring, breathing glow. Three badges fade in below.
- `src/intro.js` (new): 7 s cinematic flight along a centripetal Catmull-Rom path, from high above (−1350, 560, −620) across the west (future cotton fields) down to the gate view (0, 11, 292). The camera looks forward with a gentle downward pitch, then eases onto `GATE_TARGET` (0, 8.5, 240). Letterbox bars and a «Өткізіп жіберу үшін экранды түртіңіз» hint appear during the flight, and a tap skips it. OrbitControls are disabled during the flight and re-enabled at the end, then the `#ui` fades in.
- Landing exit: fade + blur + slight scale (1 s). The 3D scene is not rendered while the landing covers it (saves iPad GPU).
- `prefers-reduced-motion`: animations off, static subtitle, static particles, no flight (jumps straight to the gate view).
- The test boll and sign now stand at the gate position (z = 240), and the sun/shadow box is centred there.
- `scripts/shot.mjs`: supports several outputs with `--wait=ms,ms`.
- Screenshots: `screenshots/phase1-landing.png`, `phase1-flight.png`, `phase1-gate.png`.

## Phase 2 — done
New modules (all procedural, no external assets):
- `src/noise.js`: seeded `mulberry32`, 2D Perlin, `fbm`, `ridged` (domain rotated between octaves, otherwise ridges align with the lattice diagonals and show as parallel stripes).
- `src/terrain.js`: `heightAt(x, z)` (pure, reused for placement), 6000 m / 400-segment plane. Flat zones (`ZONES`): plot x ∈ [−300, 300] z ∈ [−262, 240], cotton fields, two solar farms, highway corridor z ∈ [300, 372], gate access road. Rolling fbm hills grow with distance; a ridged mountain ring (r ≈ 1100–3900 m, higher in the north, peaks ≈ 710 m). Lake basin (x 600, z 100, 200×140 m). Vertex colours for grass/lawn/dry grass/shore. Rock and snow are classified **per pixel** in an `onBeforeCompile` patch (world height + slope + value noise), so the snow line is crisp.
- `src/world.js` `createEnvironment()`: `Sky.js`, sun DirectionalLight (PCFSoft, 2048 map, frustum ±330 via `setShadowFocus(center, radius)` for the tour's ±80 later), HemisphereLight, `scene.environment` = PMREM of the same sky (regenerated only in `setSun()`), FogExp2, 14 drifting cloud sprites (canvas textures), 1 800-star dome (fades in when the sun is below the horizon). `setSun(elevation, azimuth)` also tints the fog/clouds and sets exposure, ready for Phase 8 blending. Default: 38°, az 232° (afternoon WSW light).
- `src/nature.js`: ~1 100 instanced trees (round, poplar, spruce, willow; 1 shared trunk mesh + 4 crown meshes, sRGB colour variation): a belt hugging the fence, groves, spruce on the foothills, poplar alleys along the highway, alleys inside the fence, willows by the lake. ~560 shrubs, 12 flower beds along the gate access road. Lake: `MeshPhysicalMaterial` with two scrolling procedural normal maps (normal + clearcoat normal) reflecting the PMREM sky. 300 instanced reed clusters on the shore.
- `src/fields.js`: fields x ∈ [−620, −330]. One parcel has **5 724 instanced plants** (foliage and bolls are separate InstancedMeshes). The others use painted cotton-row and stubble textures over packed-earth tracks. The autonomous **harvester** (lidar dome, 4 gold picker heads, glowing teal strips, glass cab, cotton basket that fills up) drives a serpentine route, 4 rows per pass, with smoothed yaw and spinning wheels. Bolls disappear behind its header; after a full season they grow back over 5 s.
- `src/energy.js`: 2 solar farms (NW + NE), 800 two-module tables tilted 25° to the south on instanced mounts, 8 battery-storage containers. 6 wind turbines on the hills (merged towers and nacelles, extruded blades, rotors facing SW, spinning), with aviation lights and gold base rings.
- `src/flow.js`: `Path` class (arc-length `at(s)` / `dirAt(s)`, closed loops) + `arcPoints()`; Phase 4 adds the product flow.
- `src/geo.js`: `merge` (attribute-normalising `mergeGeometries`), `paint`, `blob` (noise-displaced icosahedron), `place`, `setInstance`.
- `src/textures.js`: canvas textures: grass grain, soil furrows, cotton rows / stubble, PV cells, clouds, tileable water normal map, flower beds, battery container.
- Loading steps now follow the real build: sky → mountains → lake → cotton field → trees → solar → wind → robots → shader compile, with Kazakh messages (`LOADING_NATURE` in `data.js` + the 4 original messages).
- Intro flight re-tuned: from 900 m above the NW ridge, over the foothill forest, low over the harvester's parcel, over the poplar highway, to the gate (terrain clearance checked numerically: ≥ 11 m).
- Debug helpers (`?debug`): `window.__app`, draw-call / triangle log, `intro.peek(u)`. `scripts/shot.mjs` gained `--views="x,y,z,tx,ty,tz;…"` and `--eval="js"`.
- Budget: **44 draw calls, ~670 k triangles** for the whole outdoor scene.
- Screenshots: `screenshots/p2-overview.png`, `p2-mountains.png`, `p2-field.png`, `p2-flight-*.png`.

## Phase 3 — done
New modules:
- `src/data.js`: `BUILDINGS` (31 entries: rows O/F/T + south zone, all Kazakh sign texts verbatim), openings per building (`portal` = conveyor glass-tube portal at y 2.4 for Phase 4, `dock`, `door`), `GATE_TEXT`, `SAFETY_SIGNS`, `LOADING_SITE`.
- `src/textures-site.js`: composite panels, curtain-wall glass (+ night emissive map with ~70 % lit panes), living green wall, asphalt, concrete apron, pavers, roof membrane, deck, hazard stripes, barrier stripes, alpha-tested fence mesh, flowing-stripe texture, and a procedural macro **cotton-boll photo** (used when `public/images/cotton.jpg` is missing).
- `src/materials.js`: shared materials; `TILE` sizes for **world-space UVs**; `setNightLevel(k)` / `registerGlow()` drive windows, lamps, contours and signs (Phase 8 will call it).
- `src/geo.js`: `box`, `cyl`, `rectXZ`, `shapeXZ`, `polygon`, `worldUV`, and `Batch`, which merges world-space geometry per material into one mesh (a whole district costs one draw call per material).
- `src/signs.js`: **all 32 building signs shelf-packed into one canvas atlas** (teal gradient, gold border, cotton icon, Unbounded 700 auto-fit; the sign width follows the text and shrinks proportionally, never squeezed). Safety-sign atlas (speed 20, «ТОҚТА», helmet, smoke-free, crossing, EV) with Kazakh captions. Large glowing gate lettering.
- `src/buildings.js`: `makeBuilding` logic. Walls are built from bands (solid base / glass ribbon / panel top), with every opening cut through all bands. Gold line, steel pilasters, glowing teal parapet contour and corner strips, green walls, decorated portals/docks/doors, interior floor. **Openable roofs** (`flat` with solar grid + fans, `saw` with south solar slopes + north glass skylights + gables, `vault` segmental shell with glass gables, crest skylight and steel ribs). `Building.setRoof(open)` clones the roof materials, fades opacity over 0.8 s, then hides the roof and shows `interior` (hidden again when closed). Instanced rooftop props for the whole site: **«Таза ауа мұнаралары»** (lathe tower, 4 teal rings + halo crown, closed top, so they never read as chimneys) and spinning fans; both shrink with the roof fade. The ginning hall carries the giant roof sign «МАҚТА ӨҢДЕУ ЗАУЫТЫ».
- `src/landmarks.js`: admin (6-storey glass, solar-glass fins, green wall, roof garden + pergola, entrance canopy sign, bus stop), showroom glass dome (ribs, gold rings, oculus), laboratory (white, round windows, observatory dome), tank farm (4 × r8 h22 tanks, gold/steel rings, caged ladders, roof railings, catwalks, bund, manifold, tanker gantry on N street), biogas hall + 2 membrane digesters, canteen (glass, terrace, 8 parasols, tables), dormitory (2 × 4-storey blocks, balconies with glass rails), shop, rest park (pond, ring path, benches, pergola, monolith sign), truck parking (14 bays, EV chargers, solar carport), guard house. **«Ақ Маржан» monument** on the roundabout: glowing 5-lock cotton boll with splayed bracts, pedestal with gold/teal rings, basin with water, 16 animated fountain jets.
- `src/roads.js`: road list (`ROADS`), asphalt rects extended into crossings, **12 m fillets** (6 m for driveways), a roundabout (r 22) with flared approaches, avenue lanes + **teal bike/robot lanes**, centre/lane/edge markings, **zebra crossings and stop lines on every leg** (exported as `ZEBRAS` for Phase 5 robots), raised sidewalks with curbs (cut at intersections), medians with shrubs/trees, ring sidewalks, **208 instanced street lamps** (warm heads + teal rings), pictogram road signs, staff car park with EV bays, industrial concrete apron, plazas, and a 4-lane highway (z 336) with the access road.
- `src/gate.js`: perimeter fence (plinth, alpha mesh, ~730 instanced posts, glowing base line, CCTV on corners and gate posts); **sculptural arch** (tapered pylons → slim crown, extruded, teal inner contour + gold outer line) with the illuminated «ИҚАННЫҢ АҚ МАРЖАНЫ» sign on top (both sides) and «МАҚТА ӨҢДЕУ ӨНЕРКӘСІПТІК КЕШЕНІ · 2040» on the crown; cotton photo light boxes; island + lane separators; **4 animated boom barriers** (2 entry, 2 exit) with red/green lamps; inspection scanner arch with lights and a sweeping laser; 4 safety signs. API: `gate.update(dt, vehicles)` lifts a barrier when a vehicle is within 18 m; `gate.request(lane, s)`.
- `nature.buildTrees(scene, extra)` now also plants the site's trees (avenue alleys, medians, admin plaza, park, S2 green buffer); the inner-fence alleys moved clear of the new sidewalks.
- Intro end view now frames the arch: camera (0, 7, 306) → target (0, 12, 240).
- Budget: **207 draw calls, ~1.07 M triangles** (31 buildings, 1 184 trees, 208 lamps). No console errors.
- Screenshots: `screenshots/p3-gate.png`, `p3-aerial.png`, `p3-industry.png`, `p3-roof-open.png`, `p3-monument.png`, `p3-tanks.png`, `p3-night.png`.

Deviations from the brief (deliberate):
- The x = ±35 column uses w = 40 (not 52), otherwise it would overlap the 22 m avenue and its sidewalks.
- A roundabout at (0, 95) holds the monument, splitting the planted median into z 40–73 and 117–150 (the fountain needs more room than a 6 m median).
- Added a south loop road S3 (z = 205), driveways D1 (car park) and D2 (truck parking), and the highway at z = 336.

## Phase 4 — done
- `src/flow.js`: `Line` (arc-length `Path`, kind `belt` | `pipe`, 1.6 m/s), `Node` (delay → re-emit in a new form on every output line; branching; timed `source`; `sink`), `FlowSystem` (moves items, hands them to nodes, writes the instanced products). Geometry: `addBelt` (frame, scrolling teal-chevron belt ribbon with arc-length UVs, glowing edge rails, legs), `addTube` (transparent glass tube with glowing rings + supports, never on roads/sidewalks), `addPipe` (glass oil pipe with gold clamps).
- `src/products.js`: 11 forms, one InstancedMesh each with per-instance colour: raw (grey with debris), clean, fibre bundle, seed pile, strapped bale with label, yarn cone, fabric roll (cream → dyed colour), folded shirt, «АҚ МАРЖАН» carton (canvas logo + barcode), glowing oil slug, golden bottle with label.
- `src/production.js`: 17 lines routed port → incline → wall portal → **glass tube** → portal → incline → machine. Lines crossing a road use high portals (`PH` in `data.js`) and run as **7.25 m bridges** (baling→bales and oil→refine over the avenue, dyeing→sewing over S1). Oil runs in glass pipes: oil press → refinery → tank farm → bottling. Nodes: raw-warehouse buffer (every 6 s, paused while a truck is docked), intake truck feed (every 2.2 s while `setTruckAtDock(true, onUnload)`; `onUnload` lets Phase 5 shrink the cotton heap), ginning **branches into fibre + seed**, dyeing assigns colours (inherited by garments), dispatch sink with `hooks.onPalletFull(n)` every 24 boxes (Phase 5 sends the truck out to export), bottles → north dock sink. The factory is pre-warmed (~14 simulated minutes), so every belt is busy at start. Station animation runs only while its interior is visible.
- `src/robots.js`: `RobotArm` (6-axis: base yaw, shoulder, elbow, wrist pitch/roll, gripper; keyframed pick → lift → move → place; optional payload) built from merged vertex-coloured links, `makeAMR`, `makeForklift`.
- `src/interior/kit.js`: hologram signs («N · STAGE NAME», tilted, bobbing, projector + light cone), steel roof trusses with LED strips, floor guide lines, safety stripes, railings, metal stairs, mezzanine platforms.
- Stations (`activity` 0–1 from each node drives machine speed):
  - `interior/fibre.js`: 1 intake (giant dock robot arm, hopper, AI scanner arch with sweeping laser + «ЖИ САПА СКАНЕРІ», sampling robot, control mezzanine, exterior LED weighbridge on W street), 2 cleaning (two spiked drums under glass hoods, dust ducts, green-glowing «ТАЗА АУА» filter block), 3 ginning (5 gin stands with spinning saw-disc stacks, glass lint collector, seed auger), 4 baling (hydraulic press with moving platen and ram, strapping robot, QR label printer), 5 bale warehouse (racks with ~300 bales, overhead bridge crane with hoist, AMR carts).
  - `interior/oil.js`: 6 seed warehouse (seed mounds, rotating augers, ceiling ducts, floor vents), 7 oil pressing (3 screw presses with spinning screws in glass, collector with glowing level, «САЛҚЫН СЫҒУ»), 8 refining (4 filter columns with moving oil levels, centrifuge under a glass dome), 9 tank farm (level gauges, manifold), 10 bottling (rotating 16-bottle filling carousel, capping robots, labeller, boxed bottles at the dock).
  - `interior/textile.js`: 11 spinning (carding machine, 4 frames with 256 individually rotating spindles, yarn threads, rail doffer robots), 12 weaving (12 looms in 3 rows: oscillating reeds, heddles, scrolling warp sheets, growing cloth rolls), 13 dyeing (4 colour vats, fabric band over rollers changing colour bath by bath, drying tunnel, water-recycling tanks + «СУДЫҢ 95% ҚАЙТА ӨҢДЕЛЕДІ»), 14 sewing (9 tables × 2 sewing arms, laser cutting table, overhead hanger conveyor with 34 dyed shirts).
  - `interior/logistics.js`: 15 packaging (folding robot + flaps, box erector, tape sealer, red barcode scan), 16 finished goods (8-level high-bay racks with ~1 000 cartons, two stacker cranes), 17 dispatch (palletising arm, pallet stack growing with each box, 2 robotic forklifts shuttling pallets to the docks).
- Budget: ~230 draw calls with roofs closed; **698 with every roof open** (worst case). No console errors.
- Screenshots: `screenshots/p4-tubes.png`, `p4-ginning.png`, `p4-fibre.png`, `p4-oil.png`, `p4-textile.png`, `p4-logistics.png`, `p4-bridge.png`, `p4-sewing.png`.

## Phase 5 — done
- `src/vehicles.js`:
  - `lanePath(waypoints, {closed, radius})` builds right-hand lanes from centreline waypoints with a per-segment lane offset; corners are intersections of the offset lines, rounded with tangent length R·tan(θ/2). `nearestS()` finds stop positions.
  - Routes (`ROUTES`):
    - cotton: highway → gate → avenue (northbound passes east of the roundabout) → S2 → W → **intake dock on the LED weighbridge** → N → E → S1 → avenue → gate → highway;
    - semi: S1 → E → S2 → **dispatch dock** → avenue → gate → **export** (west);
    - tanker: N street → **tank gantry** → E → S1 → out;
    - bale truck + drawbar trailer;
    - closed service loop (S2/E/S3/W) with 3 cars;
    - closed minibus loop with stops at the **bus stop by the administration** and in the staff car park.
  - Models: cotton truck (cage + cotton heap that shrinks while unloading), bale truck, semi tractor + **articulated box trailer** «АҚ МАРЖАН · ЭКСПОРТ» (tractor and trailer follow the path separately), tank trailer, drawbar bale trailer, compact car, minibus with livery. All are electric with a lidar dome, unlit glowing head/tail lights, and wheels spinning with speed.
  - Traffic:
    - forward cone of 14 m + 1.6·v, ±3.2 m lateral, with smooth braking;
    - queues behind vehicles waiting at a stop;
    - **deadlock breaker** after 6 s blocked (not when queuing);
    - slows for curves, the roundabout (4.5 m/s) and the site speed limit (6.5 m/s; 14 m/s on the highway);
    - smooth stops; respawn after leaving.
  - Cotton trucks call `production.setTruckAtDock(true, onUnload)`, so the intake feed rises to every 2.2 s and the heap shrinks; the semi leaves on `production.hooks.onPalletFull` (or after 75 s). `gate.update(dt, vehicles)` lifts the barriers.
  - **11 parked vehicles**: 5 trucks at the truck parking (EV chargers) and 6 cars in the staff car park.
- `src/crowd.js`:
  - **32 humanoid robots**, drawn as instanced body parts (10 meshes for all of them): white body, glowing teal visor, helmet, glowing hi-vis vest. Walk cycle with alternating legs and arms, knee bend and body bob.
  - Roles: 6 canteen walkers (north S2 sidewalk → **W×S2 zebra** → south sidewalk → canteen door), 4 engineers with tablets (admin ↔ showroom over the **roundabout zebra**), 3 security robots (navy, gold vests, glowing «КҮЗЕТ» badge), 1 greeter waving at the gate, 3 shop visitors, 2 lab robots, 6 operators on the station platforms, 3 warehouse robots carrying cartons, 4 robots on charging pads at the robot centre.
  - Robots stand on the walking surface (sidewalk 0.2 / road 0.07 / ground 0.05 / indoor 0.16). Animation is skipped beyond 260 m from the camera.
  - **6 drones** (spinning rotors, teal ring) on inspection loops: solar farms, rooftops, tank farm, cotton fields, fence perimeter.
  - **8 outdoor AMRs** in the O–F yard, plus **14 extra arms** in the robot centre and the repair workshop. Totals: ~39 arms, ~12 AMRs/forklifts, 6 drones.
- Budget: **355 draw calls** with roofs closed. No console errors.
- Screenshots: `screenshots/p5-intake.png` (truck unloading on the weighbridge), `p5-semi.png` (semi at the dispatch dock), `p5-gate-robots.png` (greeter + security), `p5-overview.png`.

## Phase 6 — done
- `src/ui.js` + `src/ui.css`: glass interface, all text from `data.js` (`UI`, `BUILDING_INFO` for all 31 buildings, `VEHICLE_INFO`, `ROBOT_ROLES`, `FEATURES`).
  - **Top bar**: logo, title, 5 animated live counters (☀️ solar MW from the sun height, 🌱 processed cotton and 📦 finished goods from the flow nodes, 🌿 CO₂ saved, 🤖 active robots), Kazakh number format (`1 284`, `12,1`).
  - **Left dock** (44 px+ touch targets): БАСТЫ КӨРІНІС, ЖОҒАРЫДАН КӨРУ, ЗАУЫТҚА КІРУ (360° ТУР) (calls `world.tour.start()` once Phase 7 adds it; until then opens stage 1), ӨНДІРІС ПРОЦЕСІ, ҒИМАРАТТАР, КӨЛІКТЕР, РОБОТТАР, БАРЛЫҚ АТАУЛАР, ШАТЫРДЫ АШУ/ЖАБУ, КҮН / КҮН БАТУ / ТҮН, САПА, КАМЕРАНЫ ҚАЙТАРУ. On phones it collapses behind a menu button.
  - **Info card**: building (stage «Не болып жатыр?», function, role, input → output pills, robots, energy, fun fact, roof button), vehicle (live speed km/h + status, follow), robot/drone/AMR (role, live status, follow).
  - **Searchable lists** for buildings, vehicles (select = fly + follow), robots (32 humanoids by role, drones, AMRs) and the 17 process stages.
  - **Bottom bar**: fact ticker (15 features) and a 17-stage timeline; a stage flies to its building, opens the roof and highlights the chip.
  - Night theme (`body.night`) switches the glass to dark when the time of day passes 0.5.
- `src/cameraman.js`: eased fly-to with a small arc, `frameBox()` (keeps the viewing direction, pitch option), follow mode that still allows orbiting, tap picking (vehicles, humanoids, drones, AMRs, buildings; nearest wins), HUD-style corner brackets + pulsing ground ring for the selection.
- `src/labels.js`: HTML labels for 31 buildings + all vehicles, projected per frame, distance fade and overlap culling, kept clear of the top bar.
- `src/settings.js`: quality presets Төмен (pr 1, no shadows) / Орташа (pr 1.5, 2048) / Жоғары (pr 2, 4096; touch is always capped at 1.5). Default Орташа on touch, Жоғары on desktop; automatic one-step downgrade after 3 s below 25 FPS (with a toast). Time of day blends sun, sky, fog, stars and emissive night level over 2.5 s.
- `src/main.js`: interface built as the last loading step; taps go to picking; `?debug` shows an FPS / draw-call HUD and hides the font probe after 5 s.
- `scripts/shot.mjs`: `--each="js|||js"` runs a snippet before each shot.
- Screenshots: `screenshots/p6-stage-card.png` (stage 3 with roof open and the info card), `p6-vehicle-list.png` (following a cotton truck + vehicle list), `p6-night-labels.png` (night theme with all labels).

## Phase 7 — done
- `src/data.js`: `TOUR_STAGES` (17 × `{n, building, target, radius, height, duration, robots, badges}`: orbit centre/size, «Роботтар не істейді?» text and three smart-tech badges per stage, correct Kazakh) and `TOUR_TEXT` (controls, captions, finale).
- `src/tour.js` — the director, a queue of camera shots:
  - **Fly-in** (13 s): from the camera through the gate, over the monument roundabout, along the avenue and S2 to the intake; the roof opens on the way («Зауытқа кіріп келеміз…»).
  - **Per stage**: roof fades open (the previous one closes), eased approach, **360° orbit in 13 s** with a gentle height wave and a focus that drifts from the entry conveyor to the exit conveyor; corner-bracket outline + a real SpotLight with a soft light cone on the station; shadows refocus to ±140 m around the station.
  - **Between stages**: an arc above the roofs to a **real product in the glass tube** of the incoming line, followed for ~4.6 s («Өнім шыны құбырмен келесі цехқа өтіп барады»), then the approach to the next station.
  - **Right panel**: stage number, «N-кезең · 17 кезеңнің», title, 17-dot progress + orbit progress bar, «Не болып жатыр?», «Роботтар не істейді?», «Кіреді → Шығады» pills, three «Ақылды технологиялар» badges.
  - **Finale**: the semi (held at the dispatch dock since stage 16) leaves for export with a chase camera that slowly rises; the panel «ЭКСПОРТ ✈️ Әлемнің 30 еліне» appears with 17 кезең / 0% қара түтін / 100% жасыл энергия; the camera rises into an endless golden-hour panorama (`TIMES.golden`), with «Турды қайталау» / «Турдан шығу».
  - **Controls**: ⏸ Тоқтату / ▶ Жалғастыру, ◀ Алдыңғы, Келесі ▶, ✕ Турдан шығу (SVG icons), plus Space / ← / → on a keyboard. Touching the 3D view pauses and hands over manual orbit around the current station; ▶ resumes with a 1.6 s blend from wherever the user left the camera (the orbit re-syncs its angle).
  - «ӨНДІРІС ПРОЦЕСІ» list and the bottom timeline jump the tour to a stage; dock views (home / top / reset) and selecting an object exit the tour; the dock collapses to icons while touring.
- `src/vehicles.js`: `holdSemi()` / `releaseSemi()` for the finale; `src/production.js`: each line exposes its tube section (`line.ext`) and source building (`line.from`).
- Draw calls during the tour: 140–300 at stations, ~470 in the full panorama.
- Screenshots: `screenshots/p7-stage-orbit.png` (stage 1 with panel and spotlight), `p7-product-follow.png` (raw cotton in the glass tube), `p7-export.png` (export finale chase).

## Phase 8 — done
- **Time of day** (`world.js` `setSun`, blended by `settings.js` over 2.5 s): golden-hour weight drives a warmer, hazier sky (turbidity / rayleigh / mie), warm fog, clouds and hemisphere light and a slightly higher exposure; below the horizon the directional light becomes a cool **moon** (switched while its intensity is ~0) with a blue hemisphere; stars fade in. ACES + sRGB unchanged. «КҮН БАТУ» is now el 2.5° / night 0.45, the tour's golden hour el 6°.
- **Night**: windows, contour strips, clean-air towers, signs and lamp heads glow (existing `setNightLevel`); new `onNight()` hook in `materials.js`; **208 lamp light pools** as one instanced additive decal (no real lights); the showroom LED wall brightens.
- **Bloom** (`src/post.js`): EffectComposer (MSAA ×4, half-float) + **half-resolution UnrealBloom** + OutputPass, only on «Жоғары»; strength/threshold follow the night level (subtle glints by day). «Орташа» and «Төмен» render directly.
- **«15 ЕРЕКШЕЛІК»**: dock button opens a glass panel with all 15 features (verbatim) and a button that flies the camera into the showroom; `src/showroom.js` builds a **curved 25 m LED wall** inside the glass dome (3072×1024 canvas, title + 5×3 tiles, LED pixel grid) plus three product pedestals (bale, oil bottle, folded garments).
- **Touch**: page-level `touchmove` is blocked except inside the UI's scroll areas (no rubber-band), pinch is blocked, `touch-action` none on the canvas / manipulation elsewhere, `gesturestart` and double-tap zoom prevented (from Phase 0).
- **Draw calls** are now counted over the whole frame (`renderer.info.autoReset = false`, reset once per frame), i.e. including the shadow pass and bloom passes. Interiors no longer cast shadows (they still receive them). Measured: gate view 720 («Орташа»), top view 789, **top view with all 17 production roofs open 1 244** («Орташа») / 1 255 («Жоғары» + night + bloom), 961 on «Төмен». All under 1 500.
- Loading progress was already real (one `await requestAnimationFrame` per build step).
- Screenshots: `screenshots/p8-night.png`, `p8-sunset.png`, `p8-led-wall.png`, `p8-features.png`.

## Phase 9 — partly done
- `scripts/qa.mjs` (`npm run qa`): touch profile 1180×820 taps 53 interface steps (dock, card, lists, search, tour bar, finale, features, labels, roofs, time, quality, timeline, reset), screenshot after each, Kazakh glyph check (fonts API + canvas fallback comparison: no missing Ә Ғ Қ Ң Ө Ұ Ү Һ І in Inter or Unbounded), then 1180×820 / 820×1180 / 390×844 / 1920×1080 layout checks (every panel inside the viewport). Runs: all taps OK except a test-order bug (fixed); all four sizes fit; no console errors.
- Fixed from QA: on phones the menu button now sits under the top bar (the card bottom sheet covered it) and the open menu hides the card behind it.
- `README.md` (Kazakh): live link, screenshot table, 2-minute defence script, controls, tech notes.
- Still to do: merge into `main`, confirm the Pages workflow (Settings → Pages → Source «GitHub Actions» may need to be enabled once by the owner).

## Phase 10 — done (Part 2)
- `src/sim/clock.js`: game time 0–1440 min + day number; **1× = 1 game minute per real second**; speeds ⏸ 0× 1× 2× 5× 10× 30×; `jumpTo()` fast-forwards (never backwards) over 2.5 s so every transition stays smooth. Starts at **07:40, «1-күн»** — the factory is already running.
- `main.js` `stepWorld()`: `simDt = realDt × speed` drives vehicles, robots, product flow, machines, fans, water, clouds, turbines; the simulation is **sub-stepped (≤ 0.1 s)** so 30× stays stable; products, robots and stations are drawn once per frame. Camera, UI, roof fades and the tour stay on real time. `__app.step(dt)` exposes one frame for tests.
- **Sun from the clock** (`settings.js` `sunAt`): sunrise 06:00, sunset 19:55, noon elevation 56°, azimuth east → south → west; the moon light takes over at night. Light/shadows move every frame; PMREM reflections refresh only when the sky changed by > 0.8° (max ~3×/s). The dock buttons КҮН / КҮН БАТУ / ТҮН now jump the clock to 12:00 / 19:30 / 23:00; the tour finale jumps to 19:10 only during the day.
- **Day schedule** (`src/sim/life.js`, a pure function of the clock): «Таң атуда» → 06:30 «Таңғы іске қосу» (**light wave**: a glowing shell + outline flashes over the 17 production buildings in chain order; each building powers up in turn; belts, machines and fans ramp up; trucks start; toast «☀️ Қайырлы таң! Зауыт жұмысқа кірісті») → «Жұмыс уақыты» → 12:00 «Түскі үзіліс» (workers walk to the canteen and back) → 20:00 «Жұмыс аяқталуда» (no new raw cotton, products drain, at 20:30 the semi leaves with whatever is loaded) → 21:00 «Зауыт ұйқыға кетті» (belts and machines stop over 20 game minutes, fans spin down, windows fade to a soft glow, robots walk back — workers into the robot centre through its door — with dim "breathing" visors; toast «🌙 Зауыт демалып жатыр · Роботтар қуаттануда») → «Түн» (security robots, the greeter, drones and robot-centre maintenance arms keep working; the night card shows «🔋 Роботтар қуаттануда: 64% → 100%» and «Күзет ешқашан ұйықтамайды»). Trucks only start trips while the schedule allows them. 00:00: new day, toast, yesterday archived.
- **Night / dawn atmosphere** (`src/sim/night.js`): moon sprite (where the moon light comes from), milky-way band (2 600 points), 90 blinking fireflies over the park and lake shore, morning mist over the lake (05:00–08:00), a pulsing halo around the «Ақ Маржан» boll.
- **Economy engine** (`src/sim/economy.js`, constants in `data.js` `ECONOMY`, labelled «Оқу мақсатындағы шартты есеп»), booked from real events: raw unit spawned (0,5 т, raw cost 280 ₸/кг) → cleaning (waste → biogas, 40 ₸/кВт·сағ) → ginning (0,35 т fibre / 0,55 т seed per t) → baling (30 % of fibre sold as bales, booked when the bale truck leaves, 900 ₸/кг) → bottling (160 л per t of seed; revenue at the bottle dock, 950 ₸/л) → dyeing (dye + water cost) → sewing (≈ 4 000 garments per t of the remaining fibre) → packaging (cost) → dispatch (garment revenue 4 500 ₸ booked **only when the semi departs**). Logistics 35 000 ₸ per truck trip, robots 18 000 ₸ per working hour, depreciation per hour, electricity **0 ₸** (own solar + wind) with «Күн энергиясы арқылы үнемделді» at 30 ₸/кВт·сағ, CO₂ from the renewable kWh. Today (with 24 hourly buckets), yesterday and session totals. Example after the first morning: 12:40 → 37,5 т raw, 14,0 т fibre, 2 640 л oil, 24 500 garments, revenue 22 204 000 ₸, cost 17 595 460 ₸, profit 4 608 540 ₸ (26 %).
- **UI**: clock widget in the top bar (sun / dawn / dusk / moon icon, `07:42`, «1-күн», phase name, ⏸ 1× 2× 5× 10× 30×; Space = pause, keys 1–5 = speeds); the top-bar counters now read today's totals from the engine; tapping the clock or counters opens «📊 N-күн · HH:MM жағдайы бойынша» with the 12 Kazakh KPIs. `src/sim/format.js`: `Intl.NumberFormat('kk-KZ')` with a manual fallback (`12 450 000 ₸`, `3,8 т`, `1 284 л`). Panels below the top bar follow its measured height (`--top-b`), since the bar wraps on narrow screens.
- Screenshots: `screenshots/p10-day-kpi.png` (12:40, KPI panel), `p10-night.png` (01:33, sleeping factory, charging card), `p10-wake.png` (06:39, light wave + morning toast).

## Known issues
- Work is on branch `claude/trusting-sagan-r8s292`; Pages deploys only from `main` (merge in Phase 9 or earlier if a live preview is wanted).
- Kazakh Unbounded glyphs are synthesized; shapes are clean, but kerning for them is default.
- Main JS chunk ~500 kB (Three.js); fine for now.
- Opened-roof clones keep the emissive level from the moment of opening.
- Vehicles do not yield to robots on zebras (robots only cross at zebras, but traffic does not stop for them).
- **iPad FPS is not measured yet**: headless Chromium uses software rendering (SwiftShader, ~1 FPS real). The «Орташа» budget (pixel ratio 1.5, 2048 shadows, no bloom, ≤ 1 250 draw calls) is designed for 30+ FPS, and the app auto-downgrades after 3 s below 25 FPS, but this must be confirmed on the real iPad.
- Headless SwiftShader runs at a few FPS, so screenshot tests fast-forward the simulation with `world.traffic.update(0.1)` in `--eval`.
- Stations are fairly sparse at aerial distance; they read best from the tour's orbit distance (Phase 7). Machines could be scaled up further if needed.
- Headless Chromium (SwiftShader) renders this scene at well under 1 FPS, so a timed screenshot of the 7 s flight lands at its end; use `intro.peek(u)` to inspect flight frames. Real FPS must be checked on the iPad (Phase 8).
- Lake water uses PMREM reflections only (no planar reflection pass, to protect iPad FPS); the «Жоғары» preset could add `Water.js` reflections in Phase 8.
- The plot interior is still plain lawn; roads, buildings, the fence and the gate come in Phase 3. Trees inside the fence sit on its inner edge (x = ±295, z = −256, z = 234) to stay clear of the planned streets.

## Next step
Part 2, Phase 11 — «Ақылды көмекші» chatbot (offline Kazakh intent engine) and the live daily report card with charts, CSV and print. Phase 9's merge into `main` is still open.
