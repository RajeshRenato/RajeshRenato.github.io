'use strict';
// Highway Brawl: a Road Rash-style motorbike racer. Original code and art.
// The road is drawn the classic pseudo-3D way: a long list of short segments, each with a
// curve and a height, projected one by one from the camera outwards.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ---------- helpers
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2);
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f | 0, 0, 255), g = clamp(((n >> 8) & 255) * f | 0, 0, 255), b = clamp((n & 255) * f | 0, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function mix(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = s => Math.round(lerp((x >> s) & 255, (y >> s) & 255, t));
  return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')';
}
const fmtTime = t => Math.floor(t / 60) + ':' + (t % 60).toFixed(2).padStart(5, '0');
const money = v => '$' + Math.round(v).toLocaleString('en-US');

// ---------- input: keyboard, gamepad and touch all end up in Keys / Pressed
const Keys = {}, Pressed = {};
window.addEventListener('keydown', e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && G.state !== 'menu') e.preventDefault();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!e.repeat) Pressed[k] = true;
  Keys[k] = true;
});
window.addEventListener('keyup', e => { Keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
window.addEventListener('blur', () => { for (const k in Keys) Keys[k] = false; if (G.state === 'race' && !online()) pause(); });
const key = (...ks) => ks.some(k => Keys[k]);
const pressed = (...ks) => ks.some(k => Pressed[k]);

// A standard gamepad: right trigger throttle, left trigger brake, stick steers,
// A punch, B kick, X chain, Y backhand, RB nitro, Start pauses.
const Pad = { prev: [] };
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && [...pads].find(Boolean);
  if (!p) return;
  const b = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4));
  const ax = p.axes[0] || 0;
  Keys['pad-left'] = ax < -0.3 || b(14); Keys['pad-right'] = ax > 0.3 || b(15);
  Keys['pad-gas'] = b(7) || b(12); Keys['pad-brake'] = b(6) || b(13);
  const map = { 0: ' ', 1: 'e', 2: 'f', 3: 'q', 5: 'n', 4: 'q', 9: 'Escape', 8: 'c' };
  for (const i in map) { if (b(+i) && !Pad.prev[i]) Pressed[map[i]] = true; Pad.prev[i] = b(+i); }
}

const Touch = { on: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches, pts: new Map() };
function touchButtons() {
  const r = Math.max(30, Math.min(44, H * 0.06));
  return {
    left: { x: r + 18, y: H - r - 22, r, label: '◀' },
    right: { x: r * 3 + 30, y: H - r - 22, r, label: '▶' },
    brake: { x: W - r * 5 - 54, y: H - r - 22, r, label: 'BRAKE' },
    kick: { x: W - r * 3 - 36, y: H - r * 3 - 34, r, label: 'KICK' },
    punch: { x: W - r - 18, y: H - r - 22, r, label: 'PUNCH' },
    chain: { x: W - r * 3 - 36, y: H - r - 22, r, label: 'CHAIN' },
    nitro: { x: W - r - 18, y: H - r * 3 - 34, r: r * 0.8, label: 'NOS' },
  };
}
function touchHit(x, y) {
  const btns = touchButtons();
  for (const k in btns) { const b = btns[k]; if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + 10) ** 2) return k; }
  return null;
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') Touch.on = true;
  if (G.state !== 'race' && G.state !== 'count') return;
  if (!Touch.on) return;
  const k = touchHit(e.clientX, e.clientY);
  if (k === 'punch') Pressed[' '] = true;
  else if (k === 'kick') Pressed['e'] = true;
  else if (k === 'chain') Pressed['f'] = true;
  else if (k === 'nitro') Pressed['n'] = true;
  else if (k) Touch.pts.set(e.pointerId, k);
});
canvas.addEventListener('pointermove', e => { if (Touch.pts.has(e.pointerId)) { const k = touchHit(e.clientX, e.clientY); if (k === 'left' || k === 'right' || k === 'brake') Touch.pts.set(e.pointerId, k); } });
const touchEnd = e => Touch.pts.delete(e.pointerId);
canvas.addEventListener('pointerup', touchEnd);
canvas.addEventListener('pointercancel', touchEnd);
function applyTouch() {
  if (!Touch.on || (G.state !== 'race' && G.state !== 'count')) return;
  let a = false, d = false, s = false;
  for (const k of Touch.pts.values()) { if (k === 'left') a = true; else if (k === 'right') d = true; else if (k === 'brake') s = true; }
  Keys['t-left'] = a; Keys['t-right'] = d; Keys['t-brake'] = s; Keys['t-gas'] = !s;
}
const gas = () => key('w', 'ArrowUp', 'pad-gas', 't-gas');
const brake = () => key('s', 'ArrowDown', 'pad-brake', 't-brake');
const steerIn = () => (key('d', 'ArrowRight', 'pad-right', 't-right') ? 1 : 0) - (key('a', 'ArrowLeft', 'pad-left', 't-left') ? 1 : 0);

// ---------- sound, all synthesized
const Snd = {
  ctx: null, engine: null, gain: null, siren: null, sirenGain: null, muted: false,
  init() {
    if (this.ctx) return;
    try {
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = c.createOscillator(), filt = c.createBiquadFilter(), g = c.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 60; filt.type = 'lowpass'; filt.frequency.value = 700; g.gain.value = 0;
      osc.connect(filt); filt.connect(g); g.connect(c.destination); osc.start();
      this.engine = osc; this.gain = g;
      const s = c.createOscillator(), sg = c.createGain();
      s.type = 'square'; s.frequency.value = 700; sg.gain.value = 0; s.connect(sg); sg.connect(c.destination); s.start();
      this.siren = s; this.sirenGain = sg;
    } catch (e) { this.ctx = null; }
  },
  setEngine(on, ratio, nitro) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(on && !this.muted ? 0.025 + ratio * 0.03 : 0, t, 0.08);
    this.engine.frequency.setTargetAtTime(50 + ratio * 210 + (nitro ? 60 : 0), t, 0.05);
  },
  setSiren(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : level * 0.018, t, 0.1);
    this.siren.frequency.setTargetAtTime(Math.floor(G.time * 2.4) % 2 ? 620 : 840, t, 0.03);
  },
  noise(vol, dur, hp) {
    if (!this.ctx || this.muted) return;
    const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, (sr * dur) | 0, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp ? 2500 : 900;
    src.buffer = buf; g.gain.value = Math.min(0.35, vol); src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start();
  },
  thud(v) { this.noise(v, 0.12, false); },
  clink(v) { this.noise(v, 0.18, true); },
};
window.addEventListener('pointerdown', () => Snd.init());
window.addEventListener('keydown', () => Snd.init());

// ---------- tracks and their looks
const SEG = 200, DRAW = 240, CAM_H = 1000;
const RS = 0.55;   // riders' drawing scale, so a bike and rider come out their real size against the road
const CAM_D = 1 / Math.tan(50 * Math.PI / 180);
const PLAYER_Z = CAM_H * CAM_D;
const MAXS = 12000;
let RW = 1300;

const THEMES = {
  city: { sky: ['#5f9fd6', '#b9d7ec'], fog: '#c3d3dd', grass: ['#8d8a83', '#88857e'], road: ['#55585d', '#5a5d62'], rumble: ['#c9c9c9', '#8b8b8b'],
    lane: '#e8e8e0', walk: ['#a9a49a', '#b1aca2'], back: 'skyline', rw: 1500, fogK: 2.4 },
  coast: { sky: ['#3d8fd8', '#bfe0f2'], fog: '#cfe4ef', grass: ['#7f9a4c', '#779146'], road: ['#5b5b5e', '#606063'], rumble: ['#d23b2f', '#efefe6'],
    lane: '#f0f0e8', sand: ['#e2cf98', '#dbc68c'], sea: ['#2f7fb6', '#3a8cc2'], back: 'sea', rw: 1250, fogK: 2.6 },
  pass: { sky: ['#4f86c6', '#cfe0ee'], fog: '#d6e1e8', grass: ['#4d7a3c', '#477236'], road: ['#4f5155', '#55575b'], rumble: ['#e8e8e8', '#3c3c3c'],
    lane: '#eeeee6', back: 'peaks', rw: 1150, fogK: 3.0 },
  valley: { sky: ['#69a8de', '#e4ecd8'], fog: '#e2e6d2', grass: ['#7aa44a', '#5f8a3a'], road: ['#5f5d58', '#64625d'], rumble: ['#d9d4c3', '#a33a2b'],
    lane: '#f2efe0', back: 'hills', rw: 1000, rows: true, fogK: 2.6 },
  desert: { sky: ['#4a8fd1', '#f1dcb0'], fog: '#efd9b0', grass: ['#d9b779', '#d1ae70'], road: ['#5d5a57', '#625f5c'], rumble: ['#f2f2ea', '#b23a2e'],
    lane: '#f4eedd', back: 'mesas', rw: 1350, fogK: 2.2 },
};
const TRACKS = [
  { id: 'city', name: 'Downtown', theme: 'city', blurb: 'Office blocks, cross streets and heavy traffic both ways.', curves: 0.7, hills: 0.35, traffic: 1.3, oncoming: 0.45, police: 2 },
  { id: 'coast', name: 'Coast Road', theme: 'coast', blurb: 'The sea on one side, cliffs on the other, and fast sweeping bends.', curves: 1, hills: 0.7, traffic: 1, oncoming: 0.4, police: 1 },
  { id: 'pass', name: 'Pine Pass', theme: 'pass', blurb: 'Steep climbs, blind crests and rock walls close to the road.', curves: 1.1, hills: 1.6, traffic: 0.7, oncoming: 0.35, police: 0 },
  { id: 'valley', name: 'Vineyard Valley', theme: 'valley', blurb: 'A narrow farm road with tight switchbacks between the vines.', curves: 1.5, hills: 0.8, traffic: 0.6, oncoming: 0.3, police: 0 },
  { id: 'desert', name: 'Desert Run', theme: 'desert', blurb: 'Long straights, big speed, and police who want a word.', curves: 0.55, hills: 0.6, traffic: 0.9, oncoming: 0.4, police: 2 },
];
let T = TRACKS[0], TH = THEMES.city;
let segs = [], finishZ = 0, trackEnd = 0, mapPts = [], mapBox = null;
const START = 3200;

function lastY() { return segs.length ? segs[segs.length - 1].y1 : 0; }
function addSeg(curve, y1) { segs.push({ i: segs.length, curve, y0: lastY(), y1, sprites: [], walls: [null, null], sea: 0, cross: false, clip: 0, sx1: 0, sy1: 0, sw1: 0, sx2: 0, sy2: 0, sw2: 0 }); }
function addRoad(enter, hold, leave, curve, hill) {
  const sy = lastY(), ey = sy + hill, total = enter + hold + leave;
  for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(sy, ey, n / total));
  for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(sy, ey, (enter + n) / total));
  for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(sy, ey, (enter + hold + n) / total));
}
const BUILDINGS = ['#9c5b45', '#b8a88a', '#8d8f94', '#a77a5a', '#6f7f8f', '#c2b59b', '#7d5a4a', '#9aa3a8'];
const ADS = ['GRIT COLA', 'MOTO MART', 'LUCKY TYRES', 'DINER 24H', 'FAST LOANS', 'SUNNY FM', 'IRON GYM', 'BIG BURGER'];

function buildTrack(trackIdx, level) {
  T = TRACKS[trackIdx]; TH = THEMES[T.theme]; RW = TH.rw;
  segs = [];
  const rng = mulberry32(trackIdx * 1000003 + level * 7919 + 11);
  const target = 2300 + level * 380;
  addRoad(40, 220, 40, 0, 0);                      // a long straight start, so the pack can spread out
  while (segs.length < target) {
    const r = rng(), len = () => 30 + (rng() * 60) | 0;
    const curve = () => (rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 3.6) * T.curves;
    const hill = () => (rng() * 2 - 1) * SEG * (10 + rng() * 30) * T.hills;
    if (r < 0.2) addRoad(len(), len() * 2, len(), 0, T.hills > 1 ? hill() : 0);
    else if (r < 0.48) addRoad(len(), len(), len(), curve(), 0);
    else if (r < 0.66) addRoad(len(), len(), len(), 0, hill());
    else if (r < 0.88) addRoad(len(), len(), len(), curve(), hill());
    else { const c = Math.abs(curve()) * (T.curves > 1.2 ? 1.4 : 1); addRoad(30, 35, 30, c, 0); addRoad(30, 35, 30, -c, 0); }
  }
  finishZ = segs.length * SEG;
  addRoad(60, 360, 60, 0, 0);
  trackEnd = segs.length * SEG;
  decorate(trackIdx, level);
  buildMap();
}

function decorate(trackIdx, level) {
  const rng = mulberry32(trackIdx * 31337 + level * 101 + 5);
  const n = segs.length;
  const put = (i, sp) => { if (i > 0 && i < n) segs[i].sprites.push(sp); };
  const theme = T.theme;
  if (theme === 'city') {
    // blocks of buildings with alleys between them and, every fourth block, a cross street
    let i = 30, blocks = 0;
    while (i < n - 10) {
      const len = 7 + (rng() * 10 | 0);
      for (const side of [0, 1]) {
        const h = 2100 + rng() * 2900, style = rng() * Art.FACADES.length | 0, shop = rng() * 6 | 0;
        for (let k = 0; k < len && i + k < n; k++) segs[i + k].walls[side] = { off: 1.55, h, kind: 'bld', style, shop, start: k === 0 };
      }
      i += len; blocks++;
      if (blocks % 4 === 0 && i + 5 < n) {
        for (let k = 1; k < 4; k++) segs[i + k].cross = true;
        put(i, { kind: 'signal', off: -1.25 }); put(i, { kind: 'signal', off: 1.25 });
        i += 5;
      } else if (rng() < 0.35) i += 2;
    }
    for (let i = 36; i < n - 10; i += 6) { if (!segs[i].cross) { put(i, { kind: 'lamp', off: -1.2 }); put(i + 3, { kind: 'lamp', off: 1.2 }); } }
    for (let i = 40; i < n - 10; i += 9) if (!segs[i].cross && rng() < 0.7) put(i, { kind: 'tree', off: (rng() < 0.5 ? -1 : 1) * 1.36, seed: i, small: true });
    for (let i = 120; i < n - 10; i += 170) put(i, { kind: 'bill', off: rng() < 0.5 ? -1.4 : 1.4, word: ADS[rng() * ADS.length | 0], color: ['#d23b2f', '#2a6fb0', '#f2b32a', '#2f8f4e'][rng() * 4 | 0] });
  } else if (theme === 'coast') {
    let side = -1;
    for (let i = 0; i < n; i++) {
      segs[i].sea = side;
      if (i % 400 === 399 && rng() < 0.35) side = -side;
      if (i > 25 && i % 2 === 0) put(i, { kind: 'guard', off: side * 1.12 });
    }
    for (let i = 30; i < n - 10; i++) {
      const s = segs[i].sea;
      const w = segs[i].walls;
      if (Math.sin(i * 0.013) + Math.sin(i * 0.037) > 0.4) w[s < 0 ? 1 : 0] = { off: 1.5, h: 600 + 500 * (0.5 + 0.5 * Math.sin(i * 0.05)), kind: 'rock', rock: 'sand' };
      else if (i % 5 === 0 && rng() < 0.6) put(i, { kind: rng() < 0.6 ? 'palm' : 'bush', off: -s * (1.4 + rng() * 1.5), seed: i });
    }
    for (let i = 150; i < n - 10; i += 210) put(i, { kind: 'bill', off: -segs[i].sea * 1.5, word: ADS[rng() * ADS.length | 0], color: ['#d23b2f', '#2a6fb0', '#f2b32a'][rng() * 3 | 0] });
  } else if (theme === 'pass') {
    for (let i = 30; i < n - 10; i++) {
      const c = segs[i].curve;
      if (Math.abs(c) > 1.2) segs[i].walls[c > 0 ? 1 : 0] = { off: 1.35, h: 900 + 600 * (0.5 + 0.5 * Math.sin(i * 0.07)), kind: 'rock', rock: 'granite' };
      if (i % 2 === 0) for (const s of [-1, 1]) if (rng() < 0.55 && !segs[i].walls[s < 0 ? 0 : 1]) put(i, { kind: 'pine', off: s * (1.3 + rng() * 3), seed: i * 7 + s });
      if (i % 3 === 0 && Math.abs(c) > 1.2) put(i, { kind: 'guard', off: c > 0 ? -1.12 : 1.12 });
      if (i % 37 === 0 && Math.abs(c) > 1.6) put(i, { kind: 'sign', off: c > 0 ? -1.25 : 1.25, dir: c > 0 ? 1 : -1 });
    }
  } else if (theme === 'valley') {
    for (let i = 30; i < n - 10; i++) {
      if (i % 2 === 0) { put(i, { kind: 'fence', off: -1.18 }); put(i, { kind: 'fence', off: 1.18 }); }
      if (i % 7 === 0 && rng() < 0.6) put(i, { kind: 'tree', off: (rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 2.5), seed: i });
      if (i % 260 === 0) put(i, { kind: 'barn', off: (rng() < 0.5 ? -1 : 1) * 3.2 });
      if (i % 31 === 0 && Math.abs(segs[i].curve) > 1.8) put(i, { kind: 'sign', off: segs[i].curve > 0 ? -1.3 : 1.3, dir: segs[i].curve > 0 ? 1 : -1 });
    }
  } else {
    for (let i = 30; i < n - 10; i++) {
      if (i % 5 === 0 && rng() < 0.55) put(i, { kind: 'cactus', off: (rng() < 0.5 ? -1 : 1) * (1.4 + rng() * 3), seed: i });
      if (i % 11 === 0 && rng() < 0.5) put(i, { kind: 'rock', off: (rng() < 0.5 ? -1 : 1) * (1.5 + rng() * 2.5), seed: i });
      if (i % 9 === 0) put(i, { kind: 'pole', off: 1.6 });
    }
    for (let i = 120; i < n - 10; i += 190) put(i, { kind: 'bill', off: rng() < 0.5 ? -1.6 : 1.6, word: ADS[rng() * ADS.length | 0], color: ['#d23b2f', '#2a6fb0', '#f2b32a', '#2f8f4e'][rng() * 4 | 0] });
  }
  // the road surface: a slightly different shade per stretch, patches, and manholes downtown
  for (let i = 0; i < n; i++) {
    const seg = segs[i];
    seg.tone = 0.95 + rng() * 0.08;
    if (i > 40 && rng() < 0.03) seg.decal = { kind: 'patch', off: (rng() - 0.5) * 1.4, w: 0.15 + rng() * 0.25 };
    else if (theme === 'city' && i > 40 && i % 23 === 0) seg.decal = { kind: 'manhole', off: (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.4) };
  }
  const fs = Math.floor((finishZ + PLAYER_Z) / SEG);
  segs[fs].sprites.push({ kind: 'arch', off: 0, word: 'FINISH' });
  segs[Math.floor((START + PLAYER_Z) / SEG) + 2].sprites.push({ kind: 'arch', off: 0, word: 'START' });
}

