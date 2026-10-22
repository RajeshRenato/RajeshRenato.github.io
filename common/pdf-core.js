// A small PDF reader and writer, shared by PDF Toolkit and PDF Sign & Fill.
// Reads classic and compressed cross-reference data, object streams, and
// incremental updates, and writes a new file from any mix of pages.
'use strict';

// ---------- objects

class Name { constructor(n) { this.n = n; } }
class Str { constructor(b) { this.b = b; } }
class Ref { constructor(num, gen) { this.num = num; this.gen = gen; } }
class Kw { constructor(k) { this.k = k; } }
class Dict {
  constructor() { this.m = new Map(); }
  get(k) { return this.m.get(k); }
  set(k, v) { this.m.set(k, v); return this; }
  has(k) { return this.m.has(k); }
}
class Stream { constructor(dict, data) { this.dict = dict; this.data = data; } }
const nm = v => (v instanceof Name ? v.n : undefined);
const N = n => new Name(n);

// ---------- lexer

const WS = new Uint8Array(256), DELIM = new Uint8Array(256);
for (const c of [0, 9, 10, 12, 13, 32]) WS[c] = 1;
for (const c of '()<>[]{}/%') DELIM[c.charCodeAt(0)] = 1;
const isDigit = c => c >= 48 && c <= 57;

class Lexer {
  constructor(b, i = 0) { this.b = b; this.i = i; }
  ws() {
    const b = this.b;
    for (;;) {
      while (this.i < b.length && WS[b[this.i]]) this.i++;
      if (b[this.i] !== 37) return;
      while (this.i < b.length && b[this.i] !== 10 && b[this.i] !== 13) this.i++;
    }
  }
  obj() {
    this.ws();
    const b = this.b, c = b[this.i];
    if (c === undefined) throw new Error('unexpected end of data');
    if (c === 47) return this.name();
    if (c === 40) return this.literal();
    if (c === 60) {
      if (b[this.i + 1] === 60) { this.i += 2; return this.dict(); }
      return this.hex();
    }
    if (c === 91) {
      this.i++;
      const a = [];
      for (;;) {
        this.ws();
        if (this.i >= b.length) throw new Error('unclosed array');
        if (b[this.i] === 93) { this.i++; return a; }
        a.push(this.obj());
      }
    }
    if (isDigit(c) || c === 43 || c === 45 || c === 46) {
      const n = this.num();
      if (Number.isInteger(n) && n >= 0) {
        const save = this.i;
        this.ws();
        if (isDigit(b[this.i])) {
          const g = this.num();
          this.ws();
          const after = b[this.i + 1];
          if (b[this.i] === 82 && (after === undefined || WS[after] || DELIM[after])) { this.i++; return new Ref(n, g); }
        }
        this.i = save;
      }
      return n;
    }
    let s = '';
    while (this.i < b.length && !WS[b[this.i]] && !DELIM[b[this.i]]) s += String.fromCharCode(b[this.i++]);
    if (!s) { this.i++; return new Kw(String.fromCharCode(c)); }
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    return new Kw(s);
  }
  num() {
    const b = this.b;
    let s = '';
    while (this.i < b.length && (isDigit(b[this.i]) || b[this.i] === 43 || b[this.i] === 45 || b[this.i] === 46)) s += String.fromCharCode(b[this.i++]);
    const v = parseFloat(s.replace(/^([+-])[+-]+/, '$1'));
    return Number.isFinite(v) ? v : 0;
  }
  name() {
    const b = this.b;
    this.i++;
    let s = '';
    while (this.i < b.length && !WS[b[this.i]] && !DELIM[b[this.i]]) {
      if (b[this.i] === 35 && this.i + 2 < b.length) {
        const h = parseInt(String.fromCharCode(b[this.i + 1], b[this.i + 2]), 16);
        if (!Number.isNaN(h)) { s += String.fromCharCode(h); this.i += 3; continue; }
      }
      s += String.fromCharCode(b[this.i++]);
    }
    return new Name(s);
  }
  literal() {
    const b = this.b, out = [];
    let depth = 1;
    this.i++;
    while (this.i < b.length) {
      let c = b[this.i++];
      if (c === 40) depth++;
      else if (c === 41 && --depth === 0) break;
      else if (c === 92) {
        c = b[this.i++];
        const map = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 };
        if (map[c] !== undefined) c = map[c];
        else if (c >= 48 && c <= 55) {
          let v = c - 48;
          for (let k = 0; k < 2 && b[this.i] >= 48 && b[this.i] <= 55; k++) v = v * 8 + b[this.i++] - 48;
          c = v & 255;
        } else if (c === 13 || c === 10) {
          if (c === 13 && b[this.i] === 10) this.i++;
          continue;
        }
      } else if (c === 13) {
        if (b[this.i] === 10) this.i++;
        c = 10;
      }
      out.push(c);
    }
    return new Str(Uint8Array.from(out));
  }
  hex() {
    const b = this.b;
    this.i++;
    let s = '';
    while (this.i < b.length && b[this.i] !== 62) {
      const ch = String.fromCharCode(b[this.i++]);
      if (/[0-9a-fA-F]/.test(ch)) s += ch;
    }
    this.i++;
    if (s.length % 2) s += '0';
    const out = new Uint8Array(s.length / 2);
    for (let k = 0; k < out.length; k++) out[k] = parseInt(s.substr(k * 2, 2), 16);
    return new Str(out);
  }
  dict() {
    const b = this.b, d = new Dict();
    for (;;) {
      this.ws();
      if (this.i >= b.length) throw new Error('unclosed dictionary');
      if (b[this.i] === 62 && b[this.i + 1] === 62) { this.i += 2; return d; }
      const k = this.obj();
      if (!(k instanceof Name)) continue;
      this.ws();
      if (b[this.i] === 62 && b[this.i + 1] === 62) { this.i += 2; return d; }
      d.set(k.n, this.obj());
    }
  }
}

