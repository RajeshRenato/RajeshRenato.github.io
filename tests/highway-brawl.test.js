'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

// traffic respawns and taunts use Math.random, so seed it to keep runs repeatable
let seed = 4242;
Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
load('highway-brawl/index.html');
const step = (n, each = '') => run(`for (let i = 0; i < ${n}; i++) { ${each}; update(1 / 60); }`);
// put the race on a quiet stretch with nobody else around, so one thing can be tested at a time
const quiet = () => run(`traffic = []; cops = []; for (const o of rivals) { o.pos = 1e7; o.aggro = 0; } G.state = 'race'; G.raceT = 10; P.invuln = 0;`);

test('every road builds with its own scenery, a finish line, and a race map', () => {
  const o = JSON.parse(run(`JSON.stringify(TRACKS.map((t, i) => { buildTrack(i, 1); return {
    id: t.id, len: segs.length, finish: finishZ > START + 100000, end: trackEnd > finishZ, map: mapPts.length,
    walls: segs.filter(s => s.walls[0] || s.walls[1]).length, cross: segs.filter(s => s.cross).length, sea: segs.filter(s => s.sea).length,
    kinds: [...new Set(segs.flatMap(s => s.sprites.map(p => p.kind)))].sort() }; }))`));
  for (const t of o) { assert.ok(t.finish && t.end, t.id + ' has a finish'); assert.ok(t.map > 100, t.id + ' has a map'); }
  const by = Object.fromEntries(o.map(t => [t.id, t]));
  assert.ok(by.city.walls > 1000 && by.city.cross > 30, 'buildings and cross streets downtown');
  assert.ok(by.city.kinds.includes('signal') && by.city.kinds.includes('lamp'));
  assert.ok(by.coast.sea === by.coast.len && by.coast.kinds.includes('guard'), 'the sea all along the coast road');
  assert.ok(by.pass.walls > 100 && by.pass.kinds.includes('pine'), 'rock walls and pines on the pass');
  assert.ok(by.valley.kinds.includes('fence') && by.valley.kinds.includes('barn'));
  assert.ok(by.desert.kinds.includes('cactus') && by.desert.kinds.includes('pole'));
  run('buildTrack(0, 1); const a = segs.map(s => s.curve).join(); buildTrack(0, 1); globalThis.same = a === segs.map(s => s.curve).join();');
  assert.strictEqual(run('same'), true, 'the same road every time for a level');
});

test('the bike shop sells bikes you can afford, once, and remembers them', () => {
  run(`G.cash = 3000; G.owned = [0]; G.bike = 0;`);
  assert.strictEqual(run('buyBike(4)'), false, 'too expensive');
  assert.strictEqual(run('buyBike(1)'), true);
  assert.strictEqual(run('G.cash'), 1600);
  assert.strictEqual(run('G.bike'), 1);
  assert.strictEqual(run('buyBike(1)'), false, 'already owned');
  const saved = JSON.parse(run(`localStorage.getItem(SAVE)`));
  assert.deepStrictEqual([saved.cash, saved.bike, saved.owned], [1600, 1, [0, 1]]);
});

test('the race counts down, then the bike rides down the road', () => {
  run(`G.level = 1; resetRace(1);`);
  assert.strictEqual(run('G.state'), 'count');
  assert.strictEqual(run('rivals.length'), 15);
  step(230);
  assert.strictEqual(run('G.state'), 'race');
  run(`globalThis.p0 = P.pos;`);
  step(300, `Keys['w'] = true`);
  run(`Keys['w'] = false;`);
  assert.ok(run('P.pos - p0') > 20000, 'covered ground');
  assert.ok(run('P.speed') > run('MAXS') * 0.6);
});

