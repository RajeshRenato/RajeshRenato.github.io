'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

// arrays from another sandbox fail deepStrictEqual on prototype, so compare as JSON
const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

// two in-memory ends of a data channel; messages wait in a queue until pumped
function channelPair() {
  const toA = [], toB = [];
  const a = { readyState: 'open', send: m => toB.push(m) };
  const b = { readyState: 'open', send: m => toA.push(m) };
  return {
    a, b,
    dropNextToB() { toB.drop = true; },
    pump() {
      while (toA.length || toB.length) {
        while (toB.length) { const m = toB.shift(); if (toB.drop && JSON.parse(m).t === 's') { toB.drop = false; continue; } b.onmessage({ data: m }); }
        while (toA.length) a.onmessage({ data: toA.shift() });
      }
    },
  };
}

test('crashing into a wall, a trail, or head-on ends the round correctly', () => {
  const { run } = createPage('cycle-duel/index.html');
  run('globalThis.s = newRound(); s.players[0].x = 62; s.players[0].dir = 1;');
  run('simTick(s); simTick(s);');
  assert.strictEqual(run('s.players[0].alive'), false, 'should hit the right wall');
  assert.strictEqual(run('s.over && s.winner'), 1);

  run('s = newRound(); s.players[1].x = s.players[0].x + 2; s.players[1].y = s.players[0].y; s.players[1].dir = 3;');
  run('simTick(s);');
  assert.strictEqual(run('s.over'), true);
  assert.strictEqual(run('s.winner'), -1, 'moving into the same cell is a draw');

  run('s = newRound(); s.grid[s.players[0].y * GW + s.players[0].x + 1] = 2; simTick(s);');
  assert.strictEqual(run('s.players[0].alive'), false, 'should hit a trail');
});

test('turn queue ignores reversals and holds at most two turns', () => {
  const { run } = createPage('cycle-duel/index.html');
  run('globalThis.s = newRound();');
  assert.strictEqual(run('queueTurn(s, 0, 3)'), false, 'no reversing');
  assert.strictEqual(run('queueTurn(s, 0, 0)'), true);
  assert.strictEqual(run('queueTurn(s, 0, 3)'), true, 'a quick second turn is kept');
  assert.strictEqual(run('queueTurn(s, 0, 2)'), false, 'queue is full');
  run('simTick(s); simTick(s);');
  assert.strictEqual(run('s.players[0].dir'), 3);
});

test('the bot avoids crashing for a good while', () => {
  const { run } = createPage('cycle-duel/index.html');
  run('globalThis.s = newRound(); while (!s.over && s.tick < 400) { botMove(s, 0); botMove(s, 1); simTick(s); }');
  assert.ok(run('s.tick') > 60, 'bots crashed after only ' + run('s.tick') + ' ticks');
});

test('a local match plays rounds to three and offers a rematch', () => {
  const page = createPage('cycle-duel/index.html');
  const { run } = page;
  run(`startMatch('local'); globalThis.t = 0;`);
  for (let r = 0; r < 3; r++) {
    run('playerTurn(1, 0);');
    run('for (let i = 0; i < 400 && phase !== "roundOver" && phase !== "matchOver"; i++) { t += 16; frame(t); }');
    if (run('phase') === 'roundOver') run('for (let i = 0; i < 200 && phase === "roundOver"; i++) { t += 16; frame(t); }');
  }
  assert.strictEqual(run('phase'), 'matchOver');
  assert.deepStrictEqual(json(page, 'score'), [3, 0]);
  run('rematch();');
  assert.deepStrictEqual(json(page, 'score'), [0, 0]);
  assert.strictEqual(run('phase'), 'countdown');
});

