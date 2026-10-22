'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

test('eating food makes a worm longer and wider', () => {
  const p = createPage('worm-arena/index.html');
  p.run(`W = newWorld(); W.food.clear(); globalThis.me = spawnWorm(W, { name: 'Me' }); me.x = 0; me.y = 0; me.a = me.ta = 0;
    me.body = me.body.map((_, i) => [-i * SPACING, 0]); addFood(W, 30, 0, 5); addFood(W, 60, 0, 5);`);
  const before = json(p, '[me.score, me.body.length, radiusOf(me.score)]');
  p.run('for (let i = 0; i < 60; i++) step(W, 1 / 60)');
  const after = json(p, '[me.score, me.body.length, radiusOf(me.score)]');
  assert.ok(after[0] >= before[0] + 10, 'ate both pellets');
  assert.ok(after[1] > before[1] && after[2] > before[2]);
  assert.ok(p.run('W.food.size') >= 1100, 'the arena keeps itself stocked');
});

test('a head into another worm kills it, and its body becomes food for the killer', () => {
  const p = createPage('worm-arena/index.html');
  p.run(`W = newWorld(); W.food.clear();
    globalThis.wall = spawnWorm(W, { name: 'Wall' }); wall.x = 0; wall.y = 0; wall.a = wall.ta = Math.PI / 2; wall.score = 60;
    wall.body = Array.from({ length: segsOf(60) }, (_, i) => [0, -i * SPACING]);
    globalThis.me = spawnWorm(W, { name: 'Me' }); me.score = 40; me.x = -120; me.y = -60; me.a = me.ta = 0;
    me.body = Array.from({ length: segsOf(40) }, (_, i) => [-120 - i * SPACING, -60]);`);
  p.run('for (let i = 0; i < 90 && me.alive; i++) step(W, 1 / 60)');
  assert.strictEqual(p.run('me.alive'), false);
  assert.strictEqual(p.run('wall.alive'), true);
  assert.strictEqual(p.run('me.killer'), p.run('wall.id'));
  const dropped = p.run('[...W.food.values()].reduce((s, f) => s + f.v, 0)');
  assert.ok(dropped >= 20, 'most of its length is left as food: ' + dropped);
});

test('the edge kills, and boosting is faster but costs length', () => {
  const p = createPage('worm-arena/index.html');
  p.run(`W = newWorld(); W.food.clear();
    globalThis.me = spawnWorm(W, { name: 'Me' }); me.score = 50; me.x = 0; me.y = 0; me.a = me.ta = 0; me.body = [[0, 0]];
    me.boost = true;`);
  p.run('for (let i = 0; i < 60; i++) step(W, 1 / 60)');
  assert.ok(p.run('me.x') > 280, 'about twice normal speed');
  assert.ok(p.run('me.score') < 50 && p.run('me.score') >= 41);
  assert.ok(p.run('W.food.size') > 1000);
  p.run(`me.x = R - 5; me.y = 0;`);
  p.run('step(W, 1 / 60)');
  assert.strictEqual(p.run('me.alive'), false);
});

test('bots fill the arena, eat, and do not all crash at once', () => {
  const p = createPage('worm-arena/index.html');
  p.run(`(() => { let seed = 5; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647; })()`);
  p.run(`W = newWorld(); fillBots(W); globalThis.deaths = 0;
    for (let i = 0; i < 60 * 60; i++) { step(W, 1 / 60); deaths += W.kills.length; W.kills = []; W.fe = []; W.fa = []; W.spawned = []; fillBots(W); }`);
  const alive = json(p, '[...W.worms.values()].filter(w => w.alive).map(w => w.score)');
  assert.strictEqual(alive.length, 12);
  assert.ok(Math.max(...alive) > 30, 'some bots grew: ' + Math.max(...alive));
  assert.ok(p.run('deaths') < 40, 'a minute of play, not constant crashing: ' + p.run('deaths'));
});

test('online: a guest sees the host\'s worms rebuilt from their head trails, and steers its own', () => {
  const host = createPage('worm-arena/index.html'), guest = createPage('worm-arena/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('worm-arena', 'Ana'); r.addChannel(ch);`);
  guest.run(`startGuest(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('startHost(r)');
  c.pump();
  assert.strictEqual(guest.run('mode'), 'guest');
  const mine = guest.run('myWorm');
  assert.strictEqual(host.run(`W.worms.get(${mine}).pid`), 1);
  assert.strictEqual(guest.run('V.food.size'), host.run('W.food.size'));
  // play two seconds: snapshots at 20 a second
  for (let i = 0; i < 40; i++) {
    host.run('for (let k = 0; k < 3; k++) step(W, 1 / 60); room.send(snapshot(W)); fillBots(W)');
    c.pump();
  }
  // compare one worm's body as the guest draws it with the host's
  const id = host.run(`[...W.worms.values()].find(w => w.alive && w.bot).id`);
  const hostBody = json(host, `W.worms.get(${id}).body.slice(0, 20)`);
  const guestBody = json(guest, `guestShape(V.worms.get(${id}), performance.now() + 100).body.slice(0, 20)`);
  const off = Math.max(...guestBody.map((p, i) => Math.hypot(p[0] - hostBody[i][0], p[1] - hostBody[i][1])));
  assert.ok(off < 12, 'the guest body follows the host body: ' + off.toFixed(1));
  // steering
  guest.run(`room.send({ t: 'in', a: 1.25, b: 1 })`);
  c.pump();
  assert.strictEqual(host.run(`W.worms.get(${mine}).ta`), 1.25);
  assert.strictEqual(host.run(`W.worms.get(${mine}).boost`), true);
  // hostile input changes nothing
  guest.run(`room.send({ t: 'in', a: 'x' }); room.send({ t: 'in', a: NaN }); room.send({ t: 'spawn' })`);
  c.pump();
  assert.strictEqual(host.run(`W.worms.get(${mine}).ta`), 1.25);
  assert.strictEqual(host.run(`[...W.worms.values()].filter(w => w.alive && w.pid === 1).length`), 1, 'no second worm while alive');
  host.run(`room.send({ t: 's', w: [[999, 0, 0, 0, 10, 0], 'x', [1, 'a', 0, 0, 0, 0]], fe: 'nope', fa: [[1, 2]], k: 5 }); room.send({ t: 'init', food: 'x' })`);
  c.pump();
  assert.strictEqual(guest.run('mode'), 'guest');
  assert.strictEqual(guest.run(`V.worms.has(999)`), false);
  // dying and coming back
  host.run(`kill(W, W.worms.get(${mine}), null); room.send(snapshot(W))`);
  c.pump();
  assert.match(guest.run(`$('msgBox').innerHTML`), /You hit the edge/);
  guest.run(`respawn()`);
  c.pump();
  assert.notStrictEqual(guest.run('myWorm'), mine);
  assert.strictEqual(host.run(`W.worms.get(${guest.run('myWorm')}).pid`), 1);
});

test('a worm that shrinks mid-step (boosting) never trips the collision check', () => {
  const p = createPage('worm-arena/index.html');
  p.run(`W = newWorld(); fillBots(W);
    for (const w of W.worms.values()) { w.score = 200; w.boost = true; }
    for (let i = 0; i < 600; i++) { step(W, 1 / 60); for (const w of W.worms.values()) if (w.alive) { w.boost = true; if (i % 50 === 0) w.body = [[w.x, w.y]]; } fillBots(W); }`);
  assert.ok(p.run('[...W.worms.values()].some(w => w.alive)'));
});
