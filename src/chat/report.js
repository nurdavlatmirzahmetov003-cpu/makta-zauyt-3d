// «Күнделікті есеп» card: KPI grid, finance block with share bars, cost breakdown, two small canvas
// charts (production per hour, revenue vs cost) and a comparison with yesterday. Updates live;
// exports a UTF-8 (BOM) CSV and a clean printable page.
import { REPORT as R } from './texts.js';
import { KPI_TEXT as KT } from '../data.js';
import { num, money, tons, litres } from '../sim/format.js';

const COLORS = { garments: '#12b5a0', oil: '#f5c04a', fibre: '#7cc7ff', biogas: '#7dd87d', cost: '#ff8a6e' };

function cumulative(d, key, upto) {
  const out = [];
  let s = 0;
  for (let h = 0; h <= upto; h++) { s += d.hours[h][key]; out.push(s); }
  return out;
}

function drawBars(cv, d, hourNow) {
  const ctx = prep(cv), W = cv.clientWidth, H = cv.clientHeight;
  const vals = d.hours.map((h) => h.raw), max = Math.max(0.5, ...vals);
  const bw = (W - 8) / 24;
  vals.forEach((v, h) => {
    const bh = (v / max) * (H - 16);
    ctx.fillStyle = h === hourNow ? '#f5c04a' : 'rgba(18,181,160,0.85)';
    ctx.fillRect(4 + h * bw + 1, H - 12 - bh, bw - 2, bh);
  });
  axis(ctx, W, H);
}
function drawLines(cv, d, hourNow) {
  const ctx = prep(cv), W = cv.clientWidth, H = cv.clientHeight;
  const rev = cumulative(d, 'revenue', hourNow), cost = cumulative(d, 'cost', hourNow);
  const max = Math.max(1, ...rev, ...cost);
  const line = (arr, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    arr.forEach((v, h) => {
      const x = 4 + ((h + 0.5) / 24) * (W - 8), y = H - 12 - (v / max) * (H - 18);
      if (h) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  line(cost, COLORS.cost);
  line(rev, COLORS.garments);
  axis(ctx, W, H);
}
function prep(cv) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return ctx;
}
function axis(ctx, W, H) {
  ctx.fillStyle = 'rgba(120,140,145,0.9)';
  ctx.font = '600 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (const h of [0, 6, 12, 18, 24]) ctx.fillText(String(h).padStart(2, '0'), 4 + (h / 24) * (W - 8), H - 1);
  ctx.fillStyle = 'rgba(120,140,145,0.25)';
  ctx.fillRect(4, H - 12, W - 8, 1);
}

export function createReport({ economy, clock }) {
  const kpiRows = (k) => [
    [R.kpi.raw, tons(k.raw)], [R.kpi.fibre, tons(k.fibre)], [R.kpi.oil, litres(k.oil)],
    [R.kpi.garments, `${num(k.garments)} дана`], [R.kpi.trucks, num(k.trucks)], [R.kpi.energy, `${num(k.energyMWh, 1)} МВт·сағ`],
  ];
  function compare(d, hourNow) {
    const y = economy.yesterday;
    if (!y || d !== economy.today) return '';
    const a = cumulative(d, 'revenue', hourNow).at(-1), b = cumulative(y, 'revenue', hourNow).at(-1);
    if (!b) return '';
    const p = ((a - b) / b) * 100;
    return R.compare(`${p >= 0 ? '+' : '−'}${num(Math.abs(p), 0)}%`);
  }

  /** Fill (or refresh) a card element for a day record. */
  function render(el, d = economy.today) {
    const live = d === economy.today;
    const hourNow = live ? Math.min(23, Math.floor(clock.minutes / 60)) : 23;
    const k = economy.kpis(d);
    if (!el.firstChild) {
      el.className = 'rep';
      el.innerHTML = `
        <div class="rep-head"><b></b><small>${R.note}</small></div>
        <div class="rep-kpis"></div>
        <div class="rep-fin"></div>
        <div class="rep-costs"><h6>${R.costTitle}</h6><div class="rc"></div></div>
        <h6>${R.chartProd}</h6><canvas class="ch ch-prod"></canvas>
        <h6>${R.chartMoney} <span class="lg"><i style="background:${COLORS.garments}"></i>${R.revenue} <i style="background:${COLORS.cost}"></i>${R.cost}</span></h6><canvas class="ch ch-money"></canvas>
        <div class="rep-cmp"></div>
        <div class="rep-btns"><button data-r="csv">${R.csv}</button><button data-r="print">${R.print}</button></div>`;
    }
    const q = (s) => el.querySelector(s);
    q('.rep-head b').textContent = KT.today(d.day, live ? clock.format() : '24:00');
    q('.rep-kpis').innerHTML = kpiRows(k).map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('');
    const tot = Math.max(1, k.revenue + k.cost), revTot = Math.max(1, k.revenue);
    q('.rep-fin').innerHTML = `
      <div class="fr"><span>${R.revenue}</span><b>${money(k.revenue)}</b></div>
      <div class="fr"><span>${R.cost}</span><b>${money(k.cost)}</b></div>
      <div class="fr big ${k.profit >= 0 ? 'pos' : 'neg'}"><span>${R.profit}</span><b>${money(k.profit)}</b></div>
      <div class="share"><i style="width:${(k.revenue / tot) * 100}%;background:${COLORS.garments}"></i><i style="width:${(k.cost / tot) * 100}%;background:${COLORS.cost}"></i></div>
      <div class="share thin">${Object.entries(d.rev).map(([p, v]) => `<i style="width:${(v / revTot) * 100}%;background:${COLORS[p]}"></i>`).join('')}</div>
      <div class="parts">${Object.entries(d.rev).map(([p, v]) => `<span><i style="background:${COLORS[p]}"></i>${R.revParts[p]} ${money(v)}</span>`).join('')}</div>`;
    const maxC = Math.max(1, ...Object.values(d.costs));
    q('.rc').innerHTML = Object.entries(d.costs).sort((a, b) => b[1] - a[1])
      .map(([p, v]) => `<div class="cr"><span>${KT.costParts[p]}</span><em><i style="width:${(v / maxC) * 100}%"></i></em><b>${money(v)}</b></div>`).join('');
    q('.rep-cmp').textContent = compare(d, hourNow);
    q('.rep-cmp').hidden = !q('.rep-cmp').textContent;
    drawBars(q('.ch-prod'), d, live ? hourNow : -1);
    drawLines(q('.ch-money'), d, hourNow);
  }

  /** CSV (UTF-8 with BOM so Excel opens the Kazakh letters correctly). */
  function csv(d = economy.today) {
    const k = economy.kpis(d), n = (v, p = 0) => v.toFixed(p).replace('.', ',');
    const rows = [[KT.today(d.day, d === economy.today ? clock.format() : '24:00')], [R.note], [], R.csvHead,
      [KT.raw, n(k.raw, 1), 'т'], [KT.fibre, n(k.fibre, 1), 'т'], [KT.oil, n(k.oil), 'л'], [KT.garments, n(k.garments), 'дана'],
      [KT.trucks, n(k.trucks), 'фура'], [KT.revenue, n(k.revenue), '₸'], [KT.cost, n(k.cost), '₸'], [KT.profit, n(k.profit), '₸'],
      [KT.margin, n(k.margin, 1), '%'], [KT.energy, n(k.energyMWh, 1), 'МВт·сағ'], [KT.co2, n(k.co2, 1), 'т'], [KT.saved, n(k.saved), '₸'],
      [], ...Object.entries(d.costs).map(([p, v]) => [KT.costParts[p], n(v), '₸']), [], R.csvHours,
      ...d.hours.map((h, i) => [`${String(i).padStart(2, '0')}:00`, n(h.raw, 1), n(h.garments), n(h.oil), n(h.revenue), n(h.cost)])];
    const text = '﻿' + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `ak-marzhan-esep-${d.day}-kun.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return text;
  }

  /** A clean, print-styled copy of the report in a hidden frame. */
  function print(d = economy.today) {
    const k = economy.kpis(d);
    const rows = [[KT.raw, tons(k.raw)], [KT.fibre, tons(k.fibre)], [KT.oil, litres(k.oil)], [KT.garments, `${num(k.garments)} дана`],
      [KT.trucks, num(k.trucks)], [KT.revenue, money(k.revenue)], [KT.cost, money(k.cost)], [KT.profit, money(k.profit)],
      [KT.energy, `${num(k.energyMWh, 1)} МВт·сағ`], [KT.co2, tons(k.co2)], [KT.saved, money(k.saved)]];
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html lang="kk"><head><meta charset="utf-8"><title>${R.printTitle}</title>
      <style>body{font-family:Inter,Arial,sans-serif;color:#1f2a30;margin:32px}h1{font-size:20px;margin:0 0 4px}p{color:#4b636a;margin:0 0 18px}
      table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #d9e3e0;padding:7px 6px;text-align:left}td:last-child{text-align:right;font-weight:700}
      h2{font-size:14px;margin:22px 0 6px;color:#0b6b63}</style></head><body>
      <h1>${R.printTitle}</h1><p>${KT.today(d.day, d === economy.today ? clock.format() : '24:00')} · ${R.note}</p>
      <table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <h2>${R.costTitle}</h2><table>${Object.entries(d.costs).map(([p, v]) => `<tr><td>${KT.costParts[p]}</td><td>${money(v)}</td></tr>`).join('')}</table>
      </body></html>`);
    doc.close();
    setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 2000); }, 300);
  }

  return { render, csv, print };
}
