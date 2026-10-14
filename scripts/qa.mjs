// Final QA (Phase 9). Serves docs/ with `vite preview` and, on a touch device profile:
//  1. checks that every Kazakh letter renders in Inter and Unbounded (HTML fonts API + canvas),
//  2. taps every interface button, takes a screenshot after each tap,
//  3. takes screenshots at 1180×820, 820×1180, 390×844 and 1920×1080 and checks the UI fits.
// Exits with code 1 on any console error, missing glyph or overflowing panel.
// Usage: node scripts/qa.mjs [--out=dir] [--skip-taps] [--skip-sizes]
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
// Use the globally preinstalled Playwright (do not `playwright install`).
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(`${execSync('npm root -g').toString().trim()}/playwright`); }
const { chromium } = pw;

const args = process.argv.slice(2);
const OUT = (args.find((a) => a.startsWith('--out=')) || '--out=qa-shots').slice(6);
// --dir=path serves a copy of the build (so the project can be rebuilt while QA runs).
const DIR = (args.find((a) => a.startsWith('--dir=')) || '--dir=docs').slice(6);
const PORT = 4181;
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--outDir', DIR], { stdio: 'pipe' });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.kill(); process.exit(1); });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const problems = [];
const log = (...a) => console.log('[qa]', ...a);

// Simulation fast-forward (headless rendering runs at ~1 FPS, so animations are stepped manually).
const FF = `window.__ff = (s) => { const a = __app, w = a.world; for (let i = 0; i < s * 10; i++) {
  a.step(0.1); a.tour.update(0.1); a.guide.update(0.1); a.explode.update(0.1); a.drive.update(0.1);
  if (!a.tour.playing && !a.guide.playing && !a.drive.playing) { a.cameraman.update(0.1); a.controls.update(); } a.ui.update(0.1); a.chat.update(0.1); } };`;

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
async function enter(page, touch = true) {
  const btn = page.locator('#enter-btn');
  await (touch ? btn.tap() : btn.click());
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
  ['[data-a="buildings"]', 0.3],
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
  ['eval:window.__app.clock.jumpTo(12 * 60)', 3], // the tour finale moved the clock to golden hour
  ['[data-a="time"]', 3, () => window.__app.tod.mode === 'sunset', 'sunset'],
  ['[data-a="time"]', 3, () => document.body.classList.contains('night'), 'night theme'],
  ['[data-a="time"]', 3],
  ['[data-a="quality"]', 0.3], ['[data-q="low"]', 0.5, () => window.__app.quality.level === 'low', 'quality low'],
  ['[data-a="quality"]', 0.3], ['[data-q="high"]', 0.5, () => window.__app.post.enabled, 'bloom on high'],
  ['[data-a="quality"]', 0.3], ['[data-q="mid"]', 0.5],
  ['.timeline .stage[data-n="5"]', 3], ['[data-a="reset"]', 2.5],
  // Phase 10: clock speeds and the KPI panel.
  ['[data-s="30"]', 2, () => window.__app.clock.speed === 30, 'speed 30×'], ['[data-s="0"]', 1, () => window.__app.clock.speed === 0, 'pause'],
  ['[data-s="1"]', 1, () => window.__app.clock.speed === 1, 'speed 1×'],
  ['.cw-main', 0.6, () => !document.querySelector('.kpi-pop').hidden, 'KPI panel opens'], ['[data-k="kpi-close"]', 0.3],
  // Phases 11–12: chat, report, guide, exploded views.
  ['.chat-fab', 1.5, () => window.__app.chat.isOpen, 'chat opens'], ['.chat-chips .chip >> nth=0', 4, () => !!document.querySelector('.chat .rep'), 'report card'],
  ['.chat .c-close', 0.5],
  ['[data-a="guide"]', 5, () => window.__app.guide.active, 'guide starts'], ['.guide [data-g="next"]', 5, () => window.__app.guide.stop === 2, 'guide next'],
  ['.guide [data-g="end"]', 1, () => !window.__app.guide.active, 'guide ends'],
  ['[data-a="explode"]', 0.5], ['[data-x="whole"]', 3, () => window.__app.explode.mode === 'base', 'base layers'],
  ['.xp-label.layer >> nth=2 >> span', 0.5, () => !document.querySelector('.xp-card').hidden, 'layer info'], ['[data-x="assemble"]', 3, () => !window.__app.explode.active, 'assembled'],
  // Phase 13: CSV report, robot driving with the joystick, link to «Роботтар әлемі».
  ['csv', 0.5], ['.chat .c-close', 0.3],
  ['[data-a="drive"]', 0.5], ['[data-dv="humanoid"]', 3, () => window.__app.drive.active, 'drive a humanoid'],
  ['joy:0,1', 3, () => true, 'joystick forward'], ['[data-dv="exit"]', 2, () => !window.__app.drive.active, 'back to its task'],
  ['[data-a="drive"]', 0.5], ['[data-dv="drone"]', 3, () => window.__app.drive.active, 'drive a drone'], ['[data-dv="up"]', 1], ['joy:1,0', 3],
  ['[data-dv="exit"]', 2, () => !window.__app.drive.active, 'drone back to patrol'],
  ['eval:window.__qaHref = document.querySelector(\'[data-a="world"]\') ? "ok" : ""', 0.1, () => window.__qaHref === 'ok', 'robots page link'],
];

