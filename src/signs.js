// Sign textures. All building signs are shelf-packed into ONE canvas atlas (one material, one draw
// call); safety/road signs share a second atlas. Call only after fontsReady().
import * as THREE from 'three';
import { PALETTE, SAFETY_SIGNS } from './data.js';
import { fitFont } from './textures.js';
import { registerGlow } from './materials.js';

const ATLAS_W = 2048, ROW_H = 128, PAD = 4;
const FONT = 'Unbounded, Inter, "Noto Sans", Arial, sans-serif';

function drawCotton(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#4a3a24';
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = r * 0.25;
  for (const [dx, dy, s] of [[0, -0.42, 0.46], [-0.42, 0.05, 0.44], [0.42, 0.05, 0.44], [0, 0.38, 0.42], [0, 0, 0.38]]) {
    const g = ctx.createRadialGradient(x + dx * r - r * 0.12, y + dy * r - r * 0.15, r * 0.05, x + dx * r, y + dy * r, s * r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e9e3d4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, s * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Teal-gradient building sign with a thin gold border, cotton icon and auto-fitted text. */
function drawSign(ctx, x, y, w, h, text) {
  ctx.save();
  roundRect(ctx, x, y, w, h, h * 0.12);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, PALETTE.deepTeal);
  g.addColorStop(0.5, PALETTE.teal);
  g.addColorStop(1, PALETTE.deepTeal);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(0, y, 0, y + h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, h * 0.09);
  ctx.stroke();
  const ir = h * 0.27;
  drawCotton(ctx, x + h * 0.5, y + h / 2, ir);
  const left = x + h * 0.5 + ir + h * 0.22, right = x + w - h * 0.3;
  fitFont(ctx, text, 700, FONT, h * 0.4, right - left);
  ctx.fillStyle = PALETTE.cotton;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = h * 0.05;
  ctx.shadowOffsetY = h * 0.02;
  ctx.fillText(text, (left + right) / 2, y + h / 2 + h * 0.03);
  ctx.shadowColor = 'transparent';
}

/**
 * Builds the building-sign atlas.
 * @param {{id:string,text:string}[]} entries
 * @returns {{ material: THREE.Material, rect(id): {u0,u1,v0,v1,aspect} }}
 */
export function buildSignAtlas(entries) {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `700 ${ROW_H * 0.4}px ${FONT}`;
  const items = entries.map((e) => {
    const tw = measure.measureText(e.text).width;
    const w = Math.min(ATLAS_W - PAD * 2, Math.ceil(tw + ROW_H * 1.45));
    return { ...e, w };
  });
  // Shelf packing, widest first.
  const order = [...items].sort((a, b) => b.w - a.w);
  const shelves = [];
  for (const it of order) {
    let s = shelves.find((sh) => sh.x + it.w + PAD <= ATLAS_W);
    if (!s) { s = { x: PAD, y: shelves.length * (ROW_H + PAD) + PAD }; shelves.push(s); }
    it.x = s.x;
    it.y = s.y;
    s.x += it.w + PAD;
  }
  const H = shelves.length * (ROW_H + PAD) + PAD;
  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = H;
  const ctx = c.getContext('2d');
  const rects = {};
  for (const it of items) {
    drawSign(ctx, it.x, it.y, it.w, ROW_H, it.text);
    rects[it.id] = {
      u0: it.x / ATLAS_W, u1: (it.x + it.w) / ATLAS_W,
      v1: 1 - it.y / H, v0: 1 - (it.y + ROW_H) / H, aspect: it.w / ROW_H,
    };
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.22, roughness: 0.45, metalness: 0.1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  registerGlow(material, 0.22, 0.95);
  return { material, rect: (id) => rects[id] };
}

/** Plane geometry mapped to an atlas rect, facing +Z before rotation. */
export function atlasPlane(rect, width, height) {
  const g = new THREE.PlaneGeometry(width, height);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
  }
  return g;
}

/**
 * Sign sized from the text: height `h`, width = h × aspect, shrunk proportionally (never squeezed)
 * to fit `maxW`. Returns world-space { face, back } geometries; `ry` turns the +Z-facing sign.
 */
export function signGeometry(rect, x, y, z, ry, h, maxW) {
  let w = h * rect.aspect;
  if (w > maxW) { h *= maxW / w; w = maxW; }
  const face = atlasPlane(rect, w, h).rotateY(ry).translate(x, y, z);
  const back = new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.16).translate(0, 0, -0.09).rotateY(ry).translate(x, y, z);
  return { face, back, w, h };
}

/* ---------- Safety / road signs atlas: pictogram on top, Kazakh caption below ---------- */
const SLOT_W = 256, SLOT_H = 360;
const PICTOS = ['speed', 'stop', 'helmet', 'smokeFree', 'crossing', 'ev'];

function drawPicto(ctx, type, cx, cy, r) {
  ctx.save();
  ctx.lineCap = ctx.lineJoin = 'round';
  switch (type) {
    case 'speed':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#d93a3a'; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, 6.29); ctx.stroke();
      ctx.fillStyle = '#1f2a30'; ctx.font = `800 ${r * 0.95}px Inter, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('20', cx, cy + r * 0.05);
      break;
    case 'stop': {
      ctx.fillStyle = '#d93a3a'; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.07; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitFont(ctx, 'ТОҚТА', 800, 'Inter, Arial', r * 0.5, r * 1.6);
      ctx.fillText('ТОҚТА', cx, cy + r * 0.04);
      break;
    }
    case 'helmet':
      ctx.fillStyle = '#1f6fd1'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.15, r * 0.52, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - r * 0.7, cy + r * 0.12, r * 1.4, r * 0.14);
      ctx.fillStyle = '#1f6fd1'; ctx.fillRect(cx - r * 0.06, cy - r * 0.38, r * 0.12, r * 0.5);
      break;
    case 'smokeFree':
      ctx.fillStyle = '#1e9e5a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.32, r * 0.58, 0.6, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#1e9e5a'; ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy + r * 0.42); ctx.lineTo(cx + r * 0.3, cy - r * 0.42); ctx.stroke();
      break;
    case 'crossing':
      ctx.fillStyle = '#1f6fd1'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx + r * 0.85, cy + r * 0.7); ctx.lineTo(cx - r * 0.85, cy + r * 0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1f2a30';
      ctx.beginPath(); ctx.arc(cx + r * 0.05, cy - r * 0.3, r * 0.11, 0, 6.29); ctx.fill();
      ctx.lineWidth = r * 0.1; ctx.strokeStyle = '#1f2a30';
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.15); ctx.lineTo(cx - r * 0.05, cy + r * 0.2); ctx.lineTo(cx - r * 0.25, cy + r * 0.5);
      ctx.moveTo(cx - r * 0.05, cy + r * 0.2); ctx.lineTo(cx + r * 0.2, cy + r * 0.5);
      ctx.moveTo(cx - r * 0.25, cy - r * 0.02); ctx.lineTo(cx + r * 0.25, cy + r * 0.02); ctx.stroke();
      break;
    case 'ev':
      ctx.fillStyle = PALETTE.teal; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(cx + r * 0.1, cy - r * 0.6); ctx.lineTo(cx - r * 0.35, cy + r * 0.08); ctx.lineTo(cx - r * 0.02, cy + r * 0.08);
      ctx.lineTo(cx - r * 0.12, cy + r * 0.6); ctx.lineTo(cx + r * 0.35, cy - r * 0.1); ctx.lineTo(cx + r * 0.02, cy - r * 0.1);
      ctx.closePath(); ctx.fill();
      break;
  }
  ctx.restore();
}

export function buildSafetyAtlas() {
  const c = document.createElement('canvas');
  c.width = SLOT_W * PICTOS.length;
  c.height = SLOT_H;
  const ctx = c.getContext('2d');
  const rects = {};
  PICTOS.forEach((type, i) => {
    const x = i * SLOT_W;
    ctx.fillStyle = '#f4f6f6';
    roundRect(ctx, x + 6, 6, SLOT_W - 12, SLOT_H - 12, 22);
    ctx.fill();
    ctx.strokeStyle = '#c9d0d3';
    ctx.lineWidth = 4;
    ctx.stroke();
    drawPicto(ctx, type, x + SLOT_W / 2, 128, 92);
    const text = SAFETY_SIGNS[type];
    ctx.fillStyle = PALETTE.graphite;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    const lines = words.length > 1 && measureLine(ctx, text) > SLOT_W - 40 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [text];
    lines.forEach((ln, k) => {
      fitFont(ctx, ln, 800, 'Inter, Arial, sans-serif', 34, SLOT_W - 36);
      ctx.fillText(ln, x + SLOT_W / 2, 270 + (k - (lines.length - 1) / 2) * 40);
    });
    rects[type] = { u0: x / c.width, u1: (x + SLOT_W) / c.width, v0: 0, v1: 1, aspect: SLOT_W / SLOT_H };
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.12, roughness: 0.5, side: THREE.DoubleSide });
  registerGlow(material, 0.12, 0.6);
  return { material, rect: (t) => rects[t] };
}

function measureLine(ctx, text) {
  ctx.font = '800 34px Inter, Arial, sans-serif';
  return ctx.measureText(text).width;
}

/** Large illuminated gate lettering: cotton-white glowing letters on dark glass with a teal halo. */
export function gateSignTexture(text, { width = 2048, height = 240, color = PALETTE.cotton, font = 800 } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#0f2a2e');
  g.addColorStop(1, '#0a1c20');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  fitFont(ctx, text, font, FONT, height * 0.56, width * 0.9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = PALETTE.teal;
  ctx.shadowBlur = height * 0.16;
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 + height * 0.03);
  ctx.shadowBlur = height * 0.04;
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.fillText(text, width / 2, height / 2 + height * 0.03);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
