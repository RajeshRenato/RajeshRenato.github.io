'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
// a group of four with a few expenses, built in the page
const SETUP = `globalThis.g = newGroup('Goa trip', 'INR', ['Rajesh', 'Asha', 'Vikram', 'Neha']);
  globalThis.ids = g.people.map(p => p.id);
  const [r, a, v, n] = ids;
  const add = (amt, by, mode, parts) => g.items.push({ id: uid(), kind: 'exp', desc: 'x', amt, by, split: { mode, parts }, date: '2026-10-20', u: Date.now() });
  add(2400000, a, 'equal', { [r]: 1, [a]: 1, [v]: 1, [n]: 1 });
  add(640000, r, 'equal', { [r]: 1, [a]: 1, [v]: 1, [n]: 1 });
  add(180000, v, 'equal', { [r]: 1, [v]: 1 });
  add(500000, n, 'exact', { [a]: 250000, [n]: 250000 });
  add(100001, a, 'shares', { [r]: 2, [v]: 1 });
  add(30000, v, 'percent', { [a]: 33.33, [n]: 66.67 });`;

test('splits add up to the penny, in every mode', () => {
  const page = createPage('split-bill/index.html');
  page.run(SETUP);
  const sums = json(page, `g.items.map(it => Object.values(shareOf(it)).reduce((x, y) => x + y, 0) === it.amt)`);
  assert.deepStrictEqual(sums, [true, true, true, true, true, true]);
  assert.deepStrictEqual(json(page, `Object.values(apportion(100, { a: 1, b: 1, c: 1 })).sort()`), [33, 33, 34]);
  assert.deepStrictEqual(json(page, `shareOf(g.items[4])`), json(page, `({ [ids[0]]: 66667, [ids[2]]: 33334 })`), 'two shares to one: the odd paisa goes to the larger remainder');
  assert.deepStrictEqual(json(page, `[parseAmount('1,234.50', 'INR'), parseAmount('₹ 99', 'INR'), parseAmount('12', 'JPY'), parseAmount('12.5.1', 'INR')]`), [123450, 9900, 12, null]);
  assert.strictEqual(page.run(`fmt(1234567, 'INR')`), '₹12,345.67');
});

test('balances net to zero and the settle-up plan clears every debt in the fewest payments', () => {
  const page = createPage('split-bill/index.html');
  page.run(SETUP);
  const bal = json(page, 'balances(g)');
  assert.strictEqual(Object.values(bal).reduce((a, b) => a + b, 0), 0);
  const plan = json(page, 'settle(balances(g))');
  assert.ok(plan.length <= 3, 'four people need at most three payments: ' + plan.length);
  const after = { ...bal };
  for (const t of plan) { after[t.from] += t.amt; after[t.to] -= t.amt; }
  assert.ok(Object.values(after).every(v => v === 0), 'after the payments everyone is square');
  // recording those payments settles the group
  page.run(`for (const t of settle(balances(g))) g.items.push({ id: uid(), kind: 'pay', from: t.from, to: t.to, amt: t.amt, date: '2026-10-21', u: Date.now() })`);
  assert.deepStrictEqual(json(page, 'settle(balances(g))'), []);
  assert.strictEqual(json(page, 'stats(g).total'), 3850001, 'payments are not spending');
});

test('a shared link carries the group, and merging keeps the newer edit and deletions', async () => {
  const page = createPage('split-bill/index.html');
  page.run(SETUP);
  const code = await page.run('encodeGroup(g)');
  assert.ok(/^[zj][\w-]+$/.test(code) && code.length < 2500, 'a compact link: ' + code.length);
  page.run(`globalThis.code = ${JSON.stringify(code)}`);
  const back = await page.run('decodeGroup(code).then(x => JSON.stringify(balances(x)))');
  assert.strictEqual(back, JSON.stringify(json(page, 'balances(g)')));
  // a friend edits one expense and deletes another; I add one of my own
  page.run(`globalThis.theirs = JSON.parse(JSON.stringify(g)); theirs.items[0].amt = 2000000; theirs.items[0].u = Date.now() + 1000; theirs.items[1].del = true; theirs.items[1].u = Date.now() + 1000;
    g.items.push({ id: 'mine', kind: 'exp', desc: 'Snacks', amt: 40000, by: ids[0], split: { mode: 'equal', parts: { [ids[0]]: 1, [ids[1]]: 1 } }, date: '2026-10-22', u: Date.now() });
    globalThis.m = mergeGroup(g, theirs);`);
  assert.deepStrictEqual(json(page, `[m.items.find(i => i.id === g.items[0].id).amt, !!m.items.find(i => i.id === g.items[1].id).del, !!m.items.find(i => i.id === 'mine')]`), [2000000, true, true]);
});