test('punches and the chain hurt, a kick can put a rider off the road, and down riders pay a bonus', () => {
  run(`resetRace(0);`); quiet();
  run(`globalThis.r = rivals[0]; r.pos = P.pos + 150; r.off = P.x + 0.2; r.state = 'ride'; r.hp = 100; P.state = 'ride';`);
  run(`P.punchT = P.kickT = P.swingT = P.backT = 0; attack('punch');`);
  assert.strictEqual(run('r.hp'), 84);
  run(`P.punchT = 0; attack('swing');`);
  assert.strictEqual(run('r.hp'), 58, 'the chain hits harder');
  // each hit shoves the rider aside, so bring them back within reach
  run(`P.swingT = 0; r.hp = 10; r.off = P.x + 0.2; attack('punch');`);
  assert.strictEqual(run('r.state'), 'down');
  assert.strictEqual(run('P.knocks'), 1);
  run(`globalThis.k = rivals[1]; k.pos = P.pos + 150; k.state = 'ride'; k.hp = 100; P.x = 0.6; k.off = 0.85; P.punchT = 0; attack('kick');`);
  assert.strictEqual(run('k.state'), 'down', 'kicked off the road');
  run(`globalThis.b = rivals[2]; b.pos = P.pos - 250; b.off = P.x - 0.2; b.state = 'ride'; b.hp = 100; P.kickT = 0; attack('back');`);
  assert.strictEqual(run('b.hp'), 82, 'a backhand reaches a rider behind');
});

test('punch a rider while they wind up a club and the club is yours', () => {
  run(`resetRace(0);`); quiet();
  run(`globalThis.c = rivals[3]; c.pos = P.pos + 150; c.off = P.x + 0.2; c.state = 'ride'; c.hp = 100; c.weapon = 'club'; c.swingT = 0.3;
       P.weapon = 'chain'; P.punchT = P.kickT = P.swingT = P.backT = 0; attack('punch');`);
  assert.strictEqual(run('P.weapon'), 'club');
  assert.strictEqual(run('c.weapon'), null);
  run(`c.swingT = 0; P.punchT = 0; attack('swing');`);
  assert.strictEqual(run('c.hp'), 60, 'a club swing does 40');
  assert.strictEqual(run('P.swings'), 7);
});

test('a pack can only land one hit at a time', () => {
  run(`resetRace(0);`); quiet();
  run(`P.hp = 100; for (const [i, o] of rivals.entries()) { o.pos = P.pos + 100 + i * 5; o.off = P.x + 0.1; o.state = 'ride'; o.aggro = 5; o.cd = 0; o.weapon = null; o.speed = 0; o.base = 0; }`);
  step(1);
  assert.ok(run('P.hp') >= 85, 'one punch, not fifteen: ' + run('P.hp'));
});

test('crashing hurts the bike; too many crashes wreck it and cost a repair', () => {
  run(`G.cash = 5000; G.bike = 0; resetRace(2);`); quiet();
  run(`P.x = 0; P.speed = MAXS * 0.8; crashPlayer('test', 10);`);
  assert.strictEqual(run('P.state'), 'crash');
  assert.ok(run('P.bikeHp') < 100 && run('P.bikeHp') > 80);
  step(120);
  assert.strictEqual(run('P.state'), 'ride', 'back on the bike');
  run(`P.bikeHp = 5; P.invuln = 0; crashPlayer('test', 10);`);
  assert.strictEqual(run('G.state'), 'over');
  assert.strictEqual(run('G.result.how'), 'wrecked');
  assert.ok(run('G.result.repair') > 0 && run('G.cash') < 5000);
});

test('the police chase you if you blast past, and crashing near them gets you busted', () => {
  run(`G.cash = 2000; G.level = 2; resetRace(4);`);
  run(`traffic = []; for (const o of rivals) o.pos = 1e7; G.state = 'race'; G.raceT = 10;
       globalThis.cop = cops[0]; P.pos = cop.pos + 300; P.speed = MAXS * 0.9; P.x = 0.5; cop.off = -0.6;`);
  step(2, `Keys['w'] = true`);
  run(`Keys['w'] = false;`);
  assert.strictEqual(run('cop.state'), 'chase');
  run(`P.invuln = 0; cop.pos = P.pos - 400; crashPlayer('test', 5);`);
  assert.strictEqual(run('G.result.how'), 'busted');
  assert.strictEqual(run('G.result.fine'), 600);
  assert.strictEqual(run('G.cash'), 1400);
});

