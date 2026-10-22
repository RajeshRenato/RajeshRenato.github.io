'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const IN = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, S: 64 };

// A fight already past the round intro, the fighters a set distance apart.
function fight(page, c1 = 'kai', c2 = 'kai', gap = 90) {
  page.run(`M = newMatch('${c1}', '${c2}'); M.phase = 'fight'; M.f[0].x = 500 * SUB; M.f[1].x = (500 + ${gap}) * SUB;`);
}
const run = (page, frames, b0 = 0, b1 = 0) => page.run(`for (let i = 0; i < ${frames}; i++) step(M, ${b0}, ${b1})`);
const tap = (page, b0, b1 = 0) => { run(page, 1, b0, b1); run(page, 1, 0, b1); };

test('a punch lands, and holding back blocks it', () => {
  const page = createPage('dojo-duel/index.html');
  fight(page);
  tap(page, IN.P);
  run(page, 10);
  assert.ok(page.run('M.f[1].hp') < 100, 'the jab hit');
  fight(page);
  run(page, 1, IN.P, IN.R);            // the right-hand fighter holds back (away, to the right)
  run(page, 10, 0, IN.R);
  assert.strictEqual(page.run('M.f[1].hp'), 100, 'blocked');
  assert.strictEqual(page.run(`M.events.length >= 0 && M.f[1].state !== 'hitstun'`), true);
});

test('a sweep needs a crouching block, a jump-in needs a standing one', () => {
  const page = createPage('dojo-duel/index.html');
  fight(page);
  run(page, 1, IN.D | IN.K, IN.R);      // standing block against a sweep
  run(page, 14, IN.D, IN.R);
  assert.ok(page.run('M.f[1].hp') < 100, 'a standing block does not stop a low');
  fight(page);
  run(page, 1, IN.D | IN.K, IN.R | IN.D);
  run(page, 14, IN.D, IN.R | IN.D);
  assert.strictEqual(page.run('M.f[1].hp'), 100, 'a crouching block does');
});

test('quarter-circle forward and punch throws a fireball that crosses the screen', () => {
  const page = createPage('dojo-duel/index.html');
  fight(page, 'kai', 'kai', 400);
  // down, down-forward, forward, punch: forward is to the right for the left fighter
  for (const b of [IN.D, IN.D | IN.R, IN.R, IN.R | IN.P]) run(page, 2, b);
  run(page, 14);
  assert.strictEqual(page.run('M.proj.length'), 1, 'a fireball is out');
  run(page, 60);
  assert.ok(page.run('M.f[1].hp') < 100, 'and it hit');
  assert.strictEqual(page.run('motion({ face: 1, hist: [8, 10, 2] })'), 'qcf');
  assert.strictEqual(page.run('motion({ face: 1, hist: [2, 8, 10] })'), 'dp');
  assert.strictEqual(page.run('motion({ face: -1, hist: [8, 10, 2] })'), 'qcb', 'backward when facing left');
});

test('the Special button does the same without the motion', () => {
  const page = createPage('dojo-duel/index.html');
  fight(page, 'kai', 'kai', 400);
  tap(page, IN.S);
  run(page, 14);
  assert.strictEqual(page.run('M.proj.length'), 1);
  fight(page, 'rena', 'kai', 300);
  tap(page, IN.S);
  run(page, 30);
  assert.ok(page.run('M.f[0].x') > 520 * 16, 'Rena\'s dash strike carries her forward');
});

test('a knockout ends the round, two rounds win the match, and time decides on health', () => {
  const page = createPage('dojo-duel/index.html');
  fight(page);
  page.run('M.f[1].hp = 3');
  tap(page, IN.K);
  run(page, 20);
  assert.strictEqual(page.run('M.phase'), 'end');
  assert.strictEqual(page.run('M.f[0].wins'), 1);
  run(page, 160);
  assert.strictEqual(page.run('M.phase'), 'intro');
  assert.strictEqual(page.run('M.round'), 2);
  assert.strictEqual(page.run('M.f[1].hp'), 100, 'health back for the next round');
  page.run(`M.phase = 'fight'; M.timer = 1; M.f[0].hp = 40; M.f[1].hp = 70`);
  run(page, 2);
  assert.strictEqual(page.run('M.roundWinner'), 1, 'more health left wins on time');
  page.run(`M.f[1].wins = 2; M.winner = 1`);
  run(page, 160);
  assert.strictEqual(page.run('M.phase'), 'over');
});