// The race map: walk the track, turning by each segment's curve, then fit it in a box.
function buildMap() {
  mapPts = [];
  let x = 0, y = 0, a = -Math.PI / 2;
  for (let i = 0; i < segs.length; i++) {
    a += segs[i].curve * 0.0021;
    x += Math.cos(a); y += Math.sin(a);
    if (i % 8 === 0) mapPts.push([x, y]);
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [px, py] of mapPts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  mapBox = { x0, y0, s: Math.max(x1 - x0, y1 - y0, 1), w: x1 - x0, h: y1 - y0 };
}
const segAt = z => segs[clamp(Math.floor(z / SEG), 0, segs.length - 1)];
function roadY(z) { const s = segAt(z); return lerp(s.y0, s.y1, (z % SEG) / SEG); }

// ---------- bikes, riders and the career
const BIKES = [
  { name: 'Scrapper 125', cls: 'Rat', cost: 0, top: 0.86, acc: 0.9, grip: 0.95, tough: 0.8, nitro: 0, color: '#8a6f4d' },
  { name: 'Alley Cat 250', cls: 'Rat', cost: 1400, top: 0.92, acc: 1, grip: 1, tough: 0.9, nitro: 0, color: '#6d7d4a' },
  { name: 'Rust Bucket 400', cls: 'Rat', cost: 2800, top: 0.97, acc: 1.05, grip: 1, tough: 1.2, nitro: 0, color: '#9a4a32' },
  { name: 'Mongrel 500', cls: 'Rat', cost: 4400, top: 1.01, acc: 1.12, grip: 1.05, tough: 1.1, nitro: 0, color: '#4f5b66' },
  { name: 'Strada 600', cls: 'Sport', cost: 6800, top: 1.06, acc: 1.25, grip: 1.15, tough: 1, nitro: 0, color: '#c8322a' },
  { name: 'Corsa 750', cls: 'Sport', cost: 9500, top: 1.1, acc: 1.32, grip: 1.2, tough: 1, nitro: 0, color: '#2a62b8' },
  { name: 'Falco 900', cls: 'Sport', cost: 13000, top: 1.14, acc: 1.4, grip: 1.22, tough: 1.05, nitro: 0, color: '#e0a21c' },
  { name: 'Tempesta 1000', cls: 'Sport', cost: 17000, top: 1.18, acc: 1.48, grip: 1.25, tough: 1.05, nitro: 0, color: '#1f8a5b' },
  { name: 'Razorback 1000N', cls: 'Super', cost: 22000, top: 1.21, acc: 1.55, grip: 1.3, tough: 1, nitro: 3, color: '#d9d9d9' },
  { name: 'Vortex 1100N', cls: 'Super', cost: 28000, top: 1.25, acc: 1.62, grip: 1.32, tough: 1, nitro: 3, color: '#7b3fb0' },
  { name: 'Banshee 1200N', cls: 'Super', cost: 35000, top: 1.29, acc: 1.7, grip: 1.36, tough: 1.05, nitro: 4, color: '#111418' },
  { name: 'Thunderhawk 1300N', cls: 'Super', cost: 43000, top: 1.33, acc: 1.78, grip: 1.4, tough: 1.1, nitro: 5, color: '#f2c230' },
];
const RIVALS = [
  ['DIESEL', '#c8322a', '#2a2a2a'], ['ROXY', '#d94f9a', '#f2f2f2'], ['TANK', '#4f5b3a', '#c9a227'], ['VIPER', '#1f8a5b', '#1a1a1a'],
  ['SLICK', '#2a62b8', '#e8e8e8'], ['MAD DOG', '#8a3b1f', '#d23b2f'], ['JINX', '#7b3fb0', '#f2c230'], ['BONES', '#e8e4d8', '#222222'],
  ['SPIKE', '#e0a21c', '#2a2a2a'], ['LOLA', '#e86a4a', '#ffffff'], ['RICO', '#2fa3a8', '#1a1a1a'], ['BRICK', '#9a4a32', '#4f5b66'],
  ['FANG', '#3a3a3a', '#c8322a'], ['DUSTY', '#b8925a', '#6d4b2a'], ['ACE', '#f2f2f2', '#2a62b8'],
];
const TAUNTS = ['Nice bike. Shame about the rider.', 'Out of my way!', 'Eat my dust!', 'Is that thing pedal powered?', 'See you at the finish. Maybe.', 'You ride like my grandma!'];
const PRIZES = [1000, 750, 550, 420, 320, 250, 190, 140, 100, 70, 50, 35, 25, 15, 10, 5];
const LEVELS = 5;

const SAVE = 'highway-brawl-v1';
const G = { state: 'menu', time: 0, raceT: 0, countT: 0, track: 0, cash: 500, level: 1, owned: [0], bike: 0, qual: {}, best: {}, cam: 'cockpit', shake: 0, msgs: [], result: null, champion: false };
// the view is saved as 'view'; the first-person dashboard is the default
try { const sv = JSON.parse(localStorage.getItem(SAVE) || '{}'); delete sv.cam; Object.assign(G, sv); G.cam = sv.view === 'chase' ? 'chase' : 'cockpit'; } catch (e) { }
G.state = 'menu';
G.bike = clamp(G.bike | 0, 0, BIKES.length - 1);
if (!G.owned.includes(G.bike)) G.owned.push(G.bike);
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ cash: G.cash, level: G.level, owned: G.owned, bike: G.bike, qual: G.qual, best: G.best, view: G.cam, champion: G.champion })); } catch (e) { }
}
const bike = () => BIKES[G.bike];
const PMAX = () => MAXS * bike().top;
function msg(text, color, t) { G.msgs.push({ text, color: color || '#fff', t: t || 2.6 }); if (G.msgs.length > 4) G.msgs.shift(); }
const qualKey = (level, id) => level + ':' + id;

// ---------- the race
const P = { pos: 0, x: 0, speed: 0, hp: 100, bikeHp: 100, state: 'ride', crashT: 0, invuln: 0, punchT: 0, kickT: 0, swingT: 0, backT: 0,
  side: 1, lean: 0, weapon: 'chain', swings: 0, nitro: 0, nitroT: 0, target: null, targetT: 0 };
let rivals = [], traffic = [], cops = [];
const fxWorld = [], fxScreen = [];

function resetRace(trackIdx) {
  G.track = trackIdx;
  buildTrack(trackIdx, G.level);
  const B = bike();
  Object.assign(P, { pos: START, x: 0.35, speed: 0, hp: 100, bikeHp: 100, state: 'ride', crashT: 0, invuln: 0, punchT: 0, kickT: 0, swingT: 0, backT: 0,
    lean: 0, weapon: 'chain', swings: 0, nitro: B.nitro, nitroT: 0, target: null, targetT: 0, crashes: 0, knocks: 0, finished: false });
  G.raceT = 0; G.msgs = []; G.result = null;
  fxWorld.length = 0; fxScreen.length = 0;
  const rng = mulberry32(trackIdx * 7919 + G.level * 131 + 3);
  // the grid: eight rows of two, the player in the fifth row
  const slots = [];
  for (let r = 0; r < 8; r++) for (const s of [-0.35, 0.35]) slots.push({ pos: START + (4 - r) * 380, off: s });
  slots.splice(9, 1);
  const order = RIVALS.map((r, i) => i).sort(() => rng() - 0.5);
  rivals = order.map((ri, i) => {
    const [name, color, helmet] = RIVALS[ri];
    // a spread of pace: some riders are much quicker than others, and everyone gets quicker each level
    const pace = 0.62 + 0.07 * G.level + (1 - i / 14) * 0.11 + rng() * 0.03;
    return {
      name, color, helmet, num: ri + 2, bikeC: BIKES[(ri * 5 + 3) % BIKES.length].color, pos: slots[i].pos, off: slots[i].off, speed: 0, hp: 100, state: 'ride', downT: 0, punchT: 0, swingT: 0,
      cd: 1.5 + rng() * 2.5, base: MAXS * pace, weapon: rng() < 0.2 + G.level * 0.04 ? (rng() < 0.5 ? 'club' : 'chain') : null,
      aggro: 0.5 + rng() * 0.8 + G.level * 0.12, wasAhead: true, finishT: 0, wob: rng() * 10,
    };
  });
  traffic = [];
  const nCars = Math.round((14 + G.level * 7) * T.traffic);
  for (let i = 0; i < nCars; i++) {
    const r = rng(), on = r < T.oncoming;
    traffic.push({
      pos: START + 5000 + (finishZ - START - 6000) * rng(), dir: on ? -1 : 1,
      off: on ? -0.3 - rng() * 0.45 : 0.3 + rng() * 0.45, speed: MAXS * (0.28 + rng() * 0.16),
      kind: rng() < 0.18 ? 'truck' : rng() < 0.3 ? 'van' : 'car', color: ['#e9e9e4', '#c8322a', '#2a62b8', '#e0a21c', '#2f2f33', '#3f8a5a', '#9aa3a8'][rng() * 7 | 0],
    });
  }
  for (const c of traffic) c.pos0 = c.pos;
  G.trafT = 0;
  cops = [];
  const nCops = T.police + (G.level >= 3 ? 1 : 0) + (G.level >= 5 ? 1 : 0);
  for (let i = 0; i < nCops; i++) cops.push({ pos: START + 9000 + (finishZ - START - 14000) * ((i + 0.3 + rng() * 0.4) / nCops), off: rng() < 0.5 ? -0.5 : 0.5, speed: 0, hp: 120, state: 'patrol', downT: 0, punchT: 0, cd: 2, near: 0 });
  G.state = 'count'; G.countT = 3.4;
  hideUI();
  // colour everyone's riding frames now, during the countdown, rather than mid-race
  if (SPR.ready) for (const o of rivals) for (let f = 0; f < 5; f++) tintedFrame(f, o.bikeC, o.color, o.helmet);
}

function rankOf() {
  let r = 1;
  for (const o of rivals) if (o.finishT ? true : o.pos > P.pos) r++;
  for (const p of NET.peers.values()) if (p.s && (p.s.done || p.rpos > P.pos)) r++;
  return r;
}
function sparkWorld(pos, off, color, n) {
  for (let i = 0; i < n; i++) fxWorld.push({ pos: pos + (Math.random() - 0.5) * 80, off: off + (Math.random() - 0.5) * 0.1, h: 300 + Math.random() * 200, vOff: (Math.random() - 0.5) * 1.6, vH: 150 + Math.random() * 400, life: 0.35 + Math.random() * 0.35, c: color, size: 40 + Math.random() * 50 });
}
function sparkScreen(x, y, color, n, spread) {
  for (let i = 0; i < n; i++) fxScreen.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * (spread || 420), vy: -120 - Math.random() * 320, life: 0.3 + Math.random() * 0.4, c: color, r: 2 + Math.random() * 3 });
}

function knockdown(o, why) {
  o.state = 'down'; o.downT = 3.2 + Math.random();
  P.knocks = (P.knocks || 0) + 1;
  msg(why, '#ffd84a');
  Snd.thud(0.32);
  sparkWorld(o.pos, o.off, '#f2b32a', 16);
  if (o.weapon === 'club' && P.weapon !== 'club') { o.weapon = null; P.weapon = 'club'; P.swings = 8; msg('You took ' + o.name + "'s club!", '#ffd84a'); }
  if (o.isCop) { o.state = 'down'; o.chase = false; msg('You knocked the officer off. Ride!', '#9fc3ff'); }
}

// Who's in reach: riders (and police) ahead or level, on either side, or behind for a backhand.
function targetFor(kind) {
  const reachX = (kind === 'swing' ? 430 : kind === 'kick' ? 380 : 340) / RW;
  let best = null, bd = 1e9;
  for (const o of rivals.concat(cops)) {
    if (o.state !== 'ride' && !(o.isCop && o.state === 'chase')) continue;
    const dz = o.pos - P.pos, dx = o.off - P.x;
    const okZ = kind === 'back' ? dz > -420 && dz < 60 : dz > -80 && dz < 330;
    if (!okZ || Math.abs(dx) > reachX || Math.abs(dx) < 0.02) continue;
    const d = Math.abs(dz) + Math.abs(dx) * 500;
    if (d < bd) { bd = d; best = o; }
  }
  // other players online
  for (const [id, p] of NET.peers) {
    if (!p.s || p.s.st !== 'ride' || p.s.done) continue;
    const dz = p.rpos - P.pos, dx = p.rx - P.x;
    const okZ = kind === 'back' ? dz > -420 && dz < 60 : dz > -80 && dz < 330;
    if (!okZ || Math.abs(dx) > reachX || Math.abs(dx) < 0.02) continue;
    const d = Math.abs(dz) + Math.abs(dx) * 500;
    if (d < bd) { bd = d; best = { peer: id, pos: p.rpos, off: p.rx, name: p.name }; }
  }
  return best;
}
function attack(kind) {
  if (P.state !== 'ride' || P.punchT > 0 || P.kickT > 0 || P.swingT > 0 || P.backT > 0) return;
  if (kind === 'punch') P.punchT = 0.28; else if (kind === 'kick') P.kickT = 0.34; else if (kind === 'swing') P.swingT = 0.45; else P.backT = 0.3;
  const o = targetFor(kind);
  P.side = o ? Math.sign(o.off - P.x) || 1 : P.lean >= 0 ? 1 : -1;
  if (kind === 'swing') Snd.clink(0.12);
  if (!o) return;
  if (o.peer !== undefined) { hitPeer(o, kind); return; }
  if (online() && !NET.room.isHost) { hitPackRemote(o, kind); return; }
  // grab: punch a rider who is mid-swing with a club and the club is yours
  if (kind === 'punch' && o.weapon === 'club' && o.swingT > 0 && P.weapon !== 'club') {
    o.weapon = null; P.weapon = 'club'; P.swings = 8; o.swingT = 0;
    msg('Grabbed ' + o.name + "'s club!", '#ffd84a'); Snd.clink(0.2); return;
  }
  const [dmg, shove] = hitStrength(kind);
  if (!o.isCop) { P.target = o; P.targetT = 4; }
  Snd.thud(kind === 'swing' ? 0.3 : 0.22);
  G.shake = Math.max(G.shake, 0.14);
  const down = packHit(o, kind, dmg, shove, P.side);
  if (o.isCop && o.state === 'chase' && !down) msg('You hit a police officer!', '#9fc3ff');
  if (down) knockdown(o, down);
}
// how hard each move hits, and how far it knocks a rider sideways (in road half-widths)
function hitStrength(kind) {
  if (kind === 'kick') return [9, 0.5];
  if (kind === 'back') return [18, 0.09];
  if (kind === 'swing') {
    if (P.weapon === 'club') { if (--P.swings <= 0) { P.weapon = 'chain'; msg('The club broke. Back to the chain.', '#c8c8c8'); } return [40, 0.12]; }
    return [26, 0.1];
  }
  return [16, 0.06];
}
// a hit on a rider or officer of the pack; returns what to say if it put them down
function packHit(o, kind, dmg, shove, side) {
  o.hp -= dmg;
  o.off += side * shove;
  o.speed *= kind === 'kick' ? 0.9 : 0.94;
  if (o.isCop && o.state === 'patrol') o.state = 'chase';
  sparkWorld(o.pos, o.off, kind === 'swing' ? '#d8d8d8' : '#f2b32a', kind === 'swing' ? 10 : 6);
  if (Math.abs(o.off) > 1.15) return (o.isCop ? 'Officer' : o.name) + ' went off the road!';
  if (o.hp <= 0) return (o.isCop ? 'Officer' : o.name) + ' is down!';
  return '';
}

function crashPlayer(why, dmg) {
  if (P.state !== 'ride' || P.invuln > 0) return;
  P.state = 'crash'; P.crashT = 1.7; P.crashes = (P.crashes || 0) + 1;
  G.shake = 0.7; Snd.thud(0.4);
  msg(why, '#ff6b5b');
  sparkScreen(W / 2, H - 90, '#f2b32a', 22, 700);
  P.bikeHp -= (dmg || 10) * 0.85 / bike().tough;
  if (P.weapon === 'club') { P.weapon = 'chain'; msg('You dropped the club.', '#c8c8c8'); }
  const busted = cops.some(c => c.state === 'chase' && Math.abs(c.pos - P.pos) < 1600);
  if (online()) {
    // online there's no ending the race early: a wrecked bike limps on, and the police hold you up
    if (P.bikeHp <= 0) { P.bikeHp = 10; msg('Your bike is barely holding together.', '#ff9b8a'); }
    if (busted) { P.crashT = 5; msg('Busted! The police hold you up for a few seconds.', '#9fc3ff', 3); for (const c of cops) if (c.state === 'chase') c.state = 'patrol'; }
    return;
  }
  if (P.bikeHp <= 0) { P.bikeHp = 0; endRace('wrecked'); return; }
  if (busted) endRace('busted');
}