test('knocking the officer down ends the chase', () => {
  run(`resetRace(4);`); quiet();
  run(`cops = [{ pos: P.pos + 150, off: P.x + 0.2, speed: 0, hp: 15, state: 'chase', downT: 0, punchT: 0, cd: 5, isCop: true }];
       P.punchT = P.kickT = P.swingT = P.backT = 0; attack('punch');`);
  assert.strictEqual(run('cops[0].state'), 'down');
});

test('top three on all five roads moves you up a level, with prize money', () => {
  run(`G.level = 1; G.qual = {}; G.cash = 0; G.champion = false;`);
  for (let i = 0; i < 5; i++) {
    run(`resetRace(${i}); quiet(); for (const o of rivals) o.pos = 0; P.pos = finishZ + 10; G.raceT = 70;`.replace('quiet();', `traffic = []; cops = []; G.state = 'race';`));
    step(1);
    assert.strictEqual(run('G.result.place'), 1);
    assert.strictEqual(run('G.result.qualified'), true);
  }
  assert.strictEqual(run('G.level'), 2);
  assert.strictEqual(run('G.result.levelUp'), true);
  assert.strictEqual(run('G.cash'), 5000, 'five wins at $1,000');
  assert.strictEqual(run(`G.result.field[0].you`), true);
  assert.strictEqual(run(`G.result.field.length`), 16);
});

test('a race finished outside the top three pays less and does not qualify', () => {
  run(`G.level = 2; G.qual = {}; G.cash = 0; resetRace(1); traffic = []; cops = []; G.state = 'race';
       rivals.forEach((o, i) => { o.pos = i < 5 ? finishZ + 500 : 0; o.finishT = i < 5 ? 50 + i : 0; }); P.pos = finishZ + 10; G.raceT = 60;`);
  step(1);
  assert.strictEqual(run('G.result.place'), 6);
  assert.strictEqual(run('G.result.qualified'), false);
  assert.strictEqual(run('G.result.prize'), Math.round(250 * 1.6));
  assert.strictEqual(run(`Object.keys(G.qual).length`), 0);
});

test('nitro gives a burst on super bikes only', () => {
  run(`G.bike = 0; resetRace(4);`); quiet();
  run(`Pressed['n'] = true;`); step(1);
  assert.strictEqual(run('P.nitroT'), 0);
  run(`G.bike = 10; G.owned.push(10); resetRace(4);`); quiet();
  assert.strictEqual(run('P.nitro'), 4);
  run(`Pressed['n'] = true;`); step(1);
  assert.ok(run('P.nitroT') > 3);
  assert.strictEqual(run('P.nitro'), 3);
});

test('every screen and both views draw without errors', () => {
  run(`showTitle(); render(); showCareer(); render(); showGarage(); showHelp(); resetRace(0); G.cam = 'cockpit';`);
  step(60, 'render()');
  run(`G.cam = 'chase'; Touch.on = true;`);
  step(60, 'render()');
  run(`pause(); render(); resume(); for (let t = 0; t < 5; t++) { resetRace(t); G.state = 'race'; render(); }`);
  run(`Touch.on = false;`);
});

test('all the painted artwork builds, with sensible sizes', () => {
  const o = JSON.parse(run(`JSON.stringify({
    facades: Art.FACADES.map((f, i) => [Art.facade(i, 0).width, Art.facade(i, 1).height]),
    shops: [0, 1, 2, 3, 4, 5].map(i => Art.shopfront(i).width),
    rocks: ['sand', 'granite'].map(k => Art.rock(k).height),
    sprites: ['tree', 'pine', 'palm', 'bush', 'cactus', 'rock', 'lamp', 'signal', 'pole', 'fence', 'guard', 'barn', 'sign'].map(k => { const s = Art.sprite(k, 3); return [k, s.ww > 0 && s.wh > 0]; }),
    bill: Art.billboard('GRIT COLA', '#d23b2f').ww,
    cars: ['car', 'van', 'truck'].flatMap(k => [1, -1].map(d => Art.vehicle(k, '#2a62b8', d).ww)),
    backs: ['skyline', 'sea', 'peaks', 'hills', 'mesas'].map(b => Art.backdrop(b).width),
  })`));
  assert.ok(o.facades.every(([w, h]) => w === 120 && h === 1600));
  assert.ok(o.shops.every(w => w === 120));
  assert.deepStrictEqual(o.rocks, [900, 900]);
  for (const [k, ok] of o.sprites) assert.ok(ok, k);
  assert.ok(o.bill > 0);
  assert.ok(o.cars.every(w => w > 400), 'vehicles are wider than their bodies, with room around them');
  assert.ok(o.backs.every(w => w === 2048));
  assert.strictEqual(run(`Art.sprite('tree', 1) === Art.sprite('tree', 4)`), true, 'painted once and reused');
});

