'use strict';
// keyboard / mouse state

const Input = { keys: {}, pressed: {} };

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!e.repeat) Input.pressed[k] = true;
  Input.keys[k] = true;
});

window.addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  Input.keys[k] = false;
});

window.addEventListener('blur', () => { Input.keys = {}; });

function keyDown(...ks) { return ks.some(k => Input.keys[k]); }
function keyPressed(...ks) { return ks.some(k => Input.pressed[k]); }
function clearPressed() { Input.pressed = {}; }

// touch: left-half virtual joystick + action buttons on the right
const TouchPad = {
  on: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  joy: { active: false, id: null, ax: 0, ay: 0, dx: 0, dy: 0 },
  hb: false, hbId: null
};
const JOY_R = 56;

function tpButtons() {
  return {
    v:  { x: W - 240, y: H - 64, r: 36, label: 'CAM' },
    e:  { x: W - 150, y: H - 64, r: 36, label: 'E' },
    hb: { x: W - 60,  y: H - 64, r: 36, label: 'DRIFT' }
  };
}

window.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  TouchPad.on = true;
  const x = e.clientX, y = e.clientY;
  const btns = tpButtons();
  for (const k in btns) {
    const b = btns[k];
    if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) <= (b.r + 12) * (b.r + 12)) {
      if (k === 'e') Input.pressed['e'] = true;
      else if (k === 'v') Input.pressed['v'] = true;
      else { TouchPad.hb = true; TouchPad.hbId = e.pointerId; }
      return;
    }
  }
  if (x < W * 0.55 && !TouchPad.joy.active) {
    TouchPad.joy = { active: true, id: e.pointerId, ax: x, ay: y, dx: 0, dy: 0 };
  }
});
window.addEventListener('pointermove', e => {
  const j = TouchPad.joy;
  if (!j.active || e.pointerId !== j.id) return;
  let dx = e.clientX - j.ax, dy = e.clientY - j.ay;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
  j.dx = dx; j.dy = dy;
});
function tpEnd(e) {
  if (TouchPad.joy.active && e.pointerId === TouchPad.joy.id) {
    TouchPad.joy = { active: false, id: null, ax: 0, ay: 0, dx: 0, dy: 0 };
  }
  if (e.pointerId === TouchPad.hbId) { TouchPad.hb = false; TouchPad.hbId = null; }
}
window.addEventListener('pointerup', tpEnd);
window.addEventListener('pointercancel', tpEnd);

function applyTouchPad() {
  if (!TouchPad.on) return;
  const j = TouchPad.joy, t = 0.32;
  const jx = j.active ? j.dx / JOY_R : 0;
  const jy = j.active ? j.dy / JOY_R : 0;
  Input.keys['a'] = jx < -t;
  Input.keys['d'] = jx > t;
  Input.keys['w'] = jy < -t;
  Input.keys['s'] = jy > t;
  Input.keys['Shift'] = Math.hypot(jx, jy) > 0.9;
  Input.keys[' '] = TouchPad.hb;
}
