// Canvas textures for the built environment: façades, glass, green walls, paving, asphalt, fence…
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { PALETTE } from './data.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function toTex(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

function speckle(ctx, w, h, n, seed, light, dark, a0 = 0.05, a1 = 0.2, s0 = 1, s1 = 2.5) {
  const r = mulberry32(seed);
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? light : dark},${a0 + r() * (a1 - a0)})`;
    const s = s0 + r() * (s1 - s0);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

/** White composite façade panels (tile = 6 m: 2 × 4 panels of 3 × 1.5 m). */
export function panelTexture() {
  const [c, ctx] = canvas(512);
  const r = mulberry32(41);
  const pw = 256, ph = 128;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 4; j++) {
      const v = 244 + r() * 8;
      const g = ctx.createLinearGradient(0, j * ph, 0, (j + 1) * ph);
      g.addColorStop(0, `rgb(${v},${v + 1},${v})`);
      g.addColorStop(1, `rgb(${v - 7},${v - 6},${v - 7})`);
      ctx.fillStyle = g;
      ctx.fillRect(i * pw, j * ph, pw, ph);
    }
  }
  ctx.fillStyle = 'rgba(40,55,60,0.28)';
  for (let i = 0; i <= 2; i++) ctx.fillRect(i * pw - 1, 0, 3, 512);
  for (let j = 0; j <= 4; j++) ctx.fillRect(0, j * ph - 1, 512, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let j = 0; j < 4; j++) ctx.fillRect(0, j * ph + 2, 512, 1);
  return toTex(c);
}

/**
 * Curtain-wall glass (tile = 6 m): reflective blue-teal panes with mullions.
 * Returns { map, emissive } — the emissive map lights ~70 % of the panes warmly at night.
 */
export function glassTextures() {
  const [c, ctx] = canvas(512);
  const [e, ectx] = canvas(512);
  const r = mulberry32(17);
  const cols = 4, rows = 2, cw = 512 / cols, ch = 512 / rows;
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
      const t = r() * 12;
      g.addColorStop(0, `rgb(${58 + t},${96 + t},${112 + t})`);
      g.addColorStop(0.55, `rgb(${34 + t},${66 + t},${82 + t})`);
      g.addColorStop(1, `rgb(${48 + t},${84 + t},${100 + t})`);
      ctx.fillStyle = g;
      ctx.fillRect(i * cw, j * ch, cw, ch);
      if (r() < 0.72) {
        const warm = r();
        ectx.fillStyle = `rgb(255,${200 + warm * 40},${130 + warm * 70})`;
        ectx.globalAlpha = 0.55 + r() * 0.45;
        ectx.fillRect(i * cw + 6, j * ch + 6, cw - 12, ch - 12);
        ectx.globalAlpha = 1;
      }
    }
  }
  ctx.fillStyle = '#cfd6d9';
  ectx.fillStyle = '#000';
  for (let i = 0; i <= cols; i++) { ctx.fillRect(i * cw - 4, 0, 8, 512); ectx.fillRect(i * cw - 5, 0, 10, 512); }
  for (let j = 0; j <= rows; j++) { ctx.fillRect(0, j * ch - 5, 512, 10); ectx.fillRect(0, j * ch - 6, 512, 12); }
  return { map: toTex(c), emissive: toTex(e) };
}

/** Living green wall: dense foliage with a few blossoms (tile = 4 m). */
export function greenWallTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#2f5e2c';
  ctx.fillRect(0, 0, 256, 256);
  const r = mulberry32(53);
  for (let k = 0; k < 900; k++) {
    const x = r() * 256, y = r() * 256, s = 4 + r() * 9;
    ctx.fillStyle = `hsl(${85 + r() * 50},${35 + r() * 30}%,${22 + r() * 26}%)`;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * (0.5 + r() * 0.4), r() * 3.14, 0, Math.PI * 2);
    ctx.fill();
  }
  const blossoms = ['#f5c04a', '#ffffff', '#ff8fb1', '#b58cff'];
  for (let k = 0; k < 60; k++) {
    ctx.fillStyle = blossoms[(r() * blossoms.length) | 0];
    ctx.beginPath();
    ctx.arc(r() * 256, r() * 256, 1.5 + r() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c);
}

/** Asphalt with fine aggregate (tile = 8 m). */
export function asphaltTexture() {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#3d4247';
  ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, 9000, 61, '210,215,220', '15,18,20', 0.05, 0.28, 1, 2.2);
  const r = mulberry32(62);
  for (let k = 0; k < 14; k++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '20,24,28' : '120,125,130'},0.05)`;
    ctx.beginPath();
    ctx.arc(r() * 512, r() * 512, 30 + r() * 80, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c);
}

