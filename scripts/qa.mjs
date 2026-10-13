// Final QA (Phase 9). Serves docs/ with `vite preview` and, on a touch device profile:
//  1. checks that every Kazakh letter renders in Inter and Unbounded (HTML fonts API + canvas),
//  2. taps every interface button, takes a screenshot after each tap,
//  3. takes screenshots at 1180×820, 820×1180, 390×844 and 1920×1080 and checks the UI fits.
// Exits with code 1 on any console error, missing glyph or overflowing panel.
// Usage: node scripts/qa.mjs [--out=dir] [--skip-taps] [--skip-sizes]
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
// Use the globally preinstalled Playwright (do not `playwright install`).
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(`${execSync('npm root -g').toString().trim()}/playwright`); }
const { chromium } = pw;

const args = process.argv.slice(2);
const OUT = (args.find((a) => a.startsWith('--out=')) || '--out=qa-shots').slice(6);
const PORT = 4181;
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.kill(); process.exit(1); });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const problems = [];
const log = (...a) => console.log('[qa]', ...a);

// Simulation fast-forward (headless rendering runs at ~1 FPS, so animations are stepped manually).
const FF = `window.__ff = (s) => { const a = __app, w = a.world; for (let i = 0; i < s * 10; i++) {
  w.production.update(0.1); w.site.update(0.1); w.traffic.update(0.1); w.robots.update(0.1, a.camera);
  a.tod.update(0.1); a.tour.update(0.1); if (!a.tour.playing) { a.cameraman.update(0.1); a.controls.update(); } a.ui.update(0.1); } };`;

async function open({ width, height, touch = true, mobile = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 120000 });
  await page.addStyleTag({ content: '.debug-hud, .font-debug { display: none !important; }' });
  return { ctx, page, errors };
}
async function enter(page) {
  await page.locator('#enter-btn').tap();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__app.intro.skip());
  await page.waitForFunction(() => !document.getElementById('ui').hidden, null, { timeout: 60000 });
  await page.evaluate(FF);
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 70, timeout: 180000 });

/* ---------- 1. Kazakh glyphs ---------- */
async function glyphCheck(page) {
  const res = await page.evaluate(() => {
    const G = 'ӘәҒғҚқҢңӨөҰұҮүҺһІі';
    const out = {};
    const c = document.createElement('canvas').getContext('2d');
    for (const fam of ['Inter', 'Unbounded']) {
      const html = document.fonts.check(`700 32px ${fam}`, G);
      // A glyph missing from the family falls back to the default serif face: same advance width.
      const missing = [...G].filter((ch) => {
        c.font = `700 64px ${fam}, serif`;
        const a = c.measureText(ch).width;
        c.font = '700 64px serif';
        return Math.abs(a - c.measureText(ch).width) < 0.01;
      });
      out[fam] = { html, missing: missing.join('') };
    }
    return out;
  });
  for (const [fam, r] of Object.entries(res)) {
    log(`glyphs ${fam}: fonts.check=${r.html} canvas-missing="${r.missing}"`);
    if (!r.html || r.missing) problems.push(`Kazakh glyphs missing in ${fam}: ${r.missing}`);
  }
}

/* ---------- 2. Tap every button ---------- */
const TAPS = [
  ['[data-a="home"]', 2.5], ['[data-a="top"]', 2.5],
  ['canvas@center', 2.5, () => !document.querySelector('#ui .card').hidden, 'tap on a building opens the card'],
  ['[data-a="card-roof"]', 1.5], ['[data-a="card-close"]', 0.5],
  ['[data-a="buildings"]', 0.3], ['.list-items .item >> nth=2', 2.5], ['[data-a="card-roof"]', 1.5], ['[data-a="card-close"]', 0.5],
  ['[data-a="vehicles"]', 0.3], ['.list-items .item >> nth=0', 3], ['[data-a="card-follow"]', 1], ['[data-a="card-close"]', 0.5],
  ['[data-a="robots"]', 0.3], ['.list-items .item >> nth=0', 3], ['[data-a="card-close"]', 0.5],
  ['[data-a="robots"]', 0.3], ['[data-a="list-close"]', 0.3],
  ['search:қойма', 0.3, () => document.querySelectorAll('.list-items .item').length > 0, 'search finds «қойма»'],
  ['.list-items .item >> nth=0', 2.5], ['[data-a="card-close"]', 0.5],
  ['[data-a="process"]', 0.3], ['.list-items .item >> nth=2', 12, () => window.__app.tour.active && window.__app.tour.stage === 3, 'process list jumps the tour to stage 3'],
  ['.tour-bar [data-t="play"]', 0.5, () => !window.__app.tour.playing, 'pause'],
  ['.tour-bar [data-t="play"]', 2, () => window.__app.tour.playing, 'resume'],
  ['.tour-bar [data-t="next"]', 10], ['.tour-bar [data-t="prev"]', 10],
  ['.timeline .stage[data-n="17"]', 16], ['.tour-bar [data-t="next"]', 14, () => !document.querySelector('.tour-finale').hidden, 'export finale'],
  ['.tour-finale [data-t="replay"]', 6, () => window.__app.tour.phase === 'intro', 'replay restarts the fly-in'],
  ['.tour-bar [data-t="exit"]', 1, () => !window.__app.tour.active, 'exit tour'],
  ['[data-a="tour"]', 6], ['.tour-bar [data-t="exit"]', 1],
  ['[data-a="features"]', 0.5], ['[data-a="features-close"]', 0.3],
  ['[data-a="features"]', 0.3], ['[data-a="features-led"]', 3],
  ['[data-a="labels"]', 0.5], ['[data-a="labels"]', 0.3],
  ['[data-a="roof"]', 1.5], ['[data-a="roof"]', 1.5],
  ['[data-a="time"]', 3, () => window.__app.tod.mode === 'sunset', 'sunset'],
  ['[data-a="time"]', 3, () => document.body.classList.contains('night'), 'night theme'],
  ['[data-a="time"]', 3],
  ['[data-a="quality"]', 0.3], ['[data-q="low"]', 0.5, () => window.__app.quality.level === 'low', 'quality low'],
  ['[data-a="quality"]', 0.3], ['[data-q="high"]', 0.5, () => window.__app.post.enabled, 'bloom on high'],
  ['[data-a="quality"]', 0.3], ['[data-q="mid"]', 0.5],
  ['.timeline .stage[data-n="5"]', 3], ['[data-a="reset"]', 2.5],
];

