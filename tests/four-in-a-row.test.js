'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

test('lines are found in every direction and full columns refuse discs', () => {
  const { run } = createPage('four-in-a-row/index.html');
  run(`globalThis.b = emptyBoard(); for (let c = 0; c < 4; c++) b[c * ROWS] = 1;`);
  assert.strictEqual(run('findLine(b).p'), 1);
  run(`b = emptyBoard(); for (let r = 2; r < 6; r++) b[3 * ROWS + r] = 2;`);
  assert.strictEqual(run('findLine(b).p'), 2);
  run(`b = emptyBoard(); for (let k = 0; k < 4; k++) b[(k + 1) * ROWS + k] = 1;`);
  assert.strictEqual(run('findLine(b).p'), 1, 'rising diagonal');
  run(`b = emptyBoard(); for (let k = 0; k < 4; k++) b[(k + 2) * ROWS + (4 - k)] = 2;`);
  assert.strictEqual(run('findLine(b).p'), 2, 'falling diagonal');
  run(`b = emptyBoard(); for (let r = 0; r < 6; r++) b[r] = r % 2 + 1;`);
  assert.strictEqual(run('findLine(b)'), null);
  assert.strictEqual(run('canDrop(b, 0)'), false);
});

test('the bot takes a win and blocks a loss', () => {
  const { run } = createPage('four-in-a-row/index.html');
  run(`globalThis.b = emptyBoard(); b[0] = 2; b[ROWS] = 2; b[2 * ROWS] = 2; b[6 * ROWS] = 1; b[6 * ROWS + 1] = 1;`);
  assert.strictEqual(run(`botMove(b, 2, 'normal')`), 3, 'completes its own row');
  run(`b = emptyBoard(); b[0] = 1; b[ROWS] = 1; b[2 * ROWS] = 1; b[6 * ROWS] = 2; b[5 * ROWS] = 2;`);
  assert.strictEqual(run(`botMove(b, 2, 'normal')`), 3, 'blocks yours');
  run(`b = emptyBoard(); b[0] = 1; b[ROWS] = 1; b[2 * ROWS] = 1;`);
  assert.strictEqual(run(`botMove(b, 2, 'hard')`), 3);
});

test('a hard bot beats a random player', () => {
  const { run } = createPage('four-in-a-row/index.html');
  const result = run(`(() => {
    let s = 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let wins = 0;
    for (let g = 0; g < 4; g++) {
      const b = emptyBoard(); let p = 1, line = null;
      while (!line && !full(b)) {
        let c;
        if (p === 1) { const ok = [0,1,2,3,4,5,6].filter(c => canDrop(b, c)); c = ok[Math.floor(rand() * ok.length)]; }
        else c = botMove(b, 2, 'normal', rand);
        b[c * ROWS + height(b, c)] = p; line = findLine(b); p = 3 - p;
      }
      if (line && line.p === 2) wins++;
    }
    return wins;
  })()`);
  assert.strictEqual(result, 4);
});

test('online: moves go through the host and both sides see the same board', () => {
  const host = createPage('four-in-a-row/index.html');
  const guest = createPage('four-in-a-row/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('four-in-a-row', 'Ana'); r.addChannel(c);`);
  guest.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('attach(r)');
  c.pump();
  assert.strictEqual(guest.run('G.turn'), 1);

  guest.run('play(3)');
  c.pump();
  assert.strictEqual(host.run('G.board[3 * ROWS]'), 0, 'not your turn');
  for (const [who, col] of [[host, 3], [guest, 4], [host, 3], [guest, 4], [host, 3], [guest, 4], [host, 3]]) {
    who.run(`play(${col})`);
    c.pump();
  }
  assert.strictEqual(host.run('G.over'), true);
  assert.deepStrictEqual(json(guest, 'G.board'), json(host, 'G.board'));
  assert.strictEqual(guest.run('G.line.p'), 1);
  assert.match(guest.run(`$('status').textContent`), /Ana wins/);
  assert.deepStrictEqual(json(guest, 'G.score'), [0, 1, 0]);

  guest.run('rematch()');
  c.pump();
  assert.strictEqual(guest.run('G.over'), false);
  assert.strictEqual(guest.run('G.turn'), 2, 'the other player starts the rematch');
});
