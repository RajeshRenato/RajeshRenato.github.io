'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => createPage('duplicate-photos/index.html');

test('difference hash: the same picture brighter or smaller hashes alike, a different one does not', () => {
  const p = page();
  const o = JSON.parse(p.run(`(() => {
    const scene = (f, k = 1, add = 0) => Float32Array.from({ length: 72 }, (_, i) => f(i % 9, Math.floor(i / 9)) * k + add);
    const a = dhashOf(scene((x, y) => Math.sin(x * 0.9) * 50 + y * 12 + 100));
    const brighter = dhashOf(scene((x, y) => Math.sin(x * 0.9) * 50 + y * 12 + 100, 1.2, 30));
    const other = dhashOf(scene((x, y) => Math.cos(x * 1.7 + y) * 60 + 100));
    return JSON.stringify([dist(a, a), dist(a, brighter), dist(a, other), pop(0xffffffff)]);
  })()`));
  assert.strictEqual(o[0], 0);
  assert.strictEqual(o[1], 0);
  assert.ok(o[2] > 12, 'different scenes are far apart: ' + o[2]);
  assert.strictEqual(o[3], 32);
});

test('grouping: exact copies, look-alikes within the strictness, the best one first', () => {
  const p = page();
  const o = JSON.parse(p.run(`(() => {
    const f = (name, size, t = 0) => ({ name, size, lastModified: t });
    const items = [
      { path: 'a.jpg', file: f('a.jpg', 3000000), sha: 'S1', hash: [0xf0f0f0f0, 0x0f0f0f0f], w: 4000, h: 3000 },
      { path: 'copy.jpg', file: f('copy.jpg', 3000000), sha: 'S1', hash: [0xf0f0f0f0, 0x0f0f0f0f], w: 4000, h: 3000 },
      { path: 'wa.jpg', file: f('wa.jpg', 200000), sha: null, hash: [0xf0f0f0f1, 0x0f0f0f0f], w: 1600, h: 1200 },
      { path: 'crop-wide.jpg', file: f('crop-wide.jpg', 900000), sha: null, hash: [0xf0f0f0f0, 0x0f0f0f0e], w: 1600, h: 900 },
      { path: 'other.jpg', file: f('other.jpg', 2500000), sha: null, hash: [0x12345678, 0x9abcdef0], w: 4000, h: 3000 },
    ];
    const g6 = groupPhotos(items, 6), g0 = groupPhotos(items, 0);
    return JSON.stringify({ loose: g6.map(g => [g.exact, g.items.map(x => x.path)]), exactOnly: g0.map(g => [g.exact, g.items.map(x => x.path)]) });
  })()`));
  assert.deepStrictEqual(o.loose, [[false, ['a.jpg', 'copy.jpg', 'wa.jpg']]], 'a different shape is not a look-alike');
  assert.deepStrictEqual(o.exactOnly, [[true, ['a.jpg', 'copy.jpg']]]);
});