async function tapAll() {
  const { ctx, page, errors } = await open({ width: 1180, height: 820 });
  await glyphCheck(page);
  await enter(page);
  await page.evaluate(() => window.__app.quality.set('low')); // faster software rendering
  let i = 0;
  for (const [sel, ff, check, label] of TAPS) {
    i++;
    try {
      if (sel === 'canvas@center') await page.touchscreen.tap(712, 372);
      else if (sel.startsWith('search:')) await page.locator('.list input').fill(sel.slice(7));
      else await page.locator(sel).first().tap({ timeout: 15000 });
      await page.evaluate((s) => window.__ff(s), ff);
      if (check && !(await page.evaluate(check))) problems.push(`check failed: ${label}`);
      await shot(page, `tap-${String(i).padStart(2, '0')}`);
      log(`${i}/${TAPS.length} ${sel}${label ? ` — ${label}` : ''} ok`);
    } catch (e) {
      problems.push(`tap ${sel}: ${e.message.split('\n')[0]}`);
      log(`${i}/${TAPS.length} ${sel} FAILED`);
    }
  }
  for (const e of errors) problems.push(`console: ${e}`);
  await ctx.close();
}

/* ---------- 3. Screen sizes ---------- */
const SIZES = [
  ['ipad-landscape', 1180, 820, true, false], ['ipad-portrait', 820, 1180, true, false],
  ['phone', 390, 844, true, true], ['desktop', 1920, 1080, false, false],
];
async function sizes() {
  for (const [name, width, height, touch, mobile] of SIZES) {
    const { ctx, page, errors } = await open({ width, height, touch, mobile });
    await shot(page, `size-${name}-landing`);
    await enter(page);
    await page.evaluate(() => { window.__app.quality.set('mid'); window.__app.ui.goStage(3); window.__ff(3); });
    // Every visible panel must stay inside the viewport.
    const over = await page.evaluate(() => [...document.querySelectorAll('#ui .topbar, #ui .dock, #ui .card, #ui .bottombar, #ui .timeline')]
      .filter((el) => !el.closest('[hidden]') && el.offsetParent !== null)
      .map((el) => [el.className, el.getBoundingClientRect()])
      .filter(([, r]) => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
      .map(([c, r]) => `${c} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`));
    for (const o of over) problems.push(`${name}: overflow ${o}`);
    await shot(page, `size-${name}-ui`);
    if (mobile) {
      await page.locator('[data-a="toggle"]').tap();
      await page.evaluate(() => window.__ff(0.5));
      await shot(page, `size-${name}-menu`);
    }
    for (const e of errors) problems.push(`${name} console: ${e}`);
    log(`${name} ${width}×${height} ${over.length ? 'OVERFLOW' : 'fits'}`);
    await ctx.close();
  }
}

try {
  if (!args.includes('--skip-taps')) await tapAll();
  if (!args.includes('--skip-sizes')) await sizes();
} catch (e) {
  problems.push(`fatal: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.kill();
  console.log(problems.length ? `[qa] FAILED\n${problems.map((p) => ` - ${p}`).join('\n')}` : '[qa] PASSED — no console errors, all checks green');
  process.exit(problems.length ? 1 : 0);
}
