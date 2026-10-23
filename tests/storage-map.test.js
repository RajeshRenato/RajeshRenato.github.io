'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => createPage('storage-map/index.html');

test('folder totals add up, and files get a type', () => {
  const p = page();
  const o = JSON.parse(p.run(`(() => {
    const t = buildTree([{ path: 'Downloads/movie.mkv', size: 4e9 }, { path: 'Downloads/photos/a.jpg', size: 3e6 }, { path: 'Downloads/photos/2024/b.HEIC', size: 2e6 }, { path: 'Downloads/setup.exe', size: 9e7 }, { path: 'Downloads/notes.txt', size: 1200 }, { path: 'Downloads/x.weird', size: 5 }], 'Downloads');
    const ph = t.kids.get('photos');
    return JSON.stringify({ total: t.size, files: t.files, photos: [ph.size, ph.files, ph.kids.get('2024').size], types: t.list.map(f => f.type), path: pathOf(ph.kids.get('2024')) });
  })()`));
  assert.strictEqual(o.total, 4e9 + 3e6 + 2e6 + 9e7 + 1200 + 5);
  assert.strictEqual(o.files, 6);
  assert.deepStrictEqual(o.photos, [5e6, 2, 2e6]);
  assert.deepStrictEqual(o.types, ['Videos', 'Apps and installers', 'Documents', 'Other']);
  assert.strictEqual(o.path, 'Downloads/photos/2024');
});

test('the treemap fills the box exactly, without overlaps, with areas in proportion', () => {
  const p = page();
  const o = JSON.parse(p.run(`(() => {
    const sizes = [500, 300, 120, 80, 80, 40, 20, 10, 5, 1, 0];
    const r = squarify(sizes.map(size => ({ size })), 10, 20, 800, 500);
    let overlap = false;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6) overlap = true; }
    const total = sizes.reduce((a, b) => a + b, 0);
    return JSON.stringify({ n: r.length, area: r.reduce((a, t) => a + t.w * t.h, 0), overlap, inside: r.every(t => t.x >= 10 - 1e-6 && t.y >= 20 - 1e-6 && t.x + t.w <= 810 + 1e-6 && t.y + t.h <= 520 + 1e-6),
      prop: r.every(t => Math.abs(t.w * t.h - t.it.size / total * 400000) < 1e-3), worst: Math.max(...r.slice(0, 5).map(t => Math.max(t.w / t.h, t.h / t.w))) });
  })()`));
  assert.strictEqual(o.n, 10, 'empty items are left out');
  assert.ok(Math.abs(o.area - 400000) < 1e-3);
  assert.strictEqual(o.overlap, false);
  assert.strictEqual(o.inside, true);
  assert.strictEqual(o.prop, true);
  assert.ok(o.worst < 3, 'big blocks stay close to square: ' + o.worst);
});
