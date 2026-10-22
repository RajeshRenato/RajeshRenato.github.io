'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createPage, ROOT } = require('./helpers/browser');

const fixture = name => new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', name)));
const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

// Opens a fixture as the document being signed, with screen space laid out the way
// pdf.js does it for an unrotated page: y down from the top of the media box.
async function opened(name) {
  const page = createPage('pdf-sign/index.html');
  page.sandbox.input = fixture(name);
  await page.run(`openPdf(input, 'in.pdf').then(d => {
    doc = d;
    pages = d.pages.map((p, k) => { const i = d.pageInfo(k); return { k, vp: { width: i.w, height: i.h, transform: [1, 0, 0, -1, 0, i.h] } }; });
  })`);
  return page;
}

// Saves, reads the result back, and returns what the stamped page looks like.
async function saved(page) {
  page.run(`globalThis.fakePixels = async () => ({ w: 2, h: 1, rgba: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]) })`);
  await page.run(`exportPdf(fakePixels).then(b => openPdf(b, 'out.pdf')).then(d => { globalThis.out = d; })`);
  return page;
}

const latin1 = b => Buffer.from(b).toString('latin1');

test('text, a checkmark, and a signature are drawn on top of the page', async () => {
  const page = await opened('pdf-a4.pdf');
  const pagesBefore = page.run('doc.pages.length');
  page.run(`
    items.push({ page: 0, type: 'text', x: 72, y: 100, w: 100, h: 34, size: 14, color: '#1d3fbf', text: 'Jane (Doe) \\\\ café\\nline two' });
    items.push({ page: 0, type: 'check', x: 300, y: 300, w: 16, h: 16, color: '#111111' });
    items.push({ page: 0, type: 'image', x: 72, y: 600, w: 150, h: 50, img: { url: 'x' } });
  `);
  await saved(page);
  assert.strictEqual(page.run('out.pages.length'), pagesBefore);
  const contents = json(page, `(() => { const c = out.get(out.pages[0].dict.get('Contents')); return c.map(r => Array.from(out.get(r).data)); })()`);
  assert.ok(contents.length >= 3, 'wrapped: q, the original content, then ours');
  assert.strictEqual(latin1(contents[0]), 'q\n');
  const ours = latin1(contents[contents.length - 1]);
  assert.match(ours, /^Q\nq 1 0 0 -1 0 [\d.]+ cm\n/, 'starts back at the page coordinate system');
  assert.match(ours, /\/PSF0 14 Tf 0\.1137 0\.2471 0\.749 rg/);
  assert.ok(ours.includes('(Jane \\(Doe\\) \\\\ caf\xe9) Tj'), 'brackets and backslashes are escaped, Latin-1 kept');
  assert.ok(ours.includes('(line two) Tj'));
  assert.match(ours, /RG [\d.]+ w 1 J 1 j\n[\d. ]+ m [\d. ]+ l [\d. ]+ l S/, 'a stroked checkmark');
  assert.match(ours, /q 150 0 0 -50 72 650 cm \/PSI0 Do Q/);

  const res = `out.get(out.pages[0].dict.get('Resources'))`;
  assert.strictEqual(page.run(`nm(out.get(out.get(${res}.get('Font')).get('PSF0')).get('BaseFont'))`), 'Helvetica');
  assert.ok(page.run(`out.get(${res}.get('Font')).m.size`) > 1, "the page's own fonts are still there");
  const img = `out.get(out.get(${res}.get('XObject')).get('PSI0'))`;
  assert.deepStrictEqual(json(page, `[${img}.dict.get('Width'), ${img}.dict.get('Height'), nm(${img}.dict.get('ColorSpace'))]`), [2, 1, 'DeviceRGB']);
  assert.strictEqual(page.run(`nm(out.get(${img}.dict.get('SMask')).dict.get('ColorSpace'))`), 'DeviceGray', 'transparency kept as a soft mask');
});

test('pages without anything on them come out unchanged', async () => {
  const page = await opened('pdf-letter.pdf');
  page.run(`items.push({ page: 1, type: 'cross', x: 10, y: 10, w: 16, h: 16, color: '#111111' })`);
  const before = json(page, `(() => { const c = doc.get(doc.pages[0].dict.get('Contents')); return [].concat(c).map(x => (doc.get(x) || x).data.length); })()`);
  await saved(page);
  const after = json(page, `(() => { const c = out.get(out.pages[0].dict.get('Contents')); return [].concat(c).map(x => (out.get(x) || x).data.length); })()`);
  assert.deepStrictEqual(after, before);
  assert.strictEqual(page.run(`out.get(out.pages[1].dict.get('Contents')).length`) >= 3, true);
});

test('text Helvetica cannot spell goes in as an image instead', async () => {
  const page = await opened('pdf-a4.pdf');
  page.run(`items.push({ page: 0, type: 'text', x: 72, y: 100, w: 80, h: 17, size: 14, color: '#111111', text: 'नमस्ते 你好' })`);
  await saved(page);
  const ours = latin1(json(page, `(() => { const c = out.get(out.pages[0].dict.get('Contents')); return Array.from(out.get(c[c.length - 1]).data); })()`));
  assert.ok(!ours.includes('Tj'));
  assert.match(ours, /\/PSI0 Do/);
});

test('the screen-to-PDF transform undoes pdf.js viewports, rotated ones too', () => {
  const page = createPage('pdf-sign/index.html');
  const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  // pdf.js viewport transforms for a 612x792 page at rotation 0 and 90
  for (const t of [[1, 0, 0, -1, 0, 792], [0, 1, 1, 0, 0, 0]]) {
    const inv = json(page, `invert(${JSON.stringify(t)})`);
    for (const p of [[0, 0], [100, 250], [612, 792]]) {
      const back = apply(inv, apply(t, p));
      assert.ok(Math.abs(back[0] - p[0]) < 1e-9 && Math.abs(back[1] - p[1]) < 1e-9);
    }
  }
});

test('saved signatures: only PNG data URLs come back from storage', () => {
  const page = createPage('pdf-sign/index.html');
  page.run(`localStorage.setItem(SIG_KEY, JSON.stringify([{ url: 'javascript:alert(1)' }, { url: 'data:image/png;base64,AAAA', w: 1, h: 1 }, null, 7]))`);
  assert.deepStrictEqual(json(page, 'savedSigs().map(s => s.url)'), ['data:image/png;base64,AAAA']);
  page.run(`localStorage.setItem(SIG_KEY, '{not json')`);
  assert.deepStrictEqual(json(page, 'savedSigs()'), []);
});