test('online: the guest mirrors the host and its turns reach the host', () => {
  const host = createPage('cycle-duel/index.html');
  const guest = createPage('cycle-duel/index.html');
  const ch = channelPair();
  host.sandbox.chan0 = ch.a;
  guest.sandbox.chan0 = ch.b;
  guest.run(`wire(chan0, 'guest')`);
  host.run(`wire(chan0, 'host')`);
  ch.pump();
  assert.strictEqual(guest.run('mode'), 'guest');
  assert.strictEqual(guest.run('round'), 1);

  let t = 0;
  const tickBoth = n => { for (let i = 0; i < n; i++) { t += 16; host.run(`frame(${t})`); ch.pump(); guest.run(`frame(${t})`); } };
  tickBoth(170);
  assert.strictEqual(host.run('phase'), 'play');
  assert.strictEqual(guest.run('view.tick'), host.run('sim.tick'));
  assert.deepStrictEqual(json(guest, 'view.players.map(p => [p.x, p.y, p.dir])'), json(host, 'sim.players.map(p => [p.x, p.y, p.dir])'));
  assert.ok(guest.run('Array.from(view.grid).join("")') === host.run('Array.from(sim.grid).join("")'), 'trails should match');

  guest.run('playerTurn(1, 0)');
  ch.pump();
  tickBoth(10);
  assert.strictEqual(host.run('sim.players[1].dir'), 0, 'host should apply the guest turn');
  assert.strictEqual(guest.run('view.players[1].dir'), 0);
  assert.ok(guest.run('rtt') >= 0);

  ch.dropNextToB();
  tickBoth(4);
  tickBoth(12);
  assert.strictEqual(guest.run('view.tick'), host.run('sim.tick'), 'a missed snapshot is recovered with a full sync');
  assert.ok(guest.run('Array.from(view.grid).join("")') === host.run('Array.from(sim.grid).join("")'));

  for (let r = 0; r < 6 && host.run('phase') !== 'matchOver'; r++) {
    tickBoth(400);
    if (host.run('phase') === 'countdown' || host.run('phase') === 'play') guest.run('playerTurn(1, 0)');
    ch.pump();
  }
  for (let i = 0; i < 40 && host.run('phase') !== 'matchOver'; i++) { guest.run('playerTurn(1, 0)'); ch.pump(); tickBoth(150); }
  assert.strictEqual(host.run('phase'), 'matchOver');
  assert.strictEqual(guest.run('phase'), 'matchOver');
  assert.deepStrictEqual(json(guest, 'score'), json(host, 'score'));

  guest.run('rematch()');
  ch.pump();
  assert.strictEqual(host.run('phase'), 'countdown');
  assert.deepStrictEqual(json(guest, 'score'), [0, 0]);

  host.run(`send({ t: 'bye' })`);
  ch.pump();
  assert.strictEqual(guest.run('phase'), 'gone');
});

test('invite and reply codes survive the round trip and stay URL-safe', async () => {
  const { run } = createPage('cycle-duel/index.html');
  const sdp = 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\n' +
    'a=extmap-allow-mixed\r\na=msid-semantic: WMS\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' +
    'c=IN IP4 0.0.0.0\r\na=candidate:1 1 udp 2122260223 192.168.1.20 54321 typ host generation 0\r\n' +
    'a=candidate:2 1 udp 1686052607 203.0.113.7 54321 typ srflx raddr 192.168.1.20 rport 54321\r\n' +
    'a=ice-ufrag:abcd\r\na=ice-pwd:0123456789abcdefghijklmn\r\na=ice-options:trickle\r\n' +
    'a=fingerprint:sha-256 ' + Array.from({ length: 32 }, (_, i) => (i * 7 % 256).toString(16).padStart(2, '0').toUpperCase()).join(':') +
    '\r\na=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n';
  const code = await run(`LinkPlay.pack({ type: 'offer', sdp: ${JSON.stringify(sdp)} })`);
  assert.match(code, /^k[A-Za-z0-9_-]+$/);
  assert.ok(code.length < 120, 'a short code: ' + code.length);
  const back = await run(`LinkPlay.unpack(${JSON.stringify(code)})`);
  assert.strictEqual(back.type, 'offer');
  for (const part of ['a=ice-ufrag:abcd', 'a=ice-pwd:0123456789abcdefghijklmn', 'a=setup:actpass', 'a=mid:0', ' 192.168.1.20 54321 typ host', ' 203.0.113.7 54321 typ srflx', sdp.match(/a=fingerprint:.*/)[0]])
    assert.ok(back.sdp.includes(part), 'keeps ' + part);
  assert.strictEqual(await run(`hostAccept('nonsense')`), false);
});
