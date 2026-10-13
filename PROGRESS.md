# PROGRESS

## Phase status
| Phase | Status |
|---|---|
| 0 — Skeleton & deployment | ✅ done |
| 1 — Landing page | ✅ done |
| 2 — Nature & environment | ⏳ next |
| 3 — Buildings, roads, fence, gate | — |
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

## Known issues
- Work is on branch `claude/trusting-sagan-r8s292`; Pages deploys only from `main` (merge in Phase 9 or earlier if a live preview is wanted).
- Kazakh Unbounded glyphs are synthesized; shapes are clean, but kerning for them is default.
- Main JS chunk ~500 kB (Three.js); fine for now.
- The flight currently crosses an empty flat plane (temporary 14 km ground). Phase 2 terrain, mountains and cotton fields will fill it. Re-tune `PATH` in `src/intro.js` once the mountains exist.
- The gate end view targets the stand-in sign; adjust `GATE_TARGET` / `GATE_VIEW` when the real arch is built in Phase 3.

## Next step
Phase 2 — nature and environment (Sky.js + PMREM, fbm terrain with snowy mountains, lake, cotton fields with harvester, trees, solar farms, wind turbines, clouds/stars). Split the scene building into more loading steps so the progress bar stays meaningful.
