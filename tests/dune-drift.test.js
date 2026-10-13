'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

load('dune-drift/index.html');
const step = (n, each = '') => run(`for (let i = 0; i < ${n}; i++) { ${each}; update(0.016); render(); }`);

test('a press starts the run from the menu', () => {
  assert.strictEqual(run('G.state'), 'menu');
  run('press()'); step(2); run('release()');
  assert.strictEqual(run('G.state'), 'run');
});

test('pressing jumps, holding spins a backflip, and a level landing keeps the run going', () => {
  step(120);
  run('press()'); step(1);
  assert.strictEqual(run('P.grounded'), false);
  step(30);
  assert.ok(run('P.flips >= 1 || P.airRot < -1'), 'holding should rotate backwards');
  run('release()');
  step(300, 'if (P.grounded || G.state !== "run") break; P.rot = groundDir(P.x) - 0.1');
  assert.strictEqual(run('G.state'), 'run');
  assert.strictEqual(run('P.grounded'), true);
  assert.ok(run('G.score') > 0);
});

test('distance keeps increasing while riding', () => {
  const d0 = run('G.dist');
  step(200);
  assert.ok(run('G.dist') > d0);
});

test('the right arrow spins forward', () => {
  step(300, 'if (P.grounded) break');
  run('press(1)'); step(1);
  const r0 = run('P.rot');
  step(20);
  assert.ok(run('P.rot') > r0, 'rotation should increase for a frontflip');
  run('release()');
  step(300, 'if (P.grounded || G.state !== "run") break; P.rot = groundDir(P.x) + 0.1');
  assert.strictEqual(run('G.state'), 'run');
});

test('a bad landing ends the run, and a press restarts it', () => {
  run('P.grounded = false; P.vy = 500; P.vx = 600; P.y = groundY(P.x) - 50; P.rot = groundDir(P.x) + 2.6;');
  step(40);
  assert.strictEqual(run('G.state'), 'over');
  step(50);
  run('press()'); step(2); run('release()');
  assert.strictEqual(run('G.state'), 'run');
});
