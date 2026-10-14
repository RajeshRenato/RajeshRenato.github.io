'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

// rivals and traffic use Math.random, so seed it to keep the runs repeatable
let seed = 12345;
Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
load('midnight-racing/index.html');
const step = (n, each = '') => run(`for (let i = 0; i < ${n}; i++) { ${each}; update(0.016); render(); }`);

test('menu: difficulty select and bike purchases', () => {
  run(`Pressed['3'] = true;`); step(1);
  assert.strictEqual(run('G.diff'), 3);
  run('G.cash = 5000;');
  run(`Pressed['b'] = true;`); step(1);
  assert.strictEqual(run('G.bike'), 1);
  run(`Pressed['b'] = true;`); step(1);
  assert.strictEqual(run('G.bike'), 2);
  assert.strictEqual(run('G.cash'), 5000 - 800 - 2500);
});

test('hard mode spawns oncoming traffic, three armed rivals, and the police rider', () => {
  run(`Pressed['Enter'] = true;`); step(1);
  assert.strictEqual(run('G.state'), 'count');
  assert.ok(run('cop'));
  assert.ok(run('traffic.some(c => c.dir === -1)'));
  assert.strictEqual(run(`rivals.filter(o => o.weapon === 'club').length`), 3);
  step(220);
  assert.strictEqual(run('G.state'), 'race');
});

test('the bike accelerates and moves down the track', () => {
  run(`Keys['w'] = true; globalThis.maxSp = 0; globalThis.maxPos = 0;`);
  step(1800, `Keys['a'] = (i % 120) < 40; Keys['d'] = (i % 120) >= 80; if (i % 90 === 0) Pressed[' '] = true;
              maxSp = Math.max(maxSp, P.speed); maxPos = Math.max(maxPos, P.pos)`);
  assert.ok(run('maxSp') > 0 && run('maxPos') > 0);
});

test('getting knocked off recovers back to riding', () => {
  run(`P.hp = 1; P.invuln = 0; rivals[0].pos = P.pos + 50; rivals[0].off = P.x; rivals[0].state = 'ride'; rivals[0].punchCd = -1;`);
  step(20);
  step(140);
  assert.strictEqual(run('P.state'), 'ride');
});

test('knocking down a club rider hands over the club, and a kick can shove a rider off the road', () => {
  run(`globalThis.armed = rivals.find(r => r.weapon === 'club');
       armed.pos = P.pos + 100; armed.off = P.x + 0.2; armed.state = 'ride'; armed.hp = 20;
       P.punchT = 0; P.kickT = 0; P.weapon = null; Pressed[' '] = true;`);
  step(1);
  assert.strictEqual(run('armed.state'), 'down');
  assert.strictEqual(run('P.weapon'), 'club');

  run(`globalThis.other = rivals.find(r => r !== armed && r.state === 'ride') || rivals[0];
       other.pos = P.pos + 100; other.state = 'ride'; other.hp = 60; other.off = 0.9;
       P.x = 0.6; P.punchT = 0; P.kickT = 0; Pressed['e'] = true;`);
  step(1);
  assert.strictEqual(run('other.state'), 'down');
  step(300);
  assert.strictEqual(run('armed.state'), 'ride', 'downed rider should get back on');
});

test('crossing the finish ends the race, and Enter starts the next one', () => {
  run('P.pos = finishZ - 400; P.speed = MAXS;');
  step(60);
  assert.strictEqual(run('G.state'), 'over');
  run(`Pressed['Enter'] = true;`); step(1);
  assert.strictEqual(run('G.state'), 'count');
});

test('touch controls steer and give auto-throttle', () => {
  run(`Touch.on = true; Touch.pts.set(1, 'right');`);
  step(260);
  assert.ok(run(`Keys['d'] && Keys['w']`));
  assert.ok(run(`P.speed > 0 || P.state !== 'ride'`));
  run('Touch.pts.clear(); Touch.on = false;');
});

test('a finished race becomes a ghost link that decodes back to the same run', () => {
  run(`Touch.on = false; Touch.pts.clear(); G.state = 'race'; P.state = 'ride'; P.pos = finishZ - 400; P.speed = MAXS;`);
  step(60);
  assert.strictEqual(run('G.state'), 'over');
  assert.ok(run('myGhost.samples.length') > 5);
  const code = run('encodeGhost(myGhost)');
  assert.match(code, /^[A-Za-z0-9_-]+$/, 'ghost code must be URL-safe');
  run(`globalThis.back = decodeGhost(${JSON.stringify(code)});`);
  assert.strictEqual(run('back.level'), run('myGhost.level'));
  assert.strictEqual(run('back.diff'), run('myGhost.diff'));
  assert.ok(Math.abs(run('back.t') - run('myGhost.t')) < 0.011);
  assert.strictEqual(run('back.samples.length'), run('myGhost.samples.length'));

  // a long run at the fastest bike's top speed, with braking and lane changes
  run(`globalThis.real = { level: 7, diff: 3, t: 95.4, samples: [] };
       let pos = 0;
       for (let i = 0; i < 480; i++) {
         pos += MAXS * BIKES[2].top * GHOST_DT * (i % 50 < 40 ? 1 : 0.3);
         real.samples.push([pos, Math.sin(i / 9) * 1.6]);
       }
       globalThis.real2 = decodeGhost(encodeGhost(real));`);
  const worst = run('Math.max(...real.samples.map((s, i) => Math.abs(s[0] - real2.samples[i][0])))');
  assert.ok(worst < 16, 'position drift ' + worst);
  const lane = run('Math.max(...real.samples.map((s, i) => Math.abs(s[1] - real2.samples[i][1])))');
  assert.ok(lane < 0.01, 'lane drift ' + lane);
  assert.ok(run('encodeGhost(real).length') < 1400, 'link stays short');
  assert.strictEqual(run(`decodeGhost('not-a-ghost')`), null);
});

test('racing a ghost uses its track and keeps your own level and difficulty', () => {
  run(`globalThis.lvl0 = G.level; globalThis.diff0 = G.diff;
       startGhost(decodeGhost(encodeGhost({ level: 4, diff: 1, t: 50, samples: [[0, 0], [3000, 0.2], [6000, 0]] })));
       G.state = 'menu'; Pressed['Enter'] = true;`);
  step(1);
  assert.strictEqual(run('G.level'), 4);
  assert.strictEqual(run('G.diff'), 1);
  step(220);
  assert.strictEqual(run('G.state'), 'race');
  run('P.state = "ride"; P.pos = finishZ - 300; P.speed = MAXS;');
  step(60);
  assert.strictEqual(run('G.state'), 'over');
  assert.strictEqual(typeof run('ghostResult'), 'number');
  assert.strictEqual(run('G.level'), 4, 'a ghost race must not level you up');
  assert.strictEqual(run(`localStorage.getItem('rr_level')`), String(run('lvl0')));
  run(`Pressed['Enter'] = true;`);
  step(1);
  assert.strictEqual(run('G.level'), run('lvl0'));
  assert.strictEqual(run('G.diff'), run('diff0'));
  assert.strictEqual(run('ghost'), null);
});
