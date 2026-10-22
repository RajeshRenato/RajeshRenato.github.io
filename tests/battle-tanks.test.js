'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const steps = (page, sec) => page.run(`for (let i = 0; i < ${Math.round(sec * 60)}; i++) step(1 / 60)`);

// A stage in play with the map cleared, for hand-made situations. One enemy waits in the
// queue without ever arriving, so the stage doesn't count as cleared.
function bare(page, players = 1) {
  page.run(`newGame(${JSON.stringify(Array.from({ length: players }, (_, i) => ({ name: 'P' + i })))}); G.phase = 'play'; G.queue = [{ type: 'basic', bonus: false }]; G.spawnT = 1e9; G.map.fill(E);
    for (const [x, y] of FORT) G.map[y * N + x] = BRICK; for (const p of G.players) { p.respawn = 0; spawnPlayer(p); p.tank.spawnT = 0; p.tank.shield = 0; }`);
}

test('every stage leaves room to spawn, builds the fort, and lets enemies reach the eagle', () => {
  const page = createPage('battle-tanks/index.html');
  for (let stage = 1; stage <= 6; stage++) {
    const m = json(page, `Array.from(buildMap(${stage}))`);
    assert.strictEqual(m.length, 26 * 26);
    for (const [x, y] of json(page, 'FORT')) assert.strictEqual(m[y * 26 + x], 1, 'fort brick');
    for (const [px, py] of json(page, 'P_SPAWN.concat(E_SPAWN)')) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) assert.strictEqual(m[(py / 8 + dy) * 26 + px / 8 + dx], 0, 'spawn clear');
    // from each enemy spawn to the fort, through anything but steel and water (bricks can be shot through)
    for (const [sx, sy] of json(page, 'E_SPAWN')) {
      const seen = new Set([sy / 8 * 26 + sx / 8]), q = [[sx / 8, sy / 8]];
      let reached = false;
      while (q.length && !reached) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx > 24 || ny > 24 || seen.has(ny * 26 + nx)) continue;
          const block = [0, 1].some(a => [0, 1].some(b => [2, 3].includes(m[(ny + b) * 26 + nx + a])));
          if (block) continue;
          if (ny >= 21 && nx >= 10 && nx <= 14) { reached = true; break; }
          seen.add(ny * 26 + nx); q.push([nx, ny]);
        }
      }
      assert.ok(reached, 'stage ' + stage + ': spawn ' + sx + ' reaches the eagle');
    }
  }
});

test('the wave: 20 tanks, three power-up carriers, harder mixes later', () => {
  const page = createPage('battle-tanks/index.html');
  const q1 = json(page, 'enemyQueue(1)'), q9 = json(page, 'enemyQueue(9)');
  assert.strictEqual(q1.length, 20);
  assert.strictEqual(q1.filter(e => e.bonus).length, 3);
  const armor = q => q.filter(e => e.type === 'armor').length;
  assert.ok(armor(q9) > armor(q1));
});

test('bullets chip bricks, stop at steel unless the shot is star-3, and fly over water', () => {
  const page = createPage('battle-tanks/index.html');
  bare(page);
  const me = 'G.players[0].tank';
  page.run(`${me}.x = 64; ${me}.y = 120; ${me}.dir = 'u'; G.map[12 * N + 8] = BRICK; G.map[12 * N + 9] = BRICK; G.map[11 * N + 8] = BRICK; G.map[11 * N + 9] = BRICK;
    G.map[8 * N + 8] = STEEL; G.map[8 * N + 9] = STEEL; G.map[14 * N + 8] = WATER;`);
  page.run('fire(G.players[0].tank)');
  steps(page, 0.5);
  assert.deepStrictEqual(json(page, '[G.map[12 * N + 8], G.map[12 * N + 9], G.map[11 * N + 8]]'), [0, 0, 1], 'one strip of bricks gone, the next still there');
  page.run('fire(G.players[0].tank)'); steps(page, 0.5);
  page.run('fire(G.players[0].tank)'); steps(page, 1);
  assert.strictEqual(page.run('G.map[8 * N + 8]'), 2, 'steel holds');
  page.run('G.players[0].level = 3; fire(G.players[0].tank)');
  steps(page, 1);
  assert.strictEqual(page.run('G.map[8 * N + 8]'), 0, 'a star-3 shot breaks steel');
  assert.strictEqual(page.run(`tankFits(${me}, 64, 104)`), false, 'water blocks tanks');
});

test('tanks stop at walls and turn onto the 8 px grid', () => {
  const page = createPage('battle-tanks/index.html');
  bare(page);
  const me = 'G.players[0].tank';
  page.run(`${me}.x = 64; ${me}.y = 100; G.map[10 * N + 8] = STEEL; G.map[10 * N + 9] = STEEL;`);
  page.run(`G.players[0].input = { dir: 'u', fire: false }`);
  steps(page, 1);
  assert.strictEqual(Math.round(page.run(`${me}.y`)), 88, 'drives up to the steel and stops');
  page.run(`${me}.y = 101.5; G.players[0].input = { dir: 'r', fire: false }`);
  steps(page, 0.05);
  assert.strictEqual(page.run(`${me}.y % 8`), 0, 'snapped to the grid when turning');
});

