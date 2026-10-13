// Locally bundled fonts (offline-safe). The per-weight Fontsource CSS declares every subset
// (cyrillic-ext, cyrillic, latin, ...) with unicode-range, so the browser only fetches what a
// page actually uses. (The single-subset CSS files lack unicode-range and break fallback.)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/unbounded/400.css';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/600.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
// Upstream Unbounded has no Ә Ғ Қ Ң Ө Ұ Ү Һ; this supplement (scripts/build-kz-font.py) adds them.
import './fonts/unbounded-kz.css';

export const KZ_GLYPHS = 'ӘәҒғҚқҢңӨөҰұҮүҺһІі';
// Includes plain Cyrillic + Latin so both cyrillic and latin subset files get fetched.
const SAMPLE = KZ_GLYPHS + 'АБВабв Aa 0123';

const FACES = [
  '400 32px Inter', '500 32px Inter', '600 32px Inter', '700 32px Inter', '800 32px Inter',
  '400 64px Unbounded', '600 64px Unbounded', '700 64px Unbounded', '800 64px Unbounded',
];

let readyPromise = null;

/** Resolves once both families (with Kazakh glyphs) are loaded. Call before any canvas text. */
export function fontsReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await document.fonts.ready;
      await Promise.all(FACES.map((f) => document.fonts.load(f, SAMPLE).catch(() => [])));
      await document.fonts.load('700 64px Unbounded', 'ӘҒҚҢӨҰҮҺІ');
      await document.fonts.ready;
    })();
  }
  return readyPromise;
}

/** Dev-only check (?debug): asserts both families can render every Kazakh letter. */
export function debugFontCheck() {
  const results = {
    Inter: document.fonts.check(`700 32px Inter`, KZ_GLYPHS),
    Unbounded: document.fonts.check(`700 64px Unbounded`, KZ_GLYPHS),
  };
  for (const [family, ok] of Object.entries(results)) {
    if (!ok) console.warn(`[fonts] ${family} is NOT ready for Kazakh glyphs: ${KZ_GLYPHS}`);
  }
  const probe = document.createElement('div');
  probe.className = 'font-debug';
  probe.innerHTML =
    `<div style="font-family:Inter;font-weight:700">Inter: ${KZ_GLYPHS}</div>` +
    `<div style="font-family:Unbounded;font-weight:700">Unbounded: ${KZ_GLYPHS}</div>` +
    `<div style="font-family:Unbounded;font-weight:800">ҚАЗАҚ · ӨҢДЕУ · ҰЛТТЫҚ · ҒЫЛЫМ · ҮЙ · ӘН · ҺӘМ</div>` +
    `<div style="font-family:Unbounded;font-weight:400">Қазақ өңдеу ұлттық ғылым үй әні һәм</div>`;
  document.body.appendChild(probe);
  return results;
}
