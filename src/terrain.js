// Terrain: flat factory plot, gentle fbm hills, a ring of snow-capped mountains, the lake basin.
// Units are metres, Y up, north = −Z. heightAt() is pure, so placement code can reuse it.
import * as THREE from 'three';
import { fbm, ridged, smoothstep } from './noise.js';

export const TERRAIN_SIZE = 6000;
const SEGMENTS = 400;

// Areas that must stay flat (rect: x0, x1, z0, z1).
export const ZONES = {
  plot: { x0: -300, x1: 300, z0: -262, z1: 240 },
  fields: { x0: -620, x1: -330, z0: -200, z1: 220 },
  solarNW: { x0: -600, x1: -380, z0: -450, z1: -350 },
  solarNE: { x0: 380, x1: 600, z0: -450, z1: -350 },
  highway: { x0: -1700, x1: 1700, z0: 300, z1: 372 },
  access: { x0: -26, x1: 26, z0: 240, z1: 300 },
};
export const LAKE = { x: 600, z: 100, rx: 200, rz: 140, depth: 6, water: -0.4 };

// Signed distance (negative inside) from a point to a rectangle.
function rectDist(r, x, z) {
  const dx = Math.max(r.x0 - x, x - r.x1);
  const dz = Math.max(r.z0 - z, z - r.z1);
  return Math.max(dx, dz);
}

/** 1 inside flat zones (with a soft margin), 0 in open country. */
export function flatness(x, z) {
  let f = 0;
  f = Math.max(f, 1 - smoothstep(40, 170, rectDist(ZONES.plot, x, z)));
  f = Math.max(f, 1 - smoothstep(20, 120, rectDist(ZONES.fields, x, z)));
  f = Math.max(f, 1 - smoothstep(20, 110, rectDist(ZONES.solarNW, x, z)));
  f = Math.max(f, 1 - smoothstep(20, 110, rectDist(ZONES.solarNE, x, z)));
  f = Math.max(f, 1 - smoothstep(25, 140, rectDist(ZONES.highway, x, z)));
  f = Math.max(f, 1 - smoothstep(15, 80, rectDist(ZONES.access, x, z)));
  f = Math.max(f, 1 - smoothstep(1.15, 1.9, lakeE(x, z)));
  return f;
}

/** Normalised elliptical distance from the lake centre (1 = shoreline). */
export function lakeE(x, z) {
  const dx = (x - LAKE.x) / LAKE.rx, dz = (z - LAKE.z) / LAKE.rz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Mountain ring weight (0 near the plot, 1 in the Alatau-like ring). */
function ringWeight(x, z) {
  const r = Math.hypot(x, z * 1.1);
  return smoothstep(1050, 1650, r) * (1 - smoothstep(3200, 3900, r));
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  // Gentle rolling hills that grow with distance from the plot.
  const hills = (fbm(x * 0.0022, z * 0.0022, 5) * 0.5 + 0.35) * 46 * smoothstep(300, 950, r);
  // Snowy ridges; the north side (−Z) is higher, like the Alatau seen from the steppe.
  const ring = ringWeight(x, z);
  const north = 0.75 + 0.45 * smoothstep(400, -1600, z);
  const mountains = ring > 0 ? (ridged(x * 0.0011, z * 0.0011) * 560 + 60) * ring * north : 0;
  let h = (hills + mountains) * (1 - flatness(x, z));
  // Lake basin.
  const e = lakeE(x, z);
  if (e < 1) h = Math.min(h, -LAKE.depth * (1 - e * e));
  return h;
}

/** Signed distance to the plot's outer edge (negative = inside the fence). */
export const plotDist = (x, z) => rectDist(ZONES.plot, x, z);
export const zoneDist = (name, x, z) => rectDist(ZONES[name], x, z);

const C = {
  lawn: new THREE.Color('#7fb85a'),
  grass: new THREE.Color('#6aa34f'),
  dry: new THREE.Color('#a7ad62'),
  forest: new THREE.Color('#4f8a45'),
  rock: new THREE.Color('#8a8578'),
  rockDark: new THREE.Color('#6d6b66'),
  snow: new THREE.Color('#f4f8fb'),
  sand: new THREE.Color('#cdbb8e'),
  mud: new THREE.Color('#6f6a4e'),
};

export function buildTerrain(detailTex) {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const n = fbm(x * 0.01, z * 0.01, 3);
    // Grass tones vary with noise and height.
    c.copy(C.grass).lerp(C.forest, smoothstep(-0.2, 0.6, n) * 0.6);
    c.lerp(C.dry, smoothstep(40, 160, y) * 0.7 + smoothstep(0.2, 0.8, fbm(x * 0.003, z * 0.003, 2)) * 0.25);
    if (plotDist(x, z) < 30) c.lerp(C.lawn, 0.7);
    // Only a hint of rock per vertex; crisp rock and snow are shaded per pixel (see patchTerrainShader).
    c.lerp(tmp.copy(C.rock).lerp(C.rockDark, smoothstep(-0.3, 0.4, n)), smoothstep(0.15, 0.4, slope) * 0.5);
    // Lake shore.
    const e = lakeE(x, z);
    if (e < 1.25) c.lerp(e < 0.98 ? C.mud : C.sand, 1 - smoothstep(0.95, 1.25, e));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: detailTex });
  patchTerrainShader(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/**
 * Per-pixel rock and snow: classifies each fragment by world height and slope (with value noise
 * for ragged edges), so snow lines stay crisp instead of smearing across large triangles.
 */
function patchTerrainShader(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
        }
        float tFbm(vec2 p) { return tNoise(p) * 0.55 + tNoise(p * 2.7) * 0.3 + tNoise(p * 7.1) * 0.15; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float slope = 1.0 - clamp(normalize(vWNrm).y, 0.0, 1.0);
          float n = tFbm(vWPos.xz * 0.02);
          // Horizontal strata (noise driven mostly by height) plus a little lateral variation.
          float strata = tNoise(vec2(vWPos.y * 0.05, (vWPos.x + vWPos.z) * 0.002)) * 0.3
            + tNoise(vWPos.xz * 0.03) * 0.5 + tNoise(vWPos.xz * 0.11) * 0.2;
          vec3 rock = mix(vec3(0.13, 0.125, 0.115), vec3(0.24, 0.225, 0.2), strata);
          float rockT = max(smoothstep(0.2 + n * 0.12, 0.42 + n * 0.12, slope), smoothstep(190.0, 300.0, vWPos.y + n * 60.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, rock, rockT);
          float snowLine = 360.0 + (n - 0.5) * 110.0;
          float snowT = smoothstep(snowLine - 8.0, snowLine + 8.0, vWPos.y) * (1.0 - smoothstep(0.62, 0.8, slope + n * 0.15));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), snowT);
        }`);
  };
}
