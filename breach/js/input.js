'use strict';
// keyboard + pointer-lock mouse look
const Input = { keys: {}, pressed: {}, mouseDX: 0, fired: false, locked: false };

window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
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
function clearFrameInput() { Input.pressed = {}; Input.mouseDX = 0; Input.fired = false; }

function initPointer(canvas) {
  canvas.addEventListener('click', () => {
    AudioMan.init();
    Input.pressed.Mouse0 = true;
    if (!Input.locked && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  canvas.addEventListener('mousedown', () => { Input.fired = true; AudioMan.init(); });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', e => {
    if (Input.locked) Input.mouseDX += e.movementX || 0;
  });
}
