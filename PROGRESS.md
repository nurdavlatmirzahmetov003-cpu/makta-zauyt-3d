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
| 7 — 360° tour | ⏳ next |
| 8 — Lighting, polish, performance | — |
| 9 — Final QA & publishing | — |

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

## Known issues
- Work is on branch `claude/trusting-sagan-r8s292`; Pages deploys only from `main` (merge in Phase 9 or earlier if a live preview is wanted).
- Kazakh Unbounded glyphs are synthesized; shapes are clean, but kerning for them is default.
- Main JS chunk ~500 kB (Three.js); fine for now.
- Night mode works from the dock, but bloom and lamp light pools come in Phase 8; the night scene is still quite dark.
- Opened-roof clones keep the emissive level from the moment of opening.
- Vehicles do not yield to robots on zebras (robots only cross at zebras, but traffic does not stop for them).
- Headless SwiftShader runs at a few FPS, so screenshot tests fast-forward the simulation with `world.traffic.update(0.1)` in `--eval`.
- Stations are fairly sparse at aerial distance; they read best from the tour's orbit distance (Phase 7). Machines could be scaled up further if needed.
- Headless Chromium (SwiftShader) renders this scene at well under 1 FPS, so a timed screenshot of the 7 s flight lands at its end; use `intro.peek(u)` to inspect flight frames. Real FPS must be checked on the iPad (Phase 8).
- Lake water uses PMREM reflections only (no planar reflection pass, to protect iPad FPS); the «Жоғары» preset could add `Water.js` reflections in Phase 8.
- The plot interior is still plain lawn; roads, buildings, the fence and the gate come in Phase 3. Trees inside the fence sit on its inner edge (x = ±295, z = −256, z = 234) to stay clear of the planned streets.

## Next step
Phase 7 — 360° tour (`src/tour.js`: 17 stages along the product path with an orbit camera at each station, stage text from `STAGES`, finale «ЭКСПОРТ ✈️ Әлемнің 30 еліне»; hook into `world.tour.start()` and `ui.setActiveStage()`).
