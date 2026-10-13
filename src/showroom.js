// Showroom interior: a curved LED wall with «15 ЕРЕКШЕЛІК» (canvas texture, fonts already loaded)
// and three product pedestals (bale, oil bottle, folded garments).
import * as THREE from 'three';
import { FEATURES, FEATURES_TITLE, PALETTE } from './data.js';
import { Batch, box, cyl } from './geo.js';
import { mats, TILE, onNight } from './materials.js';

const W = 3072, H = 1024;
const ARC = 1.9, R = 13; // wall arc (radians) and radius (m)

function wrap(g, text, maxW, maxLines) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…'; }
  return lines;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function ledTexture() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#051419');
  bg.addColorStop(1, '#0a2a2e');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // LED pixel grid.
  g.fillStyle = 'rgba(120, 255, 230, 0.05)';
  for (let y = 2; y < H; y += 8) for (let x = 2; x < W; x += 8) g.fillRect(x, y, 3, 3);
  // Title.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '800 64px Unbounded';
  const tg = g.createLinearGradient(W / 2 - 900, 0, W / 2 + 900, 0);
  tg.addColorStop(0, '#5ff5df');
  tg.addColorStop(0.5, '#ffffff');
  tg.addColorStop(1, PALETTE.gold);
  g.fillStyle = tg;
  g.fillText(FEATURES_TITLE, W / 2, 86);
  g.fillStyle = PALETTE.teal;
  g.fillRect(W / 2 - 260, 136, 520, 5);
  // 5 × 3 feature tiles.
  const mx = 44, gap = 24, top = 172, bottom = H - 34, cols = 5, rows = 3;
  const cw = (W - mx * 2 - gap * (cols - 1)) / cols, ch = (bottom - top - gap * (rows - 1)) / rows;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  FEATURES.forEach(([title, desc], i) => {
    const x = mx + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
    roundRect(g, x, y, cw, ch, 26);
    g.fillStyle = 'rgba(18, 181, 160, 0.13)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(95, 245, 223, 0.55)';
    g.stroke();
    // Number badge.
    g.beginPath();
    g.arc(x + 52, y + 54, 30, 0, Math.PI * 2);
    g.fillStyle = PALETTE.gold;
    g.fill();
    g.fillStyle = '#062226';
    g.font = '800 30px Unbounded';
    g.textAlign = 'center';
    g.fillText(String(i + 1), x + 52, y + 65);
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.font = '800 33px Inter';
    const tl = wrap(g, title.replace(/\.$/, ''), cw - 120, 2);
    tl.forEach((l, k) => g.fillText(l, x + 98, y + 50 + k * 38 - (tl.length - 1) * 12));
    g.fillStyle = '#bff3ea';
    g.font = '500 26px Inter';
    wrap(g, desc, cw - 44, 4).forEach((l, k) => g.fillText(l, x + 24, y + 128 + k * 34));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildShowroomWall(site) {
  const b = site.list.get('showroom');
  if (!b) return null;
  const { cx, cz } = b.spec;
  const base = 1.4, y0 = base + 1.1, h = (R * ARC) / 3;
  const m = mats();

  // The LED surface: an open cylinder segment facing the centre (UVs flipped to read from inside).
  const geo = new THREE.CylinderGeometry(R, R, h, 72, 1, true, Math.PI - ARC / 2, ARC);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  geo.translate(cx, y0 + h / 2, cz);
  const led = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ledTexture(), side: THREE.BackSide, toneMapped: false, color: '#e8e8e8' }));
  led.name = 'led-wall';
  b.interior.add(led);
  onNight((k) => led.material.color.setScalar(0.9 + 0.1 * k));

  const B = new Batch();
  // Backing shell and glowing top/bottom edges.
  B.add('dark', new THREE.CylinderGeometry(R + 0.3, R + 0.3, h + 0.8, 72, 1, true, Math.PI - ARC / 2 - 0.03, ARC + 0.06).translate(cx, y0 + h / 2, cz));
  const phi = ARC / 2 + Math.PI / 2;
  for (const y of [y0 - 0.12, y0 + h + 0.12]) {
    B.add('glowTeal', new THREE.TorusGeometry(R - 0.02, 0.07, 5, 72, ARC).rotateX(Math.PI / 2).rotateY(phi).translate(cx, y, cz));
  }
  for (const s of [-1, 1]) {
    const a = Math.PI + s * (ARC / 2 + 0.02);
    B.add('steel', box(0.5, h + 1.6, 0.5, cx + Math.sin(a) * (R + 0.2), base + (h + 1.6) / 2, cz + Math.cos(a) * (R + 0.2)));
  }
  // Pedestals with products.
  const ped = (x, z) => {
    B.add('white', cyl(1.3, 1.45, 1.1, x, base + 0.55, z, 32));
    B.add('glowTeal', cyl(1.33, 1.33, 0.06, x, base + 1.1, z, 32));
  };
  const zP = cz - 4;
  ped(cx - 6.5, zP + 1.2);
  B.add('fabric', box(1.5, 1.1, 1.1, cx - 6.5, base + 1.7, zP + 1.2));
  for (const dx of [-0.45, 0, 0.45]) B.add('tealFabric', box(0.08, 1.14, 1.14, cx - 6.5 + dx, base + 1.7, zP + 1.2));
  ped(cx, zP);
  B.add('gold', cyl(0.32, 0.36, 1.3, cx, base + 1.8, zP, 24));
  B.add('gold', cyl(0.14, 0.3, 0.35, cx, base + 2.6, zP, 24));
  B.add('white', cyl(0.13, 0.13, 0.18, cx, base + 2.85, zP, 16));
  ped(cx + 6.5, zP + 1.2);
  for (let k = 0; k < 4; k++) B.add(k % 2 ? 'fabric' : 'tealFabric', box(1.3, 0.16, 0.9, cx + 6.5, base + 1.2 + k * 0.17, zP + 1.2));
  B.build(m, TILE, b.interior, { name: 'showroom-exhibits' });

  return {
    /** Camera spot inside the dome, facing the LED wall. */
    view: { pos: new THREE.Vector3(cx, base + 4.6, cz + 9), target: new THREE.Vector3(cx, y0 + h * 0.52, cz - R) },
  };
}
