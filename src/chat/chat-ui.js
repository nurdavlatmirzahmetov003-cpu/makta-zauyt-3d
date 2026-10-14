// «Ақылды көмекші» chat: floating robot button, frosted-glass panel (bottom sheet on phones), typing
// indicator + typewriter replies, quick-reply chips, live report cards, optional kk-KZ voice in/out.
import './chat.css';
import { CHAT } from './texts.js';
import { createBot } from './bot.js';
import { createReport } from './report.js';

const FACE = `<svg viewBox="0 0 48 48" class="bot-face"><rect x="6" y="10" width="36" height="28" rx="12" fill="#fffaf0"/><rect x="11" y="15" width="26" height="17" rx="8" fill="#0d2b30"/>
  <circle cx="19" cy="23.5" r="3" fill="#5ff5df" class="eye"/><circle cx="29" cy="23.5" r="3" fill="#5ff5df" class="eye"/><path d="M20 28.5q4 2.6 8 0" stroke="#5ff5df" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <rect x="22.5" y="4" width="3" height="7" rx="1.5" fill="#f5c04a"/><circle cx="24" cy="4" r="2.6" fill="#f5c04a"/></svg>`;
const ICO = {
  send: '<path d="M4 12l16-8-6 16-3-6z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createChat({ root, app }) {
  const bot = createBot(app);
  const report = createReport(app);
  const { clock, life } = app;

  const fab = document.createElement('button');
  fab.className = 'chat-fab';
  fab.setAttribute('aria-label', CHAT.fab);
  fab.innerHTML = `${FACE}<span>${CHAT.fab}</span><b class="badge" hidden>1</b>`;
  const panel = document.createElement('section');
  panel.className = 'chat glass';
  panel.hidden = true;
  panel.innerHTML = `
    <header class="chat-head">${FACE}<div><h3>${CHAT.title}</h3><small>${CHAT.subtitle}</small></div>
      <button class="icon-btn c-mute" hidden aria-label="${CHAT.mute}">${svg('sound')}</button>
      <button class="icon-btn c-close" aria-label="${CHAT.close}">${svg('close')}</button></header>
    <div class="chat-log" aria-live="polite"></div>
    <div class="chat-chips">${CHAT.chips.map((c) => `<button class="chip">${esc(c)}</button>`).join('')}</div>
    <form class="chat-input"><input type="text" placeholder="${CHAT.placeholder}" autocomplete="off" enterkeyhint="send"/>
      <button type="button" class="icon-btn c-mic" hidden aria-label="${CHAT.mic}">${svg('mic')}</button>
      <button type="submit" class="icon-btn c-send" aria-label="${CHAT.send}">${svg('send')}</button></form>`;
  root.append(fab, panel);
  const log = panel.querySelector('.chat-log'), input = panel.querySelector('input'), badge = fab.querySelector('.badge');

  /* ---------- Messages ---------- */
  const live = []; // report cards that refresh while visible
  let busy = Promise.resolve(), greeted = false;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function bubble(who) {
    const m = document.createElement('div');
    m.className = `msg ${who}`;
    m.innerHTML = `${who === 'bot' ? `<span class="av">${FACE}</span>` : ''}<div class="b"><p></p><time>${clock.format()}</time></div>`;
    log.appendChild(m);
    scroll();
    return m;
  }
  function user(text) {
    bubble('user').querySelector('p').textContent = text;
  }
  /** Bot reply with a typing indicator and a short typewriter animation (queued, never overlapping). */
  function say(reply) {
    busy = busy.then(() => new Promise((done) => {
      const m = bubble('bot'), p = m.querySelector('p');
      p.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      setTimeout(() => {
        const text = reply.text || '';
        let i = 0;
        p.textContent = '';
        const step = () => {
          i = Math.min(text.length, i + 3);
          p.textContent = text.slice(0, i);
          scroll();
          if (i < text.length) setTimeout(step, 16);
          else { finish(m, reply); done(); }
        };
        step();
      }, 420 + Math.min(500, (reply.text || '').length * 4));
    }));
    if (panel.hidden) { badge.hidden = false; }
    speak(reply.text);
  }
  function finish(m, reply) {
    const box = m.querySelector('.b');
    if (reply.card === 'report') {
      const el = document.createElement('div');
      el.dataset.live = '1';
      el._day = app.economy.today;
      box.insertBefore(el, box.querySelector('time'));
      report.render(el, el._day);
      live.push(el);
    }
    if (reply.chips?.length) {
      const c = document.createElement('div');
      c.className = 'msg-chips';
      c.innerHTML = reply.chips.map((t) => `<button class="chip">${esc(t)}</button>`).join('');
      box.insertBefore(c, box.querySelector('time'));
    }
    scroll();
  }
  function ask(text) {
    const t = text.trim();
    if (!t) return;
    user(t);
    const r = bot.answer(t);
    say(r);
    if (r.action) setTimeout(r.action, 650);
  }

  /* ---------- Events ---------- */
  function open(on = panel.hidden) {
    panel.hidden = !on;
    fab.classList.toggle('on', on);
    if (on) {
      badge.hidden = true;
      if (!greeted) { greeted = true; say({ text: CHAT.welcome }); }
      for (const el of live) report.render(el, el._day);
      if (!matchMedia('(pointer: coarse)').matches) input.focus();
    }
  }
  fab.addEventListener('click', () => open());
  panel.querySelector('.c-close').addEventListener('click', () => open(false));
  panel.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); ask(input.value); input.value = ''; });
  panel.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (chip) ask(chip.textContent);
    const r = ev.target.closest('[data-r]');
    if (r) { const el = r.closest('.rep').parentElement; (r.dataset.r === 'csv' ? report.csv : report.print)(el._day); }
  });

  /* ---------- Optional voice (kk-KZ) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = panel.querySelector('.c-mic');
    mic.hidden = false;
    mic.addEventListener('click', () => {
      const rec = new SR();
      rec.lang = 'kk-KZ';
      rec.interimResults = false;
      mic.classList.add('rec');
      input.placeholder = CHAT.listening;
      rec.onresult = (e) => ask(e.results[0][0].transcript);
      rec.onend = () => { mic.classList.remove('rec'); input.placeholder = CHAT.placeholder; };
      try { rec.start(); } catch { rec.onend(); }
    });
  }
  let voice = null, muted = false;
  const pickVoice = () => {
    voice = window.speechSynthesis?.getVoices().find((v) => v.lang?.toLowerCase().startsWith('kk')) || null;
    panel.querySelector('.c-mute').hidden = !voice;
  };
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
  panel.querySelector('.c-mute').addEventListener('click', (ev) => {
    muted = !muted;
    ev.currentTarget.innerHTML = svg(muted ? 'mute' : 'sound');
    if (muted) speechSynthesis.cancel();
  });
  function speak(text) {
    if (!voice || muted || panel.hidden || !text) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    u.voice = voice;
    u.lang = voice.lang;
    speechSynthesis.speak(u);
  }

  /* ---------- Live refresh + the automatic day summary at 21:00 ---------- */
  let t = 0, lastPhase = life.state.phase;
  return {
    open, ask, say,
    get isOpen() { return !panel.hidden; },
    update(dt) {
      if (life.state.phase !== lastPhase) {
        if (life.state.phase === 'sleep') say({ text: CHAT.dayEnd, card: 'report' });
        lastPhase = life.state.phase;
      }
      if (panel.hidden || (t += dt) < 1) return;
      t = 0;
      const el = live.at(-1);
      if (el && el.isConnected) report.render(el, el._day);
    },
  };
}
