'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const STEPS = (page, seconds) => page.run(`for (let k = 0; k < ${Math.round(seconds * 60)}; k++) step(G, STEP)`);

// A round on an arena with no crates, so tests can place things by hand.
function emptyRound(page, players = 2) {
  page.run(`
    G = newRound(Array.from({ length: ${players} }, (_, k) => ({ name: 'P' + k, keys: k ? null : 'any' })), 1);
    G.grid = G.grid.map(c => (c === '#' ? '#' : '.'));
    G.hidden = new Map();
    phase = 'play';
  `);
}

test('the arena has walls around it and on every even tile, and clear corners to start in', () => {
  const page = createPage('bomb-arena/index.html');
  for (let seed = 1; seed < 20; seed++) {
    const grid = json(page, `makeGrid(rng(${seed}))`);
    assert.strictEqual(grid.length, 15 * 13);
    for (let x = 0; x < 15; x++) { assert.strictEqual(grid[x], '#'); assert.strictEqual(grid[12 * 15 + x], '#'); }
    for (let y = 2; y < 12; y += 2) for (let x = 2; x < 14; x += 2) assert.strictEqual(grid[y * 15 + x], '#');
    for (const [x, y] of [[1, 1], [2, 1], [1, 2], [13, 11], [12, 11], [13, 10], [13, 1], [1, 11]]) assert.strictEqual(grid[y * 15 + x], '.');
    assert.ok(grid.filter(c => c === '+').length > 60, 'plenty of crates');
  }
});

test('a bomb burns in a cross, stops at walls and crates, and reveals what was in the crate', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[1].x = 13; G.players[1].y = 11;
    G.grid[idx(3, 3)] = '+'; G.hidden.set(idx(3, 3), 'f'); G.grid[idx(5, 1)] = '+';
    G.players[0].x = 3; G.players[0].y = 1; G.players[0].fire = 3; G.players[0].bombs = 2;
    placeBomb(G, G.players[0]); G.players[0].x = 1;`);
  assert.strictEqual(page.run('placeBomb(G, G.players[0])'), true, 'a second spot is fine');
  page.run('G.bombs.pop()');
  STEPS(page, 2.45);
  const f = json(page, '[...G.flames.keys()]');
  assert.ok(f.includes(page.run('idx(3, 1)')) && f.includes(page.run('idx(4, 1)')) && f.includes(page.run('idx(5, 1)')));
  assert.ok(!f.includes(page.run('idx(6, 1)')), 'stops at the crate it hits');
  assert.ok(f.includes(page.run('idx(3, 3)')) && !f.includes(page.run('idx(3, 4)')));
  assert.ok(!f.includes(page.run('idx(3, 0)')), 'never burns the outer wall');
  assert.strictEqual(page.run(`G.grid[idx(3, 3)]`), '+', 'the crate burns for a moment');
  assert.strictEqual(page.run('G.players[0].alive'), false, 'standing two tiles away in line with a range 3 bomb is fatal');
  STEPS(page, 0.7);
  assert.strictEqual(page.run(`G.grid[idx(3, 3)]`), 'f');
  assert.strictEqual(page.run(`G.grid[idx(5, 1)]`), '.');
  assert.strictEqual(page.run('G.flames.size'), 0);
});

test('bombs set each other off', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[1].x = 13; G.players[1].y = 11;
    G.bombs.push({ i: idx(1, 5), x: 1, y: 5, owner: 1, t: 0.1, fire: 2 }, { i: idx(1, 7), x: 1, y: 7, owner: 1, t: 2, fire: 2 }, { i: idx(1, 10), x: 1, y: 10, owner: 1, t: 2, fire: 1 });`);
  STEPS(page, 0.2);
  assert.strictEqual(page.run('G.bombs.length'), 1, 'the second goes off, the third is out of its reach');
  assert.strictEqual(page.run('G.bombs[0].y'), 10);
});