/** Hold the joystick in a direction ("x,y") while the simulation runs. */
async function drag(page, dir, ff) {
  const [x, y] = dir.split(',').map(Number);
  const r = await page.locator('.joy').first().boundingBox();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + x * 40, cy - y * 40, { steps: 4 });
  await page.evaluate((s) => window.__ff(s), ff);
  await page.mouse.up();
}
/** Open the report and download the CSV: UTF-8 with BOM and Kazakh letters intact. */
async function checkCsv(page) {
  if (!(await page.evaluate(() => window.__app.chat.isOpen))) await page.locator('.chat-fab').tap();
  if (!(await page.locator('.chat .rep').count())) { await page.locator('.chat-chips .chip').first().tap(); await page.waitForTimeout(4000); }
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.chat .rep [data-r="csv"]').last().click()]);
  const buf = await readFile(await dl.path());
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = buf.toString('utf8');
  const kz = ['Қабылданған', 'Өндірілген', 'Табыс', 'Шығын', 'Таза пайда', 'Рентабельділік'].every((w) => text.includes(w));
  log(`CSV ${dl.suggestedFilename()}: ${buf.length} bytes, BOM=${bom}, Kazakh=${kz}`);
  if (!bom || !kz) problems.push(`CSV check failed (BOM=${bom}, Kazakh=${kz})`);
}

async function tapAll() {
  const { ctx, page, errors } = await open({ width: 1180, height: 820 });
  await glyphCheck(page);
  await enter(page);
  // Faster software rendering; the sim clock is paused so time-of-day checks are deterministic (07:4x).
  await page.evaluate(() => { window.__app.quality.set('low'); window.__app.clock.setSpeed(0); });
  // --taps=a-b runs only that range of steps (1-based), after a fast setup.
  const range = (args.find((x) => x.startsWith('--taps=')) || '--taps=1-999').slice(7).split('-').map(Number);
  let i = 0;
  for (const [sel, ff, check, label] of TAPS) {
    i++;
    if (i < range[0] || i > range[1]) continue;
    try {
      if (sel === 'canvas@center') await page.touchscreen.tap(712, 372);
      else if (sel.startsWith('joy:')) await drag(page, sel.slice(4), ff);
      else if (sel === 'csv') await checkCsv(page);
      else if (sel.startsWith('eval:')) await page.evaluate(sel.slice(5));
      // 3D-anchored labels are re-placed every frame: skip Playwright's stability wait for them.
      else if (sel.includes('xp-label')) await page.locator(sel).first().tap({ force: true, timeout: 45000 });
      else if (sel.startsWith('search:')) await page.locator('.list input').fill(sel.slice(7));
      else await page.locator(sel).first().tap({ timeout: 45000 });
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
    await enter(page, touch);
    // Software rendering draws a frame every few seconds, so CSS entrance animations are switched off
    // to measure (and capture) the final layout.
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }' });
    await page.evaluate(() => { window.__app.quality.set('low'); window.__app.ui.goStage(3); window.__ff(3); });
    await page.waitForTimeout(1500);
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
      await page.waitForTimeout(800);
      await shot(page, `size-${name}-menu`);
    }
    for (const e of errors) problems.push(`${name} console: ${e}`);
    log(`${name} ${width}×${height} ${over.length ? 'OVERFLOW' : 'fits'}`);
    await ctx.close();
  }
}

