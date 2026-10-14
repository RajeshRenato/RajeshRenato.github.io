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

test('a finished run becomes a ghost link that decodes back to the same path', () => {
  assert.ok(run('myGhost && myGhost.samples.length') > 10, 'the last run should have been recorded');
  const code = run('encodeGhost(myGhost)');
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  run(`globalThis.back = decodeGhost(${JSON.stringify(code)});`);
  assert.strictEqual(run('back.score'), run('myGhost.score'));
  assert.strictEqual(run('back.dist'), run('myGhost.dist'));
  const dx = run('Math.max(...myGhost.samples.map((s, i) => Math.abs(s[0] - back.samples[i][0])))');
  const dy = run('Math.max(...myGhost.samples.map((s, i) => Math.abs(s[1] - back.samples[i][1])))');
  assert.ok(dx <= 1.01 && dy <= 1.51, `position drift x ${dx}, y ${dy}`);
  assert.strictEqual(run(`decodeGhost('xx')`), null);
});

test('a loaded ghost rides alongside and leaves a flag where it wiped out', () => {
  run(`ghost = back; G.state = 'menu'; press(); `); step(2); run('release()');
  assert.strictEqual(run('G.state'), 'run');
  step(30);
  assert.strictEqual(run('ghostAt(ghost, G.runT).done'), false);
  run('G.runT = 9999;'); step(1);
  assert.strictEqual(run('ghostAt(ghost, G.runT).done'), true);
  run('P.grounded = false; P.vy = 500; P.vx = 600; P.y = groundY(P.x) - 50; P.rot = groundDir(P.x) + 2.6;');
  step(40);
  assert.strictEqual(run('G.state'), 'over');
});
