// Shared by QR Studio and Phone to Laptop.
'use strict';
// QR encoder (ISO/IEC 18004) written from scratch: numeric, alphanumeric, and byte modes,
// versions 1 to 40, Reed-Solomon error correction, and penalty-based mask selection.

// tables indexed [level][version]; level order L, M, Q, H
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS = [1, 0, 3, 2];
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver, lvl) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[lvl][ver] * NUM_BLOCKS[lvl][ver];

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1
function gfMul(a, b) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((b >>> i) & 1) * a;
  }
  return z;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ r.shift();
    r.push(0);
    divisor.forEach((coef, i) => { r[i] ^= gfMul(coef, factor); });
  }
  return r;
}

// segments
function utf8(text) { return Array.from(new TextEncoder().encode(text)); }
function pickMode(text) {
  if (/^[0-9]*$/.test(text)) return 'num';
  if ([...text].every(ch => ALNUM.includes(ch))) return 'alnum';
  return 'byte';
}
function countBits(mode, ver) {
  const g = ver <= 9 ? 0 : ver <= 26 ? 1 : 2;
  return { num: [10, 12, 14], alnum: [9, 11, 13], byte: [8, 16, 16] }[mode][g];
}
function segmentBits(text, mode) {
  const bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  if (mode === 'num') {
    for (let i = 0; i < text.length; i += 3) { const chunk = text.slice(i, i + 3); put(parseInt(chunk, 10), chunk.length * 3 + 1); }
    return { bits, count: text.length, put };
  }
  if (mode === 'alnum') {
    for (let i = 0; i + 1 < text.length; i += 2) put(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
    if (text.length % 2) put(ALNUM.indexOf(text[text.length - 1]), 6);
    return { bits, count: text.length };
  }
  const bytes = utf8(text);
  bytes.forEach(b => put(b, 8));
  return { bits, count: bytes.length };
}
const MODE_INDICATOR = { num: 1, alnum: 2, byte: 4 };

function encodeData(text, lvl, minVer) {
  const mode = pickMode(text);
  const seg = segmentBits(text, mode);
  for (let ver = minVer || 1; ver <= 40; ver++) {
    const capacity = dataCodewords(ver, lvl) * 8;
    const cb = countBits(mode, ver);
    if (seg.count >= 1 << cb) continue;
    const used = 4 + cb + seg.bits.length;
    if (used > capacity) continue;
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(MODE_INDICATOR[mode], 4);
    put(seg.count, cb);
    bits.push(...seg.bits);
    put(0, Math.min(4, capacity - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
      bytes.push(b);
    }
    for (let pad = 0xec; bytes.length < capacity / 8; pad ^= 0xec ^ 0x11) bytes.push(pad);
    return { ver, mode, bytes };
  }
  return null;
}

function addEcc(bytes, ver, lvl) {
  const nBlocks = NUM_BLOCKS[lvl][ver], eccLen = ECC_PER_BLOCK[lvl][ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const nShort = nBlocks - raw % nBlocks, shortLen = Math.floor(raw / nBlocks);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = bytes.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(null);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach(b => { if (b[i] !== null) out.push(b[i]); });
  }
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => x * y % 2 + x * y % 3 === 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
];

function buildMatrix(ver, lvl, codewords, mask) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setF(x, y, d !== 2 && d !== 4);
    }
  }
  const al = alignmentPositions(ver), n = al.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  drawFormat(m, fn, lvl, mask, setF, size);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3);
      setF(a, b, dark); setF(b, a, dark);
    }
  }

  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        if (i < codewords.length * 8) { m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
        if (MASKS[mask](x, y)) m[y][x] = !m[y][x];
      }
    }
  }
  return m;
}

function drawFormat(m, fn, lvl, mask, setF, size) {
  const data = (FORMAT_BITS[lvl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = i => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
  setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
  for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
  setF(8, size - 8, true);
}

function penalty(m) {
  const size = m.length;
  let score = 0, dark = 0;
  const lines = [];
  for (let y = 0; y < size; y++) { lines.push(m[y]); lines.push(m.map(row => row[y])); }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += 3 + run - 5; run = 1; }
    }
    for (let i = 0; i + 10 < size; i++) {
      const s = line.slice(i, i + 11).map(v => (v ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') score += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  for (const row of m) for (const v of row) if (v) dark++;
  score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
  return score;
}

// returns { size, modules, ver, level, mode } or null when the text doesn't fit
function makeQR(text, level, opts = {}) {
  const lvl = LEVELS[level];
  const enc = encodeData(text, lvl, opts.minVer);
  if (!enc) return null;
  const codewords = addEcc(enc.bytes, enc.ver, lvl);
  let best = null, bestScore = Infinity;
  const masks = opts.mask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [opts.mask];
  for (const mask of masks) {
    const mat = buildMatrix(enc.ver, lvl, codewords, mask);
    const sc = penalty(mat);
    if (sc < bestScore) { bestScore = sc; best = { mat, mask }; }
  }
  return { size: best.mat.length, modules: best.mat, ver: enc.ver, level, mode: enc.mode, mask: best.mask };
}
