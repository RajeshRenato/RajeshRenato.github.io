'use strict';

const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { createPage } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const ITEMS = `[{ desc: 'Design', hsn: '998391', qty: '2', rate: '1500', tax: '18' }, { desc: 'Hosting', hsn: '998315', qty: '1', rate: '999', tax: '12' }]`;

test('GST: CGST and SGST within a state, IGST across states, discount and round-off', () => {
  const page = createPage('invoice-maker/index.html');
  page.run(`globalThis.i = blankInvoice(); i.items = ${ITEMS}; i.discount = '10';`);
  const a = json(page, 'totals(i)');
  assert.deepStrictEqual(a.taxes.map(t => [t.label, t.amt]), [['CGST 6%', 53.95], ['SGST 6%', 53.94], ['CGST 9%', 243], ['SGST 9%', 243]]);
  assert.deepStrictEqual([a.sub, a.discount, a.taxable, a.round, a.total], [3999, 399.9, 3599.1, 0.01, 4193]);
  page.run(`i.igst = true`);
  assert.deepStrictEqual(json(page, 'totals(i).taxes').map(t => [t.label, t.amt]), [['IGST 12%', 107.89], ['IGST 18%', 486]]);
  page.run(`i.taxMode = 'vat'; i.roundOff = false; i.shipping = '50'; i.paid = '1000'`);
  const c = json(page, 'totals(i)');
  assert.deepStrictEqual([c.taxes[0].label, c.total, c.due], ['VAT 12%', 4242.99, 3242.99]);
  page.run(`i.taxMode = 'none'`);
  assert.deepStrictEqual(json(page, '[totals(i).taxes.length, totals(i).total]'), [0, 3649.1]);
});

test('the amount in words, with lakh and crore for rupees', () => {
  const page = createPage('invoice-maker/index.html');
  const w = (v, c) => page.run(`amountInWords(${v}, '${c}')`);
  assert.strictEqual(w(1234.5, 'INR'), 'One Thousand Two Hundred Thirty-Four Rupees and Fifty Paise Only');
  assert.strictEqual(w(10250075, 'INR'), 'One Crore Two Lakh Fifty Thousand Seventy-Five Rupees Only');
  assert.strictEqual(w(1, 'INR'), 'One Rupee Only');
  assert.strictEqual(w(1001, 'USD'), 'One Thousand One Dollars Only');
  assert.strictEqual(w(123456789, 'USD'), 'One Hundred Twenty-Three Million Four Hundred Fifty-Six Thousand Seven Hundred Eighty-Nine Dollars Only');
  assert.strictEqual(w(0.99, 'GBP'), 'Zero Pounds and Ninety-Nine Pence Only');
  assert.strictEqual(page.run(`money(108888, 'INR')`), '₹1,08,888.00');
  assert.strictEqual(page.run(`money(108888, 'INR', true)`), 'Rs. 1,08,888.00', 'the PDF font has no rupee sign');
  assert.strictEqual(page.run(`money(2500, 'EUR', true)`), '€2,500.00');
});

// reads a PDF with the site's own parser
function parsePdf(bytes) {
  const ctx = { TextEncoder, TextDecoder, console, DecompressionStream, Response, Blob };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'common', 'pdf-core.js'), 'utf8') + ';this.PdfDoc = PdfDoc;', ctx);
  const d = new ctx.PdfDoc(bytes, 'x.pdf');
  if (d.scan) d.scan();
  if (d.findPages) d.findPages();
  return d;
}

test('the PDF is a real A4 file with the invoice text in it, and long invoices run onto more pages', async () => {
  const page = createPage('invoice-maker/index.html');
  page.run(`Object.assign(S.biz, { name: 'Renato Design Studio', addr: '42 MG Road\\nBengaluru', tax: '29ABCDE1234F1Z5', upi: '' });
    inv = blankInvoice(); inv.num = 'RDS-0042'; inv.client = { name: 'Asha Textiles', addr: 'Mumbai', tax: '', contact: '' }; inv.items = ${ITEMS};`);
  page.run(`globalThis.pdfOut = null; makePdf().then(b => { pdfOut = b; })`);
  await new Promise(r => setTimeout(r, 50));
  const bytes = new Uint8Array(page.run('pdfOut'));
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4') && text.trimEnd().endsWith('%%EOF'));
  for (const s of ['(TAX INVOICE)', '(No. RDS-0042)', '(Renato Design Studio)', '(Asha Textiles)', '(Rs. 3,000.00)', '(CGST 9%)']) assert.ok(text.includes(s), 'has ' + s);
  const d = parsePdf(bytes);
  assert.strictEqual(d.pages.length, 1);
  assert.deepStrictEqual(Array.from(d.pages[0].inh.MediaBox), [0, 0, 595.28, 841.89]);
  page.run(`inv.items = Array.from({ length: 60 }, (_, k) => ({ desc: 'Line item number ' + (k + 1), hsn: '', qty: '1', rate: '100', tax: '18' })); pdfOut = null; makePdf().then(b => { pdfOut = b; })`);
  await new Promise(r => setTimeout(r, 50));
  const long = parsePdf(new Uint8Array(page.run('pdfOut')));
  assert.ok(long.pages.length >= 2, 'pages: ' + long.pages.length);
  assert.ok(Buffer.from(new Uint8Array(page.run('pdfOut'))).toString('latin1').includes('(Page 2 of '));
});

test('saving numbers invoices in order and keeps clients', () => {
  const page = createPage('invoice-maker/index.html');
  page.run(`S.invoices = []; S.next = 7; S.biz.prefix = 'INV-'; inv = blankInvoice(); fillForm();`);
  assert.strictEqual(page.run('inv.num'), 'INV-0007');
  page.run(`saveInvoice(); inv = blankInvoice();`);
  assert.strictEqual(page.run('inv.num'), 'INV-0008');
  assert.strictEqual(page.run('S.invoices.length'), 1);
});