function update(dt) {
  G.time += dt;
  pollPad(); applyTouch();
  for (let i = G.msgs.length - 1; i >= 0; i--) if ((G.msgs[i].t -= dt) <= 0) G.msgs.splice(i, 1);
  G.shake = Math.max(0, G.shake - dt * 2);
  updateFx(dt);
  if (pressed('m')) { Snd.muted = !Snd.muted; msg(Snd.muted ? 'Sound off' : 'Sound on'); }
  if (pressed('c') && (G.state === 'race' || G.state === 'count')) { G.cam = G.cam === 'chase' ? 'cockpit' : 'chase'; save(); }
  if (G.state === 'count' || G.state === 'race' || G.state === 'over') G.trafT += dt;
  if (G.state === 'count') {
    G.countT -= dt;
    if (G.countT <= 0) { G.state = 'race'; msg('GO!', '#7dff8a', 1.2); }
    updateTraffic(dt);
  } else if (G.state === 'race') {
    if (pressed('Escape', 'p') && !online()) pause();
    else {
      G.raceT += dt;
      updatePlayer(dt);
      updateField(dt);
      if (G.state === 'race' && P.pos >= finishZ) { if (online()) finishOnline(); else endRace('finished'); }
      if (pressed('r') && !online()) resetRace(G.track);
    }
  } else if (G.state === 'paused') {
    if (pressed('Escape', 'p')) resume();
  } else if (G.state === 'over') {
    // the field rides on behind the results
    P.speed = Math.max(0, P.speed - MAXS * 0.4 * dt); P.pos = Math.min(trackEnd - SEG, P.pos + P.speed * dt);
    updateField(dt, true);
  } else if (G.state === 'menu') {
    P.pos = (P.pos + MAXS * 0.35 * dt) % Math.max(1, finishZ - 20000); P.speed = MAXS * 0.35; P.x = 0.3 * Math.sin(G.time * 0.3);
    updateTraffic(dt);
  }
  if (online()) netTick(dt);
  for (const k in Pressed) Pressed[k] = false;
  const racing = G.state === 'race' || G.state === 'count';
  Snd.setEngine(racing, P.speed / (MAXS * 1.35), P.nitroT > 0);
  Snd.setSiren(racing ? clamp(cops.filter(c => c.state === 'chase').reduce((a, c) => Math.max(a, 1 - Math.abs(c.pos - P.pos) / 4000), 0), 0, 1) : 0);
}
function updateFx(dt) {
  for (let i = fxWorld.length - 1; i >= 0; i--) { const f = fxWorld[i]; if ((f.life -= dt) <= 0) { fxWorld.splice(i, 1); continue; } f.off += f.vOff * dt; f.h += f.vH * dt; f.vH -= 1400 * dt; }
  for (let i = fxScreen.length - 1; i >= 0; i--) { const f = fxScreen[i]; if ((f.life -= dt) <= 0) { fxScreen.splice(i, 1); continue; } f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; }
}

function updatePlayer(dt) {
  const seg = segAt(P.pos + PLAYER_Z), B = bike();
  if (P.state === 'crash') {
    P.crashT -= dt;
    P.speed = Math.max(0, P.speed - MAXS * 1.4 * dt);
    P.pos = Math.min(trackEnd - SEG, P.pos + P.speed * dt);
    if (P.crashT <= 0) { P.state = 'ride'; P.hp = Math.max(P.hp, 55); P.invuln = 2; P.x = clamp(P.x, -0.8, 0.8); P.speed = MAXS * 0.22; }
    return;
  }
  P.invuln = Math.max(0, P.invuln - dt);
  P.hp = Math.min(100, P.hp + 2 * dt);
  for (const k of ['punchT', 'kickT', 'swingT', 'backT', 'nitroT', 'targetT']) P[k] = Math.max(0, P[k] - dt);
  if (P.targetT <= 0) P.target = null;
  if (pressed('n') && P.nitro > 0 && P.nitroT <= 0) { P.nitro--; P.nitroT = 3.2; msg('NITRO!', '#7fd6ff', 1.2); }
  const top = PMAX() * (P.nitroT > 0 ? 1.18 : 1);
  if (gas()) P.speed += (MAXS / 3.2) * B.acc * (P.nitroT > 0 ? 1.8 : 1) * (1 - 0.55 * P.speed / top) * dt;
  else if (brake()) P.speed -= MAXS * 0.9 * dt;
  else P.speed -= (MAXS / 10) * dt;
  // hills: climbing slows you a little, going down speeds you up
  P.speed -= (seg.y1 - seg.y0) * 0.9 * dt * (P.speed / MAXS);
  const offRoad = Math.abs(P.x) > 1.02;
  if (offRoad && P.speed > MAXS * 0.3) P.speed -= MAXS * 0.85 * dt;
  P.speed = clamp(P.speed, 0, top);
  const ratio = P.speed / MAXS, steer = steerIn();
  const sdt = dt * 2 * B.grip * (0.4 + 0.6 * ratio) * (1100 / RW) ** 0.5;
  P.x += steer * sdt;
  // bends pull you outwards; on the sharpest ones at top speed you have to ease off
  P.x -= sdt * ratio * seg.curve * 0.15;
  P.lean = lerp(P.lean, steer - seg.curve * 0.15 * ratio, 1 - Math.exp(-8 * dt));
  if (offRoad) G.shake = Math.max(G.shake, 0.1 * ratio);
  // walls, the sea, and the scenery beyond the verge
  const wall = seg.walls[P.x < 0 ? 0 : 1], edge = wall ? wall.off - 0.15 : seg.sea && Math.sign(P.x) === seg.sea ? 1.12 : 1.6;
  if (Math.abs(P.x) > edge) {
    if (P.speed > MAXS * 0.25) crashPlayer(wall ? 'You hit the wall!' : seg.sea && Math.sign(P.x) === seg.sea ? 'Over the guard rail!' : 'You hit the scenery!', 15);
    P.x = Math.sign(P.x) * (edge - 0.05); P.speed = Math.min(P.speed, MAXS * 0.25);
  }
  if (pressed(' ', 'j')) attack('punch');
  if (pressed('e', 'k', 'Enter')) attack('kick');
  if (pressed('f', 'l', 'Shift', '/')) attack('swing');
  if (pressed('q', 'g')) attack('back');
  P.pos = Math.min(trackEnd - SEG, P.pos + P.speed * dt);
  if (P.state !== 'ride') return;
  const carX = 290 / RW, bikeX = 130 / RW;
  for (const c of traffic) {
    if (Math.abs(c.pos - P.pos) < (c.kind === 'truck' ? 260 : 160) && Math.abs(c.off - P.x) < carX * (c.kind === 'truck' ? 1.15 : 1) &&
        (c.dir === -1 ? P.speed + c.speed > 600 : P.speed > c.speed)) {
      crashPlayer(c.dir === -1 ? 'Head on into traffic!' : 'You hit a ' + c.kind + '!', c.dir === -1 ? 22 : 14);
      P.speed = c.dir === -1 ? 0 : c.speed * 0.4;
      return;
    }
  }
  for (const o of rivals.concat(cops)) {
    const dz = o.pos - P.pos;
    if (o.state === 'down') {
      if (Math.abs(dz) < 120 && Math.abs(o.off - P.x) < bikeX && P.speed > MAXS * 0.25) crashPlayer('You ran over a fallen bike!', 10);
      continue;
    }
    // riders touching ease apart, the rival giving way more than you; none of it in the first
    // seconds, when the whole pack is bunched up around you
    if (G.raceT > 3 && Math.abs(dz) < 110 && Math.abs(o.off - P.x) < bikeX) {
      const push = Math.sign(P.x - o.off) || 1;
      P.x += push * 0.25 * dt; o.off -= push * 0.9 * dt;
      P.speed *= 0.998; o.speed *= 0.996;
    }
  }
}

function updateField(dt, quiet) {
  if (online() && !NET.room.isHost) { followPack(dt); updateTraffic(dt); return; }
  const racing = !quiet && G.raceT > 5;
  G.hitCd = Math.max(0, (G.hitCd || 0) - dt);
  for (const p of NET.peers.values()) p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
  // online, the host runs the pack for everyone: riders pace themselves against the nearest
  // player, and fight whichever player is beside them
  const players = racers();
  for (const o of rivals) {
    if (o.finishT) { o.speed = Math.max(MAXS * 0.4, o.speed - MAXS * 0.3 * dt); o.pos = Math.min(trackEnd - SEG, o.pos + o.speed * dt); continue; }
    if (o.state === 'down') {
      o.downT -= dt;
      o.speed = Math.max(0, o.speed - MAXS * 1.5 * dt);
      o.pos += o.speed * dt;
      if (o.downT <= 0) { o.state = 'ride'; o.hp = 100; o.off = clamp(o.off, -0.8, 0.8); }
      continue;
    }
    let want = o.base;
    const lead = Math.max(...players.map(q => q.pos)), tail = Math.min(...players.map(q => q.pos));
    if (o.pos < tail - 5000) want *= 1.06; else if (o.pos > lead + 9000) want *= 0.9;
    const seg = segAt(o.pos);
    want *= 1 - Math.min(0.22, Math.abs(seg.curve) * 0.03);
    let blocked = null;
    for (const c of traffic) { const dz = c.pos - o.pos; if (dz > 0 && dz < (c.dir === -1 ? 1700 : 900) && Math.abs(c.off - o.off) < 0.32) { blocked = c; break; } }
    if (blocked) { o.off += (blocked.off > o.off ? -1 : 1) * (blocked.dir === -1 ? 1.7 : 1.1) * dt; if (blocked.dir === 1 && blocked.pos - o.pos < 320) want = Math.min(want, blocked.speed * 1.02); }
    o.off = clamp(o.off + Math.sin(G.time * 0.6 + o.wob) * 0.05 * dt, -0.85, 0.85);
    o.speed += clamp(want - o.speed, -MAXS * dt, MAXS / 3.2 * dt);
    o.pos = Math.min(trackEnd - SEG, o.pos + o.speed * dt);
    if (o.pos >= finishZ && !o.finishT) o.finishT = G.raceT;
    const ahead = o.pos > P.pos;
    if (racing && ahead && !o.wasAhead && Math.random() < 0.3) msg(o.name + ': ' + TAUNTS[Math.random() * TAUNTS.length | 0], o.color);
    o.wasAhead = ahead;
    o.punchT = Math.max(0, o.punchT - dt); o.swingT = Math.max(0, o.swingT - dt);
    if (racing) {
      o.cd -= dt * o.aggro;
      // one attacker at a time on each player, so a pack can't flatten anyone in a second
      const q = o.cd <= 0 ? players.find(q => q.ride && (q.hitCd || 0) <= 0 && Math.abs(o.pos - q.pos) < 300 && Math.abs(o.off - q.x) < 360 / RW) : null;
      if (q) {
        setHitCd(q, 0.9);
        o.cd = 1.2 + Math.random() * 1.8;
        // armed riders wind up first, which gives you a moment to grab the weapon
        if (o.weapon) { o.swingT = 0.45; o.hitAt = G.time + 0.3; o.hitWho = q.id; }
        else { o.punchT = 0.25; strike(o, q, 9 + G.level); }
      }
      if (o.hitAt && G.time >= o.hitAt) {
        o.hitAt = 0;
        const t = players.find(q => q.id === o.hitWho);
        if (t && o.weapon && Math.abs(o.pos - t.pos) < 340 && Math.abs(o.off - t.x) < 450 / RW) strike(o, t, (o.weapon === 'club' ? 18 : 14) + G.level);
      }
    }
  }
  for (const c of cops) updateCop(c, dt, racing, players);
  updateTraffic(dt);
  if (online()) sendPack();
}
// everyone racing: you, plus other players online (as the host sees them)
function racers() {
  const list = [{ id: -1, me: true, pos: P.pos, x: P.x, speed: P.speed, ride: P.state === 'ride' && !P.finished, hitCd: G.hitCd }];
  for (const [id, p] of NET.peers) if (p.s) list.push({ id, pos: p.rpos, x: p.rx, speed: +p.s.sp || 0, ride: p.s.st === 'ride' && !p.s.done, hitCd: p.hitCd });
  return list;
}
function setHitCd(q, t) { q.hitCd = t; if (q.me) G.hitCd = t; else { const p = NET.peers.get(q.id); if (p) p.hitCd = t; } }
// a rider or officer lands a hit: on you directly, or sent to the player it hit
function strike(o, q, dmg) {
  if (q.me) { hitPlayer(o, dmg); return; }
  netSend({ t: 'aihit', to: q.id, i: o.isCop ? cops.indexOf(o) : rivals.indexOf(o), cop: o.isCop ? 1 : 0, dmg });
}
function hitPlayer(o, dmg) {
  if (P.invuln > 0 || P.state !== 'ride') return;
  P.hp -= dmg;
  P.x += (Math.sign(P.x - o.off) || 1) * 0.12;
  G.shake = Math.max(G.shake, 0.3);
  Snd.thud(0.24);
  if (o.weapon) Snd.clink(0.15);
  msg((o.isCop ? 'The officer' : o.name) + (o.weapon ? ' hit you with a ' + o.weapon + '!' : ' punched you!'), o.isCop ? '#9fc3ff' : '#ff9b8a', 1.6);
  sparkScreen(W / 2 + Math.sign(o.off - P.x) * 40, H - 160, '#ff6b5b', 8, 380);
  if (P.hp <= 0) { P.hp = 0; crashPlayer('Knocked off your bike!', 8); }
}
// Police: they cruise until you come past fast or hit one, then they chase. If you
// crash anywhere near a chasing officer, you're busted.
function updateCop(c, dt, racing, players) {
  c.isCop = true; c.weapon = 'club';
  if (c.state === 'down') { c.downT -= dt; c.speed = Math.max(0, c.speed - MAXS * 1.5 * dt); c.pos += c.speed * dt; if (c.downT <= 0) { c.state = 'patrol'; c.hp = 120; } return; }
  players = players || racers();
  // the officer deals with the nearest player
  const q = players.reduce((a, b) => (Math.abs(b.pos - c.pos) < Math.abs(a.pos - c.pos) ? b : a));
  const gap = q.pos - c.pos;
  if (c.state === 'patrol') {
    c.speed += clamp(MAXS * 0.5 - c.speed, -MAXS * dt, MAXS / 4 * dt);
    if (racing && q.ride && Math.abs(gap) < 1400 && q.speed > MAXS * 0.75) { c.state = 'chase'; if (q.me) msg('Police! Lose them, and don\'t crash.', '#9fc3ff'); }
  } else {
    const want = gap > 3000 ? MAXS * 1.3 : gap < -600 ? q.speed * 0.9 : Math.max(q.speed * 1.06, MAXS * 0.6);
    c.speed += clamp(want - c.speed, -MAXS * dt, MAXS / 2.4 * dt);
    c.off = lerp(c.off, q.x + (c.off > q.x ? 0.25 : -0.25), 1 - Math.exp(-1.5 * dt));
    if (gap > 9000) { c.state = 'patrol'; if (q.me) msg('You lost the police.', '#9fc3ff'); }
    c.punchT = Math.max(0, c.punchT - dt); c.swingT = Math.max(0, c.swingT - dt);
    c.cd -= dt;
    if (racing && q.ride && c.cd <= 0 && Math.abs(gap) < 300 && Math.abs(c.off - q.x) < 380 / RW) { c.cd = 1.6; c.swingT = 0.4; c.hitAt = G.time + 0.3; c.hitWho = q.id; }
    if (c.hitAt && G.time >= c.hitAt) { c.hitAt = 0; const t = players.find(p => p.id === c.hitWho); if (t && Math.abs(c.pos - t.pos) < 340 && Math.abs(c.off - t.x) < 450 / RW) strike(c, t, 15); }
  }
  c.pos = Math.min(trackEnd - SEG, c.pos + c.speed * dt);
}
function updateTraffic(dt) {
  if (online()) {
    // online, every screen moves the cars from the same race clock, so they're in the same places
    const span = trackEnd - SEG - START;
    for (const c of traffic) c.pos = START + (((c.pos0 - START + c.dir * c.speed * G.trafT) % span) + span) % span;
    return;
  }
  for (const c of traffic) {
    c.pos += c.speed * c.dir * dt;
    if (c.dir === 1 && c.pos > trackEnd - SEG) c.pos = START + 4000 + Math.random() * 4000;
    if (c.pos < P.pos - (c.dir === 1 ? 3000 : 1200)) c.pos = P.pos + DRAW * SEG + Math.random() * 9000;
  }
}

function endRace(how) {
  if (G.state !== 'race') return;
  const place = rankOf(), t = G.raceT;
  const lvlMul = 1 + (G.level - 1) * 0.6;
  const r = { how, place, time: t, prize: 0, fine: 0, repair: 0, qualified: false, levelUp: false, champion: false, bonus: 0 };
  if (how === 'finished') {
    r.prize = Math.round(PRIZES[place - 1] * lvlMul);
    r.bonus = (P.knocks || 0) * 40 * G.level;
    if (place <= 3) {
      r.qualified = true;
      G.qual[qualKey(G.level, T.id)] = Math.min(G.qual[qualKey(G.level, T.id)] || 99, place);
      if (!G.best[T.id] || t < G.best[T.id]) { G.best[T.id] = t; r.record = true; }
      if (TRACKS.every(tr => G.qual[qualKey(G.level, tr.id)])) {
        if (G.level < LEVELS) { G.level++; r.levelUp = true; } else if (!G.champion) { G.champion = true; r.champion = true; r.bonus += 25000; }
      }
    }
  } else if (how === 'busted') {
    r.fine = Math.min(G.cash, 300 * G.level);
  } else if (how === 'wrecked') {
    r.repair = Math.min(G.cash, Math.round(Math.max(300, bike().cost * 0.25)));
  }
  G.cash = Math.max(0, G.cash + r.prize + r.bonus - r.fine - r.repair);
  // everyone else's finishing time: real if they've crossed, an estimate if not
  const field = rivals.map(o => ({ name: o.name, color: o.color, time: o.finishT || G.raceT + (finishZ - o.pos) / Math.max(o.speed, MAXS * 0.5) }));
  field.push({ name: 'YOU', color: '#ffd84a', time: how === 'finished' ? t : Infinity, you: true });
  field.sort((a, b) => a.time - b.time);
  r.field = field;
  G.result = r;
  P.finished = true;
  G.state = 'over';
  save();
  showResults();
}
function pause() { if (G.state !== 'race' && G.state !== 'count') return; G.paused = G.state; G.state = 'paused'; showPause(); }
function resume() { G.state = G.paused || 'race'; hideUI(); }

// ---------- drawing the world
function project(wx, wy, z) {
  const s = CAM_D / z;
  return { x: W / 2 + s * wx * W / 2, y: H / 2 - s * wy * H / 2, w: s * RW * W / 2 };
}
function poly(x1, y1, x2, y2, x3, y3, x4, y4, style) {
  ctx.fillStyle = style;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
}
// haze: clear close up, thickening towards the horizon
const fogA = n => 1 - Math.exp(-((n / DRAW) ** 2) * TH.fogK);
let bgX = 0;