// ---------- bytes

function findBytes(b, pat, from = 0, back = false) {
  const p = typeof pat === 'string' ? Array.from(pat, c => c.charCodeAt(0)) : pat;
  if (back) {
    for (let i = Math.min(from, b.length - p.length); i >= 0; i--) {
      let k = 0;
      while (k < p.length && b[i + k] === p[k]) k++;
      if (k === p.length) return i;
    }
    return -1;
  }
  for (let i = from; i <= b.length - p.length; i++) {
    if (b[i] !== p[0]) continue;
    let k = 1;
    while (k < p.length && b[i + k] === p[k]) k++;
    if (k === p.length) return i;
  }
  return -1;
}
const startsWith = (b, i, s) => { for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false; return true; };
function latin1(b) {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return s;
}

async function inflate(data) {
  const res = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')));
  return new Uint8Array(await res.arrayBuffer());
}

function unpredict(data, parms) {
  const pred = parms instanceof Dict ? parms.get('Predictor') || 1 : 1;
  if (pred < 10) return data;
  const colors = parms.get('Colors') || 1, bpc = parms.get('BitsPerComponent') || 8, cols = parms.get('Columns') || 1;
  const bpp = Math.max(1, Math.ceil(colors * bpc / 8)), row = Math.ceil(colors * bpc * cols / 8);
  const rows = Math.floor(data.length / (row + 1));
  const out = new Uint8Array(rows * row);
  let prev = new Uint8Array(row);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (row + 1)], src = data.subarray(r * (row + 1) + 1, (r + 1) * (row + 1)), cur = out.subarray(r * row, (r + 1) * row);
    for (let x = 0; x < row; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (type === 1) v += a;
      else if (type === 2) v += up;
      else if (type === 3) v += (a + up) >> 1;
      else if (type === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return out;
}

class EncryptedError extends Error {}

// ---------- reading

class PdfDoc {
  constructor(bytes, name) {
    this.b = bytes;
    this.name = name;
    this.xref = new Map();
    this.cache = new Map();
    this.packed = new Map();
    this.trailer = null;
  }

  async load() {
    try {
      await this.readXrefChain();
      this.checkEncryption();
      await this.unpackObjectStreams();
      this.findPages();
    } catch (e) {
      if (e instanceof EncryptedError) throw e;
      this.xref.clear(); this.cache.clear(); this.packed.clear(); this.trailer = null;
      this.scan();
      this.checkEncryption();
      await this.unpackObjectStreams();
      this.findPages();
      this.repaired = true;
    }
    return this;
  }

  checkEncryption() {
    if (this.trailer && this.trailer.has('Encrypt')) throw new EncryptedError(this.name + ' is password-protected or encrypted, so it can\'t be edited here.');
  }

  async readXrefChain() {
    const b = this.b;
    const sx = findBytes(b, 'startxref', b.length - 1, true);
    if (sx < 0) throw new Error('no startxref');
    let off = new Lexer(b, sx + 9).obj();
    const seen = new Set();
    while (typeof off === 'number' && !seen.has(off) && off >= 0 && off < b.length) {
      seen.add(off);
      let i = off;
      while (WS[b[i]]) i++;
      const trailer = startsWith(b, i, 'xref') ? this.readXrefTable(i + 4) : await this.readXrefStream(i);
      if (!this.trailer) this.trailer = trailer;
      const xs = trailer.get('XRefStm');
      if (typeof xs === 'number' && !seen.has(xs)) { seen.add(xs); await this.readXrefStream(xs); }
      off = trailer.get('Prev');
    }
    if (!this.trailer || !this.trailer.get('Root')) throw new Error('no document catalog');
  }

  readXrefTable(i) {
    const L = new Lexer(this.b, i);
    for (;;) {
      const t = L.obj();
      if (t instanceof Kw && t.k === 'trailer') break;
      if (typeof t !== 'number') throw new Error('bad xref table');
      const count = L.obj();
      for (let k = 0; k < count; k++) {
        const off = L.obj(), gen = L.obj(), kind = L.obj();
        if (typeof off !== 'number' || !(kind instanceof Kw)) throw new Error('bad xref entry');
        const num = t + k;
        if (!this.xref.has(num)) this.xref.set(num, kind.k === 'n' && off > 0 ? { t: 1, off, gen } : { t: 0 });
      }
    }
    const tr = L.obj();
    if (!(tr instanceof Dict)) throw new Error('bad trailer');
    return tr;
  }

  async readXrefStream(off) {
    const s = this.readAt(off);
    if (!(s instanceof Stream) || nm(s.dict.get('Type')) !== 'XRef') throw new Error('bad xref stream');
    const data = await this.decode(s);
    const W = s.dict.get('W'), index = s.dict.get('Index') || [0, s.dict.get('Size')];
    let p = 0;
    const read = w => { let v = 0; for (let k = 0; k < w; k++) v = v * 256 + data[p++]; return v; };
    for (let j = 0; j < index.length; j += 2) {
      for (let k = 0; k < index[j + 1]; k++) {
        if (p >= data.length) break;
        const type = W[0] ? read(W[0]) : 1, f2 = read(W[1]), f3 = read(W[2]);
        const num = index[j] + k;
        if (this.xref.has(num)) continue;
        if (type === 1) this.xref.set(num, { t: 1, off: f2, gen: f3 });
        else if (type === 2) this.xref.set(num, { t: 2, stm: f2, idx: f3 });
        else this.xref.set(num, { t: 0 });
      }
    }
    return s.dict;
  }

  // Rebuild the table by finding every "N G obj" in the file; the last one of each number wins.
  scan() {
    const s = latin1(this.b);
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = re.exec(s))) {
      if (m.index > 0 && /\d/.test(s[m.index - 1])) continue;
      this.xref.set(+m[1], { t: 1, off: m.index, gen: +m[2] });
    }
    for (let i = s.lastIndexOf('trailer'); i >= 0; i = s.lastIndexOf('trailer', i - 1)) {
      try {
        const d = new Lexer(this.b, i + 7).obj();
        if (d instanceof Dict && d.get('Root')) { this.trailer = d; break; }
      } catch (e) { }
    }
    if (!this.trailer) {
      for (const [num, e] of this.xref) {
        let v;
        try { v = this.readAt(e.off); } catch (err) { continue; }
        if (v instanceof Stream && nm(v.dict.get('Type')) === 'XRef' && v.dict.get('Root')) { this.trailer = v.dict; break; }
        if (v instanceof Dict && nm(v.get('Type')) === 'Catalog') this.trailer = new Dict().set('Root', new Ref(num, 0));
      }
    }
    if (!this.trailer) throw new Error('no document catalog');
    this.scanned = true;
  }

  async unpackObjectStreams() {
    const streams = new Set();
    for (const e of this.xref.values()) if (e.t === 2) streams.add(e.stm);
    if (this.scanned) {
      for (const [num, e] of this.xref) {
        if (e.t !== 1) continue;
        try { const v = this.fetch(num); if (v instanceof Stream && nm(v.dict.get('Type')) === 'ObjStm') streams.add(num); } catch (err) { }
      }
    }
    for (const num of streams) {
      const s = this.fetch(num);
      if (!(s instanceof Stream)) continue;
      const data = await this.decode(s);
      const n = s.dict.get('N'), first = s.dict.get('First');
      const L = new Lexer(data, 0);
      const heads = [];
      for (let k = 0; k < n; k++) heads.push([L.obj(), L.obj()]);
      heads.forEach(([objNum, off], k) => {
        const e = this.xref.get(objNum);
        if (e && (e.t !== 2 || e.stm !== num)) return;
        if (!e) this.xref.set(objNum, { t: 2, stm: num, idx: k });
        try { this.packed.set(objNum, new Lexer(data, first + off).obj()); } catch (err) { }
      });
    }
  }

  async decode(s) {
    let filters = s.dict.get('Filter'), parms = this.get(s.dict.get('DecodeParms'));
    filters = Array.isArray(filters) ? filters : filters ? [filters] : [];
    parms = Array.isArray(parms) ? parms : [parms];
    let data = s.data;
    for (let k = 0; k < filters.length; k++) {
      const f = nm(this.get(filters[k]));
      if (f !== 'FlateDecode' && f !== 'Fl') throw new Error('unsupported filter ' + f);
      data = unpredict(await inflate(data), this.get(parms[k]));
    }
    return data;
  }

  readAt(off) {
    const L = new Lexer(this.b, off);
    L.obj(); L.obj();
    const kw = L.obj();
    if (!(kw instanceof Kw) || kw.k !== 'obj') throw new Error('expected an object at ' + off);
    const v = L.obj();
    if (!(v instanceof Dict)) return v;
    L.ws();
    if (!startsWith(this.b, L.i, 'stream')) return v;
    let start = L.i + 6;
    if (this.b[start] === 13) start++;
    if (this.b[start] === 10) start++;
    let len = v.get('Length');
    if (len instanceof Ref) { try { len = this.get(len); } catch (e) { len = -1; } }
    let end = typeof len === 'number' && len >= 0 ? start + len : -1;
    if (end > 0) {
      let k = end;
      while (WS[this.b[k]]) k++;
      if (!startsWith(this.b, k, 'endstream')) end = -1;
    }
    if (end < 0) {
      end = findBytes(this.b, 'endstream', start);
      if (end < 0) end = this.b.length;
      if (this.b[end - 1] === 10) end--;
      if (this.b[end - 1] === 13) end--;
    }
    return new Stream(v, this.b.subarray(start, end));
  }

  fetch(num) {
    if (this.cache.has(num)) return this.cache.get(num);
    const e = this.xref.get(num);
    let v = null;
    if (e && e.t === 1) v = this.readAt(e.off);
    else if (e && e.t === 2) v = this.packed.has(num) ? this.packed.get(num) : null;
    this.cache.set(num, v);
    return v;
  }

  get(v) {
    for (let hops = 0; v instanceof Ref && hops < 32; hops++) v = this.fetch(v.num);
    return v instanceof Ref ? null : v;
  }

  findPages() {
    const root = this.get(this.trailer.get('Root'));
    if (!(root instanceof Dict)) throw new Error('no document catalog');
    this.pages = [];
    this.treeNums = new Set();
    const seen = new Set();
    const walk = (ref, inh, depth) => {
      if (depth > 64) return;
      if (ref instanceof Ref) { if (seen.has(ref.num)) return; seen.add(ref.num); }
      const node = this.get(ref);
      if (!(node instanceof Dict)) return;
      const here = Object.assign({}, inh);
      for (const k of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) if (node.has(k)) here[k] = node.get(k);
      const kids = this.get(node.get('Kids'));
      if (nm(node.get('Type')) !== 'Page' && Array.isArray(kids)) {
        if (ref instanceof Ref) this.treeNums.add(ref.num);
        for (const k of kids) walk(k, here, depth + 1);
      } else {
        if (ref instanceof Ref) this.treeNums.add(ref.num);
        this.pages.push({ ref, dict: node, inh: here });
      }
    };
    walk(root.get('Pages'), {}, 0);
    if (!this.pages.length) throw new Error('no pages found');
  }

  pageInfo(k) {
    const p = this.pages[k];
    let box = this.get(p.inh.CropBox) || this.get(p.inh.MediaBox);
    box = Array.isArray(box) && box.length === 4 ? box.map(x => +this.get(x) || 0) : [0, 0, 612, 792];
    const w = Math.abs(box[2] - box[0]) || 612, h = Math.abs(box[3] - box[1]) || 792;
    const rot = ((Math.round((+this.get(p.inh.Rotate) || 0) / 90) * 90) % 360 + 360) % 360;
    return { w, h, rot };
  }
}

