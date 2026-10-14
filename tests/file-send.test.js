'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

// two ends of a data channel that deliver asynchronously and in order, like the real thing
function channelPair() {
  const make = () => ({ readyState: 'open', bufferedAmount: 0, addEventListener() {}, removeEventListener() {} });
  const a = make(), b = make();
  a.send = m => setImmediate(() => b.onmessage({ data: m }));
  b.send = m => setImmediate(() => a.onmessage({ data: m }));
  return { a, b };
}

async function until(check, what, ms = 8000) {
  const t0 = Date.now();
  while (!check()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what);
    await new Promise(r => setImmediate(r));
  }
}

function bytes(n, seed) {
  const out = new Uint8Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; out[i] = s >>> 24; }
  return out;
}

const named = (data, name, type) => Object.assign(new Blob([data], { type }), { name });

test('files sent from one browser arrive byte for byte, after the receiver accepts', async () => {
  const alice = createPage('file-send/index.html'), bob = createPage('file-send/index.html');
  const ch = channelPair();
  alice.sandbox.ch = ch.a; bob.sandbox.ch = ch.b;
  alice.run('wire(ch)'); bob.run('wire(ch)');
  assert.strictEqual(alice.run('connected'), true);

  const big = bytes(300 * 1024 + 17, 7), small = new TextEncoder().encode('hello from alice');
  alice.sandbox.files = [named(big, 'photo.raw', 'application/octet-stream'), named(small, 'note.txt', 'text/plain')];
  alice.run('offerFiles(files)');
  await until(() => bob.run('pendingAsk !== null'), 'the offer');
  assert.strictEqual(bob.run('pendingAsk.files.length'), 2);
  assert.strictEqual(bob.run('pendingAsk.files[0].name'), 'photo.raw');
  assert.strictEqual(bob.run('incoming'), null, 'nothing is received before accepting');

  bob.run('acceptIncoming()');
  await until(() => bob.run('!!(incoming && incoming.saved[1])'), 'both files');
  const got0 = new Uint8Array(await bob.run('incoming.saved[0].arrayBuffer()'));
  const got1 = new TextDecoder().decode(await bob.run('incoming.saved[1].arrayBuffer()'));
  assert.strictEqual(got0.length, big.length);
  assert.ok(got0.every((v, i) => v === big[i]), 'big file must match byte for byte');
  assert.strictEqual(got1, 'hello from alice');
  assert.strictEqual(bob.run('incoming.saved[1].type'), 'text/plain');
  const senderStatus = () => alice.run(`document.getElementById('transfers').children.map(li => li.children[0].children[1].textContent).join('|')`);
  await until(() => !alice.run('sending'), 'alice to finish');
  assert.match(senderStatus(), /delivered\|.*delivered$/, 'the sender only says delivered once the receiver confirms: ' + senderStatus());
});

test('a declined batch is not sent, and the other side can send back', async () => {
  const alice = createPage('file-send/index.html'), bob = createPage('file-send/index.html');
  const ch = channelPair();
  alice.sandbox.ch = ch.a; bob.sandbox.ch = ch.b;
  alice.run('wire(ch)'); bob.run('wire(ch)');

  alice.sandbox.files = [named(bytes(1000, 3), 'nope.bin', '')];
  alice.run('offerFiles(files)');
  await until(() => bob.run('pendingAsk !== null'), 'the offer');
  bob.run('declineIncoming()');
  await until(() => alice.run('!sending'), 'alice to finish the queue');
  assert.strictEqual(bob.run('incoming'), null);

  bob.sandbox.files = [named(bytes(70000, 9), 'reply.bin', '')];
  bob.run('offerFiles(files)');
  await until(() => alice.run('pendingAsk !== null'), 'the reverse offer');
  alice.run('acceptIncoming()');
  await until(() => alice.run('!!(incoming && incoming.saved[0])'), 'the reverse file');
  assert.strictEqual(alice.run('incoming.saved[0].size'), 70000);
});

test('sizes read naturally', () => {
  const { run } = createPage('file-send/index.html');
  assert.strictEqual(run('fmtBytes(512)'), '512 B');
  assert.strictEqual(run('fmtBytes(1536)'), '1.50 KB');
  assert.strictEqual(run('fmtBytes(25 * 1024 * 1024)'), '25.0 MB');
  assert.strictEqual(run('fmtBytes(3 * 1024 ** 3)'), '3.00 GB');
});
