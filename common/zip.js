// Reads and writes ZIP files in the browser. Shared by Chat Wrapped, Instagram Unfollowers,
// Location Map and Carousel Splitter.
//
// Reading only loads what it needs: the directory at the end of the file, then each entry on
// request, so a multi-gigabyte export (including ZIP64 ones, as Google Takeout makes) is fine.
// Writing stores files uncompressed, which suits photos that are already compressed.
'use strict';

const Zip = (() => {
  const td = new TextDecoder();
  const u16 = (b, i) => b[i] | (b[i + 1] << 8);
  const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  const u64 = (b, i) => u32(b, i) + u32(b, i + 4) * 2 ** 32;
  const slice = async (blob, a, z) => new Uint8Array(await blob.slice(a, z).arrayBuffer());

  // Lists the entries: [{ name, size, csize, method, offset, dir }]
  async function open(blob) {
    const tailLen = Math.min(blob.size, 65557 + 20);
    const tail = await slice(blob, blob.size - tailLen, blob.size);
    let e = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('This isn\'t a ZIP file, or it\'s incomplete.');
    let count = u16(tail, e + 10), cdSize = u32(tail, e + 12), cdOff = u32(tail, e + 16);
    // ZIP64: the real numbers are in a second record just before
    if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
      const loc = e - 20;
      if (loc >= 0 && u32(tail, loc) === 0x07064b50) {
        const recOff = u64(tail, loc + 8), rec = await slice(blob, recOff, recOff + 56);
        if (u32(rec, 0) === 0x06064b50) { count = u64(rec, 32); cdSize = u64(rec, 40); cdOff = u64(rec, 48); }
      }
    }
    const cd = await slice(blob, cdOff, cdOff + cdSize);
    const entries = [];
    for (let p = 0, k = 0; k < count && p + 46 <= cd.length; k++) {
      if (u32(cd, p) !== 0x02014b50) break;
      const method = u16(cd, p + 10), nlen = u16(cd, p + 28), xlen = u16(cd, p + 30), clen = u16(cd, p + 32);
      let csize = u32(cd, p + 20), size = u32(cd, p + 24), offset = u32(cd, p + 42);
      const name = td.decode(cd.subarray(p + 46, p + 46 + nlen));
      // the ZIP64 extra field holds whichever of these didn't fit
      for (let x = p + 46 + nlen, end = x + xlen; x + 4 <= end;) {
        const id = u16(cd, x), len = u16(cd, x + 2);
        if (id === 1) {
          let q = x + 4;
          if (size === 0xffffffff) { size = u64(cd, q); q += 8; }
          if (csize === 0xffffffff) { csize = u64(cd, q); q += 8; }
          if (offset === 0xffffffff) { offset = u64(cd, q); }
        }
        x += 4 + len;
      }
      entries.push({ name, size, csize, method, offset, dir: name.endsWith('/') });
      p += 46 + nlen + xlen + clen;
    }
    return { blob, entries, read: entry => read(blob, entry), text: async entry => td.decode(await read(blob, entry)) };
  }

  async function read(blob, ent) {
    const head = await slice(blob, ent.offset, ent.offset + 30);
    if (u32(head, 0) !== 0x04034b50) throw new Error('Damaged ZIP entry: ' + ent.name);
    const start = ent.offset + 30 + u16(head, 26) + u16(head, 28);
    const data = await slice(blob, start, start + ent.csize);
    if (ent.method === 0) return data;
    if (ent.method !== 8) throw new Error('Unsupported compression in ' + ent.name);
    if (typeof DecompressionStream !== 'function') throw new Error('This browser can\'t unzip files. Unzip it first and choose the files inside.');
    const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
    return new Uint8Array(await out.arrayBuffer());
  }

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  // files: [{ name, data: Uint8Array }] → a Blob of a ZIP with the files stored as they are
  function build(files, when = new Date()) {
    const te = new TextEncoder(), parts = [], dir = [];
    const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
    const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
    let off = 0;
    for (const f of files) {
      const name = te.encode(f.name), crc = crc32(f.data), n = f.data.length;
      const h = new Uint8Array(30 + name.length), v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
      v.setUint16(10, time, true); v.setUint16(12, date, true); v.setUint32(14, crc, true); v.setUint32(18, n, true); v.setUint32(22, n, true);
      v.setUint16(26, name.length, true); h.set(name, 30);
      parts.push(h, f.data);
      const c = new Uint8Array(46 + name.length), w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true);
      w.setUint16(12, time, true); w.setUint16(14, date, true); w.setUint32(16, crc, true); w.setUint32(20, n, true); w.setUint32(24, n, true);
      w.setUint16(28, name.length, true); w.setUint32(42, off, true); c.set(name, 46);
      dir.push(c);
      off += h.length + n;
    }
    const cdSize = dir.reduce((a, c) => a + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, off, true);
    return new Blob([...parts, ...dir, end], { type: 'application/zip' });
  }

  return { open, build, crc32 };
})();
if (typeof module === 'object' && module.exports) module.exports = Zip;
