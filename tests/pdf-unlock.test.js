'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createPage } = require('./helpers/browser');

// Fixtures were made with pypdf: user password as listed, owner password "own" ("boss" for restricted).
const DIR = path.join(__dirname, 'fixtures', 'locked');
const CASES = [['rc4-40', '1234', 2], ['rc4-128', 'ASHA0101', 3], ['aes-128', 'ASHA0101', 4], ['aes-256-r5', 'pw', 5], ['aes-256', 'pässwörd', 6]];
const page = () => createPage('pdf-unlock/index.html');
const bytesOf = name => Array.from(fs.readFileSync(path.join(DIR, name + '.pdf')));

for (const [name, pw, rev] of CASES) {
  test(name + ': refuses a wrong password and unlocks with the right one', async () => {
    const p = page();
    p.sandbox.B = bytesOf(name); p.sandbox.PW = pw;
    const o = JSON.parse(await p.run(`(async () => {
      const b = new Uint8Array(B);
      const state = await PdfUnlock.inspect(b);
      let wrong = 'opened';
      try { await PdfUnlock.unlock(b, 'not it'); } catch (e) { wrong = e instanceof PdfUnlock.PasswordError ? 'refused' : e.message; }
      const r = await PdfUnlock.unlock(b, PW);
      const text = new TextDecoder('latin1').decode(r.bytes);
      return JSON.stringify({ state, wrong, revision: r.revision, pages: r.pages, after: await PdfUnlock.inspect(r.bytes), encrypt: /\\/Encrypt\\b/.test(text), header: text.slice(0, 5) });
    })()`));
    assert.strictEqual(o.state, 'password');
    assert.strictEqual(o.wrong, 'refused');
    assert.ok(o.revision >= rev - 1 && o.revision <= rev, 'revision ' + o.revision);
    assert.ok(o.pages >= 1);
    assert.strictEqual(o.after, 'none');
    assert.strictEqual(o.encrypt, false);
    assert.strictEqual(o.header, '%PDF-');
  });
}

test('the owner password also unlocks, and a restrictions-only file opens with no password', async () => {
  const p = page();
  p.sandbox.A = bytesOf('aes-128'); p.sandbox.R = bytesOf('restricted');
  const o = JSON.parse(await p.run(`(async () => {
    const a = await PdfUnlock.unlock(new Uint8Array(A), 'own');
    const r = new Uint8Array(R);
    const state = await PdfUnlock.inspect(r), out = await PdfUnlock.unlock(r, '');
    return JSON.stringify({ owner: await PdfUnlock.inspect(a.bytes), state, restricted: out.restricted, after: await PdfUnlock.inspect(out.bytes) });
  })()`));
  assert.deepStrictEqual(o, { owner: 'none', state: 'restrictions', restricted: true, after: 'none' });
});

test('md5 and rc4 match known answers', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify({
    md5: Array.from(PdfUnlock.md5(new TextEncoder().encode('abc')), b => b.toString(16).padStart(2, '0')).join(''),
    rc4: Array.from(PdfUnlock.rc4(new TextEncoder().encode('Key'), new TextEncoder().encode('Plaintext')), b => b.toString(16).padStart(2, '0')).join(''),
  })`));
  assert.strictEqual(o.md5, '900150983cd24fb0d6963f7d28e17f72');
  assert.strictEqual(o.rc4, 'bbf316e8d940af0ad3');
});