test('each pose picks the right rendered frame', () => {
  const o = JSON.parse(run(`JSON.stringify([
    spriteFrame({ lean: 0 }), spriteFrame({ lean: 0.7 }), spriteFrame({ lean: -0.7 }), spriteFrame({ lean: 0.3 }),
    spriteFrame({ punch: true, side: 1 }), spriteFrame({ punch: true, side: -1 }), spriteFrame({ back: true, side: -1 }), spriteFrame({ kick: true, side: 1 }),
    spriteFrame({ swing: 0.1, side: 1, weapon: 'chain' }), spriteFrame({ swing: 0.9, side: 1, weapon: 'club' }), spriteFrame({ swing: 0.5, side: -1, weapon: 'chain' }),
    spriteFrame({ cop: true }, true), spriteFrame({ swing: 0.9, side: -1 }, true),
  ])`));
  assert.deepStrictEqual(o, [2, 4, 0, 3, 5, 6, 8, 9, 11, 16, 18, 2, 10]);
});

test('online: three players race the same road, see each other, trade hits, and get results', () => {
  const { createPage, channelPair } = require('./helpers/browser');
  const host = createPage('highway-brawl/index.html'), g1 = createPage('highway-brawl/index.html'), g2 = createPage('highway-brawl/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a; g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let i = 0; i < 3; i++) { c1.pump(); c2.pump(); } };
  const tick = (n, each = '') => { for (let i = 0; i < n; i++) { for (const p of [host, g1, g2]) p.run(`${each}; update(1 / 60)`); pump(); } };
  host.run(`G.level = 3; globalThis.r = Room.create('highway-brawl', 'Ana'); r.addChannel(c1); r.addChannel(c2); attachRoom(r);`);
  g1.run(`G.level = 1; attachRoom(Room.joinChannel(ch, 'Bo'))`);
  g2.run(`attachRoom(Room.joinChannel(ch, 'Cy'))`);
  pump();
  assert.strictEqual(g1.run('G.state'), 'netwait');
  assert.strictEqual(host.run('NET.peers.size'), 2);
  host.run('hostStart(2)'); pump();
  for (const p of [host, g1, g2]) {
    assert.strictEqual(p.run('T.id'), 'pass', 'everyone on Pine Pass');
    assert.strictEqual(p.run('G.level'), 3, 'at the host\'s level');
    assert.strictEqual(p.run('G.state'), 'count');
  }
  assert.strictEqual(g1.run('rivals.map(o => o.name).join()'), host.run('rivals.map(o => o.name).join()'), 'the same pack');
  tick(240, "Keys['w'] = G.state === 'race'");
  const hp = host.run('P.pos'), seen = g1.run('NET.peers.get(0).rpos');
  assert.ok(Math.abs(seen - hp) < 3000, 'guests see the host where the host is: ' + seen + ' vs ' + hp);
  // only the host runs the pack: a guest left at the start still sees every rider where the host has them
  tick(300, "Keys['w'] = G.state === 'race' && NET.room.isHost");
  const packOf = p => JSON.parse(p.run('JSON.stringify(rivals.map(o => Math.round(o.pos)))'));
  const hostPack = packOf(host), g2Pack = packOf(g2);
  const worst = Math.max(...hostPack.map((v, i) => Math.abs(v - g2Pack[i])));
  assert.ok(worst < 400, 'the pack is in the same place on every screen, worst gap ' + worst);
  const carsOf = p => JSON.parse(p.run('JSON.stringify(traffic.slice(0, 6).map(c => Math.round(c.pos)))'));
  const hc = carsOf(host), gc = carsOf(g1);
  assert.ok(hc.every((v, i) => Math.abs(v - gc[i]) < 200), 'traffic too: ' + hc + ' vs ' + gc);
  // a guest's punch on a rider is applied by the host
  g2.run(`globalThis.vic = rivals.find(o => o.state === 'ride' && !o.finishT); P.pos = vic.pos - 50; P.x = vic.off - 0.2; P.state = 'ride'; P.punchT = P.kickT = P.swingT = P.backT = 0; attack('punch')`);
  const vi = g2.run('rivals.indexOf(vic)'), before = host.run(`rivals[${vi}].hp`);
  pump();
  assert.ok(host.run(`rivals[${vi}].hp`) < before, 'the host applies the guest\'s punch to that rider');
  // Bo punches Ana, who is right alongside
  host.run('P.invuln = 0; P.hp = 100; P.state = "ride"');
  g1.run(`P.pos = NET.peers.get(0).rpos - 50; P.x = NET.peers.get(0).rx - 0.2; P.punchT = P.kickT = P.swingT = P.backT = 0; attack('punch')`);
  pump();
  assert.ok(host.run('P.hp') < 100, 'the punch lands on the host');
  // everyone crosses the line; results reach the guests, and nobody's career changes
  g1.run('globalThis.cash0 = G.cash');
  for (const p of [host, g1, g2]) p.run('P.pos = finishZ + 5; P.invuln = 5');
  tick(3);
  for (const p of [host, g1, g2]) assert.strictEqual(p.run('G.state'), 'over');
  assert.strictEqual(g2.run('NET.results.filter(r => r.place).length'), 3);
  assert.strictEqual(g1.run('G.cash'), g1.run('cash0'));
  // the host leaving ends it for everyone
  host.run(`leaveOnline('bye')`); pump();
  assert.strictEqual(g1.run('online()'), false);
  assert.strictEqual(g1.run('G.level'), 1, 'back to their own level');
});

test('a first frame stamped before start-up does not run the clock backwards', () => {
  run(`showTitle(); P.pos = 0; last = 1000; frame(990); frame(1006);`);
  assert.ok(run('P.pos') >= 0);
  assert.strictEqual(run('G.state'), 'menu');
});

test('online pack updates: riders squeeze into a few bytes each and come back the same', () => {
  const o = JSON.parse(run(`(() => {
    const list = [{ pos: 523411, off: -0.42, speed: 9100, hp: 73, state: 'down', punchT: 0, swingT: 0.2, weapon: 'club' },
                  { pos: 3200, off: 0.85, speed: 0, hp: 100, state: 'ride', punchT: 0.1, swingT: 0, weapon: null }];
    const str = packBytes(list), back = unpackBytes(str, 2);
    const cop = unpackBytes(packBytes([{ pos: 99999, off: 0.3, speed: 15000, hp: 120, state: 'chase', punchT: 0, swingT: 0.3 }], true), 1)[0];
    return JSON.stringify({ len: packBytes(rivals).length, back, cop, str }); })()`));
  assert.ok(o.len < 160, '15 riders in ' + o.len + ' characters');
  assert.match(o.str, /^[A-Za-z0-9_-]+$/);
  const [a, b] = o.back;
  assert.ok(Math.abs(a.pos - 523411) <= 1 && Math.abs(a.off + 0.42) < 0.01 && Math.abs(a.speed - 9100) < 64 && a.hp === 73);
  assert.deepStrictEqual([a.st, a.pose, a.w], [1, 2, 1]);
  assert.deepStrictEqual([b.pos, b.st, b.pose, b.w, b.hp], [3200, 0, 1, 0, 100]);
  assert.deepStrictEqual([o.cop.st, o.cop.pose, Math.round(o.cop.speed / 1000)], [1, 2, 15]);
});
