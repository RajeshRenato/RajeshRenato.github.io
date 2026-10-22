'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

test('every size is sensible, and the guides sit inside the photo', () => {
  const page = createPage('passport-photo/index.html');
  const rows = json(page, `PRESETS.filter(p => p.head).map(p => { P = p; const g = guides(), [W, H] = outSize(); return { id: p.id, ok: p.head[0] < p.head[1] && p.head[1] < p.h && g.top > 0 && g.chin < H && g.top < g.chin, W, H, mm: [p.w, p.h] }; })`);
  for (const r of rows) assert.ok(r.ok, r.id);
  const india = rows.find(r => r.id === 'in-passport');
  assert.deepStrictEqual([india.W, india.H], [600, 600], '2×2 inches at 300 DPI');
  const uk = rows.find(r => r.id === 'uk');
  assert.deepStrictEqual([uk.W, uk.H], [413, 531]);
});

test('print sheets: six 2×2 photos on a 4×6 print, more on A4, all on the paper', () => {
  const page = createPage('passport-photo/index.html');
  const fits = json(page, `['in-passport', 'uk', 'in-pan', 'ca'].map(id => { P = PRESETS.find(p => p.id === id); return ['4x6', 'a4', 'letter'].map(k => { const L = sheetLayout(k); return { n: L.n, inside: L.x0 >= -1e-6 && L.y0 >= -1e-6 && L.x0 + L.cols * P.w + (L.cols - 1) * L.gap <= L.W + 1e-6 && L.y0 + L.rows * P.h + (L.rows - 1) * L.gap <= L.H + 1e-6, edge: L.gap === 0 }; }); })`);
  assert.deepStrictEqual(fits[0].map(f => f.n), [6, 15, 15]);
  assert.deepStrictEqual(fits[1].map(f => f.n), [8, 30, 28]);
  assert.ok(fits.flat().every(f => f.inside), 'every copy is on the paper');
  assert.ok(fits.flat().filter(f => f.edge).length > 0 && fits.every(r => !r[1].edge && !r[2].edge), 'edge to edge only on photo-lab prints');
});

test('the sheet PDF writer places one copy of the photo many times', () => {
  const page = createPage('passport-photo/index.html');
  const r = json(page, `(() => { const pg = PdfLite.page(...PdfLite.A4), jpg = { bytes: new Uint8Array(1000), w: 600, h: 600 }; for (let i = 0; i < 15; i++) pg.image(jpg, i * 10, 0, 144, 144); const out = PdfLite.build([pg]); return { images: pg.images.length, size: out.length }; })()`);
  assert.strictEqual(r.images, 1);
  assert.ok(r.size < 3000, 'the photo is stored once: ' + r.size);
});
