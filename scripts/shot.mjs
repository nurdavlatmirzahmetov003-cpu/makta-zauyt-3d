// Usage: node scripts/shot.mjs [out.png ...] [--enter] [--query=?debug] [--wait=ms,ms,...]
// With several outputs, each is taken after the matching --wait delay (cumulative).
// Serves docs/ via `vite preview`, takes a 1180x820 screenshot, prints console errors.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
// Use the globally preinstalled Playwright (do not `playwright install`).
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(`${execSync('npm root -g').toString().trim()}/playwright`); }
const { chromium } = pw;
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const outs = args.filter((a) => a.endsWith('.png'));
if (!outs.length) outs.push('screenshots/phase.png');
const waits = (args.find((a) => a.startsWith('--wait=')) || '--wait=').slice(7).split(',').filter(Boolean).map(Number);
const enter = args.includes('--enter');
const query = (args.find((a) => a.startsWith('--query=')) || '--query=').slice(8);
// --views="x,y,z,tx,ty,tz;..." places the camera before each shot (needs --enter and ?debug).
const views = (args.find((a) => a.startsWith('--views=')) || '--views=').slice(8).split(';').filter(Boolean)
  .map((v) => v.split(',').map(Number));
const PORT = 4179;

// --each="js1|||js2" runs a snippet before the matching shot.
const each = (args.find((a) => a.startsWith('--each=')) || '--each=').slice(7).split('|||');
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
// Don't leave the preview server running if this script is killed (e.g. by `timeout`).
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.kill(); process.exit(1); });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  else if (m.text().startsWith('[world]')) console.log(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
try {
  await page.goto(`http://localhost:${PORT}/${query}`);
  // --ready=__rpReady waits for another page's flag (robots.html).
  const ready = (args.find((x) => x.startsWith('--ready=')) || '--ready=__sceneReady').slice(8);
  await page.waitForFunction((k) => window[k] === true, ready, { timeout: 120000 });
  if (enter) { await page.waitForTimeout(600); await page.click('#enter-btn'); }
  // --eval="js" runs in the page before the first shot (debug experiments).
  const ev = args.find((a) => a.startsWith('--eval='));
  if (ev) await page.evaluate(ev.slice(7));
  for (let i = 0; i < outs.length; i++) {
    if (each[i]) await page.evaluate(each[i]);
    if (views[i]) {
      await page.evaluate((v) => {
        const { intro, camera, controls } = window.__app;
        intro.skip();
        camera.position.set(v[0], v[1], v[2]);
        controls.target.set(v[3], v[4], v[5]);
        controls.update();
      }, views[i]);
    }
    await page.waitForTimeout(waits[i] ?? 1500);
    await page.screenshot({ path: outs[i], timeout: 120000 });
    console.log('saved', outs[i]);
  }
} catch (e) {
  console.log('[shot] failed:', e.message.split('\n')[0]);
} finally {
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
  server.kill();
  process.exit(0);
}