test('the fight is deterministic: the same buttons give the same result', () => {
  const page = createPage('dojo-duel/index.html');
  const play = () => json(page, `(() => { let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    M = newMatch('bruno', 'rena'); M.phase = 'fight';
    for (let i = 0; i < 1500; i++) step(M, Math.floor(r() * 128), Math.floor(r() * 128));
    return M.f.map(f => [f.x, f.y, f.hp, f.state, f.wins]).concat([[M.round, M.timer, M.proj.length]]); })()`);
  assert.deepStrictEqual(play(), play());
});

test('the CPU fights back: a CPU against a CPU finishes a match', () => {
  const page = createPage('dojo-duel/index.html');
  page.run(`(() => { let s = 4; cpuRand = () => (s = (s * 16807) % 2147483647) / 2147483647; })()`);
  page.run(`M = newMatch('kai', 'bruno'); for (let i = 0; i < 60 * 60 * 6 && M.phase !== 'over'; i++) step(M, cpuInput(M, 0, 3, cpuRand), cpuInput(M, 1, 2, cpuRand))`);
  assert.strictEqual(page.run('M.phase'), 'over');
  assert.ok(page.run('M.f[0].wins + M.f[1].wins') >= 2);
});

test('online lockstep: both browsers stay in step, and stall rather than guess', () => {
  const host = createPage('dojo-duel/index.html'), guest = createPage('dojo-duel/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('dojo-duel', 'Ana'); r.addChannel(ch); startOnline(r);`);
  guest.run(`startOnline(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  guest.run(`room.send({ t: 'pick', c: 'rena' })`);
  c.pump();
  host.run(`netPick[0] = 'bruno'; startOnlineFight()`);
  c.pump();
  assert.deepStrictEqual(json(guest, 'M.f.map(f => f.cid)'), ['bruno', 'rena']);
  assert.strictEqual(guest.run('mySide'), 1);
  // 600 frames of random buttons from both sides, delivered with the channel pumped every few frames
  host.run(`globalThis.hr = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })()`);
  guest.run(`globalThis.gr = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })()`);
  let stalls = 0;
  for (let i = 0; i < 600; i++) {
    if (!host.run('netStep(Math.floor(hr() * 128))')) stalls++;
    guest.run('netStep(Math.floor(gr() * 128))');
    if (i % 7 === 0) c.pump();   // slower than the input delay, so sometimes a side has to wait
  }
  c.pump();
  for (let i = 0; i < 20; i++) { host.run('netStep(0)'); guest.run('netStep(0)'); c.pump(); }
  const fh = host.run('net.frame'), fg = guest.run('net.frame');
  const upTo = Math.min(fh, fg);
  assert.ok(upTo > 300, 'the fight moved on: ' + upTo);
  // bring both to the same frame and compare
  for (let i = 0; i < 10; i++) { if (host.run('net.frame') < guest.run('net.frame')) host.run('netStep(0)'); else if (guest.run('net.frame') < host.run('net.frame')) guest.run('netStep(0)'); c.pump(); }
  assert.strictEqual(host.run('net.frame'), guest.run('net.frame'));
  assert.deepStrictEqual(json(host, 'M.f.map(f => [f.x, f.y, f.hp, f.state])'), json(guest, 'M.f.map(f => [f.x, f.y, f.hp, f.state])'));
  assert.ok(stalls > 0, 'it waited for late buttons instead of guessing');
  // forged messages are ignored
  guest.run(`room.send({ t: 'in', f: -5, b: 1 }); room.send({ t: 'in', f: 1e9, b: 1 }); room.send({ t: 'go', c: ['nobody'], n: [] })`);
  c.pump();
  assert.strictEqual(host.run('M.f[0].cid'), 'bruno');
});
