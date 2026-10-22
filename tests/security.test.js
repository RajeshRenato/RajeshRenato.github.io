'use strict';
// Hostile input for the pages that take data from other people: malformed and
// oversized messages, markup in names and text, and messages out of order.

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const EVIL = '<img src=x onerror=alert(1)>';
const JUNK = ['null', '5', '"text"', '[]', '{}', 'not json', '{"t":"__proto__"}', '{"t":"constructor"}', '{"t":{"x":1}}'];

// Records every element the page touches, so we can look for markup that got in.
function watched(rel, hash) {
  const page = createPage(rel, hash);
  page.run(`globalThis.__els = [];
    const ce = document.createElement; document.createElement = t => { const e = ce(t); __els.push(e); return e; };
    const gi = document.getElementById; document.getElementById = id => { const e = gi(id); __els.push(e); return e; };`);
  return page;
}
function leaked(page) {
  return JSON.parse(page.run(`(() => {
    const bad = [], seen = new Set();
    const walk = e => {
      if (!e || typeof e !== 'object' || seen.has(e)) return;
      seen.add(e);
      if (/<img|onerror|<script/i.test(String(e.innerHTML || ''))) bad.push(String(e.innerHTML).slice(0, 100));
      (e.children || []).forEach(walk);
    };
    __els.forEach(walk);
    return JSON.stringify(bad);
  })()`));
}

test('Secret Chat survives hostile messages, and nothing in them becomes markup', () => {
  const a = watched('secret-chat/index.html'), b = watched('secret-chat/index.html');
  const c = channelPair();
  a.sandbox.ch = c.a; b.sandbox.ch = c.b;
  a.run(`role = 'h'; attach(ch)`); b.run(`role = 'g'; attach(ch)`);
  c.pump();
  const raw = m => { c.a.send(m); c.pump(); };
  for (const j of JUNK) raw(j);
  raw(JSON.stringify({ t: 'msg', id: { x: 1 }, text: ['a', 'b'] }));
  raw(JSON.stringify({ t: 'msg', id: 'm1', text: EVIL, secret: true, ttl: -5 }));
  raw(JSON.stringify({ t: 'msg', id: 'm2', text: 'A'.repeat(50000) }));
  raw(JSON.stringify({ t: 'file', id: 'f1', name: EVIL, size: -10, mime: 'image/svg+xml' }));
  raw(JSON.stringify({ t: 'file', id: 'f2', name: 'x', size: 1e15 }));
  c.a.send(new ArrayBuffer(64)); c.pump();
  raw(JSON.stringify({ t: 'gone', id: 'nothing' }));
  raw(JSON.stringify({ t: 'seen', id: '__proto__' }));
  assert.strictEqual(b.run('open'), true, 'the chat is still open');
  const text = page => JSON.parse(page.run(`JSON.stringify([...msgs.values()].map(r => r.el.children.map(x => x.textContent).join('')))`));
  assert.ok(text(b).every(t => t.length <= 20100), 'long messages are cut to 20,000 characters');
  assert.ok(text(b).some(t => t.startsWith('AAAA')), 'the long message itself still arrives');
  assert.deepStrictEqual(leaked(b), []);
  a.run(`$('input').value = 'still works'; sendText()`);
  c.pump();
  assert.ok(text(b).some(t => t.includes('still works')), 'normal messages still arrive afterwards');
});

test('Video Call survives hostile messages, and chat text never becomes markup', () => {
  const p = watched('video-call/index.html');
  for (const j of JUNK) p.run(`receive(${JSON.stringify(j)})`);
  p.run(`receive(${JSON.stringify(JSON.stringify({ t: 'chat', text: EVIL }))})`);
  p.run(`receive(${JSON.stringify(JSON.stringify({ t: 'chat', text: 'A'.repeat(9000) }))})`);
  p.run(`receive(${JSON.stringify(JSON.stringify({ t: 'state', cam: EVIL, mic: [] }))})`);
  assert.deepStrictEqual(leaked(p), []);
});

test('Watch Party clamps hostile clock values and escapes names, files, and chat', () => {
  const host = watched('watch-party/index.html'), guest = watched('watch-party/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('watch-party', 'Ana'); r.addChannel(c); startParty(r);`);
  guest.run(`startParty(Room.joinChannel(ch, ${JSON.stringify(EVIL)}))`);
  for (let k = 0; k < 3; k++) c.pump();
  const send = m => { guest.run(`room.send(${JSON.stringify(m)})`); for (let k = 0; k < 3; k++) c.pump(); };
  send({ t: 'status', file: EVIL, duration: 'x', state: EVIL });
  send({ t: 'chat', text: EVIL });
  send({ t: 'react', e: EVIL });
  send({ t: 'cmd', playing: true, time: 1e308, rate: 1000 });
  send({ t: 'cmd', time: 'NaN', rate: -4 });
  for (const j of JUNK) { c.b.send(j); c.pump(); }
  const clock = JSON.parse(host.run('JSON.stringify(clock)'));
  assert.ok(Number.isFinite(clock.time) && clock.time >= 0, 'time stays a real number: ' + clock.time);
  assert.ok(clock.rate >= 0.25 && clock.rate <= 4, 'speed stays in range: ' + clock.rate);
  assert.ok(host.run('room.players.every(p => p.name.length <= 16)'), 'names are cut to 16 characters');
  assert.deepStrictEqual(leaked(host), []);
  assert.deepStrictEqual(leaked(guest), []);
});

test('player names with markup are escaped in a room game (Chess)', () => {
  const host = watched('chess/index.html'), guest = createPage('chess/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('chess', 'Ana'); r.addChannel(c);`);
  guest.run(`attach(Room.joinChannel(ch, ${JSON.stringify(EVIL)}))`);
  c.pump();
  host.run('attach(r)');
  c.pump();
  host.run('render()');
  assert.deepStrictEqual(leaked(host), []);
});

test('Secret Note rejects damaged and hostile links without breaking', async () => {
  const p = createPage('secret-note/index.html');
  for (const code of ['', '1kz.', '1kz.a.b', '1kz.!!!.@@@.###', '1pz.AAAA.AAAA.AAAA', '9xx.a.b.c', '1kr.' + 'A'.repeat(5000) + '.AA.AA']) {
    const r = await p.run(`decryptNote(${JSON.stringify(code)}).then(() => 'opened', e => 'refused: ' + e.message)`);
    assert.match(r, /^refused/, code.slice(0, 20) + ' should be refused');
  }
});
