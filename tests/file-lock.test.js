'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');
const { File } = require('buffer');

function page() { const p = createPage('file-lock/index.html'); p.sandbox.File = File; return p; }
const run = (p, code) => p.run(`(async () => { ${code} })()`);

test('a file locks and unlocks byte for byte, across several pieces', async () => {
  const p = page();
  const r = await run(p, `
    const data = new Uint8Array(9 * 1024 * 1024 + 321); for (let i = 0; i < data.length; i++) data[i] = (i * 31 + (i >> 9)) & 255;
    const L = await lockFile(new File([data], 'scan.pdf', { type: 'application/pdf' }), 'a long passphrase');
    const U = await unlockFile(new File([L.blob], L.name), 'a long passphrase');
    const back = new Uint8Array(await U.blob.arrayBuffer());
    let same = back.length === data.length; for (let i = 0; same && i < data.length; i++) same = back[i] === data[i];
    return JSON.stringify({ name: L.name, out: U.name, type: U.type, same, overhead: L.blob.size - data.length });`);
  const o = JSON.parse(r);
  assert.strictEqual(o.same, true);
  assert.strictEqual(o.name, 'scan.pdf.locked');
  assert.strictEqual(o.out, 'scan.pdf');
  assert.strictEqual(o.type, 'application/pdf');
  assert.ok(o.overhead < 400, 'little overhead: ' + o.overhead);
});

test('a wrong password, a damaged file, a cut-short file and reordered pieces are all caught', async () => {
  const p = page();
  const r = await run(p, `
    const data = new Uint8Array(5 * 1024 * 1024).fill(9);
    const L = await lockFile(new File([data], 'x.bin'), 'right password');
    const buf = new Uint8Array(await L.blob.arrayBuffer());
    const tryIt = async (bytes, pw = 'right password') => { try { await unlockFile(new File([bytes], 'x.locked'), pw); return 'opened'; } catch (e) { return e.kind; } };
    const flipped = buf.slice(); flipped[buf.length - 30] ^= 1;
    // the records: header, then [len, ct] repeated; swap the two data pieces
    const dv = new DataView(buf.buffer), HEADLEN = 45;
    const recs = []; let pos = HEADLEN; while (pos < buf.length) { const len = dv.getUint32(pos); recs.push(buf.slice(pos, pos + 4 + len)); pos += 4 + len; }
    const swapped = new Uint8Array(buf.length); swapped.set(buf.slice(0, HEADLEN)); let o = HEADLEN; for (const r of [recs[0], recs[2], recs[1]]) { swapped.set(r, o); o += r.length; }
    const lastGone = buf.slice(0, buf.length - recs[2].length);
    return JSON.stringify([await tryIt(buf, 'wrong password'), await tryIt(flipped), await tryIt(buf.slice(0, buf.length - 100)), await tryIt(swapped), await tryIt(lastGone), await tryIt(new TextEncoder().encode('not a locked file at all'))]);`);
  assert.deepStrictEqual(JSON.parse(r), ['password', 'damaged', 'damaged', 'damaged', 'damaged', 'format']);
});

test('names can be hidden, empty files work, and passwords are rated sensibly', async () => {
  const p = page();
  const r = JSON.parse(await run(p, `
    const L = await lockFile(new File(['secret'], 'bank-statement.pdf'), 'pw', { hideName: true });
    const U = await unlockFile(new File([L.blob], L.name), 'pw');
    const E = await unlockFile(new File([(await lockFile(new File([], 'empty.txt'), 'pw')).blob], 'e.locked'), 'pw');
    return JSON.stringify({ hidden: L.name, restored: U.name, empty: E.blob.size, emptyName: E.name });`));
  assert.ok(/^locked-[0-9a-f]{8}\.locked$/.test(r.hidden), r.hidden);
  assert.strictEqual(r.restored, 'bank-statement.pdf');
  assert.deepStrictEqual([r.empty, r.emptyName], [0, 'empty.txt']);
  const s = JSON.parse(p.run(`JSON.stringify(['password123', 'aaaaaaaaaaaaaaaa', 'Tr0ub4dor&3', suggest()].map(x => Math.round(strength(x).bits)))`));
  assert.ok(s[0] < 40 && s[1] < 40, 'common and repeated passwords are weak: ' + s);
  assert.ok(s[3] >= 100, 'suggested passwords are very strong: ' + s[3]);
  assert.ok(/^([a-zA-Z2-9]{5}-){3}[a-zA-Z2-9]{5}$/.test(p.run('suggest()')));
});

test('the page cannot reach the network', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'file-lock', 'index.html'), 'utf8');
  assert.ok(/connect-src 'none'/.test(html), 'the content security policy blocks every request');
});
