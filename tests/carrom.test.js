'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

test('the rack: 9 white, 9 black, the queen in the middle, nothing overlapping', () => {
  const page = createPage('carrom/index.html');
  const coins = json(page, 'rack()');
  assert.strictEqual(coins.length, 19);
  assert.strictEqual(coins.filter(c => c.kind === 'white').length, 9);
  assert.strictEqual(coins.filter(c => c.kind === 'black').length, 9);
  assert.deepStrictEqual([coins[0].kind, coins[0].x, coins[0].y], ['queen', 500, 500]);
  for (let i = 0; i < 19; i++) for (let j = i + 1; j < 19; j++) {
    assert.ok(Math.hypot(coins[i].x - coins[j].x, coins[i].y - coins[j].y) >= 43.5, 'coins ' + i + ' and ' + j + ' overlap');
  }
});

test('physics: the heavier striker drives a coin, cushions bounce, pockets catch, and it is repeatable', () => {
  const page = createPage('carrom/index.html');
  page.run(`globalThis.bs = [{ kind: 'striker', x: 300, y: 500, vx: 1200, vy: 0, in: false }, { kind: 'white', id: 1, x: 400, y: 500, vx: 0, vy: 0, in: false }];
    for (let i = 0; i < 20; i++) physStep(bs, SUB);`);
  const [s, c] = json(page, 'bs.map(b => b.vx)');
  assert.ok(c > s && c > 1200, 'the coin leaves faster than the striker came: ' + c.toFixed(0));
  page.run(`globalThis.wall = [{ kind: 'white', id: 1, x: 950, y: 500, vx: 800, vy: 0, in: false }]; for (let i = 0; i < 60; i++) physStep(wall, SUB);`);
  assert.ok(page.run('wall[0].vx') < 0, 'bounced off the cushion');
  page.run(`globalThis.pk = [{ kind: 'black', id: 2, x: 200, y: 200, vx: -900, vy: -900, in: false }]; globalThis.fell = simulate(pk);`);
  assert.strictEqual(page.run('fell.length'), 1);
  const run = () => json(page, `(() => { const b = rack(); b.push({ kind: 'striker', x: 520, y: 862, vx: -60, vy: -2400, in: false }); simulate(b); return b.map(q => [q.x, q.y, q.in]); })()`);
  assert.deepStrictEqual(run(), run(), 'the same shot ends the same way');
});

// a two-player game on this device, coins placed by hand
function game(page) {
  page.run(`local = true; startGame([{ kind: 'human', name: 'A' }, null, { kind: 'human', name: 'B' }, null], 2);`);
}
const coinsOf = (page, kind) => `G.coins.filter(c => c.kind === '${kind}')`;

test('rules: your coin keeps the turn, the other side\'s or nothing passes it, and the striker is a foul', () => {
  const page = createPage('carrom/index.html');
  game(page);
  assert.deepStrictEqual(json(page, 'G.team'), [0, 1, 0, 1].map((t, i) => (i === 2 ? 1 : t)), 'two players face each other as white and black');
  page.run(`{ const c = ${coinsOf(page, 'white')}[0]; c.in = true; settle([c]) }`);
  assert.strictEqual(page.run('G.turn'), 0, 'pocketed a white: shoot again');
  page.run(`{ const c = ${coinsOf(page, 'black')}[0]; c.in = true; settle([c]) }`);
  assert.strictEqual(page.run('G.turn'), 2, 'a black for the other side: turn passes');
  assert.strictEqual(page.run('G.pocketed[1].length'), 1);
  page.run(`{ const c = ${coinsOf(page, 'black')}[1]; c.in = true; settle([c, { kind: 'striker' }]) }`);
  assert.strictEqual(page.run('G.turn'), 0, 'a foul passes the turn');
  assert.strictEqual(page.run('G.pocketed[1].length'), 1, 'and one of their pocketed coins came back out');
  assert.strictEqual(page.run(`${coinsOf(page, 'black')}.filter(c => !c.in).length`), 8);
});

test('the queen: cover her on the next shot, or she goes back', () => {
  const page = createPage('carrom/index.html');
  game(page);
  page.run(`{ const q = G.coins.find(c => c.kind === 'queen'); q.in = true; settle([q]) }`);
  assert.strictEqual(page.run('G.queen.pending'), 0);
  assert.strictEqual(page.run('G.turn'), 0, 'gets a shot to cover');
  page.run('settle([])');
  assert.strictEqual(page.run(`G.coins.find(c => c.kind === 'queen').in`), false, 'not covered: back on the board');
  assert.strictEqual(page.run('G.turn'), 2);
  page.run(`{ const q = G.coins.find(c => c.kind === 'queen'); q.in = true; settle([q]); const c = ${coinsOf(page, 'black')}[0]; c.in = true; settle([c]) }`);
  assert.deepStrictEqual(json(page, '[G.queen.covered, G.queen.by]'), [true, 1]);
});

