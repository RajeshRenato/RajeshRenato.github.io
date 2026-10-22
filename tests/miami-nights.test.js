'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

load('miami-nights/index.html');
const step = (n, each = '') => run(`for (let i = 0; i < ${n}; i++) { ${each}; update(0.016); render(0.016); }`);

test('on foot in street view, W walks along the facing direction', () => {
  run(`Game.state = 'play'; viewMode = 'street';`);
  const before = run('[Player.x, Player.y, Player.angle]');
  run(`Input.keys['w'] = true;`); step(60); run(`Input.keys['w'] = false;`);
  const after = run('[Player.x, Player.y]');
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
  assert.ok(moved > 1, 'player did not move');
  const heading = Math.atan2(after[1] - before[1], after[0] - before[0]);
  assert.ok(Math.abs(Math.atan2(Math.sin(heading - before[2]), Math.cos(heading - before[2]))) < 0.2, 'moved off the facing direction');
});

test('A and D turn the player in street view', () => {
  const a0 = run('Player.angle');
  run(`Input.keys['d'] = true;`); step(20); run(`Input.keys['d'] = false;`);
  assert.ok(run('Player.angle') !== a0);
});

test('driving, police pursuit, and both camera modes render', () => {
  run(`Player.car = Game.cars[0]; Player.inCar = true; Game.cars[0].hasDriver = false; Game.cars[0].ai = null;
       Input.keys['w'] = true; Input.keys['d'] = true;`);
  step(300);
  assert.ok(run('Player.car.speed') > 0);
  run('Game.wanted = 3;');
  step(120);
  assert.ok(run('Game.police.length') > 0);
  run(`viewMode = 'top';`); step(40);
  run(`viewMode = 'street'; Player.exitCar(); Input.keys['w'] = false; Input.keys['d'] = false;`); step(40);
  assert.strictEqual(run('Player.inCar'), false);
});

test('the touch joystick maps to driving keys', () => {
  run(`TouchPad.on = true; Player.car = Game.cars[0]; Player.inCar = true;
       TouchPad.joy = { active: true, id: 1, ax: 100, ay: 300, dx: 0, dy: -56 };`);
  step(5);
  assert.ok(run(`Input.keys['w']`));
  run('TouchPad.joy = { active: true, id: 1, ax: 100, ay: 300, dx: 56, dy: 0 };');
  step(1);
  assert.ok(run(`Input.keys['d'] && !Input.keys['w']`));
  run('TouchPad.on = false; TouchPad.joy.active = false;');
});

// --- cops and robbers, two copies of the game over an in-memory channel

const { createPage, channelPair } = require('./helpers/browser');

