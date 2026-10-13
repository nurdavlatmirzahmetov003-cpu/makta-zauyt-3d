// Kazakh number formatting: spaces between thousands, a comma for decimals, units after the number
// («12 450 000 ₸», «3,8 т», «1 284 л»). Intl kk-KZ when available, a manual fallback otherwise.
const cache = new Map();
function nf(d) {
  if (!cache.has(d)) {
    let f = null;
    try {
      f = new Intl.NumberFormat('kk-KZ', { minimumFractionDigits: d, maximumFractionDigits: d });
      if (!/\d[\s  ]\d{3}/.test(f.format(1234))) f = null; // engine without kk data
    } catch { f = null; }
    cache.set(d, f);
  }
  return cache.get(d);
}
export function num(n, d = 0) {
  const f = nf(d);
  if (f) return f.format(n).replace(/[ \s]/g, ' ').replace('-', '−');
  const s = Math.abs(n).toFixed(d).split('.');
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + s.join(',');
}
export const money = (n) => `${num(Math.round(n))} ₸`;
export const tons = (n) => `${num(n, n < 100 ? 1 : 0)} т`;
export const litres = (n) => `${num(Math.round(n))} л`;
export const pct = (n) => `${num(n, 0)}%`;
