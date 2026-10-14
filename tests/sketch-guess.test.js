'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

function game(n = 3) {
  const host = createPage('sketch-guess/index.html');
  const guests = [], chans = [];
  host.run(`globalThis.r = Room.create('sketch-guess', 'Ana')`);
  for (let i = 0; i < n - 1; i++) {
    const g = createPage('sketch-guess/index.html');
    const c = channelPair();
    host.sandbox.c = c.a;
    host.run('r.addChannel(c)');
    g.sandbox.ch = c.b;
    g.run(`attach(Room.joinChannel(ch, ${JSON.stringify(['Bo', 'Cy', 'Di'][i])}))`);
    guests.push(g); chans.push(c);
  }
  const pump = () => { for (let k = 0; k < 4; k++) for (const c of chans) c.pump(); };
  pump();
  host.run('attach(r)');
  pump();
  const pages = [host, ...guests];
  const byId = id => pages[id];
  // jump the host clock forward without waiting
  const later = ms => { host.run(`G.endsAt -= ${ms}; G.startedAt -= ${ms}; hostTick()`); pump(); };
  return { host, guests, chans, pump, pages, byId, later };
}

test('words are unique and close guesses are spotted', () => {
  const { run } = createPage('sketch-guess/index.html');
  assert.strictEqual(run('new Set(WORDS).size === WORDS.length'), true);
  assert.ok(run('WORDS.length') > 200);
  assert.strictEqual(run(`near('elefant', 'elephant')`), false);
  assert.strictEqual(run(`near('elephan', 'elephant')`), true);
  assert.strictEqual(run(`near('girafe', 'giraffe')`), true);
  assert.strictEqual(run(`near('cat', 'car')`), false, 'short words are not hinted');
  assert.strictEqual(run(`norm('Ice Cream!')`), run(`norm('icecream')`));
});

test('a full turn: pick, draw, guess, score, reveal, next drawer', () => {
  const { host, guests, pump, byId, later } = game(3);
  assert.strictEqual(host.run('V.phase'), 'choose');
  const drawer = host.run('V.drawer');
  assert.strictEqual(drawer, 0, 'the host draws first');
  assert.strictEqual(host.run('V.choices.length'), 3);
  assert.strictEqual(guests[0].run('V.choices.length'), 0, 'only the drawer sees the choices');

  const word = host.run('V.choices[1]');
  host.run('pick(V.choices[1])');
  pump();
  assert.strictEqual(guests[0].run('V.phase'), 'draw');
  assert.strictEqual(guests[0].run('V.hint'), word.replace(/[^ ]/g, '_'));
  assert.strictEqual(guests[0].run('V.myWord'), '', 'guessers never receive the word');

  host.run(`sendDraw({ t: 's0', c: '#e5383b', w: 10, x: 100, y: 100 }); sendDraw({ t: 's+', p: [200, 200, 300, 150] })`);
  pump();
  assert.deepStrictEqual(json(guests[1], 'strokes'), [{ c: '#e5383b', w: 10, p: [100, 100, 200, 200, 300, 150] }]);
  guests[0].run(`sendDraw({ t: 'clear' })`);
  pump();
  assert.strictEqual(guests[1].run('strokes.length'), 1, 'only the drawer can draw');

  guests[0].run(`room.send({ t: 'guess', text: 'definitely wrong' })`);
  pump();
  assert.ok(guests[1].run(`chat.some(m => m.text === 'definitely wrong')`), 'wrong guesses are public');

  guests[0].run(`room.send({ t: 'guess', text: ${JSON.stringify(word.toUpperCase())} })`);
  pump();
  assert.deepStrictEqual(json(host, 'V.guessed'), [1]);
  assert.ok(guests[1].run(`chat.some(m => m.kind === 'got' && m.id === 1)`));
  assert.ok(!guests[1].run(`chat.some(m => m.text && m.text.toLowerCase() === ${JSON.stringify(word)})`), 'the right answer is not shown');
  const s = json(host, 'V.scores');
  assert.ok(s[1] >= 100, 'a fast first guess scores well');
  assert.strictEqual(s[0], 25, 'the drawer scores per correct guess');

  guests[0].run(`room.send({ t: 'guess', text: 'spoiler ' + ${JSON.stringify(word)} })`);
  pump();
  assert.ok(!guests[1].run(`chat.some(m => m.text && m.text.startsWith('spoiler'))`), 'players who got it chat only with the drawer');

  later(41000);
  assert.ok(guests[1].run('V.hint.replace(/[_ ]/g, "").length') >= (word.replace(/ /g, '').length >= 4 ? 1 : 0), 'a letter is revealed halfway');

  guests[1].run(`room.send({ t: 'guess', text: ${JSON.stringify(word)} })`);
  pump();
  assert.strictEqual(host.run('V.phase'), 'reveal', 'the turn ends once everyone has guessed');
  assert.strictEqual(guests[0].run('V.word'), word);

  later(6000);
  assert.strictEqual(host.run('V.phase'), 'choose');
  assert.strictEqual(host.run('V.drawer'), 1);
  assert.strictEqual(guests[0].run('V.choices.length'), 3);
  assert.strictEqual(guests[1].run('strokes.length'), 0, 'the board is cleared for the next drawer');
});

test('time runs out, a word is auto-picked, and after two rounds the game ends', () => {
  const { host, guests, pump, later } = game(2);
  for (let turn = 0; turn < 4; turn++) {
    assert.strictEqual(host.run('V.phase'), 'choose');
    later(13000);
    assert.strictEqual(host.run('V.phase'), 'draw', 'a word is picked when the drawer waits too long');
    later(81000);
    assert.strictEqual(host.run('V.phase'), 'reveal');
    later(6000);
  }
  assert.strictEqual(host.run('V.phase'), 'over');
  assert.strictEqual(guests[0].run('V.phase'), 'over');
  host.run('hostStartGame()');
  pump();
  assert.strictEqual(guests[0].run('V.phase'), 'choose');
  assert.deepStrictEqual(json(guests[0], 'V.scores'), { 0: 0, 1: 0 });
});

test('the drawer leaving ends the turn, and a late joiner gets the drawing so far', () => {
  const { host, guests, chans, pump, later } = game(3);
  later(13000);
  host.run(`sendDraw({ t: 's0', c: '#18202c', w: 4, x: 5, y: 5 })`);
  later(81000);
  later(6000);
  assert.strictEqual(host.run('V.phase'), 'choose');
  assert.strictEqual(host.run('V.drawer'), 1);
  chans[0].close();
  pump();
  assert.strictEqual(host.run('V.phase'), 'reveal');

  later(6000);
  assert.strictEqual(host.run('V.drawer'), 2);
  later(13000);
  guests[1].run(`sendDraw({ t: 's0', c: '#18202c', w: 4, x: 9, y: 9 })`);
  pump();

  const late = createPage('sketch-guess/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; late.sandbox.ch = c.b;
  host.run('r.addChannel(c)');
  late.run(`attach(Room.joinChannel(ch, 'Ed'))`);
  for (let k = 0; k < 4; k++) { c.pump(); chans[1].pump(); }
  assert.strictEqual(late.run('V.phase'), 'draw');
  assert.strictEqual(late.run('strokes.length'), 1);
  assert.strictEqual(json(host, 'V.scores')[3], 0);
});
