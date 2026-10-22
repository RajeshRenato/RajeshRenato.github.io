'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run, createPage, channelPair } = require('./helpers/browser');

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

// online: three copies of the page joined by in-memory channels, host in the middle
function onlineRace() {
  const host = createPage('midnight-racing/index.html');
  const g1 = createPage('midnight-racing/index.html');
  const g2 = createPage('midnight-racing/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a; g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let k = 0; k < 4; k++) { c1.pump(); c2.pump(); } };
  g1.run(`G.level = 7; G.diff = 1;`);
  host.run(`G.level = 2; G.diff = 3; globalThis.r = Room.create('midnight-racing', 'Ana'); r.addChannel(c1); r.addChannel(c2);`);
  g1.run(`attachRoom(Room.joinChannel(ch, 'Bo'))`);
  g2.run(`attachRoom(Room.joinChannel(ch, 'Cy'))`);
  pump();
  assert.strictEqual(g1.run('G.state'), 'netwait');
  host.run('attachRoom(r)');
  pump();
  const all = [host, g1, g2];
  const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) { for (const p of all) p.run(`update(${dt})`); pump(); } };
  return { host, g1, g2, all, pump, tick, c1 };
}

test('online: everyone races the host\'s level and difficulty on the same track and traffic', () => {
  const { host, g1, g2 } = onlineRace();
  for (const p of [g1, g2]) {
    assert.strictEqual(p.run('G.state'), 'count');
    assert.strictEqual(p.run('G.level'), 2);
    assert.strictEqual(p.run('G.diff'), 3);
    assert.strictEqual(p.run('finishZ'), host.run('finishZ'));
    assert.strictEqual(p.run('segs.map(s => s.curve).join()'), host.run('segs.map(s => s.curve).join()'));
    assert.strictEqual(p.run('traffic.map(c => Math.round(c.pos)).join()'), host.run('traffic.map(c => Math.round(c.pos)).join()'));
  }
  assert.strictEqual(g1.run(`localStorage.getItem('rr_level')`), null, 'nothing about the online race is saved');
});

test('online: riders share where they are and show up on each other\'s road', () => {
  const { host, g1, g2, tick } = onlineRace();
  tick(70);
  assert.strictEqual(host.run('G.state'), 'race');
  g1.run(`Keys['w'] = true`);
  tick(40);
  const pos = g1.run('P.pos');
  assert.ok(pos > 500);
  const seen = host.run('NET.peers.get(1).rpos');
  assert.ok(Math.abs(seen - pos) < 600, 'host sees Bo near ' + pos + ', got ' + seen);
  assert.ok(Math.abs(g2.run('NET.peers.get(1).rpos') - pos) < 600, 'the other guest sees Bo too, through the host');
  assert.strictEqual(g2.run('NET.peers.get(1).name'), 'Bo');
  g2.run('render()');
  assert.ok(host.run('rankOf()') >= 2, 'Bo is ahead of the host');
});

test('online: a punch on another player lowers their health on their side', () => {
  const { host, g1, tick, pump } = onlineRace();
  tick(75);
  host.run('NET.peers.get(2).rpos = P.pos + 5000');
  g1.run('P.invuln = 0; P.hp = 100; P.state = "ride"');
  const punch = () => host.run(`{ const p = NET.peers.get(1); p.s.st = 'ride'; p.rpos = P.pos + 120; p.rx = P.x + 0.1; P.punchT = 0; P.kickT = 0; attack('punch'); }`);
  punch();
  pump();
  assert.strictEqual(g1.run('P.hp'), 70);
  punch(); punch(); punch();
  pump();
  assert.strictEqual(g1.run('P.state'), 'crash', 'four punches knock Bo off');
});

test('online: the host orders the finishers by their times and starts the next race', () => {
  const { host, g1, g2, tick, pump } = onlineRace();
  tick(70);
  g2.run('G.raceT = 61.5; P.pos = finishZ + 10'); g2.run('update(0.01)'); pump();
  g1.run('G.raceT = 58.25; P.pos = finishZ + 10'); g1.run('update(0.01)'); pump();
  assert.strictEqual(g1.run('G.state'), 'over');
  const res = JSON.parse(host.run('JSON.stringify(NET.results)'));
  assert.deepStrictEqual(res.map(r => [r.name, r.place]), [['Bo', 1], ['Cy', 2], ['Ana', 0]], 'faster time wins even if it came in later');
  assert.deepStrictEqual(JSON.parse(g2.run('JSON.stringify(NET.results.map(r => r.name))')), ['Bo', 'Cy', 'Ana']);
  host.run('G.raceT = 70; P.pos = finishZ + 10'); host.run('update(0.01)'); pump();
  assert.strictEqual(g1.run('NET.results[2].place'), 3);
  host.run(`Pressed['Enter'] = true; update(0.01)`); pump();
  for (const p of [host, g1, g2]) assert.strictEqual(p.run('G.state'), 'count');
  assert.strictEqual(g1.run('NET.results.every(r => r.place === 0)'), true, 'everyone is racing again');
});

test('online: leaving puts your own level and difficulty back', () => {
  const { g1 } = onlineRace();
  g1.run(`leaveOnline('bye')`);
  assert.strictEqual(g1.run('G.state'), 'menu');
  assert.strictEqual(g1.run('G.level'), 7);
  assert.strictEqual(g1.run('G.diff'), 1);
  assert.strictEqual(g1.run('online()'), false);
});

test('easy and medium rivals stay slower than the starter bike, even when catching up', () => {
  const limits = { 1: 0.86, 2: 0.97 };
  for (const d of [1, 2]) {
    for (const level of [1, 5, 10, 20, 40]) {
      // the fastest a rival can be: top of the random spread, the level bonus, and the catch-up boost
      const top = run(`(() => { const D = DIFFS[${d}]; return (D.rival + 0.08 + Math.min(0.08, ${level} * 0.006) * D.levelGain) * D.catchUp; })()`);
      assert.ok(top < limits[d], `difficulty ${d}, level ${level}: rivals reach ${top.toFixed(3)} of top speed`);
    }
  }
  const hits = run('[1, 2, 3].map(d => DIFFS[d].dmg * 14)');
  assert.ok(hits[0] < hits[1] && hits[1] < hits[2], 'rivals hit softer on easier settings');
});
