// Virtual joystick (touch + mouse) for manual robot control. value = { x, y } in −1…1 (y up = forward).
import './joystick.css';

export function createJoystick(parent) {
  const el = document.createElement('div');
  el.className = 'joy';
  el.innerHTML = '<div class="joy-knob"></div>';
  parent.appendChild(el);
  const knob = el.firstChild;
  const value = { x: 0, y: 0 };
  let id = null, cx = 0, cy = 0;
  const R = 46;
  function move(e) {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    value.x = dx / R;
    value.y = -dy / R;
  }
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    el.setPointerCapture(id);
    const r = el.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    el.classList.add('on');
    move(e);
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    value.x = value.y = 0;
    knob.style.transform = '';
    el.classList.remove('on');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // Keyboard: WASD / arrows add to the stick.
  const keys = new Set();
  const onKey = (e, down) => {
    if (e.target.closest?.('input, textarea')) return;
    const k = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' }[e.code];
    if (!k || el.hidden) return;
    if (down) keys.add(k); else keys.delete(k);
    e.preventDefault();
  };
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));
  return {
    el,
    get value() {
      if (id !== null || !keys.size) return value;
      return { x: (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), y: (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0) };
    },
    set visible(v) { el.hidden = !v; },
  };
}
