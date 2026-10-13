// Shared material library for the built environment, with world-space texture tiles and a night hook.
import * as THREE from 'three';
import { PALETTE } from './data.js';
import {
  panelTexture, glassTextures, greenWallTexture, asphaltTexture, apronTexture, pavingTexture,
  roofTexture, deckTexture, hazardTexture, fenceTexture,
} from './textures-site.js';
import { solarPanelTexture, waterNormalTexture } from './textures.js';

/** Texture tile size in metres for materials that use world-space UVs (others keep their own UVs). */
export const TILE = {
  panel: 6, glass: 6, green: 4, asphalt: 8, apron: 12, paving: 4, roof: 8, deck: 4, hazard: 1.2,
  fence: 2.4, solarRoof: 5, concrete: 6, lawn: 8,
};

let M = null;
const night = []; // [material, dayIntensity, nightIntensity]
const nightHooks = []; // extra callbacks (light pools, bloom…)

export function mats() {
  if (M) return M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glass = glassTextures();
  const solar = solarPanelTexture();
  const solarRoof = solar.clone();
  solarRoof.wrapS = solarRoof.wrapT = THREE.RepeatWrapping;
  solarRoof.needsUpdate = true;
  const water = waterNormalTexture();
  water.repeat.set(1 / 9, 1 / 9);

  M = {
    panel: std({ map: panelTexture(), roughness: 0.42, metalness: 0.08 }),
    graphite: std({ color: PALETTE.graphite, roughness: 0.5, metalness: 0.35 }),
    glass: std({
      map: glass.map, emissiveMap: glass.emissive, emissive: '#ffd6a0', emissiveIntensity: 0,
      metalness: 0.75, roughness: 0.07, envMapIntensity: 1.25,
    }),
    clearGlass: std({
      color: '#bfe8ea', metalness: 0.5, roughness: 0.04, transparent: true, opacity: 0.32, depthWrite: false,
      envMapIntensity: 1.4, side: THREE.DoubleSide,
    }),
    steel: std({ color: '#b3bcc1', metalness: 0.85, roughness: 0.3 }),
    dark: std({ color: '#283238', metalness: 0.4, roughness: 0.5 }),
    gold: std({ color: PALETTE.gold, metalness: 0.85, roughness: 0.28, emissive: PALETTE.gold, emissiveIntensity: 0.08 }),
    glowTeal: std({ color: PALETTE.teal, emissive: PALETTE.teal, emissiveIntensity: 1.6, roughness: 0.4 }),
    glowWarm: std({ color: '#fff3dc', emissive: '#ffe2b0', emissiveIntensity: 0.25, roughness: 0.4 }),
    glowGold: std({ color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 1.2, roughness: 0.4 }),
    glowRed: std({ color: '#ff4a3d', emissive: '#ff3a2a', emissiveIntensity: 2.2 }),
    glowGreen: std({ color: '#3dff8a', emissive: '#2aff7a', emissiveIntensity: 2.2 }),
    lightOff: std({ color: '#2a3034', roughness: 0.4, metalness: 0.2 }),
    green: std({ map: greenWallTexture(), roughness: 0.9 }),
    asphalt: std({ map: asphaltTexture(), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    apron: std({ map: apronTexture(), roughness: 0.9 }),
    paving: std({ map: pavingTexture(), roughness: 0.85 }),
    concrete: std({ map: apronTexture(), color: '#e4e6e2', roughness: 0.8 }),
    curb: std({ color: '#d6d8d4', roughness: 0.75 }),
    roof: std({ map: roofTexture(), roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide }),
    floor: std({ color: '#6c8082', roughness: 0.38, metalness: 0.12 }),
    deck: std({ map: deckTexture(), roughness: 0.8 }),
    hazard: std({ map: hazardTexture(), roughness: 0.6 }),
    fence: std({ map: fenceTexture(), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }),
    solar: std({ map: solar, metalness: 0.15, roughness: 0.3, envMapIntensity: 0.8 }),
    solarRoof: std({ map: solarRoof, metalness: 0.15, roughness: 0.3, envMapIntensity: 0.8 }),
    marking: std({ color: '#f2f2ec', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    paintTeal: std({ color: '#169e8d', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    lawn: std({ color: '#6aa84f', roughness: 0.95 }),
    tank: std({ color: '#eef2f3', metalness: 0.55, roughness: 0.28 }),
    membrane: std({ color: '#7fc79b', metalness: 0.05, roughness: 0.45 }),
    white: std({ color: '#f7f8f7', roughness: 0.4, metalness: 0.05 }),
    fabric: std({ color: PALETTE.cotton, roughness: 0.85, side: THREE.DoubleSide }),
    tealFabric: std({ color: PALETTE.teal, roughness: 0.8, side: THREE.DoubleSide }),
    rubber: std({ color: '#1e2326', roughness: 0.9 }),
    water: new THREE.MeshPhysicalMaterial({
      color: '#2b8c93', roughness: 0.06, metalness: 0.05, normalMap: water, normalScale: new THREE.Vector2(0.35, 0.35),
      clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.9,
    }),
  };
  M.water.userData.normal = water;
  // Conveyor belt: dark rubber with glowing teal chevrons (scrolled along V by production.js).
  const bc = document.createElement('canvas');
  bc.width = bc.height = 128;
  const bx = bc.getContext('2d');
  bx.fillStyle = '#23292d';
  bx.fillRect(0, 0, 128, 128);
  bx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < 128; y += 8) bx.fillRect(0, y, 128, 2);
  bx.strokeStyle = PALETTE.teal;
  bx.lineWidth = 10;
  bx.lineCap = 'round';
  bx.beginPath();
  bx.moveTo(24, 84); bx.lineTo(64, 40); bx.lineTo(104, 84); // apex towards +V = direction of travel
  bx.stroke();
  const beltTex = new THREE.CanvasTexture(bc);
  beltTex.colorSpace = THREE.SRGBColorSpace;
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.anisotropy = 8;
  M.belt = std({ map: beltTex, emissiveMap: beltTex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.7 });
  M.belt.userData.tex = beltTex;
  night.push([M.glass, 0, 1.25], [M.glowWarm, 0.25, 3.2], [M.glowTeal, 1.6, 2.6], [M.glowGold, 1.2, 2.2]);
  return M;
}

/** Register an extra material for the day/night glow blend. */
export function registerGlow(mat, day, nightValue) {
  night.push([mat, day, nightValue]);
}

/** 0 = day, 1 = full night: windows, lamps, contours and signs glow (driven by Phase 8). */
export function setNightLevel(k) {
  for (const [m, d, n] of night) m.emissiveIntensity = d + (n - d) * k;
  for (const f of nightHooks) f(k);
}

/** Run `f(k)` whenever the night level changes. */
export function onNight(f) {
  nightHooks.push(f);
}
