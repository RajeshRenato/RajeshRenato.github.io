// A tiny PDF writer, shared by Invoice Maker and Passport Photo.
// Pages hold text in the built-in Helvetica fonts, lines, filled boxes, and JPEG images.
// Measurements are in points (1/72 inch), with y measured from the top of the page.
'use strict';

const PdfLite = (() => {
  // Helvetica and Helvetica-Bold advance widths for ASCII 32-126, in 1/1000 of the font size
  const REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
    667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556,
    333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722,
    667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611,
    389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  // the few non-ASCII characters people type most, in the WinAnsi encoding the fonts use
  const WIN = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151, '™': 153, '•': 149 };
  const winByte = ch => {
    const c = ch.codePointAt(0);
    if (c >= 32 && c < 127) return c;
    if (WIN[ch]) return WIN[ch];
    if (c >= 160 && c <= 255) return c;
    return 63;   // anything the fonts can't show becomes '?'
  };
  function width(text, size, bold) {
    const t = bold ? BOLD : REG;
    let w = 0;
    for (const ch of String(text)) { const c = winByte(ch); w += c >= 32 && c < 127 ? t[c - 32] : c === 63 ? t[31] : 556; }
    return w * size / 1000;
  }
  // line breaks and tabs are handled by layout, so they don't count
  const canShow = text => [...String(text)].every(ch => /[\n\r\t]/.test(ch) || winByte(ch) !== 63 || ch === '?');
  function pdfString(text) {
    let s = '(';
    for (const ch of String(text)) {
      const c = winByte(ch);
      s += c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 127 ? String.fromCharCode(c) : '\\' + c.toString(8).padStart(3, '0');
    }
    return s + ')';
  }
  // breaks text into lines no wider than maxW
  function wrap(text, size, bold, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const tryLine = line ? line + ' ' + word : word;
        if (width(tryLine, size, bold) <= maxW || !line) line = tryLine;
        else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }
  const num = v => (Math.round(v * 100) / 100).toString();
  const rgb = hex => { const n = parseInt(String(hex).replace('#', ''), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(v => num(v)).join(' '); };

  // A page you draw on. w and h are the page size in points.
  function page(w, h) {
    const ops = [], images = [];
    const Y = y => h - y;
    return {
      w, h, ops, images,
      text(x, y, str, { size = 10, bold = false, color = '#000000', align = 'left' } = {}) {
        let tx = x;
        if (align !== 'left') tx -= width(str, size, bold) * (align === 'right' ? 1 : 0.5);
        ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf ' + rgb(color) + ' rg ' + num(tx) + ' ' + num(Y(y)) + ' Td ' + pdfString(str) + ' Tj ET');
      },
      line(x1, y1, x2, y2, { width: lw = 0.6, color = '#000000' } = {}) {
        ops.push(num(lw) + ' w ' + rgb(color) + ' RG ' + num(x1) + ' ' + num(Y(y1)) + ' m ' + num(x2) + ' ' + num(Y(y2)) + ' l S');
      },
      rect(x, y, rw, rh, { fill = null, stroke = null, width: lw = 0.6, dash = null } = {}) {
        let s = 'q ' + (dash ? '[' + dash.join(' ') + '] 0 d ' : '') + num(lw) + ' w ';
        if (fill) s += rgb(fill) + ' rg ';
        if (stroke) s += rgb(stroke) + ' RG ';
        s += num(x) + ' ' + num(Y(y + rh)) + ' ' + num(rw) + ' ' + num(rh) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S') + ' Q';
        ops.push(s);
      },
      // jpeg: { bytes, w, h } with w and h in pixels; placed into the box x, y, iw, ih
      image(jpeg, x, y, iw, ih) {
        // the same image placed several times is stored once
        let im = images.find(e => e.src === jpeg);
        if (!im) { im = { name: 'Im' + images.length, src: jpeg, ...jpeg }; images.push(im); }
        const name = im.name;
        ops.push('q ' + num(iw) + ' 0 0 ' + num(ih) + ' ' + num(x) + ' ' + num(Y(y + ih)) + ' cm /' + name + ' Do Q');
      },
    };
  }

  const enc = new TextEncoder();
  // Writes the pages into a PDF file. info: { title, author }
  function build(pages, info = {}) {
    const objs = [];
    const add = (head, data) => { objs.push({ head, data }); return objs.length; };   // object numbers start at 1
    const catalog = add(''), pagesObj = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const pg of pages) {
      const xo = pg.images.map(im => '/' + im.name + ' ' + add('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>', im.bytes) + ' 0 R').join(' ');
      const content = enc.encode(pg.ops.join('\n'));
      const c = add('<< /Length ' + content.length + ' >>', content);
      kids.push(add('<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox [0 0 ' + num(pg.w) + ' ' + num(pg.h) + '] /Contents ' + c + ' 0 R' +
        ' /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >>' + (xo ? ' /XObject << ' + xo + ' >>' : '') + ' >> >>'));
    }
    objs[catalog - 1].head = '<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>';
    objs[pagesObj - 1].head = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    const infoObj = add('<< /Producer (Rajesh\'s Playground)' + (info.title ? ' /Title ' + pdfString(info.title) : '') + (info.author ? ' /Author ' + pdfString(info.author) : '') + ' >>');
    const parts = [];
    let size = 0;
    const put = b => { const a = typeof b === 'string' ? enc.encode(b) : b; parts.push(a); size += a.length; };
    put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    const offsets = [];
    objs.forEach((o, i) => {
      offsets[i] = size;
      if (o.data) { put((i + 1) + ' 0 obj\n' + o.head + '\nstream\n'); put(o.data); put('\nendstream\nendobj\n'); }
      else put((i + 1) + ' 0 obj\n' + o.head + '\nendobj\n');
    });
    const xref = size;
    put('xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
    put('trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R /Info ' + infoObj + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    const out = new Uint8Array(size);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // A canvas as JPEG bytes for image().
  async function canvasJpeg(cv, quality = 0.92) {
    const blob = await new Promise((ok, no) => cv.toBlob(b => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', quality));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height };
  }

  return { page, build, width, wrap, canShow, canvasJpeg, MM: 72 / 25.4, A4: [595.28, 841.89], LETTER: [612, 792] };
})();
if (typeof module === 'object' && module.exports) module.exports = PdfLite;