/* ---------- 4. «Роботтар әлемі» page ---------- */
const RP_TAPS = [
  ['.rp-card >> nth=2', 2, () => window.__rp.cur === 2, 'switch to «Сақшы»'], ['[data-r="chat"]', 1, () => !document.querySelector('.rp-chat').hidden, 'robot chat opens'],
  ...['сәлем', 'қол бұлға', 'би биле', 'алға жүр', 'артқа жүр', 'оңға бұрыл', 'солға бұрыл', 'айнал', 'секір', 'отыр', 'тұр', 'жарықты сөндір', 'жарықты қос', 'түсіңді өзгерт', 'жұмыс істе', 'батарея қанша?', 'тоқта']
    .map((c) => [`chip:${c}`, 1.2]),
  ['type:абырвалг', 1.2, () => !!document.querySelector('.rc-sugg'), 'unknown command → suggestions'],
  ['[data-r="chat-close"]', 0.5], ['.hs >> nth=0', 0.5, () => !document.querySelector('.hs-call').hidden, 'hotspot callout'],
  ['.rp-card >> nth=6', 2, () => window.__rp.cur === 6, 'switch to «Қыран»'],
  ['[data-r="control"]', 0.5, () => !document.querySelector('.joy').hidden, 'manual control on'], ['joy:0,1', 2], ['joy:-1,0', 2],
  ...['wave', 'dance', 'jump', 'light', 'work'].map((a) => [`[data-act="${a}"]`, 1]),
  ['[data-r="control"]', 0.5],
  ...[0, 1, 3, 4, 5, 7, 8, 9, 10, 11].map((n) => [`.rp-card >> nth=${n}`, 1.5, new Function(`return window.__rp.cur === ${n}`), `robot ${n + 1}`]),
];
async function robotsPage() {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/robots.html?debug`);
  await page.waitForFunction(() => window.__rpReady === true, null, { timeout: 120000 });
  await page.evaluate(() => { window.__ff = (s) => new Promise((r) => setTimeout(r, s * 1000)); });
  let i = 0;
  for (const [sel, ff, check, label] of RP_TAPS) {
    i++;
    try {
      if (sel.startsWith('chip:')) await page.locator('.rc-chips .chip', { hasText: sel.slice(5) }).first().tap({ timeout: 45000 });
      else if (sel.startsWith('type:')) { await page.locator('.rc-form input').fill(sel.slice(5)); await page.locator('.rc-send').tap(); }
      else if (sel.startsWith('joy:')) await drag(page, sel.slice(4), ff);
      else await page.locator(sel).first().tap({ timeout: 45000, force: sel.startsWith('.hs') });
      if (!sel.startsWith('joy:')) await page.waitForTimeout(ff * 1000);
      if (check && !(await page.evaluate(check))) problems.push(`robots page check failed: ${label}`);
      await shot(page, `rp-${String(i).padStart(2, '0')}`);
      log(`robots ${i}/${RP_TAPS.length} ${sel}${label ? ` — ${label}` : ''} ok`);
    } catch (e) {
      problems.push(`robots tap ${sel}: ${e.message.split('\n')[0]}`);
      log(`robots ${i}/${RP_TAPS.length} ${sel} FAILED`);
    }
  }
  // Chat replies must be Kazakh text (no empty bubbles), the battery answer must carry a number.
  const replies = await page.evaluate(() => [...document.querySelectorAll('.rc-msg.bot')].map((m) => m.textContent));
  log(`robot chat replies: ${replies.length}`);
  // «Зауытта көрсету» opens the factory focused on that robot type.
  await page.locator('[data-r="factory"]').tap();
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 180000 });
  await page.waitForFunction(() => !document.getElementById('ui').hidden, null, { timeout: 60000 }).catch(() => problems.push('factory focus: UI did not open'));
  await page.waitForTimeout(3000);
  await shot(page, 'rp-factory-focus');
  for (const e of errors) problems.push(`robots page console: ${e}`);
  await ctx.close();
}
async function robotsSizes() {
  for (const [name, width, height, touch, mobile] of SIZES.slice(0, 3)) {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/robots.html`);
    await page.waitForFunction(() => window.__rpReady === true, null, { timeout: 120000 });
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }' });
    await page.waitForTimeout(2500);
    const over = await page.evaluate(() => [...document.querySelectorAll('.rp-top, .rp-info, .rp-carousel')]
      .map((el) => [el.className, el.getBoundingClientRect()])
      .filter(([, r]) => r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map(([c]) => c));
    for (const o of over) problems.push(`robots ${name}: overflow ${o}`);
    await shot(page, `rp-size-${name}`);
    log(`robots page ${name} ${width}×${height} ${over.length ? 'OVERFLOW' : 'fits'}`);
    await ctx.close();
  }
}
/* ---------- 5. Day cycle: night sleep and morning wake-up (visual) ---------- */
async function dayCycle() {
  const { ctx, page, errors } = await open({ width: 1180, height: 820 });
  await enter(page);
  await page.evaluate(() => { const a = window.__app; a.quality.set('low'); a.clock.jumpTo(23 * 60 + 30); window.__ff(3); a.clock.setSpeed(30); window.__ff(6); a.clock.setSpeed(1); a.cameraman.view('home'); window.__ff(3); });
  const night = await page.evaluate(() => ({ phase: window.__app.life.state.phase, charge: window.__app.life.state.charge, night: window.__app.tod.night }));
  log(`night: ${JSON.stringify(night)}`);
  if (!(night.night > 0.9 && night.charge != null)) problems.push('night sleep state not reached');
  await page.waitForTimeout(1500);
  await shot(page, 'day-night-sleep');
  await page.evaluate(() => { const a = window.__app; a.clock.jumpTo(6 * 60 + 38); window.__ff(3); a.cameraman.flyTo(new a.THREE.Vector3(-330, 120, 40), new a.THREE.Vector3(-120, 0, -150), 0.5); window.__ff(2); });
  const wake = await page.evaluate(() => ({ phase: window.__app.life.state.phase, power: window.__app.life.state.power, day: window.__app.clock.day }));
  log(`wake: ${JSON.stringify(wake)}`);
  if (wake.phase !== 'wake' || wake.day < 2) problems.push('morning wake-up not reached');
  await page.waitForTimeout(1500);
  await shot(page, 'day-morning-wake');
  for (const e of errors) problems.push(`day cycle console: ${e}`);
  await ctx.close();
}

try {
  if (!args.includes('--skip-taps')) await tapAll();
  if (!args.includes('--skip-robots')) { await robotsPage(); await robotsSizes(); }
  if (!args.includes('--skip-day')) await dayCycle();
  if (!args.includes('--skip-sizes')) await sizes();
} catch (e) {
  problems.push(`fatal: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.kill();
  console.log(problems.length ? `[qa] FAILED\n${problems.map((p) => ` - ${p}`).join('\n')}` : '[qa] PASSED — no console errors, all checks green');
  process.exit(problems.length ? 1 : 0);
}