test('walking: blocked by walls, crates, and bombs, but you can step off your own bomb and turn back', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[1].x = 13; G.players[1].y = 11; var me = G.players[0];`);
  page.run(`me.dir = 'u'`);
  STEPS(page, 0.5);
  assert.deepStrictEqual(json(page, '[me.x, me.y]'), [1, 1], 'the wall stops you');
  page.run(`me.dir = 'r'`);
  STEPS(page, 0.2);
  page.run(`me.dir = 'l'`);
  STEPS(page, 0.5);
  assert.deepStrictEqual(json(page, '[me.x, me.y]'), [1, 1], 'turned back halfway');
  page.run(`placeBomb(G, me); me.dir = 'd'`);
  STEPS(page, 0.5);
  assert.ok(page.run('me.y') >= 2, 'stepped off the bomb');
  page.run(`me.dir = 'u'`);
  STEPS(page, 0.6);
  assert.strictEqual(page.run('me.y'), 2, "can't walk back onto it");
  page.run(`G.grid[idx(1, 4)] = '+'; me.dir = 'd'`);
  STEPS(page, 1);
  assert.strictEqual(page.run('me.y'), 3);
});

test('power-ups: more bombs, longer flames, more speed', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[1].x = 13; G.players[1].y = 11; var me = G.players[0];
    G.grid[idx(2, 1)] = 'b'; G.grid[idx(3, 1)] = 'f'; G.grid[idx(4, 1)] = 's'; me.dir = 'r';`);
  STEPS(page, 1.2);
  assert.deepStrictEqual(json(page, '[me.bombs, me.fire, me.speed]'), [2, 3, 1]);
  assert.strictEqual(page.run(`G.grid.slice(idx(2, 1), idx(5, 1)).join('')`), '...');
  page.run('placeBomb(G, me)');
  page.run(`me.x = 5; me.y = 1; me.moving = false;`);
  assert.strictEqual(page.run('placeBomb(G, me)'), true, 'two bombs out at once');
  assert.strictEqual(page.run(`me.x = 7; placeBomb(G, me)`), false, 'but not three');
});

test('last one standing wins the round, and three rounds win the match', () => {
  const page = createPage('bomb-arena/index.html');
  page.run(`startLocal('solo')`);
  assert.strictEqual(page.run('slots.length'), 4);
  assert.strictEqual(json(page, 'slots.filter(s => s.bot).length'), 3);
  for (let r = 0; r < 3; r++) {
    page.run(`G.players.slice(1).forEach(p => kill(G, p))`);
    STEPS(page, 1.1);
    assert.strictEqual(page.run('roundDone(G)'), true);
    page.run('endRound()');
    if (r < 2) { assert.strictEqual(page.run('phase'), 'roundEnd'); page.run('startRound()'); }
  }
  assert.deepStrictEqual(json(page, 'wins'), [3, 0, 0, 0]);
  assert.strictEqual(page.run('phase'), 'matchEnd');
  assert.match(page.run(`$('msg').innerHTML`), /You win the match/);
});

test('two caught in the same blast is a draw', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[1].x = 3; G.players[1].y = 1; G.players[0].x = 1;
    G.bombs.push({ i: idx(2, 1), x: 2, y: 1, owner: 0, t: 0.05, fire: 2 });`);
  STEPS(page, 1.2);
  assert.strictEqual(page.run('roundDone(G)'), true);
  assert.strictEqual(page.run('roundWinner(G)'), -1);
});

test('sudden death closes the walls in from the outside', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[1].x = 7; G.players[1].y = 5; G.time = SD_AT - 0.01; G.sdNext = SD_AT;`);
  STEPS(page, 0.05);
  assert.strictEqual(page.run(`G.grid[idx(1, 1)]`), '#');
  assert.strictEqual(page.run('G.players[0].alive'), false, 'the corner player is crushed first');
  assert.strictEqual(page.run('roundWinner(G)'), 1);
});

