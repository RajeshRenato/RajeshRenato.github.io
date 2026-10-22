'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

// game timers on every TV made by a test are stopped afterwards, pass or fail
const tvs = [];
test.afterEach(() => { while (tvs.length) tvs.pop().run('stopTimers()'); });

// The TV and three phones, connected over in-memory channels.
function party(names = ['Ana', 'Bo', 'Cy <b>']) {
  const tv = createPage('couch-party/index.html');
  tvs.push(tv);
  const phones = names.map(() => createPage('couch-party/index.html', '#c=AAAA'));
  const pairs = names.map(() => channelPair());
  names.forEach((n, i) => {
    tv.sandbox['c' + i] = pairs[i].a;
    phones[i].sandbox.ch = pairs[i].b;
    tv.run(`room.addChannel(c${i})`);
    phones[i].run(`startController(Room.joinChannel(ch, ${JSON.stringify(n)}))`);
  });
  const pump = () => { for (let k = 0; k < 4; k++) for (const p of pairs) p.pump(); };
  pump();
  return { tv, phones, pairs, pump, done: () => tv.run('stopTimers()') };
}
const ids = tv => json(tv, 'players().map(p => p.id)');
const screen = phone => phone.run(`$('pCtl').innerHTML`);

test('phones join the TV and the lobby lists them, names as text', () => {
  const { tv, phones, done } = party();
  assert.strictEqual(tv.run('players().length'), 3);
  const html = tv.run(`$('players').innerHTML`);
  assert.ok(html.includes('Cy &lt;b&gt;') && !html.includes('<b>'));
  assert.match(screen(phones[1]), /You're in/);
  assert.match(screen(phones[1]), /Bo/);
  done();
});

test('quiz: right answers score, faster ones score more, and wrong or late ones nothing', () => {
  const { tv, phones, pump, done } = party();
  tv.run(`startGame('quiz')`);
  pump();
  assert.match(screen(phones[0]), /data-a="3"/, 'four answer buttons');
  const correct = tv.run('G.correct');
  const [a, b, c] = ids(tv);
  tv.run(`G.started = now() - 3000`);
  phones[0].run(`$('pCtl').querySelector('[data-a]'); room.send({ t: 'ans', q: 0, a: ${correct} })`);
  pump();
  tv.run(`G.started = now() - 12000`);
  phones[1].run(`room.send({ t: 'ans', q: 0, a: ${correct} })`);
  phones[1].run(`room.send({ t: 'ans', q: 0, a: ${(correct + 1) % 4} })`);
  phones[2].run(`room.send({ t: 'ans', q: 5, a: 0 }); room.send({ t: 'ans', q: 0, a: 9 }); room.send({ t: 'ans', q: 0, a: ${(correct + 1) % 4} })`);
  pump();
  assert.strictEqual(tv.run('G.open'), false, 'everyone answered, so the answer shows');
  const pts = json(tv, `[${a}, ${b}, ${c}].map(id => scores.get(id) || 0)`);
  assert.ok(pts[0] > pts[1] && pts[1] > 500, 'both right, the faster one more: ' + pts);
  assert.strictEqual(pts[2], 0);
  assert.match(screen(phones[0]), /Right! \+/);
  assert.match(screen(phones[2]), /Not this time/);
  done();
});

test('Green Light: tapping before green is out, the fastest valid time wins, and times come from the phones', () => {
  const { tv, phones, pump, done } = party();
  tv.run(`T.reflexWait = [1e9, 1e9]; T.reflexGo = 1e9; startGame('reflex')`);
  pump();
  assert.match(screen(phones[0]), /Wait for green/);
  phones[2].run('reflexPress()');
  pump();
  tv.run('reflexGo()');
  pump();
  phones[0].run('ctl.goAt = now() - 250; reflexPress()');
  phones[1].run('ctl.goAt = now() - 190; reflexPress()');
  pump();
  assert.strictEqual(tv.run('G.phase'), 'done');
  const [a, b, c] = ids(tv);
  assert.deepStrictEqual(json(tv, `[${a}, ${b}, ${c}].map(id => scores.get(id) || 0)`), [200, 300, 0]);
  assert.match(screen(phones[2]), /Too soon/);
  assert.match(screen(phones[1]), /fastest/);
  // a forged time below what a person can do counts as too soon
  tv.run('reflexRound(); reflexGo()');
  phones[0].run(`room.send({ t: 'tap', r: 2, ms: 5 })`);
  pump();
  assert.strictEqual(tv.run(`G.taps.get(${a}).early`), true);
  done();
});

test('Sumo: players collide, whoever leaves the ring is out, and the last one wins the round', () => {
  const { tv, phones, pump, done } = party(['Ana', 'Bo']);
  tv.run(`T.sumoNext = 1e9; startGame('sumo')`);
  pump();
  assert.match(screen(phones[0]), /class="pad"/);
  const [a, b] = ids(tv);
  // put them face to face in the middle, Ana running at Bo
  tv.run(`G.count = 0; G.bodies[0].x = -10; G.bodies[0].y = 0; G.bodies[1].x = 10; G.bodies[1].y = 0;`);
  phones[0].run(`room.send({ t: 'in', x: 1, y: 0 })`);
  phones[1].run(`room.send({ t: 'in', x: NaN, y: 0 }); room.send({ t: 'in', x: '1', y: 0 })`);
  pump();
  assert.deepStrictEqual(json(tv, 'G.bodies.map(b => [b.ax, b.ay])'), [[1, 0], [0, 0]], 'bad input ignored');
  for (let i = 0; i < 120 * 4 && tv.run('G.bodies[1].x') < 75; i++) tv.run('sumoStep(1 / 120)');
  assert.ok(tv.run('G.bodies[1].x') >= 75, 'Bo got pushed toward the edge');
  // Ana lets go near the edge and slides to a stop; Bo keeps going
  phones[0].run(`room.send({ t: 'in', x: 0, y: 0 })`);
  pump();
  for (let i = 0; i < 120 * 6 && !tv.run('G.done'); i++) tv.run('sumoStep(1 / 120)');
  assert.strictEqual(tv.run('G.done'), true);
  assert.deepStrictEqual(json(tv, 'G.bodies.map(b => b.alive)'), [true, false]);
  assert.strictEqual(tv.run(`scores.get(${a})`), 500);
  pump();
  assert.match(screen(phones[1]), /fell off/);
  done();
});

test('the ring shrinks, so a round always ends', () => {
  const { tv, done } = party(['Ana', 'Bo']);
  tv.run(`T.sumoNext = 1e9; startGame('sumo'); G.count = 0`);
  for (let i = 0; i < 120 * 90 && !tv.run('G.done'); i++) tv.run('sumoStep(1 / 120)');
  assert.strictEqual(tv.run('G.done'), true, 'two players who never move still end the round');
  done();
});

test('results go to each phone, and someone leaving mid-quiz does not stall it', () => {
  const { tv, phones, pairs, pump, done } = party();
  tv.run(`T.quiz = 1e9; startGame('quiz')`);
  pump();
  const correct = tv.run('G.correct');
  phones[0].run(`room.send({ t: 'ans', q: 0, a: ${correct} })`);
  phones[1].run(`room.send({ t: 'ans', q: 0, a: ${correct} })`);
  pump();
  assert.strictEqual(tv.run('G.open'), true);
  pairs[2].close();
  pump();
  assert.strictEqual(tv.run('G.open'), false, 'the one who left is not waited for');
  tv.run(`G.i = G.qs.length - 1; quizNext()`);
  pump();
  assert.match(screen(phones[0]), /You (won|came)/);
  assert.match(tv.run(`$('tvStage').innerHTML`), /Back to the games/);
  tv.run('backToLobby()');
  pump();
  assert.match(screen(phones[1]), /You're in/);
  done();
});

test('the phone ignores screens it cannot draw', () => {
  const { phones, done } = party(['Ana']);
  const before = screen(phones[0]);
  phones[0].run(`onPhoneMessage({ t: 'screen', s: 'quiz', q: 'x', opts: [] }); onPhoneMessage({ t: 'screen', s: 'nope' }); onPhoneMessage({ t: 'screen' })`);
  assert.strictEqual(screen(phones[0]), before);
  phones[0].run(`onPhoneMessage({ t: 'screen', s: 'quiz', q: 1, opts: ['<img src=x onerror=alert(1)>', 'b', 'c', 'd'] })`);
  assert.ok(!screen(phones[0]).includes('<img'));
  done();
});
