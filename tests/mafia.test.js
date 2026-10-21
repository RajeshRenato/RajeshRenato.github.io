'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const seeded = s => `(() => { let x = ${s}; return () => (x = (x * 16807) % 2147483647) / 2147483647; })()`;

// a host and n-1 guests over in-memory channels; every message a guest receives is recorded
function table(n, narrator = false) {
  const host = createPage('mafia/index.html');
  host.run(`globalThis.r = Room.create('mafia', 'P0')`);
  const pages = [host], chans = [], inbox = [[]];
  for (let i = 1; i < n; i++) {
    const g = createPage('mafia/index.html');
    const c = channelPair();
    host.sandbox.c = c.a; host.run('r.addChannel(c)');
    g.sandbox.ch = c.b;
    const box = [];
    const orig = c.b;
    g.run(`attach(Room.joinChannel(ch, 'P${i}'))`);
    const handler = orig.onmessage;
    orig.onmessage = e => { box.push(e.data); handler(e); };
    pages.push(g); chans.push(c); inbox.push(box);
  }
  const pump = () => { for (let k = 0; k < 4; k++) for (const c of chans) c.pump(); };
  pump();
  host.run('attach(r)');
  if (narrator) host.run('H.settings.narrator = true');
  pump();
  return { host, pages, chans, inbox, pump };
}
const roleOf = (t, id) => t.host.run(`H.roles[${id}]`);
const idsWith = (t, role) => json(t.host, `H.seats.filter(id => H.roles[id] === '${role}')`);

test('roles: mafia is about one in four, plus one doctor and one detective', () => {
  const { run } = createPage('mafia/index.html');
  for (const [n, m] of [[5, 1], [7, 1], [8, 2], [11, 2], [12, 3]]) {
    const r = json({ run }, `rolesFor(${n})`);
    assert.strictEqual(r.length, n);
    assert.strictEqual(r.filter(x => x === 'mafia').length, m, n + ' players');
    assert.strictEqual(r.filter(x => x === 'doctor').length, 1);
    assert.strictEqual(r.filter(x => x === 'detective').length, 1);
  }
});

test('secrets: guests only ever receive their own role, and mafia see their team', () => {
  const t = table(8);
  t.host.run(`startGame(${seeded(7)})`);
  t.pump();
  for (let i = 1; i < 8; i++) {
    const role = roleOf(t, i);
    for (const raw of t.inbox[i]) {
      const m = JSON.parse(raw);
      if (m.t !== 'view') continue;
      assert.strictEqual(m.roles, undefined, 'no full role list while alive');
      if (m.you) assert.strictEqual(m.you.role, role);
      if (role === 'mafia' && m.you) assert.deepStrictEqual(m.team.slice().sort(), idsWith(t, 'mafia').sort());
      if (role !== 'mafia') assert.strictEqual(m.team, undefined, 'only mafia learn the team');
      assert.ok(!raw.includes('"detective"') || role === 'detective', 'the word detective only reaches the detective');
    }
  }
});

test('night: the mafia pick, the doctor can save, and only the detective learns the check', () => {
  const t = table(6);
  t.host.run(`startGame(${seeded(3)})`);
  t.pump();
  const mafia = idsWith(t, 'mafia')[0], doc = idsWith(t, 'doctor')[0], det = idsWith(t, 'detective')[0];
  const villager = idsWith(t, 'villager')[0];
  const act = (id, target) => { t.pages[id].run(`act({ t: 'pick', target: ${target} })`); t.pump(); };

  act(mafia, villager); act(doc, villager); act(det, mafia);
  for (const id of json(t.host, 'H.seats')) if (![mafia, doc, det].includes(id)) act(id, mafia === id ? villager : doc);
  assert.strictEqual(t.host.run('H.phase'), 'day');
  assert.strictEqual(t.host.run(`H.alive.has(${villager})`), true, 'the doctor saved them');
  assert.match(t.host.run('H.log.at(-1)'), /nobody died/);
  assert.deepStrictEqual(json(t.pages[det], 'V.checks'), [{ round: 1, target: mafia, mafia: true }]);
  for (let i = 0; i < 6; i++) if (i !== det) assert.strictEqual(t.pages[i].run('V.checks'), undefined);

  t.host.run('startVote()'); t.pump();
  for (const id of json(t.host, 'H.seats')) { t.pages[id].run(`act({ t: 'vote', target: 'skip' })`); t.pump(); }
  assert.strictEqual(t.host.run('H.phase'), 'night');
  act(mafia, villager); act(doc, det); act(det, villager);
  for (const id of json(t.host, 'living()')) if (![mafia, doc, det].includes(id)) act(id, mafia === id ? villager : doc);
  assert.strictEqual(t.host.run(`H.alive.has(${villager})`), false);
  assert.match(t.host.run('H.log.at(-1)'), /was killed/);
});

