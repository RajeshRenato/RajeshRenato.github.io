'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

function table(n = 4) {
  const host = createPage('clue-grid/index.html');
  host.run(`globalThis.r = Room.create('clue-grid', 'P0')`);
  const pages = [host], chans = [];
  for (let i = 1; i < n; i++) {
    const g = createPage('clue-grid/index.html');
    const c = channelPair();
    host.sandbox.c = c.a; host.run('r.addChannel(c)');
    g.sandbox.ch = c.b;
    g.run(`attach(Room.joinChannel(ch, 'P${i}'))`);
    pages.push(g); chans.push(c);
  }
  const pump = () => { for (let k = 0; k < 4; k++) for (const c of chans) c.pump(); };
  pump();
  host.run('attach(r)');
  pump();
  return { host, pages, chans, pump };
}

// put players 0 and 2 on red, 1 and 3 on blue, with 0 and 1 as spymasters
function seat(t) {
  t.pages[0].run(`act({ t: 'role', team: 'r', spy: true })`);
  t.pages[2].run(`act({ t: 'role', team: 'r' })`);
  t.pages[1].run(`act({ t: 'role', team: 'b', spy: true })`);
  t.pages[3].run(`act({ t: 'role', team: 'b' })`);
  t.pump();
}

test('the word list is long enough and has no repeats', () => {
  const { run } = createPage('clue-grid/index.html');
  assert.ok(run('WORDS.length') >= 400);
  assert.strictEqual(run('new Set(WORDS).size === WORDS.length'), true);
});

test('teams: everyone is placed, and the game starts only with two full teams', () => {
  const t = table(4);
  assert.deepStrictEqual(Object.values(json(t.host, 'H.team')).sort(), ['b', 'b', 'r', 'r']);
  seat(t);
  assert.deepStrictEqual(json(t.pages[3], 'V.spy'), { r: 0, b: 1 });
  t.pages[2].run(`act({ t: 'role', team: 'b' })`);
  t.pump();
  assert.strictEqual(t.host.run('canStart()'), false, 'red would have no guesser');
  t.pages[2].run(`act({ t: 'role', team: 'r' })`);
  t.pump();
  assert.strictEqual(t.host.run('canStart()'), true);
});

test('only spymasters receive the key, and the board has the right mix', () => {
  const t = table(4);
  seat(t);
  t.host.run('hostStart()');
  t.pump();
  const key = json(t.host, 'H.key');
  assert.strictEqual(key.filter(k => k === 'r').length, 9, 'the starting team has 9');
  assert.strictEqual(key.filter(k => k === 'b').length, 8);
  assert.strictEqual(key.filter(k => k === 'n').length, 7);
  assert.strictEqual(key.filter(k => k === 'x').length, 1);
  assert.deepStrictEqual(json(t.pages[1], 'V.key'), key);
  assert.strictEqual(t.pages[2].run('V.key'), null);
  assert.strictEqual(t.pages[3].run('V.key'), null);
  assert.deepStrictEqual(json(t.pages[2], 'V.words'), json(t.host, 'H.words'));
});

