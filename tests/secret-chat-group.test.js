'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const tick = () => new Promise(r => setTimeout(r, 5));

// A host (Ana) and two guests (Bo, Cy), joined by in-memory channels.
async function group() {
  const host = createPage('secret-chat/index.html');
  const guests = [createPage('secret-chat/index.html'), createPage('secret-chat/index.html')];
  const chans = [channelPair(), channelPair()];
  await host.run('GROUP.makeKeys()');
  host.run(`globalThis.r = Room.create('secret-chat-group', 'Ana')`);
  for (let i = 0; i < 2; i++) {
    await guests[i].run('GROUP.makeKeys()');
    host.sandbox.c = chans[i].a; host.run('r.addChannel(c)');
    guests[i].sandbox.ch = chans[i].b;
  }
  host.run('GROUP.startWithRoom(r)');
  guests.forEach((g, i) => g.run(`GROUP.startWithRoom(Room.joinChannel(ch, ${JSON.stringify(['Bo', 'Cy'][i])}))`));
  const settle = async () => { for (let k = 0; k < 12; k++) { for (const c of chans) c.pump(); await tick(); } };
  await settle();
  return { host, guests, chans, settle, all: [host, ...guests] };
}
const code = page => page.run(`GROUP.g.code && GROUP.g.code.words.join(' ') + ' ' + GROUP.g.code.digits`);
const texts = page => json(page, `[...msgs.values()].map(r => r.el.children.map(x => x.textContent).join('|'))`);

test('everyone ends up with the same members and the same group code', async () => {
  const { all } = await group();
  for (const p of all) assert.strictEqual(p.run('GROUP.g.members.size'), 3);
  assert.ok(code(all[0]));
  assert.strictEqual(code(all[1]), code(all[0]));
  assert.strictEqual(code(all[2]), code(all[0]));
});

test('a message reaches every member, with the sender\'s name, and hidden and disappearing flags survive', async () => {
  const { host, guests, settle } = await group();
  guests[0].run(`$('input').value = 'wifi: Harbor-7731'; setSecret(true); $('timer').value = '300'`);
  await guests[0].run('GROUP.sendText()');
  await settle();
  for (const p of [host, guests[1]]) {
    const t = texts(p);
    assert.ok(t.some(x => x.includes('Bo') && x.includes('wifi: Harbor-7731')), 'got: ' + JSON.stringify(t));
    assert.ok(p.run(`[...msgs.values()].some(r => r.secret && r.ttl === 300)`));
  }
});

test('the host passes messages on but can only open the copy sealed for it', async () => {
  const { host, guests } = await group();
  guests[0].run(`$('input').value = 'x'`);
  const env = await guests[0].run(`GROUP.seal({ k: 'msg', id: 'z', text: 'only for Cy' })`);
  const bo = guests[0].run('GROUP.g.me'), cy = guests[1].run('GROUP.g.me');
  host.sandbox.env = env;
  assert.strictEqual((await host.run(`GROUP.open(env, ${bo})`)).text, 'only for Cy', 'the host is a member, so its own copy opens');
  host.run(`globalThis.forCy = { t: 'e', iv: env.iv, ct: env.ct, keys: { 0: env.keys[${cy}] } }`);
  assert.strictEqual(await host.run(`GROUP.open(forCy, ${bo})`), null, "Cy's copy doesn't open for the host");
  host.run(`globalThis.noHost = { t: 'e', iv: env.iv, ct: env.ct, keys: { ${cy}: env.keys[${cy}] } }`);
  assert.strictEqual(await host.run(`GROUP.open(noHost, ${bo})`), null);
});

test('a message can\'t be passed off as someone else\'s', async () => {
  const { guests } = await group();
  const env = await guests[0].run(`GROUP.seal({ k: 'msg', id: 'f', text: 'from Bo' })`);
  guests[1].sandbox.env = env;
  assert.strictEqual((await guests[1].run(`GROUP.open(env, ${guests[0].run('GROUP.g.me')})`)).text, 'from Bo');
  assert.strictEqual(await guests[1].run('GROUP.open(env, 0)'), null, 'claiming it came from the host fails');
});

test('a swapped key changes the group code, which is how a listener is caught', async () => {
  const { host, guests } = await group();
  const honest = code(guests[1]);
  const fake = createPage('secret-chat/index.html');
  await fake.run('GROUP.makeKeys()');
  const fakePub = fake.run('GROUP.g.pub');
  const list = json(host, `[...GROUP.g.members.values()].map(m => ({ id: m.id, name: m.name, color: m.color, pub: m.pub }))`);
  const bo = guests[0].run('GROUP.g.me');
  const tampered = list.map(m => (m.id === bo ? Object.assign({}, m, { pub: fakePub }) : m));
  guests[1].sandbox.tampered = tampered;
  await guests[1].run('GROUP.setMembers(tampered)');
  assert.notStrictEqual(code(guests[1]), honest);
  assert.notStrictEqual(code(guests[1]), code(guests[0]), "Cy's code no longer matches Bo's");
});

test('a late joiner changes the code and can\'t read what was sent before', async () => {
  const { host, guests, chans, settle } = await group();
  const before = code(host);
  host.run(`$('input').value = 'before Di'`);
  await host.run('GROUP.sendText()');
  await settle();
  const di = createPage('secret-chat/index.html');
  await di.run('GROUP.makeKeys()');
  const c = channelPair();
  chans.push(c);
  host.sandbox.c = c.a; host.run('r.addChannel(c)');
  di.sandbox.ch = c.b; di.run(`GROUP.startWithRoom(Room.joinChannel(ch, 'Di'))`);
  await settle();
  assert.notStrictEqual(code(host), before);
  assert.strictEqual(code(di), code(host));
  assert.ok(!texts(di).some(t => t.includes('before Di')));
  host.run(`$('input').value = 'after Di'`);
  await host.run('GROUP.sendText()');
  await settle();
  assert.ok(texts(di).some(t => t.includes('after Di')));
});

test('a file arrives byte for byte, and only the host can wipe everyone\'s screen', async () => {
  const { host, guests, chans, settle } = await group();
  const bytes = Array.from({ length: 30000 }, (_, i) => (i * 7) % 256);
  guests[1].run(`globalThis.got = null; const fb = fileBubble; fileBubble = (id, meta, mine, who) => { const r = fb(id, meta, mine, who); const d = r.done; r.done = b => { got = b; d(b); }; return r; }`);
  guests[0].sandbox.bytes = bytes;
  const sending = guests[0].run(`GROUP.sendFiles([new Blob([new Uint8Array(bytes)])]) || 0`);
  for (let k = 0; k < 40; k++) { await settle(); if (guests[1].run('!!got')) break; }
  const out = await guests[1].run('got.arrayBuffer().then(b => Array.from(new Uint8Array(b)))');
  assert.strictEqual(out.length, bytes.length);
  assert.ok(out.every((v, i) => v === bytes[i]));

  guests[0].run(`room => 0`);
  chans[0].b.send(JSON.stringify({ t: 'wipe' }));
  await settle();
  assert.ok(guests[1].run('msgs.size') > 0, 'a guest sending "wipe" is ignored');
  host.run('GROUP.wipeAll()');
  await settle();
  assert.strictEqual(guests[1].run('msgs.size') === 0 || guests[1].run(`[...msgs.values()].every(r => r.el.className.includes('gone'))`), true);
  await sending;
});
