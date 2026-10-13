// Usage: node scripts/shot.mjs [out.png] [--enter] [--query=?debug]
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
const out = args.find((a) => a.endsWith('.png')) || 'screenshots/phase.png';
const enter = args.includes('--enter');
const query = (args.find((a) => a.startsWith('--query=')) || '--query=').slice(8);
const PORT = 4179;

const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
try {
  await page.goto(`http://localhost:${PORT}/${query}`);
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 60000 });
  if (enter) { await page.click('#enter-btn'); await page.waitForTimeout(900); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: out });
  console.log('saved', out);
} finally {
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
  server.kill();
  process.exit(0);
}