/** Light concrete apron for the industrial yards: 6 m slabs with joints (tile = 12 m). */
export function apronTexture() {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#b7bbb8';
  ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, 6000, 71, '235,236,232', '90,95,95', 0.05, 0.18, 1, 2);
  const r = mulberry32(72);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,60,55'},${0.03 + r() * 0.04})`;
      ctx.fillRect(i * 256, j * 256, 256, 256);
    }
  }
  ctx.fillStyle = 'rgba(60,64,66,0.45)';
  for (let i = 0; i <= 2; i++) { ctx.fillRect(i * 256 - 1, 0, 2, 512); ctx.fillRect(0, i * 256 - 1, 512, 2); }
  return toTex(c);
}

/** Pavers for sidewalks and plazas: 0.5 m tiles with a teal accent row (tile = 4 m). */
export function pavingTexture() {
  const [c, ctx] = canvas(256);
  const r = mulberry32(81);
  const n = 8, s = 256 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 214 + r() * 18;
      ctx.fillStyle = j === 3 && i % 2 === 0 ? '#9fd4cb' : `rgb(${v},${v - 3},${v - 10})`;
      ctx.fillRect(i * s, j * s, s, s);
    }
  }
  ctx.fillStyle = 'rgba(90,85,75,0.5)';
  for (let i = 0; i <= n; i++) { ctx.fillRect(i * s - 1, 0, 2, 256); ctx.fillRect(0, i * s - 1, 256, 2); }
  return toTex(c);
}

/** Light standing-seam roof membrane (tile = 8 m). */
export function roofTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#dfe3e3';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 2000, 91, '255,255,255', '120,125,125', 0.05, 0.15, 1, 2);
  ctx.fillStyle = 'rgba(80,90,92,0.22)';
  for (let i = 0; i < 256; i += 16) ctx.fillRect(i, 0, 2, 256);
  return toTex(c);
}

/** Timber deck boards (tile = 4 m). */
export function deckTexture() {
  const [c, ctx] = canvas(256);
  const r = mulberry32(95);
  for (let j = 0; j < 16; j++) {
    ctx.fillStyle = `hsl(${26 + r() * 8},${38 + r() * 12}%,${46 + r() * 10}%)`;
    ctx.fillRect(0, j * 16, 256, 15);
    ctx.fillStyle = 'rgba(60,35,20,0.5)';
    ctx.fillRect(r() * 256, j * 16, 2, 15);
  }
  return toTex(c);
}

/** Yellow-black safety stripes (tile = 1 m). */
export function hazardTexture() {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#1f2326';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f2c230';
  for (let k = -128; k < 256; k += 64) {
    ctx.beginPath();
    ctx.moveTo(k, 0); ctx.lineTo(k + 32, 0); ctx.lineTo(k + 160, 128); ctx.lineTo(k + 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  return toTex(c);
}

/** Red / white boom-barrier arm. */
export function barrierTexture() {
  const [c, ctx] = canvas(256, 32);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#e23b3b';
    ctx.fillRect(i * 32, 0, 32, 32);
  }
  return toTex(c);
}

/** Steel mesh fence panel (alpha-tested, tile = 2.4 m). */
export function fenceTexture() {
  const [c, ctx] = canvas(256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(190,200,205,1)';
  ctx.lineWidth = 3;
  for (let k = -256; k < 512; k += 21) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 256, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k + 256, 0); ctx.lineTo(k, 256); ctx.stroke();
  }
  ctx.lineWidth = 7;
  ctx.strokeRect(0, 0, 256, 256);
  return toTex(c, { aniso: 4 });
}

/** Scrolling stripes used for fountain jets and laser sweeps (white on transparent). */
export function dashTexture() {
  const [c, ctx] = canvas(128, 16);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 16);
  return toTex(c, { aniso: 1 });
}

