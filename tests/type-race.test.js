'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

// typing one character at a time, the way the input event delivers it
const typeOut = (page, text) => {
  for (const ch of text) page.run(`onType($('inp').value + ${JSON.stringify(ch)})`);
};
const skipCountdown = page => page.run('race.startAt = performance.now() - 30000');

test('solo: typing the passage finishes the race and records a best', () => {
  const page = createPage('type-race/index.html');
  page.run('startSolo()');
  typeOut(page, 'abc');
  assert.strictEqual(page.run('race.typed'), '', 'typing is ignored during the countdown');
  skipCountdown(page);
  const text = page.run('race.text');
  typeOut(page, text.slice(0, 10));
  assert.strictEqual(page.run('race.ok'), 10);
  typeOut(page, '###');
  assert.strictEqual(page.run('race.ok'), 10, 'wrong characters do not count');
  assert.strictEqual(page.run('race.mistakes'), 3);
  page.run(`onType(race.typed.slice(0, 10))`);
  typeOut(page, text.slice(10));
  assert.ok(page.run('race.doneMs') > 0);
  assert.ok(page.run('race.wpm') > 0);
  assert.strictEqual(page.run('race.acc'), Math.round(100 * text.length / (text.length + 3)));
  assert.strictEqual(+page.run(`localStorage.getItem('typerace_best')`), page.run('race.wpm'));
});

test('you cannot run more than a few characters past a mistake', () => {
  const page = createPage('type-race/index.html');
  page.run('startSolo()');
  skipCountdown(page);
  typeOut(page, 'x'.repeat(20));
  assert.strictEqual(page.run('race.typed.length'), 8);
});

test('online: everyone races the same passage and sees the others finish', () => {
  const host = createPage('type-race/index.html');
  const g1 = createPage('type-race/index.html');
  const g2 = createPage('type-race/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a;
  g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let i = 0; i < 3; i++) { c1.pump(); c2.pump(); } };

  host.run(`globalThis.r = Room.create('type-race', 'Ana'); r.addChannel(c1); r.addChannel(c2);`);
  g1.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  g2.run(`attach(Room.joinChannel(ch, 'Cy'))`);
  pump();
  assert.strictEqual(g1.run('race'), null, 'guests wait for the host');
  host.run('attach(r)');
  pump();
  const text = host.run('race.text');
  assert.strictEqual(g1.run('race.text'), text);
  assert.strictEqual(g2.run('race.text'), text);
  for (const p of [host, g1, g2]) skipCountdown(p);

  typeOut(g1, text.slice(0, 40));
  g1.run('sendPos(true)');
  pump();
  assert.strictEqual(host.run('rivals.get(1).n'), 40);
  assert.strictEqual(g2.run('rivals.get(1).n'), 40, 'progress is relayed to the other guest');

  typeOut(g2, text);
  pump();
  typeOut(host, text);
  pump();
  assert.deepStrictEqual(json(g1, 'standings().map(r => r.id)').slice(0, 2), [2, 0]);
  assert.match(host.run(`$('status').textContent`), /^2nd place/);
  assert.match(host.run('resultsTable()'), /still typing/);

  g2.run(`room.send({ t: 'go', idx: 0 })`);
  pump();
  assert.strictEqual(host.run('race.text'), text, 'only the host starts races');

  host.run('hostNewRace()');
  pump();
  assert.notStrictEqual(g1.run('race.text'), text, 'a new race picks a new passage');
  assert.strictEqual(g2.run('race.doneMs'), 0);
  assert.strictEqual(g2.run('rivals.get(0).n'), 0);

  c1.close();
  pump();
  assert.strictEqual(g2.run('room.players.length'), 2);
  assert.strictEqual(host.run('rivals.has(1)'), false);
});
