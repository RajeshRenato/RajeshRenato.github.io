'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { createPage } = require('./helpers/browser');

// common/zip.js is shared by Chat Wrapped, Instagram Unfollowers, Bank Statement Insights, Carousel Splitter and Speed Reader.
const page = () => createPage('carousel-splitter/index.html');

test('a built zip reads back, with names, sizes and CRCs intact', async () => {
  const p = page();
  const o = JSON.parse(await p.run(`(async () => {
    const enc = new TextEncoder(), big = new Uint8Array(70000).map((_, i) => i * 7);
    const blob = Zip.build([{ name: 'a.txt', data: enc.encode('hello zip') }, { name: 'folder/ünïcode.bin', data: big }]);
    const z = await Zip.open(blob);
    const back = new Uint8Array(await z.read(z.entries[1]));
    return JSON.stringify({ names: z.entries.map(e => e.name), text: await z.text(z.entries[0]), same: back.length === big.length && back.every((b, i) => b === big[i]), crc: (Zip.crc32(enc.encode('123456789')) >>> 0).toString(16) });
  })()`));
  assert.deepStrictEqual(o.names, ['a.txt', 'folder/ünïcode.bin']);
  assert.strictEqual(o.text, 'hello zip');
  assert.strictEqual(o.same, true);
  assert.strictEqual(o.crc, 'cbf43926');
});

test('Python can read the zip it builds', async (t) => {
  try { execFileSync('python3', ['--version']); } catch (e) { t.skip('no python3'); return; }
  const p = page();
  const b64 = await p.run(`(async () => { const b = Zip.build([{ name: 'slide-01.jpg', data: new Uint8Array([1, 2, 3]) }, { name: 'slide-02.jpg', data: new Uint8Array([4, 5]) }]); return btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer()))); })()`);
  const f = path.join(os.tmpdir(), 'pg-zip-test.zip');
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  const out = execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip(), [(i.filename, i.file_size) for i in z.infolist()])', f]).toString().trim();
  fs.unlinkSync(f);
  assert.strictEqual(out, "None [('slide-01.jpg', 3), ('slide-02.jpg', 2)]");
});