async function openPdf(bytes, name) {
  const head = findBytes(bytes.subarray(0, 1024), '%PDF-');
  if (head < 0) throw new Error(name + ' is not a PDF.');
  return new PdfDoc(bytes, name).load();
}

// ---------- writing

function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}
function escName(s) {
  let o = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    o += c < 33 || c > 126 || c === 35 || DELIM[c] ? '#' + c.toString(16).padStart(2, '0') : ch;
  }
  return o;
}
function hexOf(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
  return s;
}
function ser(v) {
  if (v === null || v === undefined) return 'null';
  if (v === true || v === false) return String(v);
  if (typeof v === 'number') return fmtNum(v);
  if (v instanceof Name) return '/' + escName(v.n);
  if (v instanceof Str) return '<' + hexOf(v.b) + '>';
  if (v instanceof Ref) return v.num + ' ' + v.gen + ' R';
  if (Array.isArray(v)) return '[' + v.map(ser).join(' ') + ']';
  if (v instanceof Dict) {
    let s = '<<';
    for (const [k, x] of v.m) s += '/' + escName(k) + ' ' + ser(x);
    return s + '>>';
  }
  if (v instanceof Kw) return v.k;
  return 'null';
}
const ascii = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };

function isLinkToPage(doc, annot) {
  annot = doc.get(annot);
  if (!(annot instanceof Dict) || nm(annot.get('Subtype')) !== 'Link') return false;
  if (annot.has('Dest')) return true;
  const a = doc.get(annot.get('A'));
  return a instanceof Dict && nm(a.get('S')) === 'GoTo';
}

