'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');
const { File } = require('buffer');

function page() { const p = createPage('bank-insights/index.html'); p.sandbox.File = File; return p; }
const rows = (p, expr) => JSON.parse(p.run(`JSON.stringify((${expr}).map(t => [t.date.getFullYear() + '-' + (t.date.getMonth() + 1) + '-' + t.date.getDate(), t.dir, t.amt, t.bal]))`));

test('separate withdrawal and deposit columns, with a preamble and Indian number grouping', () => {
  const p = page();
  p.sandbox.CSV = 'HDFC BANK Ltd.\nStatement of account\n\nDate,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\n' +
    '01/04/26,UPI-SWIGGY-swiggy@icici-ICIC0DC0099-610000001-UPI,1,01/04/26,450.00,,"49,550.00"\n' +
    '03/04/26,NEFT CR-ACME0000123-ACME TECHNOLOGIES PVT LTD-SALARY APR,2,03/04/26,,"85,000.00","1,34,550.00"\n';
  assert.deepStrictEqual(rows(p, 'fromTable(parseCsv(CSV))'), [['2026-4-1', 'out', 450, 49550], ['2026-4-3', 'in', 85000, 134550]]);
});

test('one amount column with a Dr/Cr column, month names in dates, quoted commas', () => {
  const p = page();
  p.sandbox.CSV = 'Transaction Date,Transaction Remarks,Amount,Type,Balance\n' +
    '05-Jun-2026,"BIL/ONL/000123/AIRTEL/Prepaid, recharge",599.00,DR,10401.00\n' +
    '06-Jun-2026,INT PD 01-04-2026 TO 30-06-2026,120.50,CR,10521.50\n';
  assert.deepStrictEqual(rows(p, 'fromTable(parseCsv(CSV))'), [['2026-6-5', 'out', 599, 10401], ['2026-6-6', 'in', 120.5, 10521.5]]);
});

test('a signed amount with no type, newest first: the balance decides, and rows come out in date order', () => {
  const p = page();
  p.sandbox.CSV = 'Date;Description;Amount;Balance\n' +
    '12/05/2026;REFUND AMAZON;250.00;1250.00\n' +
    '11/05/2026;ZOMATO;-300.00;1000.00\n' +
    '10/05/2026;OPENING;100.00;1300.00\n';
  assert.deepStrictEqual(rows(p, 'fromTable(parseCsv(CSV))'), [['2026-5-10', 'out', 100, 1300], ['2026-5-11', 'out', 300, 1000], ['2026-5-12', 'in', 250, 1250]]);
});

test('month-first US dates are recognised when a day is over 12', () => {
  const p = page();
  p.sandbox.CSV = 'Date,Description,Debit,Credit,Balance\n07/02/2026,COFFEE,4.50,,95.50\n07/25/2026,PAYCHECK,,1000.00,1095.50\n';
  assert.deepStrictEqual(rows(p, 'fromTable(parseCsv(CSV))').map(r => r[0]), ['2026-7-2', '2026-7-25']);
});

test('an Excel download is read through its shared strings', async () => {
  const p = page();
  const o = JSON.parse(await p.run(`(async () => {
    const enc = new TextEncoder();
    const shared = '<sst><si><t>Txn Date</t></si><si><t>Description</t></si><si><t>Debit</t></si><si><t>Credit</t></si><si><t>Balance</t></si><si><t>UPI/DR/1234/BLINKIT/YESB/blinkit@ybl</t></si></sst>';
    const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>' +
      '<row r="2"><c r="A2"><v>46150</v></c><c r="B2" t="s"><v>5</v></c><c r="C2"><v>812.4</v></c><c r="E2"><v>5000</v></c></row></sheetData></worksheet>';
    const blob = Zip.build([{ name: 'xl/sharedStrings.xml', data: enc.encode(shared) }, { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) }]);
    const t = fromTable(await parseXlsx(new File([blob], 'x.xlsx')));
    categorise(t[0], {});
    return JSON.stringify([t.length, t[0].date.getFullYear(), t[0].dir, t[0].amt, t[0].payee, t[0].cat]);
  })()`));
  assert.deepStrictEqual(o, [1, 2026, 'out', 812.4, 'Blinkit', 'Groceries']);
});