test('a hostile link is refused or shown as plain text', async () => {
  const page = createPage('split-bill/index.html');
  const bad = async obj => { page.run(`globalThis.payload = ${JSON.stringify(JSON.stringify(obj))}`); return page.run(`(async () => { try { await decodeGroup('j' + b64u(new TextEncoder().encode(payload))); return 'accepted'; } catch (e) { return 'refused'; } })()`); };
  assert.strictEqual(await bad({ v: 1, g: { id: 'x', name: 'n', cur: 'XXX', people: [], items: [] } }), 'refused', 'unknown currency');
  assert.strictEqual(await bad({ v: 1, g: { id: 'x', name: 'n', cur: 'INR', people: [{ id: 'a', name: 'A' }], items: [{ id: 'i', kind: 'exp', amt: -5, by: 'a', split: { mode: 'equal', parts: {} } }] } }), 'refused', 'negative amount');
  assert.strictEqual(await bad({ v: 1, g: { id: 'x', name: 'n', cur: 'INR', people: [{ id: 'a', name: 'A' }], items: [{ id: 'i', kind: 'exp', amt: 5, by: 'ghost', split: { mode: 'equal', parts: {} } }] } }), 'refused', 'a payer who isn\'t in the group');
  assert.strictEqual(await bad({ v: 1, g: { id: 'x', name: 'n', cur: 'INR', people: [{ id: 'a', name: 'A' }], items: [{ id: 'i', kind: 'exp', amt: 5, by: 'a', split: { mode: 'eval', parts: {} } }] } }), 'refused', 'unknown split');
  assert.strictEqual(await bad({ v: 1, g: { id: 'x', name: 'n', cur: 'INR', people: Array.from({ length: 101 }, (_, i) => ({ id: 'p' + i, name: 'P' })), items: [] } }), 'refused', 'too many people');
  // markup in names stays text when the group is shown
  page.run(`globalThis.__els = []; const gi = document.getElementById; document.getElementById = id => { const e = gi(id); __els.push(e); return e; };
    const e = newGroup('<img src=x onerror=alert(1)>', 'INR', ['<script>x</script>', 'B']);
    e.items.push({ id: 'i', kind: 'exp', desc: '<img src=x onerror=alert(2)>', amt: 100, by: e.people[0].id, split: { mode: 'equal', parts: { [e.people[0].id]: 1, [e.people[1].id]: 1 } }, date: '2026-10-20', u: 1 });
    S.groups[e.id] = e; S.current = e.id; tab = 'expenses'; render(); tab = 'balances'; render(); tab = 'people'; render();`);
  const leaked = json(page, `__els.filter(e => /<img|<script/i.test(String(e.innerHTML || ''))).map(e => e.innerHTML.slice(0, 60))`);
  assert.deepStrictEqual(leaked, []);
});

test('UPI links and the CSV export', () => {
  const page = createPage('split-bill/index.html');
  page.run(SETUP + `g.people[1].upi = 'asha@okbank';`);
  const link = page.run(`upiLink(g, { from: ids[0], to: ids[1], amt: 210050 })`);
  assert.strictEqual(link, 'upi://pay?pa=asha@okbank&pn=Asha&am=2100.50&cu=INR&tn=Goa%20trip');
  assert.ok(page.run(`!!makeQR(upiLink(g, { from: ids[0], to: ids[1], amt: 210050 }), 'M')`));
});
