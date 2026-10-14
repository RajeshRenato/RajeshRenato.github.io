'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createPage, ROOT } = require('./helpers/browser');

const fixture = name => new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', name)));
const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const A4 = { size: 'a4', orient: 'auto', margin: 'small', fit: 'fit' };

function load(...names) {
  const page = createPage('images-to-pdf/index.html');
  names.forEach((n, i) => { page.sandbox['f' + i] = fixture(n); });
  return page;
}

// Checks the xref table points at real objects and returns the PDF as latin1 text.
function checkPdf(bytes) {
  const s = Buffer.from(bytes).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.7\n'));
  const at = +/startxref\n(\d+)\n%%EOF\n$/.exec(s)[1];
  assert.ok(s.startsWith('xref\n', at), 'startxref points at the table');
  const rows = s.slice(at).split('\n');
  const count = +rows[1].split(' ')[1];
  for (let n = 1; n < count; n++) {
    const off = +rows[2 + n].slice(0, 10);
    assert.ok(s.startsWith(n + ' 0 obj\n', off), 'object ' + n + ' is where the table says');
  }
  return s;
}

test('JPEG headers: size, channels, Adobe marker, and EXIF orientation', () => {
  const page = load('img2pdf-photo.jpg', 'img2pdf-rotated.jpg', 'img2pdf-gray.jpg', 'img2pdf-cmyk.jpg', 'img2pdf-mirror.jpg', 'img2pdf-alpha.png');
  assert.deepStrictEqual(json(page, 'jpegInfo(f0)'), { w: 400, h: 300, comps: 3, adobe: false, orientation: 1 });
  assert.deepStrictEqual(json(page, 'jpegInfo(f1)'), { w: 400, h: 300, comps: 3, adobe: false, orientation: 6 });
  assert.strictEqual(page.run('jpegInfo(f2).comps'), 1);
  assert.deepStrictEqual(json(page, '[jpegInfo(f3).comps, jpegInfo(f3).adobe]'), [4, true]);
  assert.strictEqual(page.run('jpegInfo(f4).orientation'), 2);
  assert.strictEqual(page.run('jpegInfo(f5)'), null);
});

test('plain and rotated JPEGs are kept as they are, mirrored ones go through a canvas', async () => {
  const page = load('img2pdf-photo.jpg', 'img2pdf-rotated.jpg', 'img2pdf-mirror.jpg', 'img2pdf-cmyk.jpg');
  page.run(`decodeImage = async () => 'canvas'`);
  assert.strictEqual(await page.run(`prepare(f0, 'image/jpeg').then(i => i.raw && i.data === f0 && i.baseRot)`), 0);
  assert.strictEqual(await page.run(`prepare(f1, 'image/jpeg').then(i => i.raw && i.baseRot)`), 90);
  assert.strictEqual(await page.run(`prepare(f2, 'image/jpeg')`), 'canvas');
  assert.deepStrictEqual(await page.run(`prepare(f3, 'image/jpeg').then(i => i.cs + ' ' + i.decode.join(''))`), 'DeviceCMYK 10101010');
});

test('page layout: size, orientation, margins, fit and fill, and rotation', () => {
  const page = load('img2pdf-photo.jpg', 'img2pdf-rotated.jpg');
  page.run(`globalThis.a = jpegImage(f0); globalThis.b = jpegImage(f1)`);
  const L = (img, rot, o) => json(page, `layout(${img}, ${rot}, ${JSON.stringify(o)})`);

  let l = L('a', 0, A4);
  assert.deepStrictEqual([l.pw, l.ph], [841.89, 595.28], 'a wide photo gets a landscape page');
  assert.ok(Math.abs(l.bw / l.bh - 4 / 3) < 1e-9);
  assert.ok(Math.abs(l.bh - (595.28 - 36)) < 1e-9, 'fits the height inside a small margin');
  l = L('b', 0, A4);
  assert.deepStrictEqual([l.pw, l.ph], [595.28, 841.89], 'a sideways phone photo stands up');
  assert.strictEqual(l.r, 90);
  assert.deepStrictEqual(l.cm.map(Math.round), [0, -Math.round(l.bh), Math.round(l.bw), 0, Math.round(l.x), Math.round(l.y + l.bh)]);
  l = L('a', 90, { ...A4, orient: 'landscape' });
  assert.deepStrictEqual([l.pw, l.ph], [841.89, 595.28], 'forced landscape');
  l = L('a', 0, { ...A4, size: 'letter', orient: 'portrait', fit: 'fill', margin: 'none' });
  assert.deepStrictEqual([l.pw, l.ph], [612, 792]);
  assert.ok(Math.abs(l.bh - 792) < 1e-9 && l.bw > 612, 'fill covers the page');
  l = L('a', 0, { ...A4, size: 'fit', margin: 'large' });
  assert.deepStrictEqual([l.pw, l.ph], [400 * 0.75 + 108, 300 * 0.75 + 108], 'page sized to the image plus margins');
});

