'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = createPage('secret-note/index.html');
const { run } = page;
const call = expr => run(expr);

test('a note survives the round trip, including emoji and line breaks', async () => {
  const text = 'Gate code: 4471\nWi-Fi: söderhavn-5G 🔐\n' + 'x'.repeat(10);
  const code = await call(`encryptNote(${JSON.stringify(text)})`);
  assert.match(code, /^1k[zr]\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.strictEqual(await call(`decryptNote(${JSON.stringify(code)})`), text);
  const again = await call(`encryptNote(${JSON.stringify(text)})`);
  assert.notStrictEqual(again, code, 'every link uses a fresh key and IV');
});

test('long notes are compressed before encryption', async () => {
  const text = 'the same sentence again and again. '.repeat(80);
  const code = await call(`encryptNote(${JSON.stringify(text)})`);
  assert.ok(code.startsWith('1kz'), 'should be deflated');
  assert.ok(code.length < text.length / 2, 'link should be much shorter than the note');
  assert.strictEqual(await call(`decryptNote(${JSON.stringify(code)})`), text);
});

test('password notes need the right password', async () => {
  const code = await call(`encryptNote('meet at 7', 'correct horse')`);
  assert.ok(code.startsWith('1p'));
  assert.strictEqual(code.split('.').length, 4, 'no key travels in a password link');
  assert.strictEqual(await call(`decryptNote(${JSON.stringify(code)}, 'correct horse')`), 'meet at 7');
  await assert.rejects(call(`decryptNote(${JSON.stringify(code)}, 'wrong')`), /password/);
});

test('a tampered link is rejected instead of showing garbage', async () => {
  const code = await call(`encryptNote('original text')`);
  const parts = code.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  await assert.rejects(call(`decryptNote(${JSON.stringify(parts.join('.'))})`), /damaged/);
  await assert.rejects(call(`decryptNote('not-a-note')`), /damaged/);
  assert.strictEqual(call(`parseCode('2kz.a.b.c')`), null);
});

test('opening a link shows the note and clears it from the address bar', async () => {
  const code = await call(`encryptNote('hello reader')`);
  const reader = createPage('secret-note/index.html', '#n=' + code);
  let cleared = false;
  reader.sandbox.history.replaceState = () => { cleared = true; };
  for (let i = 0; i < 200 && reader.run(`document.getElementById('noteText').textContent`) !== 'hello reader'; i++) {
    await new Promise(r => setImmediate(r));
  }
  assert.strictEqual(reader.run(`document.getElementById('noteText').textContent`), 'hello reader');
  assert.ok(cleared, 'the fragment should be removed after reading');
});

test('the write form makes a working link', async () => {
  run(`document.getElementById('text').value = 'from the form'; document.getElementById('pw').value = '';`);
  const link = await call('makeLink()');
  assert.match(link, /#n=1k/);
  assert.strictEqual(await call(`decryptNote(${JSON.stringify(link.split('#n=')[1])})`), 'from the form');
});
