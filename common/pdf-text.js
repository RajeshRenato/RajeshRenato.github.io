// Reads the text out of a PDF, line by line with positions, using Mozilla's pdf.js (common/pdfjs).
// Shared by Bank Statement Insights and Speed Reader.
'use strict';

const PdfText = (() => {
  let lib = null;
  async function load() {
    if (!lib) {
      lib = await import('../common/pdfjs/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = '../common/pdfjs/pdf.worker.min.mjs';
    }
    return lib;
  }
  // Opens a PDF. askPassword(wrongBefore) returns a password, or null to give up.
  async function open(bytes, askPassword) {
    const pdfjs = await load();
    let password = '', wrong = false;
    for (;;) {
      try {
        return await pdfjs.getDocument({ data: bytes.slice(), password, isEvalSupported: false }).promise;
      } catch (e) {
        if (e && e.name === 'PasswordException') {
          password = askPassword ? await askPassword(wrong) : null;
          if (password === null) throw new Error('The PDF needs its password.');
          wrong = true;
          continue;
        }
        throw e;
      }
    }
  }
  // Each page as lines: [{ y, items: [{ x, w, str }] }], top to bottom, items left to right.
  async function pages(doc, onProgress = () => { }) {
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4], y: vp.height - it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]), str: it.str }));
      items.sort((a, b) => a.y - b.y || a.x - b.x);
      const lines = [];
      for (const it of items) {
        const L = lines[lines.length - 1];
        if (L && Math.abs(L.y - it.y) <= Math.max(2, it.h * 0.35)) L.items.push(it);
        else lines.push({ y: it.y, items: [it] });
      }
      for (const L of lines) L.items.sort((a, b) => a.x - b.x);
      out.push({ width: vp.width, height: vp.height, lines });
      onProgress(p, doc.numPages);
      page.cleanup();
    }
    return out;
  }
  // Plain text with paragraphs, for reading.
  function toText(pgs) {
    const paras = [];
    let cur = '';
    for (const pg of pgs) {
      let lastY = null, gap = 0;
      for (const L of pg.lines) {
        const text = L.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const h = L.items[0].h || 10;
        if (lastY !== null) gap = L.y - lastY;
        if (lastY !== null && gap > h * 1.8 && cur) { paras.push(cur); cur = ''; }
        cur = cur ? (cur.endsWith('-') ? cur.slice(0, -1) + text : cur + ' ' + text) : text;
        lastY = L.y;
      }
      if (cur && /[.!?"”]$/.test(cur)) { paras.push(cur); cur = ''; }
    }
    if (cur) paras.push(cur);
    return paras.join('\n\n');
  }
  return { load, open, pages, toText };
})();
