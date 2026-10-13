import * as THREE from 'three';
import { PALETTE } from './data.js';
import { mulberry32 } from './noise.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = aniso;
  return tex;
}

/** Largest font size (px) at which `text` fits into maxW, capped at maxSize. */
export function fitFont(ctx, text, weight, family, maxSize, maxW) {
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) size = Math.floor(size * (maxW / w));
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function drawCottonIcon(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = PALETTE.cotton;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = r * 0.3;
  for (const [dx, dy] of [[0, -0.45], [-0.45, 0.05], [0.45, 0.05], [0, 0.35]]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Building / gate sign: teal gradient, thin gold border, cotton icon, auto-fitted Unbounded text.
 * Call only after fontsReady().
 */
export function makeSignTexture(text, { width = 2048, height = 256 } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, PALETTE.deepTeal);
  g.addColorStop(0.55, PALETTE.teal);
  g.addColorStop(1, PALETTE.deepTeal);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const inset = height * 0.06;
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = Math.max(3, height * 0.025);
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  const iconR = height * 0.28;
  const iconX = inset + height * 0.45;
  drawCottonIcon(ctx, iconX, height / 2, iconR);

  const textLeft = iconX + iconR + height * 0.25;
  const textRight = width - inset - height * 0.25;
  const maxW = textRight - textLeft;
  fitFont(ctx, text, 700, 'Unbounded', height * 0.42, maxW);
  ctx.fillStyle = PALETTE.cotton;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = height * 0.04;
  ctx.shadowOffsetY = height * 0.015;
  ctx.fillText(text, (textLeft + textRight) / 2, height / 2 + height * 0.02);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ===================== Nature textures (Phase 2) ===================== */

/** Near-white noise that breaks up flat vertex colours on the terrain (multiplies the colour). */
export function grassDetailTexture() {
  const [c, ctx] = canvas(256);
  const img = ctx.createImageData(256, 256);
  const r = mulberry32(7);
  // Subtle per-texel grain only: big blotches tile visibly and streak on steep slopes.
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 226 + r() * 29;
    img.data[i] = v * 0.98; img.data[i + 1] = v; img.data[i + 2] = v * 0.96; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: [900, 900] });
}

/** One furrow (ridge + trench) per tile across U; rows run along V. */
export function soilFurrowTexture() {
  const [c, ctx] = canvas(128, 256);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#5b4632');
  g.addColorStop(0.25, '#7a5f43');
  g.addColorStop(0.5, '#93765a');
  g.addColorStop(0.75, '#7a5f43');
  g.addColorStop(1, '#5b4632');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  const r = mulberry32(11);
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '40,28,18' : '170,140,105'},${0.15 + r() * 0.25})`;
    ctx.fillRect(r() * 128, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  return toTexture(c);
}

/** Distant cotton rows: green foliage band on the ridge, sprinkled with white bolls. */
export function cottonRowTexture({ harvested = false } = {}) {
  const [c, ctx] = canvas(128, 256);
  ctx.drawImage(soilFurrowTexture().image, 0, 0);
  const r = mulberry32(harvested ? 23 : 19);
  for (let k = 0; k < 140; k++) {
    const y = r() * 256, x = 64 + (r() - 0.5) * 70;
    ctx.fillStyle = harvested ? `rgba(120,110,60,${0.5 + r() * 0.3})` : `hsl(${95 + r() * 30},${40 + r() * 20}%,${26 + r() * 14}%)`;
    ctx.beginPath();
    ctx.arc(x, y, harvested ? 3 + r() * 4 : 7 + r() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!harvested) {
    for (let k = 0; k < 120; k++) {
      ctx.fillStyle = `rgba(255,252,244,${0.75 + r() * 0.25})`;
      ctx.beginPath();
      ctx.arc(64 + (r() - 0.5) * 66, r() * 256, 2.5 + r() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(c);
}

/** Photovoltaic panel: 6×12 dark-blue cells with silver busbars and an aluminium frame. */
export function solarPanelTexture() {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = '#c9d2d8';
  ctx.fillRect(0, 0, 512, 256);
  const cols = 12, rows = 6, pad = 8, gap = 3;
  const cw = (512 - pad * 2 - gap * (cols - 1)) / cols, ch = (256 - pad * 2 - gap * (rows - 1)) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = pad + i * (cw + gap), y = pad + j * (ch + gap);
      const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
      g.addColorStop(0, '#1d3d6e');
      g.addColorStop(0.5, '#122a52');
      g.addColorStop(1, '#0c1d3d');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = 'rgba(200,215,235,0.35)';
      ctx.fillRect(x + cw * 0.33, y, 1.2, ch);
      ctx.fillRect(x + cw * 0.66, y, 1.2, ch);
    }
  }
  return toTexture(c);
}

/** Soft cumulus cloud with alpha, for billboard sprites. */
export function cloudTexture(seed = 1) {
  const [c, ctx] = canvas(512, 256);
  const r = mulberry32(seed);
  for (let k = 0; k < 34; k++) {
    const x = 90 + r() * 330, y = 120 + (r() - 0.5) * 70 - Math.sin(((x - 90) / 330) * Math.PI) * 40;
    const rad = 34 + r() * 56;
    const g = ctx.createRadialGradient(x, y - rad * 0.2, rad * 0.1, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(250,252,255,0.6)');
    g.addColorStop(1, 'rgba(240,246,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // Slightly shaded underside
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, 90, 0, 220);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(150,165,190,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 512, 256);
  return toTexture(c, { aniso: 1 });
}

/** Tileable water normal map built from integer-frequency waves. */
export function waterNormalTexture() {
  const N = 256;
  const [c, ctx] = canvas(N);
  const r = mulberry32(5);
  const waves = Array.from({ length: 14 }, () => ({
    kx: Math.round((r() - 0.5) * 16), ky: Math.round((r() - 0.5) * 16), a: 0.4 + r(), p: r() * 6.28,
  })).filter((w) => w.kx || w.ky);
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (const w of waves) s += (w.a / Math.hypot(w.kx, w.ky)) * Math.sin(((w.kx * x + w.ky * y) / N) * Math.PI * 2 + w.p);
      h[y * N + x] = s;
    }
  }
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)];
      const dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false, repeat: [10, 7] });
}

/** Flower bed: green base with colourful blossoms. */
export function flowerBedTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#4f8f3e';
  ctx.fillRect(0, 0, 256, 256);
  const r = mulberry32(31);
  const hues = ['#f5c04a', '#ff7aa8', '#ffffff', '#b07cff', '#ff8a4a', '#fffaf0'];
  for (let k = 0; k < 700; k++) {
    ctx.fillStyle = k < 260 ? `hsl(${100 + r() * 30},45%,${25 + r() * 15}%)` : hues[(r() * hues.length) | 0];
    ctx.beginPath();
    ctx.arc(r() * 256, r() * 256, k < 260 ? 5 + r() * 6 : 2 + r() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, { repeat: [1, 1] });
}

/** Battery-storage container side: white panels, teal band, vents. */
export function batteryTexture() {
  const [c, ctx] = canvas(512, 128);
  ctx.fillStyle = '#f3f5f4';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < 512; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  ctx.fillStyle = PALETTE.teal;
  ctx.fillRect(0, 74, 512, 14);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(0, 90, 512, 3);
  ctx.fillStyle = '#9aa7ad';
  for (let k = 0; k < 4; k++) ctx.fillRect(40 + k * 120, 22, 60, 34);
  return toTexture(c);
}
