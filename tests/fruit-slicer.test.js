'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => {
  const p = createPage('fruit-slicer/index.html');
  p.run(`let s = 7; rand = () => (s = (s * 16807) % 2147483647) / 2147483647;`);
  return p;
};
// a fruit parked at a spot, not moving
const park = (p, x, y, bomb = false) => p.run(`(() => { const f = launch(${bomb}); f.x = ${x}; f.y = ${y}; f.vx = 0; f.vy = 0; return G.fruits.length; })()`);

test('frame differences give a motion map with the right count and centre', () => {
  const { run } = page();
  run(`globalThis.a = new Uint8Array(20 * 10); globalThis.b = new Uint8Array(20 * 10);
       for (let y = 2; y < 6; y++) for (let x = 10; x < 14; x++) b[y * 20 + x] = 200;
       globalThis.m = motionMap(a, b, 20, 10, 30);`);
  assert.strictEqual(run('m.count'), 16);
  assert.strictEqual(run('m.cx'), 11.5);
  assert.strictEqual(run('m.cy'), 3.5);
  run('b[0] = 20; globalThis.m2 = motionMap(a, b, 20, 10, 30);');
  assert.strictEqual(run('m2.count'), 16, 'changes under the threshold are ignored');
  assert.strictEqual(run('toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), new Uint8Array(2)).join()'), '255,0');
});

test('motion over a fruit slices it, still frames do not', () => {
  const p = page();
  p.run(`startGame('classic', false)`);
  park(p, 640, 360);
  park(p, 100, 100);
  // a 160 x 90 mask over the 1280 x 720 screen
  p.run(`globalThis.still = { mask: new Uint8Array(160 * 90), w: 160, h: 90, count: 0, frac: 0, cx: -1, cy: -1 }`);
  assert.strictEqual(p.run('applyMotion(still)'), 0);
  assert.strictEqual(p.run('G.fruits.length'), 2);
  p.run(`globalThis.moving = { mask: new Uint8Array(160 * 90), w: 160, h: 90 };
         for (let y = 30; y < 60; y++) for (let x = 65; x < 95; x++) moving.mask[y * 160 + x] = 1;
         Object.assign(moving, { count: 900, frac: 900 / 14400, cx: 80, cy: 45 });`);
  assert.ok(p.run('fruitMotion(G.fruits[0], moving)') > 0.9);
  assert.strictEqual(p.run('fruitMotion(G.fruits[1], moving)'), 0);
  assert.strictEqual(p.run('applyMotion(moving)'), 1);
  assert.strictEqual(p.run('G.fruits.length'), 1, 'only the fruit under the movement is sliced');
  assert.strictEqual(p.run('G.score'), 1);
  assert.strictEqual(p.run('G.halves.length'), 2);
});

test('a swipe slices what it crosses, and three in a row is a combo', () => {
  const p = page();
  p.run(`startGame('classic', false)`);
  park(p, 300, 300); park(p, 500, 300); park(p, 700, 300); park(p, 700, 600);
  assert.strictEqual(p.run('swipe(200, 300, 800, 300)'), 3);
  assert.strictEqual(p.run('G.fruits.length'), 1);
  assert.strictEqual(p.run('G.combo'), 3);
  p.run('G.t += 0.5; settleCombo()');
  assert.strictEqual(p.run('G.score'), 6, '3 fruit plus a 3-fruit combo bonus');
  assert.strictEqual(p.run('G.combo'), 0);
});

test('a sliced bomb and a missed fruit each cost a life, and three ends the game', () => {
  const p = page();
  p.run(`startGame('classic', false)`);
  park(p, 400, 300, true);
  p.run('swipe(350, 300, 450, 300)');
  assert.strictEqual(p.run('G.lives'), 2);
  p.run(`(() => { const f = launch(false); f.y = H + 200; f.vy = 50; G.spawnIn = 99; update(0.016); })()`);
  assert.strictEqual(p.run('G.lives'), 1);
  park(p, 400, 300, true);
  p.run('swipe(350, 300, 450, 300)');
  assert.strictEqual(p.run('G.mode'), 'over');
});

test('Zen has no bombs or lives and ends after 90 seconds, and the best score is kept', () => {
  const p = page();
  p.run(`startGame('zen', false)`);
  for (let i = 0; i < 40; i++) p.run('spawnWave()');
  assert.strictEqual(p.run('G.fruits.some(f => f.bomb)'), false);
  p.run(`(() => { const f = launch(false); f.y = H + 200; f.vy = 50; })()`);
  p.run('G.spawnIn = 99; update(0.016)');
  assert.strictEqual(p.run('G.lives'), 3, 'missing fruit is free in Zen');
  p.run('G.score = 42; for (let i = 0; i < 3000; i++) { G.spawnIn = 99; update(0.033); if (G.mode !== "play") break; }');
  assert.strictEqual(p.run('G.mode'), 'over');
  assert.strictEqual(p.run(`+localStorage.getItem('fs_best_zen')`), 42);
  assert.strictEqual(p.run('G.best.zen'), 42);
});

test('the calibration pause measures camera noise before the game starts', () => {
  const p = page();
  p.run(`startGame('classic', true)`);
  for (let i = 0; i < 10; i++) p.run(`applyMotion({ mask: new Uint8Array(16), w: 4, h: 4, count: 1, frac: 0.02, cx: 1, cy: 1 })`);
  p.run('update(1.6)');
  assert.ok(Math.abs(p.run('G.noise') - 0.03) < 1e-9);
  assert.strictEqual(p.run('G.t'), 0, 'no time passes during calibration');
});