test('the PDF embeds JPEG bytes untouched, one page each, with a valid xref', () => {
  const page = load('img2pdf-photo.jpg', 'img2pdf-rotated.jpg', 'img2pdf-gray.jpg', 'img2pdf-cmyk.jpg');
  page.run(`globalThis.out = buildPdf([0, 1, 2, 3].map(i => ({ img: jpegImage(globalThis['f' + i]), rot: i === 2 ? 180 : 0 })), ${JSON.stringify(A4)}, new Date(Date.UTC(2026, 9, 15, 8, 30, 0)))`);
  const out = Buffer.from(page.run('out'));
  const s = checkPdf(out);
  assert.strictEqual((s.match(/\d+ 0 obj\n<< \/Type \/Page \/Parent/g) || []).length, 4, 'pages are plain dictionaries, not streams');
  const kids = /\/Kids \[([^\]]+)\]/.exec(s)[1].match(/\d+(?= 0 R)/g);
  for (const k of kids) assert.ok(s.includes('\n' + k + ' 0 obj\n<< /Type /Page '), 'Kids point at page objects');
  assert.match(s, /\/Count 4/);
  for (const n of ['img2pdf-photo.jpg', 'img2pdf-rotated.jpg', 'img2pdf-gray.jpg', 'img2pdf-cmyk.jpg']) {
    assert.ok(out.includes(Buffer.from(fixture(n))), n + ' is embedded byte for byte');
  }
  assert.match(s, /\/ColorSpace \/DeviceGray/);
  assert.match(s, /\/ColorSpace \/DeviceCMYK .*\/Decode \[1 0 1 0 1 0 1 0\]/);
  assert.match(s, /\/CreationDate \(D:20261015083000\+00'00'\)/);
  assert.ok(s.includes("/Producer (Images to PDF, Rajesh's Playground)"));
  assert.ok(Math.abs(page.run('estimate(out.length ? [0, 1, 2, 3].map(i => ({ img: jpegImage(globalThis["f" + i]) })) : [])') - out.length) < 2500, 'the size estimate is close');
});

test('see-through images are stored losslessly with an alpha mask', async () => {
  const page = createPage('images-to-pdf/index.html');
  await page.run(`(async () => {
    const w = 3, h = 2, px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) px.set([i * 40, 200, 255 - i * 30, i === 0 ? 0 : 255], i * 4);
    globalThis.img = await rgbaImage(px, w, h);
    globalThis.solid = await rgbaImage(new Uint8ClampedArray(16).fill(255), 2, 2);
    globalThis.out = buildPdf([{ img, rot: 0 }], { size: 'fit', orient: 'auto', margin: 'none', fit: 'fit' });
  })()`);
  const rgb = zlib.inflateSync(Buffer.from(page.run('img.data')));
  assert.deepStrictEqual([...rgb.slice(0, 6)], [0, 200, 255, 40, 200, 225]);
  assert.deepStrictEqual([...zlib.inflateSync(Buffer.from(page.run('img.smask.data')))], [0, 255, 255, 255, 255, 255]);
  assert.strictEqual(page.run('solid.smask'), null, 'no mask when nothing is see-through');
  const s = checkPdf(page.run('out'));
  assert.match(s, /\/Filter \/FlateDecode \/SMask \d+ 0 R/);
  assert.match(s, /\/ColorSpace \/DeviceGray \/BitsPerComponent 8 \/Filter \/FlateDecode/);
});

test('the page list reorders and rotates', () => {
  const page = createPage('images-to-pdf/index.html');
  page.run(`items = [1, 2, 3].map(id => ({ id, name: id + '.jpg', img: { w: 10, h: 10, baseRot: 0, data: new Uint8Array(5) }, rot: 0, url: '' })); move(1, 2);`);
  assert.deepStrictEqual(json(page, 'items.map(i => i.id)'), [2, 3, 1]);
  page.run('move(1, -1); move(3, 0)');
  assert.deepStrictEqual(json(page, 'items.map(i => i.id)'), [3, 2, 1]);
  assert.strictEqual(page.run(`baseName('Holiday photo.JPEG')`), 'Holiday photo');
});