function drawSky(horY) {
  const g = ctx.createLinearGradient(0, 0, 0, horY);
  g.addColorStop(0, TH.sky[0]); g.addColorStop(0.75, mix(TH.sky[0], TH.sky[1], 0.7)); g.addColorStop(1, TH.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(-50, -50, W + 100, horY + 52);
  // the sun, with a soft glow
  const wrap = (v, span) => ((v % span) + span) % span;
  const sx = wrap(W * 0.78 - bgX * 0.05, W + 200) - 100, sy = horY * 0.26, R = Math.min(W, H) * 0.045;
  const sg = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 6);
  sg.addColorStop(0, 'rgba(255,250,220,0.75)'); sg.addColorStop(0.25, 'rgba(255,245,210,0.25)'); sg.addColorStop(1, 'rgba(255,245,210,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - R * 6, sy - R * 6, R * 12, R * 12);
  ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(sx, sy, R, 0, 7); ctx.fill();
  // painted clouds drifting with the bends
  for (let i = 0; i < 8; i++) {
    const cw = W * (0.16 + (i * 37 % 10) / 50), ch = cw * 130 / 320;
    const cx = wrap(i * 431 - bgX * (0.08 + (i % 3) * 0.03), W + cw * 2) - cw, cy = horY * (0.06 + (i * 53 % 50) / 100);
    ctx.globalAlpha = 0.85 - (i % 3) * 0.12;
    ctx.drawImage(Art.cloud(i % 3), cx, cy, cw, ch);
  }
  ctx.globalAlpha = 1;
  // the backdrop for this road, tiled sideways and sliding as the road bends
  if (TH.back === 'sea') { const wg = ctx.createLinearGradient(0, horY - H * 0.03, 0, horY + 2); wg.addColorStop(0, '#5b9fd0'); wg.addColorStop(1, '#2f7fb6'); ctx.fillStyle = wg; ctx.fillRect(-50, horY - H * 0.03, W + 100, H * 0.03 + 2); }
  const bd = Art.backdrop(TH.back), bh = H * (TH.back === 'peaks' ? 0.3 : TH.back === 'skyline' ? 0.24 : 0.16), bw = bh * Art.BW / Art.BH;
  const off = wrap(bgX * 0.22, bw);
  for (let x = -off; x < W + 50; x += bw) ctx.drawImage(bd, x - 25, horY - bh + 2, bw + 1, bh);
  // haze where the land meets the sky
  const hz = ctx.createLinearGradient(0, horY - H * 0.08, 0, horY + 4);
  hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, TH.fog);
  ctx.fillStyle = hz; ctx.fillRect(-50, horY - H * 0.08, W + 100, H * 0.08 + 4);
}

function render() {
  if (!segs.length) buildTrack(0, 1);
  const shx = (Math.random() - 0.5) * G.shake * 24, shy = (Math.random() - 0.5) * G.shake * 24;
  const cockpit = G.cam === 'cockpit' && G.state !== 'menu';
  ctx.save();
  ctx.translate(shx, shy);
  if (cockpit) { ctx.translate(W / 2, H / 2); ctx.rotate(-P.lean * 0.05); ctx.translate(-W / 2, -H / 2); }
  // your bike sits RIDE_Z ahead of the chase camera, chosen so it stands about a third of the
  // screen tall; everyone is drawn that far ahead of where they are. In the first-person view the
  // camera moves up to that spot, at the rider's eye height.
  const RIDE_Z = clamp(CAM_D * W * 640 / H, 500, 2600);
  const camPos = cockpit ? P.pos + RIDE_Z - 40 : P.pos;
  // a rider's eyes are about 1.2 m up; the chase camera rides a little higher, behind the bike
  const camH = cockpit ? 300 : 620;
  const baseIdx = clamp(Math.floor(camPos / SEG), 0, segs.length - 1), basePct = clamp((camPos % SEG) / SEG, 0, 1);
  const camY = camH + roadY(camPos + PLAYER_Z);
  bgX += (segs[Math.min(baseIdx, segs.length - 1)].curve * P.speed / MAXS) * 0.6;
  ctx.fillStyle = TH.fog; ctx.fillRect(-50, -50, W + 100, H + 100);
  // the horizon sits where the farthest visible road meets the sky
  const horY = H * 0.5 + (cockpit ? H * 0.04 : 0);
  drawSky(horY);
  ctx.fillStyle = TH.grass[0]; ctx.fillRect(-50, horY, W + 100, H - horY + 50);

  let x = 0, dx = -(segs[Math.min(baseIdx, segs.length - 1)].curve * basePct), maxY = H;
  for (let n = 0; n < DRAW; n++) {
    const idx = Math.min(baseIdx + n, segs.length - 1), seg = segs[idx];
    const z1 = idx * SEG - camPos, z2 = z1 + SEG, camX = P.x * RW;
    seg.clip = maxY;
    const p1 = project(x - camX, seg.y0 - camY, Math.max(z1, 1));
    x += dx; dx += seg.curve;
    const p2 = project(x - camX, seg.y1 - camY, Math.max(z2, 1));
    seg.sx1 = p1.x; seg.sy1 = p1.y; seg.sw1 = p1.w; seg.sx2 = p2.x; seg.sy2 = p2.y; seg.sw2 = p2.w;
    if (z1 <= CAM_D * 20 || p2.y >= maxY) continue;
    drawSegment(seg, idx, p1, p2, n, maxY);
    maxY = p2.y;
  }

  // scenery, riders and cars, far to near, each clipped below its hill crest
  const bySeg = new Map();
  const place = (kind, o, z) => { const si = Math.floor(z / SEG); if (!bySeg.has(si)) bySeg.set(si, []); bySeg.get(si).push({ kind, o, z }); };
  for (const o of rivals) place('rival', o, o.pos + RIDE_Z);
  for (const c of cops) place('cop', c, c.pos + RIDE_Z);
  for (const c of traffic) place('car', c, c.pos + RIDE_Z);
  for (const f of fxWorld) place('fx', f, f.pos + RIDE_Z);
  if (!cockpit && G.state !== 'menu') place('me', { off: P.x }, P.pos + RIDE_Z + 1);
  if (G.state === 'count' || G.state === 'race' || G.state === 'over') for (const p of NET.peers.values()) if (p.s) place('peer', { off: p.rx, p }, p.rpos + RIDE_Z);
  for (let n = DRAW - 1; n > 0; n--) {
    const idx = Math.min(baseIdx + n, segs.length - 1), seg = segs[idx];
    if (seg.sy1 <= 0 || seg.sw1 <= 0 || idx * SEG - camPos <= CAM_D * 20) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(-60, seg.clip - H * 3, W + 120, H * 3); ctx.clip();
    baseM = ctx.getTransform();
    // distant scenery fades towards the haze colour behind it
    const fa = fogA(n);
    ctx.globalAlpha = 1 - fa * 0.85;
    for (const side of [0, 1]) if (seg.walls[side]) drawWall(seg, side, seg.walls[side], n, fa);
    for (const sp of seg.sprites) drawSprite(sp, seg, n, fa);
    const ents = bySeg.get(idx);
    if (ents) {
      ents.sort((a, b) => b.z - a.z);
      for (const e of ents) {
        // in the cockpit, anyone this close is alongside you rather than in front
        if (cockpit && e.z - camPos < 180 && e.kind !== 'fx') continue;
        const pct = (e.z % SEG) / SEG;
        const sx = lerp(seg.sx1, seg.sx2, pct), sy = lerp(seg.sy1, seg.sy2, pct), sw = lerp(seg.sw1, seg.sw2, pct);
        const ex = sx + e.o.off * sw, k = sw / RW;
        if (e.kind === 'car') drawCar(ex, sy, k, e.o);
        else if (e.kind === 'me') drawPlayerAt(ex, sy, k);
        else if (e.kind === 'peer') drawPeer(ex, sy, k, e.o, n);
        else if (e.kind === 'fx') { const f = e.o, s = Math.max(1.5, f.size * k); ctx.globalAlpha = clamp(f.life * 3, 0, 1); ctx.fillStyle = f.c; ctx.fillRect(ex - s / 2, sy - f.h * k - s / 2, s, s); ctx.globalAlpha = 1; }
        else drawOther(ex, sy, k, e.o, n, e.kind === 'cop');
        ctx.globalAlpha = 1 - fa * 0.85;
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  for (const f of fxScreen) { ctx.globalAlpha = clamp(f.life * 3, 0, 1); ctx.fillStyle = f.c; ctx.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r); }
  ctx.globalAlpha = 1;
  if (P.nitroT > 0 || P.speed > MAXS * 1.12) speedLines();
  ctx.restore();
  if (cockpit) drawCockpit();
  drawHUD();
}

function drawSegment(seg, idx, p1, p0, n, bottom) {
  // the road overlaps a pixel into the next strip so no seams show; the ground stops where the nearer strip starts
  const p2 = { x: p0.x, y: p0.y - 1, w: p0.w }, gy = Math.min(p1.y, bottom - 1);
  const alt = (idx / 3 | 0) % 2, row = TH.rows ? idx % 2 : alt;
  const fa = fogA(n);
  const tn = seg.tone || 1;
  ctx.fillStyle = shade(TH.grass[row], tn);
  ctx.fillRect(-50, p2.y, W + 100, gy - p2.y);
  const band = (a, b, col) => {
    // a strip of ground between two offsets from the road centre (in road half-widths)
    poly(p1.x + a * p1.w, p1.y, p1.x + b * p1.w, p1.y, p2.x + b * p2.w, p2.y, p2.x + a * p2.w, p2.y, col);
  };
  if (seg.sea) {
    const s = seg.sea;
    const far = s * 60;
    band(s * 1.05, s * 1.5, TH.sand[alt]);
    band(s * 1.5, far, TH.sea[(idx / 2 | 0) % 2]);
    if (alt) band(s * 1.5, s * 1.62, 'rgba(255,255,255,0.55)');
  }
  if (TH.walk) {
    // sidewalks with paving joints and a kerb along the road
    band(-1.5, -1.04, TH.walk[idx % 2]); band(1.04, 1.5, TH.walk[idx % 2]);
    band(-1.08, -1.04, '#d8d4cb'); band(1.04, 1.08, '#d8d4cb');
  }
  if (seg.cross) { ctx.fillStyle = TH.road[0]; ctx.fillRect(-50, p2.y, W + 100, gy - p2.y); }
  const r1 = p1.w * 1.07, r2 = p2.w * 1.07;
  if (!seg.cross) poly(p1.x - r1, p1.y, p1.x + r1, p1.y, p2.x + r2, p2.y, p2.x - r2, p2.y, TH.rumble[alt]);
  poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, shade(TH.road[alt], tn));
  // darker wear where the wheels run, and patches and manholes in the surface
  if (n < 160) for (const f of [-0.75, -0.25, 0.25, 0.75]) band(f - 0.07, f + 0.07, 'rgba(0,0,0,0.07)');
  if (seg.decal && n < 140) {
    const d = seg.decal;
    if (d.kind === 'patch') band(d.off - d.w, d.off + d.w, 'rgba(20,20,22,0.22)');
    else { const mx = lerp(p1.x, p2.x, 0.5) + d.off * lerp(p1.w, p2.w, 0.5), my = (p1.y + p2.y) / 2, rw = lerp(p1.w, p2.w, 0.5) * 0.09, rh = Math.max(1, (p1.y - p2.y) * 0.45);
      ctx.fillStyle = '#3c3d40'; ctx.beginPath(); ctx.ellipse(mx, my, rw, rh, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6a6b6e'; ctx.lineWidth = Math.max(1, rw * 0.12); ctx.stroke(); }
  }
  // lane lines: dashed whites between lanes, a solid double yellow in the middle
  const line = (f, wpx, col) => { const l1 = p1.w * wpx + 0.5, l2 = p2.w * wpx + 0.5; poly(p1.x + p1.w * f - l1, p1.y, p1.x + p1.w * f + l1, p1.y, p2.x + p2.w * f + l2, p2.y, p2.x + p2.w * f - l2, p2.y, col); };
  if (seg.cross) {
    if (idx % 4 === 1) line(0, 0.9, 'rgba(240,240,230,0.9)');
  } else {
    if (alt) { line(-0.5, 0.012, TH.lane); line(0.5, 0.012, TH.lane); }
    line(-0.95, 0.01, TH.lane); line(0.95, 0.01, TH.lane);
    line(-0.025, 0.008, '#e8c33a'); line(0.025, 0.008, '#e8c33a');
  }
  if (idx === Math.floor((START + PLAYER_Z) / SEG) || idx === Math.floor((finishZ + PLAYER_Z) / SEG)) {
    for (let c = 0; c < 10; c++) { const f0 = -1 + c * 0.2; poly(p1.x + p1.w * f0, p1.y, p1.x + p1.w * (f0 + 0.2), p1.y, p2.x + p2.w * (f0 + 0.2), p2.y, p2.x + p2.w * f0, p2.y, c % 2 ? '#111' : '#f4f4f4'); }
  }
  if (fa > 0.03) { ctx.globalAlpha = fa; ctx.fillStyle = TH.fog; ctx.fillRect(-50, p2.y, W + 100, gy - p2.y); ctx.globalAlpha = 1; }
}

// A building or rock face beside the road, drawn as a strip for each segment so it follows
// every bend and hill. The texture is mapped onto the strip with a transform: across along the
// bottom edge of the strip, and straight up for the height.
let baseM = null;
function mapTex(img, sx, sy, sw, sh, x1, y1, x2, y2, h) {
  ctx.setTransform(baseM);
  ctx.transform((x2 - x1) / sw, (y2 - y1) / sw, 0, h / sh, x1, y1 - h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.setTransform(baseM);
}
function drawWall(seg, side, w, n, fa) {
  const s = side ? 1 : -1, k1 = seg.sw1 / RW, k2 = seg.sw2 / RW;
  const x1 = seg.sx1 + s * w.off * seg.sw1, x2 = seg.sx2 + s * w.off * seg.sw2, y1 = seg.sy1, y2 = seg.sy2;
  const h1 = w.h * k1, h2 = w.h * k2, hAvg = (h1 + h2) / 2;
  const bld = w.kind === 'bld';
  const tex = bld ? Art.facade(w.style, (seg.i >> 1) % 2) : Art.rock(w.rock);
  const sh = Math.min(tex.height, w.h * Art.PX);
  if (Math.abs(x2 - x1) < 1.5 || n > 170) {
    poly(x1, y1, x2, y2, x2, y2 - h2, x1, y1 - h1, bld ? Art.FACADES[w.style].base : (w.rock === 'sand' ? '#a07a56' : '#7d7a74'));
  } else {
    const third = Art.FW / 3, sx = (seg.i % 3) * third;
    mapTex(tex, sx, tex.height - sh, third, sh, x1, y1, x2, y2, hAvg);
    if (bld) { const shop = Art.shopfront(w.shop); mapTex(shop, sx, 0, third, 110, x1, y1, x2, y2, 600 * (k1 + k2) / 2); }
  }
  // the right-hand side of the street is in shade
  if (side) poly(x1, y1, x2, y2, x2, y2 - h2, x1, y1 - h1, 'rgba(20,25,40,0.16)');
  if (bld) {
    poly(x1, y1 - h1, x2, y2 - h2, x2, y2 - h2 - 80 * k2, x1, y1 - h1 - 80 * k1, shade(Art.FACADES[w.style].base, 0.62));
    // where a block starts, its end wall faces you; draw it solid so buildings don't look like cardboard
    if (w.start) {
      const xo = seg.sx1 + s * (w.off + 3.2) * seg.sw1;
      if (Math.abs(xo - x1) > 1) {
        if (n < 170) mapTex(tex, 0, tex.height - sh, Art.FW, sh, x1, y1, xo, y1, h1);
        else poly(x1, y1, xo, y1, xo, y1 - h1, x1, y1 - h1, Art.FACADES[w.style].base);
        poly(x1, y1, xo, y1, xo, y1 - h1, x1, y1 - h1, 'rgba(20,25,40,0.3)');
        poly(x1, y1 - h1, xo, y1 - h1, xo, y1 - h1 - 40 * k1, x1, y1 - h1 - 40 * k1, shade(Art.FACADES[w.style].base, 0.55));
      }
    }
  } else if (seg.i % 4 === 0 && w.rock !== 'sand') {
    poly(x1, y1 - h1, x2, y2 - h2, x2, y2 - h2 - 50 * k2, x1, y1 - h1 - 25 * k1, '#5f7f45');
  }
}

// Scenery, drawn from the painted sprites at the right size for the distance.
function blit(spr, x, y, k, flip, sc) {
  const w = spr.ww * k * (sc || 1), h = spr.wh * k * (sc || 1);
  if (w < 0.8 || h < 0.8) return;
  const ax = spr.ax !== undefined ? spr.ax : 0.5, top = y - h * (spr.base || 1);
  if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr.img, -ax * w, top, w, h); ctx.restore(); }
  else ctx.drawImage(spr.img, x - ax * w, top, w, h);
}
function drawSprite(sp, seg, n) {
  const x = seg.sx1 + sp.off * seg.sw1, y = seg.sy1, k = seg.sw1 / RW;
  if (k <= 0 || x < -W || x > W * 2) return;
  const right = sp.off > 0;
  switch (sp.kind) {
    case 'tree': blit(Art.sprite('tree', sp.seed), x, y, k, sp.seed % 2, sp.small ? 0.7 : 1 + (sp.seed % 3) * 0.12); break;
    case 'pine': blit(Art.sprite('pine', sp.seed), x, y, k, sp.seed % 2, 0.85 + (sp.seed % 5) * 0.08); break;
    case 'palm': blit(Art.sprite('palm', sp.seed), x, y, k, right); break;
    case 'bush': blit(Art.sprite('bush', sp.seed), x, y, k, sp.seed % 2); break;
    case 'cactus': blit(Art.sprite('cactus', sp.seed), x, y, k, sp.seed % 2, 0.8 + (sp.seed % 4) * 0.1); break;
    case 'rock': blit(Art.sprite('rock', sp.seed), x, y, k, sp.seed % 2); break;
    case 'lamp': blit(Art.sprite('lamp'), x, y, k, right); break;
    case 'signal': {
      blit(Art.sprite('signal'), x, y, k, right);
      // the lit lamp in the signal head changes every few seconds
      const spr = Art.sprite('signal'), w = spr.ww * k, h = spr.wh * k, hx = x + (right ? -1 : 1) * w * (225 / 280 - 27 / 280);
      const red = Math.floor((G.time + seg.i) / 4) % 2, ly = y - h + h * ((red ? 76 : 156) / 380);
      ctx.fillStyle = red ? '#ff3b30' : '#3bff6a'; ctx.beginPath(); ctx.arc(hx, ly, Math.max(1, w * 15 / 280), 0, 7); ctx.fill();
      break;
    }
    case 'guard': blit(Art.sprite('guard'), x, y, k); break;
    case 'fence': blit(Art.sprite('fence'), x, y, k); break;
    case 'pole': blit(Art.sprite('pole'), x, y, k); break;
    case 'barn': blit(Art.sprite('barn'), x, y, k, right); break;
    case 'sign': blit(Art.sprite('sign', sp.dir), x, y, k); break;
    case 'bill': blit(Art.billboard(sp.word, sp.color), x, y, k); break;
    case 'arch': {
      const aw = RW * 2.3 * k, ah = 920 * k;
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - aw / 2 - 40 * k, y - ah, 80 * k, ah); ctx.fillRect(x + aw / 2 - 40 * k, y - ah, 80 * k, ah);
      const g = ctx.createLinearGradient(0, y - ah, 0, y - ah + 230 * k);
      g.addColorStop(0, sp.word === 'FINISH' ? '#e0463c' : '#3a78d0'); g.addColorStop(1, sp.word === 'FINISH' ? '#9a1f18' : '#1f4a8a');
      ctx.fillStyle = g; ctx.fillRect(x - aw / 2, y - ah, aw, 230 * k);
      if (ah > 20) { ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.max(6, 160 * k) + 'px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp.word, x, y - ah + 115 * k); }
      break;
    }
  }
}

function drawCar(x, y, k, c) {
  blit(Art.vehicle(c.kind, c.color, c.dir), x, y, k);
}

function drawOther(x, y, k, o, n, isCop) {
  if (o.state === 'down') {
    const q = k * RS;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 100 * q, y, 330 * q, 40 * q, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1c20'; ctx.beginPath(); ctx.ellipse(x, y - 40 * q, 220 * q, 55 * q, 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = isCop ? '#e9edf2' : o.bikeC; ctx.beginPath(); ctx.ellipse(x - 30 * q, y - 70 * q, 120 * q, 40 * q, 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = isCop ? '#1d2f52' : o.color; ctx.beginPath(); ctx.ellipse(x + 250 * q, y - 45 * q, 120 * q, 42 * q, 0, 0, 7); ctx.fill();
    ctx.fillStyle = isCop ? '#f4f4f4' : o.helmet; ctx.beginPath(); ctx.arc(x + 390 * q, y - 55 * q, 48 * q, 0, 7); ctx.fill();
    return;
  }
  drawRider(x, y, k, {
    bike: isCop ? '#e9edf2' : o.bikeC, jacket: isCop ? '#1d2f52' : o.color, helmet: isCop ? '#f4f4f4' : o.helmet, num: isCop ? 0 : o.num,
    lean: Math.sin(G.time * 2.4 + o.pos * 0.001) * 0.08, punch: o.punchT > 0, swing: o.swingT > 0 ? 1 - o.swingT / 0.45 : 0,
    side: Math.sign(P.x - o.off) || 1, weapon: o.weapon, cop: isCop,
  });
  if (n < 16 && k > 0.07) {
    const label = isCop ? 'POLICE' : o.name;
    ctx.font = 'bold ' + clamp(120 * k, 10, 24) + 'px Impact, "Arial Narrow", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(label, x, y - 430 * k);
    ctx.fillStyle = isCop ? (Math.floor(G.time * 6) % 2 ? '#ff5050' : '#5b8cff') : '#fff'; ctx.fillText(label, x, y - 430 * k);
  }
}

// ---------- riders from 3D renders
// The bikes and riders are 3D models (tools/model.js) rendered from behind in every pose
// (tools/bake.html) into sprites/riders.png and sprites/police.png. A second image marks which
// pixels are bodywork (red), leathers (green) and helmet and trim (blue), so each rider can be
// recoloured. Frames are 256x256 pixels at 120 pixels per metre, the tyre's contact point
// 10 pixels above the bottom edge. Until the images load, riders are drawn with shapes instead.
const SPR = { FW: 256, FH: 256, PX: 120, FOOT: 10, COLS: 8, UNITS_PER_M: 212, img: {}, ready: false, cache: new Map() };
(function loadSprites() {
  if (typeof Image === 'undefined' || typeof document === 'undefined' || !document.createElement) return;
  let left = 3;
  for (const [k, src] of [['riders', 'sprites/riders.png'], ['mask', 'sprites/riders-mask.png'], ['police', 'sprites/police.png']]) {
    const im = new Image();
    im.onload = () => { SPR.img[k] = im; if (--left === 0) SPR.ready = true; };
    im.src = src;
  }
})();
// which frame shows this pose
function spriteFrame(o, cop) {
  // frames are baked at 0, 0.15 and 0.3 radians of lean either way; the rest is a small rotation
  const leanIdx = clamp(Math.round((o.lean || 0) * 0.45 / 0.15) + 2, 0, 4);
  const sd = (o.side || 1) > 0 ? 0 : 1, ph = o.swing ? (o.swing < 0.34 ? 0 : o.swing < 0.67 ? 1 : 2) : 0;
  if (cop) return o.swing ? 5 + sd * 3 + ph : leanIdx;
  if (o.punch) return 5 + sd;
  if (o.back) return 7 + sd;
  if (o.kick) return 9 + sd;
  if (o.swing) return 11 + sd * 6 + (o.weapon === 'club' ? 3 : 0) + ph;
  return leanIdx;
}
// one frame recoloured for one rider, made once and kept
function tintedFrame(f, paint, suit, trim) {
  const key = f + paint + suit + trim;
  let c = SPR.cache.get(key);
  if (c) return c;
  const { FW, FH, COLS } = SPR, sx = (f % COLS) * FW, sy = Math.floor(f / COLS) * FH;
  c = document.createElement('canvas'); c.width = FW; c.height = FH;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(SPR.img.mask, sx, sy, FW, FH, 0, 0, FW, FH);
  const m = x.getImageData(0, 0, FW, FH).data;
  x.clearRect(0, 0, FW, FH);
  x.drawImage(SPR.img.riders, sx, sy, FW, FH, 0, 0, FW, FH);
  const img = x.getImageData(0, 0, FW, FH), d = img.data;
  const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 230, ((n >> 8) & 255) / 230, (n & 255) / 230]; };
  const tp = rgbOf(paint), ts = rgbOf(suit), tt = rgbOf(trim);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3] || !m[i + 3]) continue;
    const wp = m[i] / 255, ws = m[i + 1] / 255, wt = m[i + 2] / 255, w = Math.min(1, wp + ws + wt);
    if (!w) continue;
    for (let ch = 0; ch < 3; ch++) {
      const tint = (tp[ch] * wp + ts[ch] * ws + tt[ch] * wt) / (wp + ws + wt);
      d[i + ch] = Math.min(255, d[i + ch] * (1 - w + w * tint));
    }
  }
  x.putImageData(img, 0, 0);
  if (SPR.cache.size > 600) SPR.cache.delete(SPR.cache.keys().next().value);
  SPR.cache.set(key, c);
  return c;
}
function drawRider(x, y, k, o) {
  if (!SPR.ready) return drawRiderShapes(x, y, k, o);
  const cop = !!o.cop, f = spriteFrame(o, cop);
  const scale = SPR.UNITS_PER_M / SPR.PX * k * 1.05, w = SPR.FW * scale, h = SPR.FH * scale;
  if (w < 2) return;
  const src = cop ? null : tintedFrame(f, o.bike, o.jacket, o.helmet);
  ctx.save();
  ctx.translate(x, y); ctx.rotate((o.lean || 0) * 0.45 - (spriteFrame({ lean: o.lean }, false) - 2) * 0.15);
  if (src) ctx.drawImage(src, -w / 2, -h + SPR.FOOT * scale, w, h);
  else ctx.drawImage(SPR.img.police, (f % SPR.COLS) * SPR.FW, Math.floor(f / SPR.COLS) * SPR.FH, SPR.FW, SPR.FH, -w / 2, -h + SPR.FOOT * scale, w, h);
  const m = SPR.UNITS_PER_M * k * 1.05;
  if (o.brake) { ctx.fillStyle = 'rgba(255,60,40,0.55)'; ctx.beginPath(); ctx.ellipse(0, -(cop ? 0.85 : 0.76) * m, 0.12 * m, 0.05 * m, 0, 0, 7); ctx.fill(); }
  if (o.flame) { const f2 = (0.7 + Math.random() * 0.6) * m; ctx.fillStyle = Math.random() < 0.5 ? '#8fe0ff' : '#ffffff'; ctx.beginPath(); ctx.ellipse(0.24 * m, -0.38 * m, 0.035 * f2, 0.08 * f2, 0.4, 0, 7); ctx.fill(); }
  ctx.restore();
}

