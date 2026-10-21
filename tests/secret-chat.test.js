'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const fp = n => Array.from({ length: 32 }, (_, i) => ((i * 7 + n) % 256).toString(16).padStart(2, '0').toUpperCase()).join(':');
const sdp = n => 'v=0\r\na=fingerprint:sha-256 ' + fp(n) + '\r\na=setup:actpass\r\n';

function pair() {
  const a = createPage('secret-chat/index.html');
  const b = createPage('secret-chat/index.html');
  const c = channelPair();
  a.sandbox.ch = c.a; b.sandbox.ch = c.b;
  a.run(`role = 'h'; attach(ch)`);
  b.run(`role = 'g'; attach(ch)`);
  return { a, b, c };
}
const texts = page => JSON.parse(page.run(`JSON.stringify([...msgs.values()].map(r => r.el.querySelector ? r.el.children.map(x => x.textContent).join('|') : ''))`));

test('both sides compute the same safety code, and a different key gives a different one', async () => {
  const { run } = createPage('secret-chat/index.html');
  const x = await run(`safetyCode(${JSON.stringify(sdp(1))}, ${JSON.stringify(sdp(2))})`);
  const y = await run(`safetyCode(${JSON.stringify(sdp(2))}, ${JSON.stringify(sdp(1))})`);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(y)), 'order does not matter');
  assert.strictEqual(x.words.length, 3);
  assert.match(x.digits, /^\d{4}$/);
  const m = await run(`safetyCode(${JSON.stringify(sdp(1))}, ${JSON.stringify(sdp(3))})`);
  assert.notDeepStrictEqual(JSON.parse(JSON.stringify(m)), JSON.parse(JSON.stringify(x)), 'someone in the middle changes the code');
  assert.strictEqual(await run(`safetyCode('v=0', 'v=0')`), null);
  assert.strictEqual(run('new Set(SAS_WORDS).size'), 64);
});

test('messages arrive, get marked seen, and plain text is never treated as HTML', () => {
  const { a, b, c } = pair();
  c.pump();
  assert.strictEqual(a.run('open'), true);
  a.run(`$('input').value = '<img src=x onerror=alert(1)> hi'; sendText()`);
  c.pump();
  assert.strictEqual(b.run('msgs.size'), 1);
  assert.strictEqual(b.run(`[...msgs.values()][0].el.children[0].textContent`), '<img src=x onerror=alert(1)> hi');
  assert.strictEqual(b.run(`[...msgs.values()][0].el.children[0].innerHTML`), '', 'set as text, not markup');
  assert.strictEqual(a.run(`[...msgs.values()][0].el.querySelector('.st') !== null`), true);
});

test('hidden messages arrive hidden, and disappearing ones vanish on both sides', () => {
  const { a, b, c } = pair();
  c.pump();
  a.run(`setSecret(true); $('input').value = 'hunter2'; sendText()`);
  c.pump();
  assert.strictEqual(b.run(`[...msgs.values()][0].secret`), true);
  assert.match(b.run(`[...msgs.values()][0].el.className`), /secret/);
  assert.strictEqual(a.run(`$('secretChip').getAttribute('aria-pressed')`), 'false', 'hidden mode turns itself off after sending');

  a.run(`$('timer').value = '30'; $('input').value = 'gone soon'; sendText()`);
  c.pump();
  assert.strictEqual(b.run('msgs.size'), 2);
  for (const p of [a, b]) p.run(`for (const r of msgs.values()) if (r.expiresAt) r.expiresAt = Date.now() - 1; tickTimers()`);
  assert.strictEqual(a.run('msgs.size'), 1);
  assert.strictEqual(b.run('msgs.size'), 1);
});

test('wipe clears both screens, and leaving tells the other side', () => {
  const { a, b, c } = pair();
  c.pump();
  a.run(`$('input').value = 'one'; sendText()`);
  b.run(`$('input').value = 'two'; sendText()`);
  c.pump();
  assert.strictEqual(a.run('msgs.size'), 2);
  b.run(`wipe(); send({ t: 'wipe' })`);
  c.pump();
  assert.strictEqual(a.run('msgs.size'), 0);
  a.run(`send({ t: 'bye' })`);
  c.pump();
  assert.strictEqual(b.run('open'), false);
  assert.strictEqual(b.run(`$('send').disabled`), true);
});

test('a file is sent in chunks and arrives byte for byte', async () => {
  const { a, b, c } = pair();
  c.pump();
  const bytes = Array.from({ length: 40000 }, (_, i) => (i * 31) % 256);
  b.run(`globalThis.got = null; const orig = fileChunk; fileChunk = d => { orig(d); }; const done0 = fileBubble; fileBubble = (id, meta, mine) => { const r = done0(id, meta, mine); const d = r.done; r.done = blob => { got = blob; d(blob); }; return r; };`);
  a.sandbox.bytes = bytes;
  await a.run(`sendFile(new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }))`);
  c.pump();
  const out = await b.run(`got.arrayBuffer().then(b => Array.from(new Uint8Array(b)))`);
  assert.strictEqual(out.length, bytes.length);
  assert.ok(out.every((v, i) => v === bytes[i]));
});
