'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

test('move generation matches known perft counts', () => {
  const { run } = createPage('chess/index.html');
  assert.deepStrictEqual([1, 2, 3, 4].map(d => run(`perft(fromFEN(START), ${d})`)), [20, 400, 8902, 197281]);
  assert.deepStrictEqual([1, 2, 3].map(d => run(`perft(fromFEN(${JSON.stringify(KIWIPETE)}), ${d})`)), [48, 2039, 97862]);
  assert.strictEqual(run(`perft(fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 4)`), 43238, 'en passant and pins');
  assert.strictEqual(run(`perft(fromFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), 3)`), 62379, 'promotions');
});

test('FEN round-trips and make/unmake restores the position', () => {
  const { run } = createPage('chess/index.html');
  assert.strictEqual(run(`toFEN(fromFEN(${JSON.stringify(KIWIPETE)}))`), KIWIPETE);
  run(`globalThis.p = fromFEN(${JSON.stringify(KIWIPETE)}); globalThis.before = toFEN(p);
    for (const m of legalMoves(p)) { makeMove(p, m); for (const r of legalMoves(p)) { makeMove(p, r); unmakeMove(p); } unmakeMove(p); }`);
  assert.strictEqual(run('toFEN(p)'), run('before'));
});

test('castling rules: not out of, through, or into check, and rights are lost', () => {
  const { run } = createPage('chess/index.html');
  const moves = fen => run(`legalMoves(fromFEN(${JSON.stringify(fen)})).map(uci).filter(u => u.startsWith('e1')).sort().join(' ')`);
  assert.match(moves('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), /e1c1.*e1g1/);
  assert.doesNotMatch(moves('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1'), /e1g1|e1c1/, 'no rights');
  assert.doesNotMatch(moves('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'.replace('4k3', '4r1k1')), /e1g1|e1c1/, 'not out of check');
  assert.doesNotMatch(moves('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1'), /e1g1/, 'not through f1');
  assert.doesNotMatch(moves('6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1'), /e1g1/, 'not into g1');
  assert.match(moves('1r4k1/8/8/8/8/8/8/R3K2R w KQ - 0 1'), /e1c1/, 'b1 may be attacked');
  run(`globalThis.p = fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')`);
  run(`makeMove(p, legalMoves(p).find(m => uci(m) === 'h1h8'))`);
  assert.strictEqual(run('castleStr(p.castle)'), 'Qq', 'moving a rook, or capturing one, loses that side');
});

test('SAN covers castling, captures, disambiguation, promotion, check, and mate', () => {
  const page = createPage('chess/index.html');
  page.run(`mode = 'local'; newGame(0)`);
  for (const u of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1']) page.run(`playUci('${u}')`);
  assert.deepStrictEqual(json(page, 'G.sans'), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'O-O']);
  page.run(`G.pos = fromFEN('7k/8/8/8/8/8/1N3N2/K7 w - - 0 1'); G.sans = []; G.keys = []; G.end = null`);
  page.run(`playUci('b2d3')`);
  assert.strictEqual(page.run('G.sans[0]'), 'Nbd3');
  page.run(`G.pos = fromFEN('k7/4P3/8/8/8/8/8/K6R w - - 0 1'); G.sans = []; G.end = null; playUci('e7e8q')`);
  assert.strictEqual(page.run('G.sans[0]'), 'e8=Q+');
  page.run(`G.pos = fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'); G.sans = []; G.end = null; playUci('a1a8')`);
  assert.strictEqual(page.run('G.sans[0]'), 'Ra8#');
  assert.deepStrictEqual(json(page, 'G.end'), { winner: 0, reason: 'checkmate' });
});

test('en passant, stalemate, the fifty-move rule, repetition, and dead positions', () => {
  const page = createPage('chess/index.html');
  page.run(`mode = 'local'; newGame(0)`);
  for (const u of ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']) assert.ok(page.run(`playUci('${u}')`), u);
  assert.strictEqual(page.run('G.sans[4]'), 'exd6');
  assert.strictEqual(page.run(`G.pos.b[sqFrom('d5')]`), 0, 'the passed pawn is removed');

  page.run(`G.pos = fromFEN('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'); G.end = null; G.keys = []; playUci('f7f8')`);
  assert.strictEqual(page.run('G.end.reason'), 'checkmate', 'Qf8 is mate here');
  page.run(`G.pos = fromFEN('7k/8/6K1/8/8/8/5Q2/8 w - - 0 1'); G.end = null; G.keys = []; playUci('f2f7')`);
  assert.deepStrictEqual(json(page, 'G.end'), { winner: -1, reason: 'stalemate' });

  page.run(`G.pos = fromFEN('7k/8/8/8/8/8/8/K6R w - - 99 80'); G.end = null; G.keys = []; playUci('h1h2')`);
  assert.strictEqual(page.run('G.end.reason'), 'the fifty-move rule');

  page.run(`newGame(0)`);
  for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) page.run(`playUci('${u}')`);
  assert.strictEqual(page.run('G.end.reason'), 'threefold repetition');

  const dead = fen => page.run(`insufficient(fromFEN('${fen}'))`);
  assert.strictEqual(dead('8/8/8/4k3/8/8/8/4K3 w - - 0 1'), true);
  assert.strictEqual(dead('8/8/8/4k3/8/8/8/4KN2 w - - 0 1'), true);
  assert.strictEqual(dead('8/8/8/4k3/2b5/8/8/4KB2 w - - 0 1'), true, 'bishops on the same color');
  assert.strictEqual(dead('8/8/8/4k3/3b4/8/8/4KB2 w - - 0 1'), false, 'bishops on different colors');
  assert.strictEqual(dead('8/8/8/4k3/8/8/8/3NKN2 w - - 0 1'), false);
});

test('a pawn reaching the last rank asks which piece to promote to', () => {
  const page = createPage('chess/index.html');
  page.run(`mode = 'local'; newGame(0); G.pos = fromFEN('k7/4P3/8/8/8/8/8/K7 w - - 0 1'); G.keys = []`);
  page.run(`tryMove(sqFrom('e7'), sqFrom('e8'))`);
  assert.deepStrictEqual(json(page, 'promoFor'), [100, 116]);
  assert.strictEqual(page.run('G.moves.length'), 0, 'nothing moves until a piece is picked');
  page.run('choosePromotion(N)');
  assert.strictEqual(page.run('G.sans[0]'), 'e8=N');
  assert.strictEqual(page.run(`G.pos.b[sqFrom('e8')]`), 2);
});

test('the bot mates in one, takes a free queen, and saves its own', () => {
  const { run } = createPage('chess/index.html');
  for (const lv of ['easy', 'normal', 'hard']) {
    assert.strictEqual(run(`uci(think(fromFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'), '${lv}'))`), 'a1a8', lv + ' mate');
  }
  assert.strictEqual(run(`uci(think(fromFEN('rnb1kbnr/pppp1ppp/8/4p1q1/3P4/2N5/PPP1PPPP/R1BQKBNR w KQkq - 0 3'), 'normal'))`), 'c1g5');
  const m = run(`uci(think(fromFEN('rnb1kbnr/pppp1ppp/8/4p1q1/4P2P/8/PPPP1PP1/RNBQKBNR b KQkq h3 0 3'), 'normal'))`);
  assert.strictEqual(m.slice(0, 2), 'g5', 'moves the attacked queen, got ' + m);
  const t = Date.now();
  run(`think(fromFEN(${JSON.stringify(KIWIPETE)}), 'hard')`);
  assert.ok(Date.now() - t < 2200, 'hard stays inside its time budget');
});

test('playing the bot: it answers your move, and colors swap on a rematch', async () => {
  const page = createPage('chess/index.html');
  page.run(`startLocal('bot'); level = 'easy'; commit('e2e4')`);
  await new Promise(r => setTimeout(r, 400));
  assert.strictEqual(page.run('G.moves.length'), 2);
  page.run('resign()');
  assert.deepStrictEqual(json(page, 'G.score'), [0, 0, 1]);
  page.run('rematch()');
  assert.strictEqual(page.run('G.aColor'), 1);
  await new Promise(r => setTimeout(r, 400));
  assert.strictEqual(page.run('G.moves.length'), 1, 'the bot opens as white');
});

test('online: the guest plays black on a flipped board, illegal moves are refused, rematch swaps', () => {
  const host = createPage('chess/index.html');
  const guest = createPage('chess/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('chess', 'Ana'); r.addChannel(c);`);
  guest.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run('attach(r)');
  c.pump();
  assert.strictEqual(guest.run('flipped()'), true);
  assert.strictEqual(host.run('flipped()'), false);

  guest.run(`commit('e7e5')`);
  c.pump();
  assert.strictEqual(host.run('G.moves.length'), 0, 'not the guest\'s turn');
  for (const [p, u] of [[host, 'f2f3'], [guest, 'e7e5'], [host, 'g2g4'], [guest, 'e1e2'], [guest, 'd8h4']]) { p.run(`commit('${u}')`); c.pump(); }
  assert.deepStrictEqual(json(guest, 'G.sans'), ['f3', 'e5', 'g4', 'Qh4#']);
  assert.strictEqual(host.run('G.end.reason'), 'checkmate');
  assert.match(guest.run(`$('status').textContent`), /You win by checkmate/);
  assert.deepStrictEqual(json(guest, 'G.score'), [0, 0, 1]);

  guest.run('rematch()');
  c.pump();
  assert.strictEqual(guest.run('myColor()'), 0, 'the guest has white now');
  assert.strictEqual(guest.run('flipped()'), false);
  guest.run(`commit('d2d4')`); c.pump();
  host.run('resign()'); c.pump();
  assert.deepStrictEqual(json(guest, 'G.score'), [0, 0, 2]);
});