// The fallback: a rider and bike drawn with shapes, used until the rendered sprites load.
// Seen from behind and above, as in the classic bike-brawl games: a narrow,
// tall shape with a thin rear tyre, the dark engine and frame over it, a slim seat cowl, knees
// out and boots tucked up, and the rider leaning forward so you look down on their back with
// the helmet ahead of the shoulders. Police ride big tourers: fairing and screen, panniers and
// a white top box. Lit from the upper left; shadows fall to the right.
// u is a tenth of a world unit on screen (times RS); a rider is about 56u tall and 14u wide.
// o: { bike, jacket, helmet, lean, punch, kick, swing, back, side, weapon, brake, cop, flame }
function drawRiderShapes(x, y, k, o) {
  const side = o.side || 1, u = k * 10 * RS;
  if (u < 0.05) return;
  const cop = !!o.cop, suit = cop ? '#1f2024' : o.jacket, bikeC = cop ? '#1c1d21' : o.bike, panel = cop ? '#3a3c44' : o.helmet;
  const fine = u > 0.35;
  const M = (a, b) => ctx.moveTo(a * u, b * u), L = (a, b) => ctx.lineTo(a * u, b * u);
  const Q = (a, b, c, d) => ctx.quadraticCurveTo(a * u, b * u, c * u, d * u);
  const C = (a, b, c, d, e, f) => ctx.bezierCurveTo(a * u, b * u, c * u, d * u, e * u, f * u);
  const fill = (draw, style) => { ctx.beginPath(); draw(); ctx.closePath(); ctx.fillStyle = style; ctx.fill(); };
  const lg = (x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0 * u, y0 * u, x1 * u, y1 * u); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; };
  const oval = (cx, cy, rx, ry, style, rot) => { ctx.beginPath(); ctx.ellipse(cx * u, cy * u, rx * u, ry * u, rot || 0, 0, 7); ctx.fillStyle = style; ctx.fill(); };
  const rrect = (x0, y0, w, h, r, style) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 * u, y0 * u, w * u, h * u, r * u) : ctx.rect(x0 * u, y0 * u, w * u, h * u); ctx.fillStyle = style; ctx.fill(); };
  const stroke = (pts, w, style) => { ctx.strokeStyle = style; ctx.lineWidth = w * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0] * u, pts[1] * u); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * u, pts[i + 1] * u); ctx.stroke(); };
  const chrome = (x0, x1) => lg(x0, 0, x1, 0, [[0, '#4d525a'], [0.45, '#eef1f4'], [1, '#5a5f67']]);
  ctx.save(); ctx.translate(x, y); ctx.rotate((o.lean || 0) * 0.45);

  // shadow, cast down and to the right
  ctx.save(); ctx.transform(1, 0, 0.9, 1, 0, 0);
  oval(4, -1.5, cop ? 10 : 7.5, 2.4, 'rgba(10,10,20,0.32)');
  ctx.restore();
  oval(0, -0.3, cop ? 3.4 : 2.6, 0.9, 'rgba(0,0,0,0.5)');

  // rear tyre: a tall thin oval, darker at the sides
  const tw = cop ? 3.1 : 2.4;
  fill(() => { ctx.ellipse(0, -9.5 * u, tw * u, 10 * u, 0, 0, 7); }, lg(-tw, 0, tw, 0, [[0, '#060607'], [0.45, '#34363b'], [0.55, '#43464c'], [1, '#050506']]));
  if (fine) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let t = -17; t < -1; t += 1.6) ctx.fillRect(-tw * 0.7 * u, t * u, tw * 1.4 * u, 0.4 * u); }

  if (cop) {
    // panniers low either side of the wheel
    for (const s2 of [-1, 1]) {
      rrect(s2 > 0 ? 3.4 : -10.4, -24, 7, 12, 1.6, lg(s2 * 3, 0, s2 * 10, 0, [[0, '#cfd2d6'], [0.5, '#f4f5f6'], [1, '#9da1a6']]));
      rrect(s2 > 0 ? 3.4 : -10.4, -24, 7, 2.2, 1, '#26272b');
      if (fine) rrect(s2 > 0 ? 5 : -8.6, -18, 3.6, 1.2, 0.4, '#b0141a');
    }
    // the fairing and windscreen, wide behind the rider
    fill(() => { M(-11, -40); C(-11.5, -46, -8, -47.5, 0, -47.5); C(8, -47.5, 11.5, -46, 11, -40); L(8.5, -33); L(-8.5, -33); }, lg(-11, -47, 9, -33, [[0, '#4a4c54'], [0.4, '#1d1e22'], [1, '#0b0b0d']]));
    fill(() => { M(-7.5, -46.5); Q(0, -55, 7.5, -46.5); L(6.5, -45.5); Q(0, -52, -6.5, -45.5); }, 'rgba(150,165,180,0.45)');
    const ph = Math.floor(G.time * 7) % 2 === 0;
    oval(-9.5, -45.5, 1.4, 1, ph ? '#ff3b3b' : '#3b6cff'); oval(9.5, -45.5, 1.4, 1, ph ? '#3b6cff' : '#ff3b3b');
    for (const s2 of [-1, 1]) { stroke([9 * s2, -44, 12.5 * s2, -48], 0.5, '#1b1c20'); oval(13.3 * s2, -48.6, 1.8, 1.1, '#1b1c20'); }
  } else {
    // the engine and frame above the tyre: dark, with chrome showing at the sides
    fill(() => { M(-5.6, -27); L(5.6, -27); Q(6.4, -21, 5.2, -15.5); L(-5.2, -15.5); Q(-6.4, -21, -5.6, -27); }, lg(-6, 0, 6, 0, [[0, '#3a3c42'], [0.4, '#1f2024'], [1, '#121316']]));
    if (fine) {
      rrect(-6, -24, 2, 5, 0.8, chrome(-6, -4)); rrect(4, -24, 2, 5, 0.8, chrome(4, 6));
      stroke([-2.8, -15.5, -3.6, -8], 0.6, '#7d838b'); stroke([2.8, -15.5, 3.6, -8], 0.6, '#7d838b');
    }
    // exhaust can on the right
    ctx.save(); ctx.translate(5.6 * u, -13 * u); ctx.rotate(0.3);
    rrect(-1.3, -4, 2.6, 8, 1.2, chrome(-1.3, 1.3)); oval(0, 4, 1, 0.5, '#101113');
    ctx.restore();
    if (o.flame) { const f = (0.7 + Math.random() * 0.6) * u; ctx.fillStyle = Math.random() < 0.5 ? '#8fe0ff' : '#ffffff'; ctx.beginPath(); ctx.ellipse(7.2 * u, -8.5 * u, 1.2 * f, 3 * f, 0.3, 0, 7); ctx.fill(); }
    for (const s2 of [-1, 1]) { stroke([7.5 * s2, -40, 10 * s2, -43], 0.45, '#1b1c20'); oval(10.8 * s2, -43.5, 1.5, 0.9, shade(bikeC, s2 < 0 ? 1 : 0.6)); }
  }

  // legs: knees out beside the tank, shins back down to boots tucked up on the pegs
  const legC = shade(suit, 0.5), legLit = shade(suit, 0.75);
  for (const s2 of [-1, 1]) {
    if (o.kick && s2 === side) {
      stroke([3.5 * s2, -32, 11 * s2, -30, 19 * s2, -27], 3, legLit);
      oval(20.5 * s2, -26.8, 2.1, 1.5, '#111214');
      continue;
    }
    const kx = (cop ? 9.6 : 8.4) * s2;
    stroke([3.6 * s2, -33, kx, -30, 6.4 * s2, -22], 2.9, s2 < 0 ? legLit : legC);
    if (fine) stroke([kx - 0.6 * s2, -29.6, 6.9 * s2 + 0.2 * s2, -23.5], 0.6, 'rgba(255,255,255,0.15)');
    rrect(s2 > 0 ? 4.6 : -8.2, -23.6, 3.6, 3.8, 1, '#121315');
    if (fine) rrect(s2 > 0 ? 5 : -7.8, -23.2, 1, 2.6, 0.4, 'rgba(255,255,255,0.2)');
  }

  if (!cop) {
    // the seat cowl in the bike's colour, with the tail light and plate below it
    fill(() => { M(-4.6, -35); C(-4.9, -32, -4, -28.5, -3, -26.2); L(3, -26.2); C(4, -28.5, 4.9, -32, 4.6, -35); Q(0, -36, -4.6, -35); },
      lg(-4.5, -35, 4, -26, [[0, shade(bikeC, 1.45)], [0.45, bikeC], [1, shade(bikeC, 0.5)]]));
    if (fine) fill(() => { M(-3.9, -34.4); C(-4, -32, -3.4, -29, -2.6, -27.2); L(-2, -27.4); C(-2.8, -29.4, -3.2, -32, -3.1, -34.5); }, 'rgba(255,255,255,0.32)');
    if (o.brake) oval(0, -27.2, 5, 2, 'rgba(255,60,40,0.45)');
    rrect(-2.3, -28.2, 4.6, 1.6, 0.6, o.brake ? '#ff5a3a' : '#d8401c');
    rrect(-1.6, -26.1, 3.2, 1.8, 0.3, '#e7e2c8');
    oval(-3.6, -26.8, 0.7, 0.5, '#f0a028'); oval(3.6, -26.8, 0.7, 0.5, '#f0a028');
  }

  // arms to the bars (behind the body when riding)
  const fighting = o.punch || o.back || o.swing;
  const armC = s2 => shade(suit, s2 < 0 ? 0.95 : 0.65);
  const armDown = s2 => { stroke([5.2 * s2, cop ? -46 : -45.5, (cop ? 9.5 : 8.2) * s2, -41.5, (cop ? 8.8 : 7) * s2, -38.6], 2.5, armC(s2)); oval((cop ? 8.8 : 7) * s2, -38.4, 1.4, 1.2, '#131416'); };
  armDown(-side); if (!fighting) armDown(side);

  // the back: hips at the seat, a narrow waist, rounded shoulders; leaning forward, so the
  // shoulders sit high and the helmet higher still, just ahead of them
  const sh = cop ? -47 : -46.5, top = cop ? -49 : -48.5;
  fill(() => {
    M(-4.6, -33.8); C(-4.8, -37, -4.5, -40, -5.6, -43); C(-6.4, -45.2, -6.6, top + 0.6, -4.8, top);
    L(4.8, top); C(6.6, top + 0.6, 6.4, -45.2, 5.6, -43); C(4.5, -40, 4.8, -37, 4.6, -33.8); Q(0, -32.8, -4.6, -33.8);
  }, lg(-6, top, 5, -34, [[0, shade(suit, 1.4)], [0.5, suit], [1, shade(suit, 0.55)]]));
  // a contrast panel down one side and across the shoulders, as racing leathers have
  if (!cop) {
    fill(() => { M(1, top + 0.2); L(4.8, top); C(6.6, top + 0.6, 6.4, -45.2, 5.6, -43); C(4.6, -40, 4.8, -37, 4.6, -33.8); L(2.2, -33.4); C(2.8, -37, 2.2, -41, 1, top + 0.2); },
      lg(1, top, 6, -34, [[0, shade(panel, 1.15)], [1, shade(panel, 0.6)]]));
  } else if (fine) {
    fill(() => { M(-5.2, -40); L(5.2, -40); L(5, -38.8); L(-5, -38.8); }, 'rgba(220,225,90,0.8)');     // reflective band
  }
  if (fine) {
    oval(-2.6, top + 1.6, 2.4, 1, 'rgba(255,255,255,0.22)', -0.2);
    fill(() => { M(-0.5, top + 0.6); L(0.5, top + 0.6); L(0.4, -35); L(-0.4, -35); }, 'rgba(0,0,0,0.18)');
  }
  // helmet, just ahead of the shoulders
  const hy = cop ? -51.4 : -51;
  const hg = ctx.createRadialGradient(-1.2 * u, (hy - 1.6) * u, 0.3 * u, 0, hy * u, 3.6 * u);
  const hc = cop ? '#f2f3f5' : o.helmet;
  hg.addColorStop(0, shade(hc, 1.6)); hg.addColorStop(0.55, hc); hg.addColorStop(1, shade(hc, 0.45));
  oval(0, hy, 3.1, 3.3, hg);
  if (!cop) fill(() => { M(-0.6, hy - 3.2); L(0.6, hy - 3.2); L(0.7, hy + 3); L(-0.7, hy + 3); }, shade(suit, 1.1));
  oval(-1.1, hy - 1.4, 0.9, 0.5, 'rgba(255,255,255,0.7)', -0.5);

  // the fighting arm, over everything: straight out at shoulder height for a punch
  if (fighting) {
    const s2 = side, sx = 5 * s2, sy = sh;
    let hx, hy2;
    if (o.punch) { hx = 19 * s2; hy2 = sh - 1.5; stroke([sx, sy, 11 * s2, sy - 0.6, hx, hy2], 2.6, armC(-1)); }
    else if (o.back) { hx = 16 * s2; hy2 = -37; stroke([sx, sy, 11 * s2, -42, hx, hy2], 2.6, armC(-1)); }
    else {
      const a = -2.3 + o.swing * 3; hx = sx + Math.cos(a) * 11 * s2; hy2 = sy + Math.sin(a) * 11;
      stroke([sx, sy, sx + Math.cos(a) * 5.5 * s2, sy + Math.sin(a) * 5.5, hx, hy2], 2.6, armC(-1));
      if (o.weapon === 'club') stroke([hx, hy2, hx + Math.cos(a) * 11 * s2, hy2 + Math.sin(a) * 11], 1.6, '#7a4f2a');
      else { ctx.fillStyle = '#d4d7dc'; for (let i = 1; i <= 8; i++) { const b = a - i * 0.25; ctx.beginPath(); ctx.arc((hx + Math.cos(b) * i * 1.8 * s2) * u, (hy2 + Math.sin(b) * i * 1.8) * u, 0.55 * u, 0, 7); ctx.fill(); } }
    }
    oval(hx, hy2, 1.6, 1.4, '#131416');
  } else if (o.weapon === 'club') stroke([-4.5, -36, 5.5, -46], 1.4, '#7a4f2a');
  else if (o.weapon === 'chain' && fine) { ctx.strokeStyle = '#d4d7dc'; ctx.lineWidth = 0.55 * u; ctx.setLineDash([0.8 * u, 0.45 * u]); ctx.beginPath(); ctx.moveTo(7 * u, -38.4 * u); ctx.quadraticCurveTo(8.6 * u, -33 * u, 6.6 * u, -29.5 * u); ctx.stroke(); ctx.setLineDash([]); }

  if (cop) {
    // the top box sits behind the rider, over their lower back; red reflector and tail light
    rrect(-5.6, -37.5, 11.2, 10.5, 1.8, lg(-5.6, -37.5, 5.6, -27, [[0, '#fafbfc'], [0.5, '#dfe2e5'], [1, '#a5a9ae']]));
    rrect(-5.6, -37.5, 11.2, 2, 1, '#2a2b30');
    rrect(-2.4, -32.6, 4.8, 2.6, 0.5, o.brake ? '#ff4a3d' : '#b5141b');
    if (fine) rrect(-4, -28.6, 8, 0.8, 0.3, '#3a3b40');
    rrect(-1.6, -25.8, 3.2, 1.8, 0.3, '#e7e2c8');
  }
  ctx.restore();
}

