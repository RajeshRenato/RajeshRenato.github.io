'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

load('falling-sand/index.html');
run(`rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();`);

function fresh(w = 40, h = 30) { run(`alloc(${w}, ${h});`); }
const put = (x, y, t, l = 0) => run(`set(idx(${x}, ${y}), ${t}, ${l})`);
const steps = n => run(`for (let k = 0; k < ${n}; k++) step()`);
const at = (x, y) => run(`cell[idx(${x}, ${y})]`);
const count = t => run(`count(${t})`);
const T = run('({ E, WALL, SAND, WATER, OIL, FIRE, SMOKE, STEAM, WOOD, PLANT, LAVA, ACID, STONE })');

test('sand falls to the floor and piles up', () => {
  fresh();
  for (let x = 15; x < 25; x++) for (let y = 0; y < 5; y++) put(x, y, T.SAND);
  steps(200);
  assert.strictEqual(count(T.SAND), 50, 'sand should be conserved');
  assert.strictEqual(at(20, 29), T.SAND, 'sand should reach the bottom row');
  assert.strictEqual(at(20, 0), T.E, 'the top should be empty');
});

test('water spreads out flat', () => {
  fresh();
  for (let x = 18; x < 22; x++) for (let y = 0; y < 10; y++) put(x, y, T.WATER);
  steps(400);
  assert.strictEqual(count(T.WATER), 40);
  let maxY = 0, minY = 99;
  for (let x = 0; x < 40; x++) for (let y = 0; y < 30; y++) if (at(x, y) === T.WATER) { maxY = Math.max(maxY, y); minY = Math.min(minY, y); }
  assert.ok(maxY - minY <= 1, 'water should settle within one or two rows, spread ' + (maxY - minY));
});

test('sand sinks through water, and oil floats on top of water', () => {
  fresh(20, 20);
  for (let x = 0; x < 20; x++) for (let y = 14; y < 20; y++) put(x, y, T.WATER);
  for (let x = 0; x < 20; x++) for (let y = 10; y < 12; y++) put(x, y, T.SAND);
  steps(300);
  assert.strictEqual(at(10, 19), T.SAND, 'sand should end up under the water');

  fresh(20, 20);
  for (let x = 0; x < 20; x++) for (let y = 16; y < 20; y++) put(x, y, T.OIL);
  for (let x = 0; x < 20; x++) for (let y = 10; y < 14; y++) put(x, y, T.WATER);
  steps(600);
  assert.strictEqual(at(10, 19), T.WATER, 'water should end up under the oil');
  assert.strictEqual(count(T.OIL), 80);
});

test('fire burns wood away and leaves smoke', () => {
  fresh();
  for (let x = 10; x < 30; x++) for (let y = 20; y < 23; y++) put(x, y, T.WOOD);
  put(10, 19, T.FIRE, 60);
  const wood0 = count(T.WOOD);
  let sawSmoke = false;
  for (let k = 0; k < 40; k++) { steps(25); if (count(T.SMOKE) > 0) sawSmoke = true; }
  assert.ok(count(T.WOOD) < wood0 / 2, 'most of the wood should burn');
  assert.ok(sawSmoke, 'burning should give off smoke');
});

test('water puts fire out as steam', () => {
  fresh();
  put(20, 20, T.FIRE, 200);
  put(20, 19, T.WATER);
  steps(2);
  assert.ok(count(T.STEAM) >= 1);
});

test('lava touching water turns to stone', () => {
  fresh();
  for (let x = 0; x < 40; x++) put(x, 29, T.WATER);
  for (let x = 15; x < 25; x++) put(x, 28, T.LAVA);
  steps(30);
  assert.ok(count(T.STONE) > 0);
});

test('acid eats sand', () => {
  fresh();
  for (let x = 10; x < 30; x++) for (let y = 25; y < 30; y++) put(x, y, T.SAND);
  for (let x = 10; x < 30; x++) put(x, 24, T.ACID);
  steps(300);
  assert.ok(count(T.SAND) < 100);
});

test('plants grow into water', () => {
  fresh();
  for (let x = 0; x < 40; x++) for (let y = 25; y < 30; y++) put(x, y, T.WATER);
  put(20, 24, T.PLANT);
  steps(400);
  assert.ok(count(T.PLANT) > 1);
});

test('brush strokes paint and erase', () => {
  fresh();
  run('material = WALL; brush = 3; paintLine(5, 5, 30, 5);');
  assert.ok(count(T.WALL) > 30);
  run('material = E; paintLine(5, 5, 30, 5);');
  assert.strictEqual(count(T.WALL), 0);
});
