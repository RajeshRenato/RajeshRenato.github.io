'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => createPage('chat-wrapped/index.html');
const ANDROID = [
  '03/01/25, 9:00 am - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.',
  '03/01/25, 9:02 am - Asha: good morning ☀️',
  '03/01/25, 9:10 am - Rohan: morning! haha 😂',
  'and a second line',
  '03/01/25, 11:45 pm - Asha: <Media omitted>',
  '04/01/25, 12:30 am - Rohan: This message was deleted',
  '25/01/25, 2:15 pm - Asha: sorry yaar, love you ❤️',
].join('\n');
const IOS = [
  '[1/3/25, 9:02:11 AM] Asha: hi there',
  '[1/3/25, 9:05:40 AM] Rohan: hello 😂😂',
  '[1/13/25, 10:00:00 PM] Asha: ‎image omitted',
].join('\n');

test('Android export: system notices skipped, multi-line messages joined, media and deleted counted', () => {
  const p = page();
  p.sandbox.T = ANDROID;
  const o = JSON.parse(p.run(`(() => { const m = parseChat(T), a = analyse(m);
    return JSON.stringify({ n: m.length, names: [...new Set(m.map(x => x.name))], second: m[1].body, first: m[0].t.toISOString !== undefined && [m[0].t.getDate(), m[0].t.getMonth(), m[0].t.getHours(), m[0].t.getMinutes()],
      late: [m[2].t.getHours()], asha: a.people.find(x => x.name === 'Asha'), rohan: a.people.find(x => x.name === 'Rohan'), days: a.activeDays }); })()`));
  assert.strictEqual(o.n, 5);
  assert.deepStrictEqual(o.names, ['Asha', 'Rohan']);
  assert.match(o.second, /haha 😂\nand a second line/);
  assert.deepStrictEqual(o.first, [3, 0, 9, 2]);
  assert.deepStrictEqual(o.late, [23]);
  assert.strictEqual(o.asha.media, 1);
  assert.strictEqual(o.rohan.deleted, 1);
  assert.strictEqual(o.days, 3);
});

test('iPhone export with month-first dates', () => {
  const p = page();
  p.sandbox.T = IOS;
  const o = JSON.parse(p.run(`(() => { const m = parseChat(T); return JSON.stringify({ n: m.length, last: [m[2].t.getDate(), m[2].t.getMonth(), m[2].t.getHours()], media: analyse(m).media }); })()`));
  assert.strictEqual(o.n, 3);
  assert.deepStrictEqual(o.last, [13, 0, 22]);
  assert.strictEqual(o.media, 1);
});

test('text that is not a chat is refused', () => {
  const p = page();
  assert.throws(() => p.run(`parseChat('just some notes\\nnothing here')`), /WhatsApp/);
});