function match() {
  const host = createPage('miami-nights/index.html');
  const guest = createPage('miami-nights/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('miami-nights', 'Ana'); r.addChannel(c);`);
  guest.run(`Online.attach(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('Online.attach(r)');
  c.pump();
  const tick = (n, each = '') => {
    for (let i = 0; i < n; i++) {
      host.run(`{ ${each} } update(0.033)`); c.pump();
      guest.run('update(0.033)'); c.pump();
    }
  };
  return { host, guest, c, tick };
}
const toCountdownEnd = m => m.tick(100);

test('online: roles are assigned, cars placed, and positions relayed', () => {
  const m = match();
  assert.strictEqual(m.host.run('Online.R.round'), 1);
  assert.strictEqual(m.guest.run('Online.myRole()'), 'robber', 'the guest robs first');
  assert.strictEqual(m.host.run('Online.myRole()'), 'cop');
  assert.strictEqual(m.host.run('Online.car.kind'), 'police');
  assert.strictEqual(m.guest.run('Online.remote.kind'), 'police');
  assert.strictEqual(m.host.run('Game.state'), 'play');
  toCountdownEnd(m);
  assert.strictEqual(m.guest.run('Online.R.phase'), 'chase');
  m.guest.run(`Online.car.x += 300; Online.car.vx = 0; Online.car.vy = 0`);
  m.tick(20);
  const gx = m.guest.run('Online.car.x'), hx = m.host.run('Online.remote.x');
  assert.ok(Math.abs(gx - hx) < 2, 'the host draws the guest car where it is: ' + gx + ' vs ' + hx);
  assert.strictEqual(m.host.run('Game.police.length'), 0, 'no AI police online');
});

test('online: the bust meter fills when the cop is close and the robber is slow, and the cop wins', () => {
  const m = match();
  toCountdownEnd(m);
  const put = `const g = Online.posOf(Online.R.robber); Online.car.x = g.x + 30; Online.car.y = g.y;`;
  m.tick(15, put);
  assert.ok(m.host.run('Online.R.bust') > 0.3, 'meter fills');
  m.tick(100, put);
  assert.strictEqual(m.host.run('Online.R.phase'), 'over');
  assert.strictEqual(m.guest.run('Online.R.winner'), 0, 'the host was the cop and made the bust');
  assert.strictEqual(m.guest.run('Online.R.score[0]'), 1);
});

test('online: delivering the package wins the round for the robber, then roles swap', () => {
  const m = match();
  toCountdownEnd(m);
  const p = JSON.parse(m.guest.run('JSON.stringify(Online.R.pickup)'));
  const d = JSON.parse(m.guest.run('JSON.stringify(Online.R.dropoff)'));
  m.guest.run(`Online.car.x = ${p.x}; Online.car.y = ${p.y};`);
  m.tick(10);
  assert.strictEqual(m.host.run('Online.R.hasPkg'), true);
  assert.strictEqual(m.guest.run('Mission.state'), 'deliver');
  m.guest.run(`Online.car.x = ${d.x}; Online.car.y = ${d.y};`);
  m.tick(10);
  assert.strictEqual(m.host.run('Online.R.phase'), 'over');
  assert.strictEqual(m.host.run('Online.R.winner'), m.guest.run('Online.me'));
  m.tick(140);
  assert.strictEqual(m.host.run('Online.R.round'), 2);
  assert.strictEqual(m.host.run('Online.myRole()'), 'robber', 'roles swap');
  assert.strictEqual(m.guest.run('Online.myRole()'), 'cop');
});

test('online: the first to three rounds wins the match, and a rematch resets the score', () => {
  const m = match();
  for (let round = 0; round < 5 && m.host.run(`Online.R.phase`) !== 'done'; round++) {
    m.host.run(`Online.R.phase = 'chase'; Online.R.phaseT = 0`);
    m.host.run(`Online.endRound(0, 'won')`);
    m.tick(135);
  }
  assert.strictEqual(m.host.run('Online.R.phase'), 'done');
  assert.strictEqual(m.guest.run('Online.R.phase'), 'done');
  assert.strictEqual(m.guest.run('Online.R.score[0]'), 3);
  m.guest.run(`Input.pressed['Enter'] = true; update(0.016)`);
  m.c.pump();
  assert.strictEqual(m.host.run('Online.R.round'), 1);
  assert.strictEqual(m.host.run('Online.R.score[0]'), 0);
});

test('online: leaving returns to the solo game', () => {
  const m = match();
  m.c.close(); m.c.pump();
  assert.strictEqual(m.guest.run('Online.active'), false);
  assert.strictEqual(m.guest.run('Game.state'), 'menu');
  assert.strictEqual(m.host.run('Online.active'), false);
});

test('every car model builds a closed body and cabin, and traffic uses a mix of them', () => {
  for (const name of ['sports', 'sedan', 'hatch', 'suv', 'pickup', 'police']) {
    const info = JSON.parse(run(`JSON.stringify((() => { const f = modelFaces('${name}'); return { n: f.faces.length, body: f.bodyCount, bad: f.faces.filter(q => q.pts.some(p => p.some(v => !Number.isFinite(v)))).length, roles: [...new Set(f.faces.map(q => q.role))] }; })())`));
    assert.ok(info.n > 20 && info.body > 10, name + ' has a body and a cabin');
    assert.strictEqual(info.bad, 0, name + ' has no broken points');
    assert.ok(info.roles.includes('paint') && info.roles.includes('glass'), name + ' has paint and glass');
  }
  const models = new Set(JSON.parse(run(`JSON.stringify(Array.from({ length: 200 }, (_, i) => pickTrafficModel(i / 200)))`)));
  assert.ok(models.size >= 5, 'five body styles in traffic');
  assert.strictEqual(run(`new Car(0, 0, 0, '#fff', 'police').model`), 'police');
  assert.strictEqual(run(`new Car(0, 0, 0, '#fff', 'civ', 'suv').len`), 44);
});

test('sidewalk corners are rounded: the curb follows the curve', () => {
  // block (1, 1): its slab starts at tile 10, 10
  const x0 = 10 * 48, y0 = 10 * 48;
  assert.strictEqual(run(`onSlab(${x0 + 2}, ${y0 + 2})`), false, 'the very corner is road');
  assert.strictEqual(run(`onSlab(${x0 + 22}, ${y0 + 2})`), true, 'along the edge is sidewalk');
  assert.strictEqual(run(`onSlab(${x0 + 30}, ${y0 + 30})`), true);
  assert.strictEqual(run(`groundZ(${x0 + 2}, ${y0 + 2})`), 0, 'cars at the corner sit on the road');
  assert.strictEqual(run(`footprint(0, 0, 100, 100, 'round', 20).length`), 24);
  assert.strictEqual(run(`footprint(0, 0, 100, 100, 'chamfer', 20).length`), 8);
});