// Your own bike in the chase view, drawn through the same projection as everyone else so
// riders level with you come out exactly your size.
function drawPlayerAt(cx, cy, k) {
  const B = bike();
  cy += Math.sin(G.time * 18) * (P.speed / MAXS) * 1.5;
  if (P.state === 'crash') {
    const t = 1.7 - P.crashT;
    ctx.save(); ctx.translate(cx + Math.sin(t * 8) * 200 * k, cy - Math.sin(Math.min(Math.PI, t * 3)) * 400 * k); ctx.rotate(t * 6);
    drawRider(0, 0, k, { bike: B.color, jacket: '#2c4fa0', helmet: '#f2c230' });
    ctx.restore();
    return;
  }
  if (Math.abs(P.x) > 1.02 && P.speed > MAXS * 0.08 && Math.random() < 0.6) fxScreen.push({ x: cx + (Math.random() - 0.5) * 300 * k, y: cy - 4, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 120, life: 0.4 + Math.random() * 0.4, c: 'rgba(150,130,100,0.5)', r: 5 + Math.random() * 6 });
  if (P.invuln > 0 && Math.floor(G.time * 12) % 2 === 0) ctx.globalAlpha = 0.5;
  drawRider(cx, cy, k, {
    bike: B.color, jacket: '#2c4fa0', helmet: '#f2c230', lean: P.lean * 0.7,
    punch: P.punchT > 0.08, kick: P.kickT > 0.1, back: P.backT > 0.08, swing: P.swingT > 0 ? 1 - P.swingT / 0.45 : 0, side: P.side,
    brake: brake() && P.speed > 200, flame: P.nitroT > 0, weapon: P.weapon,
  });
  ctx.globalAlpha = 1;
}

// The first-person view: the top of the fairing across the bottom of the screen, with a
// speedometer, a rev counter and a gear display. Your fist, boot or chain swings in from the
// side when you fight.
function drawCockpit() {
  const s = Math.min(W / 1280, H / 720) * 0.86, cx = W / 2;
  ctx.save();
  ctx.translate(cx, H); ctx.rotate(P.lean * 0.03);
  if (P.state === 'crash') ctx.translate(0, Math.sin(P.crashT * 9) * 30 * s);
  // attacks come in from the bottom corners, behind the fairing
  const t = P.punchT > 0 ? 1 - P.punchT / 0.28 : P.backT > 0 ? 1 - P.backT / 0.3 : P.swingT > 0 ? 1 - P.swingT / 0.45 : 0;
  if (t > 0) {
    const reach = Math.sin(Math.min(1, t * 1.6) * Math.PI / 2), sd = P.side;
    const fx = sd * (600 - 120 * reach) * s, fy = -(190 + 230 * reach) * s;
    ctx.strokeStyle = '#2c4fa0'; ctx.lineCap = 'round'; ctx.lineWidth = 64 * s;
    ctx.beginPath(); ctx.moveTo(sd * 900 * s, 140 * s); ctx.quadraticCurveTo(sd * 780 * s, -120 * s, fx, fy + 30 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 20 * s; ctx.stroke();
    ctx.fillStyle = '#141416'; ctx.beginPath(); ctx.ellipse(fx, fy, 42 * s, 37 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(fx - 12 * s, fy - 12 * s, 15 * s, 9 * s, -0.5, 0, 7); ctx.fill();
    if (P.swingT > 0) {
      if (P.weapon === 'club') { ctx.strokeStyle = '#7a4f2a'; ctx.lineWidth = 30 * s; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - sd * 140 * s, fy - 330 * s); ctx.stroke(); }
      else { ctx.fillStyle = '#cfd2d8'; for (let i = 1; i < 14; i++) { const a = -Math.PI / 2 - sd * (0.3 + i * 0.12) * (1 - t); ctx.beginPath(); ctx.arc(fx + Math.cos(a) * i * 26 * s * -sd, fy + Math.sin(a) * i * 26 * s, 9 * s, 0, 7); ctx.fill(); } }
    }
  }
  if (P.kickT > 0.05) { const sd = P.side; ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.ellipse(sd * 560 * s, -40 * s, 130 * s, 60 * s, sd * 0.2, 0, 7); ctx.fill(); }
  // the fairing: a wide black arch with a smoked screen edge and a glossy rim
  ctx.beginPath();
  ctx.moveTo(-470 * s, 20 * s);
  ctx.bezierCurveTo(-430 * s, -170 * s, -220 * s, -235 * s, 0, -238 * s);
  ctx.bezierCurveTo(220 * s, -235 * s, 430 * s, -170 * s, 470 * s, 20 * s);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, -240 * s, 0, 0);
  fg.addColorStop(0, '#3a3c42'); fg.addColorStop(0.25, '#17181b'); fg.addColorStop(1, '#0a0a0c');
  ctx.fillStyle = fg; ctx.fill();
  ctx.strokeStyle = 'rgba(200,205,215,0.35)'; ctx.lineWidth = 3 * s; ctx.stroke();
  ctx.fillStyle = 'rgba(40,48,60,0.45)';
  ctx.beginPath(); ctx.moveTo(-300 * s, -205 * s); ctx.bezierCurveTo(-180 * s, -262 * s, 180 * s, -262 * s, 300 * s, -205 * s); ctx.bezierCurveTo(180 * s, -228 * s, -180 * s, -228 * s, -300 * s, -205 * s); ctx.fill();
  // the instrument panel, set into the fairing
  ctx.fillStyle = '#0d0d0f';
  ctx.beginPath(); ctx.ellipse(0, -100 * s, 300 * s, 112 * s, 0, Math.PI, 0); ctx.lineTo(300 * s, 20 * s); ctx.lineTo(-300 * s, 20 * s); ctx.fill();
  const mph = P.speed / MAXS * 150;
  const gear = P.speed < 50 ? 1 : Math.min(6, 1 + Math.floor(mph / 32));
  const rpm = P.speed < 50 ? 1.2 : 3 + ((mph - (gear - 1) * 32) / 32) * 8.5;
  const dial = (dx, dy, r, val, max, step, label, red) => {
    const cx2 = dx * s, cy2 = dy * s, R = r * s;
    const bz = ctx.createLinearGradient(cx2 - R, cy2 - R, cx2 + R, cy2 + R);
    bz.addColorStop(0, '#d9dde2'); bz.addColorStop(0.5, '#6d737c'); bz.addColorStop(1, '#2a2d32');
    ctx.fillStyle = bz; ctx.beginPath(); ctx.arc(cx2, cy2, R + 9 * s, 0, 7); ctx.fill();
    const face = ctx.createRadialGradient(cx2 - R * 0.3, cy2 - R * 0.4, R * 0.1, cx2, cy2, R);
    face.addColorStop(0, '#fbf6e6'); face.addColorStop(1, '#d6ccb0');
    ctx.fillStyle = face; ctx.beginPath(); ctx.arc(cx2, cy2, R, 0, 7); ctx.fill();
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
    if (red) { ctx.strokeStyle = '#c8322a'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.arc(cx2, cy2, R * 0.86, a0 + span * red, a0 + span); ctx.stroke(); }
    ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= max + 1e-6; v += step / 2) {
      const a = a0 + span * v / max, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = (major ? 3 : 1.5) * s;
      ctx.beginPath(); ctx.moveTo(cx2 + Math.cos(a) * R * 0.92, cy2 + Math.sin(a) * R * 0.92); ctx.lineTo(cx2 + Math.cos(a) * R * (major ? 0.78 : 0.85), cy2 + Math.sin(a) * R * (major ? 0.78 : 0.85)); ctx.stroke();
      if (major) { ctx.font = 'bold ' + Math.round(R * 0.2) + 'px "Arial Narrow", Arial, sans-serif'; ctx.fillText(String(Math.round(v)), cx2 + Math.cos(a) * R * 0.6, cy2 + Math.sin(a) * R * 0.6); }
    }
    ctx.font = 'bold ' + Math.round(R * 0.15) + 'px "Arial Narrow", Arial, sans-serif'; ctx.fillText(label, cx2, cy2 - R * 0.3);
    const a = a0 + span * clamp(val / max, 0, 1.02);
    ctx.strokeStyle = '#d0201f'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx2 - Math.cos(a) * R * 0.15, cy2 - Math.sin(a) * R * 0.15); ctx.lineTo(cx2 + Math.cos(a) * R * 0.82, cy2 + Math.sin(a) * R * 0.82); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx2, cy2, R * 0.09, 0, 7); ctx.fill();
    // glass glare
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(cx2 - R * 0.3, cy2 - R * 0.45, R * 0.5, R * 0.2, -0.4, 0, 7); ctx.fill();
  };
  dial(-118, -98, 92, mph, 200, 50, 'MPH');
  dial(122, -88, 72, rpm, 12, 3, 'RPM x1000', 10 / 12);
  // gear display and warning lights between the dials
  ctx.fillStyle = '#1d2a22'; ctx.fillRect(-26 * s, -200 * s, 52 * s, 50 * s);
  ctx.fillStyle = '#9dff8a'; ctx.font = 'bold ' + Math.round(40 * s) + 'px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(gear), 0, -174 * s);
  const lamp = (lx, on, col) => { ctx.fillStyle = on ? col : '#2a2a2a'; ctx.beginPath(); ctx.arc(lx * s, -126 * s, 7 * s, 0, 7); ctx.fill(); };
  lamp(-12, P.nitroT > 0, '#4fd2ff'); lamp(12, P.hp < 35 || P.bikeHp < 35, '#ff9a2a');
  ctx.restore();
}

function speedLines() {
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, r0 = Math.min(W, H) * (0.42 + ((i * 37 + (G.time * 18 | 0) * 13) % 10) * 0.03);
    ctx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.46 + Math.sin(a) * r0 * 0.7);
    ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 120), H * 0.46 + Math.sin(a) * (r0 + 120) * 0.7);
  }
  ctx.stroke();
}

