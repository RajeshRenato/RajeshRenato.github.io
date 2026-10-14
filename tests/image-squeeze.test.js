'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const { run, sandbox } = createPage('image-squeeze/index.html');
const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));

test('resizing keeps the aspect ratio and never enlarges', () => {
  assert.deepStrictEqual(json('fitSize(4000, 3000, 1600, 0)'), { w: 1600, h: 1200 });
  assert.deepStrictEqual(json('fitSize(4000, 3000, 1600, 900)'), { w: 1200, h: 900 });
  assert.deepStrictEqual(json('fitSize(800, 600, 1600, 1200)'), { w: 800, h: 600 });
  assert.deepStrictEqual(json('fitSize(3000, 4000, 0, 1000)'), { w: 750, h: 1000 });
});

test('output type and file name follow the chosen format', () => {
  assert.strictEqual(run(`outputType('image/png', 'same')`), 'image/png');
  assert.strictEqual(run(`outputType('image/gif', 'same')`), 'image/png', 'formats canvas cannot write fall back to PNG');
  assert.strictEqual(run(`outputType('image/png', 'image/webp')`), 'image/webp');
  assert.strictEqual(run(`outputName('IMG_2041.HEIC.png', 'image/jpeg')`), 'IMG_2041.HEIC.jpg');
  assert.strictEqual(run(`outputName('scan', 'image/webp')`), 'scan.webp');
});

// a fake encoder: size grows with quality and with pixel count, like a real one
sandbox.fakeEncode = (quality, scale) => Promise.resolve({ size: Math.round(400000 * scale * scale * (0.15 + quality * quality)) });

test('fit-under finds the highest quality that fits', async () => {
  const r = await run('fitUnder(200 * 1024, fakeEncode, 0.9, true)');
  assert.ok(r.blob.size <= 200 * 1024, 'must fit: ' + r.blob.size);
  assert.strictEqual(r.scale, 1, 'should not need to shrink');
  assert.ok(r.quality > 0.55, 'should keep quality as high as possible: ' + r.quality);
  const tooHigh = await run(`fakeEncode(${r.quality} + 0.05, 1)`);
  assert.ok(tooHigh.size > 200 * 1024, 'a noticeably higher quality should not fit');
});

test('fit-under shrinks the image when even low quality is too big', async () => {
  const r = await run('fitUnder(30 * 1024, fakeEncode, 0.9, true)');
  assert.ok(r.blob.size <= 30 * 1024, 'must fit: ' + r.blob.size);
  assert.ok(r.scale < 1);
  const png = await run('fitUnder(50 * 1024, (q, s) => fakeEncode(1, s), 1, false)');
  assert.ok(png.blob.size <= 50 * 1024 && png.scale < 1, 'lossless formats fit by shrinking');
});

test('zip and crc32 are correct', () => {
  assert.strictEqual(run('crc32(new TextEncoder().encode("123456789"))'), 0xcbf43926);
  assert.strictEqual(run('crc32(new Uint8Array(0))'), 0);
});
