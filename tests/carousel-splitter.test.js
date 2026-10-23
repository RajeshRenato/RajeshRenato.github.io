'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => createPage('carousel-splitter/index.html');

test('slide sizes for each shape, and a sensible number of slides for the photo', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify({
    sizes: SHAPES.map(s => slideSize(s)),
    counts: [[6000, 2000, 0], [6000, 2000, 1], [4000, 3000, 0], [20000, 1000, 0]].map(([w, h, s]) => suggestCount(w, h, SHAPES[s])),
  })`));
  assert.deepStrictEqual(o.sizes, [[1080, 1080], [1080, 1350], [1080, 565]]);
  assert.deepStrictEqual(o.counts, [3, 4, 2, 10]);
});

test('the photo can be moved but never pulled off the strip', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify([
    clampPan({ x: 50, y: 50 }, 1, 4000, 1200, 3240, 1080),
    clampPan({ x: -5000, y: -500 }, 1, 4000, 1200, 3240, 1080),
    clampPan({ x: 99, y: -99 }, 0.5, 4000, 1200, 3240, 1080),
  ])`));
  assert.deepStrictEqual(o, [{ x: 0, y: 0 }, { x: -760, y: -120 }, { x: 99, y: 0 }]);
});

test('cover fills the whole strip, contain fits the whole photo', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify([coverScale(4000, 1000, 3240, 1080), containScale(4000, 1000, 3240, 1080)])`));
  assert.deepStrictEqual(o, [1.08, 0.81]);
});
