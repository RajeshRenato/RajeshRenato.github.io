'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const later = (page, ms) => page.run(`H.endsAt -= ${ms}; hostTick()`);

test('the question bank is well formed', () => {
  const { run } = createPage('trivia-night/index.html');
  const qs = json({ run }, 'QUESTIONS');
  assert.ok(qs.length >= 300);
  const texts = new Set();
  for (const q of qs) {
    assert.strictEqual(q.length, 6, JSON.stringify(q));
    assert.strictEqual(new Set(q.slice(2)).size, 4, 'four different answers: ' + q[1]);
    assert.ok(!texts.has(q[1]), 'repeated question: ' + q[1]);
    texts.add(q[1]);
  }
  assert.strictEqual(run('CATS.length'), 8);
});

test('solo: right answers score by speed and streak, and the best is saved', () => {
  const page = createPage('trivia-night/index.html');
  page.run(`startSolo(); H.cat = 'Science'; H.count = 10; hostStart()`);
  assert.strictEqual(page.run('V.phase'), 'q');
  assert.strictEqual(page.run('V.q.cat'), 'Science');
  assert.strictEqual(page.run('V.q.opts.length'), 4);
  assert.strictEqual(page.run(`'correct' in V.q`), false, 'the question sent out does not carry the answer');

  page.run('V.shownAt = performance.now() - 3000; choose(H.correct)');
  assert.strictEqual(page.run('V.phase'), 'reveal', 'alone, answering reveals right away');
  assert.strictEqual(page.run('V.r.gains[0]'), 900);
  later(page, 5000);
  page.run('V.shownAt = performance.now() - 3000; choose(H.correct)');
  assert.strictEqual(page.run('V.r.gains[0]'), 950, 'two in a row adds 50');
  later(page, 5000);
  page.run('choose((H.correct + 1) % 4)');
  assert.strictEqual(page.run('V.r.gains[0]'), undefined);
  assert.strictEqual(page.run('H.streaks[0]'), 0);
  later(page, 5000);
  later(page, 16000);
  assert.strictEqual(page.run('V.phase'), 'reveal', 'time runs out');
  for (let i = 0; i < 6; i++) { later(page, 5000); later(page, 16000); }
  later(page, 5000);
  assert.strictEqual(page.run('V.phase'), 'over');
  assert.strictEqual(page.run(`+localStorage.getItem('trivia_best_Science_10')`), 1850);
});

test('online: everyone gets the same question, the host keeps the answer, scores add up', () => {
  const host = createPage('trivia-night/index.html');
  const g1 = createPage('trivia-night/index.html');
  const g2 = createPage('trivia-night/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a; g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let k = 0; k < 4; k++) { c1.pump(); c2.pump(); } };
  host.run(`globalThis.r = Room.create('trivia-night', 'Ana'); r.addChannel(c1); r.addChannel(c2);`);
  g1.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  g2.run(`attach(Room.joinChannel(ch, 'Cy'))`);
  pump();
  host.run('attach(r)');
  pump();
  assert.strictEqual(g1.run('V.phase'), 'setup');
  host.run(`H.count = 10; hostStart()`);
  pump();
  assert.strictEqual(g1.run('V.q.text'), host.run('V.q.text'));
  assert.deepStrictEqual(json(g2, 'V.q.opts'), json(host, 'V.q.opts'));
  const correct = host.run('H.correct');

  g1.run(`V.shownAt = performance.now() - 1500; choose(${correct})`);
  g2.run(`choose(${(correct + 1) % 4})`);
  pump();
  assert.deepStrictEqual(json(host, 'V.locked').sort(), [1, 2]);
  assert.strictEqual(host.run('V.phase'), 'q', 'waits for the host too');
  host.run(`V.shownAt = performance.now() - 7500; choose(${correct})`);
  pump();
  assert.strictEqual(g2.run('V.phase'), 'reveal');
  assert.strictEqual(g2.run('V.r.correct'), correct);
  assert.deepStrictEqual(json(g2, 'V.r.gains'), { 0: 750, 1: 950 });
  assert.strictEqual(g1.run('V.r.counts[' + correct + ']'), 2);

  g1.run(`room.send({ t: 'a', n: 0, i: 0, ms: 0 })`);
  pump();
  assert.strictEqual(host.run('H.scores[1]'), 950, 'no answering after the reveal');

  c2.close();
  pump();
  later(host, 5000);
  pump();
  host.run(`choose(H.correct)`); g1.run(`choose(0)`);
  pump();
  assert.strictEqual(host.run('V.phase'), 'reveal', 'a player who left is not waited for');
});