// items: [{ doc, k (page index in doc), rot (extra quarter turns, in degrees), stamp }]
// stamp (optional) draws on top of the page: { ops: content stream text,
//   fonts: { name: true } for Helvetica, images: { name: { w, h, rgb, alpha } } with
//   rgb and alpha already zlib-compressed }. Its drawing starts from the page's
//   own coordinate system, whatever the page's content leaves behind.
function buildPdf(items) {
  const objs = [null, null, null];
  const maps = new Map();
  const queue = [];
  const alloc = v => { objs.push(v); return objs.length - 1; };

  function refFor(doc, ref) {
    if (doc.treeNums.has(ref.num)) return null;
    let m = maps.get(doc);
    if (!m) maps.set(doc, (m = new Map()));
    if (!m.has(ref.num)) { const n = alloc(null); m.set(ref.num, n); queue.push([doc, ref.num, n]); }
    return new Ref(m.get(ref.num), 0);
  }
  function copy(doc, v) {
    if (v instanceof Ref) return refFor(doc, v);
    if (Array.isArray(v)) return v.map(x => copy(doc, x));
    if (v instanceof Stream) {
      const d = new Dict();
      for (const [k, x] of v.dict.m) d.set(k, k === 'Length' ? v.data.length : copy(doc, x));
      return new Stream(d, v.data);
    }
    if (v instanceof Dict) {
      const d = new Dict();
      for (const [k, x] of v.m) d.set(k, copy(doc, x));
      return d;
    }
    return v;
  }

  const kids = [];
  function stampPage(d, doc, p, stamp) {
    const res = doc.get(p.inh.Resources);
    const r = res instanceof Dict ? copy(doc, res) : new Dict();
    const add = (key, entries) => {
      const orig = res instanceof Dict ? doc.get(res.get(key)) : undefined;
      const sub = orig instanceof Dict ? copy(doc, orig) : new Dict();
      for (const [name, v] of entries) sub.set(name, new Ref(alloc(v), 0));
      r.set(key, sub);
    };
    const fonts = Object.keys(stamp.fonts || {});
    if (fonts.length) add('Font', fonts.map(n => [n, new Dict().set('Type', N('Font')).set('Subtype', N('Type1'))
      .set('BaseFont', N('Helvetica')).set('Encoding', N('WinAnsiEncoding'))]));
    const images = Object.entries(stamp.images || {});
    if (images.length) add('XObject', images.map(([n, im]) => {
      const mask = new Stream(new Dict().set('Type', N('XObject')).set('Subtype', N('Image')).set('Width', im.w).set('Height', im.h)
        .set('ColorSpace', N('DeviceGray')).set('BitsPerComponent', 8).set('Filter', N('FlateDecode')).set('Length', im.alpha.length), im.alpha);
      return [n, new Stream(new Dict().set('Type', N('XObject')).set('Subtype', N('Image')).set('Width', im.w).set('Height', im.h)
        .set('ColorSpace', N('DeviceRGB')).set('BitsPerComponent', 8).set('Filter', N('FlateDecode')).set('Length', im.rgb.length)
        .set('SMask', new Ref(alloc(mask), 0)), im.rgb)];
    }));
    d.set('Resources', r);
    const raw = doc.get(p.dict.get('Contents'));
    const list = Array.isArray(raw) ? copy(doc, raw) : d.get('Contents') ? [d.get('Contents')] : [];
    const stream = text => { const b = ascii(text); return new Ref(alloc(new Stream(new Dict().set('Length', b.length), b)), 0); };
    d.set('Contents', [stream('q\n'), ...list, stream('Q\n' + stamp.ops)]);
  }

  for (const { doc, k, rot, stamp } of items) {
    const p = doc.pages[k];
    const d = new Dict();
    d.set('Type', N('Page'));
    d.set('Parent', new Ref(2, 0));
    for (const [key, x] of p.dict.m) {
      if (['Type', 'Parent', 'Resources', 'MediaBox', 'CropBox', 'Rotate', 'Annots'].includes(key)) continue;
      d.set(key, copy(doc, x));
    }
    d.set('Resources', p.inh.Resources !== undefined ? copy(doc, p.inh.Resources) : new Dict());
    d.set('MediaBox', p.inh.MediaBox !== undefined ? copy(doc, p.inh.MediaBox) : [0, 0, 612, 792]);
    if (p.inh.CropBox !== undefined) d.set('CropBox', copy(doc, p.inh.CropBox));
    const rotate = ((doc.pageInfo(k).rot + (rot || 0)) % 360 + 360) % 360;
    if (rotate) d.set('Rotate', rotate);
    const annots = doc.get(p.dict.get('Annots'));
    if (Array.isArray(annots)) {
      const kept = annots.filter(a => !isLinkToPage(doc, a)).map(a => copy(doc, a)).filter(a => a !== null);
      if (kept.length) d.set('Annots', kept);
    }
    if (stamp) stampPage(d, doc, p, stamp);
    kids.push(new Ref(alloc(d), 0));
    while (queue.length) {
      const [qdoc, num, n] = queue.shift();
      let v;
      try { v = qdoc.fetch(num); } catch (e) { v = null; }
      objs[n] = copy(qdoc, v);
    }
  }
  objs[1] = new Dict().set('Type', N('Catalog')).set('Pages', new Ref(2, 0));
  objs[2] = new Dict().set('Type', N('Pages')).set('Kids', kids).set('Count', kids.length);

  const parts = [];
  let size = 0;
  const put = a => { parts.push(a); size += a.length; };
  put(ascii('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n'));
  const offsets = [0];
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = size;
    const v = objs[n];
    if (v instanceof Stream) {
      put(ascii(n + ' 0 obj\n' + ser(v.dict) + '\nstream\n'));
      put(v.data);
      put(ascii('\nendstream\nendobj\n'));
    } else put(ascii(n + ' 0 obj\n' + ser(v) + '\nendobj\n'));
  }
  const xrefAt = size;
  let x = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let n = 1; n < objs.length; n++) x += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
  x += 'trailer\n<</Size ' + objs.length + '/Root 1 0 R>>\nstartxref\n' + xrefAt + '\n%%EOF\n';
  put(ascii(x));
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