test('walking into a tile as the wall closes on it turns you back, even with the key held', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[0].x = 7; G.players[0].y = 5; var me = G.players[1]; me.x = 3; me.y = 1; me.dir = 'l';`);
  STEPS(page, 0.1);
  assert.ok(page.run('me.moving && me.x < 3 && me.x > 2.5'));
  page.run(`G.sd = 1; closeIn(G)`);
  assert.strictEqual(page.run(`G.grid[idx(2, 1)]`), '#');
  STEPS(page, 1);
  assert.deepStrictEqual(json(page, '[me.alive, me.x, me.y]'), [true, 3, 1]);
});

test('bots survive their own bombs and finish a round', () => {
  const page = createPage('bomb-arena/index.html');
  let selfKills = 0, rounds = 0, longest = 0;
  for (let seed = 1; seed <= 12; seed++) {
    page.run(`G = newRound(botSlots([]).map(s => ({ ...s })), ${seed}); G.rnd = rng(${seed * 7});`);
    let t = 0;
    while (!page.run('roundDone(G)') && t < 200) { STEPS(page, 1); t++; }
    assert.ok(page.run('roundDone(G)'), 'round ' + seed + ' ended');
    rounds++;
    longest = Math.max(longest, t);
    selfKills += page.run(`G.players.filter(p => !p.alive && p.deadAt < 20).length`);
  }
  assert.ok(selfKills <= rounds, 'bots rarely die in the first 20 seconds (' + selfKills + ' in ' + rounds + ' rounds)');
  assert.ok(longest < 200);
});

test('a bot next to a crate bombs it and gets out of the way', () => {
  const page = createPage('bomb-arena/index.html');
  emptyRound(page);
  page.run(`G.players[0].x = 13; G.players[0].y = 11; G.players[0].keys = null;
    G.players[1].bot = true; G.players[1].x = 1; G.players[1].y = 1; G.grid[idx(3, 1)] = '+'; G.rnd = () => 0;`);
  STEPS(page, 0.2);
  assert.strictEqual(page.run('G.bombs.length'), 1);
  STEPS(page, 4);
  assert.strictEqual(page.run('G.players[1].alive'), true);
  assert.strictEqual(page.run(`G.grid[idx(3, 1)]`), '.');
});

test('online: guests see the host\'s game and steer their own player only', () => {
  const host = createPage('bomb-arena/index.html');
  const g1 = createPage('bomb-arena/index.html');
  const g2 = createPage('bomb-arena/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a;
  g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let i = 0; i < 3; i++) { c1.pump(); c2.pump(); } };

  host.run(`globalThis.r = Room.create('bomb-arena', 'Ana'); r.addChannel(c1); r.addChannel(c2);`);
  g1.run(`startOnline(Room.joinChannel(ch, 'Bo'))`);
  g2.run(`startOnline(Room.joinChannel(ch, 'Cy'))`);
  pump();
  host.run('botsOn = false; startOnline(r)');
  pump();
  assert.deepStrictEqual(json(g1, 'slots.map(s => s.name)'), ['Ana', 'Bo', 'Cy']);
  assert.strictEqual(g1.run('mySlot'), 1);
  assert.strictEqual(g2.run('mySlot'), 2);

  host.run(`room.send(snapshot(G))`);
  pump();
  assert.strictEqual(g1.run(`view.grid.join('')`), host.run(`G.grid.join('')`));

  // Bo starts in the bottom right corner: walk up and drop a bomb
  g1.run(`held.push({ code: 'ArrowUp', set: 'arrows', dir: 'u' }); readInput()`);
  g1.run(`bombPressed('arrows')`);
  pump();
  assert.strictEqual(host.run('G.players[1].dir'), 'u');
  host.run('for (let k = 0; k < 30; k++) step(G, STEP)');
  assert.strictEqual(host.run('G.bombs.length'), 1);
  assert.strictEqual(host.run('G.bombs[0].owner'), 1);
  assert.ok(host.run('G.players[1].y') < 11);
  assert.strictEqual(host.run('G.players[2].dir'), '', "Bo can't move Cy");

  host.run('room.send(snapshot(G))');
  pump();
  assert.strictEqual(g2.run('view.bombs.length'), 1);
  assert.ok(g2.run('view.players[1].y') < 11);

  // hostile or broken messages change nothing
  for (const bad of [
    `{ t: 's', g: 'x'.repeat(195), p: [] }`, `{ t: 's', g: G.grid.join(''), p: [[NaN, 1, 1, 'u', 1, 2, 0]] }`,
    `{ t: 'round', slots: 'nope' }`, `{ t: 'end', w: 99, wins: 'x' }`, `{ t: 's', g: null }`,
  ]) host.run(`room.send(${bad})`);
  pump();
  assert.strictEqual(g2.run('view.bombs.length'), 1);
  g1.run(`room.send({ t: 'round', slots: [] }); room.send({ t: 'in', d: '__proto__' }); room.send({ t: 'bomb', who: 2 })`);
  pump();
  assert.strictEqual(host.run('G.players[1].dir'), '');
  assert.strictEqual(host.run('G.bombs.length'), 1, 'a second bomb is over the limit of one');

  // the host ends a round and the guests follow
  host.run(`kill(G, G.players[0]); kill(G, G.players[2]); G.time = G.over + 1; endRound()`);
  pump();
  assert.strictEqual(g1.run('phase'), 'roundEnd');
  assert.match(g1.run(`$('msg').innerHTML`), /You win the round/);
  assert.match(g2.run(`$('msg').innerHTML`), /Bo wins the round/);
  host.run('startRound()');
  pump();
  assert.strictEqual(g2.run('phase'), 'play');
  assert.deepStrictEqual(json(g2, 'wins'), [0, 1, 0]);

  // a guest leaves: their player is out
  c2.close();
  pump();
  assert.strictEqual(host.run('G.players[2].alive'), false);
  assert.strictEqual(host.run('slots[2].gone'), true);
  c1.close();
  pump();
  assert.match(g1.run(`$('msg').innerHTML`), /The host left/);
});
