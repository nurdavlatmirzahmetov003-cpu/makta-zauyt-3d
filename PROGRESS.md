# PROGRESS

## Phase status
| Phase | Status |
|---|---|
| 0 — Skeleton & deployment | ✅ done |
| 1 — Landing page | ✅ done |
| 2 — Nature & environment | ✅ done |
| 3 — Buildings, roads, fence, gate | ⏳ next |
| 4 — Interior production line & flow | — |
| 5 — Robots & vehicles | — |
| 6 — UI & interactivity | — |
| 7 — 360° tour | — |
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

## Known issues
- Work is on branch `claude/trusting-sagan-r8s292`; Pages deploys only from `main` (merge in Phase 9 or earlier if a live preview is wanted).
- Kazakh Unbounded glyphs are synthesized; shapes are clean, but kerning for them is default.
- Main JS chunk ~500 kB (Three.js); fine for now.
- The gate end view targets the stand-in sign; adjust `GATE_TARGET` / `GATE_VIEW` when the real arch is built in Phase 3.
- Headless Chromium (SwiftShader) renders this scene at well under 1 FPS, so a timed screenshot of the 7 s flight lands at its end; use `intro.peek(u)` to inspect flight frames. Real FPS must be checked on the iPad (Phase 8).
- Lake water uses PMREM reflections only (no planar reflection pass, to protect iPad FPS); the «Жоғары» preset could add `Water.js` reflections in Phase 8.
- The plot interior is still plain lawn; roads, buildings, the fence and the gate come in Phase 3. Trees inside the fence sit on its inner edge (x = ±295, z = −256, z = 234) to stay clear of the planned streets.

## Next step
Phase 3 — buildings, roads, fence and the main entrance (site plan from PROMPT.md §3.1). Note: production buildings at x = ±35 with w = 52 overlap the 22 m avenue (x ±11), so use w ≈ 44 for the x = ±35 column (or shift it) to keep the avenue clear.