/** Large procedural macro "photograph" of an open cotton boll, for the gate light boxes. */
export function cottonPhotoTexture() {
  const W = 768, H = 1024;
  const [c, ctx] = canvas(W, H);
  const r = mulberry32(2040);
  // Background: soft sky above, out-of-focus cotton field and leaves below (bokeh).
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#8fcaf2');
  bg.addColorStop(0.45, '#d9eef8');
  bg.addColorStop(0.7, '#9dbb72');
  bg.addColorStop(1, '#3f6a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'blur(10px)';
  for (let k = 0; k < 120; k++) {
    const y = H * (0.55 + r() * 0.45), x = r() * W, rad = 10 + r() * 34;
    ctx.fillStyle = r() < 0.45 ? `rgba(255,253,246,${0.55 + r() * 0.35})` : `rgba(${50 + r() * 50},${100 + r() * 50},${40 + r() * 20},0.75)`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  const cx = W * 0.5, cy = H * 0.44, R = 300;
  // Stem and two leaves.
  ctx.strokeStyle = '#4e3a22';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy + 150);
  ctx.quadraticCurveTo(cx - 30, H * 0.82, cx + 20, H + 20);
  ctx.stroke();
  for (const [sx, ang] of [[-1, 2.5], [1, 0.6]]) {
    ctx.save();
    ctx.translate(cx + sx * 20, H * 0.8);
    ctx.rotate(ang);
    const lg = ctx.createLinearGradient(0, -60, 0, 60);
    lg.addColorStop(0, '#5f9a3e');
    lg.addColorStop(1, '#2f5a22');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(70, -90, 200, -60, 230, 0);
    ctx.bezierCurveTo(200, 60, 70, 90, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  // Dry bur: a dark five-pointed star of carpels behind the locks.
  const N = 5, rot = -Math.PI / 2 + Math.PI / N;
  for (let k = 0; k < N; k++) {
    const a = rot + (k / N) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, R * 1.05, 0);
    g.addColorStop(0, '#2c1d10');
    g.addColorStop(0.7, '#5b3d22');
    g.addColorStop(1, '#8a6238');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.quadraticCurveTo(R * 0.7, -80, R * 1.05, 0);
    ctx.quadraticCurveTo(R * 0.7, 80, 0, 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,90,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(R * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }
  // Five fluffy locks between the carpels, drawn back to front with soft crease shadows.
  const locks = [];
  for (let k = 0; k < N; k++) {
    const a = -Math.PI / 2 + (k / N) * Math.PI * 2;
    locks.push({ x: cx + Math.cos(a) * R * 0.42, y: cy + Math.sin(a) * R * 0.42, a, rx: R * 0.5, ry: R * 0.4 });
  }
  locks.sort((p, q) => p.y - q.y);
  for (const L of locks) {
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate(L.a + Math.PI / 2);
    // Shadow under the lock (crease).
    ctx.shadowColor = 'rgba(60,50,40,0.45)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    const base = ctx.createRadialGradient(-L.rx * 0.25, -L.ry * 0.35, 10, 0, 0, L.rx);
    base.addColorStop(0, '#ffffff');
    base.addColorStop(0.55, '#f6f3ec');
    base.addColorStop(1, '#d7d1c4');
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Billowy sub-puffs.
    for (let k = 0; k < 26; k++) {
      const t = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = Math.cos(t) * L.rx * 0.75 * d, y = Math.sin(t) * L.ry * 0.75 * d;
      const pr = L.rx * (0.18 + r() * 0.2);
      const g = ctx.createRadialGradient(x - pr * 0.35, y - pr * 0.4, pr * 0.05, x, y, pr);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.7, 'rgba(244,240,232,0.45)');
      g.addColorStop(1, 'rgba(210,204,192,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fibres: fine curved strokes, bright and a few darker ones for depth.
    for (let k = 0; k < 520; k++) {
      const t = r() * Math.PI * 2, d = 0.3 + r() * 0.75;
      const x = Math.cos(t) * L.rx * d * 0.9, y = Math.sin(t) * L.ry * d * 0.9;
      ctx.strokeStyle = r() < 0.85 ? `rgba(255,255,255,${0.25 + r() * 0.35})` : `rgba(150,140,125,${0.15 + r() * 0.15})`;
      ctx.lineWidth = 0.8 + r() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const len = 10 + r() * 24, b = t + Math.PI / 2 + (r() - 0.5);
      ctx.quadraticCurveTo(x + Math.cos(b) * len * 0.6, y + Math.sin(b) * len * 0.6, x + Math.cos(b + 0.6) * len, y + Math.sin(b + 0.6) * len);
      ctx.stroke();
    }
    // Wispy fibres escaping the outline.
    for (let k = 0; k < 70; k++) {
      const t = r() * Math.PI * 2;
      const x = Math.cos(t) * L.rx * 0.98, y = Math.sin(t) * L.ry * 0.98;
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + r() * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(t + (r() - 0.5)) * (8 + r() * 18), y + Math.sin(t + (r() - 0.5)) * (8 + r() * 18));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Warm sun glow from the top left, soft vignette, thin gold frame.
  const glow = ctx.createRadialGradient(W * 0.2, H * 0.12, 10, W * 0.2, H * 0.12, W * 0.9);
  glow.addColorStop(0, 'rgba(255,240,200,0.35)');
  glow.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(cx, cy, H * 0.35, cx, cy, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,40,40,0.4)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  return toTex(c, { repeat: false });
}
