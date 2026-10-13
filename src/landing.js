// Landing screen: animated title, typewriter, cotton-fluff particles, real loading progress.
import { TEXT, SUBTITLES, BADGES } from './data.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

/* ---------- Title: letters rise one by one, shared teal→gold gradient + shimmer ---------- */
function buildTitle(el, text) {
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const letters = [];
  let i = 0;
  text.split(' ').forEach((word, wi, words) => {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const l = document.createElement('span');
      l.className = 'ch';
      l.textContent = ch;
      l.style.setProperty('--i', i++);
      w.appendChild(l);
      letters.push(l);
    }
    el.appendChild(w);
    if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  // Each letter clips its own slice of one title-wide gradient, so the colour flows across lines.
  const layout = () => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--tw', `${r.width}px`);
    for (const l of letters) {
      const lr = l.getBoundingClientRect();
      l.style.setProperty('--off', `${lr.left - r.left}px`);
    }
  };
  layout();
  addEventListener('resize', layout);
  document.fonts.ready.then(layout);
  return layout;
}

/* ---------- Typewriter subtitle ---------- */
function startTypewriter(el, lines) {
  if (REDUCED) {
    el.textContent = lines[0];
    return;
  }
  let line = 0, pos = 0, dir = 1;
  const tick = () => {
    const chars = [...lines[line]];
    pos += dir;
    el.textContent = chars.slice(0, pos).join('');
    let delay = dir > 0 ? 42 + Math.random() * 38 : 18;
    if (dir > 0 && pos >= chars.length) { dir = -1; delay = 2600; }
    else if (dir < 0 && pos <= 0) { dir = 1; line = (line + 1) % lines.length; delay = 380; }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 900);
}

/* ---------- Floating cotton fluffs ---------- */
function makeFluffSprite(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;
  // Fine fibres
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = size / 90;
  for (let k = 0; k < 46; k++) {
    const a = Math.random() * Math.PI * 2;
    const len = r * (0.55 + Math.random() * 0.4);
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.quadraticCurveTo(r + Math.cos(a + 0.4) * len * 0.5, r + Math.sin(a + 0.4) * len * 0.5,
      r + Math.cos(a) * len, r + Math.sin(a) * len);
    ctx.stroke();
  }
  // Soft puffs
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const d = k === 0 ? 0 : r * 0.22;
    const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d;
    const pr = r * (0.3 + Math.random() * 0.12);
    const g = ctx.createRadialGradient(x - pr * 0.3, y - pr * 0.3, pr * 0.1, x, y, pr);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,250,240,0.75)');
    g.addColorStop(1, 'rgba(255,250,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function startFluff(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = [makeFluffSprite(128), makeFluffSprite(128), makeFluffSprite(128)];
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const count = W < 600 ? 60 : 76;
  const parts = Array.from({ length: count }, () => {
    const z = Math.random(); // 0 = far, 1 = near
    return {
      x: Math.random() * W, y: Math.random() * H, z,
      size: 14 + z * 46, speed: 10 + z * 34,
      sway: 8 + Math.random() * 22, phase: Math.random() * 10,
      rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.6,
      vx: 0, vy: 0, sprite: sprites[(Math.random() * 3) | 0],
      alpha: 0.35 + z * 0.55,
    };
  });
  parts.sort((a, b) => a.z - b.z);

  const pointer = { x: -9999, y: -9999, px: 0, py: 0 };
  const onMove = (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.px = e.clientX / W - 0.5; pointer.py = e.clientY / H - 0.5;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  const par = { x: 0, y: 0 };

  let running = true, last = performance.now();
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    par.x += (pointer.px - par.x) * 0.04;
    par.y += (pointer.py - par.y) * 0.04;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (!REDUCED) {
        p.y -= p.speed * dt;
        p.rot += p.spin * dt;
        // Repel from pointer / finger
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy, R = 140;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 420 * (0.4 + p.z);
          p.vx += (dx / d) * f * dt;
          p.vy += (dy / d) * f * dt;
        }
        p.vx *= 0.94; p.vy *= 0.94;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y < -p.size) { p.y = H + p.size; p.x = Math.random() * W; }
        if (p.x < -80) p.x = W + 60; else if (p.x > W + 80) p.x = -60;
      }
      const sx = p.x + Math.sin(t * 0.6 + p.phase) * p.sway - par.x * 60 * p.z;
      const sy = p.y - par.y * 40 * p.z;
      ctx.globalAlpha = p.alpha;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (!REDUCED) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => {
    running = false;
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onMove);
  };
}

/* ---------- Film grain (generated once) ---------- */
function makeGrain(el) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL()})`;
}

/* ---------- Public API ---------- */
export function createLanding({ onEnter }) {
  const root = $('landing');
  if (REDUCED) root.classList.add('reduced');
  $('eyebrow').textContent = TEXT.eyebrow;
  $('enter-label').textContent = TEXT.enter;
  $('badges').innerHTML = BADGES.map((b, i) =>
    `<li style="--i:${i}"><span class="badge-ico">${b.icon}</span>${b.text}</li>`).join('');
  $('progress-msg').textContent = TEXT.loading;
  buildTitle($('title'), TEXT.title);
  startTypewriter($('typer'), SUBTITLES);
  makeGrain(root.querySelector('.grain'));
  const stopFluff = startFluff($('fluff'));
  requestAnimationFrame(() => root.classList.add('in'));

  const bar = $('progress-bar'), msg = $('progress-msg'), pct = $('progress-pct');
  const btn = $('enter-btn');
  let shown = 0;
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    root.classList.add('hide');
    setTimeout(() => { stopFluff(); root.hidden = true; }, 1100);
    onEnter();
  });

  return {
    /** fraction 0..1 of the real scene-building work; message shown under the bar. */
    progress(fraction, message) {
      shown = Math.max(shown, Math.min(1, fraction));
      bar.style.width = `${(shown * 100).toFixed(1)}%`;
      pct.textContent = `${Math.round(shown * 100)}%`;
      if (message && msg.textContent !== message) {
        msg.classList.remove('swap');
        void msg.offsetWidth;
        msg.textContent = message;
        msg.classList.add('swap');
      }
    },
    ready() {
      this.progress(1, TEXT.ready);
      root.classList.add('loaded');
      btn.disabled = false;
    },
  };
}