test('clues are checked, guesses follow the rules, and turns pass', () => {
  const t = table(4);
  seat(t);
  t.host.run('hostStart()');
  t.pump();
  const words = json(t.host, 'H.words'), key = json(t.host, 'H.key');

  t.pages[1].run(`act({ t: 'clue', word: 'water', n: 2 })`);
  t.pump();
  assert.strictEqual(t.host.run('H.phase'), 'clue', 'blue cannot give a clue on red\'s turn');

  t.host.run(`act({ t: 'clue', word: ${JSON.stringify(words[0])}, n: 1 })`);
  assert.match(t.host.run('clueError'), /on the board/);
  t.host.run(`act({ t: 'clue', word: 'two words', n: 1 })`);
  assert.match(t.host.run('clueError'), /one word/);

  t.host.run(`act({ t: 'clue', word: 'zzyzx', n: 2 })`);
  t.pump();
  assert.strictEqual(t.pages[3].run('V.phase'), 'guess');
  assert.strictEqual(t.pages[3].run('V.left'), 3);

  const reds = key.map((k, i) => (k === 'r' ? i : -1)).filter(i => i >= 0);
  t.pages[3].run(`act({ t: 'tap', i: ${reds[0]} })`);
  t.host.run(`act({ t: 'tap', i: ${reds[0]} })`);
  t.pump();
  assert.strictEqual(t.host.run(`H.revealed[${reds[0]}]`), false, 'blue and the spymaster cannot guess for red');

  t.pages[2].run(`act({ t: 'tap', i: ${reds[0]} })`);
  t.pump();
  assert.strictEqual(t.pages[3].run(`V.revealed[${reds[0]}]`), 'r');
  assert.strictEqual(t.host.run('H.left'), 2);
  assert.strictEqual(t.pages[1].run('V.remaining.r'), 8);

  const neutral = key.indexOf('n');
  t.pages[2].run(`act({ t: 'tap', i: ${neutral} })`);
  t.pump();
  assert.strictEqual(t.host.run('H.turn'), 'b', 'a bystander ends the turn');
  assert.strictEqual(t.host.run('H.phase'), 'clue');

  t.pages[1].run(`act({ t: 'clue', word: 'qwop', n: 1 })`);
  t.pump();
  t.pages[3].run(`act({ t: 'pass' })`);
  t.pump();
  assert.strictEqual(t.host.run('H.turn'), 'r', 'ending guessing passes the turn');
});

test('the assassin loses the game, finding all your words wins it, and the key is shown to all after', () => {
  const t = table(4);
  seat(t);
  t.host.run('hostStart()');
  t.pump();
  let key = json(t.host, 'H.key');
  t.host.run(`act({ t: 'clue', word: 'zzyzx', n: 0 })`);
  t.pump();
  t.pages[2].run(`act({ t: 'tap', i: ${key.indexOf('x')} })`);
  t.pump();
  assert.strictEqual(t.host.run('H.phase'), 'over');
  assert.strictEqual(t.pages[3].run('V.winner'), 'b');
  assert.deepStrictEqual(json(t.pages[2], 'V.key'), key);

  t.host.run('hostNext(false)');
  t.pump();
  assert.strictEqual(t.host.run('H.turn'), 'b', 'the starting team alternates');
  key = json(t.host, 'H.key');
  t.pages[1].run(`act({ t: 'clue', word: 'zzyzx', n: 0 })`);
  t.pump();
  for (const i of key.map((k, i) => (k === 'b' ? i : -1)).filter(i => i >= 0)) { t.pages[3].run(`act({ t: 'tap', i: ${i} })`); t.pump(); }
  assert.strictEqual(t.host.run('H.winner'), 'b');
  assert.match(t.pages[2].run('V.reason'), /found all their words/);
});

test('a spymaster who leaves is replaced, and a late joiner lands on a team', () => {
  const t = table(5);
  t.pages[0].run(`act({ t: 'role', team: 'r', spy: true })`);
  t.pages[2].run(`act({ t: 'role', team: 'r' })`);
  t.pages[4].run(`act({ t: 'role', team: 'b' })`);
  t.pages[1].run(`act({ t: 'role', team: 'b', spy: true })`);
  t.pages[3].run(`act({ t: 'role', team: 'b' })`);
  t.pump();
  t.host.run('hostStart()');
  t.pump();
  t.chans[0].close();
  t.pump();
  const spyB = t.host.run('H.spy.b');
  assert.ok(spyB === 3 || spyB === 4);
  assert.ok(t.pages[spyB].run('V.key') !== null, 'the new spymaster gets the key');

  const late = createPage('clue-grid/index.html');
  const c = channelPair();
  t.host.sandbox.c = c.a; t.host.run('r.addChannel(c)');
  late.sandbox.ch = c.b; late.run(`attach(Room.joinChannel(ch, 'Late'))`);
  for (let k = 0; k < 4; k++) { c.pump(); for (const x of t.chans.slice(1)) x.pump(); }
  assert.ok(['r', 'b'].includes(late.run('myTeam()')));
  assert.strictEqual(late.run('V.key'), null);
  assert.strictEqual(late.run('V.phase'), 'clue');
});