test('enemies: shots kill, armor takes four, carriers drop a power-up, and the score adds up', () => {
  const page = createPage('battle-tanks/index.html');
  bare(page);
  page.run(`globalThis.foe = makeTank('armor', 64, 40, 'd', { hp: 4, bonus: true }); G.freeze = 99;
    const me = G.players[0].tank; me.x = 64; me.y = 120; me.dir = 'u';`);
  for (let i = 0; i < 4; i++) { page.run('fire(G.players[0].tank)'); steps(page, 0.8); }
  assert.strictEqual(page.run('G.tanks.includes(foe)'), false);
  assert.strictEqual(page.run('G.players[0].score'), 400);
  assert.strictEqual(page.run('G.players[0].kills.armor'), 1);
  assert.ok(page.run('G.power !== null'), 'the red tank dropped a power-up');
});

test('power-ups: helmet, star, shovel, grenade, extra life', () => {
  const page = createPage('battle-tanks/index.html');
  bare(page);
  const take = k => page.run(`G.power = { kind: '${k}', x: 0, y: 0, t: 10 }; takePower(G.players[0], G.players[0].tank)`);
  take('helmet'); assert.ok(page.run('G.players[0].tank.shield') >= 10);
  take('star'); take('star'); take('star'); take('star'); assert.strictEqual(page.run('G.players[0].level'), 3);
  take('shovel'); assert.ok(json(page, 'FORT.map(([x, y]) => G.map[y * N + x])').every(v => v === 2));
  page.run('for (const [x, y] of FORT.slice(0, 3)) G.map[y * N + x] = E; G.shovel = 0.01');
  steps(page, 0.1);
  assert.ok(json(page, 'FORT.map(([x, y]) => G.map[y * N + x])').every(v => v === 1), 'the fort comes back as brick, rebuilt');
  page.run(`makeTank('basic', 0, 0, 'd'); makeTank('fast', 192, 0, 'd')`);
  take('grenade'); assert.strictEqual(page.run(`G.tanks.filter(t => t.kind !== 'player').length`), 0);
  const lives = page.run('G.players[0].lives'); take('tank'); assert.strictEqual(page.run('G.players[0].lives'), lives + 1);
});

test('losing: a shot into the eagle ends the game; losing all lives too', () => {
  const page = createPage('battle-tanks/index.html');
  bare(page);
  page.run(`G.map.fill(E); globalThis.foe = makeTank('basic', 96, 160, 'd'); G.freeze = 99; fire(foe)`);
  steps(page, 0.6);
  assert.strictEqual(page.run('G.baseDead'), true);
  assert.strictEqual(page.run('G.phase'), 'lost');
  steps(page, 4);
  assert.strictEqual(page.run('G.over'), true);

  bare(page);
  page.run(`G.players[0].lives = 1; G.players[0].tank.x = 96; G.players[0].tank.y = 120; globalThis.foe = makeTank('basic', 96, 60, 'd'); G.freeze = 99; fire(foe)`);
  steps(page, 1);
  assert.strictEqual(page.run('G.players[0].dead'), true);
  assert.strictEqual(page.run('G.phase'), 'lost');
});

test('a stage is cleared when all 20 are gone, then the next one starts', () => {
  const page = createPage('battle-tanks/index.html');
  bare(page);
  page.run('G.queue = []');
  steps(page, 2.2);
  assert.strictEqual(page.run('G.phase'), 'tally');
  steps(page, 5);
  assert.strictEqual(page.run('G.stage'), 2);
  assert.strictEqual(page.run('G.queue.length'), 20);
});

test('two players: a teammate\'s shot only stuns, and online the guest drives player 2', () => {
  const host = createPage('battle-tanks/index.html'), guest = createPage('battle-tanks/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('battle-tanks', 'Ana'); r.addChannel(ch);`);
  guest.run(`startOnline(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('startOnline(r); G.phase = "play"; G.queue = [{ type: "basic", bonus: false }]; G.spawnT = 1e9; G.map.fill(E); for (const p of G.players) { p.respawn = 0; spawnPlayer(p); p.tank.spawnT = 0; p.tank.shield = 0; }');
  guest.run(`held.push({ code: 'ArrowUp', set: 'b', dir: 'u' }); fireHeld.a = true;`);
  guest.run('frame(1000)');
  c.pump();
  assert.deepStrictEqual(json(host, 'G.players[1].input'), { dir: 'u', fire: true });
  host.run('step(1 / 60); room.send(snapshot())');
  c.pump();
  assert.strictEqual(guest.run('V.tanks.filter(t => t.kind === "player").length'), 2);
  assert.strictEqual(guest.run('V.map.length'), 676);
  // friendly fire stuns
  host.run(`const a = G.players[0].tank, b = G.players[1].tank; a.x = 96; a.y = 120; a.dir = 'r'; b.x = 140; b.y = 120; G.players[1].input = { dir: '', fire: false }; G.bullets = []; fire(a)`);
  host.run('for (let i = 0; i < 30; i++) step(1 / 60)');
  assert.ok(host.run('G.players[1].tank.frozen') > 0);
  assert.strictEqual(host.run('G.players[1].lives'), 3);
  // hostile input and snapshots are ignored
  guest.run(`room.send({ t: 'in', d: '__proto__', f: 'x' })`);
  c.pump();
  assert.deepStrictEqual(json(host, 'G.players[1].input'), { dir: '', fire: false });
  host.run(`room.send({ t: 's', tk: [['x', 0, 0, 0, 'q']], pl: [], map: 'zz' }); room.send({ t: 's' })`);
  c.pump();
  assert.strictEqual(guest.run('V.map.length'), 676);
});