test('you can\'t finish before the queen is covered, and the winner scores the other side\'s coins', () => {
  const page = createPage('carrom/index.html');
  game(page);
  page.run(`{ const ws = ${coinsOf(page, 'white')}; ws.slice(0, 8).forEach(c => { c.in = true; G.pocketed[0].push(c.id); }); const last = ws[8]; last.in = true; settle([last]) }`);
  assert.strictEqual(page.run(`${coinsOf(page, 'white')}.filter(c => !c.in).length`), 1, 'the last white came back');
  assert.strictEqual(page.run('G.phase'), 'aim');
  page.run(`{ const q = G.coins.find(c => c.kind === 'queen'); const last = ${coinsOf(page, 'white')}.find(c => !c.in); G.turn = 0; q.in = true; last.in = true; settle([q, last]) }`);
  assert.strictEqual(page.run('G.phase'), 'over');
  assert.strictEqual(page.run('G.winner'), 0);
  assert.strictEqual(page.run('G.points[0]'), 9 + 3, 'nine black coins left, plus the queen');
});

test('the bot finds shots that pocket its coins, and a sharper bot finds more', () => {
  const page = createPage('carrom/index.html');
  game(page);
  page.run(`globalThis.rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })()`);
  // each try: a few white coins scattered, and one black, placed at random
  const tries = level => json(page, `(() => { let hits = 0;
    for (let k = 0; k < 16; k++) {
      for (const c of G.coins) c.in = true;
      G.coins.filter(c => c.kind === 'white').slice(0, 3).forEach(c => { c.in = false; c.x = 150 + rnd() * 700; c.y = 150 + rnd() * 600; });
      const b = G.coins.find(c => c.kind === 'black'); b.in = false; b.x = 150 + rnd() * 700; b.y = 150 + rnd() * 600;
      if (!strikerFits(0, 0) && !strikerFits(0, 0.5)) continue;
      const s = botShot(0, ${level}, rnd); if (!s) continue;
      const bodies = G.coins.map(c => ({ ...c })), [x, y] = baseSpot(0, s.u);
      bodies.push({ kind: 'striker', x, y, vx: s.vx, vy: s.vy, in: false });
      if (simulate(bodies).some(f => f.kind === 'white')) hits++;
    }
    return hits; })()`);
  const sharp = tries(3), easy = tries(1);
  assert.ok(sharp >= 8, 'a sharp bot pockets on most tries: ' + sharp + ' of 16');
  assert.ok(sharp > easy, 'sharper than easy: ' + sharp + ' against ' + easy);
});

test('online: the guest shoots on its turn, and its replay of the shot ends exactly where the host\'s does', () => {
  const host = createPage('carrom/index.html'), guest = createPage('carrom/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('carrom', 'Ana'); r.addChannel(ch); attach(r);`);
  guest.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run(`startGame([{ kind: 'human', id: 0, name: 'Ana' }, null, { kind: 'human', id: 1, name: 'Bo' }, null], 2); G.turn = 2; publish();`);
  c.pump();
  guest.run(`act({ t: 'shot', u: 0.1, vx: 30, vy: 2300 })`);
  c.pump();
  assert.strictEqual(host.run('G.phase'), 'roll', 'the host took the guest\'s shot');
  // both play the shot out
  host.run('for (let i = 0; i < 2000 && roll; i++) stepRoll(1 / 60)');
  guest.run('for (let i = 0; i < 2000 && roll && moving(roll.bodies); i++) stepRoll(1 / 60)');
  const g = json(guest, 'roll.bodies.filter(b => b.kind !== "striker").map(b => [b.id, Math.round(b.x * 100), Math.round(b.y * 100), b.in])');
  const h = json(host, 'G.coins.map(b => [b.id, Math.round(b.x * 100), Math.round(b.y * 100), b.in])');
  assert.deepStrictEqual(g, h);
  c.pump();
  assert.strictEqual(guest.run('V.phase'), 'aim');
  // out of turn, forged, or broken input is ignored
  const turn = host.run('G.turn');
  if (turn === 0) { guest.run(`act({ t: 'shot', u: 0, vx: 0, vy: -2000 })`); c.pump(); assert.strictEqual(host.run('G.phase'), 'aim'); }
  host.run(`room.send({ t: 'state', seats: [], coins: 'x' }); room.send({ t: 'state', seats: [null, null, null, null], coins: [[1, 'white', 9999, 0, 0]], turn: 0, phase: 'aim' })`);
  c.pump();
  assert.strictEqual(guest.run('V.coins.length'), 19);
});
