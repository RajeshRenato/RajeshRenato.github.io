'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => createPage('speed-reader/index.html');

test('words, sentences and paragraphs, with abbreviations and very long words handled', () => {
  const p = page();
  p.sandbox.TXT = 'Hello there, Dr. Smith. It is 2026!\n\nNew para with a supercalifragilisticexpialidocious word.';
  const o = JSON.parse(p.run(`(() => { const t = tokenize(TXT); return JSON.stringify(t.map(x => [x.w, x.para, x.sentence])); })()`));
  assert.deepStrictEqual(o.slice(0, 7), [['Hello', 0, 0], ['there,', 0, 0], ['Dr.', 0, 0], ['Smith.', 0, 0], ['It', 0, 1], ['is', 0, 1], ['2026!', 0, 1]]);
  assert.deepStrictEqual(o[7], ['New', 1, 3]);
  assert.ok(o.every(([w]) => w.length <= 18), 'long words are cut to fit');
  assert.strictEqual(o.filter(([w]) => /^(supercal|listic|ocious)/.test(w)).length >= 2, true);
});

test('pauses: longer at full stops, commas, paragraph ends and long words; not after "Dr."', () => {
  const p = page();
  const o = JSON.parse(p.run(`(() => { const t = tokenize('A cat, the Dr. said. Extraordinarily.\\n\\nNext'); return JSON.stringify(t.map((x, k) => +weight(x, t[k + 1]).toFixed(2))); })()`));
  const [a, cat, the, dr, said, extra] = o;
  assert.ok(a < 1 && the < 1, 'tiny words are quicker');
  assert.strictEqual(cat, 1.5);
  assert.ok(dr < 1.5, 'an abbreviation is not a sentence end');
  assert.strictEqual(said, 2.2);
  assert.ok(extra > 3.5, 'a long word ending a paragraph waits longest: ' + extra);
});

test('the red letter sits a little left of the middle, skipping leading punctuation', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify(['a', 'the', 'reading', '"Hello,', 'extraordinary', 'internationalisation'].map(w => w[orp(w)]))`));
  assert.deepStrictEqual(o, ['a', 'h', 'a', 'e', 'r', 'r']);
});

test('EPUB chapters are read in spine order and DRM books are refused', async () => {
  const p = createPage('speed-reader/index.html');
  p.sandbox.File = require('buffer').File;
  p.sandbox.DOMParser = class { parseFromString(s) { const text = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return { querySelectorAll: () => [], body: { querySelectorAll: () => [], textContent: text } }; } };
  const o = JSON.parse(await p.run(`(async () => {
    const enc = new TextEncoder(), f = (name, s) => ({ name, data: enc.encode(s) });
    const base = [f('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'),
      f('OEBPS/content.opf', '<package><metadata><dc:title>Short Book</dc:title></metadata><manifest><item id="c2" href="ch2.xhtml"/><item id="c1" href="ch1.xhtml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'),
      f('OEBPS/ch1.xhtml', '<html><body><p>First chapter.</p></body></html>'), f('OEBPS/ch2.xhtml', '<html><body><p>Second chapter.</p></body></html>')];
    const ok = await readEpub(new File([Zip.build(base)], 'b.epub'));
    let drm = 'opened';
    try { await readEpub(new File([Zip.build(base.concat(f('META-INF/encryption.xml', '<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>')))], 'd.epub')); } catch (e) { drm = e.message; }
    return JSON.stringify({ title: ok.title, text: ok.text, drm });
  })()`));
  assert.strictEqual(o.title, 'Short Book');
  assert.strictEqual(o.text, 'First chapter.\n\nSecond chapter.');
  assert.match(o.drm, /DRM/);
});