// ---------- heads-up display
function bar(x, y, w, h, frac, col, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#3a1414'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Arial Narrow", Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(label, x, y - 4); ctx.textBaseline = 'top'; }
}
function outlined(text, x, y, size, color, align) {
  ctx.font = size + 'px Impact, "Arial Black", "Arial Narrow", sans-serif'; ctx.textAlign = align || 'left';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function drawHUD() {
  if (G.state === 'menu') return;
  ctx.save(); ctx.textBaseline = 'top';
  const small = W < 700 || H < 500, fs = small ? 30 : 44;
  outlined(rankOf() + '/' + (16 + NET.peers.size), 18, 40, fs, '#ffd84a');
  outlined(fmtTime(G.raceT), W - 18, 14, fs * 0.8, '#ffd84a', 'right');
  // the nearest rider ahead, and how far
  let next = null;
  for (const o of rivals) if (o.pos > P.pos && (!next || o.pos < next.pos)) next = o;
  if (next) {
    const txt = next.name + '  ' + Math.round((next.pos - P.pos) / 20) + ' m';
    ctx.font = 'bold 16px "Arial Narrow", Arial, sans-serif'; const tw = ctx.measureText(txt).width + 24;
    ctx.fillStyle = 'rgba(20,30,50,0.65)'; ctx.fillRect(W / 2 - tw / 2, 10, tw, 28);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, 16);
  }
  drawMap(small);
  // health and bike condition, and whoever you hit last
  // the cockpit and the touch buttons both fill the bottom of the screen, so the gauges move up
  const cock = G.cam === 'cockpit', up = cock || Touch.on, bw = small ? 130 : 220, by = up ? (small ? 96 : 118) : H - 70;
  bar(18, by, bw, 10, P.hp / 100, '#4bd34b', 'RIDER');
  bar(18, by + 32, bw, 10, P.bikeHp / 100, '#e08a2a', 'BIKE');
  if (P.target) bar(W / 2 - 90, 48, 180, 8, P.target.hp / 100, P.target.color, P.target.name);
  if (!cock) {
    outlined(Math.round(P.speed / MAXS * 150) + ' MPH', up ? 18 : W - 18, up ? by + 50 : H - fs - 14, up ? 22 : fs * 0.8, '#ffd84a', up ? 'left' : 'right');
  }
  const wpn = P.weapon === 'club' ? 'CLUB x' + P.swings : 'CHAIN';
  outlined(wpn + (P.nitro ? '   NITRO ' + '|'.repeat(P.nitro) : ''), W - 18, up ? (small ? 150 : 204) : H - fs * 1.7 - 14, small ? 16 : 20, '#ff8a3a', 'right');
  // messages
  ctx.textAlign = 'center';
  G.msgs.forEach((m, i) => { ctx.globalAlpha = clamp(m.t, 0, 1); outlined(m.text, W / 2, H * 0.2 + i * 30, small ? 18 : 22, m.color, 'center'); });
  ctx.globalAlpha = 1;
  if (G.state === 'count') {
    const c = Math.ceil(G.countT - 0.4);
    if (c > 0 && c <= 3) outlined(String(c), W / 2, H * 0.32, Math.min(W, H) * 0.2, '#fff', 'center');
  }
  if (cops.some(c => c.state === 'chase' && Math.abs(c.pos - P.pos) < 4000)) {
    ctx.fillStyle = Math.floor(G.time * 4) % 2 ? 'rgba(255,40,40,0.18)' : 'rgba(40,90,255,0.18)';
    ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8);
  }
  if (Touch.on && (G.state === 'race' || G.state === 'count')) {
    const btns = touchButtons();
    for (const k in btns) {
      const b = btns[k];
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(b.r * 0.38) + 'px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.label, b.x, b.y);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawMap(small) {
  if (!mapBox || !mapPts.length) return;
  const bw = small ? 110 : 170, bh = small ? 90 : 130, x0 = W - bw - 18, y0 = small ? 50 : 62;
  ctx.fillStyle = 'rgba(15,20,30,0.78)'; ctx.fillRect(x0, y0, bw, bh);
  const s = Math.min((bw - 20) / Math.max(mapBox.w, 1), (bh - 20) / Math.max(mapBox.h, 1));
  const ox = x0 + (bw - mapBox.w * s) / 2, oy = y0 + (bh - mapBox.h * s) / 2;
  const at = z => { const i = clamp(Math.floor(z / SEG / 8), 0, mapPts.length - 1); return [ox + (mapPts[i][0] - mapBox.x0) * s, oy + (mapPts[i][1] - mapBox.y0) * s]; };
  ctx.strokeStyle = '#c9d6e0'; ctx.lineWidth = 2; ctx.beginPath();
  const last = Math.floor(finishZ / SEG / 8);
  mapPts.slice(0, last + 1).forEach(([px, py], i) => { const X = ox + (px - mapBox.x0) * s, Y = oy + (py - mapBox.y0) * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();
  const [fx, fy] = at(finishZ); ctx.fillStyle = '#fff'; ctx.fillRect(fx - 3, fy - 3, 6, 6);
  for (const o of rivals) { const [rx, ry] = at(o.pos); ctx.fillStyle = o.color; ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3); }
  for (const p of NET.peers.values()) if (p.s) { const [rx, ry] = at(p.rpos); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(rx, ry, 3, 0, 7); ctx.fill(); }
  for (const c of cops) if (c.state === 'chase') { const [rx, ry] = at(c.pos); ctx.fillStyle = '#5b8cff'; ctx.fillRect(rx - 2, ry - 2, 4, 4); }
  const [px, py] = at(P.pos); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill();
}

// ---------- menus, as HTML over the road
const UI = document.getElementById('ui');
function showUI(html) { UI.innerHTML = html; UI.hidden = false; const f = UI.querySelector('.go') || UI.querySelector('button'); if (f && f.focus) f.focus(); }
function hideUI() { UI.hidden = true; UI.innerHTML = ''; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function showTitle() {
  G.state = 'menu';
  showUI('<div class="panel title"><h1>Highway Brawl</h1><p class="sub">Race fifteen riders across five roads. Punch, kick and swing your chain to get ahead, and keep clear of the police.</p>' +
    '<div class="stats"><span>Level <b>' + G.level + '</b> of ' + LEVELS + '</span><span>Cash <b>' + money(G.cash) + '</b></span><span>Bike <b>' + esc(bike().name) + '</b></span></div>' +
    '<div class="menu"><button class="go" data-act="career">Race</button><button data-act="online">Race friends online</button><button data-act="garage">Bike shop</button><button data-act="help">How to play</button></div>' +
    (G.champion ? '<p class="note">You are the champion. Keep racing for money and records.</p>' : '') + '</div>');
}
function showCareer() {
  G.state = 'menu';
  const rows = TRACKS.map((t, i) => {
    const q = G.qual[qualKey(G.level, t.id)];
    return '<button class="track' + (q ? ' done' : '') + '" data-act="race" data-i="' + i + '"><b>' + esc(t.name) + '</b><span>' + esc(t.blurb) + '</span><i>' +
      (q ? 'Qualified, ' + ordinal(q) : 'Finish in the top 3 to qualify') + (G.best[t.id] ? ' · best ' + fmtTime(G.best[t.id]) : '') + (t.police || G.level >= 3 ? ' · police' : '') + '</i></button>';
  }).join('');
  const done = TRACKS.filter(t => G.qual[qualKey(G.level, t.id)]).length;
  showUI('<div class="panel"><h2>Level ' + G.level + '</h2><p class="sub">Qualify on all five roads to move up a level. Riders get faster each level, and so does the prize money. ' + done + ' of 5 qualified.</p>' +
    '<div class="tracks">' + rows + '</div><div class="menu row"><button data-act="garage">Bike shop</button><button data-act="title">Back</button></div></div>');
}
function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'); }
function statBar(v, lo, hi) { return '<span class="sb"><i style="width:' + Math.round(clamp((v - lo) / (hi - lo), 0.05, 1) * 100) + '%"></i></span>'; }
function showGarage() {
  G.state = 'menu';
  const rows = BIKES.map((b, i) => {
    const own = G.owned.includes(i), cur = G.bike === i;
    const btn = cur ? '<em>Riding</em>' : own ? '<button data-act="ride" data-i="' + i + '">Ride</button>' : '<button data-act="buy" data-i="' + i + '"' + (G.cash < b.cost ? ' disabled' : '') + '>Buy ' + money(b.cost) + '</button>';
    return '<div class="bike' + (cur ? ' cur' : '') + '"><span class="sw" style="background:' + b.color + '"></span><div><b>' + esc(b.name) + '</b><small>' + b.cls + (b.nitro ? ', ' + b.nitro + ' nitro' : '') + '</small></div>' +
      '<div class="bars"><label>Speed ' + statBar(b.top, 0.8, 1.35) + '</label><label>Accel ' + statBar(b.acc, 0.85, 1.8) + '</label><label>Grip ' + statBar(b.grip, 0.9, 1.4) + '</label><label>Tough ' + statBar(b.tough, 0.75, 1.2) + '</label></div>' + btn + '</div>';
  }).join('');
  showUI('<div class="panel wide"><h2>Bike shop</h2><p class="sub">Cash ' + money(G.cash) + '. Rat bikes are cheap, sport bikes are quick, and super bikes carry nitro. Tough bikes survive more crashes.</p><div class="bikes">' + rows + '</div><div class="menu row"><button class="go" data-act="career">Race</button><button data-act="title">Back</button></div></div>');
}
function buyBike(i) {
  const b = BIKES[i];
  if (!b || G.owned.includes(i) || G.cash < b.cost) return false;
  G.cash -= b.cost; G.owned.push(i); G.bike = i; save();
  return true;
}
function showHelp() {
  showUI('<div class="panel"><h2>How to play</h2><table class="keys">' +
    [['Throttle / brake', 'W S or up / down'], ['Steer', 'A D or left / right'], ['Punch', 'Space or J'], ['Kick (shoves riders off the road)', 'E or K'], ['Swing chain or club', 'F, L or Shift'], ['Backhand a rider beside or behind', 'Q or G'],
      ['Nitro (super bikes)', 'N'], ['First-person or chase view', 'C'], ['Pause', 'Esc or P'], ['Restart', 'R'], ['Sound', 'M']].map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('') +
    '</table><p class="sub">Punch a rider while they wind up a club and you take it from them. Knock riders down for a bonus. If you crash with the police chasing you, you\'re busted and fined. Crash too often and the bike is wrecked, and you pay for repairs.</p>' +
    '<p class="sub">Race friends online from the title screen: two to four riders on the same road, hitting each other as well as the pack.</p><p class="sub">A gamepad works too: right trigger to go, left trigger to brake, A punch, B kick, X chain, Y backhand, RB nitro. On a phone, throttle is automatic.</p>' +
    '<div class="menu row"><button class="go" data-act="title">Back</button></div></div>');
}
function showPause() {
  showUI('<div class="panel small"><h2>Paused</h2><div class="menu"><button class="go" data-act="resume">Keep racing</button><button data-act="restart">Restart</button><button data-act="quit">Quit race</button></div></div>');
}
function showResults() {
  const r = G.result;
  const head = r.how === 'busted' ? 'Busted!' : r.how === 'wrecked' ? 'Bike wrecked!' : r.place <= 3 ? ordinal(r.place) + ' place. Qualified!' : ordinal(r.place) + ' place';
  const lines = [];
  if (r.how === 'finished') lines.push('Time ' + fmtTime(r.time) + (r.record ? ', a new best' : ''), 'Prize ' + money(r.prize));
  if (r.bonus) lines.push((r.champion ? 'Champion\'s bonus and knockdowns ' : 'Knockdown bonus ') + money(r.bonus));
  if (r.fine) lines.push('Police fine ' + money(r.fine));
  if (r.how === 'busted' && !r.fine) lines.push('No cash to fine. They let you off with a warning.');
  if (r.repair) lines.push('Repairs ' + money(r.repair));
  if (r.levelUp) lines.push('All five roads qualified. Welcome to level ' + G.level + '!');
  if (r.champion) lines.push('You beat every road on the top level. Champion!');
  // the top eight, plus your own line if you finished further back
  const rowOf = (f, i) => '<tr' + (f.you ? ' class="you"' : '') + '><td>' + (i + 1) + '</td><td><i style="background:' + f.color + '"></i>' + esc(f.name) + '</td><td>' + (isFinite(f.time) ? fmtTime(f.time) : '-') + '</td></tr>';
  const youAt = r.field.findIndex(f => f.you);
  const table = r.field.slice(0, 8).map(rowOf).join('') + (youAt >= 8 ? '<tr class="gap"><td colspan="3">…</td></tr>' + rowOf(r.field[youAt], youAt) : '');
  showUI('<div class="panel"><h2>' + head + '</h2><p class="sub">' + lines.map(esc).join('<br>') + '</p><p class="sub">Cash ' + money(G.cash) + '</p>' +
    '<table class="field">' + table + '</table><div class="menu row"><button class="go" data-act="career">Next race</button><button data-act="restart">Race again</button><button data-act="garage">Bike shop</button></div></div>');
}
UI.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  Snd.init();
  const act = b.dataset.act, i = +b.dataset.i;
  if (act === 'title') showTitle();
  else if (act === 'career') showCareer();
  else if (act === 'garage') showGarage();
  else if (act === 'help') showHelp();
  else if (act === 'race') resetRace(i);
  else if (act === 'buy') { buyBike(i); showGarage(); }
  else if (act === 'ride') { G.bike = i; save(); showGarage(); }
  else if (act === 'resume') resume();
  else if (act === 'restart') resetRace(G.track);
  else if (act === 'quit') { G.state = 'menu'; showCareer(); }
  else if (act === 'online') openLobby();
  else if (act === 'netroad' && NET.room && NET.room.isHost) hostStart(i);
  else if (act === 'netnext' && NET.room && NET.room.isHost) showNetWait();
  else if (act === 'netinvite' && lobby) { hideUI(); G.state = 'lobby'; lobby.reopen(); }
  else if (act === 'netleave') leaveOnline('You left the online race.');
});

// ---------- racing friends online
// Two to four players connect with LinkPlay (browser to browser, no server). The host picks the
// road and everyone races it with the host's level, so the road, the pack, the police and the
// traffic start out the same everywhere. Each browser runs its own bike and sends where it is
// about 13 times a second; hits on another player are sent to them and applied on their side.
// Online races never touch anyone's saved career.
const NET = { room: null, keep: null, peers: new Map(), finish: [], results: [], sentAt: 0, race: 0, offset: 0, bestRtt: Infinity, pingAt: 0 };
// One clock for everyone: the host's. Each other player pings the host and keeps the offset from
// the quickest round trip, so every message can say when it was sent and the receiver knows how
// old it is, network delay and all.
const netNow = () => performance.now() + NET.offset;
const ageOf = ts => (typeof ts === 'number' && (NET.room && (NET.room.isHost || NET.bestRtt < Infinity)) ? clamp((netNow() - ts) / 1000, 0, 3) : 0);
let lobby = null;
const online = () => !!NET.room;

function openLobby() {
  hideUI();
  G.state = 'lobby';
  if (lobby) { lobby.start(); return; }
  lobby = Lobby.mount(document.getElementById('lobby'), {
    game: 'highway-brawl', noun: 'race', title: 'Race friends online',
    blurb: 'Two to four riders on the same road, with the pack, the police and the traffic. Fight each other as much as the rest. The host picks the road.',
    min: 2, max: 4,
    extra: [{ label: 'Back to the career', note: 'Your saved level, cash and bikes are untouched online.', onClick: () => showTitle() }],
    onStart: attachRoom, onJoin: attachRoom,
  });
}
function attachRoom(room) {
  NET.room = room; NET.peers.clear(); NET.finish = []; NET.results = [];
  NET.offset = 0; NET.bestRtt = Infinity; NET.pingAt = 0;
  if (!NET.keep) NET.keep = { level: G.level };
  room.on('message', onNet);
  room.on('roster', syncPeers);
  room.on('leave', id => { NET.peers.delete(id); if (room.isHost) hostResults(); });
  room.on('close', () => leaveOnline('The host closed the race.'));
  syncPeers();
  showNetWait();
}
function syncPeers() {
  if (!NET.room) return;
  for (const pl of NET.room.players) {
    if (pl.id === NET.room.me) continue;
    const p = NET.peers.get(pl.id) || { s: null, rpos: 0, rx: 0, t: 0 };
    p.name = pl.name; p.color = pl.color;
    NET.peers.set(pl.id, p);
  }
  for (const id of [...NET.peers.keys()]) if (!NET.room.players.some(pl => pl.id === id)) NET.peers.delete(id);
  if (G.state === 'netwait') showNetWait();
}
function netSend(m) { if (!NET.room) return; m.id = NET.room.me; NET.room.send(m); }
function onNet(m, from) {
  const room = NET.room;
  if (!room || !m || typeof m !== 'object') return;
  // the host passes guests' messages on to everyone
  if (room.isHost && from) {
    if (m.t === 'aiatk') { if (G.state === 'race') packAttackFrom(from, m); return; }
    if (m.t === 'ping') { room.sendTo(from, { t: 'pong', c: m.c, h: performance.now() }); return; }
    if (m.t !== 'st' && m.t !== 'hit' && m.t !== 'fin') return;
    m.id = from; room.send(m);
  }
  if (!room.isHost && !from && m.t === 'ai') { if (G.state === 'count' || G.state === 'race' || G.state === 'over') takePack(m); return; }
  if (!room.isHost && (m.t === 'aihit' || m.t === 'aidown' || m.t === 'aiclub')) { if (m.to === room.me && G.state === 'race') takePackNote(m); return; }
  if (m.t === 'pong') {
    if (!room.isHost && typeof m.c === 'number' && typeof m.h === 'number') {
      const rtt = performance.now() - m.c;
      // the quickest round trip gives the best estimate; let it age so a changing network is followed
      NET.bestRtt = Math.min(NET.bestRtt * 1.02, rtt);
      if (rtt <= NET.bestRtt + 1) NET.offset = m.h + rtt / 2 - performance.now();
    }
    return;
  }
  if (m.t === 'go') { if (!room.isHost) startOnline(m); return; }
  if (m.t === 'res') { if (!room.isHost) { NET.results = Array.isArray(m.list) ? m.list : []; if (G.state === 'over') showNetResults(); } return; }
  if (m.id === room.me) return;
  if (m.t === 'st') {
    const p = NET.peers.get(m.id);
    if (!p || m.n !== NET.race) return;
    if (!p.s || Math.abs(m.pos - p.rpos) > 4000) { p.rpos = +m.pos || 0; p.rx = +m.x || 0; }
    p.s = m; p.t = G.time;
  } else if (m.t === 'hit' && m.to === room.me) takeHit(m);
  else if (m.t === 'fin' && room.isHost) hostFinish(m.id, m.time, m.place);
}
function hostStart(track) {
  const m = { t: 'go', track: clamp(track | 0, 0, TRACKS.length - 1), level: NET.keep.level, n: NET.race + 1, ts: Math.round(netNow()) };
  NET.finish = []; NET.results = [];
  NET.room.send(m);
  startOnline(m);
}
function startOnline(m) {
  NET.race = m.n | 0;
  // start the countdown as far along as the host's already is
  const late = NET.room && !NET.room.isHost ? ageOf(m.ts) : 0;
  G.level = clamp(m.level | 0, 1, LEVELS);
  NET.finish = []; NET.results = [];
  for (const p of NET.peers.values()) { p.s = null; p.rpos = 0; p.rx = 0; p.done = false; }
  resetRace(clamp(m.track | 0, 0, TRACKS.length - 1));
  G.countT -= late; G.trafT += late;
}
function netTick(dt) {
  const k = 1 - Math.exp(-8 * dt);
  for (const p of NET.peers.values()) {
    if (!p.s) continue;
    // they keep moving at their last speed; where they should be now is where they were when
    // they sent it, plus how far they've gone since; only the difference is eased away
    const moving = p.s.st === 'ride' && G.state === 'race';
    if (moving) p.rpos += p.s.sp * dt;
    const want = p.s.pos + (moving ? p.s.sp * ageOf(p.s.ts) : 0);
    p.rpos += Math.abs(want - p.rpos) > 4000 ? want - p.rpos : (want - p.rpos) * k;
    p.rx += (p.s.x - p.rx) * k;
  }
  // everyone but the host keeps their clock in step with the host's
  if (!NET.room.isHost && G.time - NET.pingAt > (NET.bestRtt === Infinity ? 0.25 : 1)) { NET.pingAt = G.time; netSend({ t: 'ping', c: performance.now() }); }
  if ((G.state === 'count' || G.state === 'race' || G.state === 'over') && G.time - NET.sentAt > 0.1 && NET.room.buffered() < 4000) {
    NET.sentAt = G.time;
    netSend({ t: 'st', n: NET.race, ts: Math.round(netNow()), pos: Math.round(P.pos), x: +P.x.toFixed(3), sp: Math.round(P.speed), st: P.state, hp: Math.round(P.hp),
      ln: +P.lean.toFixed(2), pu: P.punchT > 0.08 ? 1 : 0, ki: P.kickT > 0.1 ? 1 : 0, ba: P.backT > 0.08 ? 1 : 0,
      sw: P.swingT > 0 ? +(1 - P.swingT / 0.45).toFixed(2) : 0, sd: P.side, wp: P.weapon, b: G.bike, done: P.finished ? 1 : 0 });
  }
}
// your hit landed on another player: they take it on their own screen
function hitPeer(t, kind) {
  let dmg = kind === 'kick' ? 9 : kind === 'back' ? 18 : kind === 'swing' ? (P.weapon === 'club' ? 40 : 26) : 16;
  if (kind === 'swing' && P.weapon === 'club' && --P.swings <= 0) { P.weapon = 'chain'; msg('The club broke. Back to the chain.', '#c8c8c8'); }
  netSend({ t: 'hit', to: t.peer, kind, dmg, side: P.side });
  Snd.thud(kind === 'swing' ? 0.3 : 0.22);
  G.shake = Math.max(G.shake, 0.14);
  sparkWorld(t.pos, t.off, kind === 'swing' ? '#d8d8d8' : '#f2b32a', 8);
}
function takeHit(m) {
  if (G.state !== 'race' || P.state !== 'ride' || P.invuln > 0) return;
  const p = NET.peers.get(m.id), who = p ? p.name : 'Someone', kind = String(m.kind);
  P.hp -= clamp(+m.dmg || 0, 0, 40);
  P.x += (Math.sign(+m.side) || 1) * (kind === 'kick' ? 0.5 : 0.09);
  P.speed *= kind === 'kick' ? 0.9 : 0.94;
  G.shake = Math.max(G.shake, 0.3);
  Snd.thud(0.24);
  msg(who + (kind === 'kick' ? ' kicked you!' : kind === 'swing' ? ' hit you with a chain!' : ' punched you!'), p ? p.color : '#ff9b8a', 1.6);
  sparkScreen(W / 2 - (Math.sign(+m.side) || 1) * 40, H - 160, p ? p.color : '#ff6b5b', 8, 380);
  if (P.hp <= 0) { P.hp = 0; crashPlayer('Knocked off by ' + who + '!', 8); }
  else if (kind === 'kick' && Math.abs(P.x) > 1.15) crashPlayer(who + ' kicked you off the road!', 10);
}
function finishOnline() {
  P.finished = true;
  const time = Math.round(G.raceT * 100) / 100, place = rankOf();
  G.state = 'over';
  netSend({ t: 'fin', time, place });
  if (NET.room.isHost) hostFinish(NET.room.me, time, place);
  showNetResults();
}
function hostFinish(id, time, place) {
  if (!NET.finish.some(f => f.id === id)) NET.finish.push({ id, time: +time || 0, place: +place || 0 });
  hostResults();
}
function hostResults() {
  const room = NET.room;
  if (!room || !room.isHost) return;
  const done = NET.finish.filter(f => room.players.some(p => p.id === f.id)).sort((a, b) => a.time - b.time);
  const list = done.map(f => ({ id: f.id, time: f.time, place: f.place }));
  for (const p of room.players) if (!done.some(f => f.id === p.id)) list.push({ id: p.id, time: 0, place: 0 });
  for (const r of list) { const p = room.players.find(x => x.id === r.id); r.name = p ? p.name : '?'; r.color = p ? p.color : '#fff'; }
  NET.results = list;
  room.send({ t: 'res', list });
  if (G.state === 'over') showNetResults();
}
function leaveOnline(text) {
  if (!NET.room) return;
  const room = NET.room;
  NET.room = null;
  try { room.close(); } catch (e) { }
  if (lobby) { try { lobby.leave(); } catch (e) { } }
  NET.peers.clear(); NET.finish = []; NET.results = [];
  if (NET.keep) { G.level = NET.keep.level; NET.keep = null; }
  showTitle();
  if (text) msg(text, '#ffd84a', 4);
}
// other players on the road: the same rendered riders, in their own colour, with their name
function drawPeer(x, y, k, e, n) {
  const p = e.p, s = p.s;
  if (s.st === 'crash') { drawOther(x, y, k, { state: 'down', bikeC: BIKES[s.b | 0] ? BIKES[s.b | 0].color : '#888888', color: p.color, helmet: '#f2f2f2' }, n, false); return; }
  const side = Math.sign(+s.sd || 1);
  drawRider(x, y, k, { bike: BIKES[s.b | 0] ? BIKES[s.b | 0].color : '#888888', jacket: p.color, helmet: '#f2f2f2', lean: +s.ln * 0.7 || 0,
    punch: !!s.pu, kick: !!s.ki, back: !!s.ba, swing: +s.sw || 0, side, weapon: s.wp === 'club' ? 'club' : 'chain' });
  if (n < 40 && k > 0.03) {
    ctx.font = 'bold ' + clamp(120 * k, 11, 24) + 'px Impact, "Arial Narrow", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(p.name, x, y - 430 * k);
    ctx.fillStyle = p.color; ctx.fillText(p.name, x, y - 430 * k);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 60 * k * 2, y - 410 * k, 120 * k * 2, 10 * k * 2);
    ctx.fillStyle = p.color; ctx.fillRect(x - 60 * k * 2, y - 410 * k, 120 * k * 2 * clamp((+s.hp || 0) / 100, 0, 1), 10 * k * 2);
  }
}
function showNetWait() {
  G.state = 'netwait';
  const room = NET.room;
  if (!room) return;
  const names = room.players.map(p => '<span style="color:' + p.color + '">' + esc(p.name) + (p.id === room.me ? ' (you)' : '') + '</span>').join(', ');
  if (room.isHost) {
    const rows = TRACKS.map((t, i) => '<button class="track" data-act="netroad" data-i="' + i + '"><b>' + esc(t.name) + '</b><span>' + esc(t.blurb) + '</span></button>').join('');
    showUI('<div class="panel"><h2>Pick a road</h2><p class="sub">Riding: ' + names + '. Everyone races at your level, ' + G.level + '.</p><div class="tracks">' + rows + '</div><div class="menu row"><button data-act="netinvite">Invite more</button><button data-act="netleave">Leave</button></div></div>');
  } else {
    showUI('<div class="panel small"><h2>Connected</h2><p class="sub">Riding: ' + names + '.</p><p class="sub">Waiting for the host to pick a road.</p><div class="menu row"><button data-act="netleave">Leave</button></div></div>');
  }
}
function showNetResults() {
  const room = NET.room;
  if (!room) return;
  const mine = NET.results.find(r => r.id === room.me);
  const ranked = NET.results.filter(r => r.place).sort((a, b) => a.time - b.time);
  const pos = mine && mine.place ? ranked.findIndex(r => r.id === room.me) + 1 : 0;
  const rows = NET.results.slice().sort((a, b) => (a.time || 1e9) - (b.time || 1e9)).map(r => '<tr' + (r.id === room.me ? ' class="you"' : '') + '><td>' + (r.place ? ordinal(r.place) : '') + '</td><td><i style="background:' + r.color + '"></i>' + esc(r.name) + (r.id === room.me ? ' (you)' : '') + '</td><td>' + (r.place ? fmtTime(r.time) : 'still racing') + '</td></tr>').join('');
  const head = pos === 1 ? 'You beat your friends!' : pos ? ordinal(pos) + ' of your group' : 'Finished';
  showUI('<div class="panel"><h2>' + head + '</h2><p class="sub">Places are out of the whole field of ' + (16 + NET.peers.size) + ' riders.</p><table class="field">' + rows + '</table>' +
    '<div class="menu row">' + (room.isHost ? '<button class="go" data-act="netnext">Next race</button>' : '<span class="sub">The host starts the next race.</span>') + '<button data-act="netleave">Leave</button></div></div>');
}

