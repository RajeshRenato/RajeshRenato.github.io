'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

test('the board numbers snake up from the bottom left', () => {
  const page = createPage('snakes-ladders/index.html');
  assert.deepStrictEqual(json(page, '[cellOf(1), cellOf(10), cellOf(11), cellOf(20), cellOf(21), cellOf(100)]'), [[0, 0], [9, 0], [9, 1], [0, 1], [0, 2], [0, 9]]);
  // ladders go up, snakes go down, and no square starts two things or ends on a start
  const L = json(page, 'LADDERS'), Sn = json(page, 'SNAKES');
  for (const [a, b] of Object.entries(L)) assert.ok(+b > +a);
  for (const [a, b] of Object.entries(Sn)) assert.ok(+b < +a);
  const starts = new Set([...Object.keys(L), ...Object.keys(Sn)].map(Number));
  assert.strictEqual(starts.size, Object.keys(L).length + Object.keys(Sn).length);
  for (const end of [...Object.values(L), ...Object.values(Sn)]) assert.ok(!starts.has(end), end + ' is not also a start');
  assert.ok(!starts.has(100) && !starts.has(1));
});

test('moves: square by square, then the ladder or snake; the end needs an exact roll', () => {
  const page = createPage('snakes-ladders/index.html');
  const plan = (pos, roll, rules = '{ start6: false, exact: true }') => json(page, `plan(${pos}, ${roll}, ${rules})`);
  assert.deepStrictEqual(plan(0, 2), { to: 2, steps: [1, 2], jump: null, moved: true });
  const up = plan(0, 3);
  assert.strictEqual(up.to, 22);
  assert.deepStrictEqual(up.jump, { from: 3, to: 22, kind: 'ladder' });
  const down = plan(94, 5);
  assert.strictEqual(down.to, 79, 'the snake on 99');
  assert.strictEqual(plan(97, 5).moved, false, 'too far: stay put');
  assert.strictEqual(plan(97, 5, '{ exact: false }').to, 100, 'without the exact rule a big roll finishes');
  assert.strictEqual(plan(0, 4, '{ start6: true, exact: true }').moved, false, 'needs a six to start');
  assert.strictEqual(plan(0, 6, '{ start6: true, exact: true }').to, 6);
});

test('a game: turns rotate, a six rolls again, three sixes pass the turn, and reaching 100 wins', () => {
  const page = createPage('snakes-ladders/index.html');
  page.run(`local = true; startGame([{ kind: 'human', name: 'Ana' }, { kind: 'human', name: 'Bo' }, null, null], { start6: false, exact: true })`);
  const roll = (n, seat) => page.run(`doRoll(${seat}, () => (${n} - 1) / 6 + 0.01); G.pauseUntil = 0; tick()`);
  roll(2, 0);
  assert.strictEqual(page.run('G.pos[0]'), 2);
  assert.strictEqual(page.run('G.turn'), 1);
  roll(4, 0);
  assert.strictEqual(page.run('G.pos[0]'), 2, 'not your turn');
  roll(6, 1);
  assert.strictEqual(page.run('G.turn'), 1, 'a six rolls again');
  roll(6, 1); roll(6, 1);
  assert.strictEqual(page.run('G.turn'), 0, 'three sixes pass the turn');
  assert.strictEqual(page.run('G.pos[1]'), 12, 'two sixes moved, the third did not');
  page.run('G.pos[0] = 96');
  roll(4, 0);
  assert.strictEqual(page.run('G.phase'), 'over');
  assert.strictEqual(page.run('G.winner'), 0);
});

test('bots play their own turns', () => {
  const page = createPage('snakes-ladders/index.html');
  page.run(`(() => { let seed = 3; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647; })()`);
  page.run(`local = true; startGame([{ kind: 'bot' }, { kind: 'bot' }, null, null], { start6: false, exact: true })`);
  page.run(`for (let i = 0; i < 5000 && G.phase !== 'over'; i++) { G.botAt = 0; G.pauseUntil = 0; tick(); }`);
  assert.strictEqual(page.run('G.phase'), 'over');
  assert.strictEqual(page.run('G.pos[G.winner]'), 100);
});

test('online: the host runs the dice, guests only roll on their own turn, and broken state is ignored', () => {
  const host = createPage('snakes-ladders/index.html'), guest = createPage('snakes-ladders/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('snakes-ladders', 'Ana'); r.addChannel(ch); attach(r);`);
  guest.run(`attach(Room.joinChannel(ch, 'Bo <i>'))`);
  c.pump();
  host.run(`startGame([{ kind: 'human', id: 0, name: 'Ana' }, { kind: 'human', id: 1, name: 'Bo <i>' }, null, null], { start6: false, exact: true })`);
  c.pump();
  assert.strictEqual(guest.run('V.phase'), 'roll');
  guest.run(`act({ t: 'roll' })`);
  c.pump();
  assert.strictEqual(host.run('G.pos[1]'), 0, 'not the guest\'s turn yet');
  host.run(`doRoll(0, () => 0.3); G.pauseUntil = 0; tick()`);   // a 2, so the turn passes
  c.pump();
  assert.strictEqual(host.run('G.turn'), 1);
  guest.run(`act({ t: 'roll' })`);
  c.pump();
  assert.ok(host.run('G.pos[1]') > 0);
  assert.strictEqual(guest.run('V.pos[1]'), host.run('G.pos[1]'));
  assert.ok(!guest.run(`$('players').innerHTML`).includes('<i>B'), 'names stay text');
  host.run(`room.send({ t: 'state', seats: [], pos: [999] }); room.send({ t: 'state', seats: [null, null, null, null], pos: [0, 0, 0, 500], turn: 0, phase: 'roll', log: [] })`);
  c.pump();
  assert.strictEqual(guest.run('V.pos[1]'), host.run('G.pos[1]'));
});
