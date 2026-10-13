# PROGRESS

## Phase status
| Phase | Status |
|---|---|
| 0 — Skeleton & deployment | ✅ done |
| 1 — Landing page | ⏳ next |
| 2 — Nature & environment | — |
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

## Known issues
- Work is on branch `claude/trusting-sagan-r8s292`; Pages deploys only from `main` (merge in Phase 9 or earlier if a live preview is wanted).
- Kazakh Unbounded glyphs are synthesized; shapes are clean, but kerning for them is default.
- Main JS chunk ~500 kB (Three.js); fine for now.

## Next step
Phase 1 — animated landing page (gradient, aurora blobs, cotton fluff particles, staggered title, typewriter, real loading steps, badges, cinematic transition).
