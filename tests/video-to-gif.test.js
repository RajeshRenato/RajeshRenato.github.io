'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const { run, sandbox } = createPage('video-to-gif/index.html');

// an independent GIF decoder, so the encoder is checked against code that didn't write it
function lzwDecode(data, minCodeSize, expected) {
  const clear = 1 << minCodeSize, eoi = clear + 1, out = [];
  let size = minCodeSize + 1, dict = [], pos = 0, prev = null;
  const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = []; size = minCodeSize + 1; prev = null; };
  const read = () => {
    let code = 0;
    for (let i = 0; i < size; i++, pos++) code |= ((data[pos >> 3] >> (pos & 7)) & 1) << i;
    return code;
  };
  reset();
  while (pos + size <= data.length * 8) {
    const code = read();
    if (code === clear) { reset(); continue; }
    if (code === eoi) break;
    let entry;
    if (code < dict.length) entry = dict[code];
    else if (code === dict.length && prev) entry = prev.concat(prev[0]);
    else throw new Error('bad LZW code ' + code);
    out.push(...entry);
    if (prev) dict.push(prev.concat(entry[0]));
    prev = entry;
    if (dict.length === 1 << size && size < 12) size++;
    if (expected && out.length >= expected) break;
  }
  return out;
}

function decodeGif(b) {
  const sig = String.fromCharCode(...b.slice(0, 6));
  assert.strictEqual(sig, 'GIF89a');
  const W = b[6] | (b[7] << 8), H = b[8] | (b[9] << 8), packed = b[10];
  const gctSize = 2 << (packed & 7);
  const gct = [];
  let p = 13;
  for (let i = 0; i < gctSize; i++, p += 3) gct.push([b[p], b[p + 1], b[p + 2]]);
  const canvas = new Array(W * H).fill(null), frames = [];
  let gce = null, loop = null;
  const subBlocks = () => { const out = []; while (b[p]) { const n = b[p++]; out.push(...b.slice(p, p + n)); p += n; } p++; return out; };
  while (p < b.length) {
    const t = b[p++];
    if (t === 0x3b) break;
    if (t === 0x21) {
      const label = b[p++];
      if (label === 0xf9) { gce = { flags: b[p + 1], delay: b[p + 2] | (b[p + 3] << 8), ti: b[p + 4] }; p += 6; }
      else if (label === 0xff) { p += 12; const d = subBlocks(); loop = d[1] | (d[2] << 8); }
      else subBlocks();
    } else if (t === 0x2c) {
      const x0 = b[p] | (b[p + 1] << 8), y0 = b[p + 2] | (b[p + 3] << 8), w = b[p + 4] | (b[p + 5] << 8), h = b[p + 6] | (b[p + 7] << 8);
      p += 9;
      const min = b[p++];
      const idx = lzwDecode(subBlocks(), min, w * h);
      const transparent = gce && (gce.flags & 1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = idx[y * w + x];
        if (transparent && k === gce.ti) continue;
        canvas[(y0 + y) * W + x0 + x] = gct[k];
      }
      frames.push({ delay: gce ? gce.delay : 0, rect: [x0, y0, w, h], pixels: canvas.slice() });
      gce = null;
    } else throw new Error('unexpected block ' + t);
  }
  return { W, H, frames, loop, gctSize };
}

test('LZW output decodes back to the same indices, including dictionary resets', () => {
  let s = 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cases = [Array.from({ length: 30000 }, () => (rnd() * 256) | 0), Array.from({ length: 5000 }, (_, i) => (i >> 4) & 255), [7], [3, 3, 3, 3, 3, 3]];
  for (const indices of cases) {
    sandbox.ix = Uint8Array.from(indices);
    const enc = run('lzwEncode(ix, 8)');
    assert.deepStrictEqual(lzwDecode(enc, 8, indices.length), indices);
  }
});

test('median cut finds the distinct colors of a simple image', () => {
  const px = [];
  for (let i = 0; i < 300; i++) px.push(...[[250, 10, 10], [10, 200, 30], [20, 30, 220]][i % 3]);
  sandbox.px = Uint8Array.from(px);
  const pal = JSON.parse(run('JSON.stringify(medianCut(px, 255))'));
  assert.ok(pal.length <= 255);
  for (const want of [[250, 10, 10], [10, 200, 30], [20, 30, 220]]) assert.ok(pal.some(c => c.every((v, k) => Math.abs(v - want[k]) <= 1)), 'missing ' + want);
});

function frame(W, H, sqX) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    const inSq = x >= sqX && x < sqX + 8 && y >= 10 && y < 18;
    data[o] = inSq ? 230 : x * 4; data[o + 1] = inSq ? 20 : y * 6; data[o + 2] = inSq ? 30 : 120; data[o + 3] = 255;
  }
  return { width: W, height: H, data };
}

test('an animation decodes with the right frames, timing, and positions', () => {
  sandbox.frames = [frame(48, 32, 2), frame(48, 32, 12), frame(48, 32, 12), frame(48, 32, 24), frame(48, 32, 36)];
  const gif = decodeGif(run('encodeGif(frames, { delays: [10, 10, 10, 10, 10], loop: true })'));
  assert.strictEqual(gif.W, 48);
  assert.strictEqual(gif.H, 32);
  assert.strictEqual(gif.loop, 0, 'loops forever');
  assert.strictEqual(gif.frames.length, 4, 'the unchanged third frame is merged');
  assert.deepStrictEqual(gif.frames.map(f => f.delay), [10, 20, 10, 10]);
  assert.ok(gif.frames[1].rect[2] < 48, 'later frames are cropped to what changed');
  gif.frames.forEach((f, n) => {
    const sqX = [2, 12, 24, 36][n];
    const px = f.pixels[14 * 48 + sqX + 4];
    assert.ok(px && px[0] > 200 && px[1] < 60, `frame ${n}: square should be at x=${sqX}, got ${px}`);
    const bg = f.pixels[2 * 48 + 46];
    assert.ok(bg && Math.abs(bg[0] - 184) < 24 && Math.abs(bg[1] - 12) < 24, `frame ${n}: background color off, got ${bg}`);
  });
  const once = decodeGif(run('encodeGif(frames, { delays: [10, 10, 10, 10, 10], loop: false })'));
  assert.strictEqual(once.loop, null, 'no loop block when looping is off');
});

test('dithering still produces a valid image', () => {
  sandbox.frames = [frame(40, 24, 4)];
  const gif = decodeGif(run('encodeGif(frames, { dither: true })'));
  assert.strictEqual(gif.frames.length, 1);
  assert.ok(gif.frames[0].pixels.every(Boolean));
});

test('clip planning respects speed, frame rate, and the video length', () => {
  const plan = (...a) => JSON.parse(run(`JSON.stringify(plan(${a.join(',')}))`));
  assert.deepStrictEqual(plan(1, 4, 10, 1, 60), { start: 1, end: 4, interval: 0.1, count: 30, delay: 10 });
  assert.strictEqual(plan(0, 4, 10, 2, 60).count, 20, 'double speed samples half as many frames');
  assert.strictEqual(plan(0, 10, 10, 1, 3).end, 3, 'clamped to the video length');
});
