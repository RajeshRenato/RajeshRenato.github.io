'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

// A host and two guests on one channel, over in-memory data channels. Each has a
// stand-in microphone track so the talk button works without a real one.
function channel() {
  const host = createPage('walkie-talkie/index.html');
  const g1 = createPage('walkie-talkie/index.html');
  const g2 = createPage('walkie-talkie/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a;
  g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  for (const p of [host, g1, g2]) p.run(`mic = { enabled: false, stop() {} }`);
  host.run(`enterChannel(Room.create(NAME, 'Ana')); room.addChannel(c1); room.addChannel(c2);`);
  g1.run(`enterChannel(Room.joinChannel(ch, 'Bo'))`);
  g2.run(`enterChannel(Room.joinChannel(ch, 'Cy <b>'))`);
  const pump = async () => {
    for (let i = 0; i < 4; i++) { c1.pump(); c2.pump(); await new Promise(r => setImmediate(r)); }
  };
  return { host, g1, g2, c1, c2, pump };
}

test('one person talks at a time, and the mic is only live for them', async () => {
  const { host, g1, g2, pump } = channel();
  await pump();
  assert.match(g1.run(`$('lcdCount').textContent`), /3 on the channel/);

  await g1.run('press()');
  await pump();
  assert.strictEqual(host.run('floor'), 1);
  assert.strictEqual(g2.run('floor'), 1);
  assert.strictEqual(g1.run('mic.enabled'), true);
  assert.strictEqual(g2.run('mic.enabled'), false);
  assert.strictEqual(g1.run(`$('lcdMain').textContent`), 'On air');
  assert.strictEqual(g2.run(`$('lcdMain').textContent`), 'Bo');

  await host.run('press()');
  await pump();
  assert.strictEqual(host.run('floor'), 1, 'the host waits too');
  assert.strictEqual(host.run('mic.enabled'), false);
  assert.strictEqual(host.run(`$('lcdSub').textContent`), 'Busy');

  g1.run('release()');
  await pump();
  assert.strictEqual(host.run('floor'), 0, 'whoever kept holding gets the channel next');
  assert.strictEqual(host.run('mic.enabled'), true);
  assert.strictEqual(g1.run('mic.enabled'), false);
  assert.strictEqual(g2.run(`$('lcdMain').textContent`), 'Ana');

  host.run('release()');
  await pump();
  assert.strictEqual(g1.run('floor'), -1);
  assert.strictEqual(g2.run(`$('lcdMain').textContent`), 'Channel clear');
});

test('the queue goes in the order people pressed, and letting go leaves it', async () => {
  const { host, g1, g2, pump } = channel();
  await pump();
  await host.run('press()');
  await g2.run('press()');
  await pump();
  await g1.run('press()');
  await pump();
  assert.deepStrictEqual(JSON.parse(host.run('JSON.stringify(waiting)')), [2, 1]);
  g2.run('release()');
  await pump();
  host.run('release()');
  await pump();
  assert.strictEqual(host.run('floor'), 1);
});

test('nobody can hold the channel for more than a minute', async () => {
  const { host, g1, pump } = channel();
  await pump();
  await g1.run('press()');
  await pump();
  host.run('floorSince -= 61000; tick()');
  await pump();
  assert.strictEqual(g1.run('floor'), -1);
  assert.strictEqual(g1.run('mic.enabled'), false);
  assert.match(g1.run(`$('lcdSub').textContent`), /Time is up/);
});

test('if the talker leaves, the channel clears', async () => {
  const { host, g1, g2, c1, pump } = channel();
  await pump();
  await g1.run('press()');
  await pump();
  c1.close();
  await pump();
  assert.strictEqual(host.run('floor'), -1);
  assert.strictEqual(g2.run('floor'), -1);
  assert.match(g2.run(`$('lcdCount').textContent`), /2 on the channel/);
  assert.match(g1.run(`$('lcdMain').textContent`), /Channel closed/);
});

test('who hears what: the host passes the talker on to everyone else', () => {
  const page = createPage('walkie-talkie/index.html');
  const route = (g, t) => page.run(`routeTarget(${g}, ${t})`);
  assert.strictEqual(route(1, 0), 'mic');
  assert.strictEqual(route(2, 1), 1);
  assert.strictEqual(route(1, 1), null, "talkers don't hear themselves");
  assert.strictEqual(route(1, -1), null);

  // with stand-in connections: each guest's sender gets the right track
  page.run(`
    const sender = () => ({ track: null, replaceTrack(t) { this.track = t; return Promise.resolve(); } });
    const fakePc = s => ({ getTransceivers: () => [{ receiver: { track: { kind: 'video' } }, sender: sender() }, { receiver: { track: { kind: 'audio' } }, sender: s }] });
    globalThis.s1 = sender(); globalThis.s2 = sender();
    enterChannel(Room.create(NAME, 'Ana'));
    peers.set(1, { pc: fakePc(s1), track: 'voice of 1' });
    peers.set(2, { pc: fakePc(s2), track: 'voice of 2' });
    request(2, true);
  `);
  assert.deepStrictEqual([page.run('s1.track'), page.run('s2.track')], ['voice of 2', null]);
  page.run('request(2, false); request(0, true)');
  assert.strictEqual(page.run('s1.track === mic && s2.track === mic'), true);
});

test('hostile messages: guests cannot take the channel for someone else, and names stay text', async () => {
  const { host, g1, g2, pump } = channel();
  await pump();
  g1.run(`room.send({ t: 'floor', id: 1 }); room.send({ t: 'talk', on: 'yes' }); room.send({ t: 'talk', on: true, id: 2 }); room.send(null)`);
  await pump();
  assert.strictEqual(host.run('floor'), 1, 'a talk request only ever speaks for the sender');
  assert.strictEqual(g2.run('floor'), 1);
  g1.run(`room.send({ t: 'talk', on: false })`);
  await pump();
  host.run(`room.send({ t: 'floor', id: 'x' }); room.send({ t: 'floor', id: -7 }); room.send({ t: 'floor', id: 1.5 })`);
  await pump();
  assert.strictEqual(g2.run('floor'), -1);
  assert.ok(!host.run(`$('people').innerHTML`).includes('<b>'));
  assert.ok(host.run(`$('people').innerHTML`).includes('Cy &lt;b&gt;'));
});
