'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
// a fixed roll for the next doRoll call
const roll = (page, n) => page.run(`doRoll(G.turn, () => ${(n - 0.5) / 6})`);

test('the track has 52 distinct cells, and every seat\'s path ends in its own home column', () => {
  const { run } = createPage('ludo/index.html');
  assert.strictEqual(run('TRACK.length'), 52);
  assert.strictEqual(run('new Set(TRACK.map(c => c.join())).size'), 52);
  for (let s = 0; s < 4; s++) {
    // the last main-track cell sits next to the first home-column cell
    const last = json({ run }, `TRACK[absCell(${s}, 50)]`), first = json({ run }, `HOME_COL[${s}][0]`);
    assert.strictEqual(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]), 1, 'seat ' + s);
  }
  for (let i = 1; i < 52; i++) {
    const a = json({ run }, `TRACK[${i - 1}]`), b = json({ run }, `TRACK[${i}]`);
    assert.ok(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 2, 'cells ' + (i - 1) + ' and ' + i + ' are neighbours');
  }
});

test('rules: a six to start, exact roll home, captures, and safe squares', () => {
  const { run } = createPage('ludo/index.html');
  run('globalThis.t = [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]');
  assert.deepStrictEqual(json({ run }, 'legalMoves(t, 0, 5)'), []);
  assert.deepStrictEqual(json({ run }, 'legalMoves(t, 0, 6)'), [0, 1, 2, 3]);
  run('t[0][0] = 53');
  assert.deepStrictEqual(json({ run }, 'legalMoves(t, 0, 4)'), [], 'can\'t overshoot home');
  assert.deepStrictEqual(json({ run }, 'legalMoves(t, 0, 3)'), [0]);
  assert.strictEqual(run('moveToken(t, 0, 0, 3).home'), true);

  // red at 10 moves 3 onto green's token at absolute cell 13? 13 is a safe start square
  run('t = [[10, -1, -1, -1], [0, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]');
  assert.deepStrictEqual(json({ run }, 'moveToken(t, 0, 0, 3).captured'), [], 'no captures on a start square');
  // green at its 2 is absolute 15
  run('t = [[10, -1, -1, -1], [2, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]');
  assert.deepStrictEqual(json({ run }, 'moveToken(t, 0, 0, 5).captured'), [[1, 0]]);
  assert.strictEqual(run('t[1][0]'), -1, 'the captured token goes back to its yard');
});

test('turns: sixes and captures roll again, three sixes lose the turn', () => {
  const page = createPage('ludo/index.html');
  page.run(`local = true; startGame([{ kind: 'human' }, null, { kind: 'human' }, null])`);
  assert.strictEqual(page.run('G.turn'), 0);
  roll(page, 3);
  assert.strictEqual(page.run('G.phase'), 'pause', 'no token out yet');
  page.run('G.pauseUntil = 0; tick()');
  assert.strictEqual(page.run('G.turn'), 2, 'empty seats are skipped');

  roll(page, 6);
  page.run('doMove(2, 0)');
  assert.strictEqual(page.run('G.tokens[2][0]'), 0);
  assert.strictEqual(page.run('G.turn'), 2, 'a six rolls again');
  roll(page, 6); page.run('doMove(2, 0)');
  roll(page, 6);
  assert.strictEqual(page.run('G.phase'), 'pause', 'third six');
  page.run('G.pauseUntil = 0; tick()');
  assert.strictEqual(page.run('G.turn'), 0);
});

test('a bot game always finishes with a winner', () => {
  const page = createPage('ludo/index.html');
  const out = page.run(`(() => {
    local = true; let s = 3; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    startGame([{ kind: 'bot' }, { kind: 'bot' }, { kind: 'bot' }, { kind: 'bot' }]);
    let n = 0;
    while (G.phase !== 'over' && n++ < 20000) { G.botAt = 0; G.pauseUntil = 0; tick(); }
    return [G.phase, G.winner, n];
  })()`);
  assert.strictEqual(out[0], 'over');
  assert.ok(out[1] >= 0 && out[1] < 4);
});

test('the bot prefers a capture', () => {
  const { run } = createPage('ludo/index.html');
  run('globalThis.t = [[10, 30, -1, -1], [2, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]');
  assert.strictEqual(run('botChoice(t, 0, 5, () => 0)'), 0);
});

test('online: the host rolls for everyone, only the player whose turn it is can act', () => {
  const host = createPage('ludo/index.html');
  const g1 = createPage('ludo/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; g1.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('ludo', 'Ana'); r.addChannel(c);`);
  g1.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('attach(r); startGame(onlineSeats(false))');
  c.pump();
  assert.deepStrictEqual(json(g1, 'V.seats.map(s => s && s.name)'), ['Ana', null, 'Bo', null], 'two players sit opposite');
  g1.run(`act({ t: 'roll' })`);
  c.pump();
  assert.strictEqual(host.run('G.roll'), 0, "not Bo's turn");
  host.run('doRoll(0, () => 0.99)');
  c.pump();
  assert.strictEqual(g1.run('V.roll'), 6);
  host.run(`act({ t: 'move', k: 1 })`);
  c.pump();
  assert.strictEqual(g1.run('V.tokens[0][1]'), 0);
  host.run('doRoll(0, () => 0.1)');
  host.run('G.autoAt = 0; doMove(0, 1)');
  c.pump();
  assert.strictEqual(g1.run('V.turn'), 2);
  g1.run(`act({ t: 'roll' })`);
  c.pump();
  assert.ok(host.run('G.roll') > 0, 'Bo rolls through the host');

  c.close();
  c.pump();
  assert.strictEqual(host.run('G.seats[2].kind'), 'bot', 'a bot takes over when a player leaves');
});
