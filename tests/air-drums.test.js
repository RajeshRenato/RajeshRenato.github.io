'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

// a 160x120 grey frame, optionally with a bright square painted somewhere (x, y as 0..1)
const setup = page => page.run(`
  globalThis.frame = (paint) => { const g = new Uint8Array(GW * GH).fill(90);
    if (paint) { const [px, py, s] = paint; for (let y = Math.floor(py * GH); y < Math.floor(py * GH) + s; y++) for (let x = Math.floor(px * GW); x < Math.floor(px * GW) + s; x++) g[y * GW + x] = 230; }
    return g; };
  globalThis.padAt = id => PADS.find(p => p.id === id);
  globalThis.centre = id => { const p = padAt(id); return [p.x + p.w * 0.25, p.y + p.h * 0.25]; };`);

test('still frames trigger nothing, and noise below the floor is ignored', () => {
  const page = createPage('air-drums/index.html');
  setup(page);
  const n = page.run(`(() => { const d = createDetector(PADS); let hits = 0;
    for (let i = 0; i < 60; i++) { const g = frame(); for (let k = 0; k < g.length; k += 97) g[k] = 90 + (i % 2 ? 10 : -10); hits += d.process(g, i * 33).length; }
    return hits; })()`);
  assert.strictEqual(n, 0);
});

test('motion in a pad hits that drum once, with a velocity', () => {
  const page = createPage('air-drums/index.html');
  setup(page);
  const hits = json(page, `(() => { const d = createDetector(PADS); const out = [];
    d.process(frame(), 0);
    const [x, y] = centre('snare');
    out.push(...d.process(frame([x, y, 18]), 33));
    out.push(...d.process(frame([x, y, 18]), 66));
    return out.map(h => [PADS[h.pad].id, h.velocity > 0.3 && h.velocity <= 1]); })()`);
  assert.deepStrictEqual(hits, [['snare', true]], 'one hit: the second identical frame has no new motion');
});

test('the refractory period stops a shaking hand from machine-gunning', () => {
  const page = createPage('air-drums/index.html');
  setup(page);
  const times = json(page, `(() => { const d = createDetector(PADS, { refractory: 140 }); const out = [];
    const [x, y] = centre('kick');
    for (let i = 0; i < 40; i++) { const t = i * 20; const g = Math.floor(i / 2) % 2 ? frame([x, y, 20]) : frame(); for (const h of d.process(g, t)) out.push(t); }
    return out; })()`);
  assert.ok(times.length >= 2, 'it keeps hitting while you keep moving');
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 140, 'hits are at least 140 ms apart');
});

test('calibration raises the noise floor so steady background motion stops triggering', () => {
  const page = createPage('air-drums/index.html');
  setup(page);
  const out = json(page, `(() => { const d = createDetector(PADS, { sensitivity: 1 });
    const [x, y] = centre('hat');
    const wobble = i => frame(i % 2 ? [x, y, 7] : null);
    let before = 0; d.process(frame(), 0);
    for (let i = 1; i < 30; i++) before += d.process(wobble(i), i * 200).length;
    const floor0 = d.floor[1];
    d.startCalibration();
    for (let i = 30; i < 50; i++) d.process(wobble(i), i * 200);
    d.finishCalibration();
    let after = 0;
    for (let i = 50; i < 80; i++) after += d.process(wobble(i), i * 200).length;
    return [before, after, floor0, d.floor[1]]; })()`);
  assert.ok(out[0] > 0, 'the wobble triggered hits before');
  assert.ok(out[3] > out[2], 'the floor went up');
  assert.strictEqual(out[1], 0, 'and no longer does after calibrating');
});

test('a recorded loop plays back on time, pass after pass', () => {
  const { run } = createPage('air-drums/index.html');
  const due = JSON.parse(run(`JSON.stringify((() => { const L = createLooper();
    L.record(1000); L.add(4, 0.8, 1000); L.add(6, 0.9, 1500); L.add(1, 0.5, 1750);
    L.stop(2000);
    const out = [];
    for (let t = 2000; t <= 4100; t += 50) for (const e of L.due(t)) out.push([Math.round(t - 2000), e.pad]);
    return out; })())`));
  assert.deepStrictEqual(due, [[0, 4], [500, 6], [750, 1], [1000, 4], [1500, 6], [1750, 1], [2000, 4]]);
  assert.strictEqual(run(`(() => { const L = createLooper(); L.record(0); return L.stop(800); })()`), false, 'an empty recording makes no loop');
});

test('keys play the drums without a camera', () => {
  const page = createPage('air-drums/index.html');
  assert.strictEqual(page.run(`PADS[keyPad('s')].id`), 'snare');
  assert.strictEqual(page.run(`PADS[keyPad(' ')].id`), 'kick');
  assert.strictEqual(page.run(`keyPad('z')`), -1);
  page.run(`startKeys(''); globalThis.played = []; playDrum = (id) => played.push(id); hit(keyPad('k'), 0.8, false)`);
  assert.deepStrictEqual(JSON.parse(page.run('JSON.stringify(played)')), ['kick']);
  assert.strictEqual(page.run('mode'), 'keys');
  assert.strictEqual(new Set(JSON.parse(page.run('JSON.stringify(PADS.map(p => p.key))'))).size, 7, 'every pad has its own key');
});
