'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const sq = (x, y) => y * 8 + x;

test('the opening position has 12 pieces each and 7 moves for red', () => {
  const { run } = createPage('checkers/index.html');
  run('globalThis.b = startBoard()');
  assert.strictEqual(run('b.filter(v => v === 1).length'), 12);
  assert.strictEqual(run('b.filter(v => v === 2).length'), 12);
  assert.strictEqual(run('legalMoves(b, 1).length'), 7);
  assert.strictEqual(run('legalMoves(b, 2).length'), 7);
});

test('captures are forced and multi-jumps chain', () => {
  const { run } = createPage('checkers/index.html');
  run(`globalThis.b = new Array(64).fill(0);
    b[${sq(1, 6)}] = 1; b[${sq(2, 5)}] = 2; b[${sq(4, 3)}] = 2; b[${sq(6, 7)}] = 1;`);
  assert.deepStrictEqual(json({ run }, 'legalMoves(b, 1)'), [[sq(1, 6), sq(3, 4), sq(5, 2)]], 'only the double jump is allowed');
  run(`globalThis.n = applyMove(b, legalMoves(b, 1)[0])`);
  assert.strictEqual(run('n'), 2);
  assert.strictEqual(run('b.filter(v => v === 2).length'), 0);
});

test('reaching the far row crowns a king and ends the move', () => {
  const { run } = createPage('checkers/index.html');
  run(`globalThis.b = new Array(64).fill(0); b[${sq(2, 2)}] = 1; b[${sq(3, 1)}] = 2; b[${sq(5, 1)}] = 2;`);
  const moves = run('JSON.stringify(legalMoves(b, 1))');
  assert.deepStrictEqual(JSON.parse(moves), [[sq(2, 2), sq(4, 0)]], 'the jump that crowns stops there, even with another jump available to a king');
  run('applyMove(b, legalMoves(b, 1)[0])');
  assert.strictEqual(run(`b[${sq(4, 0)}]`), 3);
  assert.strictEqual(run(`legalMoves(b, 1).some(m => m.length === 2 && m[1] === ${sq(5, 1)} - 0)`), false);
  run(`b[${sq(4, 0)}] = 0; b[${sq(4, 4)}] = 3; b[${sq(5, 1)}] = 0; b[${sq(3, 1)}] = 0;`);
  assert.strictEqual(run('legalMoves(b, 1).length'), 4, 'kings move both ways');
});

test('a player with no moves loses, and the bot finds a capture', () => {
  const page = createPage('checkers/index.html');
  page.run(`mode = 'local'; newGame(1); G.board = new Array(64).fill(0);
    G.board[${sq(1, 6)}] = 1; G.board[${sq(2, 5)}] = 2;`);
  page.run(`apply([${sq(1, 6)}, ${sq(3, 4)}])`);
  assert.strictEqual(page.run('G.over'), true);
  assert.strictEqual(page.run('G.winner'), 1);

  page.run(`globalThis.b = new Array(64).fill(0); b[${sq(3, 2)}] = 2; b[${sq(4, 3)}] = 1; b[${sq(0, 7)}] = 1;`);
  assert.deepStrictEqual(json(page, `botMove(b, 2, 'hard')`), [sq(3, 2), sq(5, 4)]);
});

test('tapping a piece then a square makes the move, step by step for jumps', () => {
  const page = createPage('checkers/index.html');
  page.run(`mode = 'local'; newGame(1); G.board = new Array(64).fill(0);
    G.board[${sq(1, 6)}] = 1; G.board[${sq(2, 5)}] = 2; G.board[${sq(4, 3)}] = 2; G.board[${sq(7, 0)}] = 2;`);
  page.run(`tapSquare(${sq(1, 6)}); tapSquare(${sq(3, 4)})`);
  assert.deepStrictEqual(json(page, 'sel'), [sq(1, 6), sq(3, 4)], 'waits for the rest of the jump');
  page.run(`tapSquare(${sq(5, 2)})`);
  assert.strictEqual(page.run(`G.board[${sq(5, 2)}]`), 1);
  assert.strictEqual(page.run('G.turn'), 2);
});

test('online: the guest plays white on a flipped board and illegal moves are refused', () => {
  const host = createPage('checkers/index.html');
  const guest = createPage('checkers/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('checkers', 'Ana'); r.addChannel(c);`);
  guest.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('attach(r)');
  c.pump();
  assert.strictEqual(guest.run('flipped()'), true);
  host.run(`commit([${sq(2, 5)}, ${sq(3, 4)}])`);
  c.pump();
  assert.strictEqual(guest.run(`G.board[${sq(3, 4)}]`), 1);
  guest.run(`commit([${sq(1, 2)}, ${sq(1, 4)}])`);
  c.pump();
  assert.strictEqual(host.run('G.turn'), 2, 'an illegal path is ignored');
  guest.run(`commit([${sq(1, 2)}, ${sq(0, 3)}])`);
  c.pump();
  assert.strictEqual(host.run('G.turn'), 1);
  assert.deepStrictEqual(json(guest, 'G.board'), json(host, 'G.board'));
});