test('PDF statements: cells by column position, wrapped narrations joined', () => {
  const p = page();
  const it = (x, str) => ({ x, y: 0, w: str.length * 4, h: 8, str });
  p.sandbox.PAGES = [{ lines: [
    { items: [it(20, 'Date'), it(80, 'Narration'), it(300, 'Withdrawal'), it(380, 'Deposit'), it(460, 'Balance')] },
    { items: [it(20, '01/06/26'), it(80, 'UPI-UBER INDIA-uber@axisbank-'), it(310, '245.00'), it(465, '9,755.00')] },
    { items: [it(80, 'UTIB0000000-6123-UPI')] },
    { items: [it(20, '02/06/26'), it(80, 'SALARY JUNE'), it(388, '50,000.00'), it(462, '59,755.00')] },
  ] }];
  const o = JSON.parse(p.run(`JSON.stringify(fromPdf(pdfRows(PAGES)).map(t => { categorise(t, {}); return [t.dir, t.amt, t.bal, t.payee, t.cat]; }))`));
  assert.deepStrictEqual(o, [['out', 245, 9755, 'Uber', 'Travel'], ['in', 50000, 59755, 'Salary June', 'Salary']]);
});

test('merchants and categories from common narrations', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify([
    'UPI-RAMESH KUMAR-ramesh.k@oksbi-SBIN0001234-610000002-UPI', 'ACH D- BAJAJ FINANCE LTD-EMI', 'POS 512345XXXXXX1234 BIGBASKET',
    'NETFLIX.COM SI', 'ATM WDL 23-04-26 MG ROAD', 'UPI/412345/9876543210@ybl/Payment from Ph', 'ACH D- ZERODHA BROKING-SIP'
  ].map(d => { const t = { desc: d, dir: 'out', amt: 100 }; categorise(t, {}); return [t.payee, t.cat]; }))`));
  assert.deepStrictEqual(o, [['Ramesh Kumar', 'Sent to people'], ['Bajaj Finance', 'Loans and EMIs'], ['Bigbasket', 'Groceries'],
    ['Netflix', 'Subscriptions and entertainment'], ['ATM cash', 'Cash'], ['9876543210@ybl', 'Other UPI payments'], ['Zerodha Broking', 'Investments']]);
});

test('a category you pick sticks to that merchant', () => {
  const p = page();
  const cat = p.run(`(() => { const t = { desc: 'UPI-SHARMA STORES-sharma@okaxis-UTIB0-1-UPI', dir: 'out', amt: 80 }; categorise(t, { 'sharma@okaxis': 'Groceries' }); return t.cat; })()`);
  assert.strictEqual(cat, 'Groceries');
});

test('repeats every month: same place, about the same amount, three months or more', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify(recurring([
    ...[1, 2, 3, 4].map(m => ({ date: new Date(2026, m, 5), amt: 649, payee: 'Netflix', vpa: '', cat: 'Subscriptions and entertainment' })),
    ...[1, 2, 3].map(m => ({ date: new Date(2026, m, 9), amt: 400 + m * 300, payee: 'Swiggy', vpa: 'swiggy@icici', cat: 'Food delivery' })),
    ...[1, 2].map(m => ({ date: new Date(2026, m, 1), amt: 22000, payee: 'Rent', vpa: '', cat: 'Rent and home' })),
  ]).map(r => [r.payee, r.amt, r.months]))`));
  assert.deepStrictEqual(o, [['Netflix', 649, 4]]);
});

test('UPI IDs stop at the hyphens banks put between narration parts', () => {
  const p = page();
  assert.strictEqual(p.run(`payee('UPI-SHARMA STORES-sharma@okaxis-UTIB0-1-UPI').vpa`), 'sharma@okaxis');
});
