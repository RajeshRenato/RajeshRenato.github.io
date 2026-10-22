'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

// Shaped like Chrome's data-channel offer, with documentation addresses.
const OFFER = [
  'v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=extmap-allow-mixed', 'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
  'a=candidate:1467250027 1 udp 2122260223 192.0.2.10 56143 typ host generation 0 network-id 1',
  'a=candidate:2109384021 1 udp 2122129151 0f4a6b1e-3c2d-4e5f-8a9b-0c1d2e3f4a5b.local 61610 typ host generation 0',
  'a=candidate:3907620345 1 udp 2122199807 2001:db8::cafe:11 58009 typ host generation 0',
  'a=candidate:842163049 1 udp 1686052607 203.0.113.7 56143 typ srflx raddr 192.0.2.10 rport 56143 generation 0',
  'a=candidate:3500428147 1 tcp 1518280447 192.0.2.10 9 typ host tcptype active generation 0',
  'a=ice-ufrag:Xq3d', 'a=ice-pwd:k9VbGx2pP0yQz7Rk/Lm8+Tn1', 'a=ice-options:trickle',
  'a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB:3C:D3:10:E2:12:2B:FC:A1:CD:9F:0A:AF',
  'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144',
].join('\r\n') + '\r\n';

test('connection details pack into a short code and come back the same', () => {
  const page = createPage('phone-to-laptop/index.html');
  page.sandbox.SDP = OFFER;
  const code = page.run(`packDesc('offer', [9, 8, 7, 6], parseSdp(SDP))`);
  assert.ok(code.length < 200, 'short enough for a small QR code: ' + code.length);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const d = json(page, `unpackDesc(${JSON.stringify(code)})`);
  assert.strictEqual(d.kind, 'offer');
  assert.deepStrictEqual(d.id, [9, 8, 7, 6]);
  assert.strictEqual(d.ufrag, 'Xq3d');
  assert.strictEqual(d.pwd, 'k9VbGx2pP0yQz7Rk/Lm8+Tn1');
  assert.strictEqual(d.setup, 'actpass');
  assert.strictEqual(d.fp.length, 32);
  assert.deepStrictEqual(d.cands.map(c => [c.type, c.addr, c.port, c.prio]), [
    ['host', '192.0.2.10', 56143, 2122260223],
    ['host', '0f4a6b1e-3c2d-4e5f-8a9b-0c1d2e3f4a5b.local', 61610, 2122129151],
    ['host', '2001:db8:0:0:0:0:cafe:11', 58009, 2122199807],
    ['srflx', '203.0.113.7', 56143, 1686052607],
  ], 'UDP candidates kept with their priorities, TCP dropped');

  const sdp = page.run(`buildSdp(unpackDesc(${JSON.stringify(code)}))`);
  for (const line of ['a=ice-ufrag:Xq3d', 'a=ice-pwd:k9VbGx2pP0yQz7Rk/Lm8+Tn1', 'a=setup:actpass', 'a=mid:0', 'a=group:BUNDLE 0',
    'a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB:3C:D3:10:E2:12:2B:FC:A1:CD:9F:0A:AF',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel']) assert.ok(sdp.includes(line + '\r\n'), line);
  assert.match(sdp, /a=candidate:4 1 udp 1686052607 203\.0\.113\.7 56143 typ srflx raddr 0\.0\.0\.0 rport 0/);
  // the rebuilt description parses back to the same values
  assert.deepStrictEqual(json(page, `parseSdp(${JSON.stringify(sdp)}).cands.length`), 4);
});

test('broken or foreign codes are refused', () => {
  const page = createPage('phone-to-laptop/index.html');
  page.sandbox.SDP = OFFER;
  const code = page.run(`packDesc('answer', [1, 2, 3, 4], { ...parseSdp(SDP), setup: 'active' })`);
  for (const bad of ['', 'hello world', '!!!', code.slice(0, 20), 'AAAA' + code.slice(4)]) {
    assert.strictEqual(page.run(`unpackDesc(${JSON.stringify(bad)})`), null, bad.slice(0, 12));
  }
  assert.strictEqual(page.run(`parseSdp(${JSON.stringify(OFFER.replace('sha-256', 'sha-1'))})`), null, 'only SHA-256 fingerprints');
});

test("the computer only takes a reply to its own code", async () => {
  const page = createPage('phone-to-laptop/index.html');
  page.sandbox.SDP = OFFER;
  page.run(`myId = new Uint8Array([1, 2, 3, 4])`);
  const other = page.run(`'PTL' + packDesc('answer', [5, 5, 5, 5], parseSdp(SDP))`);
  assert.match(await page.run(`takeReply(${JSON.stringify(other)})`), /older code/);
  const offer = page.run(`'PTL' + packDesc('offer', [1, 2, 3, 4], parseSdp(SDP))`);
  assert.match(await page.run(`takeReply(${JSON.stringify(offer)})`), /isn't a reply/);
  assert.match(await page.run(`takeReply('PTLnonsense')`), /isn't a reply/);
});

function pair() {
  const a = createPage('phone-to-laptop/index.html'), b = createPage('phone-to-laptop/index.html');
  const c = channelPair();
  a.sandbox.ch = c.a; b.sandbox.ch = c.b;
  a.sandbox.File = b.sandbox.File = require('buffer').File;
  a.run('wire(ch)'); b.run('wire(ch)');
  c.pump();
  const flush = async () => { for (let i = 0; i < 40; i++) { c.pump(); await new Promise(r => setImmediate(r)); } };
  return { a, b, c, flush };
}

test('text and files go across both ways, byte for byte', async () => {
  const { a, b, flush } = pair();
  assert.match(a.run(`$('peerName').textContent`), /Connected to your computer/);
  a.run(`sendText('hello <b>there</b> https://example.com')`);
  b.run(`globalThis.src = new Uint8Array(200000).map((_, i) => (i * 31) & 255); sendFiles([new File([src], 'IMG_0001.jpg', { type: 'image/jpeg' })])`);
  await flush();
  const got = json(b, `[...items.values()].filter(i => !i.mine).map(i => i.text)`);
  assert.deepStrictEqual(got, ['hello <b>there</b> https://example.com']);
  assert.ok(!b.run(`[...items.values()][0].el.innerHTML`).includes('<b>'), 'text is shown as text');
  const rec = `[...items.values()].find(i => !i.mine && i.kind === 'file')`;
  assert.strictEqual(a.run(`${rec}.name`), 'IMG_0001.jpg');
  assert.strictEqual(a.run(`${rec}.blob.type`), 'image/jpeg');
  a.run(`${rec}.blob.arrayBuffer().then(x => { globalThis.out = new Uint8Array(x); })`);
  await flush();
  assert.strictEqual(a.run('out.length'), 200000);
  assert.strictEqual(a.run(`out.every((v, i) => v === ((i * 31) & 255))`), true);
});

test('hostile files: names are cleaned, page types are saved as plain bytes, and extra data is dropped', async () => {
  const { a, b, flush } = pair();
  b.run(`chan.send(JSON.stringify({ t: 'file', id: 'x', name: '../../.evil\\u0000.html', size: 4, type: 'text/html' })); chan.send(new Uint8Array([60, 104, 49, 62]).buffer); chan.send(JSON.stringify({ t: 'end', id: 'x' }))`);
  await flush();
  const rec = `[...items.values()].find(i => !i.mine)`;
  assert.strictEqual(a.run(`${rec}.name`), '_.._.evil_.html'.replace(/^\./, ''));
  assert.strictEqual(a.run(`${rec}.blob.type`), 'application/octet-stream');
  b.run(`chan.send(JSON.stringify({ t: 'file', id: 'y', name: 'a.bin', size: 2, type: '' })); chan.send(new Uint8Array(10).buffer); chan.send(JSON.stringify({ t: 'end' }))`);
  b.run(`chan.send(JSON.stringify({ t: 'file', name: 'b', size: -5 })); chan.send(JSON.stringify({ t: 'text', text: 42 })); chan.send('null'); chan.send(new Uint8Array(3).buffer)`);
  await flush();
  assert.strictEqual(a.run(`[...items.values()].filter(i => i.name === 'a.bin' && i.blob).length`), 0, 'more bytes than announced: not kept');
  assert.strictEqual(a.run(`[...items.values()].length`), 2);
});