test('day vote: more than half removes a player, a tie removes nobody', () => {
  const t = table(6);
  t.host.run(`startGame(${seeded(11)}); H.phase = 'day'; startVote()`);
  t.pump();
  const seats = json(t.host, 'H.seats');
  const [a, b] = seats.filter(id => roleOf(t, id) !== 'mafia');
  const rest = seats.filter(id => id !== a && id !== b);
  const plan = { [a]: b, [b]: a, [rest[0]]: a, [rest[1]]: a, [rest[2]]: b, [rest[3]]: b };
  seats.forEach(id => { t.pages[id].run(`act({ t: 'vote', target: ${plan[id]} })`); t.pump(); });
  assert.match(t.host.run('H.log.at(-1)'), /no majority/);
  assert.strictEqual(t.host.run('living().length'), 6);

  t.host.run(`H.phase = 'day'; startVote()`); t.pump();
  seats.forEach(id => { t.pages[id].run(`act({ t: 'vote', target: ${id === a ? b : a} })`); t.pump(); });
  assert.strictEqual(t.host.run(`H.alive.has(${a})`), false);
  assert.match(t.host.run('H.log.at(-1)'), /voted out P\d\. They were/);
});

test('win: the town wins with no mafia left, the mafia win when they match the rest', () => {
  const t = table(5);
  t.host.run(`startGame(${seeded(5)})`);
  const mafia = idsWith(t, 'mafia')[0];
  t.host.run(`H.alive.delete(${mafia}); checkWin()`);
  assert.strictEqual(t.host.run('H.winner'), 'village');
  t.pump();
  assert.ok(t.pages[1].run('V.roles') !== undefined, 'everyone sees the roles at the end');

  t.host.run(`newGame(); startGame(${seeded(9)})`);
  const m2 = idsWith(t, 'mafia')[0];
  const others = json(t.host, `H.seats.filter(id => id !== ${m2})`);
  t.host.run(`H.alive.delete(${others[0]}); H.alive.delete(${others[1]}); H.alive.delete(${others[2]}); checkWin()`);
  assert.strictEqual(t.host.run('H.winner'), 'mafia');
});

test('narrator mode: the host does not play and sees no secrets', () => {
  const t = table(6, true);
  assert.strictEqual(t.host.run('canStart()'), true);
  t.host.run(`startGame(${seeded(2)})`); t.pump();
  assert.strictEqual(t.host.run('H.seats.includes(0)'), false);
  assert.strictEqual(t.host.run('V.you'), null);
  assert.strictEqual(t.host.run('V.narrator'), true);
  assert.strictEqual(t.host.run('V.roles'), undefined);
  assert.strictEqual(t.host.run('V.team'), undefined);
});

test('a player who leaves is out with their role shown, and a late joiner watches', () => {
  const t = table(6);
  t.host.run(`startGame(${seeded(4)})`); t.pump();
  const leaver = 1, role = roleOf(t, leaver);
  t.chans[0].close(); t.pump();
  assert.strictEqual(t.host.run(`H.alive.has(${leaver})`), false);
  assert.match(t.host.run('H.log.at(-1)'), new RegExp('left the game\\. They were .*' + (role === 'villager' ? 'Villager' : '')));

  const late = createPage('mafia/index.html');
  const c = channelPair();
  t.host.sandbox.c = c.a; t.host.run('r.addChannel(c)');
  late.sandbox.ch = c.b; late.run(`attach(Room.joinChannel(ch, 'Late'))`);
  for (let k = 0; k < 4; k++) { c.pump(); for (const x of t.chans.slice(1)) x.pump(); }
  assert.strictEqual(late.run('V.you'), null, 'spectator until the next game');
  assert.strictEqual(late.run('V.roles'), undefined);
  assert.ok(['night', 'day', 'vote', 'over'].includes(late.run('V.phase')));
});

test('timers move the game on', () => {
  const t = table(5);
  t.host.run(`startGame(${seeded(6)})`);
  t.host.run('H.endsAt = 1; hostTick()');
  assert.ok(['day', 'over'].includes(t.host.run('H.phase')));
  if (t.host.run('H.phase') === 'day') {
    t.host.run('H.endsAt = 1; hostTick()');
    assert.strictEqual(t.host.run('H.phase'), 'vote');
    t.host.run('H.endsAt = 1; hostTick()');
    assert.ok(['night', 'over'].includes(t.host.run('H.phase')));
  }
});