// ---------- the pack online
// The host runs the fifteen riders and the police for everyone and sends where they all are ten
// times a second. Other screens follow along, carrying each rider forward at their speed between
// updates. A hit from another player goes to the host, which applies it and says if it put the
// rider down; the host's riders and officers hit other players by message.
// Each rider packs into 7 bytes: position (in steps of 2 units), sideways offset, speed, health,
// and a byte of flags for down, punching or swinging, and weapon. Officers the same. About 200
// bytes for the whole pack, so it keeps flowing on a slow connection.
const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function packBytes(list, cop) {
  let out = '';
  const bytes = [];
  for (const o of list) {
    const pos = clamp(Math.round(o.pos / 2), 0, 0xffffff), off = clamp(Math.round(o.off * 60) + 128, 0, 255);
    const sp = clamp(Math.round(o.speed / 64), 0, 255), hp = clamp(Math.round(o.hp), 0, 255);
    const st = cop ? (o.state === 'chase' ? 1 : o.state === 'down' ? 2 : 0) : (o.state === 'down' ? 1 : 0);
    const pose = o.punchT > 0 ? 1 : o.swingT > 0 ? 2 : 0, w = o.weapon === 'club' ? 1 : o.weapon === 'chain' ? 2 : 0;
    bytes.push(pos >> 16, (pos >> 8) & 255, pos & 255, off, sp, hp, st | pose << 2 | w << 4);
  }
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64U[n >> 18] + B64U[(n >> 12) & 63] + B64U[(n >> 6) & 63] + B64U[n & 63];
  }
  return out;
}
function unpackBytes(str, count) {
  const bytes = [];
  for (let i = 0; i + 3 < str.length + 3 && i < str.length; i += 4) {
    const n = (B64U.indexOf(str[i]) << 18) | (B64U.indexOf(str[i + 1]) << 12) | (B64U.indexOf(str[i + 2]) << 6) | B64U.indexOf(str[i + 3]);
    bytes.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  const out = [];
  for (let k = 0; k < count && k * 7 + 6 < bytes.length; k++) {
    const b = bytes.slice(k * 7, k * 7 + 7);
    out.push({ pos: ((b[0] << 16) | (b[1] << 8) | b[2]) * 2, off: (b[3] - 128) / 60, speed: b[4] * 64, hp: b[5], st: b[6] & 3, pose: (b[6] >> 2) & 3, w: (b[6] >> 4) & 3 });
  }
  return out;
}
function sendPack() {
  // six times a second, and never on top of a backlog: if the last one hasn't gone out yet, wait
  if (G.time - (NET.packAt || 0) < 1 / 6 || NET.room.buffered() > 4000) return;
  NET.packAt = G.time;
  const fin = [];
  rivals.forEach((o, i) => { if (o.finishT) fin.push(i, +o.finishT.toFixed(2)); });
  NET.room.send({ t: 'ai', n: NET.race, ts: Math.round(netNow()), rt: +G.raceT.toFixed(2), tt: +G.trafT.toFixed(2), r: packBytes(rivals), c: packBytes(cops, true), f: fin });
}
function takePack(m) {
  if (m.n !== NET.race || typeof m.r !== 'string') return;
  const age = ageOf(m.ts);
  unpackBytes(m.r, rivals.length).forEach((a, i) => {
    const o = rivals[i];
    o.net = { pos: a.pos, off: a.off, speed: a.speed, t: G.time - age };
    o.hp = a.hp;
    if (a.st === 1 && o.state !== 'down') { o.state = 'down'; o.downT = 4; if (o.hitByMe && G.time - o.hitByMe < 1.5) { P.knocks = (P.knocks || 0) + 1; sparkWorld(o.pos, o.off, '#f2b32a', 16); } }
    else if (a.st !== 1) o.state = 'ride';
    if (a.pose === 1) o.punchT = Math.max(o.punchT, 0.2); else if (a.pose === 2 && !o.swingT) o.swingT = 0.45;
    o.weapon = a.w === 1 ? 'club' : a.w === 2 ? 'chain' : null;
  });
  const fin = Array.isArray(m.f) ? m.f : [];
  for (let i = 0; i + 1 < fin.length; i += 2) { const o = rivals[fin[i] | 0]; if (o && typeof fin[i + 1] === 'number') o.finishT = fin[i + 1]; }
  if (typeof m.c === 'string') unpackBytes(m.c, cops.length).forEach((a, i) => {
    const c = cops[i];
    c.isCop = true;
    c.net = { pos: a.pos, off: a.off, speed: a.speed, t: G.time - age };
    c.hp = a.hp;
    const st = a.st === 1 ? 'chase' : a.st === 2 ? 'down' : 'patrol';
    if (st === 'chase' && c.state !== 'chase' && Math.abs(c.net.pos - P.pos) < 2500) msg('Police! Lose them, and don\'t crash.', '#9fc3ff');
    c.state = st;
    if (a.pose === 2 && !c.swingT) c.swingT = 0.4;
  });
  // keep the race clock and the traffic clock in step with the host's
  if (typeof m.rt === 'number' && G.state === 'race' && NET.bestRtt < Infinity) G.raceT += (m.rt + age - G.raceT) * 0.3;
  if (typeof m.tt === 'number' && NET.bestRtt < Infinity) G.trafT += (m.tt + age - G.trafT) * 0.3;
}
function followPack(dt) {
  const k = 1 - Math.exp(-6 * dt);
  for (const o of rivals.concat(cops)) {
    o.punchT = Math.max(0, (o.punchT || 0) - dt); o.swingT = Math.max(0, (o.swingT || 0) - dt);
    if (!o.net) continue;
    const want = o.net.pos + o.net.speed * Math.min(3, G.time - o.net.t);
    o.speed = o.net.speed;
    o.pos += o.speed * dt;
    o.pos += Math.abs(want - o.pos) > 3000 ? want - o.pos : (want - o.pos) * k;
    o.off += (o.net.off - o.off) * k;
  }
}
// your hit on a rider or officer, when someone else is the host: show it now, let the host decide
function hitPackRemote(o, kind) {
  const [dmg, shove] = hitStrength(kind);
  const cop = !!o.isCop, i = cop ? cops.indexOf(o) : rivals.indexOf(o);
  if (i < 0) return;
  o.hp -= dmg; o.off += P.side * shove; o.hitByMe = G.time;
  if (!cop) { P.target = o; P.targetT = 4; }
  Snd.thud(kind === 'swing' ? 0.3 : 0.22);
  G.shake = Math.max(G.shake, 0.14);
  sparkWorld(o.pos, o.off, kind === 'swing' ? '#d8d8d8' : '#f2b32a', kind === 'swing' ? 10 : 6);
  netSend({ t: 'aiatk', i, cop: cop ? 1 : 0, kind, dmg, shove, side: P.side });
}
// on the host: another player's hit on the pack
function packAttackFrom(from, m) {
  const list = m.cop ? cops : rivals, o = list[m.i | 0];
  if (!o || o.state === 'down' || o.finishT) return;
  const kind = ['punch', 'kick', 'back', 'swing'].includes(m.kind) ? m.kind : 'punch';
  if (kind === 'punch' && o.weapon === 'club' && o.swingT > 0) {
    o.weapon = null; o.swingT = 0;
    NET.room.send({ t: 'aiclub', to: from, i: m.i | 0, id: 0 });
    return;
  }
  const club = o.weapon === 'club';
  const down = packHit(o, kind, clamp(+m.dmg || 0, 0, 40), clamp(+m.shove || 0, 0, 0.5), Math.sign(+m.side) || 1);
  if (down) {
    o.state = 'down'; o.downT = 3.2 + Math.random();
    if (club) o.weapon = null;
    NET.room.send({ t: 'aidown', to: from, i: m.i | 0, cop: m.cop ? 1 : 0, why: down, club: club ? 1 : 0, id: 0 });
  }
}
function takePackNote(m) {
  const o = (m.cop ? cops : rivals)[m.i | 0];
  if (!o) return;
  if (m.t === 'aihit') { hitPlayer(o, clamp(+m.dmg || 0, 0, 40)); return; }
  if (m.t === 'aiclub') { if (P.weapon !== 'club') { P.weapon = 'club'; P.swings = 8; o.weapon = null; msg('Grabbed ' + o.name + "'s club!", '#ffd84a'); Snd.clink(0.2); } return; }
  // aidown: your hit put them down
  P.knocks = (P.knocks || 0) + 1;
  msg(String(m.why || 'Down!').slice(0, 60), '#ffd84a');
  Snd.thud(0.32);
  sparkWorld(o.pos, o.off, '#f2b32a', 16);
  if (m.club && P.weapon !== 'club') { P.weapon = 'club'; P.swings = 8; msg('You took ' + o.name + "'s club!", '#ffd84a'); }
  if (m.cop) msg('You knocked the officer off. Ride!', '#9fc3ff');
}

// ---------- main loop
// The game moves in fixed steps of 1/120 s and catches up on real time, so a slow frame doesn't
// put it in slow motion and every screen in an online race keeps the same pace. A hidden tab
// gets no animation frames, so online it keeps racing from a timer, catching up in bigger steps.
const STEP = 1 / 120;
let last = performance.now(), acc = 0;
function advance(now, maxCatch) {
  // the first frame's timestamp can be a little earlier than the time taken at start-up
  acc += clamp((now - last) / 1000, 0, maxCatch);
  last = now;
  while (acc >= STEP) {
    acc -= STEP;
    if (G.state !== 'paused') update(STEP);
    else { pollPad(); if (pressed('Escape', 'p')) resume(); for (const k in Pressed) Pressed[k] = false; }
  }
}
function frame(now) {
  advance(now, 0.25);
  render();
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined' && document.addEventListener) {
  setInterval(() => { if (document.hidden && online()) advance(performance.now(), 2); }, 100);
  // coming back to the tab: don't replay the time spent away offline
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !online()) last = performance.now(); });
}
buildTrack(0, G.level);
showTitle();
// opened from an invite or a reply link: go straight to the lobby
if (typeof LinkPlay !== 'undefined' && LinkPlay.fromHash()) openLobby();
requestAnimationFrame(frame);
