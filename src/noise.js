// Deterministic random + 2D Perlin noise helpers (pure JS, no DOM).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const perm = new Uint8Array(512);
{
  const r = mulberry32(2040);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** Classic 2D Perlin noise, roughly in [-0.7, 0.7]. */
export function perlin2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const g = (h, dx, dy) => { const v = G[h & 7]; return v[0] * dx + v[1] * dy; };
  const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
  const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
  const u = fade(xf), v = fade(yf);
  return lerp(
    lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u),
    lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u),
    v,
  );
}

// Rotate the domain between octaves so lattice-aligned (diagonal) artefacts do not stack up.
const RC = Math.cos(0.64), RS = Math.sin(0.64);

/** Fractal Brownian motion, roughly in [-1, 1]. */
export function fbm(x, y, oct = 5, lac = 2.03, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += perlin2(x, y) * amp;
    norm += amp;
    amp *= gain;
    const nx = (x * RC - y * RS) * lac + 17.3;
    y = (x * RS + y * RC) * lac - 9.1;
    x = nx;
  }
  return (sum / norm) * 1.6;
}

/** Ridged multifractal in [0, 1] — sharp mountain crests. */
export function ridged(x, y, oct = 6) {
  let sum = 0, amp = 0.5, weight = 1, norm = 0;
  // Start rotated too: the first octave defines the main crest lines.
  let nx = x * 0.8 - y * 0.6;
  y = x * 0.6 + y * 0.8;
  x = nx;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(perlin2(x, y) * 1.4);
    n *= n * weight;
    weight = Math.min(1, Math.max(0, n * 1.6));
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    nx = (x * RC - y * RS) * 2.02 + 31.7;
    y = (x * RS + y * RC) * 2.02 - 11.3;
    x = nx;
  }
  return sum / norm;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
