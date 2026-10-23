// Removes the password from a PDF you can already open, using the standard PDF security handler:
// RC4 40 and 128 bit (revisions 2 to 4), AES-128 (revision 4) and AES-256 (revisions 5 and 6).
// Needs common/pdf-core.js loaded first. Used by PDF Unlock and Bank Statement Insights.
'use strict';

const PdfUnlock = (() => {
  const PAD = new Uint8Array([0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
    0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a]);
  const cat = (...a) => { const n = a.reduce((t, x) => t + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
  const eq = (a, b, n) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false; return true; };

  // ---- MD5 (RFC 1321) and RC4, which the browser's crypto doesn't offer
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const SH = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  function md5(msg) {
    const n = msg.length, len = ((n + 8) >> 6) + 1, w = new Uint32Array(len * 16);
    for (let i = 0; i < n; i++) w[i >> 2] |= msg[i] << ((i & 3) * 8);
    w[n >> 2] |= 0x80 << ((n & 3) * 8);
    w[len * 16 - 2] = (n * 8) >>> 0; w[len * 16 - 1] = Math.floor(n / 0x20000000);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < w.length; o += 16) {
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) & 15; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) & 15; }
        else { f = c ^ (b | ~d); g = (7 * i) & 15; }
        const s = SH[(i >> 4) * 4 + (i & 3)];
        const t = (a + f + K[i] + w[o + g]) >>> 0;
        a = d; d = c; c = b; b = (b + ((t << s) | (t >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    const out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach((v, k) => { for (let j = 0; j < 4; j++) out[k * 4 + j] = (v >>> (8 * j)) & 255; });
    return out;
  }
  function rc4(key, data) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    for (let i = 0, j = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; [S[i], S[j]] = [S[j], S[i]]; }
    const out = new Uint8Array(data.length);
    for (let k = 0, i = 0, j = 0; k < data.length; k++) {
      i = (i + 1) & 255; j = (j + S[i]) & 255; [S[i], S[j]] = [S[j], S[i]];
      out[k] = data[k] ^ S[(S[i] + S[j]) & 255];
    }
    return out;
  }
  const subtle = () => crypto.subtle;
  async function sha(bits, data) { return new Uint8Array(await subtle().digest('SHA-' + bits, data)); }
  async function aesKey(raw, mode, use) { return subtle().importKey('raw', raw, { name: mode }, false, [use]); }
  async function aesCbcEncrypt(key, iv, data) {   // no padding: data is a whole number of blocks
    const out = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv }, await aesKey(key, 'AES-CBC', 'encrypt'), data));
    return out.subarray(0, data.length);
  }
  // CBC decryption without padding: the browser insists on padding, so add a block that decrypts to valid padding
  async function aesCbcDecryptNoPad(key, iv, data) {
    const last = data.subarray(data.length - 16), pad = new Uint8Array(16).fill(16);
    const extra = (await aesCbcEncrypt(key, last, pad));
    const k = await aesKey(key, 'AES-CBC', 'decrypt');
    return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv }, k, cat(data, extra)));
  }
  async function aesDecryptObject(key, data) {   // IV, then the PKCS#7-padded ciphertext
    if (data.length < 32 || data.length % 16) return data.length <= 16 ? new Uint8Array(0) : data;
    const k = await aesKey(key, 'AES-CBC', 'decrypt');
    try { return new Uint8Array(await subtle().decrypt({ name: 'AES-CBC', iv: data.subarray(0, 16) }, k, data.subarray(16))); }
    catch (e) { return aesCbcDecryptNoPad(key, data.subarray(0, 16), data.subarray(16)); }
  }

  const bytesOf = v => (v && v.b instanceof Uint8Array ? v.b : new Uint8Array(0));
  const padPw = pw => { const b = new TextEncoder().encode(pw).subarray(0, 32), o = new Uint8Array(32); o.set(b); o.set(PAD.subarray(0, 32 - b.length), b.length); return o; };
  // older PDFs used Latin-1 passwords; fall back to that when the UTF-8 bytes don't work
  const latinPw = pw => { const o = new Uint8Array(32); let n = 0; for (const ch of pw) { if (n >= 32) break; const c = ch.codePointAt(0); o[n++] = c < 256 ? c : 63; } o.set(PAD.subarray(0, 32 - n), n); return o; };

  // ---- revisions 2 to 4: an MD5-based key
  function fileKeyR4(pw32, E, id0) {
    const n = E.R === 2 ? 5 : (E.Length || 40) / 8;
    const p = new Uint8Array(4); new DataView(p.buffer).setInt32(0, E.P, true);
    let h = md5(cat(pw32, E.O, p, id0, E.R >= 4 && E.EncryptMetadata === false ? new Uint8Array([255, 255, 255, 255]) : new Uint8Array(0)));
    if (E.R >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
    return h.slice(0, n);
  }
  function userCheckR4(key, E, id0) {
    if (E.R === 2) return eq(rc4(key, PAD), E.U, 32);
    let x = rc4(key, md5(cat(PAD, id0)));
    for (let i = 1; i <= 19; i++) x = rc4(key.map(b => b ^ i), x);
    return eq(x, E.U, 16);
  }
  // the owner password unlocks the user password stored in O
  function userFromOwnerR4(pw32, E) {
    const n = E.R === 2 ? 5 : (E.Length || 40) / 8;
    let h = md5(pw32);
    if (E.R >= 3) for (let i = 0; i < 50; i++) h = md5(h);
    const key = h.subarray(0, n);
    let x = E.O.slice(0, 32);
    if (E.R === 2) x = rc4(key, x);
    else for (let i = 19; i >= 0; i--) x = rc4(key.map(b => b ^ i), x);
    return x;
  }

  // ---- revisions 5 and 6: SHA-2 and AES-256
  async function hashR6(pw, salt, udata, R) {
    let k = await sha(256, cat(pw, salt, udata));
    if (R === 5) return k;
    for (let i = 0; ; i++) {
      const block = cat(pw, k, udata), k1 = new Uint8Array(block.length * 64);
      for (let j = 0; j < 64; j++) k1.set(block, j * block.length);
      const e = await aesCbcEncrypt(k.subarray(0, 16), k.subarray(16, 32), k1);
      let m = 0;
      for (let j = 0; j < 16; j++) m += e[j];
      k = await sha([256, 384, 512][m % 3], e);
      if (i >= 63 && e[e.length - 1] <= i - 31) break;
    }
    return k.subarray(0, 32);
  }
  async function fileKeyR6(pw, E) {
    // the standard says UTF-8, but some tools write Latin-1, so try both
    const forms = [new TextEncoder().encode(pw.normalize('NFKC')).subarray(0, 127)];
    if ([...pw].every(ch => ch.codePointAt(0) < 256) && /[^\x00-\x7f]/.test(pw)) forms.push(Uint8Array.from([...pw].map(ch => ch.codePointAt(0))).subarray(0, 127));
    for (const p of forms) { const r = await keyR6With(p, E); if (r) return r; }
    return null;
  }
  async function keyR6With(p, E) {
    const U = E.U, O = E.O;
    if (eq(await hashR6(p, O.subarray(32, 40), U.subarray(0, 48), E.R), O, 32)) {
      const ik = await hashR6(p, O.subarray(40, 48), U.subarray(0, 48), E.R);
      return { key: await aesCbcDecryptNoPad(ik, new Uint8Array(16), E.OE.subarray(0, 32)), owner: true };
    }
    if (eq(await hashR6(p, U.subarray(32, 40), new Uint8Array(0), E.R), U, 32)) {
      const ik = await hashR6(p, U.subarray(40, 48), new Uint8Array(0), E.R);
      return { key: await aesCbcDecryptNoPad(ik, new Uint8Array(16), E.UE.subarray(0, 32)), owner: false };
    }
    return null;
  }

  class PasswordError extends Error {}

  // Reads an encrypted PDF and works out the file key from the password.
  class LockedDoc extends PdfDoc {
    checkEncryption() { }
    async openWith(password) {
      try { await this.readXrefChain(); } catch (e) { this.xref.clear(); this.cache.clear(); this.trailer = null; this.scan(); }
      const encRef = this.trailer.get('Encrypt');
      this.encNum = encRef instanceof Ref ? encRef.num : -1;
      const enc = this.get(encRef);
      this.cache.clear();
      if (!(enc instanceof Dict)) { this.plain = true; await this.unpackObjectStreams(); this.findPages(); return this; }
      if (nm(enc.get('Filter')) !== 'Standard') throw new Error('This PDF uses a certificate or a custom security handler, not a password.');
      const E = { V: enc.get('V') || 0, R: enc.get('R') || 2, Length: enc.get('Length') || 40, P: enc.get('P') | 0,
        O: bytesOf(enc.get('O')), U: bytesOf(enc.get('U')), OE: bytesOf(enc.get('OE')), UE: bytesOf(enc.get('UE')), EncryptMetadata: enc.get('EncryptMetadata') };
      // which cipher strings and streams use
      E.cfm = 'V2';
      if (E.V >= 4) {
        const cf = this.get(enc.get('CF')), stmf = nm(enc.get('StmF')) || 'Identity', strf = nm(enc.get('StrF')) || 'Identity';
        const m = name => { const d = cf instanceof Dict ? this.get(cf.get(name)) : null; return name === 'Identity' ? 'None' : d instanceof Dict ? nm(d.get('CFM')) || 'None' : 'V2'; };
        E.stmCfm = m(stmf); E.strCfm = m(strf);
        if (E.V === 4 && enc.get('Length') === undefined) E.Length = 128;
      } else E.stmCfm = E.strCfm = 'V2';
      const ids = this.get(this.trailer.get('ID')), id0 = Array.isArray(ids) ? bytesOf(this.get(ids[0])) : new Uint8Array(0);
      this.E = E;
      let found = null;
      if (E.R >= 5) found = await fileKeyR6(password, E);
      else {
        for (const pw32 of [padPw(password), latinPw(password)]) {
          let key = fileKeyR4(pw32, E, id0);
          if (userCheckR4(key, E, id0)) { found = { key, owner: false }; break; }
          const user = userFromOwnerR4(pw32, E);
          key = fileKeyR4(user, E, id0);
          if (userCheckR4(key, E, id0)) { found = { key, owner: true }; break; }
        }
      }
      if (!found) throw new PasswordError(password ? 'Wrong password.' : 'This PDF needs a password to open.');
      this.key = found.key; this.ownerPw = found.owner;
      this.restricted = (E.P & 0x0f3c) !== 0x0f3c;   // printing, copying or editing turned off
      // decrypt every object now, so later reads (which are synchronous) find them ready
      for (const [num, e] of this.xref) {
        if (e.t !== 1 || num === this.encNum) continue;
        let v;
        try { v = this.readAt(e.off); } catch (err) { continue; }
        this.cache.set(num, await this.decryptValue(v, num, e.gen || 0));
      }
      await this.unpackObjectStreams();
      this.findPages();
      return this;
    }
    objKey(num, gen, aes) {
      if (this.E.R >= 5) return this.key;
      const k = this.key, extra = cat(new Uint8Array([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]), aes ? new Uint8Array([0x73, 0x41, 0x6c, 0x54]) : new Uint8Array(0));
      return md5(cat(k, extra)).subarray(0, Math.min(k.length + 5, 16));
    }
    async decryptBytes(data, num, gen, cfm) {
      if (cfm === 'None') return data;
      if (cfm === 'AESV2' || cfm === 'AESV3') return aesDecryptObject(this.objKey(num, gen, true), data);
      return rc4(this.objKey(num, gen, false), data);
    }
    async decryptValue(v, num, gen) {
      const walk = async x => {
        if (x instanceof Str) return new Str(await this.decryptBytes(x.b, num, gen, this.E.strCfm));
        if (Array.isArray(x)) { const o = []; for (const y of x) o.push(await walk(y)); return o; }
        if (x instanceof Dict) { const d = new Dict(); for (const [k, y] of x.m) d.set(k, await walk(y)); return d; }
        return x;
      };
      if (v instanceof Stream) {
        const type = nm(v.dict.get('Type'));
        if (type === 'XRef') return v;   // cross-reference streams are never encrypted
        const dict = await walk(v.dict);
        const meta = type === 'Metadata' && this.E.EncryptMetadata === false;
        let filters = dict.get('Filter');
        const hasCrypt = (Array.isArray(filters) ? filters : [filters]).some(f => nm(f) === 'Crypt');
        if (hasCrypt) {
          // a Crypt filter names its own cipher; take it out, since the output isn't encrypted
          const arr = Array.isArray(filters) ? filters : [filters], parms = dict.get('DecodeParms'), parr = Array.isArray(parms) ? parms : [parms];
          const k = arr.findIndex(f => nm(f) === 'Crypt'), p = this.get(parr[k]), name = p instanceof Dict ? nm(p.get('Name')) : 'Identity';
          arr.splice(k, 1); parr.splice(k, 1);
          if (arr.length) dict.set('Filter', arr); else dict.m.delete('Filter');
          if (parr.some(Boolean)) dict.set('DecodeParms', parr); else dict.m.delete('DecodeParms');
          const data = name === 'Identity' ? v.data : await this.decryptBytes(v.data, num, gen, this.E.stmCfm);
          return new Stream(dict, data);
        }
        return new Stream(dict, meta ? v.data : await this.decryptBytes(v.data, num, gen, this.E.stmCfm));
      }
      return walk(v);
    }
  }

  // Writes every object back out, unencrypted, with a fresh cross-reference table.
  function writePdf(doc) {
    const parts = [], offsets = new Map();
    let size = 0;
    const put = b => { parts.push(b); size += b.length; };
    put(ascii('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n'));
    let max = 0;
    const nums = [...doc.xref.keys()].sort((a, b) => a - b);
    for (const num of nums) {
      const e = doc.xref.get(num);
      if (e.t === 0 || num === doc.encNum) continue;
      let v;
      try { v = doc.fetch(num); } catch (err) { continue; }
      if (v === null || v === undefined) continue;
      if (v instanceof Stream && ['XRef', 'ObjStm'].includes(nm(v.dict.get('Type')))) continue;
      const gen = e.t === 1 ? (e.gen || 0) : 0;
      offsets.set(num, [size, gen]); max = Math.max(max, num);
      if (v instanceof Stream) {
        const d = new Dict();
        for (const [k, x] of v.dict.m) d.set(k, k === 'Length' ? v.data.length : x);
        if (!d.has('Length')) d.set('Length', v.data.length);
        put(ascii(num + ' ' + gen + ' obj\n' + ser(d) + '\nstream\n')); put(v.data); put(ascii('\nendstream\nendobj\n'));
      } else put(ascii(num + ' ' + gen + ' obj\n' + ser(v) + '\nendobj\n'));
    }
    const xref = size;
    let x = 'xref\n0 ' + (max + 1) + '\n0000000000 65535 f \n';
    for (let n = 1; n <= max; n++) { const o = offsets.get(n); x += o ? String(o[0]).padStart(10, '0') + ' ' + String(o[1]).padStart(5, '0') + ' n \n' : '0000000000 65535 f \n'; }
    const tr = new Dict().set('Size', max + 1).set('Root', doc.trailer.get('Root'));
    const info = doc.trailer.get('Info');
    if (info instanceof Ref && info.num !== doc.encNum && offsets.has(info.num)) tr.set('Info', info);
    if (doc.trailer.get('ID')) tr.set('ID', doc.trailer.get('ID'));
    x += 'trailer\n' + ser(tr) + '\nstartxref\n' + xref + '\n%%EOF\n';
    put(ascii(x));
    const out = new Uint8Array(size);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // Is this PDF locked? 'none', 'restrictions' (opens without a password), or 'password'.
  async function inspect(bytes) {
    const d = new LockedDoc(bytes, 'file.pdf');
    try { await d.openWith(''); } catch (e) { if (e instanceof PasswordError) return 'password'; throw e; }
    return d.plain ? 'none' : 'restrictions';
  }
  // Returns the unlocked PDF's bytes, or throws PasswordError.
  async function unlock(bytes, password) {
    const d = await new LockedDoc(bytes, 'file.pdf').openWith(password || '');
    if (d.plain) return { bytes, wasLocked: false, pages: d.pages.length };
    return { bytes: writePdf(d), wasLocked: true, restricted: d.restricted, pages: d.pages.length, revision: d.E.R, cipher: d.E.R >= 5 ? 'AES-256' : d.E.stmCfm === 'AESV2' ? 'AES-128' : 'RC4 ' + (d.E.R === 2 ? 40 : d.E.Length) + '-bit' };
  }

  return { inspect, unlock, PasswordError, md5, rc4 };
})();
