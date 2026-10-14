'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createPage, ROOT } = require('./helpers/browser');

const fixture = name => new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', name)));
const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

async function pageWith(...files) {
  const page = createPage('pdf-toolkit/index.html');
  for (const [i, [name, bytes]] of files.entries()) {
    page.sandbox['in' + i] = bytes;
    await page.run(`addFile(in${i}, ${JSON.stringify(name)})`);
  }
  return page;
}

// Re-reads output bytes with the page's own parser and lists what each page looks like.
async function inspect(page, bytes) {
  page.sandbox.out = bytes;
  await page.run(`openPdf(out, 'out.pdf').then(d => { globalThis.outDoc = d; })`);
  return json(page, `outDoc.pages.map((p, k) => ({ size: [outDoc.pageInfo(k).w, outDoc.pageInfo(k).h].map(Math.round), rot: outDoc.pageInfo(k).rot,
    annots: (outDoc.get(p.dict.get('Annots')) || []).map(a => nm(outDoc.get(a).get('Subtype'))) }))`);
}

// A small PDF in the newer layout: objects packed in an object stream, a compressed
// cross-reference stream with a PNG predictor, and an incremental update on top.
function objectStreamPdf() {
  const parts = [], offsets = {};
  let size = 0;
  const put = s => { const b = Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1'); parts.push(b); size += b.length; };
  put('%PDF-1.5\n%\xe2\xe3\xcf\xd3\n');
  const content = Buffer.from('BT /F1 24 Tf 72 700 Td (Packed page) Tj ET');
  offsets[4] = size;
  put(`4 0 obj\n<</Length ${content.length}>>\nstream\n`); put(content); put('\nendstream\nendobj\n');
  const packed = {
    1: '<</Type/Catalog/Pages 2 0 R>>',
    2: '<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>>>',
    3: '<</Type/Page/Parent 2 0 R/Contents 4 0 R>>',
    5: '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    6: '<</Type/Page/Parent 2 0 R/Contents 4 0 R/Rotate 90>>',
  };
  let head = '', body = '';
  for (const [n, v] of Object.entries(packed)) { head += `${n} ${body.length} `; body += v + '\n'; }
  const objstm = zlib.deflateSync(Buffer.from(head + body));
  offsets[7] = size;
  put(`7 0 obj\n<</Type/ObjStm/N 5/First ${head.length}/Filter/FlateDecode/Length ${objstm.length}>>\nstream\n`); put(objstm); put('\nendstream\nendobj\n');

  const xrefStream = (num, entries, extra) => {
    const rows = [];
    let prev = Buffer.alloc(4);
    for (const [type, a, b] of entries) {
      const row = Buffer.from([type, (a >> 8) & 255, a & 255, b]);
      const up = Buffer.alloc(5);
      up[0] = 2;
      for (let k = 0; k < 4; k++) up[k + 1] = (row[k] - prev[k]) & 255;
      rows.push(up);
      prev = row;
    }
    const data = zlib.deflateSync(Buffer.concat(rows));
    const at = size;
    put(`${num} 0 obj\n<</Type/XRef/W[1 2 1]${extra}/Filter/FlateDecode/DecodeParms<</Predictor 12/Columns 4>>/Length ${data.length}>>\nstream\n`);
    put(data); put('\nendstream\nendobj\n');
    return at;
  };
  offsets[8] = size;
  const first = xrefStream(8, [[0, 0, 0], [2, 7, 0], [2, 7, 1], [2, 7, 2], [1, offsets[4], 0], [2, 7, 3], [2, 7, 4], [1, offsets[7], 0], [1, offsets[8], 0]], '/Size 9/Root 1 0 R');
  put(`startxref\n${first}\n%%EOF\n`);

  // the update replaces object 6: the second page becomes landscape and loses its rotation
  const at6 = size;
  put('6 0 obj\n<</Type/Page/Parent 2 0 R/Contents 4 0 R/MediaBox[0 0 792 612]>>\nendobj\n');
  const second = size;
  xrefStream(9, [[1, at6, 0], [1, second, 0]], `/Index[6 1 9 1]/Size 10/Root 1 0 R/Prev ${first}`);
  put(`startxref\n${second}\n%%EOF\n`);
  return new Uint8Array(Buffer.concat(parts));
}

test('Chrome-made PDFs load with the right page sizes and orientation', async () => {
  const page = await pageWith(['a4.pdf', fixture('pdf-a4.pdf')], ['letter.pdf', fixture('pdf-letter.pdf')]);
  assert.strictEqual(page.run('pages.length'), 5);
  const info = json(page, 'pages.map(p => { const s = pageShape(p); return [sizeLabel(s.info.w, s.info.h), s.w > s.h ? "landscape" : "portrait"]; })');
  assert.deepStrictEqual(info, [['A4', 'portrait'], ['A4', 'landscape'], ['A4', 'portrait'], ['Letter', 'portrait'], ['Letter', 'portrait']]);
  assert.strictEqual(page.run('files.some(f => f.doc.repaired)'), false);
});

test('merging keeps order, rotation, and outside links, and drops links to other pages', async () => {
  const page = await pageWith(['a4.pdf', fixture('pdf-a4.pdf')], ['letter.pdf', fixture('pdf-letter.pdf')]);
  page.run('move(pages[4].id, 0); rotate(pages[1]); rotate(pages[1]); remove(pages[3].id)');
  const bytes = page.run('buildPdf(itemsOf(pages))');
  const out = await inspect(page, bytes);
  assert.deepStrictEqual(out.map(p => p.size), [[612, 792], [595, 842], [842, 595], [612, 792]]);
  assert.deepStrictEqual(out.map(p => p.rot), [0, 180, 0, 0]);
  assert.deepStrictEqual(out[2].annots, ['Link'], 'the outside web link on the landscape page stays');
  assert.deepStrictEqual(out[0].annots, [], 'the letter link to another page is dropped');
  const text = Buffer.from(bytes).toString('latin1');
  assert.strictEqual((text.match(/\/Type\s*\/Page\b/g) || []).length, 4, 'no pages beyond the ones asked for');
});

test('pages from one file share their fonts in the output instead of copying them per page', async () => {
  const page = await pageWith(['a4.pdf', fixture('pdf-a4.pdf')]);
  const one = page.run('buildPdf(itemsOf([pages[0]]))').length;
  const all = page.run('buildPdf(itemsOf(pages))').length;
  assert.ok(all < one * 2, `three pages took ${all} bytes against ${one} for one`);
  assert.ok(all <= fixture('pdf-a4.pdf').length * 1.15);
});

test('object streams, xref streams with a predictor, and incremental updates are read', async () => {
  const page = await pageWith(['packed.pdf', objectStreamPdf()]);
  assert.strictEqual(page.run('pages.length'), 2);
  assert.strictEqual(page.run('files[0].doc.repaired'), undefined);
  assert.deepStrictEqual(json(page, '[0, 1].map(k => files[0].doc.pageInfo(k))'), [{ w: 612, h: 792, rot: 0 }, { w: 792, h: 612, rot: 0 }],
    'the updated second page wins over the packed one');
  const out = await inspect(page, page.run('buildPdf(itemsOf(pages))'));
  assert.deepStrictEqual(out.map(p => p.size), [[612, 792], [792, 612]]);
  const text = Buffer.from(page.run('buildPdf(itemsOf([pages[0]]))')).toString('latin1');
  assert.match(text, /\/BaseFont\s*\/Helvetica/, 'inherited resources are written onto the page');
  assert.match(text, /Packed page/);
});

test('a file with a broken cross-reference table is rebuilt by scanning', async () => {
  const bytes = fixture('pdf-letter.pdf');
  const text = Buffer.from(bytes).toString('latin1');
  const at = text.lastIndexOf('startxref') + 10;
  bytes.set(Buffer.from('99999'), at);
  const page = await pageWith(['broken.pdf', bytes]);
  assert.strictEqual(page.run('files[0].doc.repaired'), true);
  assert.strictEqual(page.run('pages.length'), 2);
  const out = await inspect(page, page.run('buildPdf(itemsOf(pages))'));
  assert.strictEqual(out.length, 2);
});

test('encrypted files and non-PDFs are refused with a clear message', async () => {
  const page = createPage('pdf-toolkit/index.html');
  const enc = '%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[]/Count 0>>\nendobj\n3 0 obj\n<</Filter/Standard/V 2/R 3>>\nendobj\n' +
    'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000054 00000 n \n0000000101 00000 n \ntrailer\n<</Size 4/Root 1 0 R/Encrypt 3 0 R>>\nstartxref\n145\n%%EOF\n';
  page.sandbox.enc = new Uint8Array(Buffer.from(enc, 'latin1'));
  page.sandbox.junk = new Uint8Array(Buffer.from('hello, not a pdf'));
  await assert.rejects(page.run(`openPdf(enc, 'secret.pdf')`), /password-protected or encrypted/);
  await assert.rejects(page.run(`openPdf(junk, 'notes.txt')`), /is not a PDF/);
});

test('the lexer handles strings, names, and nesting', () => {
  const page = createPage('pdf-toolkit/index.html');
  const v = json(page, `(() => {
    const L = new Lexer(ascii('<</A (a\\\\(b\\\\)\\\\n\\\\101 (nested)) /B#20C <48 49 5> /D [1 -2.5 .5 3 0 R true null] /E<<>> >>'));
    const d = L.obj();
    return { a: Array.from(d.get('A').b), names: [...d.m.keys()], hex: Array.from(d.get('B C').b), arr: d.get('D').map(x => x instanceof Ref ? 'R' + x.num : x) };
  })()`);
  assert.deepStrictEqual(v.names, ['A', 'B C', 'D', 'E']);
  assert.strictEqual(Buffer.from(v.a).toString('latin1'), 'a(b)\nA (nested)');
  assert.deepStrictEqual(v.hex, [0x48, 0x49, 0x50]);
  assert.deepStrictEqual(v.arr, [1, -2.5, 0.5, 'R3', true, null]);
  assert.strictEqual(page.run(`ser(N('A B#'))`), '/A#20B#23');
});

test('splitting makes a valid ZIP with one PDF per page', async () => {
  const page = await pageWith(['a4.pdf', fixture('pdf-a4.pdf')]);
  const zipBytes = Buffer.from(await page.run('splitZip().arrayBuffer()'));
  const names = [];
  let p = 0;
  while (zipBytes.readUInt32LE(p) === 0x04034b50) {
    const size = zipBytes.readUInt32LE(p + 18), nlen = zipBytes.readUInt16LE(p + 26);
    names.push(zipBytes.slice(p + 30, p + 30 + nlen).toString());
    const data = new Uint8Array(zipBytes.slice(p + 30 + nlen, p + 30 + nlen + size));
    assert.strictEqual((await inspect(page, data)).length, 1);
    p += 30 + nlen + size;
  }
  assert.deepStrictEqual(names, ['a4-page-01.pdf', 'a4-page-02.pdf', 'a4-page-03.pdf']);
});
