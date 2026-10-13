import * as THREE from 'three';
import { PALETTE } from './data.js';

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
