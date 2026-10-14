'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

test('link codes survive the round trip and replies are found in pasted text', async () => {
  const { run } = createPage('linkplay/index.html');
  const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:abcd\r\na=ice-pwd:0123456789abcdefghijklmn\r\n'.repeat(3);
  const code = await run(`LinkPlay.pack({ type: 'answer', sdp: ${JSON.stringify(sdp)} })`);
  assert.match(code, /^z[A-Za-z0-9_-]+$/);
  assert.strictEqual((await run(`LinkPlay.unpack(${JSON.stringify(code)})`)).sdp, sdp);

  assert.deepStrictEqual(json({ run }, `LinkPlay.fromHash('#offer=ab12cd.${code}')`), { kind: 'offer', id: 'ab12cd', code });
  assert.strictEqual(run(`LinkPlay.fromHash('#offer=nope')`), null);
  assert.deepStrictEqual(json({ run }, `LinkPlay.parseReply('  https://x.io/game/#answer=ab12cd.${code}\\n')`), { id: 'ab12cd', code });
  assert.deepStrictEqual(json({ run }, `LinkPlay.parseReply('ab12cd.${code}')`), { id: 'ab12cd', code });
  assert.strictEqual(run(`LinkPlay.parseReply('hello')`), null);
});

test('a host can only accept replies to its own invites', async () => {
  const { run } = createPage('linkplay/index.html');
  run(`globalThis.h = LinkPlay.host('t')`);
  assert.match(await run(`h.accept('nonsense')`), /doesn't look like a reply/);
  assert.match(await run(`h.accept('zz99zz.zAAAA')`), /different invite/);
});

test('a room relays between a host and two guests, and tracks who leaves', () => {
  const host = createPage('linkplay/index.html');
  const g1 = createPage('linkplay/index.html');
  const g2 = createPage('linkplay/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a;
  g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let i = 0; i < 3; i++) { c1.pump(); c2.pump(); } };

  host.run(`globalThis.r = Room.create('t', 'Ana'); r.addChannel(c1); r.addChannel(c2); globalThis.got = [];
    r.on('message', (m, from) => { got.push([from, m.n]); r.send({ n: m.n, id: from }); });`);
  g1.run(`globalThis.r = Room.joinChannel(ch, 'Bo'); globalThis.got = []; r.on('message', m => got.push([m.id, m.n]));`);
  g2.run(`globalThis.r = Room.joinChannel(ch, '  '); globalThis.got = []; globalThis.ended = false;
    r.on('message', m => got.push([m.id, m.n])); r.on('close', () => { ended = true; });`);
  pump();

  assert.deepStrictEqual(json(host, 'r.players.map(p => [p.id, p.name])'), [[0, 'Ana'], [1, 'Bo'], [2, 'Player 3']]);
  assert.strictEqual(g1.run('r.me'), 1);
  assert.strictEqual(g2.run('r.me'), 2);
  assert.deepStrictEqual(json(g2, 'r.players.map(p => p.name)'), ['Ana', 'Bo', 'Player 3']);
  assert.notStrictEqual(json(g1, 'r.players[1].color'), json(g1, 'r.players[2].color'));

  g1.run(`r.send({ n: 7 })`);
  pump();
  assert.deepStrictEqual(json(host, 'got'), [[1, 7]]);
  assert.deepStrictEqual(json(g2, 'got'), [[1, 7]], 'the host passes a guest message on');

  c1.close();
  pump();
  assert.deepStrictEqual(json(host, 'r.players.map(p => p.id)'), [0, 2]);
  assert.deepStrictEqual(json(g2, 'r.players.map(p => p.id)'), [0, 2]);

  host.run('r.close()');
  pump();
  assert.strictEqual(g2.run('ended'), true);
});

test('the demo shows each other\'s cursors and does not echo your own taps', () => {
  const host = createPage('linkplay/index.html');
  const guest = createPage('linkplay/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`begin(Room.create('linkplay-demo', 'Ana')); room.addChannel(c);`);
  guest.run(`begin(Room.joinChannel(ch, 'Bo'));`);
  c.pump();
  guest.run(`share({ t: 'move', x: 0.25, y: 0.5 }); share({ t: 'tap', x: 0.25, y: 0.5 }); addTap(room.me, 0.25, 0.5);`);
  c.pump();
  assert.deepStrictEqual(json(host, 'cursors.get(1)'), { x: 0.25, y: 0.5 });
  assert.strictEqual(host.run('taps.length'), 1);
  assert.strictEqual(guest.run('taps.length'), 1, 'the relayed copy of your own tap is ignored');
  host.run(`share({ t: 'move', x: 0.75, y: 0.1 })`);
  c.pump();
  assert.deepStrictEqual(json(guest, 'cursors.get(0)'), { x: 0.75, y: 0.1 });
});
